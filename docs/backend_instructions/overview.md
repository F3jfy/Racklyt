# Racklyt Backend Instructions: Overview & Workspace Layout

## 1. Technical Vision
The Racklyt backend is implemented in **Rust** to provide:
- **Rock-Solid Memory Safety & Concurrency:** Zero garbage collection pauses, predictable low latency.
- **Ultra-Low Resource Consumption:** Minimal RAM and CPU footprint on single-board computers (Raspberry Pi).
- **Single-Binary Portability:** Self-contained executable embedding the frontend assets, SQLite engine, and background pollers.

---

## 2. Cargo Workspace Architecture

Racklyt utilizes a Cargo multi-crate workspace to cleanly separate the Hub, Agent, and shared utilities:

```
Racklyt/
├── Cargo.toml                  # Root workspace manifest
├── crates/
│   ├── racklyt-common/         # Shared data models, protocol DTOs, crypto utils
│   │   ├── Cargo.toml
│   │   └── src/
│   ├── racklyt-hub/            # Central monitoring server, API, SQLite, web server
│   │   ├── Cargo.toml
│   │   └── src/
│   └── racklyt-agent/          # Ultra-lightweight telemetry collector binary
│       ├── Cargo.toml
│       └── src/
├── web/                        # Embedded Web Frontend (Svelte / React + Tailwind)
│   ├── package.json
│   └── ...
└── docs/                       # Architecture & design specifications
    ├── design_instructions/
    └── backend_instructions/
```

### 2.1 Workspace Crate Responsibilities

#### `racklyt-common`
- Serialized data transfer objects (DTOs) for metrics (`SystemMetricsPayload`, `NodeInfo`, `Heartbeat`).
- Common cryptographic helpers (token hashing, key generation).
- Unified error types and status codes.

#### `racklyt-hub`
- **Axum** HTTP REST and WebSocket server.
- **Tokio** multi-threaded asynchronous runtime.
- **Rusqlite / SQLx** embedded SQLite persistence layer.
- Background background services:
  - Agent heartbeat auditor.
  - Proxmox VE REST poller.
  - Metrics downsampling and retention cleaner.
  - Notification dispatcher.
- `rust-embed` static asset provider for the compiled Web SPA.

#### `racklyt-agent`
- Minimalist binary compiled without GUI or database dependencies.
- Hardware telemetry readers (`sysinfo` and `/proc` parser).
- Outbound HTTPS client (`reqwest` with `rustls` or `ureq` for minimal binary footprint).

---

## 3. Technology Stack & Key Crates

| Purpose | Crate Choice | Rationale |
| :--- | :--- | :--- |
| **Async Runtime** | `tokio` (features = `["rt-multi-thread", "macros", "time"]`) | Industry standard, robust async executor. |
| **Web / API Framework** | `axum` | Modular, ergonomic, top-tier performance on Tokio. |
| **Database Engine** | `rusqlite` (with `bundled`) or `sqlx` (sqlite) | Embedded zero-setup SQLite, bundled C engine. |
| **Static Assets** | `rust-embed` | Embeds production web build into binary during compile. |
| **Password Hashing** | `argon2` | Secure memory-hard credential hashing. |
| **Cryptography / TLS** | `rustls` / `ring` | Pure-Rust modern TLS, avoids OpenSSL C dependency hurdles. |
| **Serialization** | `serde`, `serde_json` | High-speed zero-copy deserialization. |
| **Metrics Collection** | `sysinfo` / direct `/proc` & `/sys` | Cross-platform hardware telemetry with negligible overhead. |

---

## 4. Target Platforms & Cross-Compilation
Racklyt targets Linux across all major architectures:
- `x86_64-unknown-linux-gnu` / `musl` (Standard Servers & Clouds)
- `aarch64-unknown-linux-gnu` / `musl` (Raspberry Pi 4 / 5, 64-bit ARM boards)
- `armv7-unknown-linux-gnueabihf` (Raspberry Pi 2 / 3, 32-bit legacy ARM boards)
- Fully static binaries compiled using `musl` enable zero-dependency deployment on any Linux distribution (Alpine, Debian, Ubuntu, Arch, Rocky).
