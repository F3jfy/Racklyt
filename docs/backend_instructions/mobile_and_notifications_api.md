# Racklyt Backend Instructions: Mobile App API & Email Notification Engine

## 1. Overview
Racklyt provides a dedicated **Mobile Application API** and a robust **Email (SMTP) Alerting Engine**. This enables seamless development of native iOS and Android companion apps with push notifications, unread badge counters, alert acknowledgment actions, and deep-linking directly into affected nodes and VMs.

---

## 2. Mobile Companion App Architecture

```
+-------------------------------------------------------------------------+
|                           RACKLYT HUB (RUST)                            |
|                                                                         |
|  +-----------------------------+     +-------------------------------+  |
|  | Alert Evaluator Engine      |     | Email Dispatcher (lettre)     |  |
|  | (Detects breach / offline)  |     | (SMTP / STARTTLS / Queue)     |  |
|  +--------------+--------------+     +---------------+---------------+  |
|                 |                                    |                  |
|                 v                                    v                  |
|  +-----------------------------+           [SMTP Mail Server]           |
|  | Notification Dispatcher     |                     |                  |
|  +----+--------------------+---+                     v                  |
|       |                    |                    User Inbox              |
|       |                    |                                            |
|       v                    v                                            |
|  [Apple APNs]        [Google FCM]                                       |
|  (HTTP/2 API)        (HTTP v1 API)                                      |
+-------+--------------------+--------------------------------------------+
        |                    |
        +--------+   +-------+
                 |   |  (Push Delivery)
                 v   v
        +--------------------+
        |  Mobile Phone App  |
        |   (iOS / Android)  |
        +---------+----------+
                  |
                  | API: /api/v1/notifications/*
                  | API: /api/v1/notifications/stream (SSE)
                  v
         [Racklyt REST Hub]
```

---

## 3. Mobile App REST API Specification

### 3.1 Device Registration & Push Tokens
When the mobile app launches, it obtains an APNs or FCM token from the OS and registers it with the Hub:

#### `POST /api/v1/devices/push`
- **Authentication:** User Session Cookie or Bearer API Token.
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "device_name": "iPhone 15 Pro",
  "platform": "ios", // "ios" | "android" | "web"
  "push_token": "740f4707bebcf74f9b7c25d48e3358945f6aa01da5ddb387462c7eaf61bb78ad",
  "app_version": "1.0.0"
}
```
- **Response `201 Created`:**
```json
{
  "device_id": "018d9f5a-e742-7a13-810a-429d201a0841",
  "status": "registered"
}
```

#### `DELETE /api/v1/devices/push/:token`
- Unregisters the device upon user logout or app uninstallation.

---

### 3.2 Notification Inbox & Badge Counters

#### `GET /api/v1/notifications`
- **Query Parameters:**
  - `page` (default: 1)
  - `limit` (default: 20, max: 100)
  - `unread_only` (`true` | `false`)
  - `severity` (`info` | `warning` | `critical`)
- **Response `200 OK`:**
```json
{
  "unread_count": 2,
  "total": 45,
  "items": [
    {
      "id": "notif_018d9f61-aa82-7231",
      "alert_id": "alert_98a72",
      "node_id": "018d9f1a-b320-7212-9842-1e92c2aa4811",
      "node_name": "rpi4-k3s-master",
      "severity": "critical",
      "title": "Heartbeat Lost: rpi4-k3s-master is Offline",
      "body": "Agent stopped reporting metrics 35 seconds ago.",
      "sent_at": 1728301540,
      "is_read": false,
      "is_acknowledged": false,
      "deep_link": "racklyt://nodes/018d9f1a-b320-7212-9842-1e92c2aa4811"
    }
  ]
}
```

#### `GET /api/v1/notifications/unread-count`
- Ultra-fast endpoint returning only `{ "unread_count": 2 }` for updating app icon badges without loading the full list.

#### `POST /api/v1/notifications/:id/ack`
- Acknowledges an active alert directly from mobile lock screen interactive notifications or in-app buttons.
- Body: `{ "note": "Investigating on site" }` (optional).

#### `POST /api/v1/notifications/ack-all`
- Marks all active notifications as acknowledged/read.

---

### 3.3 Live Push Stream (Server-Sent Events)
For battery-efficient live updates while the app is foregrounded:

#### `GET /api/v1/notifications/stream`
- **Protocol:** Server-Sent Events (`text/event-stream`).
- **Events Dispatched:**
  - `event: alert_triggered`
  - `event: alert_resolved`
  - `event: alert_acknowledged`
  - `event: ping` (keepalive heartbeat every 20s)

---

## 4. Push Notification Payload & Deep Linking

When delivering via APNs or FCM, Racklyt formats payloads to support interactive notification buttons and instant navigation:

```json
{
  "aps": {
    "alert": {
      "title": "[CRITICAL] Proxmox Host Offline",
      "body": "Node pve-node-02 lost quorum in cluster Homelab."
    },
    "badge": 1,
    "sound": "warning.caf",
    "category": "ALERT_CATEGORY" // Enables "Acknowledge" & "Mute" action buttons
  },
  "racklyt": {
    "alert_id": "alert_98a72",
    "target_type": "proxmox_node",
    "cluster_id": "cluster_main",
    "node_name": "pve-node-02",
    "deep_link": "racklyt://proxmox/cluster_main/nodes/pve-node-02"
  }
}
```

---

## 5. Email (SMTP) Alerting Engine

### 5.1 Technology Choice & Architecture
- Crate: **`lettre`** (v0.11+ with `tokio1-rustls` feature).
- **Asynchronous Queue:** Emails are placed into an in-memory channel buffer and dispatched by an async Tokio background worker. This prevents slow SMTP handshakes from blocking HTTP requests or alert evaluation.

### 5.2 Responsive Dark-Themed Email Template
Emails are formatted as **multipart MIME** (Plain text + HTML) matching Racklyt's dark gray aesthetic:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { background-color: #121316; color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; }
    .card { background-color: #1C1E24; border: 1px solid #2E323D; border-radius: 8px; padding: 24px; max-width: 580px; margin: 0 auto; }
    .badge-critical { background-color: #EF4444; color: #FFFFFF; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; text-transform: uppercase; }
    .badge-warning  { background-color: #F59E0B; color: #FFFFFF; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; text-transform: uppercase; }
    .meta-table { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 14px; }
    .meta-table td { padding: 8px 0; border-bottom: 1px solid #2E323D; }
    .meta-label { color: #9CA3AF; width: 140px; }
    .btn { display: inline-block; background-color: #06B6D4; color: #FFFFFF; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge-critical">{{severity}}</span>
    <h2 style="margin: 14px 0 6px 0; color: #FFFFFF;">{{alert_title}}</h2>
    <p style="color: #9CA3AF; margin: 0 0 16px 0;">{{alert_description}}</p>
    
    <table class="meta-table">
      <tr><td class="meta-label">Target Host:</td><td><strong>{{target_name}}</strong> ({{ip_address}})</td></tr>
      <tr><td class="meta-label">Trigger Condition:</td><td><code>{{condition_expr}}</code></td></tr>
      <tr><td class="meta-label">Triggered At:</td><td>{{triggered_time}}</td></tr>
    </table>

    <a href="{{dashboard_url}}" class="btn">View in Racklyt Dashboard</a>
  </div>
</body>
</html>
```

---

## 6. SMTP Configuration & Test API

### 6.1 `PUT /api/v1/settings/smtp`
Allows Admin to configure the mail transport:
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "username": "alerts@example.com",
  "password": "app-specific-password",
  "from_address": "Racklyt Monitoring <alerts@example.com>",
  "tls_mode": "starttls", // "none" | "starttls" | "tls"
  "is_enabled": true
}
```

### 6.2 `POST /api/v1/settings/smtp/test`
Validates connectivity, attempts TLS handshake, and sends a sample test email to the requesting admin:
```json
{
  "recipient_email": "admin@example.com"
}
```
- **Response `200 OK`:** `{ "success": true, "message": "Test email successfully sent via smtp.gmail.com:587" }`
- **Response `400 Bad Request`:** `{ "success": false, "error": "SMTP authentication failed: 535-5.7.8 Invalid credentials" }`
