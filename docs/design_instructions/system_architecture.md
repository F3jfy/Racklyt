# Racklyt Design Instructions: System Architecture

## 1. System Topology

Racklyt operates on a **Hub-and-Spoke hybrid monitoring topology**:
- **Racklyt Hub:** The central control plane, database, web server, and API gateway running on a single server or Raspberry Pi.
- **Racklyt Agent (`racklyt-agent`):** A lightweight binary running on every monitored Linux server and Raspberry Pi.
- **Proxmox VE Integrator:** An agentless poller module running inside the Hub that queries Proxmox VE API endpoints directly using dedicated API tokens.

```
                          +------------------------+
                          |      Admin Client      |
                          | (Browser / Dashboard)  |
                          +-----------+------------+
                                      |
                           HTTPS / WSS (Auth & RBAC)
                                      |
                                      v
+-------------------------------------+-------------------------------------+
|                             RACKLYT HUB                                   |
|                                                                           |
|   +-------------------+  +---------------------+  +--------------------+  |
|   |  HTTP Ingestion   |  |   Proxmox Poller    |  |  Retention Pruner  |  |
|   |  (Agents Push)    |  |  (REST API Client)  |  |  & Aggregator   |  |
|   +---------+---------+  +----------+----------+  +---------+----------+  |
|             |                       |                       |             |
|             +-----------------+     |     +-----------------+             |
|                               |     |     |                               |
|                               v     v     v                               |
|                    +------------------------------+                       |
|                    | Embedded SQLite (WAL Engine) |                       |
|                    +------------------------------+                       |
+-------------------------------------+-------------------------------------+
                 ^                                   |
                 | Push (TLS + Auth Token)           | Pull (Proxmox API Token)
                 |                                   v
   +-------------+-------------+             +------------------+
   |                           |             |  Proxmox VE Host |
   v                           v             |   (API2 Engine)  |
+-------------------+ +-------------------+  +---------+--------+
|   Remote Server   | |   Raspberry Pi    |            |
|  (racklyt-agent)  | |  (racklyt-agent)  |     +------+------+
+-------------------+ +-------------------+     |             |
                                                v             v
                                             [VMs]         [LXCs]
```

---

## 2. Component Roles & Communication

### 2.1 Monitored Linux Hosts & Raspberry Pis (Agent-Based)
- **Role:** Every monitored bare-metal server, cloud VPS, or Raspberry Pi runs `racklyt-agent`.
- **Direction:** **Push-based model** (outbound from agent to Hub).
  - Agents initiate outbound TLS connections to the Hub API at `/api/v1/ingest/metrics`.
  - Prevents needing to open inbound firewall ports or expose SSH keys on target machines.
  - Allows monitoring nodes behind NAT, WireGuard VPNs, Tailscale, or private subnets.
- **Push Interval:** Default every **10 seconds** (user-configurable between 3s and 60s per agent).
- **Payload:** High-density, compact JSON or binary payload containing:
  - System CPU usage (total and per-core), load averages (1, 5, 15 min).
  - Memory & Swap usage (total, used, free, cached).
  - Disk storage utilization & I/O statistics per mount point.
  - Network interface throughput (bytes/packets in and out, errors, drops).
  - System temperatures (SoC temperature for Raspberry Pis, CPU package temps for servers).
  - Uptime, kernel version, hostname, and active systemd failed services count.

### 2.2 Proxmox Virtual Environment (Agentless API)
- **Role:** The Racklyt Hub directly interrogates Proxmox VE hypervisors without requiring agents inside the hypervisor host or each guest.
- **Direction:** **Pull-based model** (Hub polls Proxmox API).
- **Authentication:** Proxmox API Token (`USER@REALM!TOKENID=UUID`).
- **Poll Interval:** Default every **15 seconds** (configurable).
- **Collected Telemetry:**
  - **Cluster Level:** Cluster name, quorum state, online/offline member nodes.
  - **Node Level:** CPU, memory, uptime, kernel version, PVE version, disk usage on local storage.
  - **Storage Pools:** Pool name, type (ZFS, LVM, Directory, NFS), total capacity, used space.
  - **Virtual Machines (QEMU):** VMID, name, status (running, stopped), CPU usage, allocated memory, disk write/read, network I/O.
  - **Containers (LXC):** VMID, name, status, CPU, memory, swap, disk utilization.

---

## 3. Resilience, Offline Detection & Dead-Man's Switch

### 3.1 Agent Offline State Detection
- The Hub maintains an active **Heartbeat Registry** in memory.
- When an agent misses its scheduled check-in window:
  - **Grace Period:** $1.5 \times \text{Push Interval}$ (e.g., 15s for a 10s interval) $\rightarrow$ Marked as **Degraded / Latent**.
  - **Offline Threshold:** $3 \times \text{Push Interval}$ (e.g., 30s) $\rightarrow$ Node status transitions to **Offline / Down**.
  - **Alert Dispatch:** An offline alert event is logged and queued for notification dispatchers.

### 3.2 Network Partition Handling on Agents
- If the Hub is unreachable (network drop, reboot, power outage):
  - The agent buffers the last $N$ metric snapshots (e.g., up to 30 snapshots / ~5 minutes) in a small in-memory ring-buffer.
  - Uses exponential backoff with jitter (initial retry 2s, maximum cap 30s).
  - Once connectivity is restored, the buffered snapshots are delivered in an aggregated batch to preserve historical continuity without flooding the Hub.

---

## 4. Hardware & Performance Budgets

To guarantee smooth operation on low-power single-board computers (such as a Raspberry Pi 4 Model B with 2GB/4GB RAM or Raspberry Pi Zero 2W for agents):

| Component | Target Memory (Idle) | Target Memory (Load) | Target CPU Footprint |
| :--- | :--- | :--- | :--- |
| **`racklyt-agent`** | **< 8 MB** | **< 15 MB** | < 0.5% of 1 core |
| **`racklyt-hub` (API + DB)** | **< 25 MB** | **< 60 MB** | < 2% on RPi 4 (4 cores) |
| **Web Dashboard (Browser)** | Client-side memory | Client-side memory | Minimal DOM re-renders |

### Raspberry Pi Storage Wear Mitigations
- SQLite Write-Ahead Logging (WAL) enabled with `PRAGMA synchronous = NORMAL`.
- Periodic batch inserts (Hub batches received metrics in memory for 1–2 seconds before flushing to disk).
- Temporary files and query workspaces stored in RAM (`PRAGMA temp_store = MEMORY`).
