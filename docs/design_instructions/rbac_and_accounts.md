# Racklyt Design Instructions: Multi-Account Management & RBAC

## 1. Overview & Objectives
Racklyt supports a robust **Multi-Account Role-Based Access Control (RBAC)** architecture. Administrators can create independent user accounts and define granular access permissions so that team members, clients, or household members only view or interact with the infrastructure components they are authorized to see.

---

## 2. Core Concepts

### 2.1 User Accounts
- Every user possesses an independent username, email (optional), password (Argon2id), and profile preferences (theme, preferred dashboards).
- Accounts can be flagged as `active`, `suspended`, or `locked`.
- Sessions are isolated and auditable in the system logs.

### 2.2 Roles
Racklyt ships with predefined standard roles and allows the Admin to construct fine-grained **Custom Roles**:

| Built-in Role | Description | Typical Use Case |
| :--- | :--- | :--- |
| **SuperAdmin** | Full system control, account creation, secret management, database maintenance. | Primary server owner. |
| **Admin** | Manages nodes, alerts, dashboards, and standard user roles; cannot delete SuperAdmin. | Senior DevOps / System Administrator. |
| **Operator** | Can acknowledge alerts, edit shared dashboards, add node tags; cannot enroll or delete nodes. | Infrastructure engineer on-call. |
| **Viewer** | Read-only access to metrics, dashboards, and health status for authorized nodes. | Developers, clients, or stakeholders. |
| **Custom Role** | Arbitrary set of permissions tailored by the Administrator. | Tailored access policies. |

---

## 3. Granular Permission Scoping (Access Control Lists)

Beyond role types, Racklyt supports **Resource Scoping** based on tags, clusters, and individual nodes:

```
+--------------------------------------------------------------------------+
|                            USER: "junior-dev"                            |
|                            ROLE: "Viewer"                                |
|                                                                          |
|  Allowed Resources:                                                      |
|    - Tag: "environment:staging"                                          |
|    - Cluster: "pve-lab-01" (VMs 100-110 only)                           |
|    - Node: "rpi-garage-sensor"                                           |
|                                                                          |
|  Denied Resources:                                                       |
|    - Tag: "environment:production" (Hidden from metrics & dashboards)   |
|    - Admin configuration & user management (403 Forbidden)               |
+--------------------------------------------------------------------------+
```

### 3.1 Resource Scope Dimensions
1. **Global Access:** All nodes, clusters, and metrics visible.
2. **Tag-Based Access:** Access restricted to resources bearing specific tags (e.g. `env=staging`, `team=frontend`, `tier=internal`).
3. **Instance-Level Access:** Explicit whitelist of Node UUIDs or Proxmox Cluster IDs.
4. **Guest-Level Proxmox Access:** Ability to restrict access to specific VMIDs / LXC containers rather than the entire hypervisor.

---

## 4. Permission Matrix

| Permission Key | Description | SuperAdmin | Admin | Operator | Viewer |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `system:manage` | Edit system config, database cleanup, backups | Yes | No | No | No |
| `users:manage` | Create, edit, and delete user accounts & roles | Yes | Yes | No | No |
| `nodes:enroll` | Generate agent enrollment tokens | Yes | Yes | No | No |
| `nodes:delete` | Revoke tokens and delete node histories | Yes | Yes | No | No |
| `proxmox:manage`| Add/edit Proxmox connection tokens | Yes | Yes | No | No |
| `alerts:configure`| Create or edit alert rules and notification webhooks | Yes | Yes | Yes | No |
| `alerts:ack` | Acknowledge active alerts | Yes | Yes | Yes | No |
| `dashboard:manage_public` | Create and edit system-wide shared dashboards | Yes | Yes | Yes | No |
| `dashboard:manage_private` | Create personal private dashboards | Yes | Yes | Yes | Yes |
| `metrics:read` | Read metrics for authorized nodes | Yes | Yes | Yes | Yes |

---

## 5. Admin Interface Workflow for Account Setup

### 5.1 Account Provisioning UI
1. Navigate to **Settings $\rightarrow$ Access & Users $\rightarrow$ Add New User**.
2. Define basic credentials: Username, initial temporary password, and email.
3. Select Role: Choose a predefined role or create a custom permission set.
4. Define Resource Scope:
   - Radio: `All Infrastructure` or `Restricted Scope`.
   - Multi-select: Nodes, Proxmox Clusters, and Tags.
5. Save & Generate Invitation / Credential Handshake.

### 5.2 Real-time Enforcement
- When a user loads their dashboard, the backend filters the list of nodes, metrics, and alerts in the SQLite query based on their session's RBAC scope (`WHERE node_id IN (...)`).
- Nodes outside the user's scope do not appear in widget configuration pickers, auto-complete lists, or search bars, ensuring total data isolation.
