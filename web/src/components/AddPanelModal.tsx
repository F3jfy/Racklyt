import React, { useState } from 'react';
import {
  X,
  Plus,
  Cpu,
  Activity,
  HardDrive,
  Network,
  Thermometer,
  Layers,
  Server,
  Terminal,
  ShieldAlert,
  Radio,
} from 'lucide-react';
import { WidgetType } from '../types';

interface AddPanelModalProps {
  onClose: () => void;
  onAdd: (template: { widget_type: WidgetType; title: string; grid_w: number; config: any }) => void;
}

interface TemplateOption {
  type: WidgetType;
  title: string;
  category: 'core' | 'charts' | 'gauges' | 'containers' | 'ops';
  grid_w: number;
  description: string;
  icon: React.ReactNode;
  config: Record<string, any>;
}

export const TEMPLATES: TemplateOption[] = [
  // 1. Core & Architecture
  {
    type: 'sysinfo',
    title: 'Host Hardware Specs & OS',
    category: 'core',
    grid_w: 6,
    description: 'Detailed CPU model, cores, distro, architecture, kernel version & continuous uptime.',
    icon: <Server size={18} style={{ color: 'var(--racklyt-orange)' }} />,
    config: {},
  },
  {
    type: 'cpu-breakdown',
    title: 'Multi-Core CPU Load Distribution',
    category: 'core',
    grid_w: 6,
    description: 'Realtime allocation bars across individual processor cores with threshold alerts.',
    icon: <Cpu size={18} style={{ color: 'var(--racklyt-yellow)' }} />,
    config: { query: 'cpu_cores', unit: '%' },
  },
  {
    type: 'ports-table',
    title: 'Listening Sockets & Open Ports',
    category: 'core',
    grid_w: 6,
    description: 'Monitored TCP/UDP listening services, daemon processes, and address bindings.',
    icon: <Radio size={18} style={{ color: 'var(--racklyt-green)' }} />,
    config: {},
  },
  // 2. Charts & Time Series
  {
    type: 'time-series',
    title: 'Host & Cluster Telemetry History',
    category: 'charts',
    grid_w: 8,
    description: 'High-density SVG area curves for CPU, RAM, and Load with Racklyt Min/Max/Avg legend table.',
    icon: <Activity size={18} style={{ color: 'var(--racklyt-blue)' }} />,
    config: { query: 'cpu_overall', unit: '%' },
  },
  {
    type: 'network-traffic',
    title: 'Network Throughput & Bandwidth Hub',
    category: 'charts',
    grid_w: 6,
    description: 'Live Inbound (Rx) and Outbound (Tx) transfer rates with sparklines and cumulative GB.',
    icon: <Network size={18} style={{ color: 'var(--racklyt-cyan)' }} />,
    config: { query: 'network_traffic', unit: 'MB/s' },
  },
  // 3. Gauges & Dials (Cockpit 2/12 width standard)
  {
    type: 'circular-gauge',
    title: 'CPU Utilization Dial',
    category: 'gauges',
    grid_w: 2,
    description: 'Circular cockpit dial with perimeter ticks, 0-100% scale, and dynamic alert colors.',
    icon: <Activity size={18} style={{ color: 'var(--racklyt-orange)' }} />,
    config: { query: 'cpu_overall', unit: '%', thresholds: [{ value: 0, color: 'var(--racklyt-green)' }, { value: 70, color: 'var(--racklyt-yellow)' }, { value: 85, color: 'var(--racklyt-red)' }] },
  },
  {
    type: 'circular-gauge',
    title: 'Hardware Thermal Watchdog',
    category: 'gauges',
    grid_w: 2,
    description: 'SoC and NVMe thermal dial with 0-100°C range and critical temperature warnings.',
    icon: <Thermometer size={18} style={{ color: 'var(--racklyt-red)' }} />,
    config: { query: 'rpi_soc_temp', unit: '°C', subtitle: 'Die Thermal Sensor', thresholds: [{ value: 0, color: 'var(--racklyt-green)' }, { value: 60, color: 'var(--racklyt-yellow)' }, { value: 75, color: 'var(--racklyt-red)' }] },
  },
  {
    type: 'circular-gauge',
    title: 'RAM Memory Allocation Dial',
    category: 'gauges',
    grid_w: 2,
    description: 'Physical RAM and buffers utilization dial with high watermark threshold alerts.',
    icon: <Activity size={18} style={{ color: 'var(--racklyt-blue)' }} />,
    config: { query: 'memory_percent', unit: '%', subtitle: 'Resident Memory', thresholds: [{ value: 0, color: 'var(--racklyt-green)' }, { value: 75, color: 'var(--racklyt-yellow)' }, { value: 90, color: 'var(--racklyt-red)' }] },
  },
  {
    type: 'circular-gauge',
    title: 'Storage Pool Dial',
    category: 'gauges',
    grid_w: 2,
    description: 'Root partition or ZFS storage capacity dial with disk exhaustion alerts.',
    icon: <HardDrive size={18} style={{ color: 'var(--racklyt-green)' }} />,
    config: { query: 'disk_percent', unit: '%', subtitle: 'Primary Mount', thresholds: [{ value: 0, color: 'var(--racklyt-green)' }, { value: 80, color: 'var(--racklyt-yellow)' }, { value: 92, color: 'var(--racklyt-red)' }] },
  },
  {
    type: 'circular-gauge',
    title: 'Ingress Rx Bandwidth Dial',
    category: 'gauges',
    grid_w: 2,
    description: 'Realtime network ingress download rate dial in megabytes per second.',
    icon: <Network size={18} style={{ color: 'var(--racklyt-cyan)' }} />,
    config: { query: 'rx_bandwidth', unit: 'MB/s', subtitle: 'Inbound Stream', thresholds: [{ value: 0, color: 'var(--racklyt-cyan)' }, { value: 50, color: 'var(--racklyt-yellow)' }, { value: 100, color: 'var(--racklyt-red)' }] },
  },
  {
    type: 'circular-gauge',
    title: 'Egress Tx Bandwidth Dial',
    category: 'gauges',
    grid_w: 2,
    description: 'Realtime network egress upload rate dial in megabytes per second.',
    icon: <Network size={18} style={{ color: 'var(--racklyt-orange)' }} />,
    config: { query: 'tx_bandwidth', unit: 'MB/s', subtitle: 'Outbound Stream', thresholds: [{ value: 0, color: 'var(--racklyt-orange)' }, { value: 30, color: 'var(--racklyt-yellow)' }, { value: 80, color: 'var(--racklyt-red)' }] },
  },
  {
    type: 'storage-gauge',
    title: 'Filesystem Mounts & Storage Capacity',
    category: 'gauges',
    grid_w: 4,
    description: 'Visual progress meters for rootfs, home, and ZFS/NVMe storage partitions.',
    icon: <HardDrive size={18} style={{ color: 'var(--racklyt-green)' }} />,
    config: {},
  },
  {
    type: 'stat-card',
    title: 'Broadcom SoC Temperature',
    category: 'gauges',
    grid_w: 3,
    description: 'Compact KPI card with current thermal reading and mini load meter.',
    icon: <Thermometer size={18} style={{ color: 'var(--racklyt-yellow)' }} />,
    config: { query: 'rpi_soc_temp', unit: '°C', icon: 'temp', value: '42.6°C', subtitle: 'RPi 4B Quad Core' },
  },
  // 4. Containers & Hypervisors
  {
    type: 'docker-fleet',
    title: 'Docker Container Fleet Cockpit',
    category: 'containers',
    grid_w: 12,
    description: 'Live container table with CPU %, memory footprint, port mapping, and start/stop controls.',
    icon: <Layers size={18} style={{ color: 'var(--racklyt-purple)' }} />,
    config: {},
  },
  {
    type: 'proxmox-summary',
    title: 'Proxmox VE Cluster Node',
    category: 'containers',
    grid_w: 6,
    description: 'Virtual machines and LXC container counts, hypervisor CPU/RAM, and quorum health.',
    icon: <Server size={18} style={{ color: 'var(--racklyt-orange)' }} />,
    config: {},
  },
  // 5. Operations & Logs
  {
    type: 'fleet-status',
    title: 'Fleet Infrastructure Health Matrix',
    category: 'ops',
    grid_w: 12,
    description: 'Global overview of all enrolled nodes with online/offline indicators and IP address tags.',
    icon: <Server size={18} style={{ color: 'var(--racklyt-green)' }} />,
    config: {},
  },
  {
    type: 'recent-alerts',
    title: 'Dead-Man Watchdog & Security Alerts',
    category: 'ops',
    grid_w: 6,
    description: 'Realtime alerts feed with severity badges, missed heartbeats, and acknowledge actions.',
    icon: <ShieldAlert size={18} style={{ color: 'var(--racklyt-red)' }} />,
    config: {},
  },
  {
    type: 'log-stream',
    title: 'Realtime System & Kernel Journal',
    category: 'ops',
    grid_w: 6,
    description: 'Continuous syslog and systemd journal event stream with severity filters and pause.',
    icon: <Terminal size={18} style={{ color: 'var(--racklyt-cyan)' }} />,
    config: {},
  },
];

export const AddPanelModal: React.FC<AddPanelModalProps> = ({ onClose, onAdd }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = TEMPLATES.filter((t) => {
    const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
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
          width: 840,
          maxWidth: '95vw',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--racklyt-border-weak)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={18} style={{ color: 'var(--racklyt-orange)' }} />
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--racklyt-text-primary)' }}>
                Add Telemetry Panel
              </h3>
              <p style={{ fontSize: 11, color: 'var(--racklyt-text-muted)' }}>
                Select from {TEMPLATES.length} specialized dashboard panels and metrics
              </p>
            </div>
          </div>
          <button onClick={onClose} className="panel-action-btn" style={{ color: 'var(--racklyt-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Filter bar */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--racklyt-border-weak)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Panels' },
              { id: 'core', label: 'Host & CPU' },
              { id: 'charts', label: 'Time Series & Network' },
              { id: 'gauges', label: 'Gauges & Thermals' },
              { id: 'containers', label: 'Docker & Proxmox' },
              { id: 'ops', label: 'Alerts & Logs' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rk-btn ${selectedCategory === cat.id ? 'rk-btn-orange' : 'rk-btn-secondary'}`}
                style={{ height: 26, fontSize: 11 }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="text-input"
            style={{ height: 28, width: 200, fontSize: 11 }}
            placeholder="Search panels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Cards Grid */}
        <div
          style={{
            padding: 20,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 12,
          }}
        >
          {filtered.map((tmpl, idx) => (
            <div
              key={idx}
              onClick={() => onAdd({ widget_type: tmpl.type, title: tmpl.title, grid_w: tmpl.grid_w, config: tmpl.config })}
              style={{
                backgroundColor: 'var(--racklyt-bg-input)',
                border: '1px solid var(--racklyt-border-weak)',
                borderRadius: 'var(--panel-radius)',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--racklyt-orange)';
                e.currentTarget.style.backgroundColor = 'var(--racklyt-bg-active)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--racklyt-border-weak)';
                e.currentTarget.style.backgroundColor = 'var(--racklyt-bg-input)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {tmpl.icon}
                    <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--racklyt-text-primary)' }}>
                      {tmpl.title}
                    </h4>
                  </div>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontFamily: 'var(--font-mono)',
                      padding: '1px 5px',
                      borderRadius: 3,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      color: 'var(--racklyt-text-muted)',
                    }}
                  >
                    {tmpl.grid_w}/12 cols
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--racklyt-text-muted)', lineHeight: 1.4 }}>
                  {tmpl.description}
                </p>
              </div>

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--racklyt-orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={12} />
                  <span>Add to Dashboard</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddPanelModal;
