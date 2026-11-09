import React from 'react';
import { Cpu, HardDrive, Thermometer, Activity } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  iconType?: 'cpu' | 'ram' | 'temp' | 'activity';
  status?: 'normal' | 'warning' | 'critical';
}

export const StatCardWidget: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  iconType = 'activity',
  status = 'normal',
}) => {
  const getIcon = () => {
    switch (iconType) {
      case 'cpu':
        return <Cpu className="w-5 h-5 text-accent" />;
      case 'ram':
        return <HardDrive className="w-5 h-5 text-accent" />;
      case 'temp':
        return <Thermometer className="w-5 h-5 text-amber" />;
      default:
        return <Activity className="w-5 h-5 text-emerald" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'critical':
        return 'text-coral';
      case 'warning':
        return 'text-amber';
      default:
        return 'text-primaryText';
    }
  };

  return (
    <div className="flex flex-col justify-between h-full p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-mutedText font-semibold">{title}</span>
        {getIcon()}
      </div>
      <div className="my-2">
        <div className={`text-3xl font-mono font-bold ${getStatusColor()}`}>{value}</div>
        {subtitle && <div className="text-xs text-mutedText mt-1 font-mono">{subtitle}</div>}
      </div>
      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full ${status === 'critical' ? 'bg-coral' : status === 'warning' ? 'bg-amber' : 'bg-emerald'} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(100, typeof value === 'number' ? value : parseFloat(value) || 30)}%` }}
        />
      </div>
    </div>
  );
};
