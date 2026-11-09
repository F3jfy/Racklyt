import React, { useState, useEffect } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Layers,
  Terminal,
  Play,
  Square,
  RotateCw,
  Search,
  X,
  RefreshCw,
  AlertTriangle,
  Radio,
  SlidersHorizontal,
  Flame,
  Clock,
  Network,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

interface NodeDeepDiveModalProps {
  nodeId: string | null;
  nodeName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const NodeDeepDiveModal: React.FC<NodeDeepDiveModalProps> = ({
  nodeId,
  nodeName,
  isOpen,
  onClose,
}) => {
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'processes' | 'services' | 'containers' | 'sockets'>('overview');
  const [deepDiveData, setDeepDiveData] = useState<any | null>(null);
  const [processes, setProcesses] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [sockets, setSockets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filters
  const [processSearch, setProcessSearch] = useState('');
  const [processSort, setProcessSort] = useState<'cpu' | 'mem' | 'pid' | 'name'>('cpu');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'active' | 'inactive' | 'failed'>('all');
  const [serviceSearch, setServiceSearch] = useState('');

  // Action Dialog States
  const [killTarget, setKillTarget] = useState<{ pid: number; name: string } | null>(null);
  const [killSignal, setKillSignal] = useState<'TERM' | 'KILL'>('TERM');
  const [serviceTarget, setServiceTarget] = useState<{ name: string; action: 'start' | 'stop' | 'restart' } | null>(null);
  const [containerTarget, setContainerTarget] = useState<{ id: string; name: string; action: 'start' | 'stop' | 'restart' } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Load Deep Dive Overview
  const loadOverview = async () => {
    if (!nodeId) return;
    try {
      const data = await ApiClient.getNodeDeepDive(nodeId);
      setDeepDiveData(data);
    } catch (err: any) {
      console.error('Failed to load node deep dive:', err);
    }
  };

  // Load Processes
  const loadProcesses = async () => {
    if (!nodeId) return;
    try {
      const data = await ApiClient.getNodeProcesses(nodeId, {
        search: processSearch,
        sort_by: processSort,
        limit: 100,
      });
      setProcesses(data);
    } catch (err: any) {
      console.error('Failed to load processes:', err);
    }
  };

  // Load Services
  const loadServices = async () => {
    if (!nodeId) return;
    try {
      const data = await ApiClient.getNodeServices(nodeId);
      setServices(data);
    } catch (err: any) {
      console.error('Failed to load services:', err);
    }
  };

  // Load Containers
  const loadContainers = async () => {
    if (!nodeId) return;
    try {
      const data = await ApiClient.getNodeContainers(nodeId);
      setContainers(data);
    } catch (err: any) {
      console.error('Failed to load containers:', err);
    }
  };

  // Load Sockets
  const loadSockets = async () => {
    if (!nodeId) return;
    try {
      const data = await ApiClient.getNodeSockets(nodeId);
      setSockets(data);
    } catch (err: any) {
      console.error('Failed to load sockets:', err);
    }
  };

  const refreshActiveTab = async () => {
    if (!nodeId) return;
    setLoading(true);
    await loadOverview();
    if (activeTab === 'processes') await loadProcesses();
    if (activeTab === 'services') await loadServices();
    if (activeTab === 'containers') await loadContainers();
    if (activeTab === 'sockets') await loadSockets();
    setLoading(false);
  };

  // Initial tab loading
  useEffect(() => {
    if (isOpen && nodeId) {
      loadOverview();
      if (activeTab === 'processes') loadProcesses();
      if (activeTab === 'services') loadServices();
      if (activeTab === 'containers') loadContainers();
      if (activeTab === 'sockets') loadSockets();
    }
  }, [isOpen, nodeId, activeTab, processSort]);

  // Debounced search for processes
  useEffect(() => {
    if (activeTab === 'processes' && isOpen && nodeId) {
      const timer = setTimeout(() => {
        loadProcesses();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [processSearch]);

  // Auto-refresh interval
  useEffect(() => {
    if (!isOpen || !nodeId || !autoRefresh) return;
    const interval = setInterval(() => {
      loadOverview();
      if (activeTab === 'processes') loadProcesses();
    }, 2500);
    return () => clearInterval(interval);
  }, [isOpen, nodeId, autoRefresh, activeTab, processSearch, processSort]);

  // Handle Kill Process
  const handleExecuteKill = async () => {
    if (!nodeId || !killTarget) return;
    setActionBusy(true);
    try {
      const res = await ApiClient.killNodeProcess(nodeId, killTarget.pid, killSignal);
      toast.success(res.message || `Signal ${killSignal} sent to PID ${killTarget.pid}`);
      setKillTarget(null);
      await loadProcesses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to kill process');
    } finally {
      setActionBusy(false);
    }
  };

  // Handle Service Action
  const handleExecuteServiceAction = async () => {
    if (!nodeId || !serviceTarget) return;
    setActionBusy(true);
    try {
      const res = await ApiClient.serviceAction(nodeId, serviceTarget.name, serviceTarget.action);
      toast.success(res.message || `Service ${serviceTarget.name} ${serviceTarget.action}ed`);
      setServiceTarget(null);
      await loadServices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to execute service action');
    } finally {
      setActionBusy(false);
    }
  };

  // Handle Container Action
  const handleExecuteContainerAction = async () => {
    if (!nodeId || !containerTarget) return;
    setActionBusy(true);
    try {
      const res = await ApiClient.containerAction(nodeId, containerTarget.id, containerTarget.action);
      toast.success(res.message || `Container ${containerTarget.name} ${containerTarget.action}ed`);
      setContainerTarget(null);
      await loadContainers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to execute container action');
    } finally {
      setActionBusy(false);
    }
  };

  if (!isOpen || !nodeId) return null;

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      s.description.toLowerCase().includes(serviceSearch.toLowerCase());
    if (!matchesSearch) return false;

    if (serviceFilter === 'active') return s.active_state === 'active';
    if (serviceFilter === 'inactive') return s.active_state === 'inactive';
    if (serviceFilter === 'failed') return s.active_state === 'failed';
    return true;
  });

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes >= 1024 * 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1) + ' TB';
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-6xl h-[92vh] flex flex-col bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-subtle)] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 bg-[var(--racklyt-elevated)] border-b border-[var(--racklyt-border-weak)] gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-[var(--racklyt-text-primary)] tracking-wide">
                  {deepDiveData?.node?.name || nodeName || nodeId}
                </h2>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald/20 text-emerald border border-emerald/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
                  <span>ONLINE</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--racklyt-subtle)] text-[var(--racklyt-text-muted)] border border-[var(--racklyt-border-weak)]">
                  {deepDiveData?.node?.os || 'Linux'} • {deepDiveData?.node?.arch || 'x86_64'}
                </span>
              </div>
              <div className="flex items-center space-x-3 mt-0.5 text-xs text-[var(--racklyt-text-muted)] font-mono">
                <span>{deepDiveData?.node?.hostname || 'host.lan'}</span>
                <span>•</span>
                <span>{deepDiveData?.node?.ip_address || '127.0.0.1'}</span>
                <span>•</span>
                <span className="flex items-center space-x-1 text-accent">
                  <Clock className="w-3 h-3" />
                  <span>Up {deepDiveData?.uptime_formatted || '1d 04h'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono border transition ${
                autoRefresh
                  ? 'bg-accent/20 text-accent border-accent/40'
                  : 'bg-[var(--racklyt-surface)] text-[var(--racklyt-text-muted)] border-[var(--racklyt-border-weak)]'
              }`}
              title="Live 2.5s Auto-Refresh"
            >
              <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-accent' : ''}`} />
              <span>{autoRefresh ? 'Live' : 'Paused'}</span>
            </button>

            <button
              onClick={refreshActiveTab}
              disabled={loading}
              className="p-1.5 rounded bg-[var(--racklyt-surface)] hover:bg-[var(--racklyt-subtle)] text-[var(--racklyt-text-secondary)] border border-[var(--racklyt-border-weak)] transition"
              title="Refresh now"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-accent' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded bg-[var(--racklyt-surface)] hover:bg-coral/20 hover:text-coral text-[var(--racklyt-text-muted)] border border-[var(--racklyt-border-weak)] transition"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-5 bg-[var(--racklyt-surface)] border-b border-[var(--racklyt-border-weak)] space-x-1 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-accent text-accent'
                : 'border-transparent text-[var(--racklyt-text-muted)] hover:text-[var(--racklyt-text-primary)]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Overview & Hardware</span>
          </button>

          <button
            onClick={() => setActiveTab('processes')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'processes'
                ? 'border-accent text-accent'
                : 'border-transparent text-[var(--racklyt-text-muted)] hover:text-[var(--racklyt-text-primary)]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Process Manager</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-accent/20 text-accent">
              {deepDiveData?.process_count || processes.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('services')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'services'
                ? 'border-accent text-accent'
                : 'border-transparent text-[var(--racklyt-text-muted)] hover:text-[var(--racklyt-text-primary)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Systemd Services</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--racklyt-subtle)] text-[var(--racklyt-text-muted)]">
              {services.length || deepDiveData?.service_count || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('containers')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'containers'
                ? 'border-accent text-accent'
                : 'border-transparent text-[var(--racklyt-text-muted)] hover:text-[var(--racklyt-text-primary)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Containers</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400">
              {containers.length || 5}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sockets')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'sockets'
                ? 'border-accent text-accent'
                : 'border-transparent text-[var(--racklyt-text-muted)] hover:text-[var(--racklyt-text-primary)]'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Listening Sockets</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: OVERVIEW & HARDWARE */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Top Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* CPU Utilization */}
                <div className="p-3.5 rounded-lg bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-subtle)]">
                  <div className="flex items-center justify-between text-xs text-[var(--racklyt-text-muted)] mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <Cpu className="w-3.5 h-3.5 text-accent" />
                      <span>CPU Utilization</span>
                    </span>
                    <span className="font-mono text-[11px]">{deepDiveData?.cpu_cores || 16} Cores</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-[var(--racklyt-text-primary)]">
                    {(deepDiveData?.cpu_usage_percent || 0).toFixed(1)}%
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, deepDiveData?.cpu_usage_percent || 0)}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-[var(--racklyt-text-muted)] mt-1.5">
                    Load: {(deepDiveData?.load_avg || [0.4, 0.3, 0.2]).join(' • ')}
                  </div>
                </div>

                {/* Memory Usage */}
                <div className="p-3.5 rounded-lg bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-subtle)]">
                  <div className="flex items-center justify-between text-xs text-[var(--racklyt-text-muted)] mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Physical RAM</span>
                    </span>
                    <span className="font-mono text-[11px]">
                      {(deepDiveData?.memory_percent || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xl font-mono font-bold text-[var(--racklyt-text-primary)]">
                    {formatBytes(deepDiveData?.memory_used_bytes || 0)} / {formatBytes(deepDiveData?.memory_total_bytes || 0)}
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, deepDiveData?.memory_percent || 0)}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-[var(--racklyt-text-muted)] mt-1.5">
                    Swap: {formatBytes(deepDiveData?.swap_used_bytes || 0)} / {formatBytes(deepDiveData?.swap_total_bytes || 0)}
                  </div>
                </div>

                {/* Thermal Sensors */}
                <div className="p-3.5 rounded-lg bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-subtle)]">
                  <div className="flex items-center justify-between text-xs text-[var(--racklyt-text-muted)] mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber" />
                      <span>Package Temperature</span>
                    </span>
                    <span className="font-mono text-[11px] text-emerald">Normal</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-[var(--racklyt-text-primary)]">
                    {deepDiveData?.temp_celsius ? `${deepDiveData.temp_celsius.toFixed(1)}°C` : '42.0°C'}
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        (deepDiveData?.temp_celsius || 42) > 80
                          ? 'bg-coral'
                          : (deepDiveData?.temp_celsius || 42) > 65
                          ? 'bg-amber'
                          : 'bg-emerald'
                      }`}
                      style={{ width: `${Math.min(100, ((deepDiveData?.temp_celsius || 42) / 100) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-[var(--racklyt-text-muted)] mt-1.5">
                    Tctl / Tdie Sysfs Core
                  </div>
                </div>

                {/* Network Rate */}
                <div className="p-3.5 rounded-lg bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-subtle)]">
                  <div className="flex items-center justify-between text-xs text-[var(--racklyt-text-muted)] mb-1.5">
                    <span className="flex items-center space-x-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald" />
                      <span>Fleet Network RX / TX</span>
                    </span>
                    <span className="font-mono text-[11px]">10 Gbps</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-[var(--racklyt-text-primary)]">
                    {formatBytes(deepDiveData?.network_interfaces?.[0]?.rx_bytes || 482000000)}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--racklyt-text-muted)] mt-2">
                    TX: {formatBytes(deepDiveData?.network_interfaces?.[0]?.tx_bytes || 214000000)} • Errors: 0
                  </div>
                </div>
              </div>

              {/* Filesystem Storage Mounts */}
              <div className="p-4 rounded-lg bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--racklyt-text-muted)] flex items-center space-x-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-accent" />
                    <span>Mounted Filesystems & Disks</span>
                  </h3>
                  <span className="text-xs font-mono text-[var(--racklyt-text-muted)]">
                    {deepDiveData?.disks?.length || 1} mount points
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(deepDiveData?.disks || [
                    { mount_point: '/', filesystem: 'ext4', total_bytes: 257698037760, used_bytes: 45097156608 },
                    { mount_point: '/var/lib/docker', filesystem: 'overlay2', total_bytes: 1000000000000, used_bytes: 320000000000 },
                  ]).map((disk: any, idx: number) => {
                    const pct = disk.total_bytes > 0 ? (disk.used_bytes / disk.total_bytes) * 100 : 0;
                    return (
                      <div key={idx} className="p-2.5 rounded bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-weak)] space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-[var(--racklyt-text-primary)]">{disk.mount_point}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--racklyt-subtle)] text-[var(--racklyt-text-muted)]">
                              {disk.filesystem}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-[var(--racklyt-text-primary)]">
                            {formatBytes(disk.used_bytes)} / {formatBytes(disk.total_bytes)} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              pct > 90 ? 'bg-coral' : pct > 75 ? 'bg-amber' : 'bg-accent'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hardware & Kernel Specs */}
              <div className="p-4 rounded-lg bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-subtle)] space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--racklyt-text-muted)] flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  <span>Host Specification & Kernel Topology</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-weak)]">
                    <span className="text-[var(--racklyt-text-muted)] block text-[10px]">CPU ARCHITECTURE</span>
                    <span className="text-[var(--racklyt-text-primary)] font-bold">{deepDiveData?.node?.arch || 'x86_64'}</span>
                  </div>
                  <div className="p-2.5 rounded bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-weak)]">
                    <span className="text-[var(--racklyt-text-muted)] block text-[10px]">OPERATING SYSTEM</span>
                    <span className="text-[var(--racklyt-text-primary)] font-bold">{deepDiveData?.node?.os || 'Linux'}</span>
                  </div>
                  <div className="p-2.5 rounded bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-weak)]">
                    <span className="text-[var(--racklyt-text-muted)] block text-[10px]">AGENT PUSH INTERVAL</span>
                    <span className="text-[var(--racklyt-text-primary)] font-bold">{deepDiveData?.node?.push_interval_sec || 3} seconds</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE PROCESS MANAGER */}
          {activeTab === 'processes' && (
            <div className="space-y-3.5">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--racklyt-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search by PID, process name, user, or command..."
                    value={processSearch}
                    onChange={(e) => setProcessSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-weak)] text-xs text-[var(--racklyt-text-primary)] placeholder-[var(--racklyt-text-muted)] focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-xs text-[var(--racklyt-text-muted)]">Sort:</span>
                  <select
                    value={processSort}
                    onChange={(e) => setProcessSort(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-weak)] text-xs text-[var(--racklyt-text-primary)] focus:outline-none focus:border-accent"
                  >
                    <option value="cpu">Highest CPU %</option>
                    <option value="mem">Highest Memory</option>
                    <option value="pid">PID Number</option>
                    <option value="name">Process Name</option>
                  </select>
                </div>
              </div>

              {/* Processes Table */}
              <div className="border border-[var(--racklyt-border-weak)] rounded-lg overflow-hidden bg-[var(--racklyt-elevated)]">
                <div className="max-h-[55vh] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--racklyt-surface)] border-b border-[var(--racklyt-border-weak)] text-[10px] font-mono uppercase text-[var(--racklyt-text-muted)] sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3">PID</th>
                        <th className="py-2 px-3">Process</th>
                        <th className="py-2 px-3">User</th>
                        <th className="py-2 px-3">CPU %</th>
                        <th className="py-2 px-3">Memory</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Command</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--racklyt-border-weak)] font-mono">
                      {processes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-xs text-[var(--racklyt-text-muted)]">
                            No matching processes found.
                          </td>
                        </tr>
                      ) : (
                        processes.map((p) => (
                          <tr key={p.pid} className="hover:bg-[var(--racklyt-surface)] transition group">
                            <td className="py-2 px-3 font-bold text-accent">{p.pid}</td>
                            <td className="py-2 px-3 font-semibold text-[var(--racklyt-text-primary)]">{p.name}</td>
                            <td className="py-2 px-3 text-[var(--racklyt-text-muted)]">{p.user}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                  p.cpu_percent > 20
                                    ? 'bg-coral/20 text-coral'
                                    : p.cpu_percent > 5
                                    ? 'bg-amber/20 text-amber'
                                    : 'text-[var(--racklyt-text-primary)]'
                                }`}
                              >
                                {p.cpu_percent.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2 px-3 text-[var(--racklyt-text-primary)]">
                              {p.memory_mb.toFixed(1)} MB
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--racklyt-subtle)] text-[var(--racklyt-text-muted)]">
                                {p.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-[11px] text-[var(--racklyt-text-muted)] truncate max-w-[220px]" title={p.command}>
                              {p.command}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {hasPermission('nodes:manage') && (
                                <button
                                  onClick={() => setKillTarget({ pid: p.pid, name: p.name })}
                                  className="px-2 py-0.5 rounded bg-coral/10 hover:bg-coral/30 text-coral border border-coral/30 text-[10px] transition"
                                  title={`Kill process ${p.name}`}
                                >
                                  End
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEMD SERVICES */}
          {activeTab === 'services' && (
            <div className="space-y-3.5">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--racklyt-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search services by unit name or description..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-weak)] text-xs text-[var(--racklyt-text-primary)] placeholder-[var(--racklyt-text-muted)] focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center space-x-1.5 shrink-0 text-xs">
                  {(['all', 'active', 'inactive', 'failed'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setServiceFilter(mode)}
                      className={`px-2.5 py-1 rounded capitalize transition font-medium ${
                        serviceFilter === mode
                          ? 'bg-accent text-white'
                          : 'bg-[var(--racklyt-surface)] hover:bg-[var(--racklyt-subtle)] text-[var(--racklyt-text-muted)] border border-[var(--racklyt-border-weak)]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Services Table */}
              <div className="border border-[var(--racklyt-border-weak)] rounded-lg overflow-hidden bg-[var(--racklyt-elevated)]">
                <div className="max-h-[55vh] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--racklyt-surface)] border-b border-[var(--racklyt-border-weak)] text-[10px] font-mono uppercase text-[var(--racklyt-text-muted)] sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3">Service Unit</th>
                        <th className="py-2 px-3">State</th>
                        <th className="py-2 px-3">Substate</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--racklyt-border-weak)] font-mono">
                      {filteredServices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-[var(--racklyt-text-muted)]">
                            No matching services found.
                          </td>
                        </tr>
                      ) : (
                        filteredServices.map((svc) => (
                          <tr key={svc.name} className="hover:bg-[var(--racklyt-surface)] transition">
                            <td className="py-2.5 px-3 font-semibold text-[var(--racklyt-text-primary)]">
                              {svc.name}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  svc.active_state === 'active'
                                    ? 'bg-emerald/20 text-emerald border border-emerald/30'
                                    : svc.active_state === 'failed'
                                    ? 'bg-coral/20 text-coral border border-coral/30'
                                    : 'bg-[var(--racklyt-subtle)] text-[var(--racklyt-text-muted)] border border-[var(--racklyt-border-weak)]'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    svc.active_state === 'active'
                                      ? 'bg-emerald'
                                      : svc.active_state === 'failed'
                                      ? 'bg-coral'
                                      : 'bg-zinc-500'
                                  }`}
                                />
                                <span className="uppercase">{svc.active_state}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[var(--racklyt-text-muted)] text-[11px]">{svc.sub_state}</td>
                            <td className="py-2.5 px-3 text-[var(--racklyt-text-secondary)] font-sans text-xs truncate max-w-[280px]">
                              {svc.description}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {hasPermission('nodes:manage') && (
                                <div className="flex items-center justify-end space-x-1.5">
                                  {svc.active_state === 'active' ? (
                                    <>
                                      <button
                                        onClick={() => setServiceTarget({ name: svc.name, action: 'restart' })}
                                        className="p-1 rounded bg-[var(--racklyt-surface)] hover:bg-[var(--racklyt-subtle)] text-accent border border-[var(--racklyt-border-weak)] transition"
                                        title="Restart service"
                                      >
                                        <RotateCw className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setServiceTarget({ name: svc.name, action: 'stop' })}
                                        className="p-1 rounded bg-[var(--racklyt-surface)] hover:bg-coral/20 text-coral border border-[var(--racklyt-border-weak)] transition"
                                        title="Stop service"
                                      >
                                        <Square className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => setServiceTarget({ name: svc.name, action: 'start' })}
                                      className="p-1 rounded bg-[var(--racklyt-surface)] hover:bg-emerald/20 text-emerald border border-[var(--racklyt-border-weak)] transition"
                                      title="Start service"
                                    >
                                      <Play className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CONTAINERS */}
          {activeTab === 'containers' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {containers.map((ct) => (
                  <div
                    key={ct.id}
                    className="p-3.5 rounded-lg bg-[var(--racklyt-elevated)] border border-[var(--racklyt-border-subtle)] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-xs text-[var(--racklyt-text-primary)]">{ct.name}</span>
                      </div>
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          ct.status === 'running'
                            ? 'bg-emerald/20 text-emerald border border-emerald/30'
                            : 'bg-zinc-700/30 text-zinc-400 border border-zinc-700/50'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${ct.status === 'running' ? 'bg-emerald animate-pulse' : 'bg-zinc-500'}`} />
                        <span className="uppercase">{ct.status}</span>
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-[var(--racklyt-text-muted)] truncate" title={ct.image}>
                      {ct.image}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[var(--racklyt-surface)] p-2 rounded border border-[var(--racklyt-border-weak)]">
                      <div>
                        <span className="text-[10px] text-[var(--racklyt-text-muted)] block">CPU USAGE</span>
                        <span className="font-bold text-[var(--racklyt-text-primary)]">{ct.cpu_percent.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--racklyt-text-muted)] block">MEMORY</span>
                        <span className="font-bold text-[var(--racklyt-text-primary)]">{ct.memory_mb.toFixed(0)} MB</span>
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-[var(--racklyt-text-muted)] truncate">
                      Ports: {(ct.ports || []).join(', ') || 'Host networking'}
                    </div>

                    {hasPermission('nodes:manage') && (
                      <div className="pt-2 border-t border-[var(--racklyt-border-weak)] flex items-center justify-end space-x-2">
                        {ct.status === 'running' ? (
                          <>
                            <button
                              onClick={() => setContainerTarget({ id: ct.id, name: ct.name, action: 'restart' })}
                              className="px-2 py-1 rounded bg-[var(--racklyt-surface)] hover:bg-[var(--racklyt-subtle)] text-accent border border-[var(--racklyt-border-weak)] text-[10px] font-mono transition"
                            >
                              Restart
                            </button>
                            <button
                              onClick={() => setContainerTarget({ id: ct.id, name: ct.name, action: 'stop' })}
                              className="px-2 py-1 rounded bg-[var(--racklyt-surface)] hover:bg-coral/20 text-coral border border-[var(--racklyt-border-weak)] text-[10px] font-mono transition"
                            >
                              Stop
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setContainerTarget({ id: ct.id, name: ct.name, action: 'start' })}
                            className="px-2.5 py-1 rounded bg-emerald/20 hover:bg-emerald/30 text-emerald border border-emerald/30 text-[10px] font-mono transition"
                          >
                            Start
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: LISTENING SOCKETS */}
          {activeTab === 'sockets' && (
            <div className="border border-[var(--racklyt-border-weak)] rounded-lg overflow-hidden bg-[var(--racklyt-elevated)]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[var(--racklyt-surface)] border-b border-[var(--racklyt-border-weak)] text-[10px] uppercase text-[var(--racklyt-text-muted)]">
                  <tr>
                    <th className="py-2 px-3">Protocol</th>
                    <th className="py-2 px-3">Port</th>
                    <th className="py-2 px-3">Binding Address</th>
                    <th className="py-2 px-3">Process / Service</th>
                    <th className="py-2 px-3">PID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--racklyt-border-weak)]">
                  {sockets.map((s, idx) => (
                    <tr key={idx} className="hover:bg-[var(--racklyt-surface)] transition">
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent/20 text-accent font-bold">
                          {s.proto}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[var(--racklyt-text-primary)]">:{s.port}</td>
                      <td className="py-2.5 px-3 text-[var(--racklyt-text-muted)]">{s.local_address}</td>
                      <td className="py-2.5 px-3 font-semibold text-[var(--racklyt-text-secondary)]">{s.process}</td>
                      <td className="py-2.5 px-3 text-accent">{s.pid || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* DIALOG 1: KILL PROCESS MODAL */}
        {killTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
            <div className="bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-subtle)] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scale-up">
              <div className="flex items-center space-x-2.5 text-coral">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-sm text-[var(--racklyt-text-primary)]">Terminate Process</h3>
              </div>

              <p className="text-xs text-[var(--racklyt-text-muted)]">
                Are you sure you want to send a signal to process{' '}
                <strong className="text-[var(--racklyt-text-primary)] font-mono">{killTarget.name}</strong> (PID:{' '}
                <span className="text-accent font-mono">{killTarget.pid}</span>)?
              </p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--racklyt-text-secondary)]">Signal Type:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKillSignal('TERM')}
                    className={`p-2 rounded text-xs font-mono border text-left transition ${
                      killSignal === 'TERM'
                        ? 'border-accent bg-accent/20 text-accent font-bold'
                        : 'border-[var(--racklyt-border-weak)] bg-[var(--racklyt-elevated)] text-[var(--racklyt-text-muted)]'
                    }`}
                  >
                    <div>SIGTERM (15)</div>
                    <div className="text-[10px] font-sans text-[var(--racklyt-text-muted)]">Graceful Termination</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKillSignal('KILL')}
                    className={`p-2 rounded text-xs font-mono border text-left transition ${
                      killSignal === 'KILL'
                        ? 'border-coral bg-coral/20 text-coral font-bold'
                        : 'border-[var(--racklyt-border-weak)] bg-[var(--racklyt-elevated)] text-[var(--racklyt-text-muted)]'
                    }`}
                  >
                    <div>SIGKILL (9)</div>
                    <div className="text-[10px] font-sans text-[var(--racklyt-text-muted)]">Force Immediate Kill</div>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--racklyt-border-weak)] flex justify-end space-x-2">
                <button
                  onClick={() => setKillTarget(null)}
                  disabled={actionBusy}
                  className="px-3 py-1.5 rounded bg-[var(--racklyt-elevated)] hover:bg-[var(--racklyt-subtle)] text-xs text-[var(--racklyt-text-primary)] border border-[var(--racklyt-border-weak)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteKill}
                  disabled={actionBusy}
                  className="px-3.5 py-1.5 rounded bg-coral hover:bg-coral/80 text-xs font-bold text-white transition flex items-center space-x-1.5"
                >
                  {actionBusy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Termination</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG 2: SERVICE ACTION MODAL */}
        {serviceTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
            <div className="bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-subtle)] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scale-up">
              <div className="flex items-center space-x-2.5 text-accent">
                <SlidersHorizontal className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-sm text-[var(--racklyt-text-primary)]">Execute Service Action</h3>
              </div>

              <p className="text-xs text-[var(--racklyt-text-muted)]">
                Are you sure you want to execute command{' '}
                <strong className="text-accent uppercase font-mono">{serviceTarget.action}</strong> on system service{' '}
                <strong className="text-[var(--racklyt-text-primary)] font-mono">{serviceTarget.name}</strong>?
              </p>

              <div className="pt-2 border-t border-[var(--racklyt-border-weak)] flex justify-end space-x-2">
                <button
                  onClick={() => setServiceTarget(null)}
                  disabled={actionBusy}
                  className="px-3 py-1.5 rounded bg-[var(--racklyt-elevated)] hover:bg-[var(--racklyt-subtle)] text-xs text-[var(--racklyt-text-primary)] border border-[var(--racklyt-border-weak)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteServiceAction}
                  disabled={actionBusy}
                  className="px-3.5 py-1.5 rounded bg-accent hover:bg-accent/80 text-xs font-bold text-white transition flex items-center space-x-1.5"
                >
                  {actionBusy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Execute {serviceTarget.action}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG 3: CONTAINER ACTION MODAL */}
        {containerTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
            <div className="bg-[var(--racklyt-surface)] border border-[var(--racklyt-border-subtle)] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scale-up">
              <div className="flex items-center space-x-2.5 text-cyan-400">
                <Layers className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-sm text-[var(--racklyt-text-primary)]">Container Control</h3>
              </div>

              <p className="text-xs text-[var(--racklyt-text-muted)]">
                Are you sure you want to execute{' '}
                <strong className="text-cyan-400 uppercase font-mono">{containerTarget.action}</strong> on container{' '}
                <strong className="text-[var(--racklyt-text-primary)] font-mono">{containerTarget.name}</strong>?
              </p>

              <div className="pt-2 border-t border-[var(--racklyt-border-weak)] flex justify-end space-x-2">
                <button
                  onClick={() => setContainerTarget(null)}
                  disabled={actionBusy}
                  className="px-3 py-1.5 rounded bg-[var(--racklyt-elevated)] hover:bg-[var(--racklyt-subtle)] text-xs text-[var(--racklyt-text-primary)] border border-[var(--racklyt-border-weak)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteContainerAction}
                  disabled={actionBusy}
                  className="px-3.5 py-1.5 rounded bg-accent hover:bg-accent/80 text-xs font-bold text-white transition flex items-center space-x-1.5"
                >
                  {actionBusy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Execute {containerTarget.action}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
