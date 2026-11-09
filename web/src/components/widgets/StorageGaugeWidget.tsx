import React, { useState } from 'react';
import { HardDrive, Activity, CheckCircle2 } from 'lucide-react';

interface MountInfo {
  mount: string;
  device: string;
  fsType: 'zfs' | 'ext4' | 'btrfs' | 'vfat';
  usedGb: number;
  totalGb: number;
  readSpeedMb: number;
  writeSpeedMb: number;
  health: 'HEALTHY' | 'DEGRADED';
  category: 'system' | 'pool' | 'boot';
}

export const StorageGaugeWidget: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'pool' | 'system'>('all');

  const mounts: MountInfo[] = [
    {
      mount: '/',
      device: '/dev/nvme0n1p2',
      fsType: 'ext4',
      usedGb: 48,
      totalGb: 256,
      readSpeedMb: 14.2,
      writeSpeedMb: 3.8,
      health: 'HEALTHY',
      category: 'system',
    },
    {
      mount: '/var/lib/docker',
      device: '/dev/nvme0n1p3',
      fsType: 'ext4',
      usedGb: 112,
      totalGb: 512,
      readSpeedMb: 8.6,
      writeSpeedMb: 12.4,
      health: 'HEALTHY',
      category: 'system',
    },
    {
      mount: '/mnt/storage-tank',
      device: 'zfs:tank-pool',
      fsType: 'zfs',
      usedGb: 1840,
      totalGb: 3840,
      readSpeedMb: 42.1,
      writeSpeedMb: 18.5,
      health: 'HEALTHY',
      category: 'pool',
    },
    {
      mount: '/mnt/fast-nvme',
      device: 'zfs:nvme-mirror',
      fsType: 'zfs',
      usedGb: 310,
      totalGb: 960,
      readSpeedMb: 110.5,
      writeSpeedMb: 64.0,
      health: 'HEALTHY',
      category: 'pool',
    },
    {
      mount: '/boot/efi',
      device: '/dev/nvme0n1p1',
      fsType: 'vfat',
      usedGb: 0.1,
      totalGb: 1.0,
      readSpeedMb: 0.0,
      writeSpeedMb: 0.0,
      health: 'HEALTHY',
      category: 'boot',
    },
  ];

  const filtered = mounts.filter((m) => {
    if (filter === 'pool') return m.category === 'pool';
    if (filter === 'system') return m.category === 'system' || m.category === 'boot';
    return true;
  });

  const totalUsedGb = mounts.reduce((acc, m) => acc + m.usedGb, 0);
  const totalCapGb = mounts.reduce((acc, m) => acc + m.totalGb, 0);
  const totalR = mounts.reduce((acc, m) => acc + m.readSpeedMb, 0);
  const totalW = mounts.reduce((acc, m) => acc + m.writeSpeedMb, 0);

  return (
    <div className="flex flex-col h-full p-2 space-y-2 text-xs">
      {/* Top Header with Total Capacity & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1.5 border-b border-[var(--racklyt-border-weak)] gap-1.5">
        <div className="flex items-center space-x-1.5 text-mutedText">
          <HardDrive size={13} style={{ color: 'var(--racklyt-orange)' }} />
          <span className="font-semibold text-xs uppercase tracking-wider text-primaryText">
            Storage Pools & Filesystems
          </span>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center space-x-1 bg-[var(--racklyt-bg-input)] p-0.5 rounded-lg border border-[var(--racklyt-border-weak)] font-mono text-[10.5px]">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded transition ${
              filter === 'all'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            All Mounts
          </button>
          <button
            onClick={() => setFilter('pool')}
            className={`px-2 py-0.5 rounded transition ${
              filter === 'pool'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            ZFS Pools
          </button>
          <button
            onClick={() => setFilter('system')}
            className={`px-2 py-0.5 rounded transition ${
              filter === 'system'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            System
          </button>
        </div>
      </div>

      {/* Aggregate IOPS throughput banner */}
      <div className="p-2 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex items-center justify-between font-mono text-[11px]">
        <span className="flex items-center space-x-1 text-mutedText">
          <Activity size={12} className="text-emerald-400" />
          <span>I/O Throughput:</span>
          <strong className="text-emerald-400">R: {totalR.toFixed(1)} MB/s</strong>
          <span>|</span>
          <strong className="text-blue-400">W: {totalW.toFixed(1)} MB/s</strong>
        </span>
        <span className="text-mutedText">
          Fleet Storage: {(totalUsedGb / 1000).toFixed(1)} / {(totalCapGb / 1000).toFixed(1)} TB
        </span>
      </div>

      {/* Mounts List */}
      <div className="space-y-2 overflow-y-auto pr-0.5 flex-1">
        {filtered.map((m) => {
          const percent = Math.round((m.usedGb / m.totalGb) * 100);
          const freeGb = (m.totalGb - m.usedGb).toFixed(m.totalGb > 10 ? 0 : 1);
          const isHigh = percent > 85;
          const isMed = percent > 70;
          const barColor = isHigh ? 'bg-red-500' : isMed ? 'bg-amber-400' : 'bg-emerald-400';

          return (
            <div
              key={m.mount}
              className="p-2.5 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] space-y-1.5 transition hover:border-[var(--racklyt-border-medium)]"
            >
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-primaryText">{m.mount}</span>
                  <span className="px-1.5 py-0.2 rounded font-mono text-[9.5px] uppercase bg-white/5 border border-white/10 text-mutedText">
                    {m.fsType}
                  </span>
                  <span className="font-mono text-mutedText text-[10.5px]">({m.device})</span>
                </div>
                <div className="flex items-center space-x-2 font-mono text-[11px]">
                  <span className="text-mutedText">{freeGb} GB Free</span>
                  <span className="font-bold text-primaryText">{percent}%</span>
                </div>
              </div>

              {/* Meter bar */}
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-300`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-mutedText pt-0.5">
                <span>
                  {m.usedGb >= 1000 ? `${(m.usedGb / 1000).toFixed(2)} TB` : `${m.usedGb} GB`} used of{' '}
                  {m.totalGb >= 1000 ? `${(m.totalGb / 1000).toFixed(2)} TB` : `${m.totalGb} GB`}
                </span>
                <span className="flex items-center space-x-1 text-emerald-400">
                  <CheckCircle2 size={10} />
                  <span>{m.health}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StorageGaugeWidget;
