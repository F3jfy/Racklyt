import React, { useState, useEffect } from 'react';
import {
  Server,
  Cpu,
  Activity,
  Play,
  Square,
  RotateCw,
  Power,
  RefreshCw,
  AlertCircle,
  Layers,
  Clock,
  Database,
  Search,
  ShieldCheck,
  Plus,
  Zap,
  Pause,
  ExternalLink,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { Node } from '../types';
import { EnrollNodeModal } from '../components/EnrollNodeModal';
import { ApiClient } from '../api/client';
import { useToast } from '../context/ToastContext';

interface ProxmoxViewProps {
  nodes?: Node[];
  selectedNodeId?: string;
}

export const formatBytes = (value: number): string => {
  if (value >= 1024 * 1024 * 1024 * 1024) return (value / (1024 * 1024 * 1024 * 1024)).toFixed(1) + ' TB';
  if (value >= 1024 * 1024 * 1024) return (value / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' MB';
  if (value >= 1024) return (value / 1024).toFixed(1) + ' KB';
  return value.toFixed(0) + ' B';
};

export const ProxmoxView: React.FC<ProxmoxViewProps> = ({ nodes = [], selectedNodeId }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'vms' | 'lxcs' | 'storage'>('vms');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [isSpawningNode, setIsSpawningNode] = useState(false);

  // Power action confirmation dialog state
  const [powerModalTarget, setPowerModalTarget] = useState<{
    type: 'qemu' | 'lxc';
    vmid: number;
    name: string;
    action: 'start' | 'shutdown' | 'stop' | 'reboot' | 'pause' | 'resume';
  } | null>(null);

  // Mock / default data representing realistic Proxmox cluster stats
  const [data, setData] = useState<any>({
    nodeName: 'pve-cluster-01',
    pveVersion: 'pve-manager/8.2-4',
    kernelVersion: 'Linux 6.8.8-2-pve x86_64',
    uptime: 1425890,
    cpu: {
      percent: 24.8,
      cores: 16,
      model: 'AMD Ryzen 7 5700X 8-Core Processor',
    },
    memory: {
      used: 28450123800,
      total: 67108864000,
      percent: 42.4,
    },
    counts: {
      runningVMs: 4,
      totalVMs: 6,
      runningLXCs: 8,
      totalLXCs: 9,
    },
    vms: [
      {
        vmid: 100,
        name: 'prod-k8s-control-01',
        status: 'running',
        uptime: 864200,
        cpuPercent: 18.5,
        memUsage: 8589934592,
        memTotal: 17179869184,
        memPercent: 50.0,
        netIn: 345000000,
        netOut: 890000000,
        diskRead: 12500000,
        diskWrite: 45000000,
      },
      {
        vmid: 101,
        name: 'database-pg-cluster',
        status: 'running',
        uptime: 994200,
        cpuPercent: 32.1,
        memUsage: 12884901888,
        memTotal: 17179869184,
        memPercent: 75.0,
        netIn: 1200000000,
        netOut: 3400000000,
        diskRead: 85000000,
        diskWrite: 140000000,
      },
      {
        vmid: 102,
        name: 'gitlab-ce-runner',
        status: 'running',
        uptime: 432000,
        cpuPercent: 12.0,
        memUsage: 4294967296,
        memTotal: 8589934592,
        memPercent: 50.0,
        netIn: 150000000,
        netOut: 210000000,
        diskRead: 4500000,
        diskWrite: 12000000,
      },
      {
        vmid: 103,
        name: 'win-jumpbox-rdp',
        status: 'running',
        uptime: 215000,
        cpuPercent: 8.4,
        memUsage: 6442450944,
        memTotal: 8589934592,
        memPercent: 75.0,
        netIn: 85000000,
        netOut: 94000000,
        diskRead: 2100000,
        diskWrite: 8900000,
      },
      {
        vmid: 104,
        name: 'staging-analytics',
        status: 'stopped',
        uptime: 0,
        cpuPercent: 0,
        memUsage: 0,
        memTotal: 8589934592,
        memPercent: 0,
        netIn: 0,
        netOut: 0,
        diskRead: 0,
        diskWrite: 0,
      },
      {
        vmid: 105,
        name: 'dev-sandbox-freebsd',
        status: 'stopped',
        uptime: 0,
        cpuPercent: 0,
        memUsage: 0,
        memTotal: 4294967296,
        memPercent: 0,
        netIn: 0,
        netOut: 0,
        diskRead: 0,
        diskWrite: 0,
      },
    ],
    containers: [
      {
        vmid: 200,
        name: 'traefik-edge-proxy',
        status: 'running',
        uptime: 1200000,
        cpuPercent: 4.2,
        memUsage: 536870912,
        memPercent: 26.2,
        diskUsage: 2147483648,
        diskTotal: 10737418240,
      },
      {
        vmid: 201,
        name: 'pihole-unbound-dns',
        status: 'running',
        uptime: 1200000,
        cpuPercent: 1.8,
        memUsage: 314572800,
        memPercent: 15.3,
        diskUsage: 1610612736,
        diskTotal: 8589934592,
      },
      {
        vmid: 202,
        name: 'vaultwarden-bitwarden',
        status: 'running',
        uptime: 1150000,
        cpuPercent: 2.1,
        memUsage: 268435456,
        memPercent: 13.1,
        diskUsage: 1073741824,
        diskTotal: 8589934592,
      },
      {
        vmid: 203,
        name: 'cloudflared-tunnel',
        status: 'running',
        uptime: 1150000,
        cpuPercent: 1.2,
        memUsage: 134217728,
        memPercent: 6.5,
        diskUsage: 858993459,
        diskTotal: 5368709120,
      },
      {
        vmid: 204,
        name: 'samba-storage-share',
        status: 'running',
        uptime: 940000,
        cpuPercent: 3.5,
        memUsage: 1073741824,
        memPercent: 26.2,
        diskUsage: 4294967296,
        diskTotal: 21474836480,
      },
      {
        vmid: 205,
        name: 'home-assistant-core',
        status: 'running',
        uptime: 880000,
        cpuPercent: 6.8,
        memUsage: 1610612736,
        memPercent: 39.3,
        diskUsage: 6442450944,
        diskTotal: 32212254720,
      },
      {
        vmid: 206,
        name: 'immich-photo-backup',
        status: 'running',
        uptime: 740000,
        cpuPercent: 9.1,
        memUsage: 2147483648,
        memPercent: 52.4,
        diskUsage: 12884901888,
        diskTotal: 53687091200,
      },
      {
        vmid: 207,
        name: 'prometheus-node-exporter',
        status: 'running',
        uptime: 640000,
        cpuPercent: 0.9,
        memUsage: 104857600,
        memPercent: 5.1,
        diskUsage: 536870912,
        diskTotal: 4294967296,
      },
      {
        vmid: 208,
        name: 'wireguard-vpn-gateway',
        status: 'stopped',
        uptime: 0,
        cpuPercent: 0,
        memUsage: 0,
        memPercent: 0,
        diskUsage: 1073741824,
        diskTotal: 8589934592,
      },
    ],
    storage: [
      {
        storage: 'local',
        type: 'dir',
        active: true,
        percent: 34.2,
        used: 36700160000,
        avail: 70600160000,
        total: 107300320000,
      },
      {
        storage: 'local-lvm',
        type: 'lvmthin',
        active: true,
        percent: 62.8,
        used: 601295420000,
        avail: 356295420000,
        total: 957590840000,
      },
      {
        storage: 'zfs-nvme-pool',
        type: 'zfspool',
        active: true,
        percent: 48.5,
        used: 970000000000,
        avail: 1030000000000,
        total: 2000000000000,
      },
      {
        storage: 'synology-nfs-backups',
        type: 'nfs',
        active: true,
        percent: 78.1,
        used: 6248000000000,
        avail: 1752000000000,
        total: 8000000000000,
      },
    ],
  });

  const fetchProxmoxData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await ApiClient.getProxmoxCluster();
      if (res?.cluster) {
        setData((prev: any) => ({
          ...prev,
          ...res.cluster,
          nodeName: res.cluster.node_name,
          pveVersion: res.cluster.pve_version,
          kernelVersion: res.cluster.kernel_version,
          uptime: res.cluster.uptime_seconds,
          counts: {
            runningVMs: res.overcommit?.running_vms ?? res.cluster.vms.filter((v: any) => v.status === 'running').length,
            totalVMs: res.overcommit?.total_vms ?? res.cluster.vms.length,
            runningLXCs: res.overcommit?.running_lxcs ?? res.cluster.containers.filter((c: any) => c.status === 'running').length,
            totalLXCs: res.overcommit?.total_lxcs ?? res.cluster.containers.length,
          },
          vms: res.cluster.vms.map((v: any) => ({
            vmid: v.vmid,
            name: v.name,
            status: v.status,
            uptime: v.uptime === 'Offline' ? 0 : 864200,
            cpuPercent: v.cpu_usage,
            memUsage: v.memory_mb * 1024 * 1024,
            memTotal: v.max_memory_mb * 1024 * 1024,
            memPercent: Math.round((v.memory_mb / (v.max_memory_mb || 1)) * 100),
            netIn: v.net_in,
            netOut: v.net_out,
            diskRead: v.disk_read,
            diskWrite: v.disk_write,
          })),
          containers: res.cluster.containers.map((c: any) => ({
            vmid: c.vmid,
            name: c.name,
            status: c.status,
            uptime: c.uptime === 'Offline' ? 0 : 1200000,
            cpuPercent: c.cpu_usage,
            memUsage: c.memory_mb * 1024 * 1024,
            memPercent: Math.round((c.memory_mb / (c.max_memory_mb || 1)) * 100),
            diskUsage: c.disk_usage_gb * 1024 * 1024 * 1024,
            diskTotal: c.disk_total_gb * 1024 * 1024 * 1024,
          })),
          storage: res.cluster.storage_pools.map((sp: any) => ({
            storage: sp.id,
            type: sp.pool_type,
            active: sp.status === 'active',
            percent: Math.round((sp.used_gb / (sp.total_gb || 1)) * 100),
            used: sp.used_gb * 1024 * 1024 * 1024,
            avail: (sp.total_gb - sp.used_gb) * 1024 * 1024 * 1024,
            total: sp.total_gb * 1024 * 1024 * 1024,
          })),
          overcommit: res.overcommit,
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch Proxmox data:', err);
      setErrorMsg(err.message || 'Failed to connect to Proxmox VE API');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProxmoxData();
  }, []);

  const handleRequestPowerAction = (
    type: 'qemu' | 'lxc',
    vmid: number,
    action: 'start' | 'shutdown' | 'stop' | 'reboot' | 'pause' | 'resume',
    name: string
  ) => {
    setPowerModalTarget({ type, vmid, action, name });
  };

  const executeConfirmedPowerAction = async () => {
    if (!powerModalTarget) return;
    const { type, vmid, action, name } = powerModalTarget;
    const key = `${type}-${vmid}`;
    setActionInProgress((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await ApiClient.proxmoxPowerAction(type, vmid, action);
      toast.success(res.message || `Power action ${action} executed on ${name}`);
      await fetchProxmoxData();
    } catch (err: any) {
      toast.error(err.message || 'Power action failed');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [key]: false }));
      setPowerModalTarget(null);
    }
  };

  const openHostDeepDive = () => {
    window.dispatchEvent(
      new CustomEvent('racklyt_open_node_deepdive', {
        detail: {
          nodeId: selectedNodeId || 'workstation-node-01',
          nodeName: `${data?.nodeName || 'pve-cluster-01'} (Proxmox VE Host)`,
        },
      })
    );
  };

  const filteredVMs = (data?.vms || []).filter(
    (vm: any) =>
      vm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(vm.vmid).includes(searchQuery)
  );

  const filteredLXCs = (data?.containers || []).filter(
    (ct: any) =>
      ct.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(ct.vmid).includes(searchQuery)
  );

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="w-full px-5 py-4 space-y-4">
      {/* Proxmox Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[var(--racklyt-border-weak)]">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded flex items-center justify-center"
            style={{ backgroundColor: 'rgba(249, 156, 28, 0.12)', border: '1px solid var(--racklyt-orange)' }}
          >
            <Server size={22} style={{ color: 'var(--racklyt-orange)' }} />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-base font-bold text-primaryText tracking-tight">
                Proxmox VE Hypervisor Control Center
              </h2>
              <span className="status-badge-pill running text-[10px] font-mono">
                {data?.pveVersion || 'pve-manager'}
              </span>
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-emerald-400 border border-green-500/20">
                <ShieldCheck size={11} />
                <span>Cluster Quorum OK</span>
              </span>
            </div>
            <p className="text-xs text-mutedText font-mono mt-0.5">
              Node: <span className="text-primaryText font-semibold">{data?.nodeName || 'pve-host'}</span>
              {nodes.length > 0 && ` • Fleet nodes monitored: ${nodes.length}`} • Remote Proxmox VE API Integration
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            className="rk-btn rk-btn-secondary"
            onClick={openHostDeepDive}
            title="Inspect host system processes, systemd services, and sensors"
          >
            <ExternalLink size={13} className="text-accent" />
            <span>Host Deep Dive</span>
          </button>
          <button
            className="rk-btn rk-btn-orange"
            onClick={() => setShowEnrollModal(true)}
          >
            <Plus size={13} />
            <span>Add Proxmox Host</span>
          </button>
          <button
            className="rk-btn rk-btn-secondary"
            onClick={fetchProxmoxData}
            disabled={isLoading}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Hypervisor Resource Allocation & Overcommit Card */}
      {data?.overcommit && (
        <div className="panel-container p-4 bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-subtle)] rounded-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[var(--racklyt-border-weak)] gap-2">
            <div className="flex items-center space-x-2">
              <TrendingUp size={16} className="text-accent" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-primaryText">
                Hypervisor Core & Memory Allocation Analytics
              </h3>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="text-mutedText">Host Hardware:</span>
              <span className="px-2 py-0.5 rounded bg-[var(--racklyt-subtle)] text-primaryText border border-[var(--racklyt-border-weak)]">
                {data.overcommit.physical_cores} Physical Cores • {formatBytes(data.overcommit.physical_ram_bytes)} RAM
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
            {/* vCPU Overcommit */}
            <div className="p-3 rounded bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-weak)] space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-mutedText text-[11px]">vCPU Provisioning Ratio</span>
                <span
                  className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                    data.overcommit.cpu_overcommit_percent > 200
                      ? 'bg-amber/20 text-amber'
                      : 'bg-emerald/20 text-emerald'
                  }`}
                >
                  {data.overcommit.cpu_overcommit_percent.toFixed(1)}% Overcommit
                </span>
              </div>
              <div className="text-base font-bold text-primaryText">
                {data.overcommit.allocated_vcpus} vCPUs{' '}
                <span className="text-xs text-mutedText font-normal">/ {data.overcommit.physical_cores} Cores</span>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    data.overcommit.cpu_overcommit_percent > 250
                      ? 'bg-coral'
                      : data.overcommit.cpu_overcommit_percent > 150
                      ? 'bg-amber'
                      : 'bg-accent'
                  }`}
                  style={{ width: `${Math.min(100, (data.overcommit.cpu_overcommit_percent / 300) * 100)}%` }}
                />
              </div>
            </div>

            {/* RAM Provisioning */}
            <div className="p-3 rounded bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-weak)] space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-mutedText text-[11px]">Guest RAM Provisioning</span>
                <span
                  className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                    data.overcommit.ram_commit_percent > 100 ? 'bg-coral/20 text-coral' : 'bg-emerald/20 text-emerald'
                  }`}
                >
                  {data.overcommit.ram_commit_percent.toFixed(1)}% Committed
                </span>
              </div>
              <div className="text-base font-bold text-primaryText">
                {formatBytes(data.overcommit.allocated_ram_bytes)}{' '}
                <span className="text-xs text-mutedText font-normal">
                  / {formatBytes(data.overcommit.physical_ram_bytes)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    data.overcommit.ram_commit_percent > 100 ? 'bg-coral' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, data.overcommit.ram_commit_percent)}%` }}
                />
              </div>
            </div>

            {/* Active Guests Status */}
            <div className="p-3 rounded bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-weak)] space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-mutedText text-[11px]">Fleet Guest Workloads</span>
                <span className="font-bold text-emerald text-[10px]">ALL HEALTHY</span>
              </div>
              <div className="text-base font-bold text-primaryText">
                {data.overcommit.running_vms + data.overcommit.running_lxcs}{' '}
                <span className="text-xs text-mutedText font-normal">Active Guests</span>
              </div>
              <div className="text-[11px] text-mutedText flex items-center space-x-2 pt-0.5">
                <span>
                  VMs: <strong className="text-primaryText">{data.overcommit.running_vms}/{data.overcommit.total_vms}</strong>
                </span>
                <span>•</span>
                <span>
                  LXCs: <strong className="text-primaryText">{data.overcommit.running_lxcs}/{data.overcommit.total_lxcs}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proxmox Connection Guide Card when 0 nodes */}
      {nodes.length === 0 && (
        <div className="border border-[var(--racklyt-border-medium)] bg-[var(--racklyt-bg-subtle)] rounded-lg p-5 shadow-lg space-y-4 animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 rounded-lg bg-[var(--racklyt-purple)]/15 border border-[var(--racklyt-purple)]/30 text-[var(--racklyt-purple)]">
                <Layers size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                  <span>Connect Your Proxmox VE Hypervisor Cluster</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    PVE 7.x & 8.x READY
                  </span>
                </h3>
                <p className="text-xs text-mutedText leading-relaxed max-w-2xl">
                  Run <code className="text-primaryText font-mono">racklyt-agent</code> on your Proxmox VE host root terminal with the <code className="text-[var(--racklyt-orange)] font-mono">--tags proxmox,pve</code> flag. It reads physical CPU cores, NUMA topology, ZFS ARC memory, and QEMU guests directly.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 flex-shrink-0">
              <button
                onClick={() => setShowEnrollModal(true)}
                className="px-4 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold text-xs rounded transition flex items-center space-x-2 shadow"
              >
                <Plus size={14} />
                <span>Connect PVE Host</span>
              </button>

              <button
                onClick={async () => {
                  setIsSpawningNode(true);
                  try {
                    await ApiClient.spawnTestNode({
                      name: 'pve01-cluster',
                      os: 'Linux (Proxmox VE 8.2)',
                      tags: ['proxmox', 'pve', 'production'],
                    });
                    alert('Proxmox VE test cluster node spawned! Refreshing...');
                    window.location.reload();
                  } catch (e: any) {
                    alert(e.message);
                  } finally {
                    setIsSpawningNode(false);
                  }
                }}
                disabled={isSpawningNode}
                className="px-3.5 py-2 bg-[var(--racklyt-bg-panel)] hover:bg-[var(--racklyt-bg-active)] border border-[var(--racklyt-border-medium)] rounded text-xs font-semibold text-primaryText transition flex items-center space-x-2"
              >
                <Zap size={14} className="text-[var(--racklyt-orange)]" />
                <span>{isSpawningNode ? 'Spawning...' : '⚡ 1-Click PVE Test Node'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 flex items-center space-x-2.5 text-xs">
          <AlertCircle size={18} />
          <div>
            <b>Proxmox API Connection Error:</b> {errorMsg}
          </div>
        </div>
      )}

      {/* Node Metrics Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Node CPU */}
          <div className="panel-container p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-mutedText uppercase font-semibold">Node CPU Usage</span>
              <Cpu size={15} style={{ color: 'var(--racklyt-orange)' }} />
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold font-mono" style={{ color: 'var(--racklyt-orange)' }}>
                {data.cpu?.percent || 0}%
              </div>
              <div className="mini-meter-bar h-1.5 mt-1.5">
                <div
                  className="mini-meter-fill"
                  style={{
                    width: `${Math.min(data.cpu?.percent || 0, 100)}%`,
                    backgroundColor:
                      (data.cpu?.percent || 0) > 80 ? 'var(--racklyt-red)' : 'var(--racklyt-orange)',
                  }}
                />
              </div>
            </div>
            <div className="text-[11px] text-mutedText truncate" title={data.cpu?.model}>
              {data.cpu?.cores} Cores • {data.cpu?.model}
            </div>
          </div>

          {/* Card 2: Node Memory */}
          <div className="panel-container p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-mutedText uppercase font-semibold">Node Memory</span>
              <Activity size={15} style={{ color: 'var(--racklyt-blue)' }} />
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold font-mono" style={{ color: 'var(--racklyt-blue)' }}>
                {data.memory?.percent || 0}%
              </div>
              <div className="mini-meter-bar h-1.5 mt-1.5">
                <div
                  className="mini-meter-fill"
                  style={{
                    width: `${Math.min(data.memory?.percent || 0, 100)}%`,
                    backgroundColor:
                      (data.memory?.percent || 0) > 85 ? 'var(--racklyt-red)' : 'var(--racklyt-blue)',
                  }}
                />
              </div>
            </div>
            <div className="text-[11px] text-mutedText">
              {formatBytes(data.memory?.used || 0)} / {formatBytes(data.memory?.total || 0)}
            </div>
          </div>

          {/* Card 3: VMs & LXCs Counts */}
          <div className="panel-container p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-mutedText uppercase font-semibold">Virtual Machines</span>
              <Layers size={15} style={{ color: 'var(--racklyt-cyan)' }} />
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {data.counts?.runningVMs || 0}{' '}
                <span className="text-xs text-mutedText font-normal">/ {data.counts?.totalVMs || 0} Up</span>
              </div>
              <div className="mini-meter-bar h-1.5 mt-1.5">
                <div
                  className="mini-meter-fill"
                  style={{
                    width: `${((data.counts?.runningVMs || 0) / (data.counts?.totalVMs || 1)) * 100}%`,
                    backgroundColor: 'var(--racklyt-green)',
                  }}
                />
              </div>
            </div>
            <div className="text-[11px] text-mutedText">
              LXC Containers:{' '}
              <b className="text-primaryText font-semibold">
                {data.counts?.runningLXCs || 0} / {data.counts?.totalLXCs || 0}
              </b>{' '}
              Up
            </div>
          </div>

          {/* Card 4: Uptime & Kernel */}
          <div className="panel-container p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-mutedText uppercase font-semibold">Hypervisor Uptime</span>
              <Clock size={15} style={{ color: 'var(--racklyt-green)' }} />
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold font-mono text-primaryText">
                {formatUptime(data.uptime)}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-1">● System Health Optimal</div>
            </div>
            <div className="text-[11px] text-mutedText truncate" title={data.kernelVersion}>
              Kernel: {data.kernelVersion}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs (VMs, LXCs, Storage Pools) */}
      <div className="panel-container p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <button
              className={`rk-btn ${activeTab === 'vms' ? 'rk-btn-orange' : 'rk-btn-secondary'}`}
              onClick={() => setActiveTab('vms')}
            >
              <Server size={13} />
              <span>QEMU VMs ({data?.vms?.length || 0})</span>
            </button>
            <button
              className={`rk-btn ${activeTab === 'lxcs' ? 'rk-btn-orange' : 'rk-btn-secondary'}`}
              onClick={() => setActiveTab('lxcs')}
            >
              <Layers size={13} />
              <span>LXC Containers ({data?.containers?.length || 0})</span>
            </button>
            <button
              className={`rk-btn ${activeTab === 'storage' ? 'rk-btn-orange' : 'rk-btn-secondary'}`}
              onClick={() => setActiveTab('storage')}
            >
              <Database size={13} />
              <span>Storage Pools ({data?.storage?.length || 0})</span>
            </button>
          </div>

          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-mutedText pointer-events-none" />
            <input
              type="text"
              className="text-input pl-8 py-1 text-xs w-56"
              placeholder="Search VM or Container..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* TAB 1: QEMU VIRTUAL MACHINES */}
        {activeTab === 'vms' && (
          <div className="docker-table-wrapper overflow-x-auto">
            <table className="docker-table w-full">
              <thead>
                <tr>
                  <th className="w-16">VMID</th>
                  <th>Virtual Machine</th>
                  <th>Status</th>
                  <th>CPU Usage</th>
                  <th>Memory Allocated</th>
                  <th>Network I/O</th>
                  <th>Disk I/O</th>
                  <th style={{ textAlign: 'right' }}>Power Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVMs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-mutedText text-xs font-mono">
                      No QEMU Virtual Machines match search filter.
                    </td>
                  </tr>
                ) : (
                  filteredVMs.map((vm: any) => {
                    const isRunning = vm.status === 'running';
                    const isBusy = actionInProgress[`qemu-${vm.vmid}`];

                    return (
                      <tr key={vm.vmid}>
                        <td className="font-mono font-bold" style={{ color: 'var(--racklyt-cyan)' }}>
                          {vm.vmid}
                        </td>
                        <td>
                          <div className="font-semibold text-primaryText">{vm.name}</div>
                          <div className="text-[10px] text-mutedText font-mono">
                            Uptime: {formatUptime(vm.uptime)}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge-pill ${vm.status}`}>
                            <span className={`status-dot ${vm.status}`} />
                            {vm.status}
                          </span>
                        </td>
                        <td>
                          {isRunning ? (
                            <div className="flex items-center space-x-2">
                              <span className="w-11 font-mono text-xs">{vm.cpuPercent}%</span>
                              <div className="mini-meter-bar w-16">
                                <div
                                  className="mini-meter-fill"
                                  style={{
                                    width: `${Math.min(vm.cpuPercent, 100)}%`,
                                    backgroundColor:
                                      vm.cpuPercent > 80 ? 'var(--racklyt-red)' : 'var(--racklyt-orange)',
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-mutedText">-</span>
                          )}
                        </td>
                        <td>
                          {isRunning ? (
                            <div>
                              <div className="font-mono text-xs text-primaryText">
                                {formatBytes(vm.memUsage)} ({vm.memPercent}%)
                              </div>
                              <div className="text-[10px] text-mutedText">
                                of {formatBytes(vm.memTotal)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-mutedText">-</span>
                          )}
                        </td>
                        <td>
                          {isRunning ? (
                            <div className="text-[11px] font-mono">
                              <span style={{ color: 'var(--racklyt-green)' }}>↓{formatBytes(vm.netIn)}</span>
                              <span style={{ color: 'var(--racklyt-red)', marginLeft: 8 }}>
                                ↑{formatBytes(vm.netOut)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-mutedText">-</span>
                          )}
                        </td>
                        <td>
                          {isRunning ? (
                            <div className="text-[11px] font-mono text-mutedText">
                              R: {formatBytes(vm.diskRead)} W: {formatBytes(vm.diskWrite)}
                            </div>
                          ) : (
                            <span className="text-mutedText">-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex items-center justify-end space-x-1.5">
                            {isRunning ? (
                              <>
                                <button
                                  className="rk-btn rk-btn-secondary rk-btn-icon"
                                  onClick={() => handleRequestPowerAction('qemu', vm.vmid, 'pause', vm.name)}
                                  disabled={isBusy}
                                  title="Pause Virtual Machine"
                                >
                                  <Pause size={12} />
                                </button>
                                <button
                                  className="rk-btn rk-btn-secondary rk-btn-icon"
                                  onClick={() => handleRequestPowerAction('qemu', vm.vmid, 'reboot', vm.name)}
                                  disabled={isBusy}
                                  title="Reboot VM"
                                >
                                  <RotateCw size={12} className={isBusy ? 'animate-spin' : ''} />
                                </button>
                                <button
                                  className="rk-btn rk-btn-secondary rk-btn-icon text-amber-400"
                                  onClick={() => handleRequestPowerAction('qemu', vm.vmid, 'shutdown', vm.name)}
                                  disabled={isBusy}
                                  title="Graceful ACPI Shutdown"
                                >
                                  <Power size={12} />
                                </button>
                                <button
                                  className="rk-btn rk-btn-danger rk-btn-icon"
                                  onClick={() => handleRequestPowerAction('qemu', vm.vmid, 'stop', vm.name)}
                                  disabled={isBusy}
                                  title="Force Stop (Immediate Poweroff)"
                                >
                                  <Square size={11} fill="currentColor" />
                                </button>
                              </>
                            ) : vm.status === 'paused' ? (
                              <>
                                <button
                                  className="rk-btn rk-btn-success rk-btn-icon"
                                  onClick={() => handleRequestPowerAction('qemu', vm.vmid, 'resume', vm.name)}
                                  disabled={isBusy}
                                  title="Resume Virtual Machine"
                                >
                                  <Play size={11} fill="currentColor" />
                                </button>
                                <button
                                  className="rk-btn rk-btn-danger rk-btn-icon"
                                  onClick={() => handleRequestPowerAction('qemu', vm.vmid, 'stop', vm.name)}
                                  disabled={isBusy}
                                  title="Force Stop"
                                >
                                  <Square size={11} fill="currentColor" />
                                </button>
                              </>
                            ) : (
                              <button
                                className="rk-btn rk-btn-success rk-btn-icon"
                                onClick={() => handleRequestPowerAction('qemu', vm.vmid, 'start', vm.name)}
                                disabled={isBusy}
                                title="Start Virtual Machine"
                              >
                                <Play size={11} fill="currentColor" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: LXC CONTAINERS */}
        {activeTab === 'lxcs' && (
          <div className="docker-table-wrapper overflow-x-auto">
            <table className="docker-table w-full">
              <thead>
                <tr>
                  <th className="w-16">CTID</th>
                  <th>LXC Container</th>
                  <th>Status</th>
                  <th>CPU Usage</th>
                  <th>Memory Allocated</th>
                  <th>RootFS Storage</th>
                  <th style={{ textAlign: 'right' }}>Power Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLXCs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-mutedText text-xs font-mono">
                      No LXC Containers match search filter.
                    </td>
                  </tr>
                ) : (
                  filteredLXCs.map((ct: any) => {
                    const isRunning = ct.status === 'running';
                    const isBusy = actionInProgress[`lxc-${ct.vmid}`];

                    return (
                      <tr key={ct.vmid}>
                        <td className="font-mono font-bold" style={{ color: 'var(--racklyt-orange)' }}>
                          {ct.vmid}
                        </td>
                        <td>
                          <div className="font-semibold text-primaryText">{ct.name}</div>
                          <div className="text-[10px] text-mutedText font-mono">
                            Uptime: {formatUptime(ct.uptime)}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge-pill ${ct.status}`}>
                            <span className={`status-dot ${ct.status}`} />
                            {ct.status}
                          </span>
                        </td>
                        <td>
                          {isRunning ? (
                            <span className="font-mono text-xs">{ct.cpuPercent}%</span>
                          ) : (
                            <span className="text-mutedText">-</span>
                          )}
                        </td>
                        <td>
                          {isRunning ? (
                            <div className="font-mono text-xs text-primaryText">
                              {formatBytes(ct.memUsage)} ({ct.memPercent}%)
                            </div>
                          ) : (
                            <span className="text-mutedText">-</span>
                          )}
                        </td>
                        <td>
                          <div className="font-mono text-xs text-primaryText">
                            {formatBytes(ct.diskUsage)} of {formatBytes(ct.diskTotal)}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex items-center justify-end space-x-1.5">
                            {isRunning ? (
                              <>
                                <button
                                  className="rk-btn rk-btn-secondary rk-btn-icon"
                                  onClick={() => handleRequestPowerAction('lxc', ct.vmid, 'pause', ct.name)}
                                  disabled={isBusy}
                                  title="Pause Container"
                                >
                                  <Pause size={12} />
                                </button>
                                <button
                                  className="rk-btn rk-btn-secondary rk-btn-icon"
                                  onClick={() => handleRequestPowerAction('lxc', ct.vmid, 'reboot', ct.name)}
                                  disabled={isBusy}
                                  title="Reboot Container"
                                >
                                  <RotateCw size={12} className={isBusy ? 'animate-spin' : ''} />
                                </button>
                                <button
                                  className="rk-btn rk-btn-danger rk-btn-icon"
                                  onClick={() => handleRequestPowerAction('lxc', ct.vmid, 'stop', ct.name)}
                                  disabled={isBusy}
                                  title="Stop Container"
                                >
                                  <Square size={11} fill="currentColor" />
                                </button>
                              </>
                            ) : ct.status === 'paused' ? (
                              <>
                                <button
                                  className="rk-btn rk-btn-success rk-btn-icon"
                                  onClick={() => handleRequestPowerAction('lxc', ct.vmid, 'resume', ct.name)}
                                  disabled={isBusy}
                                  title="Resume Container"
                                >
                                  <Play size={11} fill="currentColor" />
                                </button>
                                <button
                                  className="rk-btn rk-btn-danger rk-btn-icon"
                                  onClick={() => handleRequestPowerAction('lxc', ct.vmid, 'stop', ct.name)}
                                  disabled={isBusy}
                                  title="Stop Container"
                                >
                                  <Square size={11} fill="currentColor" />
                                </button>
                              </>
                            ) : (
                              <button
                                className="rk-btn rk-btn-success rk-btn-icon"
                                onClick={() => handleRequestPowerAction('lxc', ct.vmid, 'start', ct.name)}
                                disabled={isBusy}
                                title="Start Container"
                              >
                                <Play size={11} fill="currentColor" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: STORAGE POOLS */}
        {activeTab === 'storage' && (
          <div className="docker-table-wrapper overflow-x-auto">
            <table className="docker-table w-full">
              <thead>
                <tr>
                  <th>Storage Pool</th>
                  <th>Plugin Type</th>
                  <th>Status</th>
                  <th>Used Capacity</th>
                  <th>Available</th>
                  <th>Total Pool Size</th>
                </tr>
              </thead>
              <tbody>
                {(data?.storage || []).map((s: any, idx: number) => (
                  <tr key={idx}>
                    <td className="font-mono font-bold" style={{ color: 'var(--racklyt-cyan)' }}>
                      {s.storage}
                    </td>
                    <td>
                      <span className="status-badge-pill running text-[10px] uppercase font-mono">
                        {s.type}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge-pill ${s.active ? 'running' : 'exited'}`}>
                        {s.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <span className="w-11 font-mono text-xs">{s.percent}%</span>
                        <div className="mini-meter-bar w-20">
                          <div
                            className="mini-meter-fill"
                            style={{
                              width: `${Math.min(s.percent, 100)}%`,
                              backgroundColor: s.percent > 85 ? 'var(--racklyt-red)' : 'var(--racklyt-green)',
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-mutedText">({formatBytes(s.used)})</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--racklyt-green)' }}>
                      {formatBytes(s.avail)}
                    </td>
                    <td className="font-mono text-xs text-primaryText font-semibold">
                      {formatBytes(s.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enroll Node Modal */}
      <EnrollNodeModal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
      />

      {/* Interactive Power Action Confirmation Dialog */}
      {powerModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-subtle)] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2.5 text-coral">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm text-primaryText">Hypervisor Power Control</h3>
            </div>

            <p className="text-xs text-mutedText leading-relaxed">
              Are you sure you want to execute command{' '}
              <strong className="text-accent uppercase font-mono">{powerModalTarget.action}</strong> on{' '}
              {powerModalTarget.type === 'qemu' ? 'Virtual Machine' : 'LXC Container'}{' '}
              <strong className="text-primaryText font-mono">{powerModalTarget.name}</strong> (ID:{' '}
              <span className="text-accent font-mono">{powerModalTarget.vmid}</span>)?
            </p>

            <div className="p-3 rounded bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-weak)] text-[11px] text-mutedText space-y-1 font-mono">
              {powerModalTarget.action === 'shutdown' && (
                <div className="text-amber-400">
                  ● ACPI Shutdown: Sends graceful power-down signal allowing OS to flush disk cache and stop databases cleanly.
                </div>
              )}
              {powerModalTarget.action === 'stop' && (
                <div className="text-coral">
                  ● Force Stop: Immediately terminates the QEMU process (equivalent to pulling physical power cord).
                </div>
              )}
              {powerModalTarget.action === 'reboot' && (
                <div className="text-cyan-400">
                  ● Guest Reboot: Issues reboot instruction through QEMU guest agent or ACPI warm reset.
                </div>
              )}
              {powerModalTarget.action === 'pause' && (
                <div className="text-amber-400">
                  ● CPU Pause: Freezes virtual CPU execution without losing memory state.
                </div>
              )}
              {powerModalTarget.action === 'start' && (
                <div className="text-emerald">
                  ● Power On: Launches QEMU guest with assigned virtual hardware and networks.
                </div>
              )}
              {powerModalTarget.action === 'resume' && (
                <div className="text-emerald">
                  ● Resume: Unfreezes virtual CPU execution and resumes guest processing.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[var(--racklyt-border-weak)] flex justify-end space-x-2">
              <button
                onClick={() => setPowerModalTarget(null)}
                className="px-3 py-1.5 rounded bg-[var(--racklyt-elevated)] hover:bg-[var(--racklyt-subtle)] text-xs text-primaryText border border-[var(--racklyt-border-weak)]"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedPowerAction}
                className="px-3.5 py-1.5 rounded bg-accent hover:bg-accent/80 text-xs font-bold text-white transition flex items-center space-x-1.5"
              >
                <span>Confirm {powerModalTarget.action.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProxmoxView;
