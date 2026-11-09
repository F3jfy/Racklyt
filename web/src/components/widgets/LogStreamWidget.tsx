import React, { useState, useEffect } from 'react';
import { Terminal, Pause, Play, Trash2, Copy, Search, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { ApiClient } from '../../api/client';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  service: string;
  message: string;
}

export const LogStreamWidget: React.FC = () => {
  const toast = useToast();
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<'all' | 'warn' | 'error'>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'l1',
      timestamp: '19:22:14',
      level: 'info',
      service: 'racklyt-hub',
      message: 'Node heartbeat accepted from homelab-node-01 (192.168.1.100)',
    },
    {
      id: 'l2',
      timestamp: '19:21:58',
      level: 'info',
      service: 'systemd',
      message: 'Started Cloudflare Tunnel Daemon (cloudflared.service).',
    },
    {
      id: 'l3',
      timestamp: '19:21:40',
      level: 'warn',
      service: 'dockerd',
      message: 'Container traefik-edge-proxy bridge port 80 proxy active.',
    },
    {
      id: 'l4',
      timestamp: '19:21:12',
      level: 'info',
      service: 'kernel',
      message: 'bcm2835-cpufreq: ARM clock frequency boosted to 1800000 kHz.',
    },
  ]);

  // Query real journal logs from Hub
  useEffect(() => {
    if (isPaused) return;
    const fetchJournal = async () => {
      try {
        const data = await ApiClient.getNodeJournal('default', 30);
        if (data?.lines && data.lines.length > 0) {
          const mapped: LogEntry[] = data.lines.map((line, idx) => {
            const isWarn = line.toLowerCase().includes('warn');
            const isErr = line.toLowerCase().includes('fail') || line.toLowerCase().includes('critical') || line.toLowerCase().includes('error');
            const parts = line.split(' ');
            const time = parts[2] || new Date().toTimeString().split(' ')[0];
            const service = parts[3]?.replace(':', '') || 'kernel';
            return {
              id: `j_${idx}`,
              timestamp: time,
              level: isErr ? 'error' : isWarn ? 'warn' : 'info',
              service,
              message: line,
            };
          });
          setLogs(mapped.reverse());
        }
      } catch {}
    };

    fetchJournal();
    const interval = setInterval(fetchJournal, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.service.toLowerCase().includes(search.toLowerCase()) ||
      l.message.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'error') return l.level === 'error';
    if (filter === 'warn') return l.level === 'warn' || l.level === 'error';
    return true;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.service}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Journal logs copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (lvl: LogEntry['level']) => {
    switch (lvl) {
      case 'error':
        return <span className="text-red-400 font-bold font-mono">[ERR]</span>;
      case 'warn':
        return <span className="text-amber-400 font-bold font-mono">[WRN]</span>;
      default:
        return <span className="text-emerald-400 font-bold font-mono">[INF]</span>;
    }
  };

  return (
    <div className="p-2 space-y-1.5 text-xs font-mono">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 border-b border-[var(--racklyt-border-weak)] font-sans gap-1.5">
        <div className="flex items-center space-x-1.5 text-mutedText">
          <Terminal size={13} style={{ color: 'var(--racklyt-cyan)' }} />
          <span className="font-semibold text-xs uppercase tracking-wider text-primaryText font-sans">
            Realtime System & Kernel Journal
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5">
          {/* Search */}
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-mutedText" />
            <input
              type="text"
              placeholder="Search journal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-6 pr-2 py-0.5 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] text-primaryText text-[11px] font-mono focus:outline-none w-28 sm:w-36"
            />
          </div>

          {/* Level Filter */}
          <button
            onClick={() => setFilter(filter === 'all' ? 'warn' : 'all')}
            className={`px-2 py-0.5 rounded text-[10.5px] font-mono border transition ${
              filter !== 'all'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-[var(--racklyt-bg-input)] text-mutedText border-[var(--racklyt-border-weak)]'
            }`}
          >
            {filter === 'all' ? 'All' : 'Warn/Err'}
          </button>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] text-mutedText hover:text-primaryText transition"
            title={isPaused ? 'Resume stream' : 'Pause stream'}
          >
            {isPaused ? <Play size={12} className="text-emerald-400" /> : <Pause size={12} />}
          </button>

          {/* Copy */}
          <button
            onClick={handleCopyLogs}
            className="p-1 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] text-mutedText hover:text-primaryText transition"
            title="Copy logs"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>

          {/* Clear */}
          <button
            onClick={() => {
              setLogs([]);
              toast.info('Cleared journal display');
            }}
            className="p-1 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] text-mutedText hover:text-red-400 transition"
            title="Clear logs"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="bg-[#0b0c10] border border-white/5 rounded-lg p-2.5 h-44 overflow-y-auto space-y-1.5 scrollbar-thin">
        {filteredLogs.length === 0 ? (
          <div className="text-mutedText text-center py-8 text-xs">No matching journal entries.</div>
        ) : (
          filteredLogs.map((l) => (
            <div key={l.id} className="flex items-start space-x-2 leading-relaxed hover:bg-white/[0.03] px-1 rounded transition">
              <span className="text-mutedText opacity-60 flex-shrink-0 text-[10.5px]">{l.timestamp}</span>
              <span className="flex-shrink-0 text-[10.5px]">{getLevelBadge(l.level)}</span>
              <span className="text-[var(--racklyt-cyan)] flex-shrink-0 font-semibold text-[10.5px]">
                [{l.service}]
              </span>
              <span className="text-primaryText text-[11px] break-all">{l.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogStreamWidget;
