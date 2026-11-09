use crate::{auth::AuthUser, db::DbPool};
use axum::{extract::Extension, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::info;

#[derive(Serialize)]
pub struct SetupStatusResponse {
    pub is_setup_completed: bool,
    pub node_count: i64,
    pub instance_name: String,
    pub fleet_domain: String,
}

pub async fn get_setup_status_handler(
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let is_completed_str: String = conn
        .query_row(
            "SELECT value FROM system_settings WHERE key = 'is_setup_completed'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "false".to_string());

    let instance_name: String = conn
        .query_row(
            "SELECT value FROM system_settings WHERE key = 'instance_name'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Racklyt".to_string());

    let fleet_domain: String = conn
        .query_row(
            "SELECT value FROM system_settings WHERE key = 'fleet_domain'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "homelab.lan".to_string());

    let node_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM nodes", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(Json(SetupStatusResponse {
        is_setup_completed: is_completed_str == "true",
        node_count,
        instance_name,
        fleet_domain,
    }))
}

#[derive(Deserialize)]
pub struct CompleteSetupPayload {
    pub instance_name: Option<String>,
    pub fleet_domain: Option<String>,
    pub admin_password: Option<String>,
    pub monitoring_focus: Option<String>,
}

pub async fn complete_setup_handler(
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<CompleteSetupPayload>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    // SEC-02 Hardening: Prevent unauthenticated takeover if setup was already completed
    let is_already_done: bool = conn
        .query_row(
            "SELECT value FROM system_settings WHERE key = 'is_setup_completed'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if is_already_done {
        return Err((
            StatusCode::FORBIDDEN,
            "Initial setup has already been completed",
        ));
    }

    let now = chrono::Utc::now().timestamp();

    // Mark setup completed
    let _ = conn.execute(
        "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('is_setup_completed', 'true', ?1)",
        rusqlite::params![now],
    );

    if let Some(ref name) = payload.instance_name {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('instance_name', ?1, ?2)",
            rusqlite::params![name, now],
        );
    }

    if let Some(ref domain) = payload.fleet_domain {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('fleet_domain', ?1, ?2)",
            rusqlite::params![domain, now],
        );
    }

    if let Some(ref focus) = payload.monitoring_focus {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('monitoring_focus', ?1, ?2)",
            rusqlite::params![focus, now],
        );
    }

    // Optional admin password update
    if let Some(ref new_pass) = payload.admin_password {
        if !new_pass.trim().is_empty() {
            if let Ok(hashed) = crate::auth::hash_password(new_pass) {
                let _ = conn.execute(
                    "UPDATE users SET password_hash = ?1, updated_at = ?2 WHERE username = 'admin'",
                    rusqlite::params![hashed, now],
                );
                info!("Updated SuperAdmin password during initial onboarding setup.");
            }
        }
    }

    info!("Initial setup completed successfully.");
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Initial onboarding setup completed."
    })))
}

pub async fn get_system_settings_handler(
    _user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM system_settings")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query error"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Read error"))?;

    let mut map = HashMap::new();
    for r in rows.flatten() {
        map.insert(r.0, r.1);
    }

    Ok(Json(map))
}

pub async fn update_system_settings_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
    Json(updates): Json<HashMap<String, String>>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("*") && !user.has_permission("alerts:configure") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    let now = chrono::Utc::now().timestamp();

    for (k, v) in updates {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![k, v, now],
        );
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn vacuum_database_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("*") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    conn.execute_batch(
        "PRAGMA wal_checkpoint(TRUNCATE);
         VACUUM;",
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Vacuum failed"))?;

    info!("Database vacuum and WAL truncation executed successfully.");
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Database successfully vacuumed and WAL pages checkpointed."
    })))
}

#[derive(Serialize)]
pub struct DatabaseStatsResponse {
    pub db_size_bytes: u64,
    pub wal_size_bytes: u64,
    pub metrics_count: i64,
    pub nodes_count: i64,
    pub alerts_count: i64,
    pub dashboards_count: i64,
}

pub async fn get_database_stats_handler(
    _user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let metrics_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM metrics_raw", [], |row| row.get(0))
        .unwrap_or(0);
    let nodes_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM nodes", [], |row| row.get(0))
        .unwrap_or(0);
    let alerts_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM notifications_log", [], |row| {
            row.get(0)
        })
        .unwrap_or(0);
    let dashboards_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM dashboards", [], |row| row.get(0))
        .unwrap_or(0);

    let db_path = std::env::var("RACKLYT_DB_PATH").unwrap_or_else(|_| "racklyt.db".to_string());
    let wal_path = format!("{}-wal", db_path);
    let db_size = std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);
    let wal_size = std::fs::metadata(&wal_path).map(|m| m.len()).unwrap_or(0);

    Ok(Json(DatabaseStatsResponse {
        db_size_bytes: db_size,
        wal_size_bytes: wal_size,
        metrics_count,
        nodes_count,
        alerts_count,
        dashboards_count,
    }))
}

#[derive(Deserialize)]
pub struct TestDiscordPayload {
    pub webhook_url: String,
    pub bot_name: Option<String>,
}

pub async fn test_discord_handler(
    user: AuthUser,
    Json(payload): Json<TestDiscordPayload>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("alerts:configure") && !user.has_permission("*") {
        return Err((
            StatusCode::FORBIDDEN,
            "Forbidden: alerts:configure permission required",
        ));
    }

    let url_trimmed = payload.webhook_url.trim();
    // SEC-05 Hardening: SSRF prevention - strictly allow only official Discord webhook endpoints over HTTPS
    if !url_trimmed.starts_with("https://discord.com/api/webhooks/")
        && !url_trimmed.starts_with("https://discordapp.com/api/webhooks/")
        && !url_trimmed.starts_with("https://canary.discord.com/api/webhooks/")
    {
        return Err((
            StatusCode::BAD_REQUEST,
            "Invalid Discord webhook URL. URL must start with https://discord.com/api/webhooks/",
        ));
    }

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "username": payload.bot_name.unwrap_or_else(|| "Racklyt Monitoring".to_string()),
        "content": "🔔 **Racklyt Test Alert**: Outgoing Discord notification channel is operational! Telemetry watchdogs are active."
    });

    let res = client
        .post(url_trimmed)
        .json(&body)
        .send()
        .await
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                "Failed to connect to Discord webhook",
            )
        })?;

    if res.status().is_success() {
        Ok(Json(serde_json::json!({
            "success": true,
            "message": "Discord test notification delivered successfully!"
        })))
    } else {
        Err((StatusCode::BAD_REQUEST, "Discord webhook rejected request"))
    }
}
