import React, { useState, useEffect } from 'react';
import { Search, Copy, Check, Globe, Lock } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { ApiClient } from '../../api/client';

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

interface PortsTableWidgetProps {
  nodeId?: string;
}

export const PortsTableWidget: React.FC<PortsTableWidgetProps> = ({ nodeId = 'production' }) => {
  const toast = useToast();
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tcp' | 'udp' | 'public'>('all');
  const [copiedPort, setCopiedPort] = useState<number | null>(null);

  const getFriendlyServiceName = (port: number, process: string): string => {
    const pLower = (process || '').toLowerCase();
    if (pLower.includes('racklyt-hub')) return 'Racklyt Monitoring Engine';
    if (pLower.includes('vaultwarden')) return 'Vaultwarden Password Vault';
    if (pLower.includes('homestream')) return 'HomeStream Media Service';
    if (pLower.includes('seafile')) return 'Seafile Cloud Storage';
    if (pLower.includes('photo-adamfejfar')) return 'Photography Web Service';
    if (pLower.includes('vision_detailing') || pLower.includes('vision-detailing')) return 'Vision Detailing Web';
    if (pLower.includes('mrozek')) return 'Mrozek Web Portal';
    if (pLower.includes('robo26')) return 'Robo26 Application Engine';
    if (pLower.includes('pidrop')) return 'PiDrop File Transfer';
    if (pLower.includes('adamfejfar-main')) return 'Main Web Gateway';
    if (pLower.includes('sshd') || port === 22) return 'SSH Remote Terminal';
    if (pLower.includes('resolved') || port === 53) return 'Systemd DNS Resolver';
    if (pLower.includes('cloudflared') || port === 20241) return 'Cloudflare Tunnel Daemon';
    if (port === 80) return 'HTTP Web Server';
    if (port === 443) return 'HTTPS Web Server';
    if (port === 3500) return 'Internal API Service';
    return process || `Network Port ${port}`;
  };

  const fetchSockets = async () => {
    try {
      const data = await ApiClient.getNodeSockets(nodeId);
      if (Array.isArray(data)) {
        const mapped: PortEntry[] = data.map((s: any) => {
          const isExposed = s.local_address === '0.0.0.0' || s.local_address === '::';
          return {
            port: s.port,
            proto: ((s.proto || 'TCP').toUpperCase()) as 'TCP' | 'UDP',
            service: getFriendlyServiceName(s.port, s.process),
            binding: s.local_address || '0.0.0.0',
            process: s.process || 'unknown',
            pid: s.pid || 0,
            isExposed,
            state: 'LISTEN',
          };
        });
        mapped.sort((a, b) => a.port - b.port);
        setPorts(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch sockets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSockets();
    const interval = setInterval(fetchSockets, 10000);
    return () => clearInterval(interval);
  }, [nodeId]);

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
            {loading && ports.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-mutedText font-mono text-xs">
                  Scanning network namespaces & open sockets...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-mutedText font-mono text-xs">
                  {search ? 'No sockets matching filter.' : `No open listening sockets detected on ${nodeId}.`}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={`${p.proto}-${p.port}-${p.binding}`}>
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
                    {p.pid > 0 && <span className="text-[10px] opacity-60">({p.pid})</span>}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PortsTableWidget;
