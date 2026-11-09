use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use std::path::Path;
use tracing::info;

pub type DbPool = Pool<SqliteConnectionManager>;

/// Initializes the SQLite connection pool with embedded WAL pragmas
pub fn init_db_pool<P: AsRef<Path>>(db_path: P) -> Result<DbPool, Box<dyn std::error::Error>> {
    let manager = SqliteConnectionManager::file(&db_path).with_init(|conn: &mut Connection| {
        // Flash durability and performance PRAGMAs
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
                 PRAGMA synchronous = NORMAL;
                 PRAGMA temp_store = MEMORY;
                 PRAGMA cache_size = -64000;
                 PRAGMA busy_timeout = 5000;
                 PRAGMA foreign_keys = ON;",
        )?;
        Ok(())
    });

    let pool = Pool::builder().max_size(16).build(manager)?;

    // Run schema migrations and bootstrap seeds
    let conn = pool.get()?;
    run_migrations(&conn)?;

    // SEC-12 Hardening: Enforce 0600 file permissions on SQLite database and WAL on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(db_path.as_ref()) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o600);
            let _ = std::fs::set_permissions(db_path.as_ref(), perms);
        }
        for ext in &["-wal", "-shm"] {
            let companion = format!("{}{}", db_path.as_ref().display(), ext);
            if let Ok(metadata) = std::fs::metadata(&companion) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o600);
                let _ = std::fs::set_permissions(&companion, perms);
            }
        }
    }

    Ok(pool)
}

fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            is_system INTEGER NOT NULL DEFAULT 0,
            permissions TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT,
            password_hash TEXT NOT NULL,
            role_id TEXT NOT NULL REFERENCES roles(id),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_resource_scopes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            scope_type TEXT NOT NULL,
            scope_value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            hostname TEXT NOT NULL,
            os TEXT NOT NULL,
            arch TEXT NOT NULL,
            ip_address TEXT,
            status TEXT NOT NULL DEFAULT 'offline',
            push_interval_sec INTEGER NOT NULL DEFAULT 10,
            auth_token_hash TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            last_seen_at INTEGER,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metrics_raw (
            node_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            cpu_percent REAL NOT NULL,
            memory_used_bytes INTEGER NOT NULL,
            memory_total_bytes INTEGER NOT NULL,
            disk_used_bytes INTEGER NOT NULL,
            disk_total_bytes INTEGER NOT NULL,
            net_rx_bytes INTEGER NOT NULL,
            net_tx_bytes INTEGER NOT NULL,
            temp_celsius REAL,
            extra_json TEXT,
            PRIMARY KEY (node_id, timestamp)
        ) WITHOUT ROWID;

        CREATE TABLE IF NOT EXISTS dashboards (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            is_default INTEGER NOT NULL DEFAULT 0,
            is_public INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS dashboard_widgets (
            id TEXT PRIMARY KEY,
            dashboard_id TEXT NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
            widget_type TEXT NOT NULL,
            title TEXT NOT NULL,
            grid_x INTEGER NOT NULL,
            grid_y INTEGER NOT NULL,
            grid_w INTEGER NOT NULL,
            grid_h INTEGER NOT NULL,
            config TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notification_devices (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            device_name TEXT NOT NULL,
            platform TEXT NOT NULL,
            push_token TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            last_used_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS notifications_log (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
            alert_id TEXT NOT NULL,
            node_id TEXT,
            severity TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            metadata_json TEXT,
            is_read INTEGER NOT NULL DEFAULT 0,
            is_acknowledged INTEGER NOT NULL DEFAULT 0,
            sent_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS smtp_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            host TEXT NOT NULL,
            port INTEGER NOT NULL DEFAULT 587,
            username TEXT,
            password_enc TEXT,
            from_address TEXT NOT NULL,
            tls_mode TEXT NOT NULL DEFAULT 'starttls',
            is_enabled INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS login_audit_log (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            username TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            status TEXT NOT NULL,
            failure_reason TEXT,
            attempted_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metrics_hourly (
            node_id TEXT NOT NULL,
            hour_timestamp INTEGER NOT NULL,
            avg_cpu REAL NOT NULL,
            max_cpu REAL NOT NULL,
            avg_memory_used INTEGER NOT NULL,
            max_memory_used INTEGER NOT NULL,
            avg_temp REAL,
            max_temp REAL,
            net_rx_total INTEGER NOT NULL,
            net_tx_total INTEGER NOT NULL,
            sample_count INTEGER NOT NULL,
            PRIMARY KEY (node_id, hour_timestamp)
        ) WITHOUT ROWID;

        CREATE TABLE IF NOT EXISTS alert_rules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            metric TEXT NOT NULL,
            operator TEXT NOT NULL,
            threshold REAL NOT NULL,
            duration_seconds INTEGER NOT NULL DEFAULT 60,
            severity TEXT NOT NULL DEFAULT 'warning',
            target_node_id TEXT,
            channel TEXT NOT NULL DEFAULT 'all',
            is_enabled INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL
        );
        ",
    )?;

    // Safe schema updates for existing databases
    let _ = conn.execute(
        "ALTER TABLE users ADD COLUMN password_locked INTEGER NOT NULL DEFAULT 1",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute("ALTER TABLE users ADD COLUMN two_factor_secret TEXT", []);
    let _ = conn.execute(
        "ALTER TABLE users ADD COLUMN two_factor_enforced INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE users ADD COLUMN initial_generated_password TEXT",
        [],
    );

    // Seed default roles and initial admin if empty
    seed_defaults(conn)?;

    info!("Database initialized and verified.");
    Ok(())
}

fn seed_defaults(conn: &Connection) -> Result<(), rusqlite::Error> {
    let now = chrono::Utc::now().timestamp();

    // 1. Built-in Roles
    let superadmin_perms = serde_json::to_string(&vec!["*"]).unwrap_or_default();
    let admin_perms = serde_json::to_string(&vec![
        "users:manage",
        "nodes:enroll",
        "nodes:delete",
        "alerts:configure",
        "alerts:ack",
        "dashboard:manage_public",
        "dashboard:manage_private",
        "metrics:read",
    ])
    .unwrap_or_default();
    let operator_perms = serde_json::to_string(&vec![
        "alerts:ack",
        "dashboard:manage_public",
        "dashboard:manage_private",
        "metrics:read",
    ])
    .unwrap_or_default();
    let viewer_perms = serde_json::to_string(&vec!["dashboard:manage_private", "metrics:read"])
        .unwrap_or_default();

    conn.execute(
        "INSERT OR IGNORE INTO roles (id, name, is_system, permissions, created_at)
         VALUES ('role_superadmin', 'SuperAdmin', 1, ?1, ?2)",
        rusqlite::params![superadmin_perms, now],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO roles (id, name, is_system, permissions, created_at)
         VALUES ('role_admin', 'Administrator', 1, ?1, ?2)",
        rusqlite::params![admin_perms, now],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO roles (id, name, is_system, permissions, created_at)
         VALUES ('role_operator', 'Operator', 1, ?1, ?2)",
        rusqlite::params![operator_perms, now],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO roles (id, name, is_system, permissions, created_at)
         VALUES ('role_viewer', 'Viewer', 1, ?1, ?2)",
        rusqlite::params![viewer_perms, now],
    )?;

    // 2. Default SuperAdmin User ("admin" / default pass "admin123")
    let user_count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if user_count == 0 {
        let admin_hash =
            crate::auth::hash_password("admin123").unwrap_or_else(|_| "admin123".to_string());
        conn.execute(
            "INSERT INTO users (id, username, email, password_hash, role_id, is_active, created_at, updated_at)
             VALUES ('user_admin', 'admin', 'admin@racklyt.local', ?1, 'role_superadmin', 1, ?2, ?2)",
            rusqlite::params![admin_hash, now],
        )?;
        info!("Seeded default SuperAdmin user: 'admin' (Password: 'admin123')");
    }

    // 3. Purge any old legacy dashboards so only the 10 showcase dashboards exist
    let _ = conn.execute(
        "DELETE FROM dashboard_widgets WHERE dashboard_id IN ('dash_proxmox', 'dash_hardware', 'dash_docker')
         OR dashboard_id NOT IN ('dash_default', 'dash_server_prod', 'dash_server_pve', 'dash_server_apps', 'dash_server_storage', 'dash_thermals', 'dash_cpu', 'dash_network', 'dash_storage', 'dash_security')",
        [],
    );
    let _ = conn.execute(
        "DELETE FROM dashboards WHERE id IN ('dash_proxmox', 'dash_hardware', 'dash_docker')
         OR (user_id IS NULL AND id NOT IN ('dash_default', 'dash_server_prod', 'dash_server_pve', 'dash_server_apps', 'dash_server_storage', 'dash_thermals', 'dash_cpu', 'dash_network', 'dash_storage', 'dash_security'))",
        [],
    );

    // 10 Specialized Operations Showcase Dashboards
    let dashboards_to_seed = vec![
        ("dash_default", "Fleet Master Cockpit", "1 for everything: cross-fleet health, multi-host dials, latency matrix, network, docker, logs & alerts", 1),
        ("dash_server_prod", "Server: Production Edge Gateway", "Server 1: reverse proxy, edge ingress, nginx/envoy sockets, gateway latencies & SSL", 0),
        ("dash_server_pve", "Server: Proxmox Hypervisor", "Server 2: Proxmox VE cluster node, QEMU VMs, LXC containers, ZFS arc & vmbr0", 0),
        ("dash_server_apps", "Server: Docker & Apps Fleet", "Server 3: App services, Redis, Postgres, Docker container fleet cockpit & overlay network", 0),
        ("dash_server_storage", "Server: TrueNAS Storage NAS", "Server 4: TrueNAS storage node, ZFS raidz2 pools, NVMe cache, SMB/NFS/iSCSI & IOPS", 0),
        ("dash_thermals", "Thermals & Environmental Center", "Dedicated temperature center: SoC sensors, CPU package temps, NVMe thermals & ambient watchdogs", 0),
        ("dash_cpu", "Processor & Multi-Core Distribution", "CPU architecture deep-dive: per-core load, clock frequencies, 1m/5m/15m load averages & governors", 0),
        ("dash_network", "Network Operations & Sockets", "Network operations: interface bandwidth (eth0, wlan0, vmbr0), live ports audit & connection journal", 0),
        ("dash_storage", "Storage, Volumes & Filesystems", "Storage deep-dive: ZFS & ext4 mount points, NVMe capacity dials, IOPS read/write & volume alerts", 0),
        ("dash_security", "Security, Audits & Watchdogs", "Security audits: exposed ports audit, failed SSH attempts, dead-man watchdogs & incident response", 0),
    ];

    for (d_id, title, desc, is_def) in dashboards_to_seed {
        conn.execute(
            "INSERT INTO dashboards (id, user_id, title, description, is_default, is_public, created_at, updated_at)
             VALUES (?1, NULL, ?2, ?3, ?4, 1, ?5, ?5)
             ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description, updated_at = excluded.updated_at",
            rusqlite::params![d_id, title, desc, is_def, now],
        )?;

        // Seed respective widgets for each dashboard
        let widgets: Vec<(&str, &str, &str, u32, u32, u32, u32, &str)> = match d_id {
            "dash_default" | "dash_fleet" => vec![
                ("w_def_sys", "sysinfo", "Host Hardware Specs & OS", 0, 0, 6, 3, "{}"),
                ("w_def_fleet", "fleet-status", "Cluster Node Ping & Latency Matrix", 6, 0, 6, 3, "{}"),
                ("w_def_cpu", "circular-gauge", "CPU Utilization Dial", 0, 3, 2, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"value\":24.8,\"subtitle\":\"Quad Core Load\"}"),
                ("w_def_temp", "circular-gauge", "Hardware Thermal Watchdog", 2, 3, 2, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"value\":43.5,\"subtitle\":\"Broadcom SoC Sensor\"}"),
                ("w_def_ram", "circular-gauge", "Memory Utilization Dial", 4, 3, 2, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"value\":54.2,\"subtitle\":\"DDR4 Allocation\"}"),
                ("w_def_disk", "circular-gauge", "NVMe Storage Pool Dial", 6, 3, 2, 3, "{\"query\":\"disk_percent\",\"unit\":\"%\",\"value\":38.6,\"subtitle\":\"Root Ext4 Mount\"}"),
                ("w_def_rx", "circular-gauge", "Ingress Rx Bandwidth", 8, 3, 2, 3, "{\"query\":\"rx_bandwidth\",\"unit\":\"MB/s\",\"value\":12.8,\"subtitle\":\"Gigabit Link\"}"),
                ("w_def_tx", "circular-gauge", "Egress Tx Bandwidth", 10, 3, 2, 3, "{\"query\":\"tx_bandwidth\",\"unit\":\"MB/s\",\"value\":5.4,\"subtitle\":\"Gigabit Link\"}"),
                ("w_def_chart", "time-series", "Host & Cluster Telemetry History", 0, 6, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"%\"}"),
                ("w_def_net", "network-traffic", "Network Throughput & Bandwidth Hub", 0, 10, 6, 4, "{\"rxSpeedMb\":5.4,\"txSpeedMb\":2.1,\"interfaceName\":\"eth0\"}"),
                ("w_def_ports", "ports-table", "Open Listening Sockets & Ports", 6, 10, 6, 4, "{}"),
                ("w_def_cores", "cpu-breakdown", "Multi-Core CPU Load Distribution", 0, 14, 4, 3, "{}"),
                ("w_def_storage", "storage-gauge", "Filesystem Mounts & Storage Capacity", 4, 14, 4, 3, "{}"),
                ("w_def_proxmox", "proxmox-summary", "Proxmox VE Cluster Node", 8, 14, 4, 3, "{}"),
                ("w_def_docker", "docker-fleet", "Docker Container Fleet Cockpit", 0, 17, 12, 5, "{}"),
                ("w_def_journal", "log-stream", "Realtime System & Kernel Journal", 0, 22, 6, 3, "{}"),
                ("w_def_alerts", "recent-alerts", "Dead-Man Watchdog & Security Alerts", 6, 22, 6, 3, "{}"),
            ],
            "dash_server_prod" => vec![
                ("w_prod_specs", "sysinfo", "Edge Gateway Host Specs & Kernel", 0, 0, 6, 3, "{}"),
                ("w_prod_ports", "ports-table", "Nginx, Envoy & WireGuard Edge Sockets", 6, 0, 6, 3, "{}"),
                ("w_prod_rx", "circular-gauge", "Ingress CDN Throughput", 0, 3, 2, 3, "{\"query\":\"rx_bandwidth\",\"unit\":\"MB/s\",\"value\":38.4,\"subtitle\":\"Fiber Uplink\"}"),
                ("w_prod_tx", "circular-gauge", "Egress Traffic Stream", 2, 3, 2, 3, "{\"query\":\"tx_bandwidth\",\"unit\":\"MB/s\",\"value\":19.2,\"subtitle\":\"Fiber Uplink\"}"),
                ("w_prod_cpu", "circular-gauge", "Proxy CPU Load", 4, 3, 2, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"value\":18.6,\"subtitle\":\"Event Loops\"}"),
                ("w_prod_ram", "circular-gauge", "SSL Cache & Buffers", 6, 3, 2, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"value\":34.1,\"subtitle\":\"Shared Memory\"}"),
                ("w_prod_temp", "circular-gauge", "Edge Die Temp", 8, 3, 2, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"value\":42.1,\"subtitle\":\"Gateway Package\"}"),
                ("w_prod_conns", "circular-gauge", "Active TLS Clients", 10, 3, 2, 3, "{\"query\":\"active_conns\",\"unit\":\"\",\"value\":384,\"subtitle\":\"Keepalive Conns\"}"),
                ("w_prod_net", "network-traffic", "Public Edge Ingress & Egress Interface", 0, 6, 6, 4, "{\"rxSpeedMb\":38.4,\"txSpeedMb\":19.2,\"interfaceName\":\"eth0\"}"),
                ("w_prod_cores", "cpu-breakdown", "NIC IRQ Affinity & Processing Cores", 6, 6, 6, 4, "{}"),
                ("w_prod_chart", "time-series", "Edge Inbound Traffic & HTTP Request Timeline", 0, 10, 12, 4, "{\"query\":\"network_rx_speed\",\"unit\":\"MB/s\"}"),
                ("w_prod_logs", "log-stream", "Edge Proxy Access & TLS Handshake Journal", 0, 14, 6, 3, "{}"),
                ("w_prod_alerts", "recent-alerts", "DDoS, Rate-Limit & Certificate Expiry Alerts", 6, 14, 6, 3, "{}"),
            ],
            "dash_server_pve" | "dash_proxmox" => vec![
                ("w_pve_sum", "proxmox-summary", "Proxmox VE Cluster Node & VM/LXC Manager", 0, 0, 8, 4, "{}"),
                ("w_pve_nodes", "fleet-status", "Hypervisor Node Ping & Latency Matrix", 8, 0, 4, 4, "{}"),
                ("w_pve_cpu", "circular-gauge", "Hypervisor CPU Allocation", 0, 4, 2, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"value\":28.4,\"subtitle\":\"EPYC Host Load\"}"),
                ("w_pve_ram", "circular-gauge", "Hypervisor RAM & ZFS Arc", 2, 4, 2, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"value\":64.2,\"subtitle\":\"ZFS Arc & Guests\"}"),
                ("w_pve_temp", "circular-gauge", "Die Temp Sensor", 4, 4, 2, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"value\":41.8,\"subtitle\":\"EPYC Package\"}"),
                ("w_pve_iops", "circular-gauge", "ZFS Pool Active IOPS", 6, 4, 2, 3, "{\"query\":\"iops\",\"unit\":\"k\",\"value\":11.4,\"subtitle\":\"LVM-Thin I/O\"}"),
                ("w_pve_rx", "circular-gauge", "vmbr0 Ingress Speed", 8, 4, 2, 3, "{\"query\":\"rx_bandwidth\",\"unit\":\"MB/s\",\"value\":34.2,\"subtitle\":\"Host Ingress\"}"),
                ("w_pve_tx", "circular-gauge", "vmbr0 Egress Speed", 10, 4, 2, 3, "{\"query\":\"tx_bandwidth\",\"unit\":\"MB/s\",\"value\":26.8,\"subtitle\":\"Host Egress\"}"),
                ("w_pve_ts", "time-series", "VM & Container Resource Workload Timeline", 0, 7, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"%\"}"),
                ("w_pve_net", "network-traffic", "Bridged Virtual Network vmbr0", 0, 11, 6, 4, "{\"rxSpeedMb\":34.2,\"txSpeedMb\":26.8,\"interfaceName\":\"vmbr0\"}"),
                ("w_pve_ports", "ports-table", "Hypervisor API, Corosync & SPICE Ports", 6, 11, 6, 4, "{}"),
                ("w_pve_store", "storage-gauge", "ZFS Pools & LVM-Thin Storage Mounts", 0, 15, 6, 3, "{}"),
                ("w_pve_cores", "cpu-breakdown", "Host Physical Cores Load & Frequency", 6, 15, 6, 3, "{}"),
                ("w_pve_specs", "sysinfo", "Hypervisor Hardware & Kernel Specs", 0, 18, 6, 3, "{}"),
                ("w_pve_logs", "log-stream", "PVE Cluster Task Logs & Journal", 6, 18, 6, 3, "{}"),
                ("w_pve_alerts", "recent-alerts", "Hypervisor Watchdog & HA Alerts", 0, 21, 12, 3, "{}"),
            ],
            "dash_server_apps" | "dash_docker" => vec![
                ("w_doc_fleet", "docker-fleet", "Docker Container Fleet Cockpit", 0, 0, 12, 4, "{}"),
                ("w_doc_cpu_dial", "circular-gauge", "Container Engine CPU Load", 0, 4, 2, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"value\":22.1,\"subtitle\":\"Docker Daemon\"}"),
                ("w_doc_ram_dial", "circular-gauge", "Containers Memory Utilization", 2, 4, 2, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"value\":48.7,\"subtitle\":\"Resident Sets\"}"),
                ("w_doc_pids_dial", "circular-gauge", "Container Threads & PIDs", 4, 4, 2, 3, "{\"query\":\"pids_count\",\"unit\":\" pids\",\"value\":142,\"subtitle\":\"Worker Tasks\"}"),
                ("w_doc_iops_dial", "circular-gauge", "Container OverlayFS I/O", 6, 4, 2, 3, "{\"query\":\"disk_io\",\"unit\":\"MB/s\",\"value\":8.6,\"subtitle\":\"Volume R/W\"}"),
                ("w_doc_rx_dial", "circular-gauge", "Bridge Ingress Rx", 8, 4, 2, 3, "{\"query\":\"rx_bandwidth\",\"unit\":\"MB/s\",\"value\":18.2,\"subtitle\":\"docker0 Inbound\"}"),
                ("w_doc_tx_dial", "circular-gauge", "Bridge Egress Tx", 10, 4, 2, 3, "{\"query\":\"tx_bandwidth\",\"unit\":\"MB/s\",\"value\":14.1,\"subtitle\":\"docker0 Outbound\"}"),
                ("w_doc_ts", "time-series", "Container Resource History Timeline", 0, 7, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"%\"}"),
                ("w_doc_store", "storage-gauge", "Docker Volumes & OverlayFS Mounts", 0, 11, 6, 4, "{}"),
                ("w_doc_ports", "ports-table", "Container Ingress & Port Bindings", 6, 11, 6, 4, "{}"),
                ("w_doc_net", "network-traffic", "Docker Bridge & Overlay Network Traffic", 0, 15, 6, 3, "{\"rxSpeedMb\":18.2,\"txSpeedMb\":14.1,\"interfaceName\":\"docker0\"}"),
                ("w_doc_cores", "cpu-breakdown", "Container Host Core Allocation", 6, 15, 6, 3, "{}"),
                ("w_doc_specs", "sysinfo", "Container Host Architecture & Daemon", 0, 18, 6, 3, "{}"),
                ("w_doc_logs", "log-stream", "Docker Daemon & Container Event Journal", 6, 18, 6, 3, "{}"),
                ("w_doc_alerts", "recent-alerts", "Healthcheck Fails & Restart Alerts", 0, 21, 12, 3, "{}"),
            ],
            "dash_server_storage" => vec![
                ("w_nas_store", "storage-gauge", "ZFS Storage Pools & RAIDZ Datasets", 0, 0, 8, 4, "{}"),
                ("w_nas_ports", "ports-table", "NFS, SMB, iSCSI & S3 Storage Sockets", 8, 0, 4, 4, "{}"),
                ("w_nas_dial_cap", "circular-gauge", "ZFS Pool Allocation Dial", 0, 4, 2, 3, "{\"query\":\"disk_percent\",\"unit\":\"%\",\"value\":48.2,\"subtitle\":\"RAIDZ2 Pool\"}"),
                ("w_nas_dial_arc", "circular-gauge", "ZFS ARC Hit Ratio Dial", 2, 4, 2, 3, "{\"query\":\"arc_hit\",\"unit\":\"%\",\"value\":94.6,\"subtitle\":\"L1/L2 ARC Cache\"}"),
                ("w_nas_dial_temp", "circular-gauge", "NVMe & SAS Flash Drive Thermals", 4, 4, 2, 3, "{\"query\":\"drive_temp\",\"unit\":\"°C\",\"value\":36.2,\"subtitle\":\"S.M.A.R.T. Array\"}"),
                ("w_nas_dial_iops", "circular-gauge", "Storage Array Read/Write IOPS", 6, 4, 2, 3, "{\"query\":\"iops\",\"unit\":\"k\",\"value\":14.8,\"subtitle\":\"NVMe Metadata Tier\"}"),
                ("w_nas_dial_read", "circular-gauge", "Array Read Bandwidth", 8, 4, 2, 3, "{\"query\":\"read_speed\",\"unit\":\"MB/s\",\"value\":124.6,\"subtitle\":\"Continuous Read\"}"),
                ("w_nas_dial_write", "circular-gauge", "Array Write Bandwidth", 10, 4, 2, 3, "{\"query\":\"write_speed\",\"unit\":\"MB/s\",\"value\":48.2,\"subtitle\":\"Continuous Write\"}"),
                ("w_nas_chart", "time-series", "Block I/O Bandwidth & IOPS Telemetry History", 0, 7, 12, 4, "{\"query\":\"iops_history\",\"unit\":\"MB/s\"}"),
                ("w_nas_net", "network-traffic", "Storage Network 10GbE SFP+ Traffic", 0, 11, 6, 4, "{\"rxSpeedMb\":42.1,\"txSpeedMb\":68.4,\"interfaceName\":\"eth0\"}"),
                ("w_nas_cores", "cpu-breakdown", "ZFS LZ4 & SHA256 Checksum Core Co-Processors", 6, 11, 6, 4, "{}"),
                ("w_nas_specs", "sysinfo", "TrueNAS SCALE Host & SAS HBA Controller", 0, 15, 6, 3, "{}"),
                ("w_nas_logs", "log-stream", "ZFS Scrub, SMART & Sync Journal", 6, 15, 6, 3, "{}"),
                ("w_nas_alerts", "recent-alerts", "Storage Pool Degradation & Drive Reallocated Sectors", 0, 18, 12, 3, "{}"),
            ],
            "dash_thermals" | "dash_hardware" => vec![
                ("w_hw_soc", "circular-gauge", "Broadcom SoC Sensor", 0, 0, 2, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"value\":43.5,\"subtitle\":\"BCM2711 Die Sensor\"}"),
                ("w_hw_pkg", "circular-gauge", "CPU Package Die", 2, 0, 2, 3, "{\"query\":\"pkg_temp\",\"unit\":\"°C\",\"value\":48.2,\"subtitle\":\"Tdie Core Package\"}"),
                ("w_hw_nvme", "circular-gauge", "NVMe Controller", 4, 0, 2, 3, "{\"query\":\"nvme_temp\",\"unit\":\"°C\",\"value\":39.0,\"subtitle\":\"PCIe 4.0 Storage\"}"),
                ("w_hw_vrm", "circular-gauge", "VRM Power Stage", 6, 0, 2, 3, "{\"query\":\"vrm_temp\",\"unit\":\"°C\",\"value\":52.1,\"subtitle\":\"MOSFET Power Rail\"}"),
                ("w_hw_pch", "circular-gauge", "PCH Chipset Hub", 8, 0, 2, 3, "{\"query\":\"pch_temp\",\"unit\":\"°C\",\"value\":44.8,\"subtitle\":\"Southbridge Controller\"}"),
                ("w_hw_ambient", "circular-gauge", "Rack Ambient Intake", 10, 0, 2, 3, "{\"query\":\"ambient_temp\",\"unit\":\"°C\",\"value\":23.5,\"subtitle\":\"Chassis Air Intake\"}"),
                ("w_hw_ts", "time-series", "Thermal History & Dynamic Clock Scaling", 0, 3, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"°C\"}"),
                ("w_hw_cores", "cpu-breakdown", "Per-Core Thermal State & Turbo Governors", 0, 7, 6, 3, "{}"),
                ("w_hw_store", "storage-gauge", "NVMe & SSD Flash Health (S.M.A.R.T. Telemetry)", 6, 7, 6, 3, "{}"),
                ("w_hw_specs", "sysinfo", "Thermal Controller & Kernel Power Specs", 0, 10, 6, 3, "{}"),
                ("w_hw_net", "network-traffic", "Ethernet Controller Hardware Throughput", 6, 10, 6, 3, "{\"rxSpeedMb\":12.8,\"txSpeedMb\":5.4,\"interfaceName\":\"eth0\"}"),
                ("w_hw_ports", "ports-table", "IPMI, BMC & Hardware Management Sockets", 0, 13, 6, 3, "{}"),
                ("w_hw_fleet", "fleet-status", "Fleet Thermal Health & Response Matrix", 6, 13, 6, 3, "{}"),
                ("w_hw_journal", "log-stream", "Kernel Journal & Thermal Throttling Logs", 0, 16, 6, 3, "{}"),
                ("w_hw_alerts", "recent-alerts", "Thermal Overheat & Undervoltage Watchdogs", 6, 16, 6, 3, "{}"),
            ],
            "dash_cpu" => vec![
                ("w_cpu_cores_full", "cpu-breakdown", "Physical Multi-Core Load Distribution & Governors", 0, 0, 8, 4, "{}"),
                ("w_cpu_specs_full", "sysinfo", "CPU Architecture, Cache & AVX Flags", 8, 0, 4, 4, "{}"),
                ("w_cpu_d1", "circular-gauge", "1-Min Load Avg", 0, 4, 2, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"value\":22.4,\"subtitle\":\"Normalized 1m\"}"),
                ("w_cpu_d5", "circular-gauge", "5-Min Load Avg", 2, 4, 2, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"value\":19.8,\"subtitle\":\"Normalized 5m\"}"),
                ("w_cpu_d15", "circular-gauge", "15-Min Load Avg", 4, 4, 2, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"value\":17.5,\"subtitle\":\"Normalized 15m\"}"),
                ("w_cpu_d_util", "circular-gauge", "Core Utilization", 6, 4, 2, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"value\":24.8,\"subtitle\":\"All Cores Aggregate\"}"),
                ("w_cpu_d_temp", "circular-gauge", "Package Die Temp", 8, 4, 2, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"value\":46.2,\"subtitle\":\"Tctl / Tdie\"}"),
                ("w_cpu_d_cs", "circular-gauge", "Context Switches", 10, 4, 2, 3, "{\"query\":\"context_switches\",\"unit\":\"k/s\",\"value\":18.2,\"subtitle\":\"Scheduler IRQ\"}"),
                ("w_cpu_chart_full", "time-series", "Processor Frequency Scaling & Thread Load History", 0, 7, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"%\"}"),
                ("w_cpu_ports_proc", "ports-table", "Compute Intensive Processes & Socket Affinity", 0, 11, 6, 3, "{}"),
                ("w_cpu_logs_full", "log-stream", "Kernel Scheduler & CPU Throttling Logs", 6, 11, 6, 3, "{}"),
                ("w_cpu_alerts_full", "recent-alerts", "CPU Overload & Stuck Thread Watchdogs", 0, 14, 12, 3, "{}"),
            ],
            "dash_network" => vec![
                ("w_net_main", "network-traffic", "Network Throughput & Bandwidth Hub", 0, 0, 6, 4, "{\"rxSpeedMb\":12.8,\"txSpeedMb\":5.4,\"interfaceName\":\"eth0\"}"),
                ("w_net_ports", "ports-table", "Listening Sockets & Port Bindings", 6, 0, 6, 4, "{}"),
                ("w_net_dial_rx", "circular-gauge", "Download Ingress Speed", 0, 4, 2, 3, "{\"query\":\"rx_bandwidth\",\"unit\":\"MB/s\",\"value\":12.8,\"subtitle\":\"Gigabit Link\"}"),
                ("w_net_dial_tx", "circular-gauge", "Upload Egress Speed", 2, 4, 2, 3, "{\"query\":\"tx_bandwidth\",\"unit\":\"MB/s\",\"value\":5.4,\"subtitle\":\"Gigabit Link\"}"),
                ("w_net_dial_pps", "circular-gauge", "Network Packet Rate", 4, 4, 2, 3, "{\"query\":\"packet_rate\",\"unit\":\"k pps\",\"value\":8.4,\"subtitle\":\"NIC Rx/Tx Loops\"}"),
                ("w_net_dial_tcp", "circular-gauge", "Active TCP Sockets", 6, 4, 2, 3, "{\"query\":\"tcp_conns\",\"unit\":\"\",\"value\":38,\"subtitle\":\"Established\"}"),
                ("w_net_dial_drop", "circular-gauge", "Packet Drop Rate", 8, 4, 2, 3, "{\"query\":\"drop_rate\",\"unit\":\"%\",\"value\":0.01,\"subtitle\":\"NIC Errors\"}"),
                ("w_net_dial_lat", "circular-gauge", "DNS / RTT Latency", 10, 4, 2, 3, "{\"query\":\"dns_latency\",\"unit\":\"ms\",\"value\":4.2,\"subtitle\":\"Local Gateway\"}"),
                ("w_net_chart", "time-series", "Network Interface Traffic Sparkline History", 0, 7, 12, 4, "{\"query\":\"network_rx_speed\",\"unit\":\"MB/s\"}"),
                ("w_net_fleet", "fleet-status", "Node Connectivity & Ping Matrix", 0, 11, 6, 4, "{}"),
                ("w_net_specs", "sysinfo", "Network Controller & Adapter Specs", 6, 11, 6, 4, "{}"),
                ("w_net_cores", "cpu-breakdown", "NIC IRQ & Packet Processing Load", 0, 15, 6, 3, "{}"),
                ("w_net_shares", "storage-gauge", "Network Shares (NFS, SMB & iSCSI Pools)", 6, 15, 6, 3, "{}"),
                ("w_net_logs", "log-stream", "Packet & Socket Event Journal", 0, 18, 6, 3, "{}"),
                ("w_net_alerts", "recent-alerts", "Network Security & Drop Alerts", 6, 18, 6, 3, "{}"),
            ],
            "dash_storage" => vec![
                ("w_storage_main", "storage-gauge", "Filesystem Mounts & Storage Capacity", 0, 0, 8, 4, "{}"),
                ("w_storage_ports", "ports-table", "Storage Protocols & Share Bindings", 8, 0, 4, 4, "{}"),
                ("w_str_root", "circular-gauge", "Root Filesystem NVMe", 0, 4, 2, 3, "{\"query\":\"disk_percent\",\"unit\":\"%\",\"value\":38.6,\"subtitle\":\"/dev/nvme0n1p2\"}"),
                ("w_str_tank", "circular-gauge", "ZFS Tank Pool Usage", 2, 4, 2, 3, "{\"query\":\"disk_percent\",\"unit\":\"%\",\"value\":52.4,\"subtitle\":\"RAIDZ2 Pool\"}"),
                ("w_str_nvme_wear", "circular-gauge", "NVMe Flash Wear Life", 4, 4, 2, 3, "{\"query\":\"wear_life\",\"unit\":\"%\",\"value\":98.0,\"subtitle\":\"S.M.A.R.T. Endurance\"}"),
                ("w_str_read", "circular-gauge", "Read Speed Rate", 6, 4, 2, 3, "{\"query\":\"read_speed\",\"unit\":\"MB/s\",\"value\":124.8,\"subtitle\":\"Continuous Read\"}"),
                ("w_str_write", "circular-gauge", "Write Speed Rate", 8, 4, 2, 3, "{\"query\":\"write_speed\",\"unit\":\"MB/s\",\"value\":48.6,\"subtitle\":\"Continuous Write\"}"),
                ("w_str_iops", "circular-gauge", "Disk I/O Queue Ops", 10, 4, 2, 3, "{\"query\":\"iops\",\"unit\":\"k\",\"value\":12.4,\"subtitle\":\"Array Queue Depth\"}"),
                ("w_str_chart", "time-series", "Block I/O & Filesystem Read/Write Bandwidth", 0, 7, 12, 4, "{\"query\":\"disk_io\",\"unit\":\"MB/s\"}"),
                ("w_str_specs", "sysinfo", "Storage Controller, NVMe & SMART Health", 0, 11, 6, 3, "{}"),
                ("w_str_logs", "log-stream", "Storage Subsystem & Filesystem Journal", 6, 11, 6, 3, "{}"),
                ("w_str_alerts", "recent-alerts", "Storage Degradation & Low Space Watchdogs", 0, 14, 12, 3, "{}"),
            ],
            "dash_security" => vec![
                ("w_sec_ports", "ports-table", "Open Listening Sockets & Exposure Audit (0.0.0.0 vs Loopback)", 0, 0, 7, 4, "{}"),
                ("w_sec_nodes", "fleet-status", "Fleet Security & Node Quorum Ping Matrix", 7, 0, 5, 4, "{}"),
                ("w_sec_dial_open", "circular-gauge", "Public Exposed Ports", 0, 4, 2, 3, "{\"query\":\"exposed_ports\",\"unit\":\" ports\",\"value\":4,\"subtitle\":\"SSH, TLS, VPN\"}"),
                ("w_sec_dial_auth", "circular-gauge", "Failed Auth (24h)", 2, 4, 2, 3, "{\"query\":\"auth_fails\",\"unit\":\"\",\"value\":2,\"subtitle\":\"Fail2ban Blocked\"}"),
                ("w_sec_dial_health", "circular-gauge", "Security Score", 4, 4, 2, 3, "{\"query\":\"security_score\",\"unit\":\"%\",\"value\":98.4,\"subtitle\":\"CIS Benchmark\"}"),
                ("w_sec_dial_tls", "circular-gauge", "TLS Cert Validity", 6, 4, 2, 3, "{\"query\":\"cert_days\",\"unit\":\"d\",\"value\":74,\"subtitle\":\"Auto-Renew Active\"}"),
                ("w_sec_dial_fw", "circular-gauge", "Firewall Drop Rate", 8, 4, 2, 3, "{\"query\":\"fw_drops\",\"unit\":\"p/s\",\"value\":12.8,\"subtitle\":\"nftables Blocks\"}"),
                ("w_sec_dial_ssh", "circular-gauge", "Active SSH Root", 10, 4, 2, 3, "{\"query\":\"ssh_sessions\",\"unit\":\"\",\"value\":1,\"subtitle\":\"Active Sessions\"}"),
                ("w_sec_chart", "time-series", "Security Events, Drop Rates & Port Probes History", 0, 7, 12, 4, "{\"query\":\"security_drops\",\"unit\":\"drops/s\"}"),
                ("w_sec_logs", "log-stream", "Authentication, SSH & Sudo Audit Journal", 0, 11, 6, 3, "{}"),
                ("w_sec_alerts", "recent-alerts", "Dead-Man Watchdogs & Security Incident Alerts", 6, 11, 6, 3, "{}"),
            ],
            _ => vec![],
        };

        for (wid, wtype, wtitle, x, y, w, h, cfg) in widgets {
            conn.execute(
                "INSERT OR REPLACE INTO dashboard_widgets (id, dashboard_id, widget_type, title, grid_x, grid_y, grid_w, grid_h, config, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                rusqlite::params![wid, d_id, wtype, wtitle, x, y, w, h, cfg, now],
            )?;
        }
    }
    info!("Verified and seeded specialized dashboard suite.");

    // 4. Seed system settings defaults if empty
    let settings_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM system_settings", [], |row| row.get(0))
        .unwrap_or(0);
    if settings_count == 0 {
        let defaults = vec![
            ("is_setup_completed", "false"),
            ("instance_name", "Racklyt Operations Hub"),
            ("fleet_domain", "homelab.lan"),
            ("retention_days", "30"),
            ("scrape_interval_secs", "10"),
            ("alert_cpu_threshold", "85"),
            ("alert_temp_threshold", "75"),
            ("alert_disk_threshold", "90"),
            ("alert_heartbeat_timeout", "30"),
            ("discord_webhook", ""),
            ("telegram_token", ""),
            ("telegram_chat_id", ""),
            ("rate_limit_per_min", "60"),
            ("session_timeout_mins", "60"),
            ("allow_public_dashboards", "false"),
            ("enforce_2fa", "false"),
        ];
        for (k, v) in defaults {
            conn.execute(
                "INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
                rusqlite::params![k, v, now],
            )?;
        }
        info!("Seeded default system settings (setup_completed: false).");
    }

    // 5. Seed default alert rules if empty
    let rules_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM alert_rules", [], |row| row.get(0))
        .unwrap_or(0);
    if rules_count == 0 {
        let default_rules = vec![
            (
                "rule_cpu_high",
                "High CPU Utilization",
                "cpu",
                ">",
                90.0,
                180,
                "warning",
                None::<String>,
                "all",
            ),
            (
                "rule_mem_high",
                "Memory Exhaustion Watchdog",
                "memory",
                ">",
                92.0,
                180,
                "critical",
                None::<String>,
                "all",
            ),
            (
                "rule_temp_high",
                "SoC / Package Thermal Limit",
                "temp",
                ">",
                75.0,
                120,
                "critical",
                None::<String>,
                "all",
            ),
            (
                "rule_disk_high",
                "Storage Pool Capacity Warning",
                "disk",
                ">",
                88.0,
                300,
                "warning",
                None::<String>,
                "all",
            ),
        ];
        for (id, name, metric, op, thresh, dur, sev, node_opt, chan) in default_rules {
            conn.execute(
                "INSERT OR IGNORE INTO alert_rules (id, name, metric, operator, threshold, duration_seconds, severity, target_node_id, channel, is_enabled, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10)",
                rusqlite::params![id, name, metric, op, thresh, dur, sev, node_opt, chan, now],
            )?;
        }
        info!("Seeded default alert rules.");
    }

    Ok(())
}
