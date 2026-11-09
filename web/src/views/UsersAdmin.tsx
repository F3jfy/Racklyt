import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  CheckCircle2,
  Lock,
  Copy,
  Check,
  Server,
  RefreshCw,
  Clock,
  ShieldAlert,
  Activity,
  LogOut,
  X,
  KeyRound,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { Role, User, Node } from '../types';
import { CustomDropdown } from '../components/common/CustomDropdown';
import { useToast } from '../context/ToastContext';

export const UsersAdmin: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'sessions'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('role_operator');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [accessMode, setAccessMode] = useState<'all' | 'custom'>('custom');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');

  // Created Success Modal State
  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);

  // Edit Server Scopes Modal State
  const [editingUserScopes, setEditingUserScopes] = useState<User | null>(null);
  const [editNodeIds, setEditNodeIds] = useState<string[]>([]);
  const [editIsAll, setEditIsAll] = useState(false);
  const [editScopeLoading, setEditScopeLoading] = useState(false);

  // Generate 18-character secured password
  const generatePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*-_+=';
    const all = upper + lower + digits + symbols;

    let res = '';
    for (let i = 0; i < 2; i++) {
      res += upper[Math.floor(Math.random() * upper.length)];
      res += lower[Math.floor(Math.random() * lower.length)];
      res += digits[Math.floor(Math.random() * digits.length)];
      res += symbols[Math.floor(Math.random() * symbols.length)];
    }
    while (res.length < 18) {
      res += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle
    const arr = res.split('').sort(() => 0.5 - Math.random());
    const pass = arr.join('');
    setGeneratedPassword(pass);
    return pass;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData, nodesData] = await Promise.all([
        ApiClient.getUsers(),
        ApiClient.getRoles(),
        ApiClient.getNodes(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setNodes(nodesData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLog = async () => {
    try {
      const log = await ApiClient.getLoginAuditLog();
      setAuditLog(log);
    } catch (e) {
      console.error(e);
    }
  };

  const loadActiveSessions = async () => {
    try {
      const sess = await ApiClient.getActiveSessions();
      setActiveSessions(sess);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    generatePassword();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') loadAuditLog();
    if (activeTab === 'sessions') loadActiveSessions();
  }, [activeTab]);

  const handleOpenAddModal = () => {
    generatePassword();
    setNewUsername('');
    setNewEmail('');
    setSelectedRole('role_operator');
    setAccessMode('custom');
    setSelectedNodeIds([]);
    setError('');
    setShowAddModal(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreateLoading(true);

    try {
      const allowedNodes = accessMode === 'all' ? ['*'] : selectedNodeIds;

      const res = await ApiClient.request<any>('/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: generatedPassword,
          email: newEmail.trim() || null,
          role_id: selectedRole,
          allowed_nodes: allowedNodes,
        }),
      });

      setShowAddModal(false);
      setCreatedCredentials({
        username: newUsername.trim(),
        password: res.generated_password || generatedPassword,
      });

      toast.success(`Account "${newUsername}" created with secured credentials`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenEditScopes = (u: User) => {
    setEditingUserScopes(u);
    const hasGlobal = u.scopes?.some((s: any) => s.type === 'Global' || s.type === 'global');
    if (hasGlobal) {
      setEditIsAll(true);
      setEditNodeIds([]);
    } else {
      setEditIsAll(false);
      const nodeIds =
        u.scopes
          ?.filter((s: any) => s.type === 'Node' || s.type === 'node')
          .map((s: any) => s.value) || [];
      setEditNodeIds(nodeIds);
    }
  };

  const handleSaveUserScopes = async () => {
    if (!editingUserScopes) return;
    setEditScopeLoading(true);
    try {
      const allowedNodes = editIsAll ? ['*'] : editNodeIds;
      await ApiClient.updateUserScopes(editingUserScopes.id, allowedNodes);
      toast.success(`Server access updated for ${editingUserScopes.username}`);
      setEditingUserScopes(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update server scopes');
    } finally {
      setEditScopeLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete user "${name}"? This action cannot be undone.`))
      return;
    try {
      await ApiClient.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success(`User "${name}" deleted`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  const handleRevokeSession = async (token: string, username: string) => {
    if (!confirm(`Terminate active session for "${username}"?`)) return;
    try {
      await ApiClient.revokeSession(token);
      toast.success(`Session revoked for ${username}`);
      loadActiveSessions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke session');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Role options for CustomDropdown
  const roleOptions = roles.map((r) => ({
    value: r.id,
    label: r.name,
    badge: r.is_system ? 'System' : undefined,
    description:
      r.id === 'role_superadmin'
        ? 'Full fleet ownership, server management & settings'
        : r.id === 'role_admin'
        ? 'Server management, dashboards & alert config'
        : r.id === 'role_operator'
        ? 'Restricted to assigned servers & personal alerts'
        : 'Read-only telemetry viewer on assigned servers',
  }));

  return (
    <div className="w-full px-6 py-5 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primaryText tracking-tight flex items-center space-x-2">
            <Users className="w-5 h-5 text-[var(--racklyt-orange)]" />
            <span>Multi-Account & Access Control Center</span>
          </h2>
          <p className="text-xs text-mutedText mt-0.5">
            Provision accounts with auto-generated secure credentials, enforce 2-phase login, and scope server access
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-3.5 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold rounded text-xs flex items-center space-x-1.5 transition shadow"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision New Account</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-subtle)] p-1 rounded-lg text-xs">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-1.5 rounded flex items-center space-x-2 font-medium transition ${
            activeTab === 'users'
              ? 'bg-[var(--racklyt-bg-panel)] text-primaryText font-semibold border border-[var(--racklyt-border-medium)] shadow-sm'
              : 'text-mutedText hover:text-primaryText'
          }`}
        >
          <Shield size={14} className="text-[var(--racklyt-orange)]" />
          <span>User Accounts & Scopes</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20 text-mutedText">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-1.5 rounded flex items-center space-x-2 font-medium transition ${
            activeTab === 'audit'
              ? 'bg-[var(--racklyt-bg-panel)] text-primaryText font-semibold border border-[var(--racklyt-border-medium)] shadow-sm'
              : 'text-mutedText hover:text-primaryText'
          }`}
        >
          <Activity size={14} className="text-blue-400" />
          <span>Login Activity & Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-3.5 py-1.5 rounded flex items-center space-x-2 font-medium transition ${
            activeTab === 'sessions'
              ? 'bg-[var(--racklyt-bg-panel)] text-primaryText font-semibold border border-[var(--racklyt-border-medium)] shadow-sm'
              : 'text-mutedText hover:text-primaryText'
          }`}
        >
          <Clock size={14} className="text-emerald-400" />
          <span>Active Sessions</span>
        </button>
      </div>

      {/* ============================================================
          TAB 1: USERS LIST & SERVER SCOPES
          ============================================================ */}
      {activeTab === 'users' && (
        <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--racklyt-bg-subtle)] text-mutedText font-semibold uppercase tracking-wider border-b border-[var(--racklyt-border-weak)]">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Credential Security</th>
                <th className="py-3 px-4">2-Phase Login</th>
                <th className="py-3 px-4">Accessible Servers</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--racklyt-border-weak)] font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-mutedText font-mono">
                    Loading accounts...
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const roleObj = roles.find((r) => r.id === u.role_id);
                  const isGlobal =
                    u.role_id === 'role_superadmin' ||
                    u.scopes?.some((s: any) => s.type === 'Global' || s.type === 'global');
                  const scopedNodes =
                    u.scopes
                      ?.filter((s: any) => s.type === 'Node' || s.type === 'node')
                      .map((s: any) => s.value) || [];

                  return (
                    <tr key={u.id} className="hover:bg-[var(--racklyt-bg-subtle)] transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-primaryText flex items-center space-x-1.5">
                          <span>{u.username}</span>
                          {u.username === 'admin' && (
                            <span className="text-[10px] bg-[var(--racklyt-orange)]/20 text-[var(--racklyt-orange)] px-1.5 py-0.2 rounded font-mono border border-[var(--racklyt-orange)]/30">
                              Root
                            </span>
                          )}
                        </div>
                        {u.email && <div className="text-[11px] text-mutedText font-mono">{u.email}</div>}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] text-primaryText">
                          <Shield className="w-3 h-3 text-[var(--racklyt-orange)]" />
                          <span>{roleObj ? roleObj.name : u.role_id}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 text-[11px]">
                          <Lock size={12} className="text-emerald-400 shrink-0" />
                          <span className="text-primaryText font-medium">Locked (Immutable)</span>
                        </div>
                        <div className="text-[10.5px] text-mutedText">
                          Admin provisioned
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {u.two_factor_enabled ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 size={11} />
                            <span>Enrolled & Active</span>
                          </span>
                        ) : u.two_factor_enforced ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <ShieldAlert size={11} />
                            <span>Enforced on Next Login</span>
                          </span>
                        ) : (
                          <span className="text-mutedText text-[11px]">Optional</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                          {isGlobal ? (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                              All Fleet Nodes ({nodes.length})
                            </span>
                          ) : scopedNodes.length === 0 ? (
                            <span className="text-[11px] font-mono text-mutedText italic">
                              None Assigned (No Server Access)
                            </span>
                          ) : (
                            scopedNodes.map((nid) => (
                              <span
                                key={nid}
                                className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] text-primaryText"
                              >
                                {nid}
                              </span>
                            ))
                          )}

                          {u.username !== 'admin' && (
                            <button
                              onClick={() => handleOpenEditScopes(u)}
                              className="text-[10.5px] text-[var(--racklyt-orange)] hover:underline ml-1 font-medium"
                            >
                              Edit Access
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {u.username !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="p-1 hover:bg-rose-500/20 text-mutedText hover:text-rose-400 rounded transition"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================
          TAB 2: LOGIN ACTIVITY & AUDIT LOG
          ============================================================ */}
      {activeTab === 'audit' && (
        <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg overflow-hidden shadow-sm space-y-4">
          <div className="p-4 border-b border-[var(--racklyt-border-weak)] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-primaryText">Operator Fleet Login History</h3>
              <p className="text-[11px] text-mutedText">
                Real-time security log tracking every login attempt, IP address, and 2-phase challenge status
              </p>
            </div>
            <button
              onClick={loadAuditLog}
              className="px-2.5 py-1 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded text-xs text-primaryText flex items-center space-x-1"
            >
              <RefreshCw size={12} />
              <span>Refresh Log</span>
            </button>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--racklyt-bg-subtle)] text-mutedText font-semibold uppercase tracking-wider border-b border-[var(--racklyt-border-weak)]">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">IP Address</th>
                <th className="py-2.5 px-4">Browser / Client Agent</th>
                <th className="py-2.5 px-4">Authentication Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--racklyt-border-weak)] font-mono text-[11px]">
              {auditLog.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-mutedText">
                    No login events recorded yet.
                  </td>
                </tr>
              ) : (
                auditLog.map((item) => {
                  const isSuccess = item.status === 'success';
                  const isPending = item.status.startsWith('pending');
                  return (
                    <tr key={item.id} className="hover:bg-[var(--racklyt-bg-subtle)] transition">
                      <td className="py-2.5 px-4 text-mutedText">
                        {new Date(item.attempted_at * 1000).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-primaryText">{item.username}</td>
                      <td className="py-2.5 px-4 text-primaryText">{item.ip_address || '—'}</td>
                      <td className="py-2.5 px-4 text-mutedText max-w-xs truncate" title={item.user_agent}>
                        {item.user_agent || 'Direct API'}
                      </td>
                      <td className="py-2.5 px-4">
                        {isSuccess ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            ● Success (Authenticated)
                          </span>
                        ) : isPending ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            ● Phase 2 Challenge Pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            ✕ Failed: {item.failure_reason || item.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================
          TAB 3: ACTIVE SESSIONS
          ============================================================ */}
      {activeTab === 'sessions' && (
        <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg overflow-hidden shadow-sm space-y-4">
          <div className="p-4 border-b border-[var(--racklyt-border-weak)] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-primaryText">Currently Active Authenticated Sessions</h3>
              <p className="text-[11px] text-mutedText">
                Inspect active operator sessions and terminate suspicious or abandoned logins immediately
              </p>
            </div>
            <button
              onClick={loadActiveSessions}
              className="px-2.5 py-1 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded text-xs text-primaryText flex items-center space-x-1"
            >
              <RefreshCw size={12} />
              <span>Refresh Sessions</span>
            </button>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--racklyt-bg-subtle)] text-mutedText font-semibold uppercase tracking-wider border-b border-[var(--racklyt-border-weak)]">
              <tr>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Session Token</th>
                <th className="py-2.5 px-4">Valid Until</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--racklyt-border-weak)] font-mono text-[11px]">
              {activeSessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-mutedText">
                    No active sessions found.
                  </td>
                </tr>
              ) : (
                activeSessions.map((sess) => (
                  <tr key={sess.token} className="hover:bg-[var(--racklyt-bg-subtle)] transition">
                    <td className="py-2.5 px-4 font-bold text-primaryText">{sess.username}</td>
                    <td className="py-2.5 px-4 text-mutedText">{sess.token_snippet}</td>
                    <td className="py-2.5 px-4 text-mutedText">
                      {new Date(sess.expires_at * 1000).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleRevokeSession(sess.token, sess.username)}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[11px] flex items-center space-x-1 ml-auto transition"
                      >
                        <LogOut size={11} />
                        <span>Revoke Session</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================
          MODAL 1: PROVISION NEW ACCOUNT
          ============================================================ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded-lg w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
            <div className="px-5 py-4 border-b border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-subtle)] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-[var(--racklyt-orange)]" />
                <h3 className="font-bold text-xs text-primaryText">Provision New Operator Account</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-mutedText hover:text-primaryText"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-xs">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-primaryText">Username *</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="operator_jdoe"
                    className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono focus:border-[var(--racklyt-orange)] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-primaryText">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="operator@company.com"
                    className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono focus:border-[var(--racklyt-orange)] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-primaryText">Assigned Access Role *</label>
                <CustomDropdown
                  value={selectedRole}
                  onChange={setSelectedRole}
                  options={roleOptions}
                />
              </div>

              {/* Server Access Scoping */}
              <div className="space-y-2 pt-2 border-t border-[var(--racklyt-border-weak)]">
                <label className="font-semibold text-primaryText flex items-center justify-between">
                  <span>Server & Fleet Access Permissions</span>
                  <span className="text-[10px] text-mutedText font-normal">Node Scoping</span>
                </label>

                <div className="flex space-x-4 mb-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="accessMode"
                      checked={accessMode === 'all'}
                      onChange={() => setAccessMode('all')}
                      className="accent-[var(--racklyt-orange)]"
                    />
                    <span>All Fleet Nodes (Full Access)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="accessMode"
                      checked={accessMode === 'custom'}
                      onChange={() => setAccessMode('custom')}
                      className="accent-[var(--racklyt-orange)]"
                    />
                    <span>Specific Servers Only</span>
                  </label>
                </div>

                {accessMode === 'custom' && (
                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] max-h-36 overflow-y-auto space-y-1.5">
                    {nodes.length === 0 ? (
                      <div className="text-mutedText italic text-[11px]">No servers enrolled in fleet yet.</div>
                    ) : (
                      nodes.map((n) => (
                        <label
                          key={n.id}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-[var(--racklyt-bg-panel)] cursor-pointer"
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={selectedNodeIds.includes(n.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedNodeIds([...selectedNodeIds, n.id]);
                                } else {
                                  setSelectedNodeIds(selectedNodeIds.filter((id) => id !== n.id));
                                }
                              }}
                              className="accent-[var(--racklyt-orange)]"
                            />
                            <span className="font-semibold text-primaryText">{n.name}</span>
                            <span className="text-[10px] text-mutedText font-mono">({n.hostname})</span>
                          </div>
                          <span
                            className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded border ${
                              n.status === 'online'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {n.status}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Password Generator Box */}
              <div className="space-y-2 pt-2 border-t border-[var(--racklyt-border-weak)]">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-primaryText flex items-center space-x-1.5">
                    <KeyRound size={13} className="text-[var(--racklyt-orange)]" />
                    <span>Auto-Generated Secured Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-[10.5px] text-[var(--racklyt-orange)] hover:underline flex items-center space-x-1"
                  >
                    <RefreshCw size={10} />
                    <span>Regenerate</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono text-xs tracking-wider select-all">
                    {generatedPassword}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard(generatedPassword);
                      setCopiedPassword(true);
                      setTimeout(() => setCopiedPassword(false), 2000);
                    }}
                    className="px-3 py-2 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded text-primaryText transition flex items-center space-x-1"
                  >
                    {copiedPassword ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="p-2.5 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1 text-[11px] text-mutedText">
                  <div className="flex items-center space-x-1.5 text-primaryText font-semibold">
                    <Lock size={12} className="text-emerald-400" />
                    <span>Immutable Password & Mandatory 2-Phase Login</span>
                  </div>
                  <p>
                    This account is created with a cryptographically locked password that <strong>cannot be changed</strong> by the user. The user will be required to configure their 2-phase authenticator on first login.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--racklyt-border-weak)] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded font-medium text-mutedText"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-1.5 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold rounded shadow transition"
                >
                  {createLoading ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: CREATED CREDENTIALS SUCCESS CALLOUT
          ============================================================ */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded-lg w-full max-w-md shadow-2xl p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center space-x-2 text-emerald-400">
              <CheckCircle2 size={20} />
              <h3 className="font-bold text-sm text-primaryText">Account Credentials Created</h3>
            </div>

            <p className="text-xs text-mutedText">
              Share these credentials with the operator. Passwords are locked and cannot be changed by the operator, and 2-phase authentication will be required on first sign-in:
            </p>

            <div className="bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-medium)] rounded p-3 space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-mutedText">Username:</span>
                <span className="font-bold text-primaryText">{createdCredentials.username}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-mutedText">Secured Password:</span>
                <span className="font-bold text-[var(--racklyt-orange)] select-all">
                  {createdCredentials.password}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(
                    `Racklyt Operator Login:\nUsername: ${createdCredentials.username}\nPassword: ${createdCredentials.password}`
                  );
                }}
                className="px-3.5 py-1.5 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded text-xs text-primaryText flex items-center space-x-1.5 font-medium"
              >
                <Copy size={12} />
                <span>Copy Full Credentials</span>
              </button>

              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="px-4 py-1.5 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold rounded text-xs shadow"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 3: EDIT USER SERVER SCOPES
          ============================================================ */}
      {editingUserScopes && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded-lg w-full max-w-md shadow-2xl p-5 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[var(--racklyt-border-weak)] pb-3">
              <div className="flex items-center space-x-2">
                <Server size={15} className="text-[var(--racklyt-orange)]" />
                <h3 className="font-bold text-xs text-primaryText">
                  Server Access for {editingUserScopes.username}
                </h3>
              </div>
              <button
                onClick={() => setEditingUserScopes(null)}
                className="text-mutedText hover:text-primaryText"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsAll}
                  onChange={(e) => setEditIsAll(e.target.checked)}
                  className="accent-[var(--racklyt-orange)]"
                />
                <span className="font-semibold text-primaryText">All Fleet Nodes (Full Access)</span>
              </label>

              {!editIsAll && (
                <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] max-h-56 overflow-y-auto space-y-1.5">
                  {nodes.map((n) => (
                    <label
                      key={n.id}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-[var(--racklyt-bg-panel)] cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={editNodeIds.includes(n.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditNodeIds([...editNodeIds, n.id]);
                            } else {
                              setEditNodeIds(editNodeIds.filter((id) => id !== n.id));
                            }
                          }}
                          className="accent-[var(--racklyt-orange)]"
                        />
                        <span className="font-semibold text-primaryText">{n.name}</span>
                        <span className="text-[10px] text-mutedText font-mono">({n.hostname})</span>
                      </div>
                      <span className="text-[9.5px] font-mono text-mutedText">{n.status}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-[var(--racklyt-border-weak)]">
              <button
                type="button"
                onClick={() => setEditingUserScopes(null)}
                className="px-3 py-1.5 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded font-medium text-mutedText text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUserScopes}
                disabled={editScopeLoading}
                className="px-4 py-1.5 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold rounded text-xs shadow transition"
              >
                {editScopeLoading ? 'Saving...' : 'Save Server Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
