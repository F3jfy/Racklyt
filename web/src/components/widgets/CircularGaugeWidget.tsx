import React, { useId } from 'react';

export interface Threshold {
  value: number;
  color: string;
}

interface CircularGaugeWidgetProps {
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  thresholds?: Threshold[];
  color?: string;
  subtitle?: string;
}

export const CircularGaugeWidget: React.FC<CircularGaugeWidgetProps> = ({
  value,
  min = 0,
  max = 100,
  unit = '%',
  thresholds = [
    { value: 0, color: '#10b981' },   // Emerald
    { value: 70, color: '#f59e0b' },  // Amber
    { value: 85, color: '#ef4444' },  // Red
  ],
  color = '#f59e0b',
  subtitle,
}) => {
  const filterId = useId().replace(/[^a-zA-Z0-9-_]/g, '');

  const safeValue = Math.min(Math.max(value, min), max);
  const range = max - min || 1;
  const percentage = Math.max(0, Math.min(1, (safeValue - min) / range));

  // Geometry
  const cx = 120;
  const cy = 96;
  const radius = 72;
  const strokeWidth = 12;
  const pathLength = Math.PI * radius; // ~226.19
  const strokeDashoffset = pathLength - percentage * pathLength;

  // Determine active color
  let activeColor = color;
  let statusText = 'NORMAL';
  let statusBg = 'rgba(16, 185, 129, 0.12)';
  let statusBorder = 'rgba(16, 185, 129, 0.25)';

  if (value === 0 && (!subtitle || subtitle.toLowerCase().includes('awaiting'))) {
    statusText = 'STANDBY';
    activeColor = '#64748b';
    statusBg = 'rgba(100, 116, 139, 0.12)';
    statusBorder = 'rgba(100, 116, 139, 0.25)';
  } else if (thresholds && thresholds.length > 0) {
    const sorted = [...thresholds].sort((a, b) => a.value - b.value);
    for (const t of sorted) {
      if (safeValue >= t.value) {
        activeColor = t.color;
        if (t.value >= 85) {
          statusText = 'CRITICAL';
          statusBg = 'rgba(239, 68, 68, 0.15)';
          statusBorder = 'rgba(239, 68, 68, 0.3)';
        } else if (t.value >= 70) {
          statusText = 'ELEVATED';
          statusBg = 'rgba(245, 158, 11, 0.15)';
          statusBorder = 'rgba(245, 158, 11, 0.3)';
        } else {
          statusText = 'OPTIMAL';
          statusBg = 'rgba(16, 185, 129, 0.12)';
          statusBorder = 'rgba(16, 185, 129, 0.25)';
        }
      }
    }
  }

  const displayValue =
    typeof value === 'number'
      ? value.toFixed(1).replace(/\.0$/, '')
      : '0';

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const startX = cx - radius;
  const endX = cx + radius;
  const arcPath = `M ${startX},${cy} A ${radius},${radius} 0 0 1 ${endX},${cy}`;

  return (
    <div className="gauge-wrapper flex flex-col items-center justify-between p-2 w-full h-full select-none">
      <div className="gauge-svg-container relative w-full max-w-[155px] max-h-[82px] aspect-[240/122] flex items-center justify-center">
        <svg viewBox="0 0 240 122" className="gauge-svg w-full h-full overflow-visible">
          <defs>
            <linearGradient id={`gauge-grad-${filterId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="1" />
            </linearGradient>
            <filter id={`gauge-glow-${filterId}`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={activeColor} floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Background Inset Track Arc */}
          <path
            d={arcPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth + 2}
            strokeLinecap="round"
          />
          <path
            d={arcPath}
            fill="none"
            stroke="rgba(0, 0, 0, 0.4)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Perimeter Scale Ticks */}
          {ticks.map((t, i) => {
            const angle = Math.PI - t * Math.PI;
            const tickInnerR = radius + 9;
            const tickOuterR = radius + 15;
            const x1 = cx + tickInnerR * Math.cos(angle);
            const y1 = cy - tickInnerR * Math.sin(angle);
            const x2 = cx + tickOuterR * Math.cos(angle);
            const y2 = cy - tickOuterR * Math.sin(angle);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}

          {/* Foreground Active Gradient Arc */}
          <path
            d={arcPath}
            fill="none"
            stroke={`url(#gauge-grad-${filterId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={pathLength}
            strokeDashoffset={strokeDashoffset}
            filter={`url(#gauge-glow-${filterId})`}
            style={{
              transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease',
            }}
          />

          {/* Metric Typography */}
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            fill="#ffffff"
            className="font-mono"
            style={{
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
            }}
          >
            {displayValue}
            <tspan
              dx="2"
              dy="-3"
              fill={activeColor}
              style={{ fontSize: '13px', fontWeight: 600 }}
            >
              {unit}
            </tspan>
          </text>

          {/* Min & Max Labels */}
          <text
            x={startX}
            y={cy + 16}
            textAnchor="middle"
            fill="rgba(255, 255, 255, 0.3)"
            className="font-mono"
            style={{ fontSize: '9px', fontWeight: 600 }}
          >
            {min}{unit}
          </text>
          <text
            x={endX}
            y={cy + 16}
            textAnchor="middle"
            fill="rgba(255, 255, 255, 0.3)"
            className="font-mono"
            style={{ fontSize: '9px', fontWeight: 600 }}
          >
            {max}{unit}
          </text>
        </svg>
      </div>

      {/* Modern Status Badge & Subtitle */}
      <div className="flex items-center gap-1.5 mt-1">
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold"
          style={{
            backgroundColor: statusBg,
            border: `1px solid ${statusBorder}`,
            color: activeColor,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: activeColor }}
          />
          {statusText}
        </span>

        {subtitle && (
          <span className="text-[10px] font-mono text-mutedText truncate max-w-[140px]" title={subtitle}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

export default CircularGaugeWidget;
