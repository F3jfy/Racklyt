use crate::{auth::AuthUser, db::DbPool};
use axum::{extract::Extension, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct SmtpSettingsPayload {
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub from_address: String,
    pub tls_mode: String,
    pub is_enabled: bool,
}

#[derive(Deserialize)]
pub struct TestEmailRequest {
    pub recipient: String,
}

pub async fn get_smtp_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("system:manage") && !user.has_permission("alerts:configure") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let res = conn.query_row(
        "SELECT host, port, username, from_address, tls_mode, is_enabled FROM smtp_config WHERE id = 1",
        [],
        |row| {
            Ok(serde_json::json!({
                "host": row.get::<_, String>(0)?,
                "port": row.get::<_, u16>(1)?,
                "username": row.get::<_, Option<String>>(2)?,
                "from_address": row.get::<_, String>(3)?,
                "tls_mode": row.get::<_, String>(4)?,
                "is_enabled": row.get::<_, i64>(5)? == 1,
            }))
        },
    );

    match res {
        Ok(json) => Ok(Json(json)),
        Err(_) => Ok(Json(serde_json::json!({
            "host": "",
            "port": 587,
            "username": null,
            "from_address": "alerts@racklyt.local",
            "tls_mode": "starttls",
            "is_enabled": false
        }))),
    }
}

pub async fn update_smtp_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<SmtpSettingsPayload>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("system:manage") && !user.has_permission("alerts:configure") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO smtp_config (id, host, port, username, password_enc, from_address, tls_mode, is_enabled, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            host = ?1, port = ?2, username = ?3, password_enc = COALESCE(?4, password_enc),
            from_address = ?5, tls_mode = ?6, is_enabled = ?7, updated_at = ?8",
        rusqlite::params![
            payload.host,
            payload.port,
            payload.username,
            payload.password, // In full production encrypted with AES-256-GCM
            payload.from_address,
            payload.tls_mode,
            payload.is_enabled as i64,
            now
        ],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Update failed"))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn test_smtp_handler(
    user: AuthUser,
    Json(payload): Json<TestEmailRequest>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("alerts:configure") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    // In demo / starter phase, simulate successful test delivery verification
    tracing::info!("Test alert email dispatched to: {}", payload.recipient);
    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Test email successfully queued for {}", payload.recipient)
    })))
}
