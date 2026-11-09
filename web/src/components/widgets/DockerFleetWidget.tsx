import React, { useState } from 'react';
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

export const DockerFleetWidget: React.FC = () => {
  const toast = useToast();
  const [containers, setContainers] = useState<ContainerItem[]>([
    {
      id: 'c1',
      name: 'traefik-edge-proxy',
      image: 'traefik:v3.1.2',
      stack: 'networking',
      status: 'running',
      cpuPercent: 1.8,
      memoryMb: 84,
      maxMemoryMb: 512,
      ports: '80:80, 443:443',
      uptime: '14d 6h',
    },
    {
      id: 'c2',
      name: 'pihole-dns-unbound',
      image: 'pihole/pihole:latest',
      stack: 'dns-security',
      status: 'running',
      cpuPercent: 1.2,
      memoryMb: 112,
      maxMemoryMb: 512,
      ports: '53:53/udp, 8053:80',
      uptime: '28d 11h',
    },
    {
      id: 'c3',
      name: 'vaultwarden-server',
      image: 'vaultwarden/server:alpine',
      stack: 'vault',
      status: 'running',
      cpuPercent: 0.9,
      memoryMb: 62,
      maxMemoryMb: 256,
      ports: '8880:80',
      uptime: '42d 18h',
    },
    {
      id: 'c4',
      name: 'home-assistant-core',
      image: 'ghcr.io/home-assistant:stable',
      stack: 'home-automation',
      status: 'running',
      cpuPercent: 4.5,
      memoryMb: 320,
      maxMemoryMb: 1024,
      ports: '8123:8123',
      uptime: '9d 02h',
    },
    {
      id: 'c5',
      name: 'redis-cache-backend',
      image: 'redis:7.2-alpine',
      stack: 'infra',
      status: 'running',
      cpuPercent: 0.5,
      memoryMb: 24,
      maxMemoryMb: 256,
      ports: '6379:6379',
      uptime: '30d 14h',
    },
    {
      id: 'c6',
      name: 'watchtower-auto-updater',
      image: 'containrrr/watchtower:latest',
      stack: 'ops',
      status: 'stopped',
      cpuPercent: 0.0,
      memoryMb: 0,
      maxMemoryMb: 128,
      ports: 'Cron Triggered',
      uptime: 'Exited (0)',
    },
    {
      id: 'c7',
      name: 'grafana-observability',
      image: 'grafana/grafana-oss:10.4',
      stack: 'monitoring',
      status: 'running',
      cpuPercent: 2.1,
      memoryMb: 148,
      maxMemoryMb: 512,
      ports: '3000:3000',
      uptime: '12d 08h',
    },
  ]);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'stopped'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeLogContainer, setActiveLogContainer] = useState<ContainerItem | null>(null);

  const handleAction = (id: string, action: 'start' | 'stop' | 'restart') => {
    setBusyId(id);
    const target = containers.find((c) => c.id === id);
    setTimeout(() => {
      setContainers((prev) =>
        prev.map((c) => {
          if (c.id === id) {
            const isRun = action === 'stop' ? 'stopped' : 'running';
            return {
              ...c,
              status: isRun,
              uptime: isRun === 'running' ? 'Just restarted' : 'Exited (0)',
              cpuPercent: isRun === 'running' ? 1.4 : 0,
              memoryMb: isRun === 'running' ? (c.memoryMb || 45) : 0,
            };
          }
          return c;
        })
      );
      setBusyId(null);
      toast.success(`${target?.name || 'Container'} ${action} completed`);
    }, 550);
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
          <span className="font-mono font-semibold text-primaryText">v26.1.4 (rootless)</span>
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
            {filtered.map((c) => {
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
            })}
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
