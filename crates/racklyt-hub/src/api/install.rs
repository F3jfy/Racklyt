use axum::{
    body::Body,
    http::{header, HeaderMap, Response, StatusCode},
    response::IntoResponse,
};
use std::path::PathBuf;

/// Serves dynamic bash install script for one-line deployment
pub async fn install_script_handler(headers: HeaderMap) -> impl IntoResponse {
    let raw_host = headers
        .get(header::HOST)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("localhost:8443");

    // SEC-04 Hardening: Validate host strictly against RFC 1123 / standard hostname + port
    // Reject shell metacharacters (; | & $ ` \ " ' newline space etc.)
    let is_valid_host = !raw_host.is_empty()
        && raw_host.len() <= 128
        && raw_host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == ':');

    let host = if is_valid_host {
        raw_host
    } else {
        "localhost:8443"
    };

    // Detect protocol - strictly allow only http or https
    let raw_proto = headers
        .get("x-forwarded-proto")
        .and_then(|p| p.to_str().ok())
        .unwrap_or("http");

    let proto = if raw_proto.eq_ignore_ascii_case("https") {
        "https"
    } else {
        "http"
    };

    let default_hub_url = format!("{}://{}", proto, host);

    let script = format!(
        r#"#!/usr/bin/env bash
# ==============================================================================
#  Racklyt Agent Automated Installer & Service Configurator
#  High-Performance Telemetry Daemon for Linux, Raspberry Pi & Proxmox VE
# ==============================================================================
set -e

COLOR_RESET="\033[0m"
COLOR_BOLD="\033[1m"
COLOR_ORANGE="\033[38;5;208m"
COLOR_GREEN="\033[32m"
COLOR_RED="\033[31m"
COLOR_CYAN="\033[36m"
COLOR_DIM="\033[2m"

echo -e "${{COLOR_ORANGE}}${{COLOR_BOLD}}"
cat << 'EOF'
  ____            _    _       _   
 |  _ \ __ _  ___| | _| |_   _| |_ 
 | |_) / _` |/ __| |/ / | | | | __|
 |  _ < (_| | (__|   <| | |_| | |_ 
 |_| \_\__,_|\___|_|\_\_|\__, |\__|
                         |___/     
   Telemetry Agent Installer
EOF
echo -e "${{COLOR_RESET}}"

HUB_URL="{default_hub_url}"
TOKEN=""
NODE_ID="$(hostname 2>/dev/null || cat /etc/hostname 2>/dev/null || echo "node-$(date +%s)")"
INTERVAL="5"
UNINSTALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hub|--hub-url|-h)
      HUB_URL="$2"
      shift 2
      ;;
    --token|-t)
      TOKEN="$2"
      shift 2
      ;;
    --node-id|-n)
      NODE_ID="$2"
      shift 2
      ;;
    --interval|-i)
      INTERVAL="$2"
      shift 2
      ;;
    --uninstall)
      UNINSTALL=true
      shift
      ;;
    *)
      echo -e "${{COLOR_RED}}Unknown argument: $1${{COLOR_RESET}}"
      echo "Usage: curl -sSL <hub>/install.sh | sudo bash -s -- --hub <url> --token <token> [--node-id <id>] [--interval <sec>]"
      exit 1
      ;;
  esac
done

if [ "$UNINSTALL" = true ]; then
  echo -e "${{COLOR_ORANGE}}Uninstalling Racklyt Agent...${{COLOR_RESET}}"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl stop racklyt-agent 2>/dev/null || true
    systemctl disable racklyt-agent 2>/dev/null || true
    rm -f /etc/systemd/system/racklyt-agent.service
    systemctl daemon-reload 2>/dev/null || true
  fi
  rm -f /usr/local/bin/racklyt-agent
  rm -rf /etc/racklyt
  echo -e "${{COLOR_GREEN}}Racklyt Agent successfully uninstalled.${{COLOR_RESET}}"
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo -e "${{COLOR_RED}}Error: This installer must be executed as root (e.g. using sudo bash).${{COLOR_RESET}}"
  exit 1
fi

if [ -z "$TOKEN" ]; then
  TOKEN="agent_default_token"
fi

echo -e "${{COLOR_CYAN}}==>${{COLOR_RESET}} Hub Target:     ${{COLOR_BOLD}}${{HUB_URL}}${{COLOR_RESET}}"
echo -e "${{COLOR_CYAN}}==>${{COLOR_RESET}} Enrolled Node:   ${{COLOR_BOLD}}${{NODE_ID}}${{COLOR_RESET}}"
echo -e "${{COLOR_CYAN}}==>${{COLOR_RESET}} Push Interval:   ${{COLOR_BOLD}}${{INTERVAL}}s${{COLOR_RESET}}"
echo ""

ARCH="$(uname -m)"
echo -e "${{COLOR_CYAN}}==>${{COLOR_RESET}} Detected Machine Architecture: ${{COLOR_BOLD}}${{ARCH}}${{COLOR_RESET}}"

# Check curl / wget
DOWNLOADER=""
if command -v curl >/dev/null 2>&1; then
  DOWNLOADER="curl -sSL"
elif command -v wget >/dev/null 2>&1; then
  DOWNLOADER="wget -qO-"
else
  echo -e "${{COLOR_RED}}Error: curl or wget is required to proceed.${{COLOR_RESET}}"
  exit 1
fi

INSTALL_BIN="/usr/local/bin/racklyt-agent"
mkdir -p /usr/local/bin
mkdir -p /etc/racklyt

echo -e "${{COLOR_CYAN}}==>${{COLOR_RESET}} Fetching agent binary from Hub..."
HTTP_CODE=""
if command -v curl >/dev/null 2>&1; then
  HTTP_CODE=$(curl -sSL -w "%{{http_code}}" -o "$INSTALL_BIN" "${{HUB_URL}}/download/racklyt-agent")
else
  wget -q -O "$INSTALL_BIN" "${{HUB_URL}}/download/racklyt-agent"
  HTTP_CODE="200"
fi

chmod +x "$INSTALL_BIN" 2>/dev/null || true

BINARY_WORKS=false
if [ -f "$INSTALL_BIN" ] && "$INSTALL_BIN" --version >/dev/null 2>&1; then
  BINARY_WORKS=true
fi

if [ "$BINARY_WORKS" = false ]; then
  echo -e "${{COLOR_ORANGE}}Native Rust binary not compatible with this CPU or libc (${{ARCH}}).${{COLOR_RESET}}"
  echo -e "${{COLOR_CYAN}}==>${{COLOR_RESET}} Falling back to universal zero-dependency Python 3 collector..."
  if command -v python3 >/dev/null 2>&1; then
    curl -sSL -o "$INSTALL_BIN" "${{HUB_URL}}/download/racklyt-agent.py" || wget -q -O "$INSTALL_BIN" "${{HUB_URL}}/download/racklyt-agent.py"
    chmod +x "$INSTALL_BIN"
    # rewrite shebang
    sed -i '1s|^.*$|#!/usr/bin/env python3|' "$INSTALL_BIN"
    echo -e "${{COLOR_GREEN}}Universal Python 3 collector installed successfully.${{COLOR_RESET}}"
  else
    echo -e "${{COLOR_RED}}Failed to run binary and python3 was not found. Please install python3 or build racklyt-agent for ${{ARCH}}.${{COLOR_RESET}}"
    exit 1
  fi
else
  echo -e "${{COLOR_GREEN}}Native binary verified and installed to ${{INSTALL_BIN}}.${{COLOR_RESET}}"
fi

# Write environment configuration
cat << ENV_EOF > /etc/racklyt/agent.env
RACKLYT_HUB_URL="${{HUB_URL}}"
RACKLYT_AUTH_TOKEN="${{TOKEN}}"
RACKLYT_NODE_ID="${{NODE_ID}}"
RACKLYT_INTERVAL_SECS="${{INTERVAL}}"
ENV_EOF
chmod 600 /etc/racklyt/agent.env

# Configure Systemd Service
if command -v systemctl >/dev/null 2>&1; then
  echo -e "${{COLOR_CYAN}}==>${{COLOR_RESET}} Registering systemd background daemon (/etc/systemd/system/racklyt-agent.service)..."
  cat << SERVICE_EOF > /etc/systemd/system/racklyt-agent.service
[Unit]
Description=Racklyt Telemetry Agent
Documentation=https://github.com/racklyt/racklyt
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/racklyt/agent.env
ExecStart=${{INSTALL_BIN}}
Restart=always
RestartSec=5s
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
SERVICE_EOF

  systemctl daemon-reload
  systemctl enable --now racklyt-agent
  echo -e "${{COLOR_GREEN}}Service racklyt-agent is active and enabled on boot.${{COLOR_RESET}}"
else
  echo -e "${{COLOR_ORANGE}}Systemd not detected. Starting agent in background...${{COLOR_RESET}}"
  nohup "${{INSTALL_BIN}}" > /var/log/racklyt-agent.log 2>&1 &
fi

echo ""
echo -e "${{COLOR_GREEN}}${{COLOR_BOLD}}Racklyt Agent Successfully Deployed!${{COLOR_RESET}}"
echo -e "${{COLOR_DIM}}Telemetry is actively transmitting to ${{HUB_URL}}/api/v1/ingest/metrics${{COLOR_RESET}}"
echo -e "${{COLOR_DIM}}To check status: systemctl status racklyt-agent${{COLOR_RESET}}"
echo -e "${{COLOR_DIM}}To follow logs:   journalctl -u racklyt-agent -f${{COLOR_RESET}}"
echo ""
"#,
        default_hub_url = default_hub_url
    );

    Response::builder()
        .header(header::CONTENT_TYPE, "text/x-shellscript; charset=utf-8")
        .header(header::CACHE_CONTROL, "no-cache")
        .body(script)
        .unwrap()
}

/// Serves native compiled racklyt-agent binary for target machine downloads
pub async fn download_agent_binary_handler() -> Result<impl IntoResponse, (StatusCode, &'static str)>
{
    // Search candidates: release build, debug build, or usr local bin
    let candidates = [
        "target/release/racklyt-agent",
        "target/debug/racklyt-agent",
        "/usr/local/bin/racklyt-agent",
    ];

    let mut found_path: Option<PathBuf> = None;
    for cand in &candidates {
        let p = PathBuf::from(cand);
        if p.exists() {
            found_path = Some(p);
            break;
        }
    }

    let binary_path = found_path.ok_or((StatusCode::NOT_FOUND, "Agent binary not found on Hub"))?;

    let bytes = tokio::fs::read(&binary_path)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read binary"))?;

    let len = bytes.len();

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CONTENT_LENGTH, len)
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"racklyt-agent\"",
        )
        .body(Body::from(bytes))
        .unwrap())
}

/// Serves standalone Python 3 agent as universal fallback
pub async fn download_agent_python_handler() -> impl IntoResponse {
    let py_code = r#"#!/usr/bin/env python3
import os
import sys
import time
import json
import urllib.request
import urllib.error

HUB_URL = os.environ.get("RACKLYT_HUB_URL", "http://127.0.0.1:8443").rstrip("/")
NODE_ID = os.environ.get("RACKLYT_NODE_ID", "")
TOKEN = os.environ.get("RACKLYT_AUTH_TOKEN", "agent_default_token")
INTERVAL = int(os.environ.get("RACKLYT_INTERVAL_SECS", "5"))

if not NODE_ID:
    try:
        with open("/etc/hostname", "r") as f:
            NODE_ID = f.read().strip()
    except Exception:
        import socket
        NODE_ID = socket.gethostname() or "node-machine"

def read_uptime():
    try:
        with open("/proc/uptime", "r") as f:
            return int(float(f.readline().split()[0]))
    except Exception:
        return 3600

def read_loadavg():
    try:
        with open("/proc/loadavg", "r") as f:
            parts = f.readline().split()
            return [float(parts[0]), float(parts[1]), float(parts[2])]
    except Exception:
        return [0.2, 0.2, 0.2]

def read_meminfo():
    total, free, avail, swap_total, swap_free = 4*1024**3, 2*1024**3, 2*1024**3, 2*1024**3, 2*1024**3
    try:
        with open("/proc/meminfo", "r") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 2:
                    kb = int(parts[1]) * 1024
                    if parts[0] == "MemTotal:": total = kb
                    elif parts[0] == "MemFree:": free = kb
                    elif parts[0] == "MemAvailable:": avail = kb
                    elif parts[0] == "SwapTotal:": swap_total = kb
                    elif parts[0] == "SwapFree:": swap_free = kb
    except Exception:
        pass
    used = max(0, total - avail)
    swap_used = max(0, swap_total - swap_free)
    return total, used, free, swap_total, swap_used

def read_temp():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            return round(float(f.read().strip()) / 1000.0, 1)
    except Exception:
        return 42.0

def read_net():
    metrics = []
    try:
        with open("/proc/net/dev", "r") as f:
            lines = f.readlines()[2:]
            for line in lines:
                if ":" in line:
                    iface, data = line.split(":", 1)
                    iface = iface.strip()
                    if iface == "lo": continue
                    cols = data.split()
                    if len(cols) >= 16:
                        metrics.append({
                            "interface": iface,
                            "rx_bytes": int(cols[0]),
                            "tx_bytes": int(cols[8]),
                            "rx_errors": int(cols[2]),
                            "tx_errors": int(cols[10])
                        })
    except Exception:
        pass
    return metrics

def read_disks():
    disks = []
    try:
        st = os.statvfs("/")
        total = st.f_blocks * st.f_frsize
        avail = st.f_bavail * st.f_frsize
        used = total - avail
        disks.append({
            "mount_point": "/",
            "filesystem": "root",
            "total_bytes": total,
            "used_bytes": used
        })
    except Exception:
        pass
    return disks

class CpuTracker:
    def __init__(self):
        self.last_total, self.last_idle = self.read_raw()
    def read_raw(self):
        try:
            with open("/proc/stat", "r") as f:
                for line in f:
                    if line.startswith("cpu "):
                        p = [int(x) for x in line.split()[1:8]]
                        idle = p[3] + (p[4] if len(p) > 4 else 0)
                        return sum(p), idle
        except Exception:
            pass
        return 100, 50
    def get_percent(self):
        curr_total, curr_idle = self.read_raw()
        diff_tot = curr_total - self.last_total
        diff_idle = curr_idle - self.last_idle
        self.last_total, self.last_idle = curr_total, curr_idle
        if diff_tot > 0:
            return max(0.0, min(100.0, ((diff_tot - diff_idle) / diff_tot) * 100.0))
        return 5.0

print(f"[INFO] Racklyt Python Telemetry Agent starting for '{NODE_ID}' -> {HUB_URL} (Interval: {INTERVAL}s)")
cpu_tracker = CpuTracker()

while True:
    try:
        now = int(time.time())
        cpu_pct = round(cpu_tracker.get_percent(), 1)
        load = read_loadavg()
        mem_tot, mem_used, mem_free, swap_tot, swap_used = read_meminfo()
        payload = {
            "node_id": NODE_ID,
            "timestamp": now,
            "cpu": {
                "usage_percent": cpu_pct,
                "per_core_percent": [cpu_pct],
                "load_avg": load
            },
            "memory": {
                "total_bytes": mem_tot,
                "used_bytes": mem_used,
                "free_bytes": mem_free,
                "swap_total_bytes": swap_tot,
                "swap_used_bytes": swap_used
            },
            "disks": read_disks(),
            "network": read_net(),
            "temperature_celsius": read_temp(),
            "uptime_seconds": read_uptime()
        }
        
        req = urllib.request.Request(
            f"{HUB_URL}/api/v1/ingest/metrics",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {TOKEN}"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                print(f"[INFO] Pushed metrics [{NODE_ID}]: CPU {cpu_pct}%, Mem {mem_used//1048576}/{mem_tot//1048576}MB, Load {load[0]}")
    except Exception as e:
        print(f"[WARN] Ingest push failed: {e}", file=sys.stderr)
    time.sleep(INTERVAL)
"#;

    Response::builder()
        .header(header::CONTENT_TYPE, "text/x-python; charset=utf-8")
        .header(header::CACHE_CONTROL, "no-cache")
        .body(Body::from(py_code))
        .unwrap()
}
