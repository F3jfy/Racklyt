import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Check,
  Activity,
  Cpu,
  HardDrive,
  Network,
  Thermometer,
  Layers,
} from 'lucide-react';
import { WidgetConfig, Node } from '../types';

import {
  renderDynamicIcon,
} from '../utils/iconRegistry';
import { IconPickerModal } from './IconPickerModal';
import { CustomDropdown, DropdownOption } from './common/CustomDropdown';

interface EditPanelModalProps {
  panel: WidgetConfig | null;
  nodes: Node[];
  onClose: () => void;
  onSave: (updated: WidgetConfig) => void;
}

export const QUERY_GROUPS = [
  {
    category: 'CPU & Load',
    icon: <Cpu size={13} style={{ color: 'var(--racklyt-orange)' }} />,
    queries: [
      { value: 'cpu_overall', label: 'Overall CPU Usage (%)', defaultUnit: '%' },
      { value: 'cpu_load_1', label: 'CPU Load Average (1 min)', defaultUnit: '' },
      { value: 'cpu_load_5', label: 'CPU Load Average (5 min)', defaultUnit: '' },
      { value: 'cpu_load_15', label: 'CPU Load Average (15 min)', defaultUnit: '' },
      { value: 'cpu_cores', label: 'Individual Cores Allocation', defaultUnit: '%' },
    ],
  },
  {
    category: 'Hardware Temperatures',
    icon: <Thermometer size={13} style={{ color: 'var(--racklyt-red)' }} />,
    queries: [
      { value: 'rpi_soc_temp', label: 'Raspberry Pi SoC Temperature (°C)', defaultUnit: '°C' },
      { value: 'cpu_temp', label: 'Host CPU Package Temp (°C)', defaultUnit: '°C' },
      { value: 'nvme_temp', label: 'NVMe SSD Storage Temp (°C)', defaultUnit: '°C' },
    ],
  },
  {
    category: 'Memory & Swap',
    icon: <Activity size={13} style={{ color: 'var(--racklyt-blue)' }} />,
    queries: [
      { value: 'memory_percent', label: 'RAM Utilization (%)', defaultUnit: '%' },
      { value: 'memory_used', label: 'RAM Used (GB)', defaultUnit: 'GB' },
      { value: 'memory_free', label: 'RAM Available / Free (GB)', defaultUnit: 'GB' },
      { value: 'swap_percent', label: 'Swap / ZRAM Usage (%)', defaultUnit: '%' },
    ],
  },
  {
    category: 'Storage & I/O',
    icon: <HardDrive size={13} style={{ color: 'var(--racklyt-green)' }} />,
    queries: [
      { value: 'disk_percent', label: 'Root Partition Space Used (%)', defaultUnit: '%' },
      { value: 'disk_used', label: 'Storage Used (GB)', defaultUnit: 'GB' },
      { value: 'disk_read_speed', label: 'Disk Read Rate (MB/s)', defaultUnit: 'MB/s' },
      { value: 'disk_write_speed', label: 'Disk Write Rate (MB/s)', defaultUnit: 'MB/s' },
    ],
  },
  {
    category: 'Network & Bandwidth',
    icon: <Network size={13} style={{ color: 'var(--racklyt-cyan)' }} />,
    queries: [
      { value: 'network_rx_speed', label: 'Inbound Download Speed (Rx MB/s)', defaultUnit: 'MB/s' },
      { value: 'network_tx_speed', label: 'Outbound Upload Speed (Tx MB/s)', defaultUnit: 'MB/s' },
      { value: 'network_total_speed', label: 'Combined Throughput (MB/s)', defaultUnit: 'MB/s' },
    ],
  },
  {
    category: 'Docker & Virtualization',
    icon: <Layers size={13} style={{ color: 'var(--racklyt-purple)' }} />,
    queries: [
      { value: 'docker_running', label: 'Running Containers Count', defaultUnit: '' },
      { value: 'docker_all', label: 'Docker Fleet Status Matrix', defaultUnit: '' },
      { value: 'proxmox_vms', label: 'Proxmox Running VMs', defaultUnit: '' },
      { value: 'proxmox_lxcs', label: 'Proxmox Running LXC Containers', defaultUnit: '' },
    ],
  },
];

export const PANEL_TYPES = [
  { id: 'time-series', label: 'Time-Series Chart', desc: 'Area / line curve with min/max/avg legend' },
  { id: 'circular-gauge', label: 'Circular Gauge', desc: 'Semicircle dial with thresholds & glow' },
  { id: 'stat-card', label: 'KPI Stat Card', desc: 'Bold single number with progress indicator' },
  { id: 'storage-gauge', label: 'Storage Mounts', desc: 'Partition and disk pool capacity bars' },
  { id: 'cpu-breakdown', label: 'Multi-Core CPU', desc: 'Horizontal meters per CPU core' },
  { id: 'network-traffic', label: 'Bandwidth Hub', desc: 'Realtime Rx / Tx speed with sparklines' },
  { id: 'docker-fleet', label: 'Docker Containers', desc: 'Live container table with power actions' },
  { id: 'proxmox-summary', label: 'Proxmox VE Node', desc: 'Hypervisor VMs, LXCs and memory gauge' },
  { id: 'sysinfo', label: 'Host Hardware Specs', desc: 'OS, CPU model, kernel, architecture & uptime' },
  { id: 'recent-alerts', label: 'Alerts & Events', desc: 'Realtime dead-man switch notifications' },
  { id: 'log-stream', label: 'System Journal', desc: 'Live syslog and kernel event stream' },
  { id: 'ports-table', label: 'Listening Ports', desc: 'Network sockets, port bindings & services' },
];

export const EditPanelModal: React.FC<EditPanelModalProps> = ({
  panel,
  nodes,
  onClose,
  onSave,
}) => {
  if (!panel) return null;

  const [title, setTitle] = useState(panel.title);
  const [widgetType, setWidgetType] = useState(panel.widget_type);
  const [gridW, setGridW] = useState(panel.grid_w || 6);
  const [query, setQuery] = useState(panel.config?.query || 'cpu_overall');
  const [unit, setUnit] = useState(panel.config?.unit || '%');
  const [targetNode, setTargetNode] = useState(panel.config?.nodeId || 'all');
  const [subtitle, setSubtitle] = useState(panel.config?.subtitle || '');
  const [warnThreshold, setWarnThreshold] = useState(panel.config?.thresholds?.[1]?.value ?? 70);
  const [critThreshold, setCritThreshold] = useState(panel.config?.thresholds?.[2]?.value ?? 85);

  const [customIcon, setCustomIcon] = useState<string>(panel.config?.custom_icon || '');
  const [customIconColor, setCustomIconColor] = useState<string>(
    panel.config?.custom_icon_color || 'var(--racklyt-orange)'
  );
  const [showIconPicker, setShowIconPicker] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    for (const group of QUERY_GROUPS) {
      const q = group.queries.find((item) => item.value === val);
      if (q && q.defaultUnit !== undefined) {
        setUnit(q.defaultUnit);
      }
    }
  };

  const handleSave = () => {
    const updated: WidgetConfig = {
      ...panel,
      title,
      widget_type: widgetType,
      grid_w: gridW,
      config: {
        ...panel.config,
        query,
        unit,
        nodeId: targetNode,
        subtitle,
        custom_icon: customIcon,
        custom_icon_color: customIconColor,
        thresholds: [
          { value: 0, color: 'var(--racklyt-green)' },
          { value: Number(warnThreshold), color: 'var(--racklyt-yellow)' },
          { value: Number(critThreshold), color: 'var(--racklyt-red)' },
        ],
      },
    };
    onSave(updated);
  };

  const widthOptions: DropdownOption[] = [
    { value: '1', label: '1 / 12 (Slim Column)', description: 'Ultra compact 8.3% column' },
    { value: '2', label: '2 / 12 (Cockpit Gauge)', description: 'Standard 6-gauge cockpit row' },
    { value: '3', label: '3 / 12 (Quarter Width)', description: 'Compact 25% column' },
    { value: '4', label: '4 / 12 (One-Third Width)', description: 'Standard 3-column layout' },
    { value: '5', label: '5 / 12 (5 Columns)', description: 'Custom 41.6% column span' },
    { value: '6', label: '6 / 12 (Half Width)', description: 'Balanced 2-column layout' },
    { value: '7', label: '7 / 12 (7 Columns)', description: 'Custom 58.3% column span' },
    { value: '8', label: '8 / 12 (Two-Thirds Width)', description: 'Wide primary telemetry panel' },
    { value: '9', label: '9 / 12 (Three-Quarters)', description: 'Expansive 75% column span' },
    { value: '10', label: '10 / 12 (10 Columns)', description: 'High-density 83.3% span' },
    { value: '11', label: '11 / 12 (11 Columns)', description: 'Near full-screen 91.6% span' },
    { value: '12', label: '12 / 12 (Full Width)', description: 'Full viewport 100% span' },
  ];

  const queryOptions: DropdownOption[] = QUERY_GROUPS.flatMap((group) =>
    group.queries.map((q) => ({
      value: q.value,
      label: q.label,
      badge: group.category,
      badgeColor: group.category.includes('CPU')
        ? '#fb923c'
        : group.category.includes('Temp')
        ? '#ef4444'
        : group.category.includes('Memory')
        ? '#38bdf8'
        : group.category.includes('Storage')
        ? '#a855f7'
        : '#10b981',
      description: q.defaultUnit ? `Default Unit: ${q.defaultUnit}` : undefined,
    }))
  );

  const nodeOptions: DropdownOption[] = [
    {
      value: 'all',
      label: 'Fleet Aggregation (All Nodes)',
      badge: 'Cluster',
      badgeColor: '#38bdf8',
      description: 'Average or combine telemetry from all cluster nodes',
    },
    ...nodes.map((n) => ({
      value: n.id,
      label: `${n.name} (${n.hostname})`,
      badge: n.status === 'online' ? 'Online' : 'Offline',
      badgeColor: n.status === 'online' ? '#10b981' : '#64748b',
      description: `Node ID: ${n.id} • ${n.ip_address || 'Local'}`,
    })),
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--racklyt-bg-panel)',
          border: '1px solid var(--racklyt-border-medium)',
          borderRadius: 'var(--panel-radius)',
          width: 680,
          maxWidth: '94vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--racklyt-border-weak)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={16} style={{ color: 'var(--racklyt-orange)' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--racklyt-text-primary)' }}>
              Edit Panel Configuration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="panel-action-btn"
            style={{ color: 'var(--racklyt-text-muted)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Scroll Body */}
        <div style={{ padding: '18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Title & Grid Width */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                Panel Title & Icon
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    backgroundColor: 'var(--racklyt-bg-input)',
                    border: '1px solid var(--racklyt-border-weak)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="Click to choose custom icon & color"
                  className="hover:border-[var(--racklyt-orange)]"
                >
                  {customIcon ? (
                    renderDynamicIcon(customIcon, customIconColor, 15)
                  ) : (
                    <Activity size={15} style={{ color: 'var(--racklyt-text-muted)' }} />
                  )}
                </button>
                <input
                  type="text"
                  className="text-input"
                  style={{ flex: 1, height: 32 }}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--racklyt-text-muted)', textTransform: 'uppercase' }}>
                  Width: <span style={{ color: 'var(--racklyt-orange)', fontFamily: 'var(--font-mono)' }}>{gridW}/12</span>
                </label>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--racklyt-text-muted)' }}>
                  {Math.round((gridW / 12) * 100)}%
                </span>
              </div>

              {/* Interactive 12-Column Mouse Scrubber */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  gap: 3,
                  padding: '4px',
                  backgroundColor: 'var(--racklyt-bg-input)',
                  borderRadius: 4,
                  border: '1px solid var(--racklyt-border-weak)',
                  userSelect: 'none',
                }}
                onMouseLeave={(e) => {
                  if (e.buttons === 1) {
                    // ignore if released outside
                  }
                }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((col) => {
                  const isActive = col <= gridW;
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setGridW(col)}
                      onMouseEnter={(e) => {
                        if (e.buttons === 1) setGridW(col);
                      }}
                      style={{
                        height: 22,
                        borderRadius: 2,
                        backgroundColor: isActive ? 'var(--racklyt-orange)' : 'rgba(255,255,255,0.04)',
                        border: '1px solid ' + (isActive ? 'var(--racklyt-orange)' : 'var(--racklyt-border-subtle)'),
                        color: isActive ? '#000000' : 'var(--racklyt-text-muted)',
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all 0.1s ease',
                      }}
                      title={`Scale to ${col}/12 width (${Math.round((col / 12) * 100)}%)`}
                    >
                      {col}
                    </button>
                  );
                })}
              </div>

              <CustomDropdown
                value={String(gridW)}
                onChange={(val) => setGridW(Number(val))}
                options={widthOptions}
                size="sm"
              />
            </div>
          </div>

          {/* 2. Visualization Type */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
              Visualization Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {PANEL_TYPES.map((pt) => {
                const isSelected = widgetType === pt.id;
                return (
                  <div
                    key={pt.id}
                    onClick={() => setWidgetType(pt.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 4,
                      backgroundColor: isSelected ? 'var(--racklyt-bg-active)' : 'var(--racklyt-bg-input)',
                      border: isSelected
                        ? '1px solid var(--racklyt-orange)'
                        : '1px solid var(--racklyt-border-weak)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--racklyt-orange)' : 'var(--racklyt-text-primary)' }}>
                        {pt.label}
                      </span>
                      {isSelected && <Check size={12} style={{ color: 'var(--racklyt-orange)' }} />}
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--racklyt-text-muted)', marginTop: 2 }}>
                      {pt.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Metric Query Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                Telemetry Query
              </label>
              <CustomDropdown
                value={query}
                onChange={(val) => handleQueryChange(val)}
                options={queryOptions}
                size="sm"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                Target Fleet Node
              </label>
              <CustomDropdown
                value={targetNode}
                onChange={(val) => setTargetNode(val)}
                options={nodeOptions}
                size="sm"
              />
            </div>
          </div>

          {/* 4. Formatting & Thresholds */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                Unit Suffix
              </label>
              <input
                type="text"
                className="text-input"
                style={{ width: '100%', height: 32 }}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="%, °C, MB/s, GB..."
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-yellow)', marginBottom: 6, textTransform: 'uppercase' }}>
                Warning Cutoff
              </label>
              <input
                type="number"
                className="text-input"
                style={{ width: '100%', height: 32 }}
                value={warnThreshold}
                onChange={(e) => setWarnThreshold(Number(e.target.value))}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-red)', marginBottom: 6, textTransform: 'uppercase' }}>
                Critical Cutoff
              </label>
              <input
                type="number"
                className="text-input"
                style={{ width: '100%', height: 32 }}
                value={critThreshold}
                onChange={(e) => setCritThreshold(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Subtitle / Note */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--racklyt-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
              Subtitle / Metric Label Note (Optional)
            </label>
            <input
              type="text"
              className="text-input"
              style={{ width: '100%', height: 32 }}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Raspberry Pi SoC / NVMe Cache / eth0 WAN"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--racklyt-border-weak)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button className="rk-btn rk-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="rk-btn rk-btn-orange" onClick={handleSave}>
            <Check size={13} />
            <span>Apply Changes</span>
          </button>
        </div>
      </div>

      {/* Panel Custom Icon Picker Modal */}
      {showIconPicker && (
        <IconPickerModal
          isOpen={true}
          onClose={() => setShowIconPicker(false)}
          targetId={panel.id}
          targetTitle={title}
          initialIcon={customIcon}
          initialColor={customIconColor}
          onApplied={(icon, color) => {
            setCustomIcon(icon);
            setCustomIconColor(color);
          }}
        />
      )}
    </div>
  );
};

export default EditPanelModal;
