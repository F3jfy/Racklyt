# Racklyt Backend Instructions: Coding Standards & Best Practices

## 1. Core Principles
All code written for the Racklyt backend must adhere to:
1. **Safety First:** Memory safety, strict type checking, and zero undefined behavior.
2. **Minimal Memory Allocations:** Re-use buffers, avoid superfluous `.clone()`, and leverage borrowed types (`&str`, `&[u8]`).
3. **Robust Error Handling:** Zero panic-prone methods (`unwrap()`, `expect()`) in request-handling and collector paths.
4. **Predictable Low Latency:** Async tasks must never block the Tokio executor thread pool.

---

## 2. Code Quality & Linter Configuration

All crates in the workspace must pass continuous linting:

```toml
# In root Cargo.toml or crate-level manifests
[workspace.lints.rust]
unsafe_code = "forbid"
missing_debug_implementations = "warn"

[workspace.lints.clippy]
all = "deny"
pedantic = "warn"
nursery = "warn"
unwrap_used = "deny"
expect_used = "deny"
panic = "deny"
```

### 2.1 Unsafe Code Policy
- `unsafe` code is strictly prohibited (`#![forbid(unsafe_code)]`).
- If low-level OS APIs (such as `statvfs` on Linux) require libc FFI calls, they must be wrapped in a dedicated, thoroughly reviewed module with explicit safety invariants documented.

---

## 3. Error Handling Architecture

Racklyt uses **`thiserror`** for domain error enums across crates:

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum HubError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Entity not found: {0}")]
    NotFound(String),

    #[error("Proxmox API communication error: {0}")]
    Proxmox(String),

    #[error("Internal I/O error: {0}")]
    Io(#[from] std::io::Error),
}
```

### 3.1 Mapping to Axum HTTP Responses
In `racklyt-hub`, domain errors implement Axum's `IntoResponse` trait to map neatly into HTTP status codes and structured JSON error payloads without leaking internal database stack traces to clients.

---

## 4. Async Execution Guidelines (Tokio Best Practices)

### 4.1 Never Block the Async Worker Threads
- **CPU-Intensive Tasks:** Password hashing (Argon2id) and cryptographic key generation must be wrapped in `tokio::task::spawn_blocking`:
  ```rust
  let hash = tokio::task::spawn_blocking(move || {
      hash_password(&password)
  }).await??;
  ```
- **Synchronous SQLite Calls:** If using `rusqlite`, database interactions must be dispatched through dedicated connection threads via channels or `tokio::task::spawn_blocking`.

---

## 5. Structured Logging & Observability

- Use the **`tracing`** ecosystem (`tracing::info!`, `tracing::warn!`, `tracing::error!`, `tracing::debug!`).
- Sensitive data (passwords, auth tokens, Proxmox secrets, personal email addresses) must **never** be logged. Use `tracing::field::Empty` or redact explicitly.
- In production, log output should be compatible with systemd `journald` and container log aggregators.
