import React, { useState } from 'react';
import { Search, Copy, Check, Globe, Lock } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface PortEntry {
  port: number;
  proto: 'TCP' | 'UDP';
  service: string;
  binding: string;
  process: string;
  pid: number;
  isExposed: boolean;
  state: 'LISTEN' | 'ESTABLISHED';
}

export const PortsTableWidget: React.FC = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tcp' | 'udp' | 'public'>('all');
  const [copiedPort, setCopiedPort] = useState<number | null>(null);

  const ports: PortEntry[] = [
    { port: 8443, proto: 'TCP', service: 'Racklyt Hub TLS API', binding: '0.0.0.0', process: 'racklyt-hub', pid: 4100, isExposed: true, state: 'LISTEN' },
    { port: 5173, proto: 'TCP', service: 'Vite Web Cockpit', binding: '0.0.0.0', process: 'node (vite)', pid: 4102, isExposed: true, state: 'LISTEN' },
    { port: 22, proto: 'TCP', service: 'SSH Remote Shell', binding: '0.0.0.0', process: 'sshd', pid: 982, isExposed: true, state: 'LISTEN' },
    { port: 8006, proto: 'TCP', service: 'Proxmox VE Cluster API', binding: '192.168.1.20', process: 'pvedaemon', pid: 1420, isExposed: false, state: 'LISTEN' },
    { port: 53, proto: 'UDP', service: 'DNS Resolver & FTL', binding: '127.0.0.1', process: 'pihole-FTL', pid: 1102, isExposed: false, state: 'LISTEN' },
    { port: 51820, proto: 'UDP', service: 'WireGuard VPN Tunnel', binding: '0.0.0.0', process: 'wg-quick', pid: 1650, isExposed: true, state: 'LISTEN' },
    { port: 6379, proto: 'TCP', service: 'Redis Cache Store', binding: '127.0.0.1', process: 'redis-server', pid: 2190, isExposed: false, state: 'LISTEN' },
    { port: 9100, proto: 'TCP', service: 'Node Exporter Metrics', binding: '127.0.0.1', process: 'node_exporter', pid: 2314, isExposed: false, state: 'LISTEN' },
    { port: 2375, proto: 'TCP', service: 'Docker Engine Socket', binding: '127.0.0.1', process: 'dockerd', pid: 1044, isExposed: false, state: 'LISTEN' },
  ];

  const handleCopy = (p: PortEntry) => {
    const text = `${p.binding === '0.0.0.0' ? 'localhost' : p.binding}:${p.port}`;
    navigator.clipboard.writeText(text);
    setCopiedPort(p.port);
    toast.success(`Copied socket ${text} to clipboard`);
    setTimeout(() => setCopiedPort(null), 2000);
  };

  const filtered = ports.filter((p) => {
    const matchesSearch =
      p.port.toString().includes(search) ||
      p.service.toLowerCase().includes(search.toLowerCase()) ||
      p.process.toLowerCase().includes(search.toLowerCase()) ||
      p.binding.includes(search);
    if (!matchesSearch) return false;

    if (filterType === 'tcp') return p.proto === 'TCP';
    if (filterType === 'udp') return p.proto === 'UDP';
    if (filterType === 'public') return p.isExposed;
    return true;
  });

  return (
    <div className="p-2 space-y-2 text-xs">
      {/* Top Bar with Search & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mutedText" />
          <input
            type="text"
            placeholder="Filter port, process, service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] text-primaryText placeholder:text-mutedText text-xs font-mono focus:border-[var(--racklyt-orange)] focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-1 bg-[var(--racklyt-bg-input)] p-0.5 rounded-lg border border-[var(--racklyt-border-weak)] font-mono text-[11px]">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-1 rounded transition ${
              filterType === 'all'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            All ({ports.length})
          </button>
          <button
            onClick={() => setFilterType('tcp')}
            className={`px-2 py-1 rounded transition ${
              filterType === 'tcp'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            TCP
          </button>
          <button
            onClick={() => setFilterType('udp')}
            className={`px-2 py-1 rounded transition ${
              filterType === 'udp'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            UDP
          </button>
          <button
            onClick={() => setFilterType('public')}
            className={`px-2 py-1 rounded transition ${
              filterType === 'public'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Public (0.0.0.0)
          </button>
        </div>
      </div>

      {/* Sockets Table */}
      <div className="overflow-x-auto">
        <table className="docker-table w-full text-left">
          <thead>
            <tr>
              <th>Port</th>
              <th>Proto</th>
              <th>Service Name</th>
              <th>IP Binding</th>
              <th>PID / Process</th>
              <th>Exposure</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={`${p.proto}-${p.port}`}>
                <td className="font-mono font-bold" style={{ color: 'var(--racklyt-cyan)' }}>
                  :{p.port}
                </td>
                <td>
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                      p.proto === 'TCP'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                    }`}
                  >
                    {p.proto}
                  </span>
                </td>
                <td className="font-semibold text-primaryText">{p.service}</td>
                <td className="font-mono text-mutedText text-[11px]">{p.binding}</td>
                <td className="font-mono text-mutedText text-[11px]">
                  <span className="text-primaryText">{p.process}</span>{' '}
                  <span className="text-[10px] opacity-60">({p.pid})</span>
                </td>
                <td>
                  {p.isExposed ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-amber-400">
                      <Globe size={11} />
                      <span>WAN/LAN</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-mutedText">
                      <Lock size={11} />
                      <span>Local Only</span>
                    </span>
                  )}
                </td>
                <td className="text-right">
                  <button
                    onClick={() => handleCopy(p)}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-mutedText hover:text-primaryText transition"
                    title="Copy Address"
                  >
                    {copiedPort === p.port ? (
                      <Check size={12} className="text-emerald-400" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PortsTableWidget;
