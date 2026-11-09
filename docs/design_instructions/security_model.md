# Racklyt Design Instructions: Security Model

## 1. Security Philosophy
Racklyt adheres to a **Zero-Trust & Least-Privilege** security model. Because a monitoring system observes vital infrastructure metrics, compromise of the monitoring hub or agents could reveal confidential network topologies, server vulnerabilities, or operational habits. 

---

## 2. Threat Model & Mitigations

| Threat | Attack Vector | Racklyt Mitigation |
| :--- | :--- | :--- |
| **Unauthorized Agent Spoofing** | Rogue machine pushes fake metrics to Hub | Cryptographic agent tokens tied to unique host UUIDs; strict enrollment handshake. |
| **Eavesdropping / Sniffing** | Attacker intercepts metrics on local LAN | Enforced TLS 1.3 encryption on all agent-to-hub and client-to-hub streams. |
| **Hypervisor Credential Theft** | Stolen Proxmox token used to destroy VMs | Proxmox tokens are restricted strictly to read-only `PVEAuditor` privilege; tokens are encrypted at rest in SQLite. |
| **Denial of Service (DoS)** | Agent or rogue client floods Hub with traffic | Token-bucket rate limiting per IP and per Agent ID; payload size limits (max 64KB per ingest). |
| **Admin Credential Compromise** | Brute-force dictionary attacks on Web login | Argon2id password hashing, constant-time comparisons, failed attempt lockouts, optional 2FA/TOTP. |

---

## 3. Agent Enrollment & Authentication Protocol

```
Agent                                                     Racklyt Hub
  |                                                            |
  |  1. POST /api/v1/enrollment/claim                          |
  |     Headers: { "X-Enrollment-Key": "ONE_TIME_UUID" }       |
  |     Body: { "hostname": "rpi4-prod", "os": "linux", ... }  |
  |----------------------------------------------------------->|
  |                                                            |  Validate key, check expiry
  |                                                            |  Generate 256-bit Node Secret
  |  2. Response: 201 Created                                  |  Store Node ID & Hash in DB
  |     Body: { "node_id": "...", "auth_token": "..." }        |
  |<-----------------------------------------------------------|
  |                                                            |
  | (Saves token locally in /etc/racklyt/agent.env mode 0600)  |
  |                                                            |
  |  3. POST /api/v1/ingest/metrics                            |
  |     Headers: { "Authorization": "Bearer AGENT_TOKEN" }     |
  |     Body: { "metrics": [...] }                             |
  |----------------------------------------------------------->|
  |                                                            |  Verify SHA-256 token hash
  |  4. Response: 202 Accepted                                 |
  |<-----------------------------------------------------------|
```

### 3.1 Enrollment Steps
1. **Admin Generation:** The administrator generates a one-time enrollment token from the Racklyt Web Admin panel with an expiration time (e.g., valid for 1 hour).
2. **First Run Handshake:** The agent executes its initial boot with `--enroll-key <KEY>` and `--hub-url <URL>`.
3. **Issuance:** The Hub validates the key, marks it as burned, generates a unique Node UUID and high-entropy secret token (256-bit CSPRNG), and returns it to the agent.
4. **Local Storage:** The agent persists the credential in a restricted configuration file (e.g. `/etc/racklyt/agent.toml`, mode `0600` root-only access).
5. **Revocation:** An administrator can revoke or cycle any node's token with a single click in the UI, instantly dropping subsequent metric submissions.

---

## 4. Proxmox VE API Integration Security

### 4.1 Least Privilege Policy
- **Never use `root@pam` password or administrator tokens.**
- Administrators must configure a dedicated Proxmox API user and token (e.g., `racklyt-monitor@pve!metrics`).
- The token must be assigned **only** the standard read-only role:
  - Role: `PVEAuditor` (or a custom role granting `VM.Audit`, `Sys.Audit`, `Datastore.Audit`).
  - Path: `/` (Datacenter wide) with propagate enabled, or restricted to specific node pools.
- **Strict Read-Only Enforcement:** Racklyt backend code must never contain endpoints or API calls capable of mutating Proxmox states (no VM start, stop, delete, or reconfigure calls).

### 4.2 TLS Verification & Fingerprinting
- Proxmox installations frequently use self-signed certificates.
- Rather than blindly disabling SSL verification (`verify = false`), Racklyt supports **TLS SHA-256 Fingerprint Pinning**. The user specifies the expected certificate fingerprint, allowing secure communication without requiring an external public CA.

---

## 5. Storage Security & Data Privacy

### 5.1 SQLite Security at Rest
- Database file permissions restricted to `0600` (readable/writable only by the `racklyt` service user).
- Sensitive secrets (Proxmox API tokens, notification webhook URLs with embedded secrets) are stored encrypted in the database using an AES-256-GCM master key derived from a local machine secret or environment variable.

### 5.2 Password Hashing & Session Management
- **Passwords:** Hashed with **Argon2id** (memory cost: 64MB, iterations: 3, parallelism: 1).
- **Session Tokens:** Cryptographically secure random 256-bit hex tokens stored in HTTP-only, `SameSite=Strict`, `Secure` cookies.
- **CSRF Protection:** Double-submit cookie or custom header validation (`X-Racklyt-Request: 1`) on all state-altering API requests.
