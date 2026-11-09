# Racklyt Backend Instructions: Database Architecture & Retention Policy

## 1. Overview & Storage Philosophy
Racklyt uses an **embedded SQLite database** as its primary storage engine for all system configuration, multi-account RBAC, dashboard layouts, and time-series telemetry. 

To ensure maximum reliability and longevity on Raspberry Pis (which frequently use MicroSD cards or USB flash media), the database layer is heavily tuned to minimize write cycles, eliminate random seeks, and maximize I/O throughput.

---

## 2. SQLite Engine PRAGMAs (RPi & Flash Durability)

Upon opening the database connection pool, the following PRAGMAs must be executed immediately:

```sql
-- 1. Enable Write-Ahead Logging (WAL) for concurrent reads while writing
PRAGMA journal_mode = WAL;

-- 2. Relax sync from FULL to NORMAL: Prevents excessive fsync() calls on SD cards while maintaining ACID integrity in WAL mode
PRAGMA synchronous = NORMAL;

-- 3. Keep temporary tables, indices, and sort operations in RAM rather than thrashing flash storage
PRAGMA temp_store = MEMORY;

-- 4. Allocate 64MB of RAM cache for hot pages
PRAGMA cache_size = -64000;

-- 5. Prevent "database is locked" errors during burst ingestion
PRAGMA busy_timeout = 5000;

-- 6. Enforce relational integrity
PRAGMA foreign_keys = ON;
```

---

## 3. Database Schema

### 3.1 Authentication & Multi-Account RBAC

```sql
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,                       -- e.g. 'role_admin', 'role_viewer'
    name TEXT NOT NULL UNIQUE,                 -- e.g. 'Administrator', 'Viewer'
    is_system INTEGER NOT NULL DEFAULT 0,      -- 1 = built-in (immutable), 0 = custom
    permissions TEXT NOT NULL,                 -- JSON array of granted permission keys
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                       -- UUID v4
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT NOT NULL,               -- Argon2id PHC string
    role_id TEXT NOT NULL REFERENCES roles(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_resource_scopes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL,                  -- 'node', 'cluster', 'tag'
    scope_value TEXT NOT NULL                  -- Node ID, Cluster ID, or tag string ('env:prod')
);
```

### 3.2 Monitored Nodes & Proxmox Hypervisors

```sql
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,                       -- UUID v4
    name TEXT NOT NULL,
    hostname TEXT NOT NULL,
    os TEXT NOT NULL,
    arch TEXT NOT NULL,
    ip_address TEXT,
    status TEXT NOT NULL DEFAULT 'offline',    -- 'online', 'degraded', 'offline'
    push_interval_sec INTEGER NOT NULL DEFAULT 10,
    auth_token_hash TEXT NOT NULL,             -- SHA-256 hash of agent token
    tags TEXT NOT NULL DEFAULT '[]',           -- JSON array of tags: ["env:home", "rpi"]
    last_seen_at INTEGER,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS proxmox_clusters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_url TEXT NOT NULL,                     -- https://pve.internal.lan:8006
    token_id TEXT NOT NULL,                    -- racklyt-monitor@pve!metrics
    token_secret_enc TEXT NOT NULL,            -- AES-256-GCM encrypted secret
    tls_fingerprint TEXT,                      -- SHA-256 cert fingerprint
    poll_interval_sec INTEGER NOT NULL DEFAULT 15,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_poll_at INTEGER
);

CREATE TABLE IF NOT EXISTS proxmox_guests (
    id TEXT PRIMARY KEY,                       -- cluster_id + ':' + vmid
    cluster_id TEXT NOT NULL REFERENCES proxmox_clusters(id) ON DELETE CASCADE,
    node_name TEXT NOT NULL,
    vmid INTEGER NOT NULL,
    guest_type TEXT NOT NULL,                  -- 'qemu' or 'lxc'
    name TEXT NOT NULL,
    status TEXT NOT NULL,                      -- 'running', 'stopped'
    last_metrics TEXT NOT NULL,                -- JSON snapshot of latest metrics
    updated_at INTEGER NOT NULL
);
```

### 3.3 Editable Dashboards & Widgets

```sql
CREATE TABLE IF NOT EXISTS dashboards (
    id TEXT PRIMARY KEY,                       -- UUID v4
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL if system shared
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
    widget_type TEXT NOT NULL,                 -- 'stat-card', 'time-series-chart', etc.
    title TEXT NOT NULL,
    grid_x INTEGER NOT NULL,                   -- 0 to 11
    grid_y INTEGER NOT NULL,
    grid_w INTEGER NOT NULL,                   -- 1 to 12
    grid_h INTEGER NOT NULL,                   -- Row span
    config TEXT NOT NULL,                      -- JSON widget settings (nodes, metric keys)
    created_at INTEGER NOT NULL
);
```

### 3.4 Telemetry & Retention Rollups

```sql
-- High-resolution metrics (Retained for 7 days)
CREATE TABLE IF NOT EXISTS metrics_raw (
    node_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,                -- Unix timestamp (seconds)
    cpu_percent REAL NOT NULL,
    memory_used_bytes INTEGER NOT NULL,
    memory_total_bytes INTEGER NOT NULL,
    disk_used_bytes INTEGER NOT NULL,
    disk_total_bytes INTEGER NOT NULL,
    net_rx_bytes INTEGER NOT NULL,
    net_tx_bytes INTEGER NOT NULL,
    temp_celsius REAL,
    extra_json TEXT,                           -- Per-core, per-disk extra details
    PRIMARY KEY (node_id, timestamp)
) WITHOUT ROWID;

-- Downsampled hourly rollups (Retained for 90+ days)
CREATE TABLE IF NOT EXISTS metrics_hourly (
    node_id TEXT NOT NULL,
    hour_timestamp INTEGER NOT NULL,           -- Timestamp rounded down to hour
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
```

### 3.5 Mobile Push Devices, Notification Logs & Email (SMTP)

```sql
-- Registered mobile devices for push notifications (APNs / FCM / UnifiedPush)
CREATE TABLE IF NOT EXISTS notification_devices (
    id TEXT PRIMARY KEY,                       -- UUID v4
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,                 -- e.g. "Adam's iPhone 15 Pro", "Pixel 8"
    platform TEXT NOT NULL,                    -- 'ios', 'android', 'web'
    push_token TEXT NOT NULL UNIQUE,           -- APNs device token or FCM registration token
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER
);

-- Chronological notifications and alert events stream (Inbox)
CREATE TABLE IF NOT EXISTS notifications_log (
    id TEXT PRIMARY KEY,                       -- UUID v4
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL if broadcast to all permitted
    alert_id TEXT NOT NULL,                    -- Reference to active alert instance
    node_id TEXT,                              -- Node UUID (or NULL for cluster-level)
    severity TEXT NOT NULL,                    -- 'info', 'warning', 'critical'
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    metadata_json TEXT,                        -- JSON payload for mobile app deep-linking
    is_read INTEGER NOT NULL DEFAULT 0,
    is_acknowledged INTEGER NOT NULL DEFAULT 0,
    sent_at INTEGER NOT NULL
);

-- SMTP Configuration for Email Alerts
CREATE TABLE IF NOT EXISTS smtp_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),     -- Single-row configuration table
    host TEXT NOT NULL,                        -- e.g. "smtp.sendgrid.net" or "mail.example.com"
    port INTEGER NOT NULL DEFAULT 587,
    username TEXT,
    password_enc TEXT,                         -- AES-256-GCM encrypted password
    from_address TEXT NOT NULL,                -- "Racklyt Alerts <alerts@example.com>"
    tls_mode TEXT NOT NULL DEFAULT 'starttls', -- 'none', 'starttls', 'tls'
    is_enabled INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

-- Notification Channels (Email, Webhook, Discord, etc.)
CREATE TABLE IF NOT EXISTS alert_channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    channel_type TEXT NOT NULL,                -- 'email', 'mobile_push', 'gotify', 'discord', 'webhook'
    config_json TEXT NOT NULL,                 -- Encrypted destination settings & recipient filters
    min_severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);
```

---

## 4. Batch Ingestion & Downsampling Pipeline

### 4.1 In-Memory Batching (Write Reduction)
Rather than executing an `INSERT` statement for every individual incoming HTTP request:
- Incoming metrics pass into a `tokio::sync::mpsc::channel` buffer.
- A dedicated SQLite background task collects items from the channel.
- The task flushes queued records inside a single `BEGIN TRANSACTION ... COMMIT` every **1,000 ms** or when the buffer reaches **500 items**.
- This reduces SQLite transactions from thousands per minute to just 60 per minute.

### 4.2 Automated Retention & Pruning
A cron-like worker runs every **10 minutes**:
1. **Rollup Aggregation:** Computes hourly averages and maximums for raw metrics older than 2 hours and inserts them into `metrics_hourly`.
2. **Raw Pruning:** Deletes records from `metrics_raw` where `timestamp < unixepoch() - (7 * 86400)`.
3. **Hourly Pruning:** Deletes records from `metrics_hourly` where `hour_timestamp < unixepoch() - (90 * 86400)`.
4. **Maintenance:** Runs `PRAGMA wal_checkpoint(PASSIVE)` and periodic `PRAGMA optimize;` to keep disk usage lean.
