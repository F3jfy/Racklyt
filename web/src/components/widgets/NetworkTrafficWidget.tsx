import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Network } from 'lucide-react';

interface InterfaceStats {
  rxSpeedMb: number;
  txSpeedMb: number;
  totalRxGb: number;
  totalTxGb: number;
  rxPps: number;
  txPps: number;
  ip: string;
  mac: string;
  type: string;
}

interface NetworkTrafficWidgetProps {
  rxSpeedMb?: number;
  txSpeedMb?: number;
  interfaceName?: string;
}

export const NetworkTrafficWidget: React.FC<NetworkTrafficWidgetProps> = ({
  interfaceName = 'eth0',
}) => {
  const [selectedIface, setSelectedIface] = useState<string>(interfaceName);

  const ifaceData: Record<string, InterfaceStats> = {
    eth0: {
      rxSpeedMb: 12.8,
      txSpeedMb: 5.4,
      totalRxGb: 48.2,
      totalTxGb: 19.6,
      rxPps: 8420,
      txPps: 3150,
      ip: '192.168.1.100/24',
      mac: 'dc:a6:32:8f:14:a1',
      type: '1000baseT Full-Duplex (Gigabit)',
    },
    wlan0: {
      rxSpeedMb: 1.4,
      txSpeedMb: 0.6,
      totalRxGb: 6.4,
      totalTxGb: 2.1,
      rxPps: 1240,
      txPps: 520,
      ip: '192.168.1.182/24',
      mac: 'dc:a6:32:8f:14:a2',
      type: 'Wi-Fi 6 (802.11ax) 5GHz',
    },
    docker0: {
      rxSpeedMb: 18.2,
      txSpeedMb: 14.1,
      totalRxGb: 92.4,
      totalTxGb: 88.0,
      rxPps: 14200,
      txPps: 12800,
      ip: '172.17.0.1/16',
      mac: '02:42:1a:88:b4:90',
      type: 'Virtual Bridge (veth pairs)',
    },
    tailscale0: {
      rxSpeedMb: 3.8,
      txSpeedMb: 2.1,
      totalRxGb: 14.8,
      totalTxGb: 8.9,
      rxPps: 2940,
      txPps: 1880,
      ip: '100.84.12.9/32',
      mac: 'WireGuard Tunnel',
      type: 'Tailscale Mesh VPN (Point-to-Point)',
    },
    vmbr0: {
      rxSpeedMb: 34.2,
      txSpeedMb: 26.8,
      totalRxGb: 312.4,
      totalTxGb: 284.1,
      rxPps: 28400,
      txPps: 22100,
      ip: '192.168.1.20/24',
      mac: 'bc:24:11:3e:70:01',
      type: 'Proxmox Bridged VLAN (Trunk)',
    },
  };

  const current = ifaceData[selectedIface] || ifaceData.eth0;

  // Mini sparkline generation
  const sparklineRx = [0.4, 0.6, 0.8, 0.7, 0.9, 0.8, 1.0, 0.85, 0.95, 0.9].map(
    (f) => current.rxSpeedMb * f
  );
  const sparklineTx = [0.5, 0.7, 0.6, 0.8, 0.75, 0.9, 0.8, 0.85, 0.95, 0.88].map(
    (f) => current.txSpeedMb * f
  );

  return (
    <div className="p-2 space-y-2 text-xs">
      {/* Top Interface Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1.5 border-b border-[var(--racklyt-border-weak)] gap-1.5">
        <div className="flex items-center space-x-1.5 text-mutedText">
          <Network size={13} style={{ color: 'var(--racklyt-cyan)' }} />
          <span className="font-semibold text-xs uppercase tracking-wider text-primaryText">
            Network Interface Hub
          </span>
        </div>
        <div className="flex items-center space-x-1 bg-[var(--racklyt-bg-input)] p-0.5 rounded-lg border border-[var(--racklyt-border-weak)] text-[10.5px] font-mono">
          {Object.keys(ifaceData).map((iface) => (
            <button
              key={iface}
              onClick={() => setSelectedIface(iface)}
              className={`px-1.5 py-0.5 rounded transition ${
                selectedIface === iface
                  ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                  : 'text-mutedText hover:text-primaryText'
              }`}
            >
              {iface}
            </button>
          ))}
        </div>
      </div>

      {/* Throughput KPI Split Cards */}
      <div className="grid grid-cols-2 gap-2">
        {/* Inbound Download */}
        <div className="p-2 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex flex-col justify-between space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1 text-[10.5px] font-bold text-emerald-400">
              <ArrowDownLeft size={13} />
              <span>INGRESS (RX)</span>
            </span>
            <span className="text-[10px] text-mutedText font-mono">
              Total: {current.totalRxGb.toFixed(1)} GB
            </span>
          </div>

          <div className="flex items-baseline space-x-1.5 my-0.5">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {current.rxSpeedMb.toFixed(2)}
            </span>
            <span className="text-xs text-mutedText font-mono">MB/s</span>
          </div>

          {/* Sparkline Bar Chart */}
          <div className="flex items-end space-x-1 h-6 pt-1">
            {sparklineRx.map((val, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-emerald-500/30 hover:bg-emerald-400 transition"
                style={{
                  height: `${Math.max(15, (val / (current.rxSpeedMb * 1.2 || 1)) * 100)}%`,
                }}
                title={`${val.toFixed(2)} MB/s`}
              />
            ))}
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-mutedText pt-1 border-t border-white/5">
            <span>Packets: {current.rxPps.toLocaleString()} pps</span>
            <span className="text-emerald-400">0.00% Drops</span>
          </div>
        </div>

        {/* Outbound Upload */}
        <div className="p-3 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1 text-[11px] font-bold" style={{ color: 'var(--racklyt-blue)' }}>
              <ArrowUpRight size={14} />
              <span>EGRESS (TX)</span>
            </span>
            <span className="text-[10px] text-mutedText font-mono">
              Total: {current.totalTxGb.toFixed(1)} GB
            </span>
          </div>

          <div className="flex items-baseline space-x-1.5 my-0.5">
            <span className="text-2xl font-bold font-mono" style={{ color: 'var(--racklyt-blue)' }}>
              {current.txSpeedMb.toFixed(2)}
            </span>
            <span className="text-xs text-mutedText font-mono">MB/s</span>
          </div>

          {/* Sparkline Bar Chart */}
          <div className="flex items-end space-x-1 h-6 pt-1">
            {sparklineTx.map((val, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-blue-500/30 hover:bg-blue-400 transition"
                style={{
                  height: `${Math.max(15, (val / (current.txSpeedMb * 1.2 || 1)) * 100)}%`,
                }}
                title={`${val.toFixed(2)} MB/s`}
              />
            ))}
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-mutedText pt-1 border-t border-white/5">
            <span>Packets: {current.txPps.toLocaleString()} pps</span>
            <span className="text-emerald-400">0.00% Drops</span>
          </div>
        </div>
      </div>

      {/* Interface Details Footer */}
      <div className="p-2 rounded-lg bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-mutedText">
        <span className="flex items-center space-x-1.5">
          <span className="text-primaryText font-semibold">IP:</span>
          <span className="text-[var(--racklyt-cyan)]">{current.ip}</span>
        </span>
        <span className="truncate">MAC: {current.mac}</span>
        <span className="text-primaryText truncate">{current.type}</span>
      </div>
    </div>
  );
};

export default NetworkTrafficWidget;
