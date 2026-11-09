# Racklyt Backend Instructions: Proxmox VE Poller & API Client

## 1. Overview
The Proxmox Collector module runs inside the **Racklyt Hub** as a background service. It periodically queries Proxmox VE's REST API (API2) to ingest hypervisor telemetry, guest VM/LXC statuses, and storage pool metrics without installing client agents inside the hypervisor.

---

## 2. Proxmox VE API Authentication

Proxmox VE supports headless API tokens. Racklyt authenticates using the standard `PVEAPIToken` format in the HTTP request headers:

```http
Authorization: PVEAPIToken=racklyt-monitor@pve!metrics=a1b2c3d4-e5f6-7890-abcd-ef0123456789
```

### 2.1 Least-Privilege Requirement
- User: `racklyt-monitor@pve`
- Token ID: `metrics`
- Privilege: `PVEAuditor` (read-only access to `/` path)
- **Zero Mutating Permissions:** The collector client only issues HTTP `GET` requests. All `POST`, `PUT`, or `DELETE` methods are excluded from the client implementation.

---

## 3. Targeted Proxmox API Endpoints

The collector executes structured polling queries at a configurable cadence (default: every 15 seconds):

| Endpoint | Polling Cadence | Purpose |
| :--- | :--- | :--- |
| `GET /api2/json/cluster/status` | Every 30s | Evaluates cluster health, quorum status (`quorate`), and member node states. |
| `GET /api2/json/nodes` | Every 15s | Retrieves summary of all physical hypervisor nodes. |
| `GET /api2/json/nodes/{node}/status` | Every 15s | Deep node telemetry: CPU usage, RAM used/total, loadavg, uptime, kversion. |
| `GET /api2/json/nodes/{node}/qemu` | Every 15s | Enumerates all QEMU VMs: VMID, name, status (`running`, `stopped`), CPU%, memory, diskread, diskwrite. |
| `GET /api2/json/nodes/{node}/lxc` | Every 15s | Enumerates all LXC containers: VMID, name, status, CPU%, memory, swap. |
| `GET /api2/json/nodes/{node}/storage` | Every 60s | Storage pools: type (ZFS, LVM, Directory, NFS), total capacity, used bytes. |

---

## 4. Rust Client Implementation Pattern

```rust
// Conceptual client struct using reqwest
use reqwest::{Client, header};
use serde::Deserialize;

pub struct ProxmoxClient {
    client: Client,
    base_url: String,
    token_header_value: String,
}

impl ProxmoxClient {
    pub fn new(base_url: String, user: &str, realm: &str, token_id: &str, secret: &str) -> Self {
        let token_header_value = format!("PVEAPIToken={}@{};{}={}", user, realm, token_id, secret);
        
        // Build client with rustls and optional fingerprint verification
        let client = Client::builder()
            .use_rustls_tls()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to initialize Proxmox HTTP client");

        Self { client, base_url, token_header_value }
    }

    pub async fn fetch_cluster_status(&self) -> Result<Vec<PveClusterNode>, ProxmoxError> {
        let url = format!("{}/api2/json/cluster/status", self.base_url);
        let resp = self.client.get(&url)
            .header(header::AUTHORIZATION, &self.token_header_value)
            .send()
            .await?
            .json::<PveResponse<Vec<PveClusterNode>>>()
            .await?;
        
        Ok(resp.data)
    }
}
```

---

## 5. TLS Fingerprint Pinning

Proxmox installations frequently use auto-generated self-signed certificates. To avoid disabling SSL validation completely, Racklyt offers **SHA-256 TLS Fingerprint Pinning**:
- When adding a Proxmox cluster in the Racklyt UI, the administrator enters the SHA-256 fingerprint displayed in the Proxmox web UI (`Nodes -> System -> Certificates`).
- The Racklyt TLS connector verifies the peer certificate's DER digest matches the stored fingerprint before completing the TLS handshake, protecting against Man-in-the-Middle (MitM) attacks on the local network.
