# Privacy Policy & Telemetry Disclosure

**Last Updated:** November 2026

At **Racklyt**, we believe that infrastructure observability and system telemetry belong exclusively to you, the system operator. This document outlines our strict privacy architecture, data handling practices, and zero-external-telemetry guarantee.

---

## 1. Zero External Telemetry Guarantee

* **No Phone-Home:** Racklyt software (including `racklyt-hub`, `racklyt-agent`, and `racklyt-web`) does **not** transmit any telemetry, usage statistics, crash dumps, IP addresses, or analytics to Racklyt authors, maintainers, Google, or any third party.
* **100% Self-Hosted & Air-Gap Friendly:** The system is engineered to function entirely within isolated private networks, local area networks (LAN), or behind user-controlled reverse proxies/VPNs with zero external Internet connectivity required.
* **No Third-Party Trackers:** The web dashboard contains no tracking pixels, external ad networks, tracking cookies, or external analytics scripts (e.g., Google Analytics, PostHog, Mixpanel). All web assets are bundled and served locally by your Hub.

---

## 2. Data Collected Locally by the Agent

`racklyt-agent` is a lightweight system daemon designed to run on monitored Linux hosts and Raspberry Pis. It reads purely operational performance metrics directly from the host operating system kernel interfaces (`/proc` and `/sys`):

| Metric Category | Data Source | Details Collected |
| :--- | :--- | :--- |
| **CPU Usage** | `/proc/stat`, `/proc/loadavg` | Total CPU load %, per-core utilization %, and 1m/5m/15m system load averages. |
| **Memory & Swap** | `/proc/meminfo` | Total, used, free, buffered, and cached RAM and swap space in bytes. |
| **Disk Storage** | `statvfs` (libc syscall) | Mount points, total disk capacity, used bytes, and free bytes. |
| **Network Interfaces** | `/proc/net/dev` | Physical and virtual network interface names, cumulative bytes transmitted (TX), and received (RX). |
| **Thermal Sensors** | `/sys/class/thermal/` | CPU and SoC thermal temperature readings (in Celsius). |
| **Host Metadata** | Kernel APIs, `/etc/os-release` | Hostname, OS name/version, CPU architecture (`x86_64`, `aarch64`), and system uptime in seconds. |

> **What the Agent NEVER Collects:**
> - The agent does **not** inspect or upload file contents, user documents, shell histories, environment secrets, or process memory payloads.
> - The agent does **not** capture raw network packet contents (no pcap/sniffing).
> - The agent does **not** execute arbitrary remote commands issued from the Hub.

---

## 3. Data Stored Locally on the Hub

The `racklyt-hub` receives metric payloads from enrolled agents and stores them in a local SQLite database (`racklyt.db`):

1. **Time-Series Metrics:** Compressed system performance metrics, periodically downsampled to prevent unbounded database growth.
2. **User Credentials & Sessions:**
   - User account records (usernames, hashed passwords using **Argon2id** with salt).
   - Session identifiers generated using high-entropy CSPRNGs (256-bit), stored in HTTP-only, `SameSite=Strict` cookies.
   - Optional TOTP (2FA) secrets for multi-factor authentication.
3. **Integration Secrets:**
   - Proxmox VE API tokens and TLS certificate fingerprints.
   - SMTP credentials for email alerts.
   - Webhook URLs (e.g., Discord, Telegram, Gotify, NTFY).
   - *All sensitive secrets are encrypted at rest using AES-256-GCM.*
4. **Audit & Event Logs:** Chronological records of security events (user logins, failed authentication attempts, role changes, agent enrollments, alert firings).

---

## 4. External Integrations & Notifications

Any data leaving the `racklyt-hub` instance is strictly dispatched by user-configured notification channels:

* **Webhook Alerts:** When configured by the administrator, Racklyt formats alert payloads (e.g., "Node `rpi4-prod` CPU above 90%") and sends them via HTTPS POST to the user-specified webhook endpoint (Gotify, NTFY, Discord, Telegram, or custom webhooks).
* **SMTP Notifications:** When configured, Racklyt connects to the user's chosen SMTP mail server using TLS to send alert emails to designated recipients.
* **Proxmox VE API:** Racklyt polls the user's Proxmox VE cluster using direct HTTPS REST calls with read-only API tokens (`PVEAuditor`). No Proxmox metrics or cluster topologies are shared beyond your local Hub.

---

## 5. GDPR, CCPA & Data Subject Compliance

For organizations operating under regulations such as the General Data Protection Regulation (GDPR) or California Consumer Privacy Act (CCPA):

* **Data Controller & Processor:** You, the organization or individual hosting the Racklyt instance, act as both the Data Controller and Data Processor.
* **Personal Data:** In typical deployments, the only personal data processed includes administrator usernames, email addresses (if entered for notifications), and IP addresses in access logs.
* **Right to Erasure & Export:** Administrators have complete access to the underlying SQLite database file and may view, export, or delete any record directly via the admin UI or standard SQLite tools.
* **Retention Management:** Metric retention is configurable within the Hub to automatically purge historical metrics after a user-defined threshold (e.g., 7 days, 30 days, 90 days).

---

## 6. Security & Encryption Standards

* **In Transit:** All agent-to-hub and client-to-hub communication supports TLS 1.3 encryption.
* **Authentication:** Agents authenticate via 256-bit cryptographically random tokens issued during the one-time enrollment handshake.
* **Local Permissions:** SQLite files and agent configuration files default to strict `0600` permissions (accessible only by the service owner).

---

## 7. Contact & Inquiries

For questions regarding Racklyt's privacy design, architectural security, or data handling principles, please open a public discussion on GitHub or contact the maintainers at:

* **GitHub Discussions:** [https://github.com/racklyt/racklyt/discussions](https://github.com/racklyt/racklyt/discussions)
* **Security Contact:** See [SECURITY.md](SECURITY.md) for secure reporting channels.
