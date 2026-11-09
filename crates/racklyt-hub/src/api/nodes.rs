use crate::{auth::AuthUser, db::DbPool};
use axum::{
    extract::{Extension, Path},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use racklyt_common::{Node, NodeStatus};
use serde::Serialize;

#[derive(Serialize)]
pub struct NodeDetails {
    pub node: Node,
    pub latest_metrics: Option<serde_json::Value>,
}

#[derive(Serialize)]
pub struct NodeWithMetrics {
    #[serde(flatten)]
    pub node: Node,
    pub latest_metrics: Option<serde_json::Value>,
}

pub async fn list_nodes_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, hostname, os, arch, ip_address, status, push_interval_sec, tags, last_seen_at, created_at
             FROM nodes",
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query failed"))?;

    let nodes = stmt
        .query_map([], |row| {
            let status_str: String = row.get(6)?;
            let status = match status_str.as_str() {
                "online" => NodeStatus::Online,
                "degraded" => NodeStatus::Degraded,
                _ => NodeStatus::Offline,
            };

            let tags_json: String = row.get(8)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            Ok(Node {
                id: row.get(0)?,
                name: row.get(1)?,
                hostname: row.get(2)?,
                os: row.get(3)?,
                arch: row.get(4)?,
                ip_address: row.get(5)?,
                status,
                push_interval_sec: row.get(7)?,
                tags,
                last_seen_at: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read nodes"))?
        .filter_map(Result::ok)
        .filter(|node| user.can_access_node(&node.id, &node.tags))
        .collect::<Vec<_>>();

    // Fetch latest metric snapshots for each node
    let mut metrics_map = std::collections::HashMap::new();
    if let Ok(mut metric_stmt) = conn.prepare(
        "SELECT node_id, cpu_percent, memory_used_bytes, memory_total_bytes, disk_used_bytes, disk_total_bytes, net_rx_bytes, net_tx_bytes, temp_celsius, timestamp
         FROM metrics_raw
         WHERE (node_id, timestamp) IN (
             SELECT node_id, MAX(timestamp) FROM metrics_raw GROUP BY node_id
         )",
    ) {
        if let Ok(rows) = metric_stmt.query_map([], |row| {
            let node_id: String = row.get(0)?;
            let val = serde_json::json!({
                "cpu_percent": row.get::<_, f64>(1)?,
                "memory_used_bytes": row.get::<_, i64>(2)?,
                "memory_total_bytes": row.get::<_, i64>(3)?,
                "disk_used_bytes": row.get::<_, i64>(4)?,
                "disk_total_bytes": row.get::<_, i64>(5)?,
                "net_rx_bytes": row.get::<_, i64>(6)?,
                "net_tx_bytes": row.get::<_, i64>(7)?,
                "temp_celsius": row.get::<_, Option<f64>>(8)?,
                "timestamp": row.get::<_, i64>(9)?,
            });
            Ok((node_id, val))
        }) {
            for r in rows.flatten() {
                metrics_map.insert(r.0, r.1);
            }
        }
    }

    let enriched: Vec<NodeWithMetrics> = nodes
        .into_iter()
        .map(|node| {
            let latest = metrics_map.remove(&node.id);
            NodeWithMetrics {
                node,
                latest_metrics: latest,
            }
        })
        .collect();

    Ok(Json(enriched))
}

pub async fn get_node_handler(
    user: AuthUser,
    Path(node_id): Path<String>,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, hostname, os, arch, ip_address, status, push_interval_sec, tags, last_seen_at, created_at
             FROM nodes WHERE id = ?1",
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query failed"))?;

    let node = stmt
        .query_row(rusqlite::params![node_id], |row| {
            let status_str: String = row.get(6)?;
            let status = match status_str.as_str() {
                "online" => NodeStatus::Online,
                "degraded" => NodeStatus::Degraded,
                _ => NodeStatus::Offline,
            };
            let tags_json: String = row.get(8)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            Ok(Node {
                id: row.get(0)?,
                name: row.get(1)?,
                hostname: row.get(2)?,
                os: row.get(3)?,
                arch: row.get(4)?,
                ip_address: row.get(5)?,
                status,
                push_interval_sec: row.get(7)?,
                tags,
                last_seen_at: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|_| (StatusCode::NOT_FOUND, "Node not found"))?;

    if !user.can_access_node(&node.id, &node.tags) {
        return Err((StatusCode::FORBIDDEN, "Access to node forbidden"));
    }

    // Get latest metric snapshot
    let mut metric_stmt = conn
        .prepare(
            "SELECT cpu_percent, memory_used_bytes, memory_total_bytes, disk_used_bytes, disk_total_bytes, net_rx_bytes, net_tx_bytes, temp_celsius, timestamp
             FROM metrics_raw WHERE node_id = ?1 ORDER BY timestamp DESC LIMIT 1",
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Metrics query failed"))?;

    let latest = metric_stmt
        .query_row(rusqlite::params![node_id], |row| {
            Ok(serde_json::json!({
                "cpu_percent": row.get::<_, f64>(0)?,
                "memory_used_bytes": row.get::<_, i64>(1)?,
                "memory_total_bytes": row.get::<_, i64>(2)?,
                "disk_used_bytes": row.get::<_, i64>(3)?,
                "disk_total_bytes": row.get::<_, i64>(4)?,
                "net_rx_bytes": row.get::<_, i64>(5)?,
                "net_tx_bytes": row.get::<_, i64>(6)?,
                "temp_celsius": row.get::<_, Option<f64>>(7)?,
                "timestamp": row.get::<_, i64>(8)?,
            }))
        })
        .ok();

    Ok(Json(NodeDetails {
        node,
        latest_metrics: latest,
    }))
}

pub async fn delete_node_handler(
    user: AuthUser,
    Path(node_id): Path<String>,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("nodes:delete") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    let rows = conn
        .execute(
            "DELETE FROM nodes WHERE id = ?1",
            rusqlite::params![node_id],
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;

    if rows == 0 {
        return Err((StatusCode::NOT_FOUND, "Node not found"));
    }

    // Clean up metrics
    let _ = conn.execute(
        "DELETE FROM metrics_raw WHERE node_id = ?1",
        rusqlite::params![node_id],
    );

    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(serde::Deserialize)]
pub struct SpawnTestNodePayload {
    pub name: Option<String>,
    pub os: Option<String>,
    pub tags: Option<Vec<String>>,
}

pub async fn spawn_test_node_handler(
    _user: AuthUser,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<SpawnTestNodePayload>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    let now = chrono::Utc::now().timestamp();
    let rand_suffix = uuid::Uuid::new_v4().to_string();
    let short_id = &rand_suffix[..6];

    let node_id = format!("node_{}", short_id);
    let name = payload
        .name
        .unwrap_or_else(|| format!("node-fleet-{}", short_id));
    let hostname = format!("{}.lan", name);
    let os = payload
        .os
        .unwrap_or_else(|| "Linux (Debian 12)".to_string());
    let tags = serde_json::to_string(
        &payload
            .tags
            .unwrap_or_else(|| vec!["server".to_string(), "local".to_string()]),
    )
    .unwrap_or_default();

    conn.execute(
        "INSERT INTO nodes (id, name, hostname, os, arch, ip_address, status, push_interval_sec, auth_token_hash, tags, last_seen_at, created_at)
         VALUES (?1, ?2, ?3, ?4, 'x86_64', '192.168.1.42', 'online', 10, 'default_token', ?5, ?6, ?6)",
        rusqlite::params![node_id, name, hostname, os, tags, now],
    ).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create node"))?;

    // Seed initial metrics
    conn.execute(
        "INSERT INTO metrics_raw (node_id, timestamp, cpu_percent, memory_used_bytes, memory_total_bytes, disk_used_bytes, disk_total_bytes, net_rx_bytes, net_tx_bytes, temp_celsius, extra_json)
         VALUES (?1, ?2, 21.4, 3865470566, 17179869184, 45097156608, 257698037760, 482344960, 214958080, 42.0, '{}')",
        rusqlite::params![node_id, now],
    ).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to seed metrics"))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "node_id": node_id,
        "name": name,
        "message": "Node successfully spawned and connected."
    })))
}
