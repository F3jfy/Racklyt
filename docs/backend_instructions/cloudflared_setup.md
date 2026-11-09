# Cloudflare Tunnel (`cloudflared`) Integration Guide

## 1. Overview
Racklyt natively supports running behind **Cloudflare Tunnels (`cloudflared`)**. This allows you to securely expose your Raspberry Pi or home server to the internet without:
- Opening inbound router ports (no port forwarding)
- Exposing your public residential IP address
- Dealing with dynamic DNS (DDNS)

---

## 2. Quick Tunnel (Zero-Configuration Testing)
To instantly generate a temporary public HTTPS URL for testing:

```bash
cloudflared tunnel --url http://localhost:8443
```

This will output a live URL (e.g., `https://random-words.trycloudflare.com`) that tunnels directly to your local Racklyt Hub.

---

## 3. Production Named Tunnel Setup

### Step 1: Install `cloudflared`
On Debian / Raspberry Pi OS:
```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
```

### Step 2: Authenticate and Create Tunnel
```bash
cloudflared tunnel login
cloudflared tunnel create racklyt-monitoring
```
Note the tunnel UUID output by the command (e.g. `d3b07384-d113-469b-a912-32861c833446`).

### Step 3: Route DNS
Route your custom subdomain to the tunnel:
```bash
cloudflared tunnel route dns racklyt-monitoring racklyt.yourdomain.com
```

### Step 4: Configure Ingress (`/etc/cloudflared/config.yml`)
Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: racklyt-monitoring
credentials-file: /etc/cloudflared/d3b07384-d113-469b-a912-32861c833446.json

ingress:
  - hostname: racklyt.yourdomain.com
    service: http://localhost:8443
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

### Step 5: Run as a Systemd Service
```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

---

## 4. Cloudflare Zero Trust & SSO Pass-through
If you protect your Racklyt tunnel using Cloudflare Zero Trust Access (e.g., requiring Google, GitHub, or One-Time PIN login):
- Cloudflare automatically appends the `Cf-Access-Authenticated-User-Email` HTTP header.
- Racklyt's backend inspects this header and automatically authenticates any registered user with matching email, providing seamless Single Sign-On (SSO) with zero login friction.
