import React, { useState, useEffect } from 'react';
import {
  Plus,
  LayoutGrid,
  RotateCcw,
  Zap,
  Radio,
  Copy,
  Check,
  Terminal,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { DashboardConfig, Node, WidgetConfig, WidgetType } from '../types';
import PanelWrapper from '../components/PanelWrapper';
import { FleetStatusWidget } from '../components/widgets/FleetStatusWidget';
import { StatCardWidget } from '../components/widgets/StatCardWidget';
import { TimeSeriesWidget } from '../components/widgets/TimeSeriesWidget';
import { CircularGaugeWidget } from '../components/widgets/CircularGaugeWidget';
import { StorageGaugeWidget } from '../components/widgets/StorageGaugeWidget';
import { AlertsFeedWidget } from '../components/widgets/AlertsFeedWidget';
import { SysinfoWidget } from '../components/widgets/SysinfoWidget';
import { CpuBreakdownWidget } from '../components/widgets/CpuBreakdownWidget';
import { NetworkTrafficWidget } from '../components/widgets/NetworkTrafficWidget';
import { DockerFleetWidget } from '../components/widgets/DockerFleetWidget';
import { ProxmoxSummaryWidget } from '../components/widgets/ProxmoxSummaryWidget';
import { LogStreamWidget } from '../components/widgets/LogStreamWidget';
import { PortsTableWidget } from '../components/widgets/PortsTableWidget';
import { EditPanelModal } from '../components/EditPanelModal';
import { AddPanelModal } from '../components/AddPanelModal';
import { EnrollNodeModal } from '../components/EnrollNodeModal';
import { useToast } from '../context/ToastContext';

interface DashboardProps {
  isEditing: boolean;
  onRegisterSave?: (saveFn: () => void) => void;
  activeDashboardId?: string;
  onDashboardLoaded?: (dash: DashboardConfig) => void;
  refreshInterval?: string;
}

export const DEFAULT_COMPLEX_WIDGETS: WidgetConfig[] = [
  {
    id: 'w_sysinfo',
    widget_type: 'sysinfo',
    title: 'Host Hardware Specs & OS',
    grid_x: 0,
    grid_y: 0,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_fleet_status',
    widget_type: 'fleet-status',
    title: 'Cluster Node Ping & Latency Matrix',
    grid_x: 6,
    grid_y: 0,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_gauge_cpu',
    widget_type: 'circular-gauge',
    title: 'CPU Utilization Dial',
    grid_x: 0,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'cpu_overall',
      unit: '%',
      value: 24.8,
      subtitle: 'Quad Core Load',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 70, color: 'var(--racklyt-yellow)' },
        { value: 85, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_gauge_temp',
    widget_type: 'circular-gauge',
    title: 'Thermal Watchdog',
    grid_x: 2,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'rpi_soc_temp',
      unit: '°C',
      value: 43.5,
      subtitle: 'Broadcom SoC Sensor',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 60, color: 'var(--racklyt-yellow)' },
        { value: 75, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_gauge_ram',
    widget_type: 'circular-gauge',
    title: 'Memory Utilization Dial',
    grid_x: 4,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'memory_percent',
      unit: '%',
      value: 54.2,
      subtitle: 'DDR4 Allocation',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 75, color: 'var(--racklyt-yellow)' },
        { value: 90, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_gauge_disk',
    widget_type: 'circular-gauge',
    title: 'NVMe Storage Pool Dial',
    grid_x: 6,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'disk_percent',
      unit: '%',
      value: 38.6,
      subtitle: 'Root Ext4 Mount',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 80, color: 'var(--racklyt-yellow)' },
        { value: 92, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_gauge_rx',
    widget_type: 'circular-gauge',
    title: 'Ingress Rx Bandwidth',
    grid_x: 8,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'rx_bandwidth',
      unit: 'MB/s',
      value: 12.8,
      subtitle: 'Gigabit Link',
      thresholds: [
        { value: 0, color: 'var(--racklyt-cyan)' },
        { value: 50, color: 'var(--racklyt-yellow)' },
        { value: 100, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_gauge_tx',
    widget_type: 'circular-gauge',
    title: 'Egress Tx Bandwidth',
    grid_x: 10,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'tx_bandwidth',
      unit: 'MB/s',
      value: 5.4,
      subtitle: 'Gigabit Link',
      thresholds: [
        { value: 0, color: 'var(--racklyt-orange)' },
        { value: 30, color: 'var(--racklyt-yellow)' },
        { value: 80, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_timeseries',
    widget_type: 'time-series',
    title: 'Host & Cluster Telemetry History',
    grid_x: 0,
    grid_y: 6,
    grid_w: 12,
    grid_h: 4,
    config: { query: 'cpu_overall', unit: '%' },
  },
  {
    id: 'w_net_traffic',
    widget_type: 'network-traffic',
    title: 'Network Throughput & Bandwidth Hub',
    grid_x: 0,
    grid_y: 10,
    grid_w: 6,
    grid_h: 4,
    config: { rxSpeedMb: 5.4, txSpeedMb: 2.1, interfaceName: 'eth0' },
  },
  {
    id: 'w_ports',
    widget_type: 'ports-table',
    title: 'Open Listening Sockets & Ports',
    grid_x: 6,
    grid_y: 10,
    grid_w: 6,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_cores',
    widget_type: 'cpu-breakdown',
    title: 'Multi-Core CPU Load Distribution',
    grid_x: 0,
    grid_y: 14,
    grid_w: 4,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_storage',
    widget_type: 'storage-gauge',
    title: 'Filesystem Mounts & Storage Capacity',
    grid_x: 4,
    grid_y: 14,
    grid_w: 4,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_proxmox',
    widget_type: 'proxmox-summary',
    title: 'Proxmox VE Cluster Node',
    grid_x: 8,
    grid_y: 14,
    grid_w: 4,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_docker',
    widget_type: 'docker-fleet',
    title: 'Docker Container Fleet Cockpit',
    grid_x: 0,
    grid_y: 17,
    grid_w: 12,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_journal',
    widget_type: 'log-stream',
    title: 'Realtime System & Kernel Journal',
    grid_x: 0,
    grid_y: 21,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_alerts',
    widget_type: 'recent-alerts',
    title: 'Dead-Man Watchdog & Security Alerts',
    grid_x: 6,
    grid_y: 21,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
];

export const DEFAULT_PROXMOX_WIDGETS: WidgetConfig[] = [
  {
    id: 'w_pve_sum',
    widget_type: 'proxmox-summary',
    title: 'Proxmox VE Cluster Node & VM/LXC Manager',
    grid_x: 0,
    grid_y: 0,
    grid_w: 8,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_pve_nodes',
    widget_type: 'fleet-status',
    title: 'Hypervisor Node Ping & Latency Matrix',
    grid_x: 8,
    grid_y: 0,
    grid_w: 4,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_pve_cpu',
    widget_type: 'circular-gauge',
    title: 'Hypervisor CPU Allocation',
    grid_x: 0,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'cpu_overall',
      unit: '%',
      value: 28.4,
      subtitle: 'EPYC Host Load',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 70, color: 'var(--racklyt-yellow)' },
        { value: 85, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_pve_ram',
    widget_type: 'circular-gauge',
    title: 'Hypervisor RAM & ZFS Arc',
    grid_x: 2,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'memory_percent',
      unit: '%',
      value: 64.2,
      subtitle: 'ZFS Arc & Guests',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 80, color: 'var(--racklyt-yellow)' },
        { value: 92, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_pve_temp',
    widget_type: 'circular-gauge',
    title: 'Die Temp Sensor',
    grid_x: 4,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'rpi_soc_temp',
      unit: '°C',
      value: 41.8,
      subtitle: 'EPYC Package',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 65, color: 'var(--racklyt-yellow)' },
        { value: 80, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_pve_iops',
    widget_type: 'circular-gauge',
    title: 'ZFS Pool Active IOPS',
    grid_x: 6,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'iops',
      unit: 'k',
      value: 11.4,
      subtitle: 'LVM-Thin I/O',
      thresholds: [
        { value: 0, color: 'var(--racklyt-cyan)' },
        { value: 25, color: 'var(--racklyt-yellow)' },
        { value: 50, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_pve_rx',
    widget_type: 'circular-gauge',
    title: 'vmbr0 Ingress Speed',
    grid_x: 8,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'rx_bandwidth',
      unit: 'MB/s',
      value: 34.2,
      subtitle: 'Host Ingress',
      thresholds: [
        { value: 0, color: 'var(--racklyt-cyan)' },
        { value: 50, color: 'var(--racklyt-yellow)' },
        { value: 100, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_pve_tx',
    widget_type: 'circular-gauge',
    title: 'vmbr0 Egress Speed',
    grid_x: 10,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'tx_bandwidth',
      unit: 'MB/s',
      value: 26.8,
      subtitle: 'Host Egress',
      thresholds: [
        { value: 0, color: 'var(--racklyt-orange)' },
        { value: 40, color: 'var(--racklyt-yellow)' },
        { value: 80, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_pve_ts',
    widget_type: 'time-series',
    title: 'VM & Container Resource Workload Timeline',
    grid_x: 0,
    grid_y: 7,
    grid_w: 12,
    grid_h: 4,
    config: { query: 'cpu_overall', unit: '%' },
  },
  {
    id: 'w_pve_net',
    widget_type: 'network-traffic',
    title: 'Bridged Virtual Network vmbr0',
    grid_x: 0,
    grid_y: 11,
    grid_w: 6,
    grid_h: 4,
    config: { rxSpeedMb: 34.2, txSpeedMb: 26.8, interfaceName: 'vmbr0' },
  },
  {
    id: 'w_pve_ports',
    widget_type: 'ports-table',
    title: 'Hypervisor API, Corosync & SPICE Ports',
    grid_x: 6,
    grid_y: 11,
    grid_w: 6,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_pve_store',
    widget_type: 'storage-gauge',
    title: 'ZFS Pools & LVM-Thin Storage Mounts',
    grid_x: 0,
    grid_y: 15,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_pve_cores',
    widget_type: 'cpu-breakdown',
    title: 'Host Physical Cores Load & Frequency',
    grid_x: 6,
    grid_y: 15,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_pve_specs',
    widget_type: 'sysinfo',
    title: 'Hypervisor Hardware & Kernel Specs',
    grid_x: 0,
    grid_y: 18,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_pve_logs',
    widget_type: 'log-stream',
    title: 'PVE Cluster Task Logs & Journal',
    grid_x: 6,
    grid_y: 18,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_pve_alerts',
    widget_type: 'recent-alerts',
    title: 'Hypervisor Watchdog & HA Alerts',
    grid_x: 0,
    grid_y: 21,
    grid_w: 12,
    grid_h: 3,
    config: {},
  },
];

export const DEFAULT_NETWORK_WIDGETS: WidgetConfig[] = [
  {
    id: 'w_net_main',
    widget_type: 'network-traffic',
    title: 'Network Throughput & Bandwidth Hub',
    grid_x: 0,
    grid_y: 0,
    grid_w: 6,
    grid_h: 4,
    config: { rxSpeedMb: 12.8, txSpeedMb: 5.4, interfaceName: 'eth0' },
  },
  {
    id: 'w_net_ports',
    widget_type: 'ports-table',
    title: 'Listening Sockets & Port Bindings',
    grid_x: 6,
    grid_y: 0,
    grid_w: 6,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_net_dial_rx',
    widget_type: 'circular-gauge',
    title: 'Download Ingress Speed',
    grid_x: 0,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'rx_bandwidth',
      unit: 'MB/s',
      value: 12.8,
      subtitle: 'Gigabit Link',
      thresholds: [
        { value: 0, color: 'var(--racklyt-cyan)' },
        { value: 50, color: 'var(--racklyt-yellow)' },
        { value: 100, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_net_dial_tx',
    widget_type: 'circular-gauge',
    title: 'Upload Egress Speed',
    grid_x: 2,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'tx_bandwidth',
      unit: 'MB/s',
      value: 5.4,
      subtitle: 'Gigabit Link',
      thresholds: [
        { value: 0, color: 'var(--racklyt-orange)' },
        { value: 30, color: 'var(--racklyt-yellow)' },
        { value: 80, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_net_dial_pps',
    widget_type: 'circular-gauge',
    title: 'Network Packet Rate',
    grid_x: 4,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'packet_rate',
      unit: 'k pps',
      value: 8.4,
      subtitle: 'NIC Rx/Tx Loops',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 20, color: 'var(--racklyt-yellow)' },
        { value: 50, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_net_dial_tcp',
    widget_type: 'circular-gauge',
    title: 'Active TCP Sockets',
    grid_x: 6,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'tcp_conns',
      unit: '',
      value: 38,
      subtitle: 'Established',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 100, color: 'var(--racklyt-yellow)' },
        { value: 300, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_net_dial_drop',
    widget_type: 'circular-gauge',
    title: 'Packet Drop Rate',
    grid_x: 8,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'drop_rate',
      unit: '%',
      value: 0.01,
      subtitle: 'NIC Errors',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 1, color: 'var(--racklyt-yellow)' },
        { value: 5, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_net_dial_lat',
    widget_type: 'circular-gauge',
    title: 'DNS / RTT Latency',
    grid_x: 10,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'dns_latency',
      unit: 'ms',
      value: 4.2,
      subtitle: 'Local Gateway',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 25, color: 'var(--racklyt-yellow)' },
        { value: 80, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_net_chart',
    widget_type: 'time-series',
    title: 'Network Interface Traffic Sparkline History',
    grid_x: 0,
    grid_y: 7,
    grid_w: 12,
    grid_h: 4,
    config: { query: 'network_rx_speed', unit: 'MB/s' },
  },
  {
    id: 'w_net_fleet',
    widget_type: 'fleet-status',
    title: 'Node Connectivity & Ping Matrix',
    grid_x: 0,
    grid_y: 11,
    grid_w: 6,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_net_specs',
    widget_type: 'sysinfo',
    title: 'Network Controller & Adapter Specs',
    grid_x: 6,
    grid_y: 11,
    grid_w: 6,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_net_cores',
    widget_type: 'cpu-breakdown',
    title: 'NIC IRQ & Packet Processing Load',
    grid_x: 0,
    grid_y: 15,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_net_shares',
    widget_type: 'storage-gauge',
    title: 'Network Shares (NFS, SMB & iSCSI Pools)',
    grid_x: 6,
    grid_y: 15,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_net_logs',
    widget_type: 'log-stream',
    title: 'Packet & Socket Event Journal',
    grid_x: 0,
    grid_y: 18,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_net_alerts',
    widget_type: 'recent-alerts',
    title: 'Network Security & Drop Alerts',
    grid_x: 6,
    grid_y: 18,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
];

export const DEFAULT_DOCKER_WIDGETS: WidgetConfig[] = [
  {
    id: 'w_doc_fleet',
    widget_type: 'docker-fleet',
    title: 'Docker Container Fleet Cockpit',
    grid_x: 0,
    grid_y: 0,
    grid_w: 12,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_doc_cpu_dial',
    widget_type: 'circular-gauge',
    title: 'Container Engine CPU Load',
    grid_x: 0,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'cpu_overall',
      unit: '%',
      value: 22.1,
      subtitle: 'Docker Daemon',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 70, color: 'var(--racklyt-yellow)' },
        { value: 85, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_doc_ram_dial',
    widget_type: 'circular-gauge',
    title: 'Containers Memory Utilization',
    grid_x: 2,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'memory_percent',
      unit: '%',
      value: 48.7,
      subtitle: 'Resident Sets',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 75, color: 'var(--racklyt-yellow)' },
        { value: 90, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_doc_pids_dial',
    widget_type: 'circular-gauge',
    title: 'Container Threads & PIDs',
    grid_x: 4,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'pids_count',
      unit: ' pids',
      value: 142,
      subtitle: 'Worker Tasks',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 300, color: 'var(--racklyt-yellow)' },
        { value: 500, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_doc_iops_dial',
    widget_type: 'circular-gauge',
    title: 'Container OverlayFS I/O',
    grid_x: 6,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'disk_io',
      unit: 'MB/s',
      value: 8.6,
      subtitle: 'Volume R/W',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 30, color: 'var(--racklyt-yellow)' },
        { value: 60, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_doc_rx_dial',
    widget_type: 'circular-gauge',
    title: 'Bridge Ingress Rx',
    grid_x: 8,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'rx_bandwidth',
      unit: 'MB/s',
      value: 18.2,
      subtitle: 'docker0 Inbound',
      thresholds: [
        { value: 0, color: 'var(--racklyt-cyan)' },
        { value: 40, color: 'var(--racklyt-yellow)' },
        { value: 80, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_doc_tx_dial',
    widget_type: 'circular-gauge',
    title: 'Bridge Egress Tx',
    grid_x: 10,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'tx_bandwidth',
      unit: 'MB/s',
      value: 14.1,
      subtitle: 'docker0 Outbound',
      thresholds: [
        { value: 0, color: 'var(--racklyt-orange)' },
        { value: 30, color: 'var(--racklyt-yellow)' },
        { value: 60, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_doc_ts',
    widget_type: 'time-series',
    title: 'Container Resource History Timeline',
    grid_x: 0,
    grid_y: 7,
    grid_w: 12,
    grid_h: 4,
    config: { query: 'cpu_overall', unit: '%' },
  },
  {
    id: 'w_doc_store',
    widget_type: 'storage-gauge',
    title: 'Docker Volumes & OverlayFS Mounts',
    grid_x: 0,
    grid_y: 11,
    grid_w: 6,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_doc_ports',
    widget_type: 'ports-table',
    title: 'Container Ingress & Port Bindings',
    grid_x: 6,
    grid_y: 11,
    grid_w: 6,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_doc_net',
    widget_type: 'network-traffic',
    title: 'Docker Bridge & Overlay Network Traffic',
    grid_x: 0,
    grid_y: 15,
    grid_w: 6,
    grid_h: 3,
    config: { rxSpeedMb: 18.2, txSpeedMb: 14.1, interfaceName: 'docker0' },
  },
  {
    id: 'w_doc_cores',
    widget_type: 'cpu-breakdown',
    title: 'Container Host Core Allocation',
    grid_x: 6,
    grid_y: 15,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_doc_specs',
    widget_type: 'sysinfo',
    title: 'Container Host Architecture & Daemon',
    grid_x: 0,
    grid_y: 18,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_doc_logs',
    widget_type: 'log-stream',
    title: 'Docker Daemon & Container Event Journal',
    grid_x: 6,
    grid_y: 18,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_doc_alerts',
    widget_type: 'recent-alerts',
    title: 'Healthcheck Fails & Restart Alerts',
    grid_x: 0,
    grid_y: 21,
    grid_w: 12,
    grid_h: 3,
    config: {},
  },
];

export const DEFAULT_HARDWARE_WIDGETS: WidgetConfig[] = [
  {
    id: 'w_hw_soc',
    widget_type: 'circular-gauge',
    title: 'Broadcom SoC Sensor',
    grid_x: 0,
    grid_y: 0,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'rpi_soc_temp',
      unit: '°C',
      value: 43.5,
      subtitle: 'BCM2711 Die Sensor',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 60, color: 'var(--racklyt-yellow)' },
        { value: 75, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_hw_pkg',
    widget_type: 'circular-gauge',
    title: 'CPU Package Die',
    grid_x: 2,
    grid_y: 0,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'pkg_temp',
      unit: '°C',
      value: 48.2,
      subtitle: 'Tdie Core Package',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 65, color: 'var(--racklyt-yellow)' },
        { value: 80, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_hw_nvme',
    widget_type: 'circular-gauge',
    title: 'NVMe Controller',
    grid_x: 4,
    grid_y: 0,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'nvme_temp',
      unit: '°C',
      value: 39.0,
      subtitle: 'PCIe 4.0 Storage',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 55, color: 'var(--racklyt-yellow)' },
        { value: 70, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_hw_vrm',
    widget_type: 'circular-gauge',
    title: 'VRM Power Stage',
    grid_x: 6,
    grid_y: 0,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'vrm_temp',
      unit: '°C',
      value: 52.1,
      subtitle: 'MOSFET Power Rail',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 70, color: 'var(--racklyt-yellow)' },
        { value: 90, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_hw_pch',
    widget_type: 'circular-gauge',
    title: 'PCH Chipset Hub',
    grid_x: 8,
    grid_y: 0,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'pch_temp',
      unit: '°C',
      value: 44.8,
      subtitle: 'Southbridge Controller',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 65, color: 'var(--racklyt-yellow)' },
        { value: 80, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_hw_ambient',
    widget_type: 'circular-gauge',
    title: 'Rack Ambient Intake',
    grid_x: 10,
    grid_y: 0,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'ambient_temp',
      unit: '°C',
      value: 23.5,
      subtitle: 'Chassis Air Intake',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 32, color: 'var(--racklyt-yellow)' },
        { value: 40, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_hw_ts',
    widget_type: 'time-series',
    title: 'Thermal History & Dynamic Clock Scaling',
    grid_x: 0,
    grid_y: 3,
    grid_w: 12,
    grid_h: 4,
    config: { query: 'cpu_overall', unit: '°C' },
  },
  {
    id: 'w_hw_cores',
    widget_type: 'cpu-breakdown',
    title: 'Per-Core Thermal State & Turbo Governors',
    grid_x: 0,
    grid_y: 7,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_hw_store',
    widget_type: 'storage-gauge',
    title: 'NVMe & SSD Flash Health (S.M.A.R.T. Telemetry)',
    grid_x: 6,
    grid_y: 7,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_hw_specs',
    widget_type: 'sysinfo',
    title: 'Thermal Controller & Kernel Power Specs',
    grid_x: 0,
    grid_y: 10,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_hw_net',
    widget_type: 'network-traffic',
    title: 'Ethernet Controller Hardware Throughput',
    grid_x: 6,
    grid_y: 10,
    grid_w: 6,
    grid_h: 3,
    config: { rxSpeedMb: 12.8, txSpeedMb: 5.4, interfaceName: 'eth0' },
  },
  {
    id: 'w_hw_ports',
    widget_type: 'ports-table',
    title: 'IPMI, BMC & Hardware Management Sockets',
    grid_x: 0,
    grid_y: 13,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_hw_fleet',
    widget_type: 'fleet-status',
    title: 'Fleet Thermal Health & Response Matrix',
    grid_x: 6,
    grid_y: 13,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_hw_journal',
    widget_type: 'log-stream',
    title: 'Kernel Journal & Thermal Throttling Logs',
    grid_x: 0,
    grid_y: 16,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_hw_alerts',
    widget_type: 'recent-alerts',
    title: 'Thermal Overheat & Undervoltage Watchdogs',
    grid_x: 6,
    grid_y: 16,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
];

export const DEFAULT_SERVER_PROD_WIDGETS: WidgetConfig[] = [
  {
    id: 'w_prod_specs',
    widget_type: 'sysinfo',
    title: 'Edge Gateway Host Specs & Kernel',
    grid_x: 0,
    grid_y: 0,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_prod_ports',
    widget_type: 'ports-table',
    title: 'Nginx, Envoy & WireGuard Edge Sockets',
    grid_x: 6,
    grid_y: 0,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_prod_dial_rx',
    widget_type: 'circular-gauge',
    title: 'Ingress CDN Throughput',
    grid_x: 0,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'rx_bandwidth',
      unit: 'MB/s',
      value: 38.4,
      subtitle: 'Fiber Uplink',
      thresholds: [
        { value: 0, color: 'var(--racklyt-cyan)' },
        { value: 60, color: 'var(--racklyt-yellow)' },
        { value: 90, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_prod_dial_tx',
    widget_type: 'circular-gauge',
    title: 'Egress Traffic Stream',
    grid_x: 2,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'tx_bandwidth',
      unit: 'MB/s',
      value: 19.2,
      subtitle: 'Fiber Uplink',
      thresholds: [
        { value: 0, color: 'var(--racklyt-orange)' },
        { value: 50, color: 'var(--racklyt-yellow)' },
        { value: 85, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_prod_dial_cpu',
    widget_type: 'circular-gauge',
    title: 'Proxy CPU Load',
    grid_x: 4,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'cpu_overall',
      unit: '%',
      value: 18.6,
      subtitle: 'Event Loops',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 70, color: 'var(--racklyt-yellow)' },
        { value: 85, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_prod_dial_ram',
    widget_type: 'circular-gauge',
    title: 'SSL Cache & Buffers',
    grid_x: 6,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'memory_percent',
      unit: '%',
      value: 34.1,
      subtitle: 'Shared Memory',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 75, color: 'var(--racklyt-yellow)' },
        { value: 90, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_prod_dial_temp',
    widget_type: 'circular-gauge',
    title: 'Edge Die Temp',
    grid_x: 8,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'rpi_soc_temp',
      unit: '°C',
      value: 42.1,
      subtitle: 'Gateway Package',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 65, color: 'var(--racklyt-yellow)' },
        { value: 80, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_prod_dial_conns',
    widget_type: 'circular-gauge',
    title: 'Active TLS Clients',
    grid_x: 10,
    grid_y: 3,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'active_conns',
      unit: '',
      value: 384,
      subtitle: 'Keepalive Conns',
      thresholds: [
        { value: 0, color: 'var(--racklyt-cyan)' },
        { value: 500, color: 'var(--racklyt-yellow)' },
        { value: 1000, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_prod_net',
    widget_type: 'network-traffic',
    title: 'Public Edge Ingress & Egress Interface',
    grid_x: 0,
    grid_y: 6,
    grid_w: 6,
    grid_h: 4,
    config: { rxSpeedMb: 38.4, txSpeedMb: 19.2, interfaceName: 'eth0' },
  },
  {
    id: 'w_prod_cores',
    widget_type: 'cpu-breakdown',
    title: 'NIC IRQ Affinity & Processing Cores',
    grid_x: 6,
    grid_y: 6,
    grid_w: 6,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_prod_chart',
    widget_type: 'time-series',
    title: 'Edge Inbound Traffic & HTTP Request Timeline',
    grid_x: 0,
    grid_y: 10,
    grid_w: 12,
    grid_h: 4,
    config: { query: 'network_rx_speed', unit: 'MB/s' },
  },
  {
    id: 'w_prod_logs',
    widget_type: 'log-stream',
    title: 'Edge Proxy Access & TLS Handshake Journal',
    grid_x: 0,
    grid_y: 14,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_prod_alerts',
    widget_type: 'recent-alerts',
    title: 'DDoS, Rate-Limit & Certificate Expiry Alerts',
    grid_x: 6,
    grid_y: 14,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
];

export const DEFAULT_SERVER_STORAGE_WIDGETS: WidgetConfig[] = [
  {
    id: 'w_nas_store',
    widget_type: 'storage-gauge',
    title: 'ZFS Storage Pools & RAIDZ Datasets',
    grid_x: 0,
    grid_y: 0,
    grid_w: 8,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_nas_ports',
    widget_type: 'ports-table',
    title: 'NFS, SMB, iSCSI & S3 Storage Sockets',
    grid_x: 8,
    grid_y: 0,
    grid_w: 4,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_nas_dial_cap',
    widget_type: 'circular-gauge',
    title: 'ZFS Pool Allocation Dial',
    grid_x: 0,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'disk_percent',
      unit: '%',
      value: 48.2,
      subtitle: 'RAIDZ2 Pool',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 80, color: 'var(--racklyt-yellow)' },
        { value: 92, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_nas_dial_arc',
    widget_type: 'circular-gauge',
    title: 'ZFS ARC Hit Ratio Dial',
    grid_x: 2,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'arc_hit',
      unit: '%',
      value: 94.6,
      subtitle: 'L1/L2 ARC Cache',
      thresholds: [
        { value: 0, color: 'var(--racklyt-red)' },
        { value: 85, color: 'var(--racklyt-yellow)' },
        { value: 90, color: 'var(--racklyt-green)' },
      ],
    },
  },
  {
    id: 'w_nas_dial_temp',
    widget_type: 'circular-gauge',
    title: 'NVMe & SAS Flash Drive Thermals',
    grid_x: 4,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'drive_temp',
      unit: '°C',
      value: 36.2,
      subtitle: 'S.M.A.R.T. Array',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 45, color: 'var(--racklyt-yellow)' },
        { value: 55, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_nas_dial_iops',
    widget_type: 'circular-gauge',
    title: 'Storage Array Read/Write IOPS',
    grid_x: 6,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'iops',
      unit: 'k',
      value: 14.8,
      subtitle: 'NVMe Metadata Tier',
      thresholds: [
        { value: 0, color: 'var(--racklyt-cyan)' },
        { value: 30, color: 'var(--racklyt-yellow)' },
        { value: 60, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_nas_dial_read',
    widget_type: 'circular-gauge',
    title: 'Array Read Bandwidth',
    grid_x: 8,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'read_speed',
      unit: 'MB/s',
      value: 124.6,
      subtitle: 'Continuous Read',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 200, color: 'var(--racklyt-yellow)' },
        { value: 500, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_nas_dial_write',
    widget_type: 'circular-gauge',
    title: 'Array Write Bandwidth',
    grid_x: 10,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'write_speed',
      unit: 'MB/s',
      value: 48.2,
      subtitle: 'Continuous Write',
      thresholds: [
        { value: 0, color: 'var(--racklyt-orange)' },
        { value: 150, color: 'var(--racklyt-yellow)' },
        { value: 300, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_nas_chart',
    widget_type: 'time-series',
    title: 'Block I/O Bandwidth & IOPS Telemetry History',
    grid_x: 0,
    grid_y: 7,
    grid_w: 12,
    grid_h: 4,
    config: { query: 'iops_history', unit: 'MB/s' },
  },
  {
    id: 'w_nas_net',
    widget_type: 'network-traffic',
    title: 'Storage Network 10GbE SFP+ Traffic',
    grid_x: 0,
    grid_y: 11,
    grid_w: 6,
    grid_h: 4,
    config: { rxSpeedMb: 42.1, txSpeedMb: 68.4, interfaceName: 'eth0' },
  },
  {
    id: 'w_nas_cores',
    widget_type: 'cpu-breakdown',
    title: 'ZFS LZ4 & SHA256 Checksum Core Co-Processors',
    grid_x: 6,
    grid_y: 11,
    grid_w: 6,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_nas_specs',
    widget_type: 'sysinfo',
    title: 'TrueNAS SCALE Host & SAS HBA Controller',
    grid_x: 0,
    grid_y: 15,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_nas_logs',
    widget_type: 'log-stream',
    title: 'ZFS Scrub, SMART & Sync Journal',
    grid_x: 6,
    grid_y: 15,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_nas_alerts',
    widget_type: 'recent-alerts',
    title: 'Storage Pool Degradation & Drive Reallocated Sectors',
    grid_x: 0,
    grid_y: 18,
    grid_w: 12,
    grid_h: 3,
    config: {},
  },
];

export const DEFAULT_CPU_WIDGETS: WidgetConfig[] = [
  {
    id: 'w_cpu_cores_full',
    widget_type: 'cpu-breakdown',
    title: 'Physical Multi-Core Load Distribution & Governors',
    grid_x: 0,
    grid_y: 0,
    grid_w: 8,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_cpu_specs_full',
    widget_type: 'sysinfo',
    title: 'CPU Architecture, Cache & AVX Flags',
    grid_x: 8,
    grid_y: 0,
    grid_w: 4,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_cpu_d1',
    widget_type: 'circular-gauge',
    title: '1-Min Load Avg',
    grid_x: 0,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'cpu_overall',
      unit: '%',
      value: 22.4,
      subtitle: 'Normalized 1m',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 70, color: 'var(--racklyt-yellow)' },
        { value: 85, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_cpu_d5',
    widget_type: 'circular-gauge',
    title: '5-Min Load Avg',
    grid_x: 2,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'cpu_overall',
      unit: '%',
      value: 19.8,
      subtitle: 'Normalized 5m',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 70, color: 'var(--racklyt-yellow)' },
        { value: 85, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_cpu_d15',
    widget_type: 'circular-gauge',
    title: '15-Min Load Avg',
    grid_x: 4,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'cpu_overall',
      unit: '%',
      value: 17.5,
      subtitle: 'Normalized 15m',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 70, color: 'var(--racklyt-yellow)' },
        { value: 85, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_cpu_d_util',
    widget_type: 'circular-gauge',
    title: 'Core Utilization',
    grid_x: 6,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'cpu_overall',
      unit: '%',
      value: 24.8,
      subtitle: 'All Cores Aggregate',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 70, color: 'var(--racklyt-yellow)' },
        { value: 85, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_cpu_d_temp',
    widget_type: 'circular-gauge',
    title: 'Package Die Temp',
    grid_x: 8,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'rpi_soc_temp',
      unit: '°C',
      value: 46.2,
      subtitle: 'Tctl / Tdie',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 65, color: 'var(--racklyt-yellow)' },
        { value: 80, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_cpu_d_cs',
    widget_type: 'circular-gauge',
    title: 'Context Switches',
    grid_x: 10,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'context_switches',
      unit: 'k/s',
      value: 18.2,
      subtitle: 'Scheduler IRQ',
      thresholds: [
        { value: 0, color: 'var(--racklyt-cyan)' },
        { value: 30, color: 'var(--racklyt-yellow)' },
        { value: 60, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_cpu_chart_full',
    widget_type: 'time-series',
    title: 'Processor Frequency Scaling & Thread Load History',
    grid_x: 0,
    grid_y: 7,
    grid_w: 12,
    grid_h: 4,
    config: { query: 'cpu_overall', unit: '%' },
  },
  {
    id: 'w_cpu_ports_proc',
    widget_type: 'ports-table',
    title: 'Compute Intensive Processes & Socket Affinity',
    grid_x: 0,
    grid_y: 11,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_cpu_logs_full',
    widget_type: 'log-stream',
    title: 'Kernel Scheduler & CPU Throttling Logs',
    grid_x: 6,
    grid_y: 11,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_cpu_alerts_full',
    widget_type: 'recent-alerts',
    title: 'CPU Overload & Stuck Thread Watchdogs',
    grid_x: 0,
    grid_y: 14,
    grid_w: 12,
    grid_h: 3,
    config: {},
  },
];

export const DEFAULT_STORAGE_WIDGETS: WidgetConfig[] = [
  {
    id: 'w_storage_main',
    widget_type: 'storage-gauge',
    title: 'Filesystem Mounts & Storage Capacity',
    grid_x: 0,
    grid_y: 0,
    grid_w: 8,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_storage_ports',
    widget_type: 'ports-table',
    title: 'Storage Protocols & Share Bindings',
    grid_x: 8,
    grid_y: 0,
    grid_w: 4,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_str_root',
    widget_type: 'circular-gauge',
    title: 'Root Filesystem NVMe',
    grid_x: 0,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'disk_percent',
      unit: '%',
      value: 38.6,
      subtitle: '/dev/nvme0n1p2',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 80, color: 'var(--racklyt-yellow)' },
        { value: 92, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_str_tank',
    widget_type: 'circular-gauge',
    title: 'ZFS Tank Pool Usage',
    grid_x: 2,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'disk_percent',
      unit: '%',
      value: 52.4,
      subtitle: 'RAIDZ2 Pool',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 80, color: 'var(--racklyt-yellow)' },
        { value: 92, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_str_nvme_wear',
    widget_type: 'circular-gauge',
    title: 'NVMe Flash Wear Life',
    grid_x: 4,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'wear_life',
      unit: '%',
      value: 98.0,
      subtitle: 'S.M.A.R.T. Endurance',
      thresholds: [
        { value: 0, color: 'var(--racklyt-red)' },
        { value: 70, color: 'var(--racklyt-yellow)' },
        { value: 90, color: 'var(--racklyt-green)' },
      ],
    },
  },
  {
    id: 'w_str_read',
    widget_type: 'circular-gauge',
    title: 'Read Speed Rate',
    grid_x: 6,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'read_speed',
      unit: 'MB/s',
      value: 124.8,
      subtitle: 'Continuous Read',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 200, color: 'var(--racklyt-yellow)' },
        { value: 500, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_str_write',
    widget_type: 'circular-gauge',
    title: 'Write Speed Rate',
    grid_x: 8,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'write_speed',
      unit: 'MB/s',
      value: 48.6,
      subtitle: 'Continuous Write',
      thresholds: [
        { value: 0, color: 'var(--racklyt-orange)' },
        { value: 150, color: 'var(--racklyt-yellow)' },
        { value: 300, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_str_iops',
    widget_type: 'circular-gauge',
    title: 'Disk I/O Queue Ops',
    grid_x: 10,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'iops',
      unit: 'k',
      value: 12.4,
      subtitle: 'Array Queue Depth',
      thresholds: [
        { value: 0, color: 'var(--racklyt-cyan)' },
        { value: 30, color: 'var(--racklyt-yellow)' },
        { value: 60, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_str_chart',
    widget_type: 'time-series',
    title: 'Block I/O & Filesystem Read/Write Bandwidth',
    grid_x: 0,
    grid_y: 7,
    grid_w: 12,
    grid_h: 4,
    config: { query: 'disk_io', unit: 'MB/s' },
  },
  {
    id: 'w_str_specs',
    widget_type: 'sysinfo',
    title: 'Storage Controller, NVMe & SMART Health',
    grid_x: 0,
    grid_y: 11,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_str_logs',
    widget_type: 'log-stream',
    title: 'Storage Subsystem & Filesystem Journal',
    grid_x: 6,
    grid_y: 11,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_str_alerts',
    widget_type: 'recent-alerts',
    title: 'Storage Degradation & Low Space Watchdogs',
    grid_x: 0,
    grid_y: 14,
    grid_w: 12,
    grid_h: 3,
    config: {},
  },
];

export const DEFAULT_SECURITY_WIDGETS: WidgetConfig[] = [
  {
    id: 'w_sec_ports',
    widget_type: 'ports-table',
    title: 'Open Listening Sockets & Exposure Audit (0.0.0.0 vs Loopback)',
    grid_x: 0,
    grid_y: 0,
    grid_w: 7,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_sec_nodes',
    widget_type: 'fleet-status',
    title: 'Fleet Security & Node Quorum Ping Matrix',
    grid_x: 7,
    grid_y: 0,
    grid_w: 5,
    grid_h: 4,
    config: {},
  },
  {
    id: 'w_sec_dial_open',
    widget_type: 'circular-gauge',
    title: 'Public Exposed Ports',
    grid_x: 0,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'exposed_ports',
      unit: ' ports',
      value: 4,
      subtitle: 'SSH, TLS, VPN',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 5, color: 'var(--racklyt-yellow)' },
        { value: 10, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_sec_dial_auth',
    widget_type: 'circular-gauge',
    title: 'Failed Auth (24h)',
    grid_x: 2,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'auth_fails',
      unit: '',
      value: 2,
      subtitle: 'Fail2ban Blocked',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 10, color: 'var(--racklyt-yellow)' },
        { value: 50, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_sec_dial_health',
    widget_type: 'circular-gauge',
    title: 'Security Score',
    grid_x: 4,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'security_score',
      unit: '%',
      value: 98.4,
      subtitle: 'CIS Benchmark',
      thresholds: [
        { value: 0, color: 'var(--racklyt-red)' },
        { value: 80, color: 'var(--racklyt-yellow)' },
        { value: 95, color: 'var(--racklyt-green)' },
      ],
    },
  },
  {
    id: 'w_sec_dial_tls',
    widget_type: 'circular-gauge',
    title: 'TLS Cert Validity',
    grid_x: 6,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'cert_days',
      unit: 'd',
      value: 74,
      subtitle: 'Auto-Renew Active',
      thresholds: [
        { value: 0, color: 'var(--racklyt-red)' },
        { value: 14, color: 'var(--racklyt-yellow)' },
        { value: 30, color: 'var(--racklyt-green)' },
      ],
    },
  },
  {
    id: 'w_sec_dial_fw',
    widget_type: 'circular-gauge',
    title: 'Firewall Drop Rate',
    grid_x: 8,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'fw_drops',
      unit: 'p/s',
      value: 12.8,
      subtitle: 'nftables Blocks',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 100, color: 'var(--racklyt-yellow)' },
        { value: 500, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_sec_dial_ssh',
    widget_type: 'circular-gauge',
    title: 'Active SSH Root',
    grid_x: 10,
    grid_y: 4,
    grid_w: 2,
    grid_h: 3,
    config: {
      query: 'ssh_sessions',
      unit: '',
      value: 1,
      subtitle: 'Active Sessions',
      thresholds: [
        { value: 0, color: 'var(--racklyt-green)' },
        { value: 3, color: 'var(--racklyt-yellow)' },
        { value: 6, color: 'var(--racklyt-red)' },
      ],
    },
  },
  {
    id: 'w_sec_chart',
    widget_type: 'time-series',
    title: 'Security Events, Drop Rates & Port Probes History',
    grid_x: 0,
    grid_y: 7,
    grid_w: 12,
    grid_h: 4,
    config: { query: 'security_drops', unit: 'drops/s' },
  },
  {
    id: 'w_sec_logs',
    widget_type: 'log-stream',
    title: 'Authentication, SSH & Sudo Audit Journal',
    grid_x: 0,
    grid_y: 11,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
  {
    id: 'w_sec_alerts',
    widget_type: 'recent-alerts',
    title: 'Dead-Man Watchdogs & Security Incident Alerts',
    grid_x: 6,
    grid_y: 11,
    grid_w: 6,
    grid_h: 3,
    config: {},
  },
];

export const SHOWCASE_PRESETS: Record<string, WidgetConfig[]> = {
  dash_default: DEFAULT_COMPLEX_WIDGETS,
  dash_fleet: DEFAULT_COMPLEX_WIDGETS,
  dash_server_prod: DEFAULT_SERVER_PROD_WIDGETS,
  dash_server_pve: DEFAULT_PROXMOX_WIDGETS,
  dash_server_apps: DEFAULT_DOCKER_WIDGETS,
  dash_server_storage: DEFAULT_SERVER_STORAGE_WIDGETS,
  dash_thermals: DEFAULT_HARDWARE_WIDGETS,
  dash_cpu: DEFAULT_CPU_WIDGETS,
  dash_network: DEFAULT_NETWORK_WIDGETS,
  dash_storage: DEFAULT_STORAGE_WIDGETS,
  dash_security: DEFAULT_SECURITY_WIDGETS,
};

export const Dashboard: React.FC<DashboardProps> = ({
  isEditing,
  onRegisterSave,
  activeDashboardId = 'dash_default',
  onDashboardLoaded,
  refreshInterval = '2s',
}) => {
  const toast = useToast();
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPanel, setEditingPanel] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [copiedQuickCmd, setCopiedQuickCmd] = useState(false);
  const [isSpawningTestNode, setIsSpawningTestNode] = useState(false);

  // Load requested dashboard by ID
  const loadDashboardData = async (targetId: string) => {
    try {
      setLoading(true);

      // Check localStorage for custom user layout on this specific board
      const localLayout = localStorage.getItem(`racklyt_custom_layout_${targetId}`);
      if (localLayout) {
        try {
          const parsed = JSON.parse(localLayout);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWidgets(parsed);
            const fullDash = await ApiClient.getDashboard(targetId);
            setDashboard(fullDash);
            if (onDashboardLoaded) onDashboardLoaded(fullDash);
            return;
          }
        } catch {}
      }

      const fullDash = await ApiClient.getDashboard(targetId);
      setDashboard(fullDash);
      if (onDashboardLoaded) onDashboardLoaded(fullDash);

      // If it's one of the showcase presets, load the rich showcase layout
      if (SHOWCASE_PRESETS[targetId]) {
        setWidgets(SHOWCASE_PRESETS[targetId]);
      } else if (fullDash.widgets && fullDash.widgets.length > 0) {
        setWidgets(fullDash.widgets);
      } else {
        setWidgets([]);
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e);
      if (SHOWCASE_PRESETS[targetId]) {
        setWidgets(SHOWCASE_PRESETS[targetId]);
      } else {
        setWidgets([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData(activeDashboardId);
  }, [activeDashboardId]);

  useEffect(() => {
    // 1. Dynamic polling fallback based on admin-configured interval
    let intervalMs: number | null = 2000;
    if (refreshInterval === '1s') intervalMs = 1000;
    else if (refreshInterval === '2s') intervalMs = 2000;
    else if (refreshInterval === '5s') intervalMs = 5000;
    else if (refreshInterval === '10s') intervalMs = 10000;
    else if (refreshInterval === 'off') intervalMs = null;

    let interval: NodeJS.Timeout | null = null;
    if (intervalMs !== null) {
      interval = setInterval(() => {
        ApiClient.getNodes()
          .then((list) => {
            if (Array.isArray(list) && list.length > 0) {
              setNodes(list);
            }
          })
          .catch(() => {});
      }, intervalMs);
    }

    // 2. Realtime WebSocket subscription
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const authToken = localStorage.getItem('racklyt_token');
    const wsUrl = `${wsProto}//${window.location.host}/api/v1/ws${authToken ? `?token=${encodeURIComponent(authToken)}` : ''}`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event_type === 'metric_tick' && msg.payload) {
            setNodes((prev) =>
              prev.map((node) =>
                node.id === msg.payload.node_id
                  ? {
                      ...node,
                      latest_metrics: {
                        ...node.latest_metrics,
                        ...msg.payload,
                      },
                    }
                  : node
              )
            );
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (interval) clearInterval(interval);
      ws?.close();
    };
  }, [refreshInterval]);

  // Save handler passed to navbar
  const handleSave = async () => {
    try {
      if (dashboard) {
        localStorage.setItem(`racklyt_custom_layout_${dashboard.id}`, JSON.stringify(widgets));
        await ApiClient.updateDashboard(dashboard.id, {
          title: dashboard.title,
          description: dashboard.description,
          is_public: dashboard.is_public,
          widgets: widgets.map((w, idx) => ({
            id: w.id,
            widget_type: w.widget_type,
            title: w.title,
            grid_x: (idx * 4) % 12,
            grid_y: Math.floor((idx * 4) / 12),
            grid_w: w.grid_w,
            grid_h: w.grid_h || 3,
            config: w.config || {},
          })),
        });
        toast.success('Dashboard layout saved successfully');
      }
    } catch (e) {
      console.error('Save failed:', e);
      toast.error('Failed to save dashboard layout');
    }
  };

  useEffect(() => {
    if (onRegisterSave) {
      onRegisterSave(handleSave);
    }
  }, [dashboard, widgets]);

  const removeWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const resizeWidgetWidth = (id: string, delta: number) => {
    setWidgets((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          const newW = Math.max(1, Math.min(12, w.grid_w + delta));
          return { ...w, grid_w: newW };
        }
        return w;
      })
    );
  };

  const setWidgetWidth = (id: string, newW: number) => {
    setWidgets((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          const clamped = Math.max(1, Math.min(12, newW));
          return { ...w, grid_w: clamped };
        }
        return w;
      })
    );
  };

  const moveWidget = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;

    setWidgets((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleAddWidget = (template: {
    widget_type: WidgetType;
    title: string;
    grid_w: number;
    config: any;
  }) => {
    const newWidget: WidgetConfig = {
      id: `w_${Date.now()}`,
      widget_type: template.widget_type,
      title: template.title,
      grid_x: 0,
      grid_y: widgets.length * 3,
      grid_w: template.grid_w,
      grid_h: 3,
      config: template.config,
    };
    setWidgets((prev) => [newWidget, ...prev]);
    setShowAddModal(false);
  };

  const handleUpdatePanel = (updated: WidgetConfig) => {
    setWidgets((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    setEditingPanel(null);
  };

  const handleResetToDefault = async () => {
    if (confirm(`Reset "${dashboard?.title || 'this dashboard'}" to default layout?`)) {
      if (dashboard) {
        localStorage.removeItem(`racklyt_custom_layout_${dashboard.id}`);
        if (SHOWCASE_PRESETS[dashboard.id]) {
          setWidgets(SHOWCASE_PRESETS[dashboard.id]);
          toast.success('Dashboard restored to showcase layout');
        } else {
          try {
            const fresh = await ApiClient.getDashboard(dashboard.id);
            if (fresh.widgets && fresh.widgets.length > 0) {
              setWidgets(fresh.widgets);
            } else {
              setWidgets([]);
            }
            toast.success('Dashboard restored to default layout');
          } catch {
            setWidgets([]);
          }
        }
      }
    }
  };

  const renderWidgetContent = (w: WidgetConfig) => {
    switch (w.widget_type) {
      case 'sysinfo':
        return <SysinfoWidget node={nodes[0]} />;

      case 'time-series':
        return <TimeSeriesWidget title={w.title} />;

      case 'circular-gauge': {
        const targetNode = nodes.find((n) => n.id === w.config?.nodeId) || nodes[0];
        let val = 0;
        let sub = w.config?.subtitle;
        if (!targetNode) {
          val = 0;
          sub = 'Awaiting Node Agent';
        } else if (targetNode.latest_metrics) {
          if (w.config?.query === 'cpu_overall' && targetNode.latest_metrics.cpu_percent !== undefined) {
            val = targetNode.latest_metrics.cpu_percent;
          } else if (w.config?.query === 'rpi_soc_temp' && targetNode.latest_metrics.temp_celsius !== undefined) {
            val = targetNode.latest_metrics.temp_celsius;
          } else if (
            w.config?.query === 'memory_percent' &&
            targetNode.latest_metrics.memory_used_bytes &&
            targetNode.latest_metrics.memory_total_bytes
          ) {
            val = (targetNode.latest_metrics.memory_used_bytes / targetNode.latest_metrics.memory_total_bytes) * 100;
          }
        }
        return (
          <CircularGaugeWidget
            value={val}
            min={w.config?.min ?? 0}
            max={w.config?.max ?? 100}
            unit={w.config?.unit ?? '%'}
            thresholds={w.config?.thresholds}
            subtitle={sub}
          />
        );
      }

      case 'network-traffic': {
        const hasNodes = nodes.length > 0;
        return (
          <NetworkTrafficWidget
            rxSpeedMb={hasNodes ? (w.config?.rxSpeedMb ?? 5.4) : 0}
            txSpeedMb={hasNodes ? (w.config?.txSpeedMb ?? 2.1) : 0}
            interfaceName={w.config?.interfaceName ?? 'eth0'}
          />
        );
      }

      case 'cpu-breakdown':
        return <CpuBreakdownWidget />;

      case 'storage-gauge':
        return <StorageGaugeWidget />;

      case 'docker-fleet':
        return <DockerFleetWidget />;

      case 'proxmox-summary':
        return <ProxmoxSummaryWidget />;

      case 'log-stream':
        return <LogStreamWidget />;

      case 'ports-table':
        return <PortsTableWidget />;

      case 'fleet-status':
        return <FleetStatusWidget nodes={nodes} />;

      case 'recent-alerts':
        return <AlertsFeedWidget />;

      case 'stat-card':
        return (
          <StatCardWidget
            title={w.title}
            value={w.config?.value || '42.6°C'}
            subtitle={w.config?.subtitle || 'SoC Thermal Sensor'}
            iconType={w.config?.icon || 'temp'}
          />
        );

      default:
        return (
          <div className="p-4 text-xs text-mutedText font-mono">
            Custom Telemetry Module: {w.widget_type}
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-mutedText text-xs font-mono">
        <span className="w-2 h-2 rounded-full bg-[var(--racklyt-orange)] inline-block mr-2 animate-ping" />
        Loading telemetry panels...
      </div>
    );
  }

  return (
    <div className={`w-full px-3.5 py-2.5 space-y-2.5 ${isEditing ? 'edit-mode-active' : ''}`}>
      {/* Top Banner when editing */}
      {isEditing && (
        <div className="racklyt-subbar" style={{ borderRadius: 'var(--panel-radius)', padding: '10px 14px' }}>
          <div className="subbar-left">
            <LayoutGrid size={15} style={{ color: 'var(--racklyt-orange)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--racklyt-text-primary)' }}>
              Dashboard Customization Studio
            </span>
            <span style={{ fontSize: 12, color: 'var(--racklyt-text-muted)' }}>
              — Add panels from catalog, adjust widths (-/+), configure metric queries (slider icon), or reorder (arrows).
            </span>
          </div>

          <div className="subbar-right flex items-center space-x-2">
            <button onClick={() => setShowAddModal(true)} className="rk-btn rk-btn-orange">
              <Plus size={13} />
              <span>Add Panel</span>
            </button>
            <button
              onClick={handleResetToDefault}
              className="rk-btn rk-btn-secondary"
              title="Reset to default multi-metric layout"
            >
              <RotateCcw size={12} />
              <span>Reset Layout</span>
            </button>
          </div>
        </div>
      )}

      {/* Zero Nodes Awaiting Hero Card */}
      {nodes.length === 0 && (
        <div className="border border-white/[0.08] bg-[#111319]/90 backdrop-blur-md rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.5)] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-[var(--racklyt-orange)]/15 border border-[var(--racklyt-orange)]/40 text-[var(--racklyt-orange)] flex-shrink-0 mt-0.5 shadow-[0_0_15px_rgba(249,156,28,0.2)]">
                <Radio size={20} className="relative z-10 animate-pulse" />
                <span className="animate-ping absolute inline-flex h-8 w-8 rounded-lg bg-[var(--racklyt-orange)] opacity-20" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                  <span>Racklyt Hub is Listening — Awaiting First Node Telemetry</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    PORT 8443 OPEN
                  </span>
                </h3>
                <p className="text-xs text-mutedText leading-relaxed max-w-2xl">
                  Run <code className="text-primaryText font-mono">racklyt-agent</code> on any physical server, Raspberry Pi, or Proxmox VE hypervisor to stream real-time telemetry. Gauges and charts below will immediately activate upon first heartbeat.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 flex-shrink-0">
              <button
                onClick={() => setShowEnrollModal(true)}
                className="px-4 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold text-xs rounded-lg transition flex items-center space-x-2 shadow-md hover:shadow-lg active:scale-95"
              >
                <Plus size={14} />
                <span>Add Node (Guide)</span>
              </button>

              <button
                onClick={async () => {
                  setIsSpawningTestNode(true);
                  try {
                    await ApiClient.spawnTestNode({
                      name: 'homelab-node-01',
                      os: 'Linux (Debian 12 / Proxmox VE)',
                    });
                    const list = await ApiClient.getNodes();
                    setNodes(list);
                    toast.success('Test node homelab-node-01 connected and telemetry streaming!');
                  } catch (e: any) {
                    toast.error(`Could not spawn test node: ${e.message}`);
                  } finally {
                    setIsSpawningTestNode(false);
                  }
                }}
                disabled={isSpawningTestNode}
                className="px-3.5 py-2 bg-[var(--racklyt-bg-panel)] hover:bg-[var(--racklyt-bg-active)] border border-[var(--racklyt-border-medium)] rounded-lg text-xs font-semibold text-primaryText transition flex items-center space-x-2 active:scale-95 shadow-sm"
              >
                <Zap size={14} className="text-[var(--racklyt-orange)]" />
                <span>{isSpawningTestNode ? 'Spawning...' : '⚡ 1-Click Test Node'}</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--racklyt-border-weak)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2 text-mutedText font-mono text-[11px] truncate">
              <Terminal size={13} className="text-[var(--racklyt-cyan)] flex-shrink-0" />
              <span className="truncate">curl -sSL {window.location.origin}/install.sh | sudo bash -s -- --hub {window.location.origin}</span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`curl -sSL ${window.location.origin}/install.sh | sudo bash -s -- --hub ${window.location.origin}`);
                setCopiedQuickCmd(true);
                toast.success('Agent install command copied to clipboard');
                setTimeout(() => setCopiedQuickCmd(false), 2000);
              }}
              className="px-2.5 py-1 bg-[var(--racklyt-bg-panel)] hover:bg-[var(--racklyt-bg-active)] border border-[var(--racklyt-border-weak)] rounded text-mutedText hover:text-primaryText text-[11px] flex items-center space-x-1.5 transition self-start sm:self-auto cursor-pointer"
            >
              {copiedQuickCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedQuickCmd ? 'Copied' : 'Copy Install Command'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 12-Column Responsive Grid */}
      <div className="grid grid-cols-12 gap-2.5">
        {widgets.map((w, index) => (
          <PanelWrapper
            key={w.id}
            title={w.title}
            type={w.widget_type}
            customIcon={w.config?.custom_icon}
            customIconColor={w.config?.custom_icon_color}
            isEditMode={isEditing}
            gridW={w.grid_w}
            onResizeWidth={(delta) => resizeWidgetWidth(w.id, delta)}
            onSetWidth={(newW) => setWidgetWidth(w.id, newW)}
            onMoveLeft={index > 0 ? () => moveWidget(index, 'left') : undefined}
            onMoveRight={index < widgets.length - 1 ? () => moveWidget(index, 'right') : undefined}
            onEdit={() => setEditingPanel(w)}
            onPickIcon={() => setEditingPanel(w)}
            onDelete={() => removeWidget(w.id)}
          >
            {renderWidgetContent(w)}
          </PanelWrapper>
        ))}
      </div>

      {/* Add Widget Catalog Modal */}
      {showAddModal && (
        <AddPanelModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddWidget}
        />
      )}

      {/* Edit Panel Modal */}
      {editingPanel && (
        <EditPanelModal
          panel={editingPanel}
          nodes={nodes}
          onClose={() => setEditingPanel(null)}
          onSave={handleUpdatePanel}
        />
      )}

      {/* Enroll Node Modal */}
      <EnrollNodeModal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        onNodeAdded={async () => {
          const list = await ApiClient.getNodes();
          setNodes(list);
        }}
      />
    </div>
  );
};

export default Dashboard;
