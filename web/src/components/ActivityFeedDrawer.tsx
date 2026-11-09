import React, { useState, useEffect } from 'react';
import { X, Bell, CheckCheck, Server, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ApiClient } from '../api/client';
import { NotificationItem } from '../types';

interface ActivityFeedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshCount?: () => void;
}

export const ActivityFeedDrawer: React.FC<ActivityFeedDrawerProps> = ({
  isOpen,
  onClose,
  onRefreshCount,
}) => {
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await ApiClient.getNotifications();
      setAlerts(data);
    } catch {
      // Quiet fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    try {
      const unacked = alerts.filter((a) => !a.is_acknowledged && !a.is_read);
      await Promise.allSettled(unacked.map((a) => ApiClient.ackNotification(a.id)));
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true, is_acknowledged: true })));
      if (onRefreshCount) onRefreshCount();
    } catch {}
  };

  const handleMarkRead = async (id: string) => {
    try {
      await ApiClient.ackNotification(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true, is_acknowledged: true } : a)));
      if (onRefreshCount) onRefreshCount();
    } catch {}
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <Server className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
  };

  const formatTimestamp = (ts: number): string => {
    if (!ts) return 'Just now';
    const ms = ts > 1e11 ? ts : ts * 1000;
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-[#111319] border-l border-white/[0.08] shadow-2xl flex flex-col animate-slide-in-right"
        style={{
          boxShadow: '-10px 0 35px -5px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.015]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Hub Activity & Audit Stream</h3>
              <p className="text-[11px] text-mutedText">Fleet events, watchdogs & system checkpoints</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-mutedText hover:text-white hover:bg-white/[0.05] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-4 py-2 border-b border-white/[0.06] bg-black/30 flex items-center justify-between text-xs">
          <span className="text-mutedText font-mono text-[11px]">
            {alerts.filter((a) => !a.is_read && !a.is_acknowledged).length} unread alerts
          </span>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1"
          >
            <CheckCheck size={13} />
            <span>Mark all read</span>
          </button>
        </div>

        {/* Events List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] p-2">
          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-mutedText">
              Loading activity events...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={20} />
              </div>
              <p className="text-xs font-semibold text-white">All Systems Nominal</p>
              <p className="text-[11px] text-mutedText">
                No active threshold violations or missed heartbeats recorded.
              </p>
            </div>
          ) : (
            alerts.map((alert) => {
              const isUnread = !alert.is_read && !alert.is_acknowledged;
              return (
                <div
                  key={alert.id}
                  onClick={() => isUnread && handleMarkRead(alert.id)}
                  className={`p-3 rounded-lg transition cursor-pointer flex items-start space-x-3 ${
                    isUnread
                      ? 'bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05]'
                      : 'hover:bg-white/[0.02] opacity-75'
                  }`}
                >
                  <div className="pt-0.5">{getSeverityIcon(alert.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {alert.title}
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-mutedText mt-0.5 leading-relaxed">
                      {alert.body}
                    </p>
                    <span className="text-[10px] font-mono text-mutedText/70 mt-1 block">
                      {formatTimestamp(alert.sent_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.08] bg-black/40 text-center text-[11px] text-mutedText font-mono">
          Push Watchdog Engine • Realtime SSE Streaming
        </div>
      </div>
    </div>
  );
};
