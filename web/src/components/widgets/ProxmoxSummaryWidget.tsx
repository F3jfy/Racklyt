import React, { useState, useEffect } from 'react';
import {
  Server,
  Layers,
  Play,
  Square,
  RotateCw,
  Terminal,
  HardDrive,
  Cpu,
  Activity,
  CheckCircle2,
  Pause,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { ApiClient } from '../../api/client';

interface VmItem {
  vmid: number;
  name: string;
  type: 'qemu' | 'lxc';
  status: 'running' | 'stopped';
  cpus: number;
  cpuUsage: number;
  memoryMb: number;
  maxMemoryMb: number;
  uptime: string;
}

interface StoragePool {
  id: string;
  type: string;
  usedGb: number;
  totalGb: number;
  status: 'active' | 'degraded';
}

interface ProxmoxSummaryWidgetProps {
  nodeName?: string;
  runningVms?: number;
  totalVms?: number;
  runningLxcs?: number;
  totalLxcs?: number;
  cpuPercent?: number;
  ramPercent?: number;
}

export const ProxmoxSummaryWidget: React.FC<ProxmoxSummaryWidgetProps> = ({
  nodeName = 'pve-cluster-01',
  cpuPercent = 24.8,
  ramPercent = 42.4,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'vms' | 'lxcs' | 'storage'>('overview');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [vms, setVms] = useState<VmItem[]>([
    {
      vmid: 100,
      name: 'opnsense-edge-gw',
      type: 'qemu',
      status: 'running',
      cpus: 2,
      cpuUsage: 4.8,
      memoryMb: 1240,
      maxMemoryMb: 4096,
      uptime: '42d 18h',
    },
    {
      vmid: 101,
      name: 'truenas-core-nas',
      type: 'qemu',
      status: 'running',
      cpus: 4,
      cpuUsage: 12.4,
      memoryMb: 14800,
      maxMemoryMb: 16384,
      uptime: '18d 04h',
    },
    {
      vmid: 102,
      name: 'k8s-control-plane',
      type: 'qemu',
      status: 'running',
      cpus: 4,
      cpuUsage: 22.1,
      memoryMb: 6140,
      maxMemoryMb: 8192,
      uptime: '9d 12h',
    },
    {
      vmid: 103,
      name: 'win11-gpu-rdp',
      type: 'qemu',
      status: 'stopped',
      cpus: 8,
      cpuUsage: 0.0,
      memoryMb: 0,
      maxMemoryMb: 16384,
      uptime: 'Offline',
    },
    {
      vmid: 200,
      name: 'vaultwarden-pw',
      type: 'lxc',
      status: 'running',
      cpus: 1,
      cpuUsage: 0.8,
      memoryMb: 86,
      maxMemoryMb: 512,
      uptime: '42d 18h',
    },
    {
      vmid: 201,
      name: 'adguard-dns-local',
      type: 'lxc',
      status: 'running',
      cpus: 1,
      cpuUsage: 1.2,
      memoryMb: 110,
      maxMemoryMb: 1024,
      uptime: '31d 06h',
    },
    {
      vmid: 202,
      name: 'nginx-proxy-hub',
      type: 'lxc',
      status: 'running',
      cpus: 2,
      cpuUsage: 2.5,
      memoryMb: 180,
      maxMemoryMb: 1024,
      uptime: '18d 04h',
    },
    {
      vmid: 203,
      name: 'postgresql-ha-db',
      type: 'lxc',
      status: 'running',
      cpus: 2,
      cpuUsage: 5.6,
      memoryMb: 620,
      maxMemoryMb: 2048,
      uptime: '9d 12h',
    },
  ]);

  const storagePools: StoragePool[] = [
    { id: 'local-zfs (rpool)', type: 'ZFS Pool (Mirror NVMe)', usedGb: 124, totalGb: 480, status: 'active' },
    { id: 'tank-data (RAIDZ2)', type: 'ZFS Pool (4x 4TB Red)', usedGb: 4200, totalGb: 12000, status: 'active' },
    { id: 'synology-nfs-backups', type: 'NFS Remote Share', usedGb: 820, totalGb: 2000, status: 'active' },
  ];

  const runningQemu = vms.filter((v) => v.type === 'qemu' && v.status === 'running').length;
  const totalQemu = vms.filter((v) => v.type === 'qemu').length;
  const runningLxc = vms.filter((v) => v.type === 'lxc' && v.status === 'running').length;
  const totalLxc = vms.filter((v) => v.type === 'lxc').length;

  useEffect(() => {
    ApiClient.getProxmoxCluster()
      .then((res) => {
        if (res?.cluster) {
          const vmsList: VmItem[] = [
            ...res.cluster.vms.map((v: any) => ({
              vmid: v.vmid,
              name: v.name,
              type: 'qemu' as const,
              status: v.status as 'running' | 'stopped',
              cpus: v.cpus,
              cpuUsage: v.cpu_usage,
              memoryMb: v.memory_mb,
              maxMemoryMb: v.max_memory_mb,
              uptime: v.uptime,
            })),
            ...res.cluster.containers.map((c: any) => ({
              vmid: c.vmid,
              name: c.name,
              type: 'lxc' as const,
              status: c.status as 'running' | 'stopped',
              cpus: c.cpus,
              cpuUsage: c.cpu_usage,
              memoryMb: c.memory_mb,
              maxMemoryMb: c.max_memory_mb,
              uptime: c.uptime,
            })),
          ];
          if (vmsList.length > 0) setVms(vmsList);
        }
      })
      .catch(() => {});
  }, []);

  const handleVmAction = async (vmid: number, action: 'start' | 'stop' | 'reboot' | 'pause' | 'resume') => {
    setBusyId(vmid);
    const target = vms.find((v) => v.vmid === vmid);
    try {
      const res = await ApiClient.proxmoxPowerAction(target?.type || 'qemu', vmid, action);
      setVms((prev) =>
        prev.map((v) => {
          if (v.vmid === vmid) {
            return {
              ...v,
              status: action === 'stop' ? 'stopped' : action === 'pause' ? 'stopped' : 'running',
              uptime: action === 'stop' ? 'Offline' : action === 'pause' ? 'Paused' : 'Just started',
              cpuUsage: action === 'stop' ? 0 : 3.5,
            };
          }
          return v;
        })
      );
      toast.success(res.message || `${target?.name || `VM ${vmid}`} ${action} executed`);
    } catch (err: any) {
      toast.error(err.message || 'Power action failed');
    } finally {
      setBusyId(null);
    }
  };

  const openHostDeepDive = () => {
    window.dispatchEvent(
      new CustomEvent('racklyt_open_node_deepdive', {
        detail: {
          nodeId: 'workstation-node-01',
          nodeName: 'pve-cluster-01 (Proxmox Host)',
        },
      })
    );
  };

  const displayedList =
    activeTab === 'vms'
      ? vms.filter((v) => v.type === 'qemu')
      : activeTab === 'lxcs'
      ? vms.filter((v) => v.type === 'lxc')
      : [];

  return (
    <div className="p-2 space-y-2 text-xs">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1.5 border-b border-[var(--racklyt-border-weak)] gap-1.5">
        <div className="flex items-center space-x-1.5">
          <Server size={14} style={{ color: 'var(--racklyt-orange)' }} />
          <span className="font-semibold text-xs uppercase tracking-wider text-primaryText">
            Proxmox VE Hypervisor
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
            <CheckCircle2 size={10} />
            <span>Quorum OK</span>
          </span>
          <button
            onClick={openHostDeepDive}
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-cyan-400 border border-white/10 flex items-center space-x-1 transition"
            title="Inspect Host Telemetry, Processes & Services"
          >
            <ExternalLink size={10} />
            <span>Host Deep Dive</span>
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center space-x-1 bg-[var(--racklyt-bg-input)] p-0.5 rounded-lg border border-[var(--racklyt-border-weak)] font-mono text-[11px]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-2 py-1 rounded transition ${
              activeTab === 'overview'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('vms')}
            className={`px-2 py-1 rounded transition ${
              activeTab === 'vms'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            VMs ({runningQemu}/{totalQemu})
          </button>
          <button
            onClick={() => setActiveTab('lxcs')}
            className={`px-2 py-1 rounded transition ${
              activeTab === 'lxcs'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            LXCs ({runningLxc}/{totalLxc})
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-2 py-1 rounded transition ${
              activeTab === 'storage'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            ZFS Storage
          </button>
        </div>
      </div>

      {/* View: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* VMs */}
            <div
              onClick={() => setActiveTab('vms')}
              className="p-2.5 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex flex-col justify-between hover:border-[var(--racklyt-cyan)]/50 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-mutedText">
                <span className="text-[10px] font-semibold uppercase">QEMU VMs</span>
                <Layers size={13} style={{ color: 'var(--racklyt-cyan)' }} />
              </div>
              <div className="my-1 text-lg font-bold font-mono text-emerald-400">
                {runningQemu} <span className="text-xs text-mutedText font-normal">/ {totalQemu} Online</span>
              </div>
              <div className="mini-meter-bar h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="mini-meter-fill bg-emerald-400 h-full rounded-full transition-all"
                  style={{ width: `${(runningQemu / totalQemu) * 100}%` }}
                />
              </div>
            </div>

            {/* LXCs */}
            <div
              onClick={() => setActiveTab('lxcs')}
              className="p-2.5 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex flex-col justify-between hover:border-[var(--racklyt-orange)]/50 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-mutedText">
                <span className="text-[10px] font-semibold uppercase">LXC Containers</span>
                <Layers size={13} style={{ color: 'var(--racklyt-orange)' }} />
              </div>
              <div className="my-1 text-lg font-bold font-mono text-emerald-400">
                {runningLxc} <span className="text-xs text-mutedText font-normal">/ {totalLxc} Online</span>
              </div>
              <div className="mini-meter-bar h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="mini-meter-fill bg-emerald-400 h-full rounded-full transition-all"
                  style={{ width: `${(runningLxc / totalLxc) * 100}%` }}
                />
              </div>
            </div>

            {/* CPU allocation */}
            <div className="p-2.5 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-mutedText">
                <span className="text-[10px] font-semibold uppercase">Node CPU Load</span>
                <Cpu size={13} className="text-amber-400" />
              </div>
              <div className="my-1 text-lg font-bold font-mono text-amber-400">
                {cpuPercent}% <span className="text-[10px] text-mutedText font-normal">16 vCPUs</span>
              </div>
              <div className="mini-meter-bar h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="mini-meter-fill bg-amber-400 h-full rounded-full transition-all"
                  style={{ width: `${cpuPercent}%` }}
                />
              </div>
            </div>

            {/* RAM allocation */}
            <div className="p-2.5 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-mutedText">
                <span className="text-[10px] font-semibold uppercase">ZFS ARC & RAM</span>
                <Activity size={13} className="text-blue-400" />
              </div>
              <div className="my-1 text-lg font-bold font-mono text-blue-400">
                {ramPercent}% <span className="text-[10px] text-mutedText font-normal">27.1 / 64 GB</span>
              </div>
              <div className="mini-meter-bar h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="mini-meter-fill bg-blue-400 h-full rounded-full transition-all"
                  style={{ width: `${ramPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Details Bar */}
          <div className="p-2.5 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-mutedText">
            <span className="flex items-center space-x-1.5">
              <span className="text-primaryText font-semibold">Node:</span>
              <span>{nodeName}</span>
            </span>
            <span>Kernel: Linux 6.8.12-pve</span>
            <span>PVE Version: 8.2.4</span>
            <span className="text-emerald-400">Corosync: Ring 0 Active</span>
          </div>
        </div>
      )}

      {/* View: Virtual Machines or LXCs Table */}
      {(activeTab === 'vms' || activeTab === 'lxcs') && (
        <div className="overflow-x-auto">
          <table className="docker-table w-full text-left">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>vCPUs</th>
                <th>CPU Load</th>
                <th>Memory</th>
                <th>Uptime</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedList.map((item) => (
                <tr key={item.vmid}>
                  <td className="font-mono font-bold text-[var(--racklyt-orange)]">
                    {item.vmid}
                  </td>
                  <td className="font-semibold text-primaryText">
                    {item.name}
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        item.status === 'running'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-mutedText border border-white/10'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                      <span>{item.status.toUpperCase()}</span>
                    </span>
                  </td>
                  <td className="font-mono text-mutedText">{item.cpus}</td>
                  <td className="font-mono text-primaryText">
                    {item.status === 'running' ? `${item.cpuUsage}%` : '—'}
                  </td>
                  <td className="font-mono text-mutedText">
                    {item.status === 'running'
                      ? `${item.memoryMb} / ${item.maxMemoryMb} MB`
                      : `${item.maxMemoryMb} MB alloc`}
                  </td>
                  <td className="font-mono text-[11px] text-mutedText">{item.uptime}</td>
                  <td className="text-right">
                    <div className="inline-flex items-center space-x-1">
                      {item.status === 'running' ? (
                        <>
                          <button
                            disabled={busyId === item.vmid}
                            onClick={() => handleVmAction(item.vmid, 'pause')}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-mutedText hover:text-amber-400 transition"
                            title="Pause Virtual Machine"
                          >
                            <Pause size={12} />
                          </button>
                          <button
                            disabled={busyId === item.vmid}
                            onClick={() => handleVmAction(item.vmid, 'reboot')}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-mutedText hover:text-cyan-400 transition"
                            title="Reboot Guest"
                          >
                            <RotateCw size={12} className={busyId === item.vmid ? 'animate-spin' : ''} />
                          </button>
                          <button
                            disabled={busyId === item.vmid}
                            onClick={() => handleVmAction(item.vmid, 'stop')}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-mutedText hover:text-red-400 transition"
                            title="Stop / Shutdown Guest"
                          >
                            <Square size={12} />
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={busyId === item.vmid}
                          onClick={() => handleVmAction(item.vmid, 'start')}
                          className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition"
                          title="Start / Resume Guest"
                        >
                          <Play size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => toast.info(`Opening noVNC Console for ${item.name}...`)}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 text-mutedText hover:text-cyan-400 transition"
                        title="noVNC Console"
                      >
                        <Terminal size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View: ZFS Storage Pools */}
      {activeTab === 'storage' && (
        <div className="space-y-2.5">
          {storagePools.map((sp) => {
            const pct = Math.round((sp.usedGb / sp.totalGb) * 100);
            return (
              <div
                key={sp.id}
                className="p-2.5 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <HardDrive size={13} className="text-[var(--racklyt-cyan)]" />
                    <span className="font-mono font-bold text-primaryText">{sp.id}</span>
                    <span className="text-[10px] text-mutedText">({sp.type})</span>
                  </div>
                  <span className="text-emerald-400 font-mono text-[11px] font-semibold">
                    ONLINE (0 checksum errs)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-mutedText">
                  <span>
                    {sp.usedGb >= 1000 ? `${(sp.usedGb / 1000).toFixed(1)} TB` : `${sp.usedGb} GB`} used of{' '}
                    {sp.totalGb >= 1000 ? `${(sp.totalGb / 1000).toFixed(1)} TB` : `${sp.totalGb} GB`}
                  </span>
                  <span>{pct}% allocated</span>
                </div>
                <div className="mini-meter-bar h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`mini-meter-fill h-full rounded-full transition-all ${
                      pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProxmoxSummaryWidget;
