# Security Policy

Racklyt is designed from the ground up with a **Zero-Trust and Least-Privilege** security architecture. We take all potential security vulnerabilities seriously and appreciate the assistance of the security community in keeping Racklyt safe.

---

## Supported Versions

Only the latest active minor release receives active security patches. We recommend all operators stay updated with the latest release.

| Version | Supported |
| :--- | :--- |
| `0.1.x` | :white_check_mark: Yes |
| `< 0.1.0` | :x: No |

---

## Reporting a Vulnerability

> [!IMPORTANT]
> **Please DO NOT file public GitHub issues for security vulnerabilities.**

If you discover a vulnerability or potential security flaw in Racklyt, please report it privately:

1. **GitHub Private Vulnerability Reporting (Preferred):**
   Navigate to the repository's **Security** tab and click **[Report a vulnerability](https://github.com/racklyt/racklyt/security/advisories/new)** to submit a private advisory directly to the maintainers.
2. **Email Disclosure:**
   If GitHub Security Advisories is unavailable, email our security team at:
   `security@racklyt.dev` (or open a confidential inquiry with maintainers).

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:
- A clear description of the vulnerability.
- Step-by-step instructions or Proof of Concept (PoC) code to reproduce the issue.
- The component affected (`racklyt-hub`, `racklyt-agent`, `racklyt-common`, or `web`).
- The version of Racklyt and the host environment (OS, kernel version, Rust version, Proxmox version).
- An assessment of the potential impact (e.g., privilege escalation, unauthorized metric submission, authentication bypass, data exposure).

---

## Response Timeline

We commit to the following response timeline for security disclosures:

| Stage | Expected Target |
| :--- | :--- |
| **Initial Acknowledgment** | Within 48 hours |
| **Triage & Severity Confirmation** | Within 5 business days |
| **Remediation & Patch Development** | Within 14-30 business days (depending on complexity) |
| **Public Advisory & Release** | Coordinated with the reporter upon patch release |

We follow **Coordinated Vulnerability Disclosure (CVD)** principles. We ask that reporters refrain from publicly disclosing details until an official patch has been released.

---

## Core Security Commitments & Architecture

Racklyt enforces strict security boundaries:

* **Memory Safety:** The backend is written in modern Rust with `#![forbid(unsafe_code)]` across all high-level modules. Low-level syscall wrappers (such as `statvfs`) are strictly isolated with documented safety invariants.
* **Cryptographic Enrollment Handshake:** Monitored agents must authenticate using high-entropy 256-bit CSPRNG tokens issued during one-time enrollment handshakes. Agents cannot spoof other host UUIDs.
* **Proxmox Least Privilege:** Proxmox VE integration is strictly read-only. We require dedicated `PVEAuditor` API tokens. Racklyt contains zero code or endpoints capable of mutating, restarting, or deleting virtual machines or hypervisor configs.
* **TLS Fingerprint Pinning:** When connecting to hypervisors or internal nodes using self-signed certificates, Racklyt supports SHA-256 TLS fingerprint pinning rather than disabling certificate verification.
* **Password Hashing & Session Storage:** User passwords are encrypted with **Argon2id** (memory cost: 64MB, iterations: 3). Sessions use cryptographically secure 256-bit random keys in HTTP-only, `SameSite=Strict`, `Secure` cookies.
* **Secrets Encryption at Rest:** Sensitive integration credentials (Proxmox tokens, webhook secrets, SMTP passwords) are stored encrypted in SQLite using AES-256-GCM.

---

## Safe Harbor

We consider security research conducted under this policy to be authorized. We will not pursue civil or criminal action against researchers who:
- Make a good-faith effort to avoid privacy violations, data destruction, and service disruption.
- Only interact with test environments or accounts that they own or have explicit permission to test.
- Keep vulnerability details confidential until the coordinated disclosure date.
