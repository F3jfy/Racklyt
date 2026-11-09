import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';

interface CpuBreakdownWidgetProps {
  cores?: number[];
  overall?: number;
}

export const CpuBreakdownWidget: React.FC<CpuBreakdownWidgetProps> = ({
  cores: initialCores = [18.4, 28.5, 12.8, 22.4, 38.1, 14.4, 25.0, 19.6],
}) => {
  const [cores, setCores] = useState<number[]>(initialCores);

  // Core frequency estimates
  const coreFreqs = [3.8, 4.2, 3.6, 4.1, 4.3, 3.7, 4.0, 3.9];

  useEffect(() => {
    const timer = setInterval(() => {
      setCores((prev) =>
        prev.map((load) => {
          const delta = (Math.random() - 0.5) * 8;
          return Math.max(5, Math.min(95, Math.round((load + delta) * 10) / 10));
        })
      );
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const getCoreColor = (val: number) => {
    if (val >= 85) return 'var(--racklyt-red)';
    if (val >= 70) return 'var(--racklyt-yellow)';
    return 'var(--racklyt-orange)';
  };

  const avgLoad = (cores.reduce((a, b) => a + b, 0) / cores.length).toFixed(1);

  return (
    <div className="p-2 space-y-2 text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--racklyt-border-weak)]">
        <div className="flex items-center space-x-1.5 text-mutedText">
          <Cpu size={13} style={{ color: 'var(--racklyt-orange)' }} />
          <span className="font-semibold text-xs uppercase tracking-wider text-primaryText">
            Physical Multi-Core Distribution
          </span>
        </div>
        <div className="font-mono text-xs font-bold text-primaryText flex items-center space-x-1.5">
          <span className="text-mutedText">Cluster Avg:</span>
          <span style={{ color: getCoreColor(Number(avgLoad)) }}>{avgLoad}%</span>
        </div>
      </div>

      {/* Grid of cores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {cores.map((load, idx) => {
          const color = getCoreColor(load);
          const freq = coreFreqs[idx] || 3.8;
          return (
            <div
              key={idx}
              className="p-1.5 px-2 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex flex-col space-y-1 hover:border-[var(--racklyt-border-medium)] transition"
            >
              <div className="flex justify-between items-center text-[10.5px] font-mono">
                <span className="text-mutedText font-semibold">CORE #{idx}</span>
                <span className="font-bold" style={{ color }}>
                  {load.toFixed(1)}%
                </span>
              </div>

              {/* Meter bar */}
              <div className="mini-meter-bar h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="mini-meter-fill h-full transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.min(load, 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>

              <div className="flex justify-between items-center text-[9.5px] font-mono text-mutedText pt-0.5">
                <span>{freq} GHz</span>
                <span className={load > 70 ? 'text-amber-400' : 'text-emerald-400'}>
                  {load > 70 ? 'BOOST' : 'OPTIMAL'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="p-2 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex items-center justify-between text-[11px] font-mono text-mutedText">
        <span>Governor: schedutil (Dynamic DVFS)</span>
        <span className="text-emerald-400">P-States: Active (C-States C6 Sleep)</span>
      </div>
    </div>
  );
};

export default CpuBreakdownWidget;
