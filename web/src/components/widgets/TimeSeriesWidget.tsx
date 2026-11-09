import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../api/client';

interface TimeSeriesProps {
  title?: string;
  nodeId?: string;
}

type MetricMode = 'cpu_mem' | 'network' | 'temp' | 'iops';
type TimeRange = '5m' | '15m' | '1h' | '6h' | '24h';

export const TimeSeriesWidget: React.FC<TimeSeriesProps> = ({ nodeId = 'default' }) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('cpu_mem');
  const [range, setRange] = useState<TimeRange>('15m');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Series 1 & Series 2 datasets
  const [series1, setSeries1] = useState<number[]>([18, 22, 19, 25, 31, 28, 24, 27, 34, 29, 36, 32, 38, 30, 26, 24]);
  const [series2, setSeries2] = useState<number[]>([42, 44, 43, 45, 46, 46, 44, 45, 47, 48, 47, 46, 49, 48, 47, 46]);

  // Query real database metrics from Racklyt Hub
  useEffect(() => {
    let isMounted = true;
    const fetchTelemetry = async () => {
      try {
        const m1 = metricMode === 'cpu_mem' ? 'cpu' : metricMode === 'network' ? 'network' : metricMode === 'temp' ? 'temp' : 'disk';
        const m2 = metricMode === 'cpu_mem' ? 'memory' : metricMode === 'network' ? 'network' : metricMode === 'temp' ? 'temp' : 'cpu';

        const [r1, r2] = await Promise.allSettled([
          ApiClient.getMetricsQuery(nodeId, m1, range),
          ApiClient.getMetricsQuery(nodeId, m2, range),
        ]);

        if (isMounted) {
          if (r1.status === 'fulfilled' && r1.value?.points?.length > 0) {
            setSeries1(r1.value.points.map((p) => Math.round(p.value)));
          }
          if (r2.status === 'fulfilled' && r2.value?.points?.length > 0) {
            setSeries2(r2.value.points.map((p) => Math.round(p.value)));
          }
        }
      } catch {
        // Retain current points if network drops
      }
    };

    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 4000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [nodeId, metricMode, range]);

  const config = {
    cpu_mem: {
      label1: 'CPU Load (%)',
      label2: 'Memory (%)',
      color1: '#f97316',
      color2: '#3b82f6',
      unit: '%',
    },
    network: {
      label1: 'Inbound Rx (MB/s)',
      label2: 'Outbound Tx (MB/s)',
      color1: '#10b981',
      color2: '#38bdf8',
      unit: ' MB/s',
    },
    temp: {
      label1: 'SoC Package (°C)',
      label2: 'NVMe Temp (°C)',
      color1: '#ef4444',
      color2: '#f59e0b',
      unit: '°C',
    },
    iops: {
      label1: 'Read IOPS (k)',
      label2: 'Write IOPS (k)',
      color1: '#a855f7',
      color2: '#06b6d4',
      unit: 'k',
    },
  }[metricMode];

  const width = 600;
  const height = 90;
  const max = 100;

  const getCoordinates = (val: number, idx: number, total: number) => {
    const x = (idx / (total - 1)) * width;
    const y = height - (Math.min(100, val) / max) * height;
    return `${x},${y}`;
  };

  const polyline1 = series1.map((p, i) => getCoordinates(p, i, series1.length)).join(' ');
  const polyline2 = series2.map((p, i) => getCoordinates(p, i, series2.length)).join(' ');

  const current1 = series1[series1.length - 1];
  const min1 = Math.min(...series1);
  const max1 = Math.max(...series1);
  const avg1 = Math.round(series1.reduce((a, b) => a + b, 0) / series1.length);

  const current2 = series2[series2.length - 1];
  const min2 = Math.min(...series2);
  const max2 = Math.max(...series2);
  const avg2 = Math.round(series2.reduce((a, b) => a + b, 0) / series2.length);

  return (
    <div className="flex flex-col h-full justify-between p-2.5 space-y-2">
      {/* Header with Metric & Range Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1.5 border-b border-[var(--racklyt-border-weak)] gap-2">
        {/* Metric Selector */}
        <div className="flex items-center space-x-1 bg-[var(--racklyt-bg-input)] p-0.5 rounded-lg border border-[var(--racklyt-border-weak)] font-mono text-[11px]">
          <button
            onClick={() => setMetricMode('cpu_mem')}
            className={`px-2 py-0.5 rounded transition ${
              metricMode === 'cpu_mem'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            CPU / RAM
          </button>
          <button
            onClick={() => setMetricMode('network')}
            className={`px-2 py-0.5 rounded transition ${
              metricMode === 'network'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Network Rx/Tx
          </button>
          <button
            onClick={() => setMetricMode('temp')}
            className={`px-2 py-0.5 rounded transition ${
              metricMode === 'temp'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Thermals
          </button>
          <button
            onClick={() => setMetricMode('iops')}
            className={`px-2 py-0.5 rounded transition ${
              metricMode === 'iops'
                ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Storage IOPS
          </button>
        </div>

        {/* Range Selector */}
        <div className="flex items-center space-x-1 bg-[var(--racklyt-bg-input)] p-0.5 rounded-lg border border-[var(--racklyt-border-weak)] font-mono text-[10px]">
          {(['5m', '15m', '1h', '6h', '24h'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-1.5 py-0.5 rounded transition ${
                range === r
                  ? 'bg-white/15 text-primaryText font-bold'
                  : 'text-mutedText hover:text-primaryText'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div
        className="w-full relative min-h-[90px] flex items-center justify-center cursor-crosshair"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            const idx = Math.min(
              series1.length - 1,
              Math.max(0, Math.round(relX * (series1.length - 1)))
            );
            setHoverIndex(idx);
          }}
        >
          <defs>
            <linearGradient id="tsGrad1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color1} stopOpacity="0.3" />
              <stop offset="100%" stopColor={config.color1} stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="tsGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color2} stopOpacity="0.2" />
              <stop offset="100%" stopColor={config.color2} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />
          <line x1="0" y1={height * 0.50} x2={width} y2={height * 0.50} stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />
          <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />

          {/* Area 2 */}
          <polygon
            points={`0,${height} ${polyline2} ${width},${height}`}
            fill="url(#tsGrad2)"
          />

          {/* Area 1 */}
          <polygon
            points={`0,${height} ${polyline1} ${width},${height}`}
            fill="url(#tsGrad1)"
          />

          {/* Polyline 2 */}
          <polyline
            fill="none"
            stroke={config.color2}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline2}
          />

          {/* Polyline 1 */}
          <polyline
            fill="none"
            stroke={config.color1}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline1}
          />

          {/* Hover scrubber vertical line */}
          {hoverIndex !== null && (
            <line
              x1={(hoverIndex / (series1.length - 1)) * width}
              y1="0"
              x2={(hoverIndex / (series1.length - 1)) * width}
              y2={height}
              stroke="rgba(255,255,255,0.4)"
              strokeDasharray="2,2"
              strokeWidth="1.5"
            />
          )}
        </svg>

        {/* Hover Readout Tooltip */}
        {hoverIndex !== null && (
          <div
            className="absolute top-2 pointer-events-none px-2.5 py-1.5 rounded-lg bg-black/90 border border-white/20 text-[11px] font-mono shadow-xl z-20 space-y-0.5"
            style={{
              left: `${Math.min(80, Math.max(10, (hoverIndex / (series1.length - 1)) * 100))}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="text-mutedText text-[10px]">T - {(series1.length - 1 - hoverIndex) * 10}s ago</div>
            <div style={{ color: config.color1 }}>
              {config.label1}: {series1[hoverIndex]}
              {config.unit}
            </div>
            <div style={{ color: config.color2 }}>
              {config.label2}: {series2[hoverIndex]}
              {config.unit}
            </div>
          </div>
        )}
      </div>

      {/* Footer Metrics Breakdown */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--racklyt-border-weak)] font-mono text-[11px]">
        {/* Series 1 stats */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--racklyt-bg-input)]">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color1 }} />
            <span className="font-semibold text-primaryText">{config.label1}</span>
          </div>
          <div className="space-x-2 text-mutedText text-[10.5px]">
            <span>Now: <strong className="text-primaryText">{current1}{config.unit}</strong></span>
            <span>Min: <strong>{min1}{config.unit}</strong></span>
            <span>Avg: <strong>{avg1}{config.unit}</strong></span>
            <span>Peak: <strong>{max1}{config.unit}</strong></span>
          </div>
        </div>

        {/* Series 2 stats */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--racklyt-bg-input)]">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color2 }} />
            <span className="font-semibold text-primaryText">{config.label2}</span>
          </div>
          <div className="space-x-2 text-mutedText text-[10.5px]">
            <span>Now: <strong className="text-primaryText">{current2}{config.unit}</strong></span>
            <span>Min: <strong>{min2}{config.unit}</strong></span>
            <span>Avg: <strong>{avg2}{config.unit}</strong></span>
            <span>Peak: <strong>{max2}{config.unit}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeSeriesWidget;
