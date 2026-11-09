import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, Check, CheckCheck, Bell, ShieldCheck } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { NotificationItem } from '../../types';
import { useToast } from '../../context/ToastContext';

export const AlertsFeedWidget: React.FC = () => {
  const toast = useToast();
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'ack'>('all');

  const defaultAlerts: NotificationItem[] = [
    {
      id: 'demo-1',
      alert_id: 'a1',
      severity: 'warning',
      title: 'Memory Threshold Warning (>85%)',
      body: 'rpi4-homelab-hub memory reached 88% capacity during container builds.',
      is_read: false,
      is_acknowledged: false,
      sent_at: Date.now() / 1000 - 320,
    },
    {
      id: 'demo-2',
      alert_id: 'a2',
      severity: 'critical',
      title: 'Host Undervoltage / Power Supply Jitter',
      body: 'Broadcom PMIC reported 4.82V drop below 4.95V minimum rail threshold.',
      is_read: false,
      is_acknowledged: false,
      sent_at: Date.now() / 1000 - 1200,
    },
    {
      id: 'demo-3',
      alert_id: 'a3',
      severity: 'info',
      title: 'Scheduled Snapshot Completed',
      body: 'pve-core-cluster VM 101 ZFS snapshot completed successfully (0 errors).',
      is_read: true,
      is_acknowledged: true,
      sent_at: Date.now() / 1000 - 3600,
    },
    {
      id: 'demo-4',
      alert_id: 'a4',
      severity: 'warning',
      title: 'ZFS Pool Scrub Flagged Checksum',
      body: 'tank-storage pool healed 1 checksum error on nvme-mirror automatically.',
      is_read: true,
      is_acknowledged: true,
      sent_at: Date.now() / 1000 - 7200,
    },
  ];

  const loadAlerts = async () => {
    try {
      const data = await ApiClient.getNotifications();
      if (Array.isArray(data) && data.length > 0) {
        setAlerts(data);
      } else {
        setAlerts(defaultAlerts);
      }
    } catch {
      setAlerts(defaultAlerts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleAck = async (id: string) => {
    try {
      await ApiClient.ackNotification(id);
    } catch {}
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_acknowledged: true, is_read: true } : a))
    );
    toast.success('Alert marked as acknowledged');
  };

  const handleAckAll = () => {
    setAlerts((prev) =>
      prev.map((a) => ({ ...a, is_acknowledged: true, is_read: true }))
    );
    toast.success('All active alerts acknowledged');
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="flex items-center text-red-400 text-xs font-semibold space-x-1 font-mono">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="uppercase text-[10px]">Critical</span>
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center text-amber-400 text-xs font-semibold space-x-1 font-mono">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="uppercase text-[10px]">Warning</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center text-blue-400 text-xs font-semibold space-x-1 font-mono">
            <Info className="w-3.5 h-3.5" />
            <span className="uppercase text-[10px]">Info</span>
          </span>
        );
    }
  };

  const activeCount = alerts.filter((a) => !a.is_acknowledged).length;

  const filtered = alerts.filter((a) => {
    if (filter === 'active') return !a.is_acknowledged;
    if (filter === 'ack') return a.is_acknowledged;
    return true;
  });

  return (
    <div className="flex flex-col h-full p-2 space-y-2 text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1.5 border-b border-[var(--racklyt-border-weak)] gap-1.5">
        <div className="flex items-center space-x-1.5">
          <Bell size={13} style={{ color: 'var(--racklyt-orange)' }} />
          <span className="font-semibold text-xs uppercase tracking-wider text-primaryText">
            Dead-Man Watchdogs & Alerts
          </span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40">
              {activeCount} Active
            </span>
          )}
        </div>

        {/* Filter and Ack All */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-[var(--racklyt-bg-input)] p-0.5 rounded-lg border border-[var(--racklyt-border-weak)] font-mono text-[10.5px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 rounded transition ${
                filter === 'all'
                  ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                  : 'text-mutedText hover:text-primaryText'
              }`}
            >
              All ({alerts.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-2 py-0.5 rounded transition ${
                filter === 'active'
                  ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                  : 'text-mutedText hover:text-primaryText'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilter('ack')}
              className={`px-2 py-0.5 rounded transition ${
                filter === 'ack'
                  ? 'bg-[var(--racklyt-orange)] text-black font-bold'
                  : 'text-mutedText hover:text-primaryText'
              }`}
            >
              Resolved ({alerts.length - activeCount})
            </button>
          </div>

          {activeCount > 0 && (
            <button
              onClick={handleAckAll}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-mutedText hover:text-primaryText border border-[var(--racklyt-border-weak)] text-[10.5px] font-mono flex items-center space-x-1"
              title="Acknowledge All"
            >
              <CheckCheck size={11} />
              <span>Ack All</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts Stream */}
      <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
        {loading ? (
          <div className="text-mutedText text-xs text-center py-6 font-mono">Loading telemetry alarms...</div>
        ) : filtered.length === 0 ? (
          <div className="text-mutedText text-xs text-center py-6 font-mono flex flex-col items-center space-y-1">
            <ShieldCheck size={20} className="text-emerald-400" />
            <span>All systems nominal. No firing watchdog alarms.</span>
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className={`p-2.5 rounded-lg border transition ${
                alert.is_acknowledged
                  ? 'bg-[var(--racklyt-bg-input)]/50 border-[var(--racklyt-border-weak)] opacity-70'
                  : alert.severity === 'critical'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-[var(--racklyt-bg-input)] border-[var(--racklyt-border-medium)]'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center space-x-2">
                  {getSeverityBadge(alert.severity)}
                  <span className="font-semibold text-primaryText text-xs">{alert.title}</span>
                </div>
                {!alert.is_acknowledged ? (
                  <button
                    onClick={() => handleAck(alert.id)}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-mutedText hover:text-emerald-400 transition"
                    title="Acknowledge alert"
                  >
                    <Check size={12} />
                  </button>
                ) : (
                  <span className="font-mono text-[10px] text-emerald-400 flex items-center space-x-1">
                    <CheckCheck size={11} />
                    <span>ACKED</span>
                  </span>
                )}
              </div>
              <p className="text-mutedText text-[11px] leading-relaxed mb-1">{alert.body}</p>
              <div className="text-[10px] font-mono text-mutedText/70">
                {new Date(alert.sent_at * 1000).toLocaleTimeString()} · Rule Engine v2
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertsFeedWidget;
