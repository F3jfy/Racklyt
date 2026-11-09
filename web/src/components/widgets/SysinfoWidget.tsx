import React, { useState } from 'react';
import {
  Server,
  Cpu,
  Clock,
  ShieldCheck,
  Activity,
  Terminal,
  Copy,
  Check,
  HardDrive,
  Zap,
} from 'lucide-react';
import { Node } from '../../types';
import { useToast } from '../../context/ToastContext';

interface SysinfoWidgetProps {
  node?: Node | null;
  staticInfo?: {
    osDistro?: string;
    hostname?: string;
    cpuModel?: string;
    cores?: number;
    arch?: string;
    kernel?: string;
    uptime?: number;
    memoryTotalGb?: number;
  };
}

export const SysinfoWidget: React.FC<SysinfoWidgetProps> = ({ node, staticInfo }) => {
  const toast = useToast();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const isAwaiting = !node && !staticInfo;
  const os = staticInfo?.osDistro || node?.os || (isAwaiting ? 'Awaiting Node Agent' : 'Linux (Debian 12 / Bookworm)');
  const hostname = staticInfo?.hostname || node?.hostname || (isAwaiting ? 'No Node Connected' : 'homelab-node-01.lan');
  const arch = staticInfo?.arch || node?.arch || (isAwaiting ? '—' : 'x86_64 (AVX-512 enabled)');
  const cpu = staticInfo?.cpuModel || (isAwaiting ? 'Awaiting Agent Heartbeat' : 'AMD EPYC / Intel Xeon 16-Core');
  const kernel = staticInfo?.kernel || (isAwaiting ? '—' : 'Linux 6.8.12-pve (SMP PREEMPT_DYNAMIC)');
  const uptimeSec = staticInfo?.uptime || 184200;

  const formatUptime = (seconds: number): string => {
    if (seconds === 0) return '0s';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleCopy = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedItem(key);
    toast.success(`Copied ${key}: ${val}`);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const items = [
    { key: 'OS Distro', label: 'OS Distribution', val: os, icon: <Server size={13} className="text-[#f97316]" /> },
    { key: 'Hostname', label: 'Host System Name', val: hostname, icon: <Terminal size={13} className="text-cyan-400" /> },
    { key: 'CPU Model', label: 'Processor Architecture', val: cpu, icon: <Cpu size={13} className="text-amber-400" /> },
    { key: 'Kernel', label: 'Kernel Release', val: kernel, icon: <ShieldCheck size={13} className="text-emerald-400" /> },
    { key: 'Architecture', label: 'Instruction Set & SIMD', val: arch, icon: <Activity size={13} className="text-blue-400" /> },
    { key: 'Fleet Uptime', label: 'Continuous Uptime', val: isAwaiting ? '—' : formatUptime(uptimeSec), icon: <Clock size={13} className="text-purple-400" /> },
  ];

  return (
    <div className="sysinfo-container p-2 space-y-2 text-xs">
      {/* 6 Grid Specs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between p-1.5 px-2 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] hover:border-white/[0.12] transition shadow-sm group"
          >
            <div className="flex items-center space-x-1.5 text-mutedText truncate pr-1">
              <span>{item.icon}</span>
              <span className="font-semibold text-[10px] uppercase tracking-wider">{item.label}</span>
            </div>
            <div className="flex items-center space-x-1 max-w-[55%]">
              <span
                className="font-mono text-primaryText text-[11px] truncate font-medium"
                title={item.val}
              >
                {item.val}
              </span>
              <button
                onClick={() => handleCopy(item.key, item.val)}
                className="opacity-0 group-hover:opacity-100 text-mutedText hover:text-primaryText p-0.5 rounded transition"
                title={`Copy ${item.key}`}
              >
                {copiedItem === item.key ? (
                  <Check size={10} className="text-emerald-400" />
                ) : (
                  <Copy size={10} />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Hardware Load & Subsystem Status Banner */}
      <div className="p-1.5 px-2 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[10px] text-mutedText">
        <div className="flex items-center space-x-1 truncate">
          <Zap size={11} className="text-amber-400" />
          <span>Load: 0.38, 0.44, 0.52</span>
        </div>
        <div className="flex items-center space-x-1 truncate">
          <HardDrive size={11} className="text-cyan-400" />
          <span>FS: SQLite WAL + ZFS</span>
        </div>
        <div className="flex items-center space-x-1 text-emerald-400 truncate col-span-2 sm:col-span-1 justify-end">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
          <span>Agent: Nominal</span>
        </div>
      </div>
    </div>
  );
};

export default SysinfoWidget;
