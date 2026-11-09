import React from 'react';
import { Server, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { Node } from '../../types';

interface FleetStatusProps {
  nodes: Node[];
}

export const FleetStatusWidget: React.FC<FleetStatusProps> = ({ nodes }) => {
  const onlineCount = nodes.filter((n) => n.status === 'online').length;
  const degradedCount = nodes.filter((n) => n.status === 'degraded').length;
  const offlineCount = nodes.filter((n) => n.status === 'offline').length;
  const total = nodes.length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 h-full">
      <div className="bg-elevated/70 border border-subtle p-3 rounded-lg flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-mutedText font-semibold">Total Fleet</div>
          <div className="text-2xl font-bold font-mono text-primaryText mt-1">{total}</div>
        </div>
        <Server className="w-6 h-6 text-accent" />
      </div>

      <div className="bg-elevated/70 border border-subtle p-3 rounded-lg flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-mutedText font-semibold">Healthy</div>
          <div className="text-2xl font-bold font-mono text-emerald mt-1">{onlineCount}</div>
        </div>
        <CheckCircle className="w-6 h-6 text-emerald" />
      </div>

      <div className="bg-elevated/70 border border-subtle p-3 rounded-lg flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-mutedText font-semibold">Degraded</div>
          <div className="text-2xl font-bold font-mono text-amber mt-1">{degradedCount}</div>
        </div>
        <AlertTriangle className="w-6 h-6 text-amber" />
      </div>

      <div className="bg-elevated/70 border border-subtle p-3 rounded-lg flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-mutedText font-semibold">Offline</div>
          <div className="text-2xl font-bold font-mono text-coral mt-1">{offlineCount}</div>
        </div>
        <XCircle className="w-6 h-6 text-coral" />
      </div>
    </div>
  );
};
