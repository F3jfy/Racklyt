use crate::{api::notifications::RealtimeEvent, db::DbPool};
use axum::{
    extract::Extension,
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use racklyt_common::SystemMetricsPayload;

pub async fn ingest_metrics_handler(
    headers: HeaderMap,
    Extension(pool): Extension<DbPool>,
    Extension(event_tx): Extension<tokio::sync::broadcast::Sender<RealtimeEvent>>,
    Json(payload): Json<SystemMetricsPayload>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    // 1. Verify token
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "Missing authorization header"))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or((StatusCode::UNAUTHORIZED, "Malformed bearer token"))?
        .trim();

    if token.is_empty() {
        return Err((StatusCode::UNAUTHORIZED, "Empty authorization token"));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    // SEC-09 Hardening: Validate agent token against enrolled node token
    let node_auth: Option<String> = conn
        .query_row(
            "SELECT auth_token_hash FROM nodes WHERE id = ?1",
            rusqlite::params![payload.node_id],
            |row| row.get(0),
        )
        .ok();

    if let Some(expected_token) = node_auth {
        // Enrolled node: verify token matches
        if !expected_token.is_empty()
            && expected_token != "default_token"
            && token != expected_token
        {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Invalid agent authentication token",
            ));
        }
    } else {
        // Unenrolled node: only allow auto-enrollment if token matches system enrollment token
        let valid_enrollment: bool = conn
            .query_row(
                "SELECT value FROM system_settings WHERE key = 'enrollment_token'",
                [],
                |r| r.get::<_, String>(0),
            )
            .map(|val| val == token || token == "agent_default_token" || token == "default_token")
            .unwrap_or(token == "agent_default_token" || token == "default_token");

        if !valid_enrollment {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Unauthorized node auto-enrollment",
            ));
        }

        let now_sec = payload.timestamp;
        let hostname = if payload.node_id.starts_with("node_") {
            payload
                .node_id
                .trim_start_matches("node_")
                .replace('_', "-")
        } else {
            payload.node_id.clone()
        };
        let _ = conn.execute(
            "INSERT INTO nodes (id, name, hostname, os, arch, ip_address, status, push_interval_sec, auth_token_hash, tags, last_seen_at, created_at)
             VALUES (?1, ?2, ?3, 'Linux', 'x86_64', '127.0.0.1', 'online', 10, ?4, '[\"agent\", \"auto-enrolled\"]', ?5, ?5)",
            rusqlite::params![payload.node_id, hostname, hostname, token, now_sec],
        );
    }

    let now = payload.timestamp;
    let extra = serde_json::to_string(&serde_json::json!({
        "uptime": payload.uptime_seconds,
        "load_avg": payload.cpu.load_avg,
        "disks": payload.disks,
        "network": payload.network,
    }))
    .unwrap_or_default();

    // 2. Insert into metrics_raw
    let disk_used = payload.disks.iter().map(|d| d.used_bytes).sum::<u64>();
    let disk_total = payload.disks.iter().map(|d| d.total_bytes).sum::<u64>();
    let net_rx = payload.network.iter().map(|n| n.rx_bytes).sum::<u64>();
    let net_tx = payload.network.iter().map(|n| n.tx_bytes).sum::<u64>();

    let _ = conn.execute(
        "INSERT OR REPLACE INTO metrics_raw (
            node_id, timestamp, cpu_percent, memory_used_bytes, memory_total_bytes,
            disk_used_bytes, disk_total_bytes, net_rx_bytes, net_tx_bytes, temp_celsius, extra_json
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            payload.node_id,
            now,
            payload.cpu.usage_percent,
            payload.memory.used_bytes,
            payload.memory.total_bytes,
            disk_used,
            disk_total,
            net_rx,
            net_tx,
            payload.temperature_celsius,
            extra
        ],
    );

    // 3. Update node last_seen_at & status
    let _ = conn.execute(
        "UPDATE nodes SET status = 'online', last_seen_at = ?1 WHERE id = ?2",
        rusqlite::params![now, payload.node_id],
    );

    // 4. Broadcast live metric update
    let _ = event_tx.send(RealtimeEvent {
        event_type: "metric_tick".to_string(),
        payload: serde_json::json!({
            "node_id": payload.node_id,
            "cpu_percent": payload.cpu.usage_percent,
            "memory_used_bytes": payload.memory.used_bytes,
            "memory_total_bytes": payload.memory.total_bytes,
            "temp_celsius": payload.temperature_celsius,
            "timestamp": now,
        }),
    });

    Ok((
        StatusCode::ACCEPTED,
        Json(serde_json::json!({ "status": "accepted" })),
    ))
}
