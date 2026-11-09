<div align="center">

# ⚡ Racklyt

**Ultra-lightweight, security-focused server & infrastructure monitoring platform built in Rust.**

[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.80%2B-orange.svg)](https://www.rust-lang.org)
[![Axum](https://img.shields.io/badge/backend-Axum%200.7-black.svg)](https://github.com/tokio-rs/axum)
[![React](https://img.shields.io/badge/frontend-React%2018%20%2B%20Vite-61dafb.svg)](https://react.dev)
[![Security](https://img.shields.io/badge/security-Zero--Trust%20RBAC-success.svg)](SECURITY.md)
[![Privacy](https://img.shields.io/badge/telemetry-Zero%20External-emerald.svg)](PRIVACY.md)

<p align="center">
  <a href="#-key-features">Features</a> •
  <a href="#-system-architecture">Architecture</a> •
  <a href="#-quickstart">Quickstart</a> •
  <a href="#-proxmox-ve-integration">Proxmox VE</a> •
  <a href="#-security--privacy">Security & Privacy</a> •
  <a href="#-documentation">Documentation</a> •
  <a href="#-contributing">Contributing</a>
</p>

</div>

---

## 📖 Overview

**Racklyt** is an ultra-lightweight, self-hosted infrastructure observability platform built with memory safety and performance in mind. Designed to run comfortably on low-power devices like a single server or Raspberry Pi, Racklyt gives you instant, unified visibility across:

- 🐧 **Standalone Linux Servers & Cloud VPS** (via direct-syscall `/proc` and `/sys` Rust agents)
- 🍓 **Raspberry Pi Fleet & Edge Nodes** (minimal CPU/RAM footprint, SD card durability optimizations)
- 🖥️ **Proxmox Virtual Environment (PVE)** (native REST API integration for clusters, nodes, VMs, and LXC containers)
- 📊 **Customizable Flat Dark Gray Dashboards** (drag-and-drop widgets, zero blurry glassmorphism, high readability)

Unlike heavy monitoring stacks that consume gigabytes of memory just to idle, Racklyt's Hub idles at **< 35MB RAM**, and its Agent runs in **< 10MB RAM** with sub-1% CPU usage.

---

## ✨ Key Features

- **🚀 Ultra-Lightweight & High-Performance:** Written in pure async Rust (Tokio & Axum) with an embedded, tuned SQLite time-series engine with automated multi-tier downsampling.
- **🛡️ Zero-Trust Security Model:** Agents connect via cryptographic one-time enrollment handshakes and authenticate with 256-bit CSPRNG tokens. TLS 1.3 encryption is supported end-to-end.
- **🔒 Read-Only Proxmox Integration:** Integrates seamlessly with Proxmox VE clusters using least-privilege `PVEAuditor` API tokens and TLS SHA-256 certificate fingerprint pinning.
- **🎨 Modern, Utilitarian Design System:** A flat, non-glass dark gray interface (`#121316` base, `#1C1E24` surfaces) inspired by professional developer tools and terminal workflows.
- **💾 Raspberry Pi & SD Card Friendly:** SQLite WAL mode, batched memory write queues, and downsampling rollups prevent excessive write amplification on flash memory.
- **🔔 Multi-Channel Alerting Watchdog:** Built-in dead-man's switch heartbeat watchdog and threshold alerts dispatched via **Discord, Telegram, Gotify, NTFY, and SMTP email**.
- **🌐 Cloudflare Tunnel & Reverse Proxy Ready:** Out-of-the-box support for zero-port-forwarding Cloudflare Tunnels, Caddy, Nginx, or Traefik with WebSocket proxying.
- **📱 Zero External Telemetry:** 100% self-hosted and air-gap capable. No external tracking, no cloud dependencies, and no phone-home telemetry.

---

## 🏛️ System Architecture

Racklyt operates on an asynchronous Hub-and-Spoke model:

```
                      +------------------------------------------+
                      |         Web Browser / Mobile App         |
                      |   (Modern React SPA / WebSocket Feed)    |
                      +------------------------------------------+
                                           ▲
                                           │ HTTPS / WSS
                                           ▼
+------------------------------------------------------------------------------------+
|                                    RACKLYT HUB                                     |
|                                                                                    |
|  +--------------------+  +----------------------+  +----------------------------+  |
|  | Editable Dashboard |  | Node & Cluster Views |  |  Multi-Account Admin Center|  |
|  | (Live SVG Widgets) |  | (Metrics, VMs, LXCs) |  |  (Argon2id, RBAC, 2FA/TOTP)|  |
|  +--------------------+  +----------------------+  +----------------------------+  |
|  --------------------------------------------------------------------------------  |
|  |                              Axum API & WebSockets                           |  |
|  +------------------------------------------------------------------------------+  |
|         ▲                                                ▲                         |
|         │ Ingest (Bearer Token)                          │ HTTPS Polling (TLS Pin) |
|         ▼                                                ▼                         |
|  +--------------------+                           +-----------------------------+  |
|  | SQLite Time-Series |                           |    Proxmox VE API Client    |  |
|  | Store & Rollups    |                           |  (Read-Only PVEAuditor Role)|  |
|  +--------------------+                           +-----------------------------+  |
+------------------------------------------------------------------------------------+
       ▲                                                           │
       │ Encrypted Push                                            ▼
+-------------------------+                           +--------------------------+
|      RACKLYT AGENT      |                           |    PROXMOX VE CLUSTER    |
|                         |                           |                          |
| Reads: /proc & /sys     |                           |  Datacenter Topology     |
| Direct statvfs syscalls |                           |  Cluster Nodes (PVE)     |
| In-memory ring buffer   |                           |  VMs (QEMU) & Containers |
+-------------------------+                           +--------------------------+
```

---

## 🚀 Quickstart

### Option 1: Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/racklyt/racklyt.git
   cd racklyt
   ```

2. Launch the Hub:
   ```bash
   docker compose up -d
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8443
   ```
   Follow the on-screen **First-Run Setup Wizard** to create the initial administrator account.

---

### Option 2: Building from Source

#### Prerequisites
- Rust 1.80+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Node.js 18+ and npm

#### Step 1: Build Frontend Assets
```bash
cd web
npm install
npm run build
cd ..
```

#### Step 2: Compile & Launch Hub
```bash
cargo run --release -p racklyt-hub
```
The Hub will serve the web interface and API on `0.0.0.0:8443`.

---

## 🖥️ Deploying Agents

Deploy the lightweight `racklyt-agent` onto any Linux server or Raspberry Pi you want to monitor:

### Single-Command Docker Deployment:
```bash
docker run -d \
  --name racklyt-agent \
  --restart unless-stopped \
  --network host \
  --pid host \
  -v /proc:/proc:ro \
  -v /sys:/sys:ro \
  -v /:/host/root:ro \
  -e RACKLYT_HUB_URL="https://your-hub-address:8443" \
  -e RACKLYT_AUTH_TOKEN="your-enrolled-agent-token" \
  -e RACKLYT_NODE_ID="my-server-prod" \
  -e RACKLYT_INTERVAL_SECS="5" \
  ghcr.io/racklyt/racklyt-agent:latest
```

*(Or compile and run natively with `cargo build --release -p racklyt-agent` and install as a systemd service).*

---

## 🛡️ Proxmox VE Integration

Racklyt integrates directly with your Proxmox VE hypervisors without modifying your hypervisor hosts:

1. **Create a Dedicated Read-Only User in Proxmox:**
   - In PVE Web UI: **Datacenter -> Permissions -> Users -> Add User** (e.g. `racklyt-monitor@pve`).
   - Create an API Token: **Datacenter -> Permissions -> API Tokens -> Add** (e.g. `metrics`, uncheck *Privilege Separation* if using role inheritance).
2. **Assign Read-Only Permissions:**
   - Assign the built-in `PVEAuditor` role on path `/`.
   - *Racklyt never requires and will never accept root or VM-mutating permissions.*
3. **Configure in Racklyt Hub:**
   - Navigate to **Settings -> Proxmox Nodes** in the Racklyt Web UI.
   - Enter your PVE Host address, API Token ID, Secret, and optional TLS SHA-256 fingerprint.

---

## 🔐 Security & Privacy

Racklyt was engineered with a strict **Privacy-First & Security-First** philosophy:

- **100% Self-Hosted:** No metrics or diagnostic data ever leave your network. Zero tracking, zero phone-home pings. See [PRIVACY.md](PRIVACY.md).
- **Zero-Trust Token Enrollment:** Cryptographic handshakes ensure unauthorized nodes cannot submit fake metrics. See [SECURITY.md](SECURITY.md).
- **Argon2id & AES-256-GCM:** Passwords are protected with modern Argon2id hashing; sensitive third-party API credentials are encrypted at rest.
- **Operational Safety Disclaimer:** Designed for IT monitoring; not certified for life-critical safety systems. See [TERMS.md](TERMS.md).

---

## 📚 Documentation Index

Detailed architectural and design specifications are located in the [`docs/`](docs/) directory:

- 🎨 **[UI & Visual Design Principles](docs/design_instructions/overview.md)**
- 🏗️ **[System Architecture & Ingestion Topology](docs/design_instructions/system_architecture.md)**
- 🛡️ **[Security Threat Model & Cryptographic Handshake](docs/design_instructions/security_model.md)**
- 👥 **[Multi-Account RBAC & Scoped Permissions](docs/design_instructions/rbac_and_accounts.md)**
- 📊 **[Editable Dashboards & Widget Engine](docs/design_instructions/editable_dashboards_ux.md)**
- 🔔 **[Alerting Engine & Dead-Man's Watchdog](docs/design_instructions/alerting_and_health.md)**
- 🦀 **[Backend Architecture & Axum Routes](docs/backend_instructions/hub_architecture.md)**
- 🐧 **[Agent Direct /proc Reader Engine](docs/backend_instructions/agent_architecture.md)**
- 💾 **[Database Architecture & Retention Policies](docs/backend_instructions/database_and_retention.md)**
- ☁️ **[Cloudflare Tunnel Setup Guide](docs/backend_instructions/cloudflared_setup.md)**

---

## 🤝 Contributing

We welcome community contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting pull requests.

```bash
# Verify Rust code before submitting:
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

# Verify Web frontend:
cd web && npm run build
```

---

## ⚖️ License

Racklyt is dual-licensed under either:

* **[MIT License](LICENSE-MIT)** (`LICENSE-MIT` or http://opensource.org/licenses/MIT)
* **[Apache License, Version 2.0](LICENSE-APACHE)** (`LICENSE-APACHE` or http://www.apache.org/licenses/LICENSE-2.0)

at your option. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.
