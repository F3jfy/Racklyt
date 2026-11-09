# Racklyt Documentation Index

Welcome to the **Racklyt** technical specifications and architectural documentation.

Racklyt is an ultra-lightweight, security-focused server and infrastructure monitoring system built in Rust. It runs effortlessly on low-power devices like a single server or Raspberry Pi to monitor standalone servers, clusters, Raspberry Pis, and Proxmox VE hypervisors.

---

## 🎨 Design Instructions (`docs/design_instructions/`)

| Document | Focus & Content |
| :--- | :--- |
| **[Overview & UI Principles](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/design_instructions/overview.md)** | Core project vision, non-glass modern dark gray design system, color palette, and visual specifications. |
| **[System Architecture](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/design_instructions/system_architecture.md)** | Hub-and-Spoke topology, push vs pull data collection, offline node detection, and hardware performance budgets. |
| **[Security Model](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/design_instructions/security_model.md)** | Zero-trust authentication, agent enrollment protocol, TLS encryption, Proxmox least privilege, and SQLite file protection. |
| **[Multi-Account Management & RBAC](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/design_instructions/rbac_and_accounts.md)** | User accounts, built-in and custom roles, granular permission matrices, and node/cluster resource scoping. |
| **[Editable Dashboards & UI UX](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/design_instructions/editable_dashboards_ux.md)** | 12-column editable dashboard grid, drag-and-drop mechanics, widget catalog, and layout persistence. |
| **[Alerting & Health Engine](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/design_instructions/alerting_and_health.md)** | Dead-man's switch heartbeat watchdog, metric threshold rules, notification dispatchers (Gotify, NTFY, Discord, Telegram). |

---

## ⚙️ Backend Instructions (`docs/backend_instructions/`)

| Document | Focus & Content |
| :--- | :--- |
| **[Backend Overview](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/backend_instructions/overview.md)** | Rust workspace layout, crate responsibilities (`racklyt-hub`, `racklyt-agent`, `racklyt-common`), and target architectures. |
| **[Hub Architecture & API Engine](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/backend_instructions/hub_architecture.md)** | Axum web server, Tokio async runtime tasks, REST route tree, WebSocket feed, and embedded SPA integration. |
| **[Agent Architecture & Telemetry Engine](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/backend_instructions/agent_architecture.md)** | Standalone agent design, direct `/proc` and `/sys` telemetry readers, in-memory ring-buffer for offline resilience, and configuration. |
| **[Proxmox VE Poller & API Client](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/backend_instructions/proxmox_collector.md)** | Proxmox VE API2 client, token authentication, cluster/node/guest metrics collection, and TLS fingerprint pinning. |
| **[Database Architecture & Retention Policy](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/backend_instructions/database_and_retention.md)** | Embedded SQLite schemas, PRAGMA optimizations for SD card/Raspberry Pi durability, batching, and automated downsampling rollups. |
| **[Cloudflare Tunnel (`cloudflared`) Integration](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/backend_instructions/cloudflared_setup.md)** | Running behind Cloudflare Tunnels, zero router port forwarding, WebSocket proxying, and Zero Trust Access SSO. |
| **[Mobile App API & Email Notification Engine](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/backend_instructions/mobile_and_notifications_api.md)** | Dedicated API for companion iOS/Android phone apps, push tokens (APNs/FCM), in-app inbox, deep linking, and SMTP email engine. |
| **[Authentication, RBAC & Permissions Engine](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/backend_instructions/auth_and_permissions_backend.md)** | Argon2id password hashing, session tokens, Axum RBAC extractors, query filtering, and first-run bootstrapping. |
| **[Coding Standards & Best Practices](file:///home/adamfejfar/Documents/Projects/Racklyt/docs/backend_instructions/coding_standards.md)** | Strict Clippy linter policies, zero unhandled errors (`unwrap`), allocation minimization, and structured logging with `tracing`. |
