use crate::{
    auth::{verify_password, AuthUser, SessionStore},
    db::DbPool,
};
use axum::{
    extract::{Extension, Path},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use racklyt_common::LoginAuditEntry;
use serde::{Deserialize, Serialize};
use totp_rs::{Algorithm, Secret, Totp};

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub success: bool,
    pub token: String,
    pub user: AuthUserInfo,
}

#[derive(Serialize)]
pub struct AuthUserInfo {
    pub id: String,
    pub username: String,
    pub role_id: String,
    pub permissions: Vec<String>,
}

#[derive(Deserialize)]
pub struct TwoFactorVerifyRequest {
    pub temp_token: String,
    pub code: String,
}

fn extract_ip_and_ua(headers: &HeaderMap) -> (Option<String>, Option<String>) {
    let ip = headers
        .get("x-forwarded-for")
        .or_else(|| headers.get("cf-connecting-ip"))
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|h| h.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
        .or_else(|| Some("127.0.0.1".to_string()));

    let ua = headers
        .get(header::USER_AGENT)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    (ip, ua)
}

fn record_audit_log(
    conn: &rusqlite::Connection,
    user_id: Option<&str>,
    username: &str,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
    status: &str,
    failure_reason: Option<&str>,
) {
    let now = chrono::Utc::now().timestamp();
    let id = format!("audit_{}", uuid::Uuid::new_v4().simple());
    let _ = conn.execute(
        "INSERT INTO login_audit_log (id, user_id, username, ip_address, user_agent, status, failure_reason, attempted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, user_id, username, ip_address, user_agent, status, failure_reason, now],
    );
}

pub async fn login_handler(
    headers: HeaderMap,
    Extension(pool): Extension<DbPool>,
    Extension(session_store): Extension<SessionStore>,
    Json(payload): Json<LoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    let (ip, ua) = extract_ip_and_ua(&headers);
    let rate_limit_key = format!(
        "{}:{}",
        ip.as_deref().unwrap_or("127.0.0.1"),
        payload.username
    );

    // SEC-13 Hardening: Rate limiting against brute-force credential stuffing
    if session_store.is_rate_limited(&rate_limit_key) {
        record_audit_log(
            &conn,
            None,
            &payload.username,
            ip.as_deref(),
            ua.as_deref(),
            "rate_limited",
            Some("Exceeded 5 failed login attempts. Temporarily locked for 5 minutes."),
        );
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            "Too many failed login attempts. Please wait 5 minutes before trying again.",
        ));
    }

    let mut stmt = conn
        .prepare(
            "SELECT u.id, u.username, u.password_hash, u.role_id, r.permissions,
                    COALESCE(u.two_factor_enabled, 0), COALESCE(u.two_factor_enforced, 0), u.two_factor_secret
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.username = ?1 AND u.is_active = 1",
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query failed"))?;

    let user_res = stmt.query_row(rusqlite::params![payload.username], |row| {
        let id: String = row.get(0)?;
        let username: String = row.get(1)?;
        let hash: String = row.get(2)?;
        let role_id: String = row.get(3)?;
        let perms_json: String = row.get(4)?;
        let perms: Vec<String> = serde_json::from_str(&perms_json).unwrap_or_default();
        let two_factor_enabled: bool = row.get::<_, i64>(5)? == 1;
        let two_factor_enforced: bool = row.get::<_, i64>(6)? == 1;
        let two_factor_secret: Option<String> = row.get(7)?;
        Ok((
            id,
            username,
            hash,
            role_id,
            perms,
            two_factor_enabled,
            two_factor_enforced,
            two_factor_secret,
        ))
    });

    let (
        id,
        username,
        hash,
        role_id,
        perms,
        two_factor_enabled,
        two_factor_enforced,
        existing_secret,
    ) = match user_res {
        Ok(data) => data,
        Err(_) => {
            session_store.record_failed_attempt(&rate_limit_key);
            record_audit_log(
                &conn,
                None,
                &payload.username,
                ip.as_deref(),
                ua.as_deref(),
                "failed_credentials",
                Some("User does not exist or is inactive"),
            );
            return Err((StatusCode::UNAUTHORIZED, "Invalid username or password"));
        }
    };

    if !verify_password(&payload.password, &hash) {
        session_store.record_failed_attempt(&rate_limit_key);
        record_audit_log(
            &conn,
            Some(&id),
            &username,
            ip.as_deref(),
            ua.as_deref(),
            "failed_credentials",
            Some("Password mismatch"),
        );
        return Err((StatusCode::UNAUTHORIZED, "Invalid username or password"));
    }

    // Success - reset failed attempts
    session_store.reset_failed_attempts(&rate_limit_key);

    // Check if 2FA is globally enforced across all cluster accounts
    let global_enforce_2fa: bool = conn
        .query_row(
            "SELECT value FROM system_settings WHERE key = 'enforce_2fa'",
            [],
            |r| r.get::<_, String>(0),
        )
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let is_enforced = two_factor_enforced || global_enforce_2fa;

    // Case 1: 2FA is actively enabled on this account -> prompt for 6-digit challenge code
    if two_factor_enabled {
        let temp_token = session_store.create_pending_2fa(&id, false);
        record_audit_log(
            &conn,
            Some(&id),
            &username,
            ip.as_deref(),
            ua.as_deref(),
            "pending_2fa",
            Some("Awaiting 2FA challenge code"),
        );

        return Ok((
            HeaderMap::new(),
            Json(serde_json::json!({
                "status": "requires_2fa",
                "temp_token": temp_token,
                "username": username,
                "message": "Enter the 6-digit security code generated by your authenticator app."
            })),
        ));
    }

    // Case 2: 2FA is enforced (via global settings or admin policy) but not yet configured
    if is_enforced && !two_factor_enabled {
        let secret_str = match existing_secret {
            Some(s) if !s.is_empty() => s,
            _ => {
                let generated = Secret::generate();
                let encoded = generated.to_base32();
                let _ = conn.execute(
                    "UPDATE users SET two_factor_secret = ?1 WHERE id = ?2",
                    rusqlite::params![encoded, id],
                );
                encoded
            }
        };

        let temp_token = session_store.create_pending_2fa(&id, true);

        // Generate otpauth URL
        let otpauth_uri = format!(
            "otpauth://totp/Racklyt:{}?secret={}&issuer=Racklyt",
            username, secret_str
        );

        record_audit_log(
            &conn,
            Some(&id),
            &username,
            ip.as_deref(),
            ua.as_deref(),
            "pending_2fa_setup",
            Some("Prompted for mandatory 2FA enrollment"),
        );

        return Ok((
            HeaderMap::new(),
            Json(serde_json::json!({
                "status": "requires_2fa_setup",
                "temp_token": temp_token,
                "totp_secret": secret_str,
                "otpauth_uri": otpauth_uri,
                "username": username,
                "message": "Two-phase authentication is required. Add this key to your authenticator app and enter the 6-digit code."
            })),
        ));
    }

    // Case 3: 2FA not enforced (e.g. system superadmin before manual setup)
    let (token, _session_id) = session_store.create_session(&id);
    let mut headers_resp = HeaderMap::new();
    let cookie_val = format!(
        "racklyt_session={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}",
        token,
        7 * 86400
    );
    headers_resp.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie_val).unwrap(),
    );

    record_audit_log(
        &conn,
        Some(&id),
        &username,
        ip.as_deref(),
        ua.as_deref(),
        "success",
        None,
    );

    let resp = AuthResponse {
        success: true,
        token: token.clone(),
        user: AuthUserInfo {
            id,
            username,
            role_id,
            permissions: perms,
        },
    };

    Ok((headers_resp, Json(serde_json::to_value(resp).unwrap())))
}

/// Verify 2-Phase authentication code during login
#[allow(deprecated)]
pub async fn two_factor_verify_handler(
    headers: HeaderMap,
    Extension(pool): Extension<DbPool>,
    Extension(session_store): Extension<SessionStore>,
    Json(payload): Json<TwoFactorVerifyRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
    })?;
    let (ip, ua) = extract_ip_and_ua(&headers);

    let (user_id, is_setup) = session_store
        .consume_pending_2fa(&payload.temp_token)
        .ok_or((StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Expired or invalid 2-phase challenge token. Please log in again." }))))?;

    // Query user and secret
    let mut stmt = conn
        .prepare("SELECT u.id, u.username, u.role_id, r.permissions, u.two_factor_secret FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?1")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Query error" }))))?;

    let (id, username, role_id, perms, secret_opt) = stmt
        .query_row(rusqlite::params![user_id], |row| {
            let id: String = row.get(0)?;
            let username: String = row.get(1)?;
            let role_id: String = row.get(2)?;
            let perms_json: String = row.get(3)?;
            let perms: Vec<String> = serde_json::from_str(&perms_json).unwrap_or_default();
            let sec: Option<String> = row.get(4)?;
            Ok((id, username, role_id, perms, sec))
        })
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "User not found" })),
            )
        })?;

    let secret_base32 = secret_opt.ok_or((
        StatusCode::BAD_REQUEST,
        Json(serde_json::json!({ "error": "No 2FA secret found on user account" })),
    ))?;

    // Build TOTP instance
    let secret = Secret::try_from_base32(&secret_base32).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Failed decoding secret" })),
        )
    })?;

    let totp = Totp::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret.to_bytes().unwrap(),
        Some("Racklyt".to_string()),
        username.clone(),
    )
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Failed initializing TOTP validator" })),
        )
    })?;

    let clean_code = payload.code.trim().replace(' ', "");
    let is_valid = totp.check_current(&clean_code).is_some();

    if !is_valid {
        record_audit_log(
            &conn,
            Some(&id),
            &username,
            ip.as_deref(),
            ua.as_deref(),
            "failed_2fa",
            Some("Invalid 6-digit TOTP code provided"),
        );
        return Err((
            StatusCode::BAD_REQUEST,
            Json(
                serde_json::json!({ "error": "Invalid verification code. Please check your authenticator clock and try again." }),
            ),
        ));
    }

    // Success! If this was initial setup, mark two_factor_enabled = 1
    if is_setup {
        let _ = conn.execute(
            "UPDATE users SET two_factor_enabled = 1, updated_at = ?1 WHERE id = ?2",
            rusqlite::params![chrono::Utc::now().timestamp(), id],
        );
    }

    let (token, _session_id) = session_store.create_session(&id);

    let mut resp_headers = HeaderMap::new();
    let cookie_val = format!(
        "racklyt_session={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}",
        token,
        7 * 86400
    );
    resp_headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie_val).unwrap(),
    );

    record_audit_log(
        &conn,
        Some(&id),
        &username,
        ip.as_deref(),
        ua.as_deref(),
        "success",
        Some(if is_setup {
            "Completed mandatory first-login 2FA setup"
        } else {
            "Authenticated with 2FA"
        }),
    );

    Ok((
        resp_headers,
        Json(serde_json::json!({
            "success": true,
            "token": token,
            "user": {
                "id": id,
                "username": username,
                "role_id": role_id,
                "permissions": perms
            }
        })),
    ))
}

#[derive(Deserialize)]
pub struct ReEnrollRequest {
    pub temp_token: String,
}

/// Allows user to switch to 2FA enrollment mode from challenge mode if they haven't set up TOTP yet
pub async fn two_factor_re_enroll_handler(
    headers: HeaderMap,
    Extension(pool): Extension<DbPool>,
    Extension(session_store): Extension<SessionStore>,
    Json(payload): Json<ReEnrollRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let (ip, ua) = extract_ip_and_ua(&headers);

    let (user_id, is_setup) = session_store
        .consume_pending_2fa(&payload.temp_token)
        .ok_or((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Invalid or expired temporary session" })),
        ))?;

    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
    })?;

    let (username, two_factor_enabled): (String, bool) = conn
        .query_row(
            "SELECT username, COALESCE(two_factor_enabled, 0) == 1 FROM users WHERE id = ?1",
            rusqlite::params![user_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "User not found" })),
            )
        })?;

    // SEC-03 Hardening: If 2FA is already enabled on this account, disallow resetting the secret using temp_token!
    if two_factor_enabled || !is_setup {
        record_audit_log(
            &conn,
            Some(&user_id),
            &username,
            ip.as_deref(),
            ua.as_deref(),
            "unauthorized_2fa_reset",
            Some("Attempted to bypass 2FA via re-enrollment on already-enrolled account"),
        );
        return Err((
            StatusCode::FORBIDDEN,
            Json(
                serde_json::json!({ "error": "Two-factor authentication is already active on this account. Re-enrollment requires an authenticated administrator session." }),
            ),
        ));
    }

    // Generate fresh secret
    let generated = Secret::generate();
    let secret_str = generated.to_base32();

    conn.execute(
        "UPDATE users SET two_factor_secret = ?1, two_factor_enabled = 0, updated_at = unixepoch() WHERE id = ?2",
        rusqlite::params![secret_str, user_id],
    )
    .map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed updating 2FA secret" })))
    })?;

    // Create new temp_token with is_setup = true
    let new_temp_token = session_store.create_pending_2fa(&user_id, true);

    let otpauth_uri = format!(
        "otpauth://totp/Racklyt:{}?secret={}&issuer=Racklyt",
        username, secret_str
    );

    record_audit_log(
        &conn,
        Some(&user_id),
        &username,
        ip.as_deref(),
        ua.as_deref(),
        "pending_2fa_setup",
        Some("Re-initiated 2FA enrollment setup"),
    );

    Ok(Json(serde_json::json!({
        "status": "requires_2fa_setup",
        "temp_token": new_temp_token,
        "totp_secret": secret_str,
        "otpauth_uri": otpauth_uri,
        "username": username,
        "message": "Two-phase authentication setup ready. Scan the QR code or enter the key in your authenticator app."
    })))
}

pub async fn logout_handler(
    _user: AuthUser,
    Extension(session_store): Extension<SessionStore>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Some(cookie) = headers.get(header::COOKIE) {
        if let Ok(c_str) = cookie.to_str() {
            for part in c_str.split(';') {
                if let Some(tok) = part.trim().strip_prefix("racklyt_session=") {
                    session_store.remove_session(tok);
                }
            }
        }
    }

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_static("racklyt_session=; Path=/; HttpOnly; Max-Age=0"),
    );

    (resp_headers, Json(serde_json::json!({ "success": true })))
}

pub async fn me_handler(user: AuthUser) -> impl IntoResponse {
    Json(serde_json::json!({
        "id": user.id,
        "username": user.username,
        "role_id": user.role_id,
        "permissions": user.permissions,
        "scopes": user.scopes
    }))
}

/// Admin Audit Log: View recent login history across the fleet
pub async fn audit_log_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("*") && !user.has_permission("users:manage") {
        return Err((
            StatusCode::FORBIDDEN,
            "Forbidden: requires administrator permissions",
        ));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, username, ip_address, user_agent, status, failure_reason, attempted_at
             FROM login_audit_log
             ORDER BY attempted_at DESC LIMIT 100",
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query error"))?;

    let entries = stmt
        .query_map([], |row| {
            Ok(LoginAuditEntry {
                id: row.get(0)?,
                user_id: row.get(1)?,
                username: row.get(2)?,
                ip_address: row.get(3)?,
                user_agent: row.get(4)?,
                status: row.get(5)?,
                failure_reason: row.get(6)?,
                attempted_at: row.get(7)?,
            })
        })
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Read error"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    Ok(Json(entries))
}

#[derive(Serialize)]
pub struct ActiveSessionInfo {
    pub session_id: String,
    pub token_snippet: String,
    pub user_id: String,
    pub username: String,
    pub expires_at: i64,
}

/// Admin Active Sessions: View all currently active authenticated sessions
pub async fn active_sessions_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
    Extension(session_store): Extension<SessionStore>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("*") && !user.has_permission("users:manage") {
        return Err((
            StatusCode::FORBIDDEN,
            "Forbidden: requires administrator permissions",
        ));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;
    let raw_sessions = session_store.list_active_sessions();

    let mut result = Vec::new();
    for (sid, snippet, uid, exp) in raw_sessions {
        let username: String = conn
            .query_row(
                "SELECT username FROM users WHERE id = ?1",
                rusqlite::params![uid],
                |r| r.get(0),
            )
            .unwrap_or_else(|_| "Unknown".to_string());

        result.push(ActiveSessionInfo {
            session_id: sid,
            token_snippet: snippet,
            user_id: uid,
            username,
            expires_at: exp,
        });
    }

    Ok(Json(result))
}

/// Admin Revoke Session: Immediately terminate an active session
pub async fn revoke_session_handler(
    user: AuthUser,
    Path(token_or_id): Path<String>,
    Extension(session_store): Extension<SessionStore>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("*") && !user.has_permission("users:manage") {
        return Err((
            StatusCode::FORBIDDEN,
            "Forbidden: requires administrator permissions",
        ));
    }

    session_store.remove_session(&token_or_id);
    Ok(Json(
        serde_json::json!({ "success": true, "message": "Session revoked successfully" }),
    ))
}

#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    pub old_password: String,
    pub new_password: String,
}

/// Change password handler - checks if password is locked by admin policy
pub async fn change_password_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database pool failure" })),
        )
    })?;

    // Check if user has password_locked = 1
    let (password_hash, password_locked): (String, i64) = conn
        .query_row(
            "SELECT password_hash, COALESCE(password_locked, 1) FROM users WHERE id = ?1",
            rusqlite::params![user.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "User record not found" })),
            )
        })?;

    if password_locked == 1 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "Security Policy Enforcement: Passwords generated by administrator are cryptographically locked and cannot be changed by the user."
            })),
        ));
    }

    // Verify old password
    if !verify_password(&payload.old_password, &password_hash) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Current password does not match" })),
        ));
    }

    // Hash new password
    let new_hash = crate::auth::hash_password(&payload.new_password).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Password hashing failed" })),
        )
    })?;
    conn.execute(
        "UPDATE users SET password_hash = ?1, updated_at = unixepoch() WHERE id = ?2",
        rusqlite::params![new_hash, user.id],
    )
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Failed updating password" })),
        )
    })?;

    Ok(Json(
        serde_json::json!({ "success": true, "message": "Password changed successfully" }),
    ))
}

/// Get 2FA status for the current authenticated user
pub async fn get_2fa_status_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
    })?;

    let (enabled, has_secret): (i64, Option<String>) = conn
        .query_row(
            "SELECT COALESCE(two_factor_enabled, 0), two_factor_secret FROM users WHERE id = ?1",
            rusqlite::params![user.id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "User not found" })),
            )
        })?;

    Ok(Json(serde_json::json!({
        "enabled": enabled == 1,
        "configured": has_secret.is_some() && !has_secret.unwrap().is_empty(),
    })))
}

/// Initiate 2FA enrollment for current user from Settings
pub async fn setup_2fa_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
    })?;

    let generated = Secret::generate();
    let secret_str = generated.to_base32();

    conn.execute(
        "UPDATE users SET two_factor_secret = ?1, updated_at = unixepoch() WHERE id = ?2",
        rusqlite::params![secret_str, user.id],
    )
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Failed updating 2FA secret" })),
        )
    })?;

    let otpauth_uri = format!(
        "otpauth://totp/Racklyt:{}?secret={}&issuer=Racklyt",
        user.username, secret_str
    );

    Ok(Json(serde_json::json!({
        "totp_secret": secret_str,
        "otpauth_uri": otpauth_uri,
    })))
}

#[derive(Deserialize)]
pub struct Enable2FARequest {
    pub code: String,
}

/// Verify 6-digit code and activate 2FA for current user
#[allow(deprecated)]
pub async fn enable_2fa_handler(
    user: AuthUser,
    headers: HeaderMap,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<Enable2FARequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let (ip, ua) = extract_ip_and_ua(&headers);
    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
    })?;

    let secret_opt: Option<String> = conn
        .query_row(
            "SELECT two_factor_secret FROM users WHERE id = ?1",
            rusqlite::params![user.id],
            |r| r.get(0),
        )
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "User not found" })),
            )
        })?;

    let secret_str = secret_opt.ok_or((
        StatusCode::BAD_REQUEST,
        Json(serde_json::json!({ "error": "No 2FA setup in progress. Please click Setup first." })),
    ))?;

    let secret = Secret::try_from_base32(&secret_str).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Failed decoding secret" })),
        )
    })?;

    let totp = Totp::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret.to_bytes().unwrap(),
        Some("Racklyt".to_string()),
        user.username.clone(),
    )
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Failed initializing TOTP" })),
        )
    })?;

    let clean_code = payload.code.trim().replace(' ', "");
    if totp.check_current(&clean_code).is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(
                serde_json::json!({ "error": "Invalid verification code. Please check the current code on your authenticator app." }),
            ),
        ));
    }

    conn.execute(
        "UPDATE users SET two_factor_enabled = 1, two_factor_enforced = 1, updated_at = unixepoch() WHERE id = ?1",
        rusqlite::params![user.id],
    )
    .map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed activating 2FA" })))
    })?;

    record_audit_log(
        &conn,
        Some(&user.id),
        &user.username,
        ip.as_deref(),
        ua.as_deref(),
        "success",
        Some("User enabled Two-Phase Authentication in Settings"),
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Two-phase authentication successfully activated on your account."
    })))
}

#[derive(Deserialize)]
pub struct Disable2FARequest {
    pub password: Option<String>,
}

/// Disable 2FA for current user
pub async fn disable_2fa_handler(
    user: AuthUser,
    headers: HeaderMap,
    Extension(pool): Extension<DbPool>,
    Json(_payload): Json<Disable2FARequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let (ip, ua) = extract_ip_and_ua(&headers);
    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
    })?;

    conn.execute(
        "UPDATE users SET two_factor_enabled = 0, two_factor_enforced = 0, two_factor_secret = NULL, updated_at = unixepoch() WHERE id = ?1",
        rusqlite::params![user.id],
    )
    .map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed disabling 2FA" })))
    })?;

    record_audit_log(
        &conn,
        Some(&user.id),
        &user.username,
        ip.as_deref(),
        ua.as_deref(),
        "success",
        Some("User disabled Two-Phase Authentication in Settings"),
    );

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Two-phase authentication disabled."
    })))
}
