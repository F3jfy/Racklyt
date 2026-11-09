import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  durationMs?: number;
}

interface ToastContextType {
  toast: {
    success: (msg: string, durationMs?: number) => void;
    error: (msg: string, durationMs?: number) => void;
    info: (msg: string, durationMs?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string, durationMs = 3200) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message, durationMs }]);

    setTimeout(() => {
      removeToast(id);
    }, durationMs);
  }, [removeToast]);

  const toast = {
    success: (msg: string, durationMs?: number) => addToast('success', msg, durationMs),
    error: (msg: string, durationMs?: number) => addToast('error', msg, durationMs),
    info: (msg: string, durationMs?: number) => addToast('info', msg, durationMs),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Floating Toast Notification Stack */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          let icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
          let borderClass = 'border-emerald-500/25';
          let glowColor = 'rgba(16, 185, 129, 0.15)';

          if (t.type === 'error') {
            icon = <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
            borderClass = 'border-red-500/25';
            glowColor = 'rgba(239, 68, 68, 0.15)';
          } else if (t.type === 'info') {
            icon = <Info className="w-4 h-4 text-cyan-400 shrink-0" />;
            borderClass = 'border-cyan-500/25';
            glowColor = 'rgba(6, 182, 212, 0.15)';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#14161d]/95 backdrop-blur-md border ${borderClass} shadow-2xl text-xs text-primaryText animate-scale-up`}
              style={{ boxShadow: `0 10px 25px -5px ${glowColor}, 0 8px 10px -6px rgba(0, 0, 0, 0.5)` }}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                {icon}
                <span className="font-medium truncate">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-mutedText hover:text-primaryText transition p-0.5 rounded"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx.toast;
};
