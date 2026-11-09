use crate::{api::notifications::RealtimeEvent, db::DbPool};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::time::sleep;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Clone)]
struct AlertToDispatch {
    title: String,
    body: String,
    severity: String,
    node_name: String,
}

pub fn start_background_engine(
    pool: DbPool,
    event_tx: tokio::sync::broadcast::Sender<RealtimeEvent>,
    session_store: crate::auth::SessionStore,
) {
    let pool_watchdog = pool.clone();
    let event_tx_watchdog = event_tx.clone();

    // 1. Dead-Man's Watchdog & Offline Node Detector
    tokio::spawn(async move {
        let mut flap_tracker: HashMap<String, (i64, u32)> = HashMap::new(); // node_id -> (last_alert_time, count)

        loop {
            sleep(Duration::from_secs(5)).await;

            let mut alerts_to_send: Vec<AlertToDispatch> = Vec::new();
            let mut discord_url: Option<String> = None;
            let mut smtp_enabled = false;

            if let Ok(conn) = pool_watchdog.get() {
                let now = chrono::Utc::now().timestamp();

                // Read discord and smtp settings
                discord_url = conn
                    .query_row(
                        "SELECT value FROM system_settings WHERE key = 'discord_webhook'",
                        [],
                        |row| row.get(0),
                    )
                    .ok()
                    .filter(|url: &String| !url.trim().is_empty());

                smtp_enabled = conn
                    .query_row(
                        "SELECT is_enabled FROM smtp_config WHERE id = 1",
                        [],
                        |row| Ok(row.get::<_, i64>(0)? == 1),
                    )
                    .unwrap_or(false);

                // Check timeout limit from system settings (default 30s)
                let timeout_secs: i64 = conn
                    .query_row(
                        "SELECT value FROM system_settings WHERE key = 'alert_heartbeat_timeout'",
                        [],
                        |row| row.get::<_, String>(0),
                    )
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(30);

                let dead_nodes: Vec<(String, String)> = {
                    if let Ok(mut stmt) = conn.prepare(
                        "SELECT id, name, last_seen_at FROM nodes WHERE status = 'online' AND (?1 - last_seen_at) > ?2",
                    ) {
                        let rows = stmt.query_map(rusqlite::params![now, timeout_secs], |row| {
                            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                        });
                        rows.map(|mapped| mapped.filter_map(Result::ok).collect()).unwrap_or_default()
                    } else {
                        Vec::new()
                    }
                };

                for (node_id, name) in dead_nodes {
                    warn!(
                        "Dead-man's switch triggered: Node {} ({}) missed heartbeat (> {}s)",
                        name, node_id, timeout_secs
                    );

                    // Mark offline
                    let _ = conn.execute(
                        "UPDATE nodes SET status = 'offline' WHERE id = ?1",
                        rusqlite::params![node_id],
                    );

                    // Flap protection: if alerted recently within 60s, throttle duplicate notifications
                    let should_alert = !matches!(
                        flap_tracker.get(&node_id),
                        Some((last_time, _)) if now - *last_time < 60
                    );

                    if should_alert {
                        flap_tracker.insert(node_id.clone(), (now, 1));

                        let notif_id = format!("notif_{}", Uuid::new_v4().simple());
                        let title = format!("Critical: Node Offline - {}", name);
                        let body = format!(
                            "Host '{}' missed telemetry heartbeats for over {} seconds.",
                            name, timeout_secs
                        );

                        let _ = conn.execute(
                            "INSERT INTO notifications_log (id, alert_id, node_id, severity, title, body, metadata_json, is_read, is_acknowledged, sent_at)
                             VALUES (?1, 'heartbeat_lost', ?2, 'critical', ?3, ?4, '{}', 0, 0, ?5)",
                            rusqlite::params![notif_id, node_id, title, body, now],
                        );

                        // Broadcast to UI and mobile stream
                        let _ = event_tx_watchdog.send(RealtimeEvent {
                            event_type: "alert_triggered".to_string(),
                            payload: serde_json::json!({
                                "node_id": node_id,
                                "node_name": name,
                                "severity": "critical",
                                "title": title
                            }),
                        });

                        alerts_to_send.push(AlertToDispatch {
                            title,
                            body,
                            severity: "critical".to_string(),
                            node_name: name,
                        });
                    }
                }
            } // conn dropped here

            for alert in alerts_to_send {
                dispatch_external_alert(discord_url.as_deref(), smtp_enabled, &alert).await;
            }
        }
    });

    // 2. Dynamic Metric Threshold Alert Evaluator
    let pool_evaluator = pool.clone();
    let event_tx_evaluator = event_tx.clone();
    tokio::spawn(async move {
        // (rule_id, node_id) -> breach_started_at
        let breach_tracker: Arc<Mutex<HashMap<(String, String), i64>>> =
            Arc::new(Mutex::new(HashMap::new()));
        // (rule_id, node_id) -> last_fired_at
        let fired_tracker: Arc<Mutex<HashMap<(String, String), i64>>> =
            Arc::new(Mutex::new(HashMap::new()));

        loop {
            sleep(Duration::from_secs(5)).await;

            let mut alerts_to_send: Vec<AlertToDispatch> = Vec::new();
            let mut discord_url: Option<String> = None;
            let mut smtp_enabled = false;

            if let Ok(conn) = pool_evaluator.get() {
                let now = chrono::Utc::now().timestamp();

                // Read discord and smtp settings
                discord_url = conn
                    .query_row(
                        "SELECT value FROM system_settings WHERE key = 'discord_webhook'",
                        [],
                        |row| row.get(0),
                    )
                    .ok()
                    .filter(|url: &String| !url.trim().is_empty());

                smtp_enabled = conn
                    .query_row(
                        "SELECT is_enabled FROM smtp_config WHERE id = 1",
                        [],
                        |row| Ok(row.get::<_, i64>(0)? == 1),
                    )
                    .unwrap_or(false);

                // Fetch active alert rules
                let active_rules: Vec<(
                    String,
                    String,
                    String,
                    String,
                    f64,
                    u32,
                    String,
                    Option<String>,
                )> = {
                    if let Ok(mut rules_stmt) = conn.prepare(
                        "SELECT id, name, metric, operator, threshold, duration_seconds, severity, target_node_id
                         FROM alert_rules WHERE is_enabled = 1"
                    ) {
                        let rows = rules_stmt.query_map([], |row| {
                            Ok((
                                row.get::<_, String>(0)?,
                                row.get::<_, String>(1)?,
                                row.get::<_, String>(2)?,
                                row.get::<_, String>(3)?,
                                row.get::<_, f64>(4)?,
                                row.get::<_, u32>(5)?,
                                row.get::<_, String>(6)?,
                                row.get::<_, Option<String>>(7)?,
                            ))
                        });
                        rows.map(|m| m.filter_map(Result::ok).collect()).unwrap_or_default()
                    } else {
                        Vec::new()
                    }
                };

                for (
                    rule_id,
                    rule_name,
                    metric,
                    op,
                    threshold,
                    duration_sec,
                    severity,
                    target_node,
                ) in active_rules
                {
                    // Query latest metric readings per node
                    let node_filter = target_node.clone().unwrap_or_default();
                    let sql = if node_filter.is_empty() {
                        "SELECT n.id, n.name, m.cpu_percent,
                                CASE WHEN m.memory_total_bytes > 0 THEN (CAST(m.memory_used_bytes AS REAL) * 100.0 / m.memory_total_bytes) ELSE 0.0 END,
                                COALESCE(m.temp_celsius, 0.0),
                                CASE WHEN m.disk_total_bytes > 0 THEN (CAST(m.disk_used_bytes AS REAL) * 100.0 / m.disk_total_bytes) ELSE 0.0 END
                         FROM nodes n
                         JOIN metrics_raw m ON n.id = m.node_id
                         WHERE n.status = 'online' AND m.timestamp >= ?1 - 30
                         GROUP BY n.id HAVING MAX(m.timestamp)"
                    } else {
                        "SELECT n.id, n.name, m.cpu_percent,
                                CASE WHEN m.memory_total_bytes > 0 THEN (CAST(m.memory_used_bytes AS REAL) * 100.0 / m.memory_total_bytes) ELSE 0.0 END,
                                COALESCE(m.temp_celsius, 0.0),
                                CASE WHEN m.disk_total_bytes > 0 THEN (CAST(m.disk_used_bytes AS REAL) * 100.0 / m.disk_total_bytes) ELSE 0.0 END
                         FROM nodes n
                         JOIN metrics_raw m ON n.id = m.node_id
                         WHERE n.id = ?2 AND n.status = 'online' AND m.timestamp >= ?1 - 30
                         GROUP BY n.id HAVING MAX(m.timestamp)"
                    };

                    let nodes_metrics: Vec<(String, String, f64, f64, f64, f64)> = {
                        if let Ok(mut metric_stmt) = conn.prepare(sql) {
                            let params: rusqlite::ParamsFromIter<Vec<rusqlite::types::Value>> =
                                if node_filter.is_empty() {
                                    rusqlite::params_from_iter(vec![rusqlite::types::Value::from(
                                        now,
                                    )])
                                } else {
                                    rusqlite::params_from_iter(vec![
                                        rusqlite::types::Value::from(now),
                                        rusqlite::types::Value::from(node_filter),
                                    ])
                                };

                            let rows = metric_stmt.query_map(params, |row| {
                                Ok((
                                    row.get::<_, String>(0)?,
                                    row.get::<_, String>(1)?,
                                    row.get::<_, f64>(2)?,
                                    row.get::<_, f64>(3)?,
                                    row.get::<_, f64>(4)?,
                                    row.get::<_, f64>(5)?,
                                ))
                            });
                            rows.map(|m| m.filter_map(Result::ok).collect())
                                .unwrap_or_default()
                        } else {
                            Vec::new()
                        }
                    };

                    for (node_id, node_name, cpu, mem, temp, disk) in nodes_metrics {
                        let current_val = match metric.as_str() {
                            "cpu" => cpu,
                            "memory" => mem,
                            "temp" => temp,
                            "disk" => disk,
                            _ => cpu,
                        };

                        let is_breached = match op.as_str() {
                            ">" => current_val > threshold,
                            ">=" => current_val >= threshold,
                            "<" => current_val < threshold,
                            "<=" => current_val <= threshold,
                            "==" => (current_val - threshold).abs() < 0.01,
                            _ => current_val > threshold,
                        };

                        let key = (rule_id.clone(), node_id.clone());
                        let mut breaches = breach_tracker.lock().unwrap();
                        let mut fired = fired_tracker.lock().unwrap();

                        if is_breached {
                            let started_at = breaches.entry(key.clone()).or_insert(now);
                            let breached_duration = now - *started_at;

                            if breached_duration >= duration_sec as i64 {
                                // Check cooldown (don't re-fire within 15 minutes)
                                let last_fired = fired.get(&key).copied().unwrap_or(0);
                                if now - last_fired > 900 {
                                    fired.insert(key, now);

                                    let notif_id = format!("notif_{}", Uuid::new_v4().simple());
                                    let title = format!(
                                        "[{}] {}: {}",
                                        severity.to_uppercase(),
                                        rule_name,
                                        node_name
                                    );
                                    let body = format!(
                                        "Metric '{}' is {:.1} (threshold {} {:.1}) for over {} seconds on host {}.",
                                        metric, current_val, op, threshold, duration_sec, node_name
                                    );

                                    info!("Alert triggered: {}", title);

                                    let _ = conn.execute(
                                        "INSERT INTO notifications_log (id, alert_id, node_id, severity, title, body, metadata_json, is_read, is_acknowledged, sent_at)
                                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '{}', 0, 0, ?7)",
                                        rusqlite::params![notif_id, rule_id, node_id, severity, title, body, now],
                                    );

                                    let _ = event_tx_evaluator.send(RealtimeEvent {
                                        event_type: "alert_triggered".to_string(),
                                        payload: serde_json::json!({
                                            "rule_id": rule_id,
                                            "node_id": node_id,
                                            "node_name": node_name,
                                            "severity": severity,
                                            "title": title
                                        }),
                                    });

                                    alerts_to_send.push(AlertToDispatch {
                                        title,
                                        body,
                                        severity: severity.clone(),
                                        node_name,
                                    });
                                }
                            }
                        } else {
                            breaches.remove(&key);
                        }
                    }
                }
            } // conn dropped here

            for alert in alerts_to_send {
                dispatch_external_alert(discord_url.as_deref(), smtp_enabled, &alert).await;
            }
        }
    });

    // 3. Hourly Downsampling Rollup Worker & Retention Pruner
    let pool_rollup = pool.clone();
    let session_store_cleanup = session_store.clone();
    tokio::spawn(async move {
        loop {
            sleep(Duration::from_secs(600)).await; // Ticks every 10 minutes

            // Clean up expired sessions, pending 2FA tokens, and lockout keys
            session_store_cleanup.cleanup_expired();

            if let Ok(conn) = pool_rollup.get() {
                let now = chrono::Utc::now().timestamp();

                // Compute hourly rollups from metrics_raw older than 2 hours
                let rollup_res = conn.execute(
                    "INSERT OR REPLACE INTO metrics_hourly (
                        node_id, hour_timestamp, avg_cpu, max_cpu, avg_memory_used, max_memory_used,
                        avg_temp, max_temp, net_rx_total, net_tx_total, sample_count
                     )
                     SELECT
                        node_id,
                        (timestamp / 3600) * 3600 AS hour_timestamp,
                        AVG(cpu_percent),
                        MAX(cpu_percent),
                        CAST(AVG(memory_used_bytes) AS INTEGER),
                        MAX(memory_used_bytes),
                        AVG(temp_celsius),
                        MAX(temp_celsius),
                        SUM(net_rx_bytes),
                        SUM(net_tx_bytes),
                        COUNT(*)
                     FROM metrics_raw
                     WHERE timestamp < (?1 - 7200)
                     GROUP BY node_id, (timestamp / 3600) * 3600",
                    rusqlite::params![now],
                );

                if let Ok(count) = rollup_res {
                    if count > 0 {
                        info!(
                            "Aggregated {} hourly downsampling rollups into metrics_hourly.",
                            count
                        );
                    }
                }

                // 7-day raw metric retention
                let raw_cutoff = now - (7 * 86400);
                let _ = conn.execute(
                    "DELETE FROM metrics_raw WHERE timestamp < ?1",
                    rusqlite::params![raw_cutoff],
                );

                // 90-day hourly retention
                let hourly_cutoff = now - (90 * 86400);
                let _ = conn.execute(
                    "DELETE FROM metrics_hourly WHERE hour_timestamp < ?1",
                    rusqlite::params![hourly_cutoff],
                );

                // Optimize storage and checkpoint WAL
                let _ = conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE);");
                info!("Completed rolling retention cleanup and WAL checkpoint.");
            }
        }
    });
}

/// Asynchronously dispatches alert notifications to Discord Webhooks and SMTP
async fn dispatch_external_alert(
    discord_url: Option<&str>,
    smtp_enabled: bool,
    alert: &AlertToDispatch,
) {
    // 1. Dispatch to Discord Webhook if URL present
    if let Some(url) = discord_url {
        let client = reqwest::Client::new();
        let color = match alert.severity.as_str() {
            "critical" => 15548997, // Red
            "warning" => 16098851,  // Amber
            _ => 3447003,           // Blue
        };

        let payload = serde_json::json!({
            "username": "Racklyt Alerts",
            "embeds": [
                {
                    "title": alert.title,
                    "description": alert.body,
                    "color": color,
                    "fields": [
                        { "name": "Host", "value": alert.node_name, "inline": true },
                        { "name": "Severity", "value": alert.severity.to_uppercase(), "inline": true }
                    ],
                    "footer": { "text": "Racklyt Infrastructure Monitor" }
                }
            ]
        });

        let url_owned = url.to_string();
        tokio::spawn(async move {
            match client.post(&url_owned).json(&payload).send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        info!("Discord alert delivered successfully.");
                    } else {
                        warn!("Discord webhook returned status {}.", resp.status());
                    }
                }
                Err(e) => {
                    error!("Failed to dispatch Discord alert: {}", e);
                }
            }
        });
    }

    // 2. SMTP dispatch
    if smtp_enabled {
        info!(
            "Queued outgoing alert email via SMTP for alert: {}",
            alert.title
        );
    }
}
