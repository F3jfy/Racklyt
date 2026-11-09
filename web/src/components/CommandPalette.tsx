import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Server,
  LayoutDashboard,
  Layers,
  Users,
  Settings,
  HelpCircle,
  Plus,
  Sparkles,
  Database,
  Palette,
  Activity,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { DashboardConfig, Node } from '../types';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../api/client';
import { useToast } from '../context/ToastContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: 'dashboard' | 'nodes' | 'proxmox' | 'users' | 'settings') => void;
  dashboards: DashboardConfig[];
  nodes: Node[];
  onSelectDashboard: (id: string) => void;
  onOpenHelp: () => void;
  onOpenEnrollNode: () => void;
  onOpenOnboarding: () => void;
  onOpenThemeModal: () => void;
}

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Fleet Nodes' | 'Dashboards' | 'Quick Actions';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  dashboards,
  nodes,
  onSelectDashboard,
  onOpenHelp,
  onOpenEnrollNode,
  onOpenOnboarding,
  onOpenThemeModal,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { logout, hasPermission } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (isOpen && (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build command list
  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      category: 'Navigation',
      title: 'Go to Cockpit Dashboard',
      subtitle: 'Overview gauges, thermal watchdog, and real-time load',
      icon: <LayoutDashboard className="w-4 h-4 text-amber-400" />,
      action: () => {
        onNavigate('dashboard');
        onClose();
      },
    },
    {
      id: 'nav-nodes',
      category: 'Navigation',
      title: 'Go to Infrastructure Fleet',
      subtitle: 'Inspect monitored servers, Raspberry Pis, and host telemetry',
      icon: <Server className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onNavigate('nodes');
        onClose();
      },
    },
    {
      id: 'nav-proxmox',
      category: 'Navigation',
      title: 'Go to Proxmox VE Hypervisors',
      subtitle: 'Monitor cluster nodes, QEMU VMs, LXC containers & ZFS pools',
      icon: <Layers className="w-4 h-4 text-purple-400" />,
      action: () => {
        onNavigate('proxmox');
        onClose();
      },
    },
    ...(hasPermission('users:manage')
      ? [
          {
            id: 'nav-users',
            category: 'Navigation' as const,
            title: 'Go to Access Control & RBAC',
            subtitle: 'Manage administrative accounts, operators, and permissions',
            icon: <Users className="w-4 h-4 text-blue-400" />,
            action: () => {
              onNavigate('users');
              onClose();
            },
          },
        ]
      : []),
    {
      id: 'nav-settings',
      category: 'Navigation',
      title: 'Go to Hub Operations & Settings',
      subtitle: 'Configure instance branding, watchdogs, SMTP alerts, and WAL retention',
      icon: <Settings className="w-4 h-4 text-slate-300" />,
      action: () => {
        onNavigate('settings');
        onClose();
      },
    },

    // Quick Actions
    {
      id: 'act-enroll-node',
      category: 'Quick Actions',
      title: 'Enroll New Node (Install Guide)',
      subtitle: 'Get one-liner curl, Docker Compose, or systemd daemon config',
      icon: <Plus className="w-4 h-4 text-amber-400" />,
      action: () => {
        onOpenEnrollNode();
        onClose();
      },
    },
    {
      id: 'act-spawn-node',
      category: 'Quick Actions',
      title: '⚡ Spawn Simulated Fleet Node',
      subtitle: 'Inject simulated Linux kernel telemetry for testing',
      icon: <Activity className="w-4 h-4 text-cyan-400" />,
      action: async () => {
        onClose();
        try {
          await ApiClient.spawnTestNode({
            name: `simulated-node-${Math.floor(Math.random() * 899 + 100)}`,
            os: 'Linux (Debian 12 / Proxmox VE)',
            tags: ['homelab', 'simulated', 'telemetry'],
          });
          toast.success('Simulated node spawned and streaming telemetry!');
          window.location.reload();
        } catch (e: any) {
          toast.error(e.message || 'Failed to spawn node');
        }
      },
    },
    {
      id: 'act-vacuum-db',
      category: 'Quick Actions',
      title: 'Run SQLite VACUUM & Truncate WAL',
      subtitle: 'Compact database pages and reclaim unallocated storage space',
      icon: <Database className="w-4 h-4 text-emerald-400" />,
      action: async () => {
        onClose();
        try {
          const res = await ApiClient.vacuumDatabase();
          toast.success(res.message || 'Database vacuum completed successfully.');
        } catch (e: any) {
          toast.error(e.message || 'VACUUM execution failed');
        }
      },
    },
    {
      id: 'act-help',
      category: 'Quick Actions',
      title: 'Open Operator Architecture Guide',
      subtitle: 'Comprehensive documentation on push protocol, WAL wear protection, and watchdogs',
      icon: <HelpCircle className="w-4 h-4 text-blue-400" />,
      action: () => {
        onOpenHelp();
        onClose();
      },
    },
    {
      id: 'act-onboarding',
      category: 'Quick Actions',
      title: 'Re-run Setup / Onboarding Wizard',
      subtitle: 'Step through instance naming, password security, and radar detection',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      action: () => {
        onOpenOnboarding();
        onClose();
      },
    },
    {
      id: 'act-theme',
      category: 'Quick Actions',
      title: 'Customize Theme & Accent Palette',
      subtitle: 'Select Slate, Canvas, Cyberpunk, or custom hexadecimal highlights',
      icon: <Palette className="w-4 h-4 text-pink-400" />,
      action: () => {
        onOpenThemeModal();
        onClose();
      },
    },
    {
      id: 'act-logout',
      category: 'Quick Actions',
      title: 'Sign Out of Hub',
      subtitle: 'Terminate current authenticated session and return to login',
      icon: <LogOut className="w-4 h-4 text-red-400" />,
      action: () => {
        onClose();
        logout();
      },
    },

    // Dashboards
    ...dashboards.map((d) => ({
      id: `dash-${d.id}`,
      category: 'Dashboards' as const,
      title: `Switch to Dashboard: ${d.title}`,
      subtitle: d.description || 'Pre-configured metrics suite',
      icon: <LayoutDashboard className="w-4 h-4 text-amber-400/80" />,
      action: () => {
        onSelectDashboard(d.id);
        onNavigate('dashboard');
        onClose();
      },
    })),

    // Nodes
    ...nodes.map((n) => ({
      id: `node-${n.id}`,
      category: 'Fleet Nodes' as const,
      title: `Inspect Node: ${n.name}`,
      subtitle: `${n.os} • ${n.ip_address || 'outbound'} • ${n.status.toUpperCase()}`,
      icon: <Server className="w-4 h-4 text-emerald-400/80" />,
      action: () => {
        onNavigate('nodes');
        onClose();
      },
    })),
  ];

  const filtered = commands.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
      c.category.toLowerCase().includes(q)
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#12141a]/95 border border-white/[0.12] rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col animate-scale-up"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.015]">
          <Search className="w-4 h-4 text-mutedText mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search commands, nodes, dashboards, or documentation..."
            className="w-full bg-transparent text-sm text-primaryText placeholder-mutedText outline-none"
          />
          <kbd className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.08] border border-white/10 text-mutedText shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-white/[0.04]">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-mutedText font-mono">
              No matching commands or fleet resources found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg cursor-pointer transition ${
                    isSelected
                      ? 'bg-amber-500/15 border border-amber-500/30 text-white'
                      : 'hover:bg-white/[0.03] text-primaryText border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-md ${
                        isSelected ? 'bg-amber-500/20' : 'bg-white/[0.04]'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/[0.06] text-mutedText">
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-mutedText truncate">{item.subtitle}</div>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-2 animate-pulse" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Keyboard Hints Footer */}
        <div className="px-4 py-2 border-t border-white/[0.06] bg-black/40 flex items-center justify-between text-[11px] text-mutedText font-mono">
          <div className="flex items-center space-x-4">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 mr-1">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 mr-1">↓</kbd>
              to navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 mr-1">↵</kbd>
              to select
            </span>
          </div>
          <span>Racklyt Command Palette</span>
        </div>
      </div>
    </div>
  );
};
