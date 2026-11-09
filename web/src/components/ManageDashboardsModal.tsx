import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Star,
  Trash2,
  ExternalLink,
  Search,
  LayoutDashboard,
  Server,
  Network,
  Thermometer,
  Layers,
  Activity,
  Check,
  Download,
  Upload,
} from 'lucide-react';
import { DashboardConfig } from '../types';
import { ApiClient } from '../api/client';
import {
  getAllCustomIcons,
  renderDynamicIcon,
  CustomIconConfig,
} from '../utils/iconRegistry';
import { IconPickerModal } from './IconPickerModal';
import { CustomDropdown, DropdownOption } from './common/CustomDropdown';

interface ManageDashboardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboards: DashboardConfig[];
  activeDashboardId: string;
  pinnedDashboardIds: string[];
  onSelectDashboard: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCreateDashboard: (title: string, description: string, template: string) => Promise<void>;
  onDeleteDashboard: (id: string) => Promise<void>;
}

const TEMPLATE_OPTIONS: DropdownOption[] = [
  { value: 'blank', label: 'Blank (Empty Dashboard)', description: 'Start with a clean slate and add custom panels' },
  { value: 'current', label: 'Clone Active Dashboard', description: 'Duplicate layout and panel configs from current board' },
  { value: 'fleet', label: 'Fleet Master Cockpit', badge: 'Showcase', badgeColor: '#38bdf8', description: '1 for everything: cross-fleet health, multi-host dials, latency matrix, network, docker, logs & alerts' },
  { value: 'server_prod', label: 'Server: Production Edge Gateway', badge: 'Server 1', badgeColor: '#60a5fa', description: 'Edge proxy, Nginx/Envoy sockets, ingress/egress bandwidth dials, SSL certificates' },
  { value: 'proxmox', label: 'Server: Proxmox Hypervisor', badge: 'Server 2', badgeColor: '#fb923c', description: 'Proxmox VE cluster node, QEMU VMs, LXC containers, ZFS arc and vmbr0 network' },
  { value: 'docker', label: 'Server: Docker & Apps Fleet', badge: 'Server 3', badgeColor: '#c084fc', description: 'Docker container fleet cockpit, engine CPU/RAM, overlay network and stdout logs' },
  { value: 'server_storage', label: 'Server: TrueNAS Storage NAS', badge: 'Server 4', badgeColor: '#4ade80', description: 'ZFS raidz2 pools, NVMe cache tiers, SMB/NFS/iSCSI shares, IOPS read/write rates' },
  { value: 'thermals', label: 'Thermals & Environmental Center', badge: 'Thermals', badgeColor: '#f87171', description: 'Dedicated temperature center: SoC sensors, CPU package temps, NVMe thermals & ambient watchdogs' },
  { value: 'cpu', label: 'Processor & Multi-Core Distribution', badge: 'Compute', badgeColor: '#fbbf24', description: 'Per-core workload distribution, DVFS turbo frequencies, and normalized 1m/5m/15m system load averages' },
  { value: 'network', label: 'Network Operations & Sockets', badge: 'Networking', badgeColor: '#22d3ee', description: 'Interface bandwidth (eth0, wlan0, vmbr0), live ports audit & connection journal' },
  { value: 'storage', label: 'Storage, Volumes & Filesystems', badge: 'Storage', badgeColor: '#34d399', description: 'Storage deep-dive: ZFS & ext4 mount points, NVMe capacity dials, IOPS read/write & volume alerts' },
  { value: 'security', label: 'Security, Audits & Watchdogs', badge: 'Security', badgeColor: '#a78bfa', description: 'Security audits: exposed ports audit, failed SSH attempts, dead-man watchdogs & incident response' },
];

export const ManageDashboardsModal: React.FC<ManageDashboardsModalProps> = ({
  isOpen,
  onClose,
  dashboards,
  activeDashboardId,
  pinnedDashboardIds,
  onSelectDashboard,
  onTogglePin,
  onCreateDashboard,
  onDeleteDashboard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customIcons, setCustomIcons] = useState<Record<string, CustomIconConfig>>(() => getAllCustomIcons());
  const [editingIconTarget, setEditingIconTarget] = useState<{ id: string; title: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleExportJson = (dash: DashboardConfig) => {
    const exportPayload = {
      version: '1.0',
      type: 'racklyt_dashboard',
      title: dash.title,
      description: dash.description,
      is_public: dash.is_public,
      widgets: dash.widgets,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `racklyt-dashboard-${dash.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.title) {
        alert('Invalid dashboard template: missing title');
        return;
      }
      const widgets = Array.isArray(parsed.widgets) ? parsed.widgets : [];
      const newDash = await ApiClient.createDashboard({
        title: parsed.title.includes('(Imported)') ? parsed.title : `${parsed.title} (Imported)`,
        description: parsed.description || 'Imported from JSON template',
        is_public: !!parsed.is_public,
        widgets,
      });
      onSelectDashboard(newDash.id);
      onClose();
      window.location.reload();
    } catch (err) {
      alert('Failed to parse or import dashboard JSON file');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  useEffect(() => {
    const handleUpdate = () => {
      setCustomIcons(getAllCustomIcons());
    };
    window.addEventListener('racklyt-icon-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('racklyt-icon-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  if (!isOpen) return null;

  const filteredDashboards = dashboards.filter((d) =>
    (d.title + ' ' + (d.description || '')).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await onCreateDashboard(newTitle.trim(), newDesc.trim(), selectedTemplate);
      setNewTitle('');
      setNewDesc('');
      setShowCreateForm(false);
    } catch (err) {
      alert('Failed to create dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDashboardIcon = (id: string, title = '') => {
    const custom = customIcons[id];
    if (custom && custom.icon) {
      return renderDynamicIcon(custom.icon, custom.color, 16);
    }

    const t = (id + ' ' + title).toLowerCase();
    if (t.includes('proxmox') || t.includes('pve') || t.includes('hypervisor')) {
      return <Server size={16} style={{ color: 'var(--racklyt-orange)' }} />;
    }
    if (t.includes('net') || t.includes('traffic') || t.includes('bandwidth')) {
      return <Network size={16} style={{ color: 'var(--racklyt-cyan)' }} />;
    }
    if (t.includes('thermal') || t.includes('temp') || t.includes('hardware') || t.includes('soc')) {
      return <Thermometer size={16} style={{ color: 'var(--racklyt-red)' }} />;
    }
    if (t.includes('docker') || t.includes('container') || t.includes('microservice')) {
      return <Layers size={16} style={{ color: 'var(--racklyt-purple)' }} />;
    }
    return <Activity size={16} style={{ color: 'var(--racklyt-green)' }} />;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--racklyt-bg-panel)',
          border: '1px solid var(--racklyt-border-medium)',
          borderRadius: 6,
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid var(--racklyt-border-weak)',
            backgroundColor: 'var(--racklyt-bg-header)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutDashboard size={18} style={{ color: 'var(--racklyt-orange)' }} />
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--racklyt-text-primary)' }}>
                Dashboards Manager & Sidebar Pins
              </h2>
              <p style={{ fontSize: 11, color: 'var(--racklyt-text-muted)' }}>
                Switch active dashboard, star dashboards to pin them to the left sidebar, or create new ones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="panel-action-btn"
            style={{ color: 'var(--racklyt-text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--racklyt-border-weak)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                color: 'var(--racklyt-text-disabled)',
              }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter dashboards by name or description..."
              className="text-input"
              style={{
                width: '100%',
                height: 32,
                paddingLeft: 30,
                fontSize: 12,
              }}
            />
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rk-btn rk-btn-secondary"
            style={{ height: 32, fontSize: 12, gap: 6 }}
            title="Import dashboard layout from JSON file"
          >
            <Upload size={14} />
            <span>Import JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rk-btn rk-btn-orange"
            style={{ height: 32, fontSize: 12, gap: 6 }}
          >
            <Plus size={14} />
            <span>{showCreateForm ? 'Cancel' : 'New Dashboard'}</span>
          </button>
        </div>

        {/* Create Dashboard Inline Drawer */}
        {showCreateForm && (
          <form
            onSubmit={handleCreate}
            style={{
              padding: '14px 18px',
              backgroundColor: 'var(--racklyt-bg-input)',
              borderBottom: '1px solid var(--racklyt-border-weak)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-text-muted)', marginBottom: 4 }}>
                  Dashboard Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Storage & Backup Cockpit"
                  className="text-input"
                  style={{ width: '100%', height: 32, fontSize: 12 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-text-muted)', marginBottom: 4 }}>
                  Starter Template
                </label>
                <CustomDropdown
                  value={selectedTemplate}
                  onChange={setSelectedTemplate}
                  options={TEMPLATE_OPTIONS}
                  size="sm"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-text-muted)', marginBottom: 4 }}>
                Description (Optional)
              </label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Short summary of metrics monitored on this board..."
                className="text-input"
                style={{ width: '100%', height: 32, fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rk-btn rk-btn-secondary"
                style={{ height: 28, fontSize: 11 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newTitle.trim()}
                className="rk-btn rk-btn-orange"
                style={{ height: 28, fontSize: 11 }}
              >
                {isSubmitting ? 'Creating...' : 'Create & Open Dashboard'}
              </button>
            </div>
          </form>
        )}

        {/* Dashboard Cards List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredDashboards.map((dash) => {
            const isActive = dash.id === activeDashboardId;
            const isPinned = pinnedDashboardIds.includes(dash.id);

            return (
              <div
                key={dash.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 4,
                  backgroundColor: isActive ? 'var(--racklyt-bg-active)' : 'var(--racklyt-bg-input)',
                  border: isActive
                    ? '1px solid var(--racklyt-orange)'
                    : '1px solid var(--racklyt-border-weak)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Left info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <button
                    type="button"
                    onClick={() => setEditingIconTarget({ id: dash.id, title: dash.title })}
                    style={{
                      flexShrink: 0,
                      width: 30,
                      height: 30,
                      borderRadius: 4,
                      backgroundColor: 'var(--racklyt-bg-subtle)',
                      border: '1px solid var(--racklyt-border-weak)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Click to customize dashboard icon & color"
                    className="hover:border-[var(--racklyt-orange)]"
                  >
                    {getDashboardIcon(dash.id, dash.title)}
                  </button>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        onClick={() => {
                          onSelectDashboard(dash.id);
                          onClose();
                        }}
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isActive ? 'var(--racklyt-orange)' : 'var(--racklyt-text-primary)',
                          cursor: 'pointer',
                        }}
                        className="hover:underline truncate"
                      >
                        {dash.title}
                      </span>

                      {dash.is_default && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 3,
                            backgroundColor: 'rgba(249, 156, 28, 0.15)',
                            color: 'var(--racklyt-orange)',
                            fontWeight: 600,
                          }}
                        >
                          Default
                        </span>
                      )}

                      {isActive && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 3,
                            backgroundColor: 'rgba(115, 191, 105, 0.15)',
                            color: 'var(--racklyt-green)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Check size={10} /> Active
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 11, color: 'var(--racklyt-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dash.description || 'Custom operations center board'}
                    </p>
                  </div>
                </div>

                {/* Right actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {/* Pin / Star Toggle */}
                  <button
                    type="button"
                    onClick={() => onTogglePin(dash.id)}
                    className="fav-star-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 4,
                      backgroundColor: isPinned ? 'rgba(250, 222, 42, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: isPinned ? '1px solid var(--racklyt-yellow)' : '1px solid var(--racklyt-border-weak)',
                      color: isPinned ? 'var(--racklyt-yellow)' : 'var(--racklyt-text-muted)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                    title={isPinned ? 'Unpin from left sidebar' : 'Pin to left sidebar'}
                  >
                    <Star
                      size={13}
                      fill={isPinned ? 'var(--racklyt-yellow)' : 'none'}
                    />
                    <span>{isPinned ? 'Pinned' : 'Pin to Bar'}</span>
                  </button>

                  {/* Export JSON */}
                  <button
                    type="button"
                    onClick={() => handleExportJson(dash)}
                    className="panel-action-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--racklyt-border-weak)',
                      color: 'var(--racklyt-text-muted)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                    title="Export dashboard layout to JSON file"
                  >
                    <Download size={13} />
                    <span>Export</span>
                  </button>

                  {/* Switch to this dashboard */}
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDashboard(dash.id);
                        onClose();
                      }}
                      className="rk-btn rk-btn-secondary"
                      style={{ height: 26, fontSize: 11, padding: '0 8px', gap: 4 }}
                      title="Open this dashboard"
                    >
                      <ExternalLink size={11} />
                      <span>Open</span>
                    </button>
                  )}

                  {/* Delete (if not default) */}
                  {!dash.is_default && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Delete dashboard "${dash.title}"?`)) {
                          await onDeleteDashboard(dash.id);
                        }
                      }}
                      className="panel-action-btn"
                      style={{ color: 'var(--racklyt-red)', padding: 4 }}
                      title="Delete dashboard"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredDashboards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--racklyt-text-muted)', fontSize: 12 }}>
              No dashboards found matching "{searchTerm}".
            </div>
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: '8px 18px',
            borderTop: '1px solid var(--racklyt-border-weak)',
            backgroundColor: 'var(--racklyt-bg-canvas)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--racklyt-text-disabled)',
          }}
        >
          <span>
            {dashboards.length} dashboards available • {pinnedDashboardIds.length} pinned to left bar
          </span>
          <button
            onClick={onClose}
            className="rk-btn rk-btn-secondary"
            style={{ height: 26, fontSize: 11 }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Icon Picker Modal */}
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
    </div>
  );
};

export default ManageDashboardsModal;
