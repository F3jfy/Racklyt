# Racklyt Backend Instructions: Agent Architecture & Telemetry Engine

## 1. Objectives & Performance Goals
The **`racklyt-agent`** is a standalone, single-binary daemon installed on target Linux servers, VMs, and Raspberry Pis. Its goals are:
- **Featherweight Resource Footprint:** Idle memory consumption strictly **< 8 MB**, peak under **15 MB**. Target CPU load < 0.2% on a Raspberry Pi 4.
- **Minimal External Dependencies:** Pure Rust, optionally statically linked against `musl` (`x86_64` and `aarch64`).
- **Resilient Delivery:** Survives temporary Hub restarts and network outages via local in-memory buffering.

---

## 2. Telemetry Collection Engine

To ensure ultra-low memory usage, the agent reads directly from Linux virtual filesystems (`/proc` and `/sys`) whenever possible, avoiding heavy shell calls or broad multi-megabyte C libraries.

### 2.1 Metric Collection Sources

| Metric Category | Source on Linux | Specific Files / Logic |
| :--- | :--- | :--- |
| **CPU Utilization** | `/proc/stat` | Delta calculation between snapshots ($t_1$ vs $t_0$) across `user`, `nice`, `system`, `idle`, `iowait`. |
| **Load Averages** | `/proc/loadavg` | Direct parse of 1m, 5m, 15m floats. |
| **Memory & Swap** | `/proc/meminfo` | `MemTotal`, `MemAvailable`, `MemFree`, `Buffers`, `Cached`, `SwapTotal`, `SwapFree`. |
| **Disk Partitions** | `/proc/mounts` & `statvfs` | Filter real filesystems (`ext4`, `btrfs`, `zfs`, `xfs`), query block size & free blocks. |
| **Disk I/O** | `/proc/diskstats` | Sectors read/written, I/O milliseconds in progress. |
| **Network Interfaces** | `/proc/net/dev` | Byte counters, packet counts, errors, drop rates on physical & virtual NICs. |
| **RPi SoC Temperature**| `/sys/class/thermal/` | `thermal_zone0/temp` (divided by 1000.0 for degrees Celsius). |
| **System Uptime** | `/proc/uptime` | System uptime in seconds. |

---

## 3. Architecture & Internal Pipeline

```
+-------------------------------------------------------------------------+
|                              RACKLYT AGENT                              |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Periodic Tick (tokio::time::interval / 10s)                       |  |
|  +---------------------------------+---------------------------------+  |
|                                    |                                    |
|                                    v                                    |
|  +-------------------------------------------------------------------+  |
|  | Sampler: Read /proc & /sys, build SystemMetricsPayload           |  |
|  +---------------------------------+---------------------------------+  |
|                                    |                                    |
|                                    v                                    |
|  +-------------------------------------------------------------------+  |
|  | In-Memory Ring Buffer (Capacity: 30 payloads ~ 5 min offline)    |  |
|  +---------------------------------+---------------------------------+  |
|                                    |                                    |
|                                    v                                    |
|  +-------------------------------------------------------------------+  |
|  | Outbound Dispatcher (HTTPS POST /api/v1/ingest/metrics)           |  |
|  | - Success: Drain pushed metrics from buffer                      |  |
|  | - Failure: Retain in buffer, initiate exponential backoff        |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 4. Configuration Specification (`/etc/racklyt/agent.toml`)

```toml
[agent]
# Unique node identifier assigned during enrollment
node_id = "018d9f1a-b320-7212-9842-1e92c2aa4811"
# Display name (defaults to system hostname if omitted)
name = "pi4-home-cluster"
# Collection and push interval in seconds (default: 10)
interval_seconds = 10
# Maximum snapshots buffered in memory during network drops
max_buffer_capacity = 30

[hub]
# HTTPS endpoint of the Racklyt Hub
url = "https://racklyt.internal.lan:8443"
# Authenticated Bearer token issued during enrollment
auth_token = "rk_node_9a87f1c65b8214d0..."
# Skip TLS verification (strongly discouraged; use tls_ca instead)
insecure_skip_verify = false
# Optional path to local self-signed CA certificate
# tls_ca = "/etc/racklyt/hub-ca.crt"

[collectors]
# Enable or disable specific metric groups
cpu = true
memory = true
disks = true
network = true
temperatures = true
```

---

## 5. CLI Interface & Life Cycle

The agent binary supports simple operational subcommands:

- **`racklyt-agent enroll --hub <URL> --key <ENROLLMENT_KEY>`**
  Contacts Hub, exchanges one-time key for persistent token, writes `/etc/racklyt/agent.toml`, and creates systemd service unit.
- **`racklyt-agent run`**
  Main service execution loop (run as background systemd service).
- **`racklyt-agent test`**
  Runs a single telemetry capture cycle and prints the JSON payload to stdout without sending it over the network (useful for diagnostics).
- **`racklyt-agent --version`**
  Prints release version, target architecture, and compile flags.
