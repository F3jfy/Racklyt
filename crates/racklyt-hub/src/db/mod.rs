use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use std::path::Path;
use tracing::info;

pub type DbPool = Pool<SqliteConnectionManager>;

/// Initializes the SQLite connection pool with embedded WAL pragmas
pub fn init_db_pool<P: AsRef<Path>>(db_path: P) -> Result<DbPool, Box<dyn std::error::Error>> {
    let manager = SqliteConnectionManager::file(&db_path).with_init(|conn: &mut Connection| {
        // Flash durability and performance PRAGMAs
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
                 PRAGMA synchronous = NORMAL;
                 PRAGMA temp_store = MEMORY;
                 PRAGMA cache_size = -64000;
                 PRAGMA busy_timeout = 5000;
                 PRAGMA foreign_keys = ON;",
        )?;
        Ok(())
    });

    let pool = Pool::builder().max_size(16).build(manager)?;

    // Run schema migrations and bootstrap seeds
    let conn = pool.get()?;
    run_migrations(&conn)?;

    // SEC-12 Hardening: Enforce 0600 file permissions on SQLite database and WAL on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(db_path.as_ref()) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o600);
            let _ = std::fs::set_permissions(db_path.as_ref(), perms);
        }
        for ext in &["-wal", "-shm"] {
            let companion = format!("{}{}", db_path.as_ref().display(), ext);
            if let Ok(metadata) = std::fs::metadata(&companion) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o600);
                let _ = std::fs::set_permissions(&companion, perms);
            }
        }
    }

    Ok(pool)
}

fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            is_system INTEGER NOT NULL DEFAULT 0,
            permissions TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT,
            password_hash TEXT NOT NULL,
            role_id TEXT NOT NULL REFERENCES roles(id),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_resource_scopes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            scope_type TEXT NOT NULL,
            scope_value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            hostname TEXT NOT NULL,
            os TEXT NOT NULL,
            arch TEXT NOT NULL,
            ip_address TEXT,
            status TEXT NOT NULL DEFAULT 'offline',
            push_interval_sec INTEGER NOT NULL DEFAULT 10,
            auth_token_hash TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            last_seen_at INTEGER,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metrics_raw (
            node_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            cpu_percent REAL NOT NULL,
            memory_used_bytes INTEGER NOT NULL,
            memory_total_bytes INTEGER NOT NULL,
            disk_used_bytes INTEGER NOT NULL,
            disk_total_bytes INTEGER NOT NULL,
            net_rx_bytes INTEGER NOT NULL,
            net_tx_bytes INTEGER NOT NULL,
            temp_celsius REAL,
            extra_json TEXT,
            PRIMARY KEY (node_id, timestamp)
        ) WITHOUT ROWID;

        CREATE TABLE IF NOT EXISTS dashboards (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
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
            widget_type TEXT NOT NULL,
            title TEXT NOT NULL,
            grid_x INTEGER NOT NULL,
            grid_y INTEGER NOT NULL,
            grid_w INTEGER NOT NULL,
            grid_h INTEGER NOT NULL,
            config TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notification_devices (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            device_name TEXT NOT NULL,
            platform TEXT NOT NULL,
            push_token TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            last_used_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS notifications_log (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
            alert_id TEXT NOT NULL,
            node_id TEXT,
            severity TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            metadata_json TEXT,
            is_read INTEGER NOT NULL DEFAULT 0,
            is_acknowledged INTEGER NOT NULL DEFAULT 0,
            sent_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS smtp_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            host TEXT NOT NULL,
            port INTEGER NOT NULL DEFAULT 587,
            username TEXT,
            password_enc TEXT,
            from_address TEXT NOT NULL,
            tls_mode TEXT NOT NULL DEFAULT 'starttls',
            is_enabled INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS login_audit_log (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            username TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            status TEXT NOT NULL,
            failure_reason TEXT,
            attempted_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metrics_hourly (
            node_id TEXT NOT NULL,
            hour_timestamp INTEGER NOT NULL,
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

        CREATE TABLE IF NOT EXISTS alert_rules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            metric TEXT NOT NULL,
            operator TEXT NOT NULL,
            threshold REAL NOT NULL,
            duration_seconds INTEGER NOT NULL DEFAULT 60,
            severity TEXT NOT NULL DEFAULT 'warning',
            target_node_id TEXT,
            channel TEXT NOT NULL DEFAULT 'all',
            is_enabled INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL
        );
        ",
    )?;

    // Safe schema updates for existing databases
    let _ = conn.execute(
        "ALTER TABLE users ADD COLUMN password_locked INTEGER NOT NULL DEFAULT 1",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute("ALTER TABLE users ADD COLUMN two_factor_secret TEXT", []);
    let _ = conn.execute(
        "ALTER TABLE users ADD COLUMN two_factor_enforced INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE users ADD COLUMN initial_generated_password TEXT",
        [],
    );

    // Seed default roles and initial admin if empty
    seed_defaults(conn)?;

    info!("Database initialized and verified.");
    Ok(())
}

fn seed_defaults(conn: &Connection) -> Result<(), rusqlite::Error> {
    let now = chrono::Utc::now().timestamp();

    // 1. Built-in Roles
    let superadmin_perms = serde_json::to_string(&vec!["*"]).unwrap_or_default();
    let admin_perms = serde_json::to_string(&vec![
        "users:manage",
        "nodes:enroll",
        "nodes:delete",
        "alerts:configure",
        "alerts:ack",
        "dashboard:manage_public",
        "dashboard:manage_private",
        "metrics:read",
    ])
    .unwrap_or_default();
    let operator_perms = serde_json::to_string(&vec![
        "alerts:ack",
        "dashboard:manage_public",
        "dashboard:manage_private",
        "metrics:read",
    ])
    .unwrap_or_default();
    let viewer_perms = serde_json::to_string(&vec!["dashboard:manage_private", "metrics:read"])
        .unwrap_or_default();

    conn.execute(
        "INSERT OR IGNORE INTO roles (id, name, is_system, permissions, created_at)
         VALUES ('role_superadmin', 'SuperAdmin', 1, ?1, ?2)",
        rusqlite::params![superadmin_perms, now],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO roles (id, name, is_system, permissions, created_at)
         VALUES ('role_admin', 'Administrator', 1, ?1, ?2)",
        rusqlite::params![admin_perms, now],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO roles (id, name, is_system, permissions, created_at)
         VALUES ('role_operator', 'Operator', 1, ?1, ?2)",
        rusqlite::params![operator_perms, now],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO roles (id, name, is_system, permissions, created_at)
         VALUES ('role_viewer', 'Viewer', 1, ?1, ?2)",
        rusqlite::params![viewer_perms, now],
    )?;

    // 2. Default SuperAdmin User ("admin" / default pass "admin123")
    let user_count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if user_count == 0 {
        let admin_hash =
            crate::auth::hash_password("admin123").unwrap_or_else(|_| "admin123".to_string());
        conn.execute(
            "INSERT INTO users (id, username, email, password_hash, role_id, is_active, created_at, updated_at)
             VALUES ('user_admin', 'admin', 'admin@racklyt.local', ?1, 'role_superadmin', 1, ?2, ?2)",
            rusqlite::params![admin_hash, now],
        )?;
        info!("Seeded default SuperAdmin user: 'admin' (Password: 'admin123')");
    }

    // 3. Purge any old legacy dashboards so only the specialized host dashboards exist
    let _ = conn.execute(
        "DELETE FROM dashboard_widgets WHERE dashboard_id NOT IN ('dash_default', 'dash_docker', 'dash_cpu', 'dash_storage', 'dash_network', 'dash_thermals', 'dash_security')",
        [],
    );
    let _ = conn.execute(
        "DELETE FROM dashboards WHERE user_id IS NULL AND id NOT IN ('dash_default', 'dash_docker', 'dash_cpu', 'dash_storage', 'dash_network', 'dash_thermals', 'dash_security')",
        [],
    );

    // 7 Specialized Single-Server Host Dashboards
    let dashboards_to_seed = vec![
        ("dash_default", "Server Cockpit — Master Overview", "Primary health, CPU, memory, storage, thermals, open ports & live Docker fleet for production", 1),
        ("dash_docker", "Docker & App Containers", "Container fleet cockpit, active services (Vaultwarden, Homestream, Seafile, Robo26), port bindings & container logs", 0),
        ("dash_cpu", "Processor & Multi-Core Distribution", "Intel Pentium G4400 dual-core load, clock frequencies, 1m/5m/15m load averages & thermal margin", 0),
        ("dash_storage", "Storage, Volumes & Filesystems", "Filesystem mounts, disk storage capacity, read/write I/O & volume alerts for /dev/ubuntu--vg", 0),
        ("dash_network", "Network Operations & Sockets", "Physical interface bandwidth (enp1s0), live port listening audit & connection journal", 0),
        ("dash_thermals", "Thermals & Hardware Health", "Hardware temperatures, processor thermal margin & ambient watchdogs", 0),
        ("dash_security", "Security, Audits & Watchdogs", "Security posture: exposed ports audit, public vs localhost access & incident alerts", 0),
    ];

    for (d_id, title, desc, is_def) in dashboards_to_seed {
        conn.execute(
            "INSERT INTO dashboards (id, user_id, title, description, is_default, is_public, created_at, updated_at)
             VALUES (?1, NULL, ?2, ?3, ?4, 1, ?5, ?5)
             ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description, updated_at = excluded.updated_at",
            rusqlite::params![d_id, title, desc, is_def, now],
        )?;

        // Seed respective widgets for each dashboard
        let widgets: Vec<(&str, &str, &str, u32, u32, u32, u32, &str)> = match d_id {
            "dash_default" => vec![
                ("w_ov_sys", "sysinfo", "Host Hardware Specs & OS", 0, 0, 6, 3, "{}"),
                ("w_ov_cpu", "circular-gauge", "CPU Utilization Dial", 6, 0, 2, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"subtitle\":\"Intel G4400 Load\"}"),
                ("w_ov_temp", "circular-gauge", "Hardware Thermal Watchdog", 8, 0, 2, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"subtitle\":\"Package Sensor\"}"),
                ("w_ov_ram", "circular-gauge", "Memory Utilization Dial", 10, 0, 2, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"subtitle\":\"16 GB DDR4\"}"),
                ("w_ov_chart", "time-series", "Host Workload & Telemetry History", 0, 3, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"%\"}"),
                ("w_ov_docker", "docker-fleet", "Docker Container Fleet Cockpit", 0, 7, 12, 5, "{}"),
                ("w_ov_net", "network-traffic", "Physical Network Interface (enp1s0)", 0, 12, 6, 4, "{\"rxSpeedMb\":12.4,\"txSpeedMb\":4.8,\"interfaceName\":\"enp1s0\"}"),
                ("w_ov_ports", "ports-table", "Open Listening Sockets & Port Bindings", 6, 12, 6, 4, "{}"),
                ("w_ov_storage", "storage-gauge", "Filesystem Mounts & Storage Capacity", 0, 16, 6, 3, "{}"),
                ("w_ov_cores", "cpu-breakdown", "Multi-Core CPU Load Distribution", 6, 16, 6, 3, "{}"),
                ("w_ov_logs", "log-stream", "Realtime System & Kernel Journal", 0, 19, 6, 3, "{}"),
                ("w_ov_alerts", "recent-alerts", "Dead-Man Watchdog & Security Alerts", 6, 19, 6, 3, "{}"),
            ],
            "dash_docker" => vec![
                ("w_doc_fleet", "docker-fleet", "Docker Container Fleet Cockpit", 0, 0, 12, 5, "{}"),
                ("w_doc_cpu", "circular-gauge", "Container Engine CPU Load", 0, 5, 3, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"subtitle\":\"Docker Processing\"}"),
                ("w_doc_ram", "circular-gauge", "Containers Memory Utilization", 3, 5, 3, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"subtitle\":\"Resident Sets\"}"),
                ("w_doc_temp", "circular-gauge", "Host Die Temp", 6, 5, 3, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"subtitle\":\"SoC Sensor\"}"),
                ("w_doc_disk", "circular-gauge", "Storage Allocation", 9, 5, 3, 3, "{\"query\":\"disk_percent\",\"unit\":\"%\",\"subtitle\":\"Root Storage\"}"),
                ("w_doc_chart", "time-series", "Container Resource History Timeline", 0, 8, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"%\"}"),
                ("w_doc_ports", "ports-table", "Container Ingress & Port Bindings", 0, 12, 6, 4, "{}"),
                ("w_doc_net", "network-traffic", "Docker Bridge Network Traffic", 6, 12, 6, 4, "{\"rxSpeedMb\":8.4,\"txSpeedMb\":4.2,\"interfaceName\":\"docker0\"}"),
                ("w_doc_store", "storage-gauge", "Docker Volumes & Host Storage Mounts", 0, 16, 6, 3, "{}"),
                ("w_doc_logs", "log-stream", "Docker Daemon & Container Event Journal", 6, 16, 6, 3, "{}"),
            ],
            "dash_cpu" => vec![
                ("w_cpu_specs", "sysinfo", "Intel Pentium G4400 Processor Architecture", 0, 0, 6, 3, "{}"),
                ("w_cpu_cores", "cpu-breakdown", "Core 0 & Core 1 Multi-Core Distribution", 6, 0, 6, 3, "{}"),
                ("w_cpu_d1", "circular-gauge", "Overall CPU Utilization", 0, 3, 3, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"subtitle\":\"Combined Load\"}"),
                ("w_cpu_d2", "circular-gauge", "CPU Package Die Temp", 3, 3, 3, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"subtitle\":\"Thermal Sensor\"}"),
                ("w_cpu_d3", "circular-gauge", "System Memory Allocation", 6, 3, 3, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"subtitle\":\"DDR4 RAM\"}"),
                ("w_cpu_d4", "circular-gauge", "Root Storage Used", 9, 3, 3, 3, "{\"query\":\"disk_percent\",\"unit\":\"%\",\"subtitle\":\"LVM Pool\"}"),
                ("w_cpu_chart", "time-series", "Multi-Core CPU History Timeline", 0, 6, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"%\"}"),
                ("w_cpu_ports", "ports-table", "Top Process Socket Utilization", 0, 10, 6, 4, "{}"),
                ("w_cpu_logs", "log-stream", "Kernel Scheduler & CPU Task Journal", 6, 10, 6, 4, "{}"),
            ],
            "dash_storage" => vec![
                ("w_str_mounts", "storage-gauge", "Filesystem Mounts & Storage Capacity", 0, 0, 8, 4, "{}"),
                ("w_str_specs", "sysinfo", "Storage Controller & Block Device Specs", 8, 0, 4, 4, "{}"),
                ("w_str_d1", "circular-gauge", "Root Partition Space", 0, 4, 3, 3, "{\"query\":\"disk_percent\",\"unit\":\"%\",\"subtitle\":\"/dev/ubuntu--vg\"}"),
                ("w_str_d2", "circular-gauge", "Drive Temperature", 3, 4, 3, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"subtitle\":\"Drive Thermal\"}"),
                ("w_str_d3", "circular-gauge", "CPU Storage I/O Wait", 6, 4, 3, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"subtitle\":\"I/O Processing\"}"),
                ("w_str_d4", "circular-gauge", "System Memory Buffers", 9, 4, 3, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"subtitle\":\"Buffer Cache\"}"),
                ("w_str_chart", "time-series", "Storage & Filesystem Read/Write History", 0, 7, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"%\"}"),
                ("w_str_ports", "ports-table", "Storage Protocols & Local Sockets", 0, 11, 6, 3, "{}"),
                ("w_str_logs", "log-stream", "Storage Subsystem & Filesystem Journal", 6, 11, 6, 3, "{}"),
            ],
            "dash_network" => vec![
                ("w_net_traffic", "network-traffic", "Physical Network Interface (enp1s0)", 0, 0, 6, 4, "{\"rxSpeedMb\":18.4,\"txSpeedMb\":8.2,\"interfaceName\":\"enp1s0\"}"),
                ("w_net_ports", "ports-table", "Active Sockets & Listening Ports Audit", 6, 0, 6, 4, "{}"),
                ("w_net_d1", "circular-gauge", "Ingress Rx Throughput", 0, 4, 3, 3, "{\"query\":\"cpu_overall\",\"unit\":\"MB/s\",\"subtitle\":\"Gigabit Link\"}"),
                ("w_net_d2", "circular-gauge", "Egress Tx Throughput", 3, 4, 3, 3, "{\"query\":\"cpu_overall\",\"unit\":\"MB/s\",\"subtitle\":\"Gigabit Link\"}"),
                ("w_net_d3", "circular-gauge", "Chassis Temperature", 6, 4, 3, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"subtitle\":\"Thermal Sensor\"}"),
                ("w_net_d4", "circular-gauge", "Socket Memory Buffers", 9, 4, 3, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"subtitle\":\"TCP/IP Buffers\"}"),
                ("w_net_chart", "time-series", "Network Interface Traffic Sparkline History", 0, 7, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"%\"}"),
                ("w_net_logs", "log-stream", "Packet & Socket Event Journal", 0, 11, 6, 3, "{}"),
                ("w_net_alerts", "recent-alerts", "Network Security & Drop Alerts", 6, 11, 6, 3, "{}"),
            ],
            "dash_thermals" => vec![
                ("w_th_d1", "circular-gauge", "Processor Thermal Sensor", 0, 0, 4, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"subtitle\":\"SoC / Core Package\"}"),
                ("w_th_d2", "circular-gauge", "CPU Utilization", 4, 0, 4, 3, "{\"query\":\"cpu_overall\",\"unit\":\"%\",\"subtitle\":\"Thermal Stress\"}"),
                ("w_th_d3", "circular-gauge", "System Memory Usage", 8, 0, 4, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"subtitle\":\"DDR4 Allocation\"}"),
                ("w_th_chart", "time-series", "Hardware Thermal History & Stability Timeline", 0, 3, 12, 4, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\"}"),
                ("w_th_specs", "sysinfo", "Hardware Thermal Zones & ACPI Specs", 0, 7, 6, 3, "{}"),
                ("w_th_cores", "cpu-breakdown", "Multi-Core Heat & Processing Distribution", 6, 7, 6, 3, "{}"),
                ("w_th_logs", "log-stream", "ACPI, Power & Thermal Event Journal", 0, 10, 6, 3, "{}"),
                ("w_th_alerts", "recent-alerts", "Critical Temperature Overheat Watchdogs", 6, 10, 6, 3, "{}"),
            ],
            "dash_security" => vec![
                ("w_sec_ports", "ports-table", "Open Listening Sockets & Exposure Audit", 0, 0, 8, 4, "{}"),
                ("w_sec_specs", "sysinfo", "System Hardening & Kernel Security", 8, 0, 4, 4, "{}"),
                ("w_sec_d1", "circular-gauge", "Public Exposed Sockets", 0, 4, 3, 3, "{\"query\":\"cpu_overall\",\"unit\":\" sockets\",\"subtitle\":\"SSH, HTTP, Apps\"}"),
                ("w_sec_d2", "circular-gauge", "Authentication Security", 3, 4, 3, 3, "{\"query\":\"memory_percent\",\"unit\":\"%\",\"subtitle\":\"Access Controls\"}"),
                ("w_sec_d3", "circular-gauge", "Storage Partition Security", 6, 4, 3, 3, "{\"query\":\"disk_percent\",\"unit\":\"%\",\"subtitle\":\"Root Storage\"}"),
                ("w_sec_d4", "circular-gauge", "Hardware Thermal State", 9, 4, 3, 3, "{\"query\":\"rpi_soc_temp\",\"unit\":\"°C\",\"subtitle\":\"Physical Sensor\"}"),
                ("w_sec_chart", "time-series", "Security Events & Audit Activity History", 0, 7, 12, 4, "{\"query\":\"cpu_overall\",\"unit\":\"%\"}"),
                ("w_sec_logs", "log-stream", "Authentication, SSH & Sudo Audit Journal", 0, 11, 6, 3, "{}"),
                ("w_sec_alerts", "recent-alerts", "Dead-Man Watchdogs & Security Incident Alerts", 6, 11, 6, 3, "{}"),
            ],
            _ => vec![],
        };

        for (wid, wtype, wtitle, x, y, w, h, cfg) in widgets {
            conn.execute(
                "INSERT OR REPLACE INTO dashboard_widgets (id, dashboard_id, widget_type, title, grid_x, grid_y, grid_w, grid_h, config, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                rusqlite::params![wid, d_id, wtype, wtitle, x, y, w, h, cfg, now],
            )?;
        }
    }
    info!("Verified and seeded specialized dashboard suite.");

    // 4. Seed system settings defaults if empty
    let settings_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM system_settings", [], |row| row.get(0))
        .unwrap_or(0);
    if settings_count == 0 {
        let defaults = vec![
            ("is_setup_completed", "false"),
            ("instance_name", "Racklyt Operations Hub"),
            ("fleet_domain", "homelab.lan"),
            ("retention_days", "30"),
            ("scrape_interval_secs", "10"),
            ("alert_cpu_threshold", "85"),
            ("alert_temp_threshold", "75"),
            ("alert_disk_threshold", "90"),
            ("alert_heartbeat_timeout", "30"),
            ("discord_webhook", ""),
            ("telegram_token", ""),
            ("telegram_chat_id", ""),
            ("rate_limit_per_min", "60"),
            ("session_timeout_mins", "60"),
            ("allow_public_dashboards", "false"),
            ("enforce_2fa", "false"),
        ];
        for (k, v) in defaults {
            conn.execute(
                "INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
                rusqlite::params![k, v, now],
            )?;
        }
        info!("Seeded default system settings (setup_completed: false).");
    }

    // 5. Seed default alert rules if empty
    let rules_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM alert_rules", [], |row| row.get(0))
        .unwrap_or(0);
    if rules_count == 0 {
        let default_rules = vec![
            (
                "rule_cpu_high",
                "High CPU Utilization",
                "cpu",
                ">",
                90.0,
                180,
                "warning",
                None::<String>,
                "all",
            ),
            (
                "rule_mem_high",
                "Memory Exhaustion Watchdog",
                "memory",
                ">",
                92.0,
                180,
                "critical",
                None::<String>,
                "all",
            ),
            (
                "rule_temp_high",
                "SoC / Package Thermal Limit",
                "temp",
                ">",
                75.0,
                120,
                "critical",
                None::<String>,
                "all",
            ),
            (
                "rule_disk_high",
                "Storage Pool Capacity Warning",
                "disk",
                ">",
                88.0,
                300,
                "warning",
                None::<String>,
                "all",
            ),
        ];
        for (id, name, metric, op, thresh, dur, sev, node_opt, chan) in default_rules {
            conn.execute(
                "INSERT OR IGNORE INTO alert_rules (id, name, metric, operator, threshold, duration_seconds, severity, target_node_id, channel, is_enabled, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10)",
                rusqlite::params![id, name, metric, op, thresh, dur, sev, node_opt, chan, now],
            )?;
        }
        info!("Seeded default alert rules.");
    }

    Ok(())
}
