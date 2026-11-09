# Racklyt Design Instructions: Overview & UI Principles

## 1. Vision & Purpose
**Racklyt** is a lightweight, self-hosted infrastructure monitoring platform designed to run comfortably on a single server or low-resource hardware like a Raspberry Pi 4/5. It provides unified, real-time observability across:
- Standalone Linux servers & remote Raspberry Pis (via lightweight Rust agents)
- Proxmox Virtual Environment (PVE) clusters, standalone nodes, VMs, and LXC containers (via native REST API)
- Network endpoints and core services

The system is built on two core principles:
1. **Lightweight & High Performance:** Minimal CPU/RAM overhead on both the monitoring Hub and monitored targets.
2. **Security-First & Privacy-Focused:** End-to-end encrypted metric pipelines, zero external cloud dependencies, and fine-grained Role-Based Access Control (RBAC).

---

## 2. Visual Design System

### 2.1 Aesthetic: Modern, Flat, Non-Glass Dark Gray
Racklyt explicitly rejects blurry "glassmorphism", heavy backdrop filters, and low-contrast neon aesthetics. The UI utilizes a **solid, modern, utilitarian dark gray design system** inspired by professional DevOps tools and terminal workflows.

#### Color Palette
- **Base Background:** Deep Charcoal (`#121316` / `rgb(18, 19, 22)`)
- **Card & Surface Background:** Medium Dark Gray (`#1C1E24` / `rgb(28, 30, 36)`)
- **Hover / Elevated Surface:** Slate Gray (`#252830` / `rgb(37, 40, 48)`)
- **Borders & Dividers:** Subtle Muted Border (`#2E323D` / `rgb(46, 50, 61)`)
- **Primary Text:** Crisp Off-White (`#F3F4F6` / `rgb(243, 244, 246)`)
- **Secondary / Muted Text:** Cool Gray (`#9CA3AF` / `rgb(156, 163, 175)`)
- **Accents & Semantic Status Colors:**
  - **Healthy / Up:** Solid Emerald (`#10B981` / `rgb(16, 185, 129)`)
  - **Warning / Degraded:** Amber Gold (`#F59E0B` / `rgb(245, 158, 11)`)
  - **Critical / Down:** Vibrant Coral Red (`#EF4444` / `rgb(239, 68, 68)`)
  - **Action / Active Accent:** Slate Cyan (`#06B6D4` / `rgb(6, 182, 212)`)
  - **Offline / Stale:** Muted Slate (`#6B7280` / `rgb(107, 114, 128)`)

#### Card & Container Styling
- **No Backdrop Blur:** Solid background fills with 1px solid borders (`border border-[#2E323D]`).
- **Subtle Elevation:** Flat or tight, crisp drop shadows (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4)`).
- **Corner Radii:** Consistent modern rounded corners (`rounded-lg` / `8px` or `rounded-md` / `6px`).
- **Typography:** Clean monospace font for IPs, metrics, hashes, and ports (e.g., `JetBrains Mono`, `Fira Code`); clean sans-serif for UI labels and navigation (e.g., `Inter`).

---

## 3. High-Level Feature Architecture

```
+-------------------------------------------------------------------------+
|                              RACKLYT HUB                                |
|                                                                         |
|  +--------------------+  +----------------------+  +-----------------+  |
|  | Editable Dashboard |  | Node & Cluster Views |  |  Admin Center   |  |
|  | (Custom Widgets)   |  | (Metrics, VMs, LXCs) |  | (Users, Roles)  |  |
|  +--------------------+  +----------------------+  +-----------------+  |
|  ---------------------------------------------------------------------  |
|  |                         Web Application Layer                     |  |
|  |             (Single-Page App served via Axum / Rust)              |  |
|  +-------------------------------------------------------------------+  |
|                                    |                                    |
|                   REST API & WebSocket Subscriptions                    |
|                                    |                                    |
|  +-------------------------------------------------------------------+  |
|  |                            Core Engine                            |  |
|  |   - Multi-Account RBAC Engine        - Alert & Heartbeat Watchdog |  |
|  |   - Ingestion Handler (TLS/Token)    - Proxmox Poller Module      |  |
|  |   - SQLite Time-Series Store         - Retention & Downsampler    |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 4. Key UI Functional Modules
1. **Customizable & Editable Dashboards:** Drag-and-drop or grid-based widget layouts saved per user profile.
2. **Infrastructure Explorer:**
   - **Proxmox Clusters:** Hierarchical tree of Datacenter -> Nodes -> VMs / LXCs -> Storage Pools.
   - **Standalone Servers & RPi Fleet:** Grid or table view of agent-monitored hosts with CPU, RAM, disk, load, and temperature stats.
3. **Alerts & Events Stream:** Real-time chronological audit trail of threshold breaches, offline transitions, and agent connections.
4. **Administration & Security:**
   - User account management with custom roles and permission scoping.
   - Agent enrollment keys and revocation controls.
   - Proxmox API token configuration and health diagnostics.
