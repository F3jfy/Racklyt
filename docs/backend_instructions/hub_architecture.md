# Racklyt Backend Instructions: Hub Architecture & API Engine

## 1. Overview
The **Racklyt Hub** is the central nervous system of the monitoring infrastructure. It is written in Rust using **Axum** and runs on top of the **Tokio** asynchronous runtime. It serves four concurrent duties in a single binary:
1. Ingests telemetry pushed by remote `racklyt-agent` instances.
2. Polls configured Proxmox VE clusters via their REST API.
3. Exposes an authenticated REST and WebSocket API for the user interface.
4. Serves the embedded single-page application (SPA) directly to browsers.

---

## 2. Concurrency Architecture & Tokio Tasks

The Hub starts several cooperative, non-blocking asynchronous tasks managed via `tokio::spawn`:

```
+-------------------------------------------------------------------------+
|                              MAIN PROCESS                               |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Task 1: Axum HTTP & WebSocket Server                              |  |
|  | - Handles /api/v1/* routes and /ws real-time connections          |  |
|  | - Serves static SPA assets via rust-embed                         |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Task 2: Metric Ingest Batcher (MPSC Channel -> SQLite Writer)     |  |
|  | - Receives metric payloads from HTTP ingest routes                |  |
|  | - Batches records in memory for 1 second before disk commit       |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Task 3: Proxmox Poller Task                                       |  |
|  | - Ticks every 15s per registered cluster                          |  |
|  | - Queries /api2/json endpoints, writes cluster & guest metrics   |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Task 4: Heartbeat & Alert Evaluator                               |  |
|  | - Ticks every 5s                                                  |  |
|  | - Detects dead nodes, evaluates rule expressions                 |  |
|  | - Dispatches to Mobile Push (APNs/FCM), Email (SMTP) & Webhooks   |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Task 5: Rollup Aggregator & Retention Pruner                      |  |
|  | - Ticks every 10 minutes                                          |  |
|  | - Aggregates raw metrics to 5m/1h rollups, purges expired records |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 3. API Route Structure

All endpoints reside under `/api/v1/` and enforce JSON serialization.

### 3.1 Authentication & User Management
- `POST /api/v1/auth/login` — Authenticate username & password; returns secure session cookie.
- `POST /api/v1/auth/logout` — Invalidate current session.
- `GET  /api/v1/auth/me` — Return current authenticated user profile, roles, and allowed resource scopes.
- `GET  /api/v1/users` — List all user accounts (Admin only).
- `POST /api/v1/users` — Create user account with specified role and scopes (Admin only).
- `PUT  /api/v1/users/:id` — Update user details or permissions (Admin only).
- `DELETE /api/v1/users/:id` — Disable or delete user account (Admin only).
- `GET  /api/v1/roles` — List available system and custom roles.

### 3.2 Agent Ingestion & Enrollment
- `POST /api/v1/enrollment/generate` — Generate a one-time enrollment key (Admin only).
- `POST /api/v1/enrollment/claim` — Agent initial handshake; exchanges enrollment key for persistent node credentials.
- `POST /api/v1/ingest/metrics` — Ingest telemetry from authenticated `racklyt-agent` (High throughput).

### 3.3 Node & Infrastructure Explorer
- `GET  /api/v1/nodes` — List all monitored nodes filtered by the user's RBAC scope.
- `GET  /api/v1/nodes/:id` — Retrieve detailed node metadata and latest status snapshot.
- `PUT  /api/v1/nodes/:id` — Update node tags, display name, or alert thresholds.
- `DELETE /api/v1/nodes/:id` — Deregister a node and optionally purge its telemetry.

### 3.4 Proxmox VE Hypervisors
- `GET  /api/v1/proxmox/clusters` — List registered Proxmox clusters (RBAC-filtered).
- `POST /api/v1/proxmox/clusters` — Add new Proxmox instance (endpoint, token, cert fingerprint).
- `GET  /api/v1/proxmox/clusters/:id/nodes` — List physical cluster nodes.
- `GET  /api/v1/proxmox/clusters/:id/guests` — List all VMs and LXCs with live utilization.

### 3.5 Dashboards & Widgets (Editable Grid)
- `GET  /api/v1/dashboards` — List accessible dashboards (public + user-private).
- `POST /api/v1/dashboards` — Create new dashboard configuration.
- `GET  /api/v1/dashboards/:id` — Get specific dashboard layout and widget positions.
- `PUT  /api/v1/dashboards/:id` — Save updated widget positions, dimensions, and configurations.
- `DELETE /api/v1/dashboards/:id` — Delete dashboard.

### 3.6 Metrics & Analytics
- `GET  /api/v1/metrics/query` — Query historical metric series for given node(s), metric keys, and time window.
- `GET  /api/v1/metrics/summary` — Aggregated fleet statistics for rapid dashboard rendering.

### 3.7 Real-Time WebSocket & Server-Sent Events (SSE)
- `GET  /ws` — Upgrades to WebSocket. Transmits real-time node state transitions, live metric ticks, and alert notifications. Scoped strictly according to the connecting user's permissions.
- `GET  /api/v1/notifications/stream` — Low-overhead Server-Sent Events (SSE) stream for mobile apps and lightweight clients.

### 3.8 Mobile App API & Notification Inbox
- `POST /api/v1/devices/push` — Register mobile push notification token (APNs, FCM, UnifiedPush).
- `DELETE /api/v1/devices/push/:token` — Unregister a mobile device token on app logout.
- `GET  /api/v1/notifications` — Retrieve paginated notification inbox for current user (filtered by RBAC scope).
- `GET  /api/v1/notifications/unread-count` — Fast endpoint for mobile app app-icon badge counters.
- `POST /api/v1/notifications/:id/ack` — Acknowledge an alert directly from a mobile push action.
- `POST /api/v1/notifications/ack-all` — Mark all alerts as read/acknowledged.

### 3.9 Email (SMTP) & Alert Channel Management
- `GET  /api/v1/settings/smtp` — Retrieve current SMTP configuration (Admin only).
- `PUT  /api/v1/settings/smtp` — Update SMTP server settings, port, credentials, and from-address (Admin only).
- `POST /api/v1/settings/smtp/test` — Send a test alert email to verify server connectivity and TLS.
- `GET  /api/v1/alerts/channels` — List active notification channels (Email, Mobile Push, Gotify, Discord, etc.).
- `POST /api/v1/alerts/channels` — Create or update an alert channel destination.

---

## 4. Single-Binary SPA Serving Strategy

To eliminate complex web server setups (like separate Nginx or Apache containers), the Axum server embeds the compiled frontend:

```rust
// Conceptual embedding snippet
use rust_embed::RustEmbed;
use axum::response::{Html, IntoResponse, Response};
use http::{header, StatusCode, Uri};

#[derive(RustEmbed)]
#[folder = "web/dist/"]
struct Asset;

pub async fn static_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let target = if path.is_empty() { "index.html" } else { path };

    match Asset::get(target) {
        Some(content) => {
            let mime = mime_guess::from_path(target).first_or_octet_stream();
            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            // SPA fallback: Return index.html for client-side routing
            match Asset::get("index.html") {
                Some(content) => Html(content.data).into_response(),
                None => (StatusCode::NOT_FOUND, "Web build missing").into_response(),
            }
        }
    }
}
```
