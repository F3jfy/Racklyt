import React, { useState } from 'react';
import {
  X,
  User,
  Key,
  LogOut,
  Server,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../api/client';
import { useToast } from '../context/ToastContext';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToView: (view: 'dashboard' | 'nodes' | 'proxmox' | 'users' | 'settings') => void;
  onOpenEnrollNode?: () => void;
}

export const AVATAR_COLOR_PRESETS = [
  { id: 'amber', name: 'Amber Cyber', bg: 'linear-gradient(135deg, #f99c1c, #e02f44)' },
  { id: 'cyan', name: 'Cyan Terminal', bg: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
  { id: 'emerald', name: 'Emerald Ops', bg: 'linear-gradient(135deg, #10b981, #059669)' },
  { id: 'purple', name: 'Neon Violet', bg: 'linear-gradient(135deg, #a855f7, #6366f1)' },
  { id: 'rose', name: 'Crimson Blade', bg: 'linear-gradient(135deg, #f43f5e, #be123c)' },
  { id: 'slate', name: 'Obsidian Minimal', bg: 'linear-gradient(135deg, #475569, #1e293b)' },
];

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  onNavigateToView,
  onOpenEnrollNode,
}) => {
  const { user, logout } = useAuth();
  const toast = useToast();

  const isAdmin =
    !user ||
    user.role_id === 'role_superadmin' ||
    user.role_id === 'role_admin' ||
    user.permissions?.includes('*') ||
    user.permissions?.includes('nodes:manage');

  // Avatar preset in localStorage
  const avatarKey = user ? `racklyt_avatar_${user.id}` : 'racklyt_avatar_default';
  const [selectedAvatarPreset, setSelectedAvatarPreset] = useState<string>(() => {
    return localStorage.getItem(avatarKey) || 'amber';
  });

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Email state
  const [email, setEmail] = useState(user?.email || `${user?.username || 'admin'}@racklyt.local`);
  const [emailSaved, setEmailSaved] = useState(false);

  if (!isOpen || !user) return null;

  const currentPreset =
    AVATAR_COLOR_PRESETS.find((p) => p.id === selectedAvatarPreset) || AVATAR_COLOR_PRESETS[0];

  const handleSelectAvatar = (presetId: string) => {
    setSelectedAvatarPreset(presetId);
    localStorage.setItem(avatarKey, presetId);
    window.dispatchEvent(new Event('racklyt-avatar-changed'));
    toast.success('Profile avatar updated');
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      await ApiClient.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      toast.success('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed updating password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(`racklyt_user_email_${user.id}`, email);
    setEmailSaved(true);
    toast.success('Account email updated');
    setTimeout(() => setEmailSaved(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-scaleUp"
        style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-header)] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User size={16} className="text-[var(--racklyt-orange)]" />
            <h3 className="text-sm font-bold text-primaryText">My Account</h3>
          </div>
          <button
            onClick={onClose}
            className="text-mutedText hover:text-white p-1 rounded hover:bg-white/5 transition"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Profile Picture & Identity */}
          <div className="flex items-center space-x-4 pb-4 border-b border-[var(--racklyt-border-weak)]">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold font-mono shadow-lg shrink-0 border-2 border-white/20"
              style={{ background: currentPreset.bg }}
            >
              {user.username ? user.username.charAt(0).toUpperCase() : 'A'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-primaryText truncate">{user.username}</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--racklyt-orange)]/15 text-[var(--racklyt-orange)] border border-[var(--racklyt-orange)]/30 font-semibold">
                  {user.role_id ? user.role_id.replace('role_', '') : 'Admin'}
                </span>
              </div>
              <p className="text-[11px] text-mutedText truncate mt-0.5">{email}</p>
              <div className="flex items-center space-x-1.5 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-mono">Active Session</span>
              </div>
            </div>
          </div>

          {/* Profile Picture Colors */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-primaryText flex items-center justify-between">
              <span>Profile Avatar Style</span>
              <span className="text-[10px] text-mutedText">{currentPreset.name}</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_COLOR_PRESETS.map((preset) => {
                const isSelected = preset.id === selectedAvatarPreset;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectAvatar(preset.id)}
                    className={`h-8 rounded-lg flex items-center justify-center transition-all ${
                      isSelected ? 'ring-2 ring-[var(--racklyt-orange)] ring-offset-2 ring-offset-[var(--racklyt-bg-panel)] scale-105' : 'hover:scale-105'
                    }`}
                    style={{ background: preset.bg }}
                    title={preset.name}
                  >
                    {isSelected && <Check size={12} className="text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email Setting */}
          <form onSubmit={handleSaveEmail} className="space-y-1.5">
            <label className="text-xs font-semibold text-primaryText flex items-center justify-between">
              <span>Account Email</span>
              {emailSaved && <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1"><Check size={10} /> Saved</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded px-3 py-1.5 text-xs text-primaryText focus:border-[var(--racklyt-orange)] outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-primaryText text-xs font-medium rounded transition shrink-0"
              >
                Save
              </button>
            </div>
          </form>

          {/* Change Password Form */}
          <form onSubmit={handleSavePassword} className="space-y-2 pt-2 border-t border-[var(--racklyt-border-weak)]">
            <label className="text-xs font-semibold text-primaryText flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key size={12} className="text-[var(--racklyt-orange)]" />
                <span>Change Password</span>
              </span>
              {passwordSuccess && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Check size={10} /> Password updated
                </span>
              )}
            </label>

            <div className="space-y-1.5">
              <input
                type="password"
                placeholder="Current Password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded px-3 py-1.5 text-xs text-primaryText focus:border-[var(--racklyt-orange)] outline-none"
              />
              <input
                type="password"
                placeholder="New Password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded px-3 py-1.5 text-xs text-primaryText focus:border-[var(--racklyt-orange)] outline-none"
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded px-3 py-1.5 text-xs text-primaryText focus:border-[var(--racklyt-orange)] outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading || !newPassword}
              className="w-full py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-40 text-primaryText text-xs font-medium rounded transition"
            >
              {passwordLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>

          {/* Admin Settings Button (Machines & Fleet) */}
          {isAdmin && (
            <div className="pt-2 border-t border-[var(--racklyt-border-weak)] space-y-2">
              <div className="p-3 rounded-lg bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-medium)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-[var(--racklyt-orange)]">
                    <Server size={14} />
                    <span className="text-xs font-bold text-primaryText">Admin Settings</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">Infrastructure</span>
                </div>
                <p className="text-[11px] text-mutedText">
                  Add and enroll machines, configure kernel agent daemons, manage cluster nodes and RBAC.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToView('nodes');
                    }}
                    className="flex-1 py-1.5 px-2.5 bg-[var(--racklyt-orange)]/15 hover:bg-[var(--racklyt-orange)]/25 text-[var(--racklyt-orange)] border border-[var(--racklyt-orange)]/30 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <Server size={12} />
                    <span>Manage Machines</span>
                  </button>
                  {onOpenEnrollNode && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenEnrollNode();
                      }}
                      className="py-1.5 px-3 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black rounded text-xs font-bold transition flex items-center gap-1 shrink-0"
                      title="Enroll new machine"
                    >
                      <span>+ Add Node</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <div className="pt-2 border-t border-[var(--racklyt-border-weak)]">
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="w-full py-2 px-3 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 font-semibold text-xs rounded-lg transition flex items-center justify-center space-x-2"
            >
              <LogOut size={14} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
