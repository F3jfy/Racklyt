# Racklyt Backend Instructions: Authentication, RBAC & Permissions Engine

## 1. Overview
This specification details the backend implementation for user authentication, session security, multi-account Role-Based Access Control (RBAC), and agent authentication within the Rust Hub.

---

## 2. Cryptographic Security Standards

### 2.1 Password Hashing with Argon2id
All user passwords must be hashed using the **Argon2id** algorithm via the `argon2` crate:
```rust
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

pub fn hash_password(password: &str) -> Result<String, AuthError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)?
        .to_string();
    Ok(hash)
}

pub fn verify_password(password: &str, hash_str: &str) -> Result<bool, AuthError> {
    let parsed_hash = PasswordHash::new(hash_str)?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}
```

### 2.2 Agent Authentication Tokens
- Agent Bearer tokens are high-entropy, 32-byte CSPRNG hex strings prefixed with `rk_node_`.
- The database stores only the **SHA-256 digest** of the token (`auth_token_hash`), ensuring that a database compromise does not leak actionable agent credentials.

---

## 3. Session Management & Axum Middleware

### 3.1 Session Architecture
- Authenticated browser sessions store a cryptographically random session identifier inside an HTTP-only, secure cookie (`racklyt_session`).
- Active sessions are cached in a fast in-memory map (`DashMap<SessionId, UserSession>`) backed by SQLite for persistence across restarts.

### 3.2 Authenticated User Extractor (`AuthUser`)
Axum custom extractor automatically resolves the calling user, their permissions, and resource scopes:

```rust
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub scopes: Vec<ResourceScope>,
}

#[derive(Clone, Debug)]
pub enum ResourceScope {
    Global,
    Node(String),
    Cluster(String),
    Tag(String),
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // 1. Extract session cookie or Bearer token
        // 2. Lookup session in active cache
        // 3. Return AuthUser or 401 Unauthorized
        // ...
    }
}
```

---

## 4. RBAC Authorization Enforcement

### 4.1 Permission Guard Middleware
Routes requiring specific permissions employ a macro or helper guard:

```rust
pub fn require_permission(user: &AuthUser, required_perm: &str) -> Result<(), (StatusCode, &'static str)> {
    if user.permissions.contains(&"*".to_string()) || user.permissions.iter().any(|p| p == required_perm) {
        Ok(())
    } else {
        Err((StatusCode::FORBIDDEN, "Access denied: missing required permission"))
    }
}
```

### 4.2 Resource Scope Filtering in SQLite Queries
When retrieving nodes, metrics, or Proxmox guests, queries must be scoped to the authenticated user's permissions:

```rust
pub fn build_scoped_node_query(user: &AuthUser) -> (String, Vec<rusqlite::types::Value>) {
    if user.has_global_access() {
        return ("SELECT * FROM nodes".to_string(), vec![]);
    }

    // Dynamic clause restricting query to allowed node IDs or matched tags
    let allowed_nodes = user.get_allowed_node_ids();
    let placeholders = allowed_nodes.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!("SELECT * FROM nodes WHERE id IN ({})", placeholders);
    // ...
}
```

---

## 5. Bootstrapping & First-Run Setup
1. **Zero-Configuration Detection:** On first boot, if the `users` table contains zero records, the Hub generates a temporary initial administrative setup key and outputs it to the console / systemd log:
   ```
   [RACKLYT INITIAL SETUP] No accounts found.
   Open: http://<server-ip>:8443/setup?key=4f92bc31... to initialize SuperAdmin credentials.
   ```
2. **Account Initialization:** The admin navigates to the setup link, establishes their username and strong password, and system defaults are initialized.
3. **Subsequent Accounts:** All additional accounts are created exclusively via the authenticated Admin panel with explicit role and scope assignments.
