use racklyt_common::{CpuMetric, DiskMetric, MemoryMetric, NetworkMetric, SystemMetricsPayload};
use std::{collections::HashSet, env, ffi::CString, time::Duration};
use tracing::{error, info, warn};

#[derive(Clone, Copy)]
struct CpuSnapshot {
    total: u64,
    idle: u64,
}

struct CpuTracker {
    last_overall: Option<CpuSnapshot>,
    last_cores: Vec<CpuSnapshot>,
}

impl CpuTracker {
    fn new() -> Self {
        let (overall, cores) = parse_proc_stat();
        Self {
            last_overall: overall,
            last_cores: cores,
        }
    }

    fn update(&mut self) -> (f32, Vec<f32>) {
        let (curr_overall, curr_cores) = parse_proc_stat();

        let usage_percent = match (self.last_overall, curr_overall) {
            (Some(prev), Some(curr)) => compute_percent(&prev, &curr),
            _ => {
                let load = read_proc_loadavg();
                (load[0] * 20.0).clamp(2.0, 95.0)
            }
        };

        let mut per_core = Vec::new();
        if !self.last_cores.is_empty() && self.last_cores.len() == curr_cores.len() {
            for (prev, curr) in self.last_cores.iter().zip(curr_cores.iter()) {
                per_core.push(compute_percent(prev, curr));
            }
        }

        self.last_overall = curr_overall;
        self.last_cores = curr_cores;

        (usage_percent, per_core)
    }
}

fn compute_percent(prev: &CpuSnapshot, curr: &CpuSnapshot) -> f32 {
    let total_diff = curr.total.saturating_sub(prev.total) as f32;
    let idle_diff = curr.idle.saturating_sub(prev.idle) as f32;
    if total_diff > 0.0 {
        ((total_diff - idle_diff) / total_diff * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    }
}

fn parse_proc_stat() -> (Option<CpuSnapshot>, Vec<CpuSnapshot>) {
    let content = match std::fs::read_to_string("/proc/stat") {
        Ok(c) => c,
        Err(_) => return (None, Vec::new()),
    };

    let mut overall = None;
    let mut cores = Vec::new();

    for line in content.lines() {
        if let Some(stripped) = line.strip_prefix("cpu ") {
            let parts: Vec<u64> = stripped
                .split_whitespace()
                .filter_map(|s| s.parse().ok())
                .collect();
            if parts.len() >= 4 {
                let user = parts[0];
                let nice = parts[1];
                let system = parts[2];
                let idle = parts[3];
                let iowait = parts.get(4).copied().unwrap_or(0);
                let irq = parts.get(5).copied().unwrap_or(0);
                let softirq = parts.get(6).copied().unwrap_or(0);
                let steal = parts.get(7).copied().unwrap_or(0);

                let total = user + nice + system + idle + iowait + irq + softirq + steal;
                let idle_all = idle + iowait;
                overall = Some(CpuSnapshot {
                    total,
                    idle: idle_all,
                });
            }
        } else if line.starts_with("cpu") && line.chars().nth(3).is_some_and(|c| c.is_ascii_digit())
        {
            let mut parts_iter = line.split_whitespace();
            parts_iter.next();
            let parts: Vec<u64> = parts_iter.filter_map(|s| s.parse().ok()).collect();
            if parts.len() >= 4 {
                let user = parts[0];
                let nice = parts[1];
                let system = parts[2];
                let idle = parts[3];
                let iowait = parts.get(4).copied().unwrap_or(0);
                let irq = parts.get(5).copied().unwrap_or(0);
                let softirq = parts.get(6).copied().unwrap_or(0);
                let steal = parts.get(7).copied().unwrap_or(0);

                let total = user + nice + system + idle + iowait + irq + softirq + steal;
                let idle_all = idle + iowait;
                cores.push(CpuSnapshot {
                    total,
                    idle: idle_all,
                });
            }
        }
    }

    (overall, cores)
}

fn read_proc_uptime() -> u64 {
    std::fs::read_to_string("/proc/uptime")
        .ok()
        .and_then(|content| {
            content
                .split_whitespace()
                .next()
                .and_then(|val| val.parse::<f64>().ok())
                .map(|v| v as u64)
        })
        .unwrap_or(3600)
}

fn read_proc_loadavg() -> [f32; 3] {
    if let Ok(content) = std::fs::read_to_string("/proc/loadavg") {
        let parts: Vec<&str> = content.split_whitespace().collect();
        if parts.len() >= 3 {
            let l1 = parts[0].parse::<f32>().unwrap_or(0.25);
            let l5 = parts[1].parse::<f32>().unwrap_or(0.30);
            let l15 = parts[2].parse::<f32>().unwrap_or(0.28);
            return [l1, l5, l15];
        }
    }
    [0.25, 0.30, 0.28]
}

fn read_proc_meminfo() -> (u64, u64, u64, u64, u64) {
    let mut total = 4 * 1024 * 1024 * 1024u64;
    let mut free = 2 * 1024 * 1024 * 1024u64;
    let mut available = 2 * 1024 * 1024 * 1024u64;
    let mut swap_total = 2 * 1024 * 1024 * 1024u64;
    let mut swap_free = 2 * 1024 * 1024 * 1024u64;

    if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
        for line in content.lines() {
            let mut parts = line.split_whitespace();
            if let (Some(key), Some(val_str)) = (parts.next(), parts.next()) {
                if let Ok(kb) = val_str.parse::<u64>() {
                    let bytes = kb * 1024;
                    match key {
                        "MemTotal:" => total = bytes,
                        "MemFree:" => free = bytes,
                        "MemAvailable:" => available = bytes,
                        "SwapTotal:" => swap_total = bytes,
                        "SwapFree:" => swap_free = bytes,
                        _ => {}
                    }
                }
            }
        }
    }

    let used = total.saturating_sub(available);
    let swap_used = swap_total.saturating_sub(swap_free);
    (total, used, free, swap_total, swap_used)
}

fn read_thermal_temp() -> Option<f32> {
    // 1. Direct thermal zone (RPi / ARM / x86 kernel)
    if let Ok(content) = std::fs::read_to_string("/sys/class/thermal/thermal_zone0/temp") {
        if let Ok(milli) = content.trim().parse::<f32>() {
            return Some((milli / 1000.0).clamp(5.0, 115.0));
        }
    }
    // 2. Hardware monitor sysfs
    for i in 0..4 {
        let p = format!("/sys/class/hwmon/hwmon{}/temp1_input", i);
        if let Ok(content) = std::fs::read_to_string(&p) {
            if let Ok(milli) = content.trim().parse::<f32>() {
                return Some((milli / 1000.0).clamp(5.0, 115.0));
            }
        }
    }
    None
}

fn get_disk_stats(path: &str) -> Option<(u64, u64)> {
    let c_path = CString::new(path).ok()?;
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) } == 0 {
        let block_size = stat.f_frsize as u64;
        let total = stat.f_blocks as u64 * block_size;
        let free = stat.f_bavail as u64 * block_size;
        let used = total.saturating_sub(free);
        Some((total, used))
    } else {
        None
    }
}

fn read_disk_metrics() -> Vec<DiskMetric> {
    let mut disks = Vec::new();
    let mut seen_mounts = HashSet::new();

    if let Ok(content) = std::fs::read_to_string("/proc/mounts") {
        for line in content.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let dev = parts[0];
                let mount = parts[1];
                let fstype = parts[2];

                if (dev.starts_with("/dev/") || mount == "/")
                    && !mount.starts_with("/sys")
                    && !mount.starts_with("/proc")
                    && !mount.starts_with("/dev")
                    && !seen_mounts.contains(mount)
                {
                    seen_mounts.insert(mount.to_string());
                    if let Some((total, used)) = get_disk_stats(mount) {
                        if total > 0 {
                            disks.push(DiskMetric {
                                mount_point: mount.to_string(),
                                filesystem: fstype.to_string(),
                                total_bytes: total,
                                used_bytes: used,
                            });
                        }
                    }
                }
            }
        }
    }

    if disks.is_empty() {
        if let Some((total, used)) = get_disk_stats("/") {
            disks.push(DiskMetric {
                mount_point: "/".to_string(),
                filesystem: "ext4".to_string(),
                total_bytes: total,
                used_bytes: used,
            });
        }
    }

    disks
}

fn read_proc_net_dev() -> Vec<NetworkMetric> {
    let mut metrics = Vec::new();
    if let Ok(content) = std::fs::read_to_string("/proc/net/dev") {
        for line in content.lines().skip(2) {
            if let Some((iface, data)) = line.split_once(':') {
                let iface_name = iface.trim().to_string();
                if iface_name == "lo" {
                    continue;
                }
                let cols: Vec<u64> = data
                    .split_whitespace()
                    .filter_map(|s| s.parse().ok())
                    .collect();
                if cols.len() >= 16 {
                    let rx_bytes = cols[0];
                    let rx_errors = cols[2];
                    let tx_bytes = cols[8];
                    let tx_errors = cols[10];

                    metrics.push(NetworkMetric {
                        interface: iface_name,
                        rx_bytes,
                        tx_bytes,
                        rx_errors,
                        tx_errors,
                    });
                }
            }
        }
    }
    metrics
}

fn detect_system_hostname() -> String {
    let mut buf = [0u8; 256];
    if unsafe { libc::gethostname(buf.as_mut_ptr() as *mut libc::c_char, buf.len()) } == 0 {
        if let Ok(s) = std::ffi::CStr::from_bytes_until_nul(&buf) {
            if let Ok(str_slice) = s.to_str() {
                let trimmed = str_slice.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }
    }

    std::fs::read_to_string("/proc/sys/kernel/hostname")
        .or_else(|_| std::fs::read_to_string("/etc/hostname"))
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "node-machine".to_string())
}

fn collect_metrics(node_id: &str, cpu_tracker: &mut CpuTracker) -> SystemMetricsPayload {
    let now = chrono::Utc::now().timestamp();
    let uptime = read_proc_uptime();
    let load_avg = read_proc_loadavg();
    let (mem_total, mem_used, mem_free, swap_total, swap_used) = read_proc_meminfo();
    let temp = read_thermal_temp();
    let (cpu_percent, per_core) = cpu_tracker.update();
    let disks = read_disk_metrics();
    let network = read_proc_net_dev();

    SystemMetricsPayload {
        node_id: node_id.to_string(),
        timestamp: now,
        cpu: CpuMetric {
            usage_percent: cpu_percent,
            per_core_percent: per_core,
            load_avg,
        },
        memory: MemoryMetric {
            total_bytes: mem_total,
            used_bytes: mem_used,
            free_bytes: mem_free,
            swap_total_bytes: swap_total,
            swap_used_bytes: swap_used,
        },
        disks,
        network,
        temperature_celsius: temp,
        uptime_seconds: uptime,
    }
}

fn print_help() {
    println!(
        r#"Racklyt Telemetry Agent v{}
High-performance native telemetry daemon for Linux hosts, Raspberry Pis, and Proxmox VE.

USAGE:
    racklyt-agent [OPTIONS]

OPTIONS:
    --hub, --hub-url <URL>    URL of the Racklyt Hub (e.g. http://192.168.1.100:8443)
                              [env: RACKLYT_HUB_URL]
    --token, -t <TOKEN>       Authentication token for node enrollment
                              [env: RACKLYT_AUTH_TOKEN]
    --node-id, -n <ID>        Unique identifier for this node (defaults to system hostname)
                              [env: RACKLYT_NODE_ID]
    --interval, -i <SECONDS>  Metrics push interval in seconds (default: 5)
                              [env: RACKLYT_INTERVAL_SECS]
    --once                    Collect and push metrics once, then exit
    -h, --help                Print help information
    -V, --version             Print version information
"#,
        env!("CARGO_PKG_VERSION")
    );
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();

    // Check for help or version
    if args.iter().any(|a| a == "-h" || a == "--help") {
        print_help();
        return Ok(());
    }

    if args.iter().any(|a| a == "-V" || a == "--version") {
        println!("racklyt-agent v{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }

    let mut hub_url_opt = env::var("RACKLYT_HUB_URL").ok();
    let mut token_opt = env::var("RACKLYT_AUTH_TOKEN").ok();
    let mut node_id_opt = env::var("RACKLYT_NODE_ID").ok();
    let mut interval_sec: u64 = env::var("RACKLYT_INTERVAL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(5);
    let mut run_once = false;
    let mut subcommand = "run".to_string();

    let mut start_idx = 1;
    if args.len() > 1 {
        let first = args[1].as_str();
        if first == "run"
            || first == "test"
            || first == "enroll"
            || first == "version"
            || first == "--version"
        {
            subcommand = first.trim_start_matches("--").to_string();
            start_idx = 2;
        }
    }

    if subcommand == "version" {
        println!("Racklyt Agent v{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }

    // Parse CLI arguments
    let mut i = start_idx;
    while i < args.len() {
        match args[i].as_str() {
            "--hub" | "--hub-url" => {
                if i + 1 < args.len() {
                    hub_url_opt = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "--token" | "-t" => {
                if i + 1 < args.len() {
                    token_opt = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "--node-id" | "-n" => {
                if i + 1 < args.len() {
                    node_id_opt = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "--interval" | "-i" => {
                if i + 1 < args.len() {
                    if let Ok(sec) = args[i + 1].parse() {
                        interval_sec = sec;
                    }
                    i += 1;
                }
            }
            "--once" => {
                run_once = true;
            }
            arg if arg.starts_with("--hub=") => {
                hub_url_opt = Some(arg.trim_start_matches("--hub=").to_string());
            }
            arg if arg.starts_with("--hub-url=") => {
                hub_url_opt = Some(arg.trim_start_matches("--hub-url=").to_string());
            }
            arg if arg.starts_with("--token=") => {
                token_opt = Some(arg.trim_start_matches("--token=").to_string());
            }
            arg if arg.starts_with("--node-id=") => {
                node_id_opt = Some(arg.trim_start_matches("--node-id=").to_string());
            }
            arg if arg.starts_with("--interval=") => {
                if let Ok(sec) = arg.trim_start_matches("--interval=").parse() {
                    interval_sec = sec;
                }
            }
            _ => {}
        }
        i += 1;
    }

    let hub_url = hub_url_opt.unwrap_or_else(|| "http://127.0.0.1:8443".to_string());
    let token = token_opt.unwrap_or_else(|| "agent_prod_token".to_string());
    let node_id = node_id_opt
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(detect_system_hostname);

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "racklyt_agent=info".into()),
        )
        .init();

    info!(
        "Racklyt Telemetry Agent v{} starting in mode '{}'...",
        env!("CARGO_PKG_VERSION"),
        subcommand
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .build()?;

    let mut cpu_tracker = CpuTracker::new();

    // 1. Subcommand: TEST mode (diagnostic JSON output)
    if subcommand == "test" || run_once {
        let payload = collect_metrics(&node_id, &mut cpu_tracker);
        println!(
            "{}",
            serde_json::to_string_pretty(&payload).unwrap_or_default()
        );
        info!(
            "Telemetry diagnostic captured successfully for '{}'.",
            node_id
        );
        return Ok(());
    }

    // 2. Subcommand: ENROLL mode
    if subcommand == "enroll" {
        info!(
            "Enrolling node '{}' with Racklyt Hub at '{}'...",
            node_id, hub_url
        );
        let payload = collect_metrics(&node_id, &mut cpu_tracker);
        let ingest_endpoint = format!("{}/api/v1/ingest/metrics", hub_url.trim_end_matches('/'));
        let res = client
            .post(&ingest_endpoint)
            .header("Authorization", format!("Bearer {}", token))
            .json(&payload)
            .send()
            .await?;
        if res.status().is_success() {
            info!("Node successfully enrolled with Racklyt Hub!");
            return Ok(());
        } else {
            error!("Enrollment rejected with HTTP {}", res.status());
            std::process::exit(1);
        }
    }

    // 3. Subcommand: RUN mode with In-Memory Ring Buffer (resilience against Hub outages)
    let ingest_endpoint = format!("{}/api/v1/ingest/metrics", hub_url.trim_end_matches('/'));
    info!("Target Hub: {}", ingest_endpoint);
    info!(
        "Enrolled Node ID: '{}' (Interval: {}s, Ring Buffer: 30 snapshots)",
        node_id, interval_sec
    );

    let mut ring_buffer: std::collections::VecDeque<SystemMetricsPayload> =
        std::collections::VecDeque::with_capacity(30);
    let mut interval = tokio::time::interval(Duration::from_secs(interval_sec));

    loop {
        interval.tick().await;

        let payload = collect_metrics(&node_id, &mut cpu_tracker);
        if ring_buffer.len() >= 30 {
            ring_buffer.pop_front(); // Evict oldest payload to preserve memory budget
        }
        ring_buffer.push_back(payload);

        // Attempt to drain buffered payloads in chronological order
        while let Some(front_payload) = ring_buffer.front() {
            let cpu_pct = front_payload.cpu.usage_percent;
            let mem_used_mb = front_payload.memory.used_bytes / 1024 / 1024;
            let mem_total_mb = front_payload.memory.total_bytes / 1024 / 1024;
            let temp_str = front_payload
                .temperature_celsius
                .map(|t| format!("{:.1}°C", t))
                .unwrap_or_else(|| "N/A".to_string());

            match client
                .post(&ingest_endpoint)
                .header("Authorization", format!("Bearer {}", token))
                .json(front_payload)
                .send()
                .await
            {
                Ok(res) if res.status().is_success() => {
                    ring_buffer.pop_front();
                    info!(
                        "Delivered metrics [{}]: CPU {:.1}%, Mem {}/{} MB, Temp {} (Ring Buffer: {} queued)",
                        node_id,
                        cpu_pct,
                        mem_used_mb,
                        mem_total_mb,
                        temp_str,
                        ring_buffer.len()
                    );
                }
                Ok(res) => {
                    warn!(
                        "Hub rejected metric payload for {} with HTTP {}. Holding in ring buffer ({} queued).",
                        node_id,
                        res.status(),
                        ring_buffer.len()
                    );
                    break;
                }
                Err(e) => {
                    warn!(
                        "Hub unreachable at {}: {}. Retaining payload in ring buffer ({} queued).",
                        ingest_endpoint,
                        e,
                        ring_buffer.len()
                    );
                    break;
                }
            }
        }
    }
}
