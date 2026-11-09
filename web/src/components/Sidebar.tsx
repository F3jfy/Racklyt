import React, { useState, useEffect } from 'react';
import {
  Server,
  Settings,
  Layers,
  Network,
  Thermometer,
  Activity,
  Plus,
  LayoutDashboard,
  Cpu,
  HardDrive,
  Shield,
  Globe,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardConfig } from '../types';
import {
  getAllCustomIcons,
  renderDynamicIcon,
  CustomIconConfig,
} from '../utils/iconRegistry';
import { IconPickerModal } from './IconPickerModal';
import { AccountSettingsModal, AVATAR_COLOR_PRESETS } from './AccountSettingsModal';

interface SidebarProps {
  currentView: 'dashboard' | 'nodes' | 'proxmox' | 'users' | 'settings';
  setCurrentView: (view: 'dashboard' | 'nodes' | 'proxmox' | 'users' | 'settings') => void;
  unreadAlertsCount: number;
  pinnedDashboards?: DashboardConfig[];
  activeDashboardId?: string;
  onSelectDashboard?: (id: string) => void;
  onOpenDashboardManager?: () => void;
  onOpenHelp?: () => void;
  onOpenActivityDrawer?: () => void;
  onOpenEnrollNode?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  pinnedDashboards = [],
  activeDashboardId,
  onSelectDashboard,
  onOpenDashboardManager,
  onOpenEnrollNode,
}) => {
  const { user } = useAuth();
  const [customIcons, setCustomIcons] = useState<Record<string, CustomIconConfig>>(() => getAllCustomIcons());
  const [editingIconTarget, setEditingIconTarget] = useState<{ id: string; title: string } | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // User avatar color preset
  const avatarKey = user ? `racklyt_avatar_${user.id}` : 'racklyt_avatar_default';
  const [avatarPresetId, setAvatarPresetId] = useState<string>(() => {
    return localStorage.getItem(avatarKey) || 'amber';
  });

  const isAdmin =
    !user ||
    user.role_id === 'role_superadmin' ||
    user.role_id === 'role_admin' ||
    user.permissions?.includes('*') ||
    user.permissions?.includes('nodes:manage');

  useEffect(() => {
    const handleUpdate = () => {
      setCustomIcons(getAllCustomIcons());
      if (user) {
        setAvatarPresetId(localStorage.getItem(`racklyt_avatar_${user.id}`) || 'amber');
      }
    };
    window.addEventListener('racklyt-icon-changed', handleUpdate);
    window.addEventListener('racklyt-avatar-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('racklyt-icon-changed', handleUpdate);
      window.removeEventListener('racklyt-avatar-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [user]);

  const currentAvatarPreset =
    AVATAR_COLOR_PRESETS.find((p) => p.id === avatarPresetId) || AVATAR_COLOR_PRESETS[0];

  const renderDashboardIcon = (id: string, title = '') => {
    const custom = customIcons[id];
    if (custom && custom.icon) {
      return renderDynamicIcon(custom.icon, custom.color, 18);
    }

    const t = (id + ' ' + title).toLowerCase();
    if (t.includes('fleet') || t.includes('master') || t.includes('all')) {
      return <LayoutDashboard size={18} style={{ color: 'var(--racklyt-cyan)' }} />;
    }
    if (t.includes('prod') || t.includes('edge') || t.includes('gateway') || t.includes('router')) {
      return <Globe size={18} style={{ color: 'var(--racklyt-blue)' }} />;
    }
    if (t.includes('proxmox') || t.includes('pve') || t.includes('hypervisor')) {
      return <Server size={18} style={{ color: 'var(--racklyt-orange)' }} />;
    }
    if (t.includes('docker') || t.includes('container') || t.includes('apps') || t.includes('microservice')) {
      return <Layers size={18} style={{ color: 'var(--racklyt-purple)' }} />;
    }
    if (t.includes('storage') || t.includes('nas') || t.includes('truenas') || t.includes('disk') || t.includes('volume') || t.includes('zfs')) {
      return <HardDrive size={18} style={{ color: 'var(--racklyt-green)' }} />;
    }
    if (t.includes('thermal') || t.includes('temp') || t.includes('hardware') || t.includes('soc')) {
      return <Thermometer size={18} style={{ color: 'var(--racklyt-red)' }} />;
    }
    if (t.includes('cpu') || t.includes('core') || t.includes('processor')) {
      return <Cpu size={18} style={{ color: 'var(--racklyt-orange)' }} />;
    }
    if (t.includes('net') || t.includes('traffic') || t.includes('bandwidth') || t.includes('port')) {
      return <Network size={18} style={{ color: 'var(--racklyt-cyan)' }} />;
    }
    if (t.includes('security') || t.includes('audit') || t.includes('watchdog')) {
      return <Shield size={18} style={{ color: 'var(--racklyt-purple)' }} />;
    }
    return <Activity size={18} style={{ color: 'var(--racklyt-green)' }} />;
  };

  return (
    <aside className="racklyt-sidebar">
      {/* Top Logo */}
      <div className="sidebar-top">
        <div
          className="sidebar-logo"
          onClick={() => {
            setCurrentView('dashboard');
          }}
          title="Racklyt Monitoring Hub"
        >
          <span className="font-mono font-black text-sm">R</span>
        </div>

        {/* Pinned Dashboards: IN THE BAR YOU SHOULD SEE JUST YOUR PINS */}
        <div className="sidebar-pinned-section">
          <div className="sidebar-pinned-list">
            {pinnedDashboards.map((dash) => {
              const isSelected = currentView === 'dashboard' && activeDashboardId === dash.id;
              return (
                <button
                  key={dash.id}
                  onClick={() => {
                    if (onSelectDashboard) onSelectDashboard(dash.id);
                    setCurrentView('dashboard');
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setEditingIconTarget({ id: dash.id, title: dash.title });
                  }}
                  className={`sidebar-nav-item ${isSelected ? 'active' : ''}`}
                  title={`${dash.title}\n(Right-click to change icon & color)`}
                >
                  {renderDashboardIcon(dash.id, dash.title)}
                </button>
              );
            })}

            {/* Add / Manage Pinned Dashboards Button */}
            {onOpenDashboardManager && (
              <button
                onClick={onOpenDashboardManager}
                className="sidebar-nav-item opacity-60 hover:opacity-100 transition"
                title="Pin or Create Dashboards (+)"
                style={{ height: 32 }}
              >
                <Plus size={15} style={{ color: 'var(--racklyt-text-muted)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Area:
          1. Admin Settings (if admin - where he can add machines and stuff)
          2. Settings
          3. Under it: The Account
      */}
      <div className="sidebar-bottom">
        {/* Admin Settings Button (Machines & Infrastructure) */}
        {isAdmin && (
          <button
            onClick={() => setCurrentView('nodes')}
            className={`sidebar-nav-item ${currentView === 'nodes' ? 'active' : ''}`}
            title="Admin Settings — Machines, Nodes & Infrastructure"
          >
            <Server size={19} className={currentView === 'nodes' ? 'text-[var(--racklyt-orange)]' : 'text-amber-400/90'} />
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={() => setCurrentView('settings')}
          className={`sidebar-nav-item ${currentView === 'settings' ? 'active' : ''}`}
          title="Settings"
        >
          <Settings size={19} />
        </button>

        {/* Account Button (Under Settings) */}
        <div
          className="sidebar-avatar cursor-pointer"
          onClick={() => setShowAccountModal(true)}
          style={{ background: currentAvatarPreset.bg }}
          title={`Signed in as ${user?.username || 'User'} (${user?.role_id ? user.role_id.replace('role_', '') : 'Admin'}) - Click for Account Settings`}
        >
          {user?.username ? user.username.charAt(0).toUpperCase() : 'A'}
        </div>
      </div>

      {/* Account Settings Popover Modal */}
      <AccountSettingsModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onNavigateToView={setCurrentView}
        onOpenEnrollNode={onOpenEnrollNode}
      />

      {/* Custom Icon Picker for Pinned Dashboard Items */}
      {editingIconTarget && (
        <IconPickerModal
          isOpen={true}
          onClose={() => setEditingIconTarget(null)}
          targetId={editingIconTarget.id}
          targetTitle={editingIconTarget.title}
          initialIcon={customIcons[editingIconTarget.id]?.icon}
          initialColor={customIcons[editingIconTarget.id]?.color}
          onApplied={() => setCustomIcons(getAllCustomIcons())}
        />
      )}
    </aside>
  );
};

export default Sidebar;
