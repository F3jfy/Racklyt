# Racklyt Design Instructions: Alerting & Health Engine

## 1. Overview
Racklyt incorporates a real-time, low-overhead alert evaluation pipeline that continuously audits incoming metrics, heartbeat states, and Proxmox cluster events against configured alert rules.

---

## 2. Trigger Types

### 2.1 Heartbeat & Availability (Dead-Man's Switch)
- **Node Inactivity:** Automatically triggered when `racklyt-agent` stops reporting for more than $3 \times \text{Push Interval}$ (default 30 seconds).
- **Proxmox Hypervisor Loss:** Triggered when the Hub cannot reach the Proxmox API2 endpoint after $3$ consecutive polling attempts.
- **Cluster Quorum Loss:** Triggered when Proxmox reports `quorate == 0`.

### 2.2 Metric Thresholds & Duration Windows
To eliminate alert fatigue from brief momentary CPU or I/O spikes, alerts enforce duration windows:
- **Condition Format:** `Metric [Operator] [Threshold] FOR [Duration]`
  - *Example 1:* `system.cpu.usage_percent > 90.0% FOR 5m`
  - *Example 2:* `system.memory.used_percent > 95.0% FOR 3m`
  - *Example 3:* `system.disk.used_percent["/"] > 88.0% FOR 10m`
  - *Example 4:* `hardware.temperature.soc_celsius > 75.0°C FOR 2m` (Raspberry Pi thermal throttle protection)

### 2.3 Proxmox Guest Health
- Guest VM / LXC crash or unexpected termination.
- Guest balloon memory saturation.

---

## 3. Severity Levels & Life Cycle

```
[ Normal ] 
    |
    v (Condition met for duration)
[ Triggered: Warning or Critical ] ---> Dispatch Notifications (Discord / NTFY / etc.)
    |
    +---> [ Acknowledged by User ] ---> Suppress repeated alerts
    |
    v (Condition cleared)
[ Resolved ] -------------------------> Dispatch Resolution Notification
```

- **Info:** Informational status updates (e.g. node successfully enrolled, backup completed).
- **Warning:** Resource utilization reaching capacity (e.g., Disk > 80%).
- **Critical:** Service outage, host unreachable, disk near 100%, or hardware thermal danger.

---

## 4. Notification Dispatch Channels & Mobile App Integration

Racklyt emphasizes privacy, flexibility, and mobile-ready accessibility:

### 4.1 Mobile App API (Custom Phone App Companion)
Racklyt provides first-class native API support for building companion iOS and Android mobile applications:
- **Mobile Push Subscriptions:** The Hub provides a device registration API (`/api/v1/devices/push`) allowing phone apps to register APNs (Apple Push Notification service), FCM (Firebase Cloud Messaging), or UnifiedPush tokens.
- **Real-Time In-App Stream:** Phone apps maintain a lightweight Server-Sent Events (SSE) or WebSocket connection at `/api/v1/notifications/stream` for immediate alert delivery with low battery impact.
- **In-App Notification Center:** Mobile apps can query notification history, check unread counts, and remotely acknowledge or mute alerts via `/api/v1/notifications`.
- **Deep Linking:** Push notifications embed payload metadata (`node_id`, `cluster_id`, `alert_id`) allowing the phone app to navigate directly to the affected server or VM screen on tap.

### 4.2 Email Alerts (SMTP)
- **Built-in SMTP Engine:** Connects to any standard mail server (Postfix, SendGrid, Amazon SES, Proton Mail Bridge, Gmail SMTP) with STARTTLS or SSL/TLS encryption.
- **Responsive Dark-Themed Email Templates:** Clean, high-contrast, modern HTML and plaintext multipart emails featuring:
  - Severity badge (Warning, Critical, Resolved)
  - Affected host / cluster / VM identification & IP
  - Current metric reading vs. threshold
  - Direct deep-link button to open the node in the Racklyt Web or Mobile dashboard
- **Recipient Routing:** Email alerts can be directed to:
  - System-wide admin notification list
  - User-specific email addresses based on their RBAC resource scope (users only get emails for servers they are authorized to manage)
  - Specific severity levels (e.g., only send emails for `Critical` alerts, leaving `Warning` for the dashboard/phone push)

### 4.3 Self-Hosted Push & Chat Webhooks
1. **Gotify & NTFY:** Direct HTTP POST to self-hosted push notification servers with priority headers and click actions.
2. **Discord & Telegram:** Pre-formatted rich embeds (Discord) or Markdown messages (Telegram bot API).
3. **Generic Webhooks:** Configurable JSON payloads for Home Assistant, Node-RED, or custom receivers.

---

## 5. Noise Suppression, Rate Limiting & Digest Modes
- **Flap Detection:** If a node transitions between online and offline more than 3 times within 10 minutes, notifications are temporarily throttled with a *"Node is flapping"* summary.
- **Alert Batching & Digest:** If multiple nodes or VMs trigger alerts within a 60-second window (e.g. rack switch power loss), Racklyt batches them into a single consolidated email and push digest rather than flooding the user's inbox or phone with 20 individual alerts.
- **Snooze / Silence Windows:** Admins can silence alerts globally or per-node during scheduled maintenance windows.

