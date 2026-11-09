# Racklyt Design Instructions: Editable Dashboards & UI UX

## 1. Overview
Racklyt provides fully **customizable, editable dashboards** allowing users to compose personalized operational views. Users can rearrange, add, resize, and configure monitoring widgets for their infrastructure.

---

## 2. Visual Style Guidelines (Modern Non-Glass Dark Gray)

Racklyt emphasizes clean data density, crisp edges, and zero distraction:

```
+---------------------------------------------------------------------------------+
|  [Logo] Racklyt    [Dashboard: Main Homelab v]    [Edit Layout]    [User: Admin] |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  +--------------------+  +--------------------+  +---------------------------+  |
|  | Fleet Health       |  | Cluster Quorum     |  | RPi 4 Temperatures        |  |
|  | 8 Online / 0 Down  |  | PVE-01: Healthy    |  | pi-dns: 42°C  pi-vpn: 45°C|  |
|  | [100% Operational] |  | 14 VMs / 6 LXCs    |  | [Solid dark slate card]   |  |
|  +--------------------+  +--------------------+  +---------------------------+  |
|                                                                                 |
|  +--------------------------------------------+  +---------------------------+  |
|  | Core CPU & Memory History (Last 1 Hour)    |  | Storage Capacity Fill     |  |
|  |  80% |   _/\_                              |  | Local-ZFS: [======  ] 68% |  |
|  |  40% | _/    \__                           |  | Backup-NFS: [====    ] 41% |  |
|  |   0% +-----------------------------        |  | NVMe-Root:  [==      ] 22% |  |
|  +--------------------------------------------+  +---------------------------+  |
+---------------------------------------------------------------------------------+
```

### 2.1 Visual Rules
- **Solid Matte Surfaces:** Background `#1C1E24`, borders `#2E323D` (1px solid), base canvas `#121316`.
- **Zero Glassmorphism:** No `backdrop-filter: blur()`, no semi-transparent milk-white overlays. Surfaces are opaque and crisp.
- **High Data Density:** Compact padding (`p-3` to `p-4`), clear labels, readable monospaced values for metrics and timestamps.
- **Visual Feedback:** Border highlights in slate cyan (`#06B6D4`) when widgets are hovered or selected in edit mode.

---

## 3. Editable Dashboard Grid Architecture

### 3.1 Responsive Grid Engine
- **12-Column Flexible Grid:** Standard 12-column layout (e.g., using `grid-template-columns: repeat(12, 1fr)`).
- **Breakpoint Behavior:**
  - **Desktop (>= 1280px):** 12 columns, widgets span their assigned width ($1-12$).
  - **Tablet (768px - 1279px):** 6 or 8 columns, widgets wrap smoothly.
  - **Mobile (< 768px):** 1 column stack (widgets expand to 100% width for clean vertical scrolling).

### 3.2 Edit Mode Interaction
1. **Toggle Switch:** An **"Edit Dashboard"** button in the top navigation bar activates Edit Mode.
2. **Visual Indicators:** In Edit Mode, each widget displays:
   - A drag handle in the upper-left corner.
   - A settings (gear) button in the upper-right corner.
   - A delete (trash) button.
   - A resize anchor in the lower-right corner (adjusting columns and rows).
3. **Ghost Grid:** A subtle dotted grid guide `#2A2D35` renders in the background during layout editing.
4. **Collision Resolution:** Smooth reordering with snap-to-grid alignment.
5. **Save / Discard:** Explicit **"Save Layout"** and **"Cancel"** actions with rollback support.

---

## 4. Built-in Widget Catalog

| Widget Identifier | Description | Configuration Options |
| :--- | :--- | :--- |
| `stat-card` | Single KPI card (e.g. current CPU %, Temp, Uptime) | Target node, metric key, color thresholds, sparkline toggle |
| `time-series-chart` | Smooth line or area chart showing historical telemetry | Target nodes (multi-select), metrics, time range (1h, 6h, 24h, 7d) |
| `fleet-status` | High-level summary of monitored hosts (up, down, warn) | Tag filter, grouping (by OS, by cluster) |
| `proxmox-cluster` | Hypervisor overview: Quorum status, CPU, memory, storage | Cluster selection, show/hide stopped VMs |
| `proxmox-guest-list`| Compact table of VMs & LXCs with live state and reboot flags | Target node/cluster, search filter |
| `storage-gauge` | Bar or radial meter showing disk mount or ZFS pool fill | Mount point, alert threshold markers |
| `recent-alerts` | Chronological feed of active and acknowledged events | Severity filter (Info, Warning, Critical) |

---

## 5. Dashboard Sharing & Management

### 5.1 Multiple Dashboards
- Users can create multiple dashboards (e.g., "Homelab Overview", "Proxmox Cluster Deep Dive", "Raspberry Pi Fleet").
- Dashboards can be switched via a quick-select dropdown or pinned to the sidebar.

### 5.2 Visibility & Ownership
- **Private Dashboards:** Visible and editable only by the creator.
- **Shared / Public Dashboards:** Created by Admins, visible to all users with permission to the underlying nodes.
- **Role-Filtered Widgets:** If a shared dashboard contains a widget pointing to a server that user $X$ is not authorized to see, the widget gracefully displays a muted *"No Access / Restricted Resource"* placeholder without breaking the surrounding layout.
