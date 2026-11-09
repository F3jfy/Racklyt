use crate::{
    auth::{hash_password, AuthUser},
    db::DbPool,
};
use axum::{
    extract::{Extension, Path},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use racklyt_common::{ResourceScope, Role, User};
use rand::{seq::SliceRandom, Rng};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: Option<String>,
    pub email: Option<String>,
    pub role_id: String,
    pub allowed_nodes: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct UpdateScopesRequest {
    pub allowed_nodes: Vec<String>,
}

#[derive(Serialize)]
pub struct CreateUserResponse {
    pub success: bool,
    pub user: User,
    pub generated_password: String,
    pub message: String,
}

fn generate_secure_password() -> String {
    const CHARSET_UPPER: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";
    const CHARSET_LOWER: &[u8] = b"abcdefghijkmnopqrstuvwxyz";
    const CHARSET_DIGITS: &[u8] = b"23456789";
    const CHARSET_SYMBOLS: &[u8] = b"!@#$%^&*-_+=";
    const CHARSET_ALL: &[u8] =
        b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_+=";

    let mut rng = rand::thread_rng();
    let mut password = Vec::with_capacity(18);

    password.push(CHARSET_UPPER[rng.gen_range(0..CHARSET_UPPER.len())] as char);
    password.push(CHARSET_UPPER[rng.gen_range(0..CHARSET_UPPER.len())] as char);
    password.push(CHARSET_LOWER[rng.gen_range(0..CHARSET_LOWER.len())] as char);
    password.push(CHARSET_LOWER[rng.gen_range(0..CHARSET_LOWER.len())] as char);
    password.push(CHARSET_DIGITS[rng.gen_range(0..CHARSET_DIGITS.len())] as char);
    password.push(CHARSET_DIGITS[rng.gen_range(0..CHARSET_DIGITS.len())] as char);
    password.push(CHARSET_SYMBOLS[rng.gen_range(0..CHARSET_SYMBOLS.len())] as char);
    password.push(CHARSET_SYMBOLS[rng.gen_range(0..CHARSET_SYMBOLS.len())] as char);

    while password.len() < 18 {
        password.push(CHARSET_ALL[rng.gen_range(0..CHARSET_ALL.len())] as char);
    }

    password.shuffle(&mut rng);
    password.into_iter().collect()
}

pub async fn list_users_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("users:manage") && !user.has_permission("*") {
        return Err((
            StatusCode::FORBIDDEN,
            "Forbidden: requires users:manage permission",
        ));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, username, email, role_id, is_active,
                    COALESCE(password_locked, 1), COALESCE(two_factor_enabled, 0),
                    COALESCE(two_factor_enforced, 1), initial_generated_password,
                    created_at, updated_at
             FROM users",
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query failed"))?;

    let user_rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let username: String = row.get(1)?;
            let email: Option<String> = row.get(2)?;
            let role_id: String = row.get(3)?;
            let is_active: bool = row.get::<_, i64>(4)? == 1;
            let password_locked: bool = row.get::<_, i64>(5)? == 1;
            let two_factor_enabled: bool = row.get::<_, i64>(6)? == 1;
            let two_factor_enforced: bool = row.get::<_, i64>(7)? == 1;
            let initial_generated_password: Option<String> = row.get(8)?;
            let created_at: i64 = row.get(9)?;
            let updated_at: i64 = row.get(10)?;

            Ok((
                id,
                username,
                email,
                role_id,
                is_active,
                password_locked,
                two_factor_enabled,
                two_factor_enforced,
                initial_generated_password,
                created_at,
                updated_at,
            ))
        })
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read users"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    let mut users = Vec::new();
    for u in user_rows {
        // Query scopes for this user
        let mut scope_stmt = conn
            .prepare("SELECT scope_type, scope_value FROM user_resource_scopes WHERE user_id = ?1")
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Scopes query failed"))?;

        let scopes = scope_stmt
            .query_map(rusqlite::params![u.0], |srow| {
                let stype: String = srow.get(0)?;
                let sval: String = srow.get(1)?;
                let sc = match stype.as_str() {
                    "node" => ResourceScope::Node(sval),
                    "cluster" => ResourceScope::Cluster(sval),
                    "tag" => ResourceScope::Tag(sval),
                    _ => ResourceScope::Global,
                };
                Ok(sc)
            })
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Scopes read failed"))?
            .filter_map(Result::ok)
            .collect();

        users.push(User {
            id: u.0,
            username: u.1,
            email: u.2,
            role_id: u.3,
            is_active: u.4,
            password_locked: u.5,
            two_factor_enabled: u.6,
            two_factor_enforced: u.7,
            initial_generated_password: None, // SEC-06 Hardening: Never leak passwords in user listings
            scopes,
            created_at: u.9,
            updated_at: u.10,
        });
    }

    Ok(Json(users))
}

pub async fn create_user_handler(
    user: AuthUser,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    if !user.has_permission("users:manage") && !user.has_permission("*") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Forbidden" })),
        ));
    }

    // Auto-generate high-security password if not explicitly supplied
    let raw_password = match payload.password {
        Some(p) if !p.trim().is_empty() => p,
        _ => generate_secure_password(),
    };

    let hash = hash_password(&raw_password).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e })),
        )
    })?;

    let new_id = format!("user_{}", Uuid::new_v4().simple());
    let now = chrono::Utc::now().timestamp();

    let conn = pool.get().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Database error" })),
        )
    })?;

    // SEC-06 Hardening: Never store plaintext passwords in persistent database columns
    let empty_initial_pass: Option<String> = None;
    conn.execute(
        "INSERT INTO users (id, username, email, password_hash, role_id, is_active, password_locked, two_factor_enabled, two_factor_enforced, initial_generated_password, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 1, 1, 0, 0, ?6, ?7, ?7)",
        rusqlite::params![new_id, payload.username, payload.email, hash, payload.role_id, empty_initial_pass, now],
    )
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": format!("Failed to create user: {}", e) }))))?;

    // Insert node scopes
    let mut scopes = Vec::new();
    if let Some(nodes) = payload.allowed_nodes {
        if nodes.is_empty() || nodes.iter().any(|n| n == "*" || n == "global") {
            let _ = conn.execute(
                "INSERT INTO user_resource_scopes (id, user_id, scope_type, scope_value) VALUES (?1, ?2, 'global', '*')",
                rusqlite::params![Uuid::new_v4().to_string(), new_id],
            );
            scopes.push(ResourceScope::Global);
        } else {
            for node_id in nodes {
                let _ = conn.execute(
                    "INSERT INTO user_resource_scopes (id, user_id, scope_type, scope_value) VALUES (?1, ?2, 'node', ?3)",
                    rusqlite::params![Uuid::new_v4().to_string(), new_id, node_id],
                );
                scopes.push(ResourceScope::Node(node_id));
            }
        }
    } else {
        // Default to Global access if role is superadmin, otherwise empty until admin assigns nodes
        if payload.role_id == "role_superadmin" || payload.role_id == "role_admin" {
            let _ = conn.execute(
                "INSERT INTO user_resource_scopes (id, user_id, scope_type, scope_value) VALUES (?1, ?2, 'global', '*')",
                rusqlite::params![Uuid::new_v4().to_string(), new_id],
            );
            scopes.push(ResourceScope::Global);
        }
    }

    let created_user = User {
        id: new_id,
        username: payload.username,
        email: payload.email,
        role_id: payload.role_id,
        is_active: true,
        password_locked: true,
        two_factor_enabled: false,
        two_factor_enforced: false,
        initial_generated_password: Some(raw_password.clone()),
        scopes,
        created_at: now,
        updated_at: now,
    };

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!(CreateUserResponse {
            success: true,
            user: created_user,
            generated_password: raw_password,
            message: "User successfully provisioned. A secured password was generated that cannot be changed by the user. Two-phase authentication is required upon first login.".to_string(),
        })),
    ))
}

/// Update user's permitted servers/nodes
pub async fn update_user_scopes_handler(
    user: AuthUser,
    Path(target_user_id): Path<String>,
    Extension(pool): Extension<DbPool>,
    Json(payload): Json<UpdateScopesRequest>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("users:manage") && !user.has_permission("*") {
        return Err((
            StatusCode::FORBIDDEN,
            "Forbidden: requires administrator permissions",
        ));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    // Clear existing scopes
    conn.execute(
        "DELETE FROM user_resource_scopes WHERE user_id = ?1",
        rusqlite::params![target_user_id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to clear scopes"))?;

    // Insert new scopes
    if payload.allowed_nodes.is_empty()
        || payload
            .allowed_nodes
            .iter()
            .any(|n| n == "*" || n == "global")
    {
        let _ = conn.execute(
            "INSERT INTO user_resource_scopes (id, user_id, scope_type, scope_value) VALUES (?1, ?2, 'global', '*')",
            rusqlite::params![Uuid::new_v4().to_string(), target_user_id],
        );
    } else {
        for node_id in payload.allowed_nodes {
            let _ = conn.execute(
                "INSERT INTO user_resource_scopes (id, user_id, scope_type, scope_value) VALUES (?1, ?2, 'node', ?3)",
                rusqlite::params![Uuid::new_v4().to_string(), target_user_id, node_id],
            );
        }
    }

    Ok(Json(
        serde_json::json!({ "success": true, "message": "User server access updated successfully" }),
    ))
}

pub async fn delete_user_handler(
    user: AuthUser,
    Path(user_id): Path<String>,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    if !user.has_permission("users:manage") && !user.has_permission("*") {
        return Err((StatusCode::FORBIDDEN, "Forbidden"));
    }

    if user.id == user_id {
        return Err((StatusCode::BAD_REQUEST, "Cannot delete your own account"));
    }

    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let rows = conn
        .execute(
            "DELETE FROM users WHERE id = ?1",
            rusqlite::params![user_id],
        )
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Delete failed"))?;

    if rows == 0 {
        return Err((StatusCode::NOT_FOUND, "User not found"));
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn list_roles_handler(
    _user: AuthUser,
    Extension(pool): Extension<DbPool>,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    let conn = pool
        .get()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let mut stmt = conn
        .prepare("SELECT id, name, is_system, permissions, created_at FROM roles")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query failed"))?;

    let roles = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let is_system: bool = row.get::<_, i64>(2)? == 1;
            let perms_json: String = row.get(3)?;
            let permissions: Vec<String> = serde_json::from_str(&perms_json).unwrap_or_default();
            let created_at: i64 = row.get(4)?;

            Ok(Role {
                id,
                name,
                is_system,
                permissions,
                created_at,
            })
        })
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read roles"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    Ok(Json(roles))
}
