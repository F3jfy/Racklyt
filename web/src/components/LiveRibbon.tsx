import React from 'react';
import { Cpu, Activity, Thermometer, HardDrive, Network, Server, Zap } from 'lucide-react';
import { Node } from '../types';

interface LiveRibbonProps {
  nodes: Node[];
  avgCpu: number;
  totalRamUsedGb: number;
  totalRamMaxGb: number;
  avgTempCelsius?: number;
  netRxMb: number;
}

export const LiveRibbon: React.FC<LiveRibbonProps> = ({
  nodes,
  avgCpu,
  totalRamUsedGb,
  totalRamMaxGb,
  avgTempCelsius,
  netRxMb,
}) => {
  const onlineCount = nodes.filter((n) => n.status === 'online').length;
  const totalCount = nodes.length;
  const ramPercent = totalRamMaxGb > 0 ? Math.min(100, Math.round((totalRamUsedGb / totalRamMaxGb) * 100)) : 0;

  return (
    <div className="racklyt-live-ribbon">
      {/* Node Status Chip */}
      <div className="telemetry-chip group">
        <span className="relative flex h-2 w-2 items-center justify-center">
          {onlineCount > 0 ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </>
          ) : (
            <span className="inline-flex rounded-full h-1.5 w-1.5 bg-zinc-600" />
          )}
        </span>
        <span className="telemetry-chip-icon text-emerald-400">
          <Server size={12} />
        </span>
        <span className="telemetry-chip-label">FLEET ONLINE:</span>
        <span className="telemetry-chip-val text-emerald-400 font-mono">
          {onlineCount}/{totalCount}
        </span>
      </div>

      {/* CPU Load Chip with Mini Bar */}
      <div className="telemetry-chip">
        <span className="telemetry-chip-icon text-[var(--racklyt-orange)]">
          <Cpu size={12} />
        </span>
        <span className="telemetry-chip-label">CPU AVG:</span>
        <span className="telemetry-chip-val">{avgCpu.toFixed(1)}%</span>
        <div className="w-10 h-1.5 bg-white/5 rounded-full overflow-hidden ml-1 hidden sm:block">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, avgCpu)}%`,
              backgroundColor: avgCpu > 80 ? 'var(--racklyt-red)' : avgCpu > 60 ? 'var(--racklyt-yellow)' : 'var(--racklyt-orange)',
            }}
          />
        </div>
      </div>

      {/* Memory Chip with Mini Bar */}
      <div className="telemetry-chip">
        <span className="telemetry-chip-icon text-blue-400">
          <Activity size={12} />
        </span>
        <span className="telemetry-chip-label">RAM USED:</span>
        <span className="telemetry-chip-val">
          {totalRamUsedGb.toFixed(1)} / {totalRamMaxGb.toFixed(1)} GB
        </span>
        <div className="w-10 h-1.5 bg-white/5 rounded-full overflow-hidden ml-1 hidden sm:block">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${ramPercent}%` }}
          />
        </div>
      </div>

      {/* Temperature Chip */}
      <div className="telemetry-chip">
        <span className="telemetry-chip-icon text-rose-400">
          <Thermometer size={12} />
        </span>
        <span className="telemetry-chip-label">TEMP AVG:</span>
        <span
          className="telemetry-chip-val"
          style={{
            color:
              avgTempCelsius && avgTempCelsius > 65
                ? 'var(--racklyt-red)'
                : avgTempCelsius && avgTempCelsius > 50
                ? 'var(--racklyt-yellow)'
                : 'var(--racklyt-text-primary)',
          }}
        >
          {avgTempCelsius ? `${avgTempCelsius.toFixed(1)}°C` : 'N/A'}
        </span>
      </div>

      {/* Network Throughput Chip */}
      <div className="telemetry-chip">
        <span className="telemetry-chip-icon text-cyan-400">
          <Network size={12} />
        </span>
        <span className="telemetry-chip-label">NET RX:</span>
        <span className="telemetry-chip-val font-mono">{netRxMb.toFixed(1)} MB/s</span>
      </div>

      {/* Storage Health */}
      <div className="telemetry-chip">
        <span className="telemetry-chip-icon text-emerald-400">
          <HardDrive size={12} />
        </span>
        <span className="telemetry-chip-label">STORAGE:</span>
        <span className="telemetry-chip-val text-emerald-400">HEALTHY</span>
      </div>

      {/* Ingress / Hub Heartbeat */}
      <div className="telemetry-chip ml-auto hidden lg:inline-flex opacity-80 hover:opacity-100">
        <span className="telemetry-chip-icon text-amber-400">
          <Zap size={11} />
        </span>
        <span className="telemetry-chip-label">HUB LATENCY:</span>
        <span className="telemetry-chip-val text-emerald-400 font-mono text-[10.5px]">~2ms</span>
      </div>
    </div>
  );
};

export default LiveRibbon;
