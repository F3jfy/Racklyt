use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
};
use racklyt_common::ResourceScope;
use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
};
use uuid::Uuid;

pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| format!("Password hashing failed: {}", e))
}

pub fn verify_password(password: &str, hash_str: &str) -> bool {
    if let Ok(parsed_hash) = PasswordHash::new(hash_str) {
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok()
    } else {
        false
    }
}

/// In-memory active session store with rate limiting and secure session isolation
#[derive(Clone, Default)]
pub struct SessionStore {
    sessions: Arc<RwLock<HashMap<String, (String, String, i64)>>>, // token -> (session_id, user_id, expiry_unix)
    pending_2fa: Arc<RwLock<HashMap<String, (String, bool, i64)>>>, // temp_token -> (user_id, is_setup, expiry_unix)
    failed_logins: Arc<RwLock<HashMap<String, (u32, i64)>>>, // key -> (attempts, locked_until_unix)
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            pending_2fa: Arc::new(RwLock::new(HashMap::new())),
            failed_logins: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn create_session(&self, user_id: &str) -> (String, String) {
        let token = Uuid::new_v4().to_string();
        let session_id = format!("sess_{}", Uuid::new_v4().simple());
        let expires_at = chrono::Utc::now().timestamp() + (7 * 86400); // 7 days
        let mut map = self.sessions.write().unwrap();
        map.insert(
            token.clone(),
            (session_id.clone(), user_id.to_string(), expires_at),
        );
        (token, session_id)
    }

    pub fn get_user_id(&self, token: &str) -> Option<String> {
        let now = chrono::Utc::now().timestamp();
        let map = self.sessions.read().unwrap();
        if let Some((_, user_id, expiry)) = map.get(token) {
            if *expiry > now {
                return Some(user_id.clone());
            }
        }
        None
    }

    pub fn remove_session(&self, token_or_id: &str) {
        let mut map = self.sessions.write().unwrap();
        // Remove either by token or by session_id
        if map.remove(token_or_id).is_none() {
            let key_to_remove = map
                .iter()
                .find(|(_, (sid, _, _))| sid == token_or_id)
                .map(|(k, _)| k.clone());
            if let Some(k) = key_to_remove {
                map.remove(&k);
            }
        }
    }

    pub fn list_active_sessions(&self) -> Vec<(String, String, String, i64)> {
        let now = chrono::Utc::now().timestamp();
        let map = self.sessions.read().unwrap();
        map.iter()
            .filter(|(_, (_, _, exp))| *exp > now)
            .map(|(tok, (sid, uid, exp))| {
                let snippet = if tok.len() > 8 {
                    format!("{}...{}", &tok[..4], &tok[tok.len() - 4..])
                } else {
                    "••••••••".to_string()
                };
                (sid.clone(), snippet, uid.clone(), *exp)
            })
            .collect()
    }

    pub fn is_rate_limited(&self, key: &str) -> bool {
        let now = chrono::Utc::now().timestamp();
        let map = self.failed_logins.read().unwrap();
        if let Some((attempts, locked_until)) = map.get(key) {
            if *locked_until > now {
                return true;
            }
            if *attempts >= 5 && *locked_until == 0 {
                return true;
            }
        }
        false
    }

    pub fn record_failed_attempt(&self, key: &str) {
        let now = chrono::Utc::now().timestamp();
        let mut map = self.failed_logins.write().unwrap();
        let entry = map.entry(key.to_string()).or_insert((0, 0));
        entry.0 += 1;
        if entry.0 >= 5 {
            // Lock out for 5 minutes (300 seconds)
            entry.1 = now + 300;
        }
    }

    pub fn reset_failed_attempts(&self, key: &str) {
        let mut map = self.failed_logins.write().unwrap();
        map.remove(key);
    }

    pub fn create_pending_2fa(&self, user_id: &str, is_setup: bool) -> String {
        let temp_token = format!("2fa_{}", Uuid::new_v4().simple());
        let expires_at = chrono::Utc::now().timestamp() + 600; // 10 minutes
        let mut map = self.pending_2fa.write().unwrap();
        map.insert(
            temp_token.clone(),
            (user_id.to_string(), is_setup, expires_at),
        );
        temp_token
    }

    pub fn consume_pending_2fa(&self, temp_token: &str) -> Option<(String, bool)> {
        let now = chrono::Utc::now().timestamp();
        let mut map = self.pending_2fa.write().unwrap();
        if let Some((user_id, is_setup, exp)) = map.remove(temp_token) {
            if exp > now {
                return Some((user_id, is_setup));
            }
        }
        None
    }

    pub fn cleanup_expired(&self) {
        let now = chrono::Utc::now().timestamp();
        if let Ok(mut map) = self.sessions.write() {
            map.retain(|_, (_, _, exp)| *exp > now);
        }
        if let Ok(mut map) = self.pending_2fa.write() {
            map.retain(|_, (_, _, exp)| *exp > now);
        }
        if let Ok(mut map) = self.failed_logins.write() {
            map.retain(|_, (_, locked_until)| *locked_until > now);
        }
    }
}

/// Authenticated User info extracted in request handlers
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub role_id: String,
    pub permissions: Vec<String>,
    pub scopes: Vec<ResourceScope>,
}

impl AuthUser {
    pub fn has_permission(&self, perm: &str) -> bool {
        self.permissions.iter().any(|p| p == "*" || p == perm)
    }

    pub fn can_access_node(&self, node_id: &str, node_tags: &[String]) -> bool {
        // Superadmin and administrators can access all nodes
        if self.has_permission("*") || self.has_permission("nodes:manage") {
            return true;
        }

        // Users with explicit Global scope can access all nodes
        if self.scopes.contains(&ResourceScope::Global) {
            return true;
        }

        // Otherwise, check if this node or one of its tags is explicitly granted in user's scopes
        for scope in &self.scopes {
            match scope {
                ResourceScope::Global => return true,
                ResourceScope::Node(target_id) if target_id == node_id => return true,
                ResourceScope::Tag(target_tag) if node_tags.contains(target_tag) => return true,
                _ => {}
            }
        }

        false
    }
}

/// Axum Extractor for AuthUser
#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let extensions = &parts.extensions;
        let session_store = extensions.get::<SessionStore>().ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Session store unavailable",
        ))?;
        let db_pool = extensions.get::<crate::db::DbPool>().ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database pool unavailable",
        ))?;

        let token_opt = extract_token(parts);

        let user_id = if let Some(tok) = token_opt {
            session_store
                .get_user_id(&tok)
                .ok_or((StatusCode::UNAUTHORIZED, "Invalid or expired session"))?
        } else if let Some(cf_email) = parts
            .headers
            .get("cf-access-authenticated-user-email")
            .and_then(|h| h.to_str().ok())
        {
            let conn = db_pool.get().map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Database connection failed",
                )
            })?;

            // SEC-01 Hardening: Cloudflare Access header auth requires explicit enablement and JWT assertion
            let cf_enabled: bool = conn
                .query_row(
                    "SELECT value FROM system_settings WHERE key = 'cloudflare_access_enabled'",
                    [],
                    |r| r.get::<_, String>(0),
                )
                .map(|v| v.eq_ignore_ascii_case("true"))
                .unwrap_or(false);

            let has_jwt_assertion = parts.headers.contains_key("cf-access-jwt-assertion");

            if !cf_enabled || !has_jwt_assertion {
                return Err((StatusCode::UNAUTHORIZED, "Cloudflare Access header authentication is disabled or missing cryptographic assertion"));
            }

            conn.query_row(
                "SELECT id FROM users WHERE email = ?1 AND is_active = 1",
                rusqlite::params![cf_email],
                |r| r.get::<_, String>(0),
            )
            .map_err(|_| {
                (
                    StatusCode::UNAUTHORIZED,
                    "Cloudflare Access user not authorized in Racklyt",
                )
            })?
        } else {
            return Err((StatusCode::UNAUTHORIZED, "Missing authentication"));
        };

        // Query user details from DB
        let conn = db_pool.get().map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Database connection failed",
            )
        })?;

        let mut stmt = conn
            .prepare(
                "SELECT u.id, u.username, u.role_id, r.permissions
                 FROM users u
                 JOIN roles r ON u.role_id = r.id
                 WHERE u.id = ?1 AND u.is_active = 1",
            )
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query failed"))?;

        let user = stmt
            .query_row(rusqlite::params![user_id], |row| {
                let id: String = row.get(0)?;
                let username: String = row.get(1)?;
                let role_id: String = row.get(2)?;
                let perms_json: String = row.get(3)?;
                let permissions: Vec<String> =
                    serde_json::from_str(&perms_json).unwrap_or_default();
                Ok((id, username, role_id, permissions))
            })
            .map_err(|_| (StatusCode::UNAUTHORIZED, "User account not active"))?;

        // Query user scopes
        let mut scope_stmt = conn
            .prepare("SELECT scope_type, scope_value FROM user_resource_scopes WHERE user_id = ?1")
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Query scopes failed"))?;

        let scopes = scope_stmt
            .query_map(rusqlite::params![user.0], |row| {
                let stype: String = row.get(0)?;
                let sval: String = row.get(1)?;
                let scope = match stype.as_str() {
                    "node" => ResourceScope::Node(sval),
                    "cluster" => ResourceScope::Cluster(sval),
                    "tag" => ResourceScope::Tag(sval),
                    _ => ResourceScope::Global,
                };
                Ok(scope)
            })
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed reading scopes"))?
            .filter_map(Result::ok)
            .collect();

        Ok(AuthUser {
            id: user.0,
            username: user.1,
            role_id: user.2,
            permissions: user.3,
            scopes,
        })
    }
}

fn extract_token(parts: &Parts) -> Option<String> {
    // 1. Check Authorization: Bearer <token>
    if let Some(auth_header) = parts.headers.get(header::AUTHORIZATION) {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                return Some(token.trim().to_string());
            }
        }
    }

    // 2. Check Cookie: racklyt_session=<token>
    if let Some(cookie_header) = parts.headers.get(header::COOKIE) {
        if let Ok(cookie_str) = cookie_header.to_str() {
            for cookie in cookie_str.split(';') {
                let trimmed = cookie.trim();
                if let Some(token) = trimmed.strip_prefix("racklyt_session=") {
                    return Some(token.to_string());
                }
            }
        }
    }

    None
}
