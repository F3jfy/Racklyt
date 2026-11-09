import { AlertRule, MetricsHistoryResponse } from '../types';

const API_BASE = '/api/v1';

export class ApiClient {
  private static getToken(): string | null {
    return localStorage.getItem('racklyt_token');
  }

  public static setToken(token: string) {
    localStorage.setItem('racklyt_token', token);
  }

  public static clearToken() {
    localStorage.removeItem('racklyt_token');
  }

  private static getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      credentials: 'include',
    });

    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      this.clearToken();
      window.dispatchEvent(new Event('racklyt_unauthorized'));
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Auth & 2FA
  public static login(credentials: { username: string; password: string }) {
    return this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  public static verify2FA(data: { temp_token: string; code: string }) {
    return this.request<{ success: boolean; token: string; user: any }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static reEnroll2FA(data: { temp_token: string }) {
    return this.request<{
      status: string;
      temp_token: string;
      totp_secret: string;
      otpauth_uri: string;
      username: string;
      message: string;
    }>('/auth/2fa/re-enroll', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static get2FAStatus() {
    return this.request<{ enabled: boolean; configured: boolean }>('/auth/2fa/status');
  }

  public static setup2FA() {
    return this.request<{ totp_secret: string; otpauth_uri: string }>('/auth/2fa/setup', {
      method: 'POST',
    });
  }

  public static enable2FA(data: { code: string }) {
    return this.request<{ success: boolean; message: string }>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static disable2FA(data?: { password?: string }) {
    return this.request<{ success: boolean; message: string }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  public static changePassword(data: { old_password: string; new_password: string }) {
    return this.request<{ success: boolean; message?: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static getLoginAuditLog() {
    return this.request<any[]>('/auth/audit-log');
  }

  public static getActiveSessions() {
    return this.request<any[]>('/auth/active-sessions');
  }

  public static revokeSession(token: string) {
    return this.request<{ success: boolean }>(`/auth/active-sessions/${token}`, { method: 'DELETE' });
  }

  public static logout() {
    return this.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  }

  public static me() {
    return this.request<any>('/auth/me');
  }

  public static updateUserScopes(userId: string, allowedNodes: string[]) {
    return this.request<{ success: boolean }>(`/users/${userId}/scopes`, {
      method: 'PUT',
      body: JSON.stringify({ allowed_nodes: allowedNodes }),
    });
  }

  // Nodes
  public static getNodes() {
    return this.request<any[]>('/nodes');
  }

  public static getNode(id: string) {
    return this.request<any>(`/nodes/${id}`);
  }

  public static deleteNode(id: string) {
    return this.request<{ success: boolean }>(`/nodes/${id}`, { method: 'DELETE' });
  }

  // Dashboards
  public static getDashboards() {
    return this.request<any[]>('/dashboards');
  }

  public static getDashboard(id: string) {
    return this.request<any>(`/dashboards/${id}`);
  }

  public static updateDashboard(id: string, data: any) {
    return this.request<{ success: boolean; id: string }>(`/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static createDashboard(data: { title: string; description?: string; is_public?: boolean; widgets?: any[] }) {
    return this.request<{ id: string; title: string }>('/dashboards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static deleteDashboard(id: string) {
    return this.request<{ success: boolean }>(`/dashboards/${id}`, {
      method: 'DELETE',
    });
  }


  // Users & Roles
  public static getUsers() {
    return this.request<any[]>('/users');
  }

  public static createUser(userData: any) {
    return this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  public static deleteUser(id: string) {
    return this.request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' });
  }

  public static getRoles() {
    return this.request<any[]>('/roles');
  }

  // Notifications
  public static getNotifications(unreadOnly = false) {
    return this.request<any[]>(`/notifications?unread_only=${unreadOnly}`);
  }

  public static getUnreadCount() {
    return this.request<{ unread_count: number }>('/notifications/unread-count');
  }

  public static ackNotification(id: string) {
    return this.request<{ success: boolean }>(`/notifications/${id}/ack`, { method: 'POST' });
  }

  // SMTP Settings
  public static getSmtp() {
    return this.request<any>('/settings/smtp');
  }

  public static updateSmtp(data: any) {
    return this.request<{ success: boolean }>('/settings/smtp', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static testSmtp(recipient: string) {
    return this.request<{ success: boolean; message: string }>('/settings/smtp/test', {
      method: 'POST',
      body: JSON.stringify({ recipient }),
    });
  }

  // System & Onboarding
  public static getSetupStatus() {
    return this.request<{
      is_setup_completed: boolean;
      node_count: number;
      instance_name: string;
      fleet_domain: string;
    }>('/system/setup-status');
  }

  public static completeSetup(data: {
    instance_name?: string;
    fleet_domain?: string;
    admin_password?: string;
    monitoring_focus?: string;
  }) {
    return this.request<{ success: boolean; message: string }>('/system/setup-complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static getSystemSettings() {
    return this.request<Record<string, string>>('/system/settings');
  }

  public static updateSystemSettings(data: Record<string, string>) {
    return this.request<{ success: boolean }>('/system/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static vacuumDatabase() {
    return this.request<{ success: boolean; message: string }>('/system/maintenance/vacuum', {
      method: 'POST',
    });
  }

  public static getDatabaseStats() {
    return this.request<{
      db_size_bytes: number;
      wal_size_bytes: number;
      metrics_count: number;
      nodes_count: number;
      alerts_count: number;
      dashboards_count: number;
    }>('/system/maintenance/stats');
  }

  public static testDiscord(webhook_url: string, bot_name?: string) {
    return this.request<{ success: boolean; message: string }>('/system/test-discord', {
      method: 'POST',
      body: JSON.stringify({ webhook_url, bot_name }),
    });
  }

  public static spawnTestNode(data: { name?: string; os?: string; tags?: string[] }) {
    return this.request<{ success: boolean; node_id: string; name: string; message: string }>('/nodes/spawn-test-node', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Node Deep Dive Diagnostics & Process/Service Management
  public static getNodeDeepDive(nodeId: string) {
    return this.request<any>(`/nodes/${encodeURIComponent(nodeId)}/deepdive`);
  }

  public static getNodeProcesses(nodeId: string, params?: { search?: string; sort_by?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.sort_by) query.set('sort_by', params.sort_by);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<any[]>(`/nodes/${encodeURIComponent(nodeId)}/processes${qs}`);
  }

  public static killNodeProcess(nodeId: string, pid: number, signal: 'TERM' | 'KILL' = 'TERM') {
    return this.request<{ success: boolean; pid: number; signal: string; message: string }>(
      `/nodes/${encodeURIComponent(nodeId)}/processes/${pid}/kill`,
      {
        method: 'POST',
        body: JSON.stringify({ signal }),
      }
    );
  }

  public static getNodeServices(nodeId: string) {
    return this.request<any[]>(`/nodes/${encodeURIComponent(nodeId)}/services`);
  }

  public static serviceAction(nodeId: string, serviceName: string, action: 'start' | 'stop' | 'restart' | 'reload') {
    return this.request<{ success: boolean; service: string; action: string; message: string }>(
      `/nodes/${encodeURIComponent(nodeId)}/services/${encodeURIComponent(serviceName)}/action`,
      {
        method: 'POST',
        body: JSON.stringify({ action }),
      }
    );
  }

  public static getNodeContainers(nodeId: string) {
    return this.request<any[]>(`/nodes/${encodeURIComponent(nodeId)}/containers`);
  }

  public static containerAction(nodeId: string, containerId: string, action: 'start' | 'stop' | 'restart') {
    return this.request<{ success: boolean; container_id: string; action: string; message: string }>(
      `/nodes/${encodeURIComponent(nodeId)}/containers/${encodeURIComponent(containerId)}/action`,
      {
        method: 'POST',
        body: JSON.stringify({ action }),
      }
    );
  }

  public static getNodeSockets(nodeId: string) {
    return this.request<any[]>(`/nodes/${encodeURIComponent(nodeId)}/sockets`);
  }

  // Proxmox Hypervisor Power Controls & Overcommit Metrics
  public static getProxmoxCluster() {
    return this.request<{ cluster: any; overcommit: any }>('/proxmox/cluster');
  }

  public static proxmoxPowerAction(targetType: 'qemu' | 'lxc', vmid: number, action: string) {
    return this.request<{ success: boolean; vmid: number; name: string; status: string; action: string; message: string }>(
      `/proxmox/${targetType}/${vmid}/action`,
      {
        method: 'POST',
        body: JSON.stringify({ target_type: targetType, action }),
      }
    );
  }

  // Dynamic Alert Rules Engine
  public static getAlertRules() {
    return this.request<AlertRule[]>('/alerts/rules');
  }

  public static createAlertRule(data: Partial<AlertRule>) {
    return this.request<AlertRule>('/alerts/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static updateAlertRule(id: string, data: Partial<AlertRule>) {
    return this.request<{ success: boolean }>(`/alerts/rules/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static toggleAlertRule(id: string) {
    return this.request<{ success: boolean }>(`/alerts/rules/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
    });
  }

  public static deleteAlertRule(id: string) {
    return this.request<{ success: boolean }>(`/alerts/rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // Historical Metrics Query Telemetry
  public static getMetricsQuery(nodeId = 'default', metric = 'cpu', range = '1h') {
    return this.request<MetricsHistoryResponse>(
      `/metrics/query?node_id=${encodeURIComponent(nodeId)}&metric=${encodeURIComponent(metric)}&range=${encodeURIComponent(range)}`
    );
  }

  // Live Container & System Journal Logs
  public static getContainerLogs(nodeId: string, containerId: string, lines = 100) {
    return this.request<{ container_id: string; lines: string[]; source: string }>(
      `/nodes/${encodeURIComponent(nodeId)}/containers/${encodeURIComponent(containerId)}/logs?lines=${lines}`
    );
  }

  public static getNodeJournal(nodeId = 'default', lines = 60) {
    return this.request<{ lines: string[]; source: string }>(
      `/nodes/${encodeURIComponent(nodeId)}/journal?lines=${lines}`
    );
  }
}

