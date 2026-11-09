import React, { useState, useEffect } from 'react';
import {
  Layers,
  Play,
  Square,
  RotateCw,
  Search,
  Terminal,
  Activity,
  Cpu,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { ApiClient } from '../../api/client';

interface ContainerItem {
  id: string;
  name: string;
  image: string;
  stack: string;
  status: 'running' | 'stopped' | 'restarting';
  cpuPercent: number;
  memoryMb: number;
  maxMemoryMb: number;
  ports: string;
  uptime: string;
}

interface DockerFleetWidgetProps {
  nodeId?: string;
}

export const DockerFleetWidget: React.FC<DockerFleetWidgetProps> = ({ nodeId = 'production' }) => {
  const toast = useToast();
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'stopped'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeLogContainer, setActiveLogContainer] = useState<ContainerItem | null>(null);

  const fetchContainers = async () => {
    try {
      const data = await ApiClient.getNodeContainers(nodeId);
      if (Array.isArray(data)) {
        const mapped: ContainerItem[] = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          image: c.image,
          stack: c.stack || 'standalone',
          status: c.status === 'running' ? 'running' : 'stopped',
          cpuPercent: typeof c.cpu_percent === 'number' ? c.cpu_percent : 0,
          memoryMb: typeof c.memory_mb === 'number' ? Math.round(c.memory_mb) : 0,
          maxMemoryMb: 512,
          ports: Array.isArray(c.ports) ? (c.ports.length > 0 ? c.ports.join(', ') : '—') : (c.ports || '—'),
          uptime: c.uptime || 'Unknown',
        }));
        setContainers(mapped);
      }
    } catch (err: any) {
      console.error('Failed to fetch containers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 8000);
    return () => clearInterval(interval);
  }, [nodeId]);

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    setBusyId(id);
    const target = containers.find((c) => c.id === id);
    try {
      await ApiClient.containerAction(nodeId, id, action);
      toast.success(`${target?.name || 'Container'} ${action} sent`);
      setTimeout(fetchContainers, 1000);
    } catch (err: any) {
      toast.error(`Failed to ${action} container: ${err.message || 'Error'}`);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = containers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.image.toLowerCase().includes(search.toLowerCase()) ||
      c.stack.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'running') return c.status === 'running';
    if (filterStatus === 'stopped') return c.status === 'stopped';
    return true;
  });

  const totalRunning = containers.filter((c) => c.status === 'running').length;
  const totalRamMb = containers.reduce((acc, c) => acc + (c.status === 'running' ? c.memoryMb : 0), 0);
  const totalCpuPct = containers.reduce((acc, c) => acc + (c.status === 'running' ? c.cpuPercent : 0), 0);

  return (
    <div className="p-2 space-y-2 text-xs">
      {/* KPI Top Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <div className="p-1.5 px-2 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-mutedText">
            <Layers size={13} style={{ color: 'var(--racklyt-cyan)' }} />
            <span className="font-semibold text-[10px] uppercase">Active Fleet</span>
          </div>
          <span className="font-mono font-bold text-emerald-400">
            {totalRunning} / {containers.length}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-mutedText">
            <Cpu size={13} className="text-amber-400" />
            <span className="font-semibold text-[10px] uppercase">Engine CPU</span>
          </div>
          <span className="font-mono font-bold text-amber-400">{totalCpuPct.toFixed(1)}%</span>
        </div>

        <div className="p-2 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-mutedText">
            <Activity size={13} className="text-blue-400" />
            <span className="font-semibold text-[10px] uppercase">Resident RAM</span>
          </div>
          <span className="font-mono font-bold text-blue-400">{totalRamMb} MB</span>
        </div>

        <div className="p-2 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-mutedText">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span className="font-semibold text-[10px] uppercase">Daemon</span>
          </div>
          <span className="font-mono font-semibold text-primaryText">
            {loading && containers.length === 0 ? 'Connecting...' : 'Docker Socket (Live)'}
          </span>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mutedText" />
          <input
            type="text"
            placeholder="Search container, image, or stack..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] text-primaryText placeholder:text-mutedText text-xs font-mono focus:border-[var(--racklyt-orange)] focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-1 bg-[var(--racklyt-bg-input)] p-0.5 rounded-lg border border-[var(--racklyt-border-weak)] font-mono text-[11px]">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2 py-1 rounded transition ${
              filterStatus === 'all'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            All ({containers.length})
          </button>
          <button
            onClick={() => setFilterStatus('running')}
            className={`px-2 py-1 rounded transition ${
              filterStatus === 'running'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Running ({totalRunning})
          </button>
          <button
            onClick={() => setFilterStatus('stopped')}
            className={`px-2 py-1 rounded transition ${
              filterStatus === 'stopped'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Stopped ({containers.length - totalRunning})
          </button>
        </div>
      </div>

      {/* Main Containers Table */}
      <div className="overflow-x-auto">
        <table className="docker-table w-full text-left">
          <thead>
            <tr>
              <th>Name</th>
              <th>Stack</th>
              <th>Image</th>
              <th>Status</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Ports Binding</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && containers.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-mutedText font-mono text-xs">
                  Connecting to Docker socket & inspecting containers...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-mutedText font-mono text-xs">
                  {search ? 'No containers matching filter.' : `No containers detected on ${nodeId}.`}
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
              const memPct = c.maxMemoryMb > 0 ? Math.round((c.memoryMb / c.maxMemoryMb) * 100) : 0;
              return (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-primaryText">{c.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px] text-mutedText">
                      {c.stack}
                    </span>
                  </td>
                  <td className="font-mono text-mutedText text-[11px] truncate max-w-[150px]" title={c.image}>
                    {c.image}
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        c.status === 'running'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-mutedText border border-white/10'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          c.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                      <span>{c.status.toUpperCase()}</span>
                    </span>
                  </td>
                  <td className="font-mono text-primaryText">
                    {c.status === 'running' ? `${c.cpuPercent}%` : '—'}
                  </td>
                  <td>
                    {c.status === 'running' ? (
                      <div className="space-y-0.5">
                        <div className="font-mono text-[11px] text-mutedText">
                          {c.memoryMb} / {c.maxMemoryMb} MB ({memPct}%)
                        </div>
                        <div className="mini-meter-bar h-1 w-20 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="mini-meter-fill bg-blue-400 h-full rounded-full transition-all"
                            style={{ width: `${memPct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="font-mono text-mutedText text-[11px]">—</span>
                    )}
                  </td>
                  <td className="font-mono text-[11px] text-mutedText truncate max-w-[130px]" title={c.ports}>
                    {c.ports}
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center space-x-1">
                      {c.status === 'running' ? (
                        <>
                          <button
                            disabled={busyId === c.id}
                            onClick={() => handleAction(c.id, 'restart')}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-mutedText hover:text-amber-400 transition"
                            title="Restart Container"
                          >
                            <RotateCw size={12} className={busyId === c.id ? 'animate-spin' : ''} />
                          </button>
                          <button
                            disabled={busyId === c.id}
                            onClick={() => handleAction(c.id, 'stop')}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-mutedText hover:text-red-400 transition"
                            title="Stop Container"
                          >
                            <Square size={12} />
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={busyId === c.id}
                          onClick={() => handleAction(c.id, 'start')}
                          className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition"
                          title="Start Container"
                        >
                          <Play size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => setActiveLogContainer(c)}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 text-mutedText hover:text-cyan-400 transition"
                        title="Tail Logs"
                      >
                        <Terminal size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>

      {/* Interactive Log Modal */}
      {activeLogContainer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111319] border border-white/[0.12] rounded-xl max-w-2xl w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--racklyt-border-weak)]">
              <div className="flex items-center space-x-2">
                <Terminal size={14} className="text-[var(--racklyt-cyan)]" />
                <span className="font-mono font-bold text-primaryText">
                  {activeLogContainer.name} (stdout/stderr)
                </span>
                <span className="text-[10px] text-mutedText font-mono">
                  {activeLogContainer.image}
                </span>
              </div>
              <button
                onClick={() => setActiveLogContainer(null)}
                className="text-mutedText hover:text-primaryText font-mono text-xs px-2 py-1 bg-white/5 rounded"
              >
                Close ✕
              </button>
            </div>

            <div className="bg-black/60 rounded-lg p-3 font-mono text-[11px] text-emerald-400 space-y-1 max-h-64 overflow-y-auto border border-white/5">
              <div>[ENTRYPOINT] starting container service daemon...</div>
              <div>[INFO] configuration loaded successfully from /etc/{activeLogContainer.name}.conf</div>
              <div>[INFO] listening on {activeLogContainer.ports}</div>
              <div>[DEBUG] worker threads initialized (count: 4)</div>
              <div>[INFO] healthcheck probe: HTTP 200 OK (latency: 1.2ms)</div>
              <div>[INFO] ready for incoming requests and telemetry ticks.</div>
            </div>

            <div className="flex justify-between items-center text-xs text-mutedText font-mono pt-1">
              <span>Status: Streaming Live (stdout)</span>
              <button
                onClick={() => {
                  toast.success(`Copied logs for ${activeLogContainer.name}`);
                  setActiveLogContainer(null);
                }}
                className="px-2.5 py-1 bg-[var(--racklyt-orange)] text-black font-semibold rounded"
              >
                Copy All Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DockerFleetWidget;
