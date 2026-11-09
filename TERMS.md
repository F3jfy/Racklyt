# Terms of Use & Operational Disclaimers

**Last Updated:** November 2026

Please read these Terms of Use and Operational Disclaimers carefully before installing, deploying, or utilizing **Racklyt**. By downloading, compiling, or running Racklyt (including `racklyt-hub`, `racklyt-agent`, and `racklyt-web`), you agree to the conditions set forth below.

---

## 1. Open Source License & "AS-IS" Warranty Disclaimer

Racklyt is open-source software distributed under the terms of the **MIT License** or the **Apache License, Version 2.0** (at your option). 

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS, MAINTAINERS, OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## 2. Non-Life-Critical & Non-Hazardous Operations Notice

Racklyt is designed exclusively for general-purpose IT server monitoring, homelab telemetry, and cloud/hypervisor infrastructure observability.

> [!CAUTION]
> **HIGH-RISK AND LIFE-CRITICAL ACTIVITIES DISCLAIMER**  
> Racklyt is **NOT** fail-safe and is **NOT** designed, manufactured, tested, or intended for use in environments requiring fail-safe performance, including but not limited to:
> - Medical life-support systems, surgical equipment, or patient monitoring.
> - Emergency dispatch, safety alarms, or 911/112 communication services.
> - Air traffic control, nuclear facilities, railway signaling, or defense systems.
> - Any application where the failure, latency, or interruption of the software could lead directly to death, personal injury, severe physical damage, or environmental destruction.

---

## 3. Monitoring & Alerting Reliability Disclaimer

Racklyt provides heartbeat detection, threshold-based alerts, and multi-channel notifications (e.g., Discord, Telegram, Gotify, NTFY, and SMTP email). However:

* **No Service Level Agreement (SLA):** Open-source Racklyt provides no guaranteed notification uptime, latency, or delivery rate.
* **Network & Environmental Factors:** Metric reporting, heartbeat watchdogs, and alert dispatches may be delayed, suppressed, or prevented by factors beyond the control of Racklyt, including but not limited to: network partitions, firewall rules, ISP packet loss, host kernel freezes, DNS resolution outages, power failures, or third-party API rate limits (e.g. Discord, Telegram, or email server spam filters).
* **Operator Verification:** You are solely responsible for configuring redundant monitoring pathways and verifying alert dispatch mechanisms for mission-critical services.

---

## 4. Agent Daemon Execution & Privilege Responsibility

`racklyt-agent` is designed to inspect host kernel metrics via `/proc` and `/sys`. 

* **Permission Boundaries:** The agent does not require root privileges for standard metric reads if appropriate group permissions are granted. If the operator chooses to execute the agent as `root` or within a container with `host` PID/network namespaces, the operator assumes sole responsibility for securing that environment.
* **Auditability:** Racklyt's source code is public and auditable. Operators are advised to audit the code, Dockerfiles, and systemd units prior to deploying agents across production server fleets.

---

## 5. Proxmox VE API Integration

Racklyt provides read-only telemetry collection for Proxmox VE clusters:

* **Least-Privilege Requirement:** Operators must configure Proxmox API tokens with read-only roles (e.g., `PVEAuditor`). The authors of Racklyt accept no liability for misconfigurations where an operator inadvertently grants elevated (`PVEAdmin` or `root@pam`) tokens to the monitoring software.
* **Fingerprint Verification:** When utilizing self-signed certificates on internal hypervisors, operators are responsible for verifying and pinning the correct SHA-256 TLS fingerprint.

---

## 6. Third-Party Trademarks & Independence

All product names, logos, brands, and registered trademarks referenced in Racklyt documentation and software are the property of their respective owners:

* **Proxmox®** is a registered trademark of Proxmox Server Solutions GmbH.
* **Raspberry Pi®** is a trademark of Raspberry Pi Ltd.
* **Linux®** is the registered trademark of Linus Torvalds.
* **Docker®** is a trademark of Docker, Inc.
* **Cloudflare®** is a trademark of Cloudflare, Inc.
* **Apple®, iOS®** and **Android®** are trademarks of Apple Inc. and Google LLC respectively.

Racklyt is an independent, community-driven open-source project. Reference to these trademarks does not imply any affiliation, sponsorship, endorsement, or certification by any of the respective trademark holders.

---

## 7. Modifications & Governance

The maintainers reserve the right to modify these terms and documentation in accordance with community consensus and applicable law. Changes will be documented in the repository changelog and commit history.
