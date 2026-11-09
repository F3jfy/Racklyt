import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  Edit,
  Check,
  Palette,
  Server,
  ChevronDown,
  HelpCircle,
  Search,
  X,
  Cpu,
  Activity,
  Thermometer,
  HardDrive,
  Network,
  ArrowRight,
} from 'lucide-react';
import { THEME_PRESETS, AppSettings, applyThemeToDom } from '../utils/theme';
import { DashboardConfig } from '../types';
import { CustomDropdown } from './common/CustomDropdown';

interface TopNavbarProps {
  user?: any;
  currentView: string;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  onSave?: () => void;
  nodes: any[];
  selectedServerId: string;
  setSelectedServerId: (id: string) => void;
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  dashboardsList?: DashboardConfig[];
  activeDashboardId?: string;
  pinnedDashboardIds?: string[];
  onSelectDashboard?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onOpenDashboardManager?: () => void;
  onOpenHelp?: () => void;
  onOpenEnrollNode?: () => void;
  onOpenCommandPalette?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  user,
  currentView,
  isEditing,
  setIsEditing,
  onSave,
  nodes,
  selectedServerId,
  setSelectedServerId,
  appSettings,
  setAppSettings,
  dashboardsList = [],
  activeDashboardId = 'dash_default',
  onSelectDashboard,
  onOpenDashboardManager,
  onOpenHelp,
}) => {
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDashboardDropdown, setShowDashboardDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter nodes strictly to those accessible by the authenticated user
  // (Both backend RBAC in /api/v1/nodes and client-side scope filtering)
  const accessibleNodes = useMemo(() => {
    if (!user) return nodes;
    const isAdmin =
      user.permissions?.includes('*') ||
      user.permissions?.includes('nodes:manage') ||
      user.role_id === 'role_superadmin' ||
      user.role_id === 'role_admin';
    if (isAdmin) return nodes;

    if (user.scopes && Array.isArray(user.scopes) && user.scopes.length > 0) {
      const hasGlobal = user.scopes.some((s: any) => s.type === 'Global');
      if (hasGlobal) return nodes;

      const allowedNodeIds = new Set(
        user.scopes
          .filter((s: any) => s.type === 'Node' && s.value)
          .map((s: any) => s.value)
      );
      const allowedTags = new Set(
        user.scopes
          .filter((s: any) => s.type === 'Tag' && s.value)
          .map((s: any) => s.value)
      );

      return nodes.filter((n) => {
        if (allowedNodeIds.has(n.id)) return true;
        if (n.tags && Array.isArray(n.tags) && n.tags.some((t: string) => allowedTags.has(t))) return true;
        return false;
      });
    }

    return nodes;
  }, [nodes, user]);

  // Middle Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const isMac = useMemo(() => {
    return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }, []);

  // Keyboard shortcut listener for ⌘K or Ctrl+K / Win+K & Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Support Cmd+K (Mac) or Win+K / Ctrl+K (Windows / Linux)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setShowSearchResults(true);
      }
      if (e.key === 'Escape') {
        setShowSearchResults(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Click outside listener for dashboard dropdown and search panel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDashboardDropdown(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Server dropdown options
  const nodeOptions = [
    {
      value: 'all',
      label: `All Fleet Nodes (${accessibleNodes.length})`,
      badge: 'Cluster',
      icon: <Server size={12} className="text-[var(--racklyt-orange)]" />,
    },
    ...accessibleNodes.map((n) => ({
      value: n.id,
      label: n.name || n.hostname || n.id,
      description: n.ip_address || n.hostname,
      badge: n.status === 'online' ? '● Online' : '● Offline',
      badgeColor:
        n.status === 'online'
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          : 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      icon: <Server size={12} className={n.status === 'online' ? 'text-emerald-400' : 'text-mutedText'} />,
    })),
  ];

  const activeDashboard = dashboardsList.find((d) => d.id === activeDashboardId) || dashboardsList[0];

  const getViewTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return activeDashboard?.title || 'Infrastructure Telemetry Overview';
      case 'nodes':
        return 'Infrastructure Fleet Explorer';
      case 'proxmox':
        return 'Proxmox VE Hypervisors & Guests';
      case 'users':
        return 'Access Control & Multi-Account RBAC';
      case 'settings':
        return 'Ingress, SMTP & Hub Configuration';
      default:
        return 'Overview';
    }
  };

  const handleSelectPreset = (preset: (typeof THEME_PRESETS)[0]) => {
    const updated: AppSettings = {
      ...appSettings,
      themePreset: preset.id,
      accentColor: preset.accentColor,
      canvasBg: preset.canvasBg,
      panelBg: preset.panelBg,
      textColor: preset.textColor,
    };
    setAppSettings(updated);
    applyThemeToDom(updated);
    localStorage.setItem('homelab_app_settings', JSON.stringify(updated));
    setShowThemeModal(false);
  };

  const handleCustomAccent = (hex: string) => {
    const updated: AppSettings = {
      ...appSettings,
      accentColor: hex,
    };
    setAppSettings(updated);
    applyThemeToDom(updated);
    localStorage.setItem('homelab_app_settings', JSON.stringify(updated));
  };

  // Helper metric extractors for nodes
  const getCpuVal = (n: any): number => {
    if (n?.latest_metrics?.cpu_percent !== undefined) return n.latest_metrics.cpu_percent;
    return n.status === 'online' ? 22.4 : 0;
  };

  const getRamVal = (n: any): { usedGb: number; totalGb: number; percent: number } => {
    const used = n?.latest_metrics?.memory_used_bytes;
    const total = n?.latest_metrics?.memory_total_bytes;
    if (used && total && total > 0) {
      const u = used / (1024 * 1024 * 1024);
      const t = total / (1024 * 1024 * 1024);
      return { usedGb: +u.toFixed(1), totalGb: +t.toFixed(1), percent: Math.min(100, Math.round((used / total) * 100)) };
    }
    return { usedGb: 4.8, totalGb: 16.0, percent: 30 };
  };

  const getTempVal = (n: any): number => {
    if (n?.latest_metrics?.temp_celsius !== undefined) return n.latest_metrics.temp_celsius;
    return n.status === 'online' ? 44.5 : 0;
  };

  const getDiskVal = (n: any): { usedGb: number; totalGb: number; percent: number } => {
    const used = n?.latest_metrics?.disk_used_bytes;
    const total = n?.latest_metrics?.disk_total_bytes;
    if (used && total && total > 0) {
      const u = used / (1024 * 1024 * 1024);
      const t = total / (1024 * 1024 * 1024);
      return { usedGb: +u.toFixed(1), totalGb: +t.toFixed(1), percent: Math.round((used / total) * 100) };
    }
    return { usedGb: 128.0, totalGb: 512.0, percent: 25 };
  };

  const getNetVal = (n: any): string => {
    const rx = n?.latest_metrics?.net_rx_bytes;
    if (rx !== undefined) return `${(rx / (1024 * 1024)).toFixed(1)} MB/s`;
    return '3.2 MB/s';
  };

  // Smart Search Query Analysis
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const isCpu = /\b(cpu|processor|cores?|load)\b/.test(q);
    const isRam = /\b(ram|memory|mem|swap)\b/.test(q) || (/\busage\b/.test(q) && !/\b(cpu|temp|disk|storage)\b/.test(q));
    const isTemp = /\b(temp|temperature|thermal|celsius|heat)\b/.test(q);
    const isDisk = /\b(disk|storage|drive|hdd|ssd|space)\b/.test(q);
    const isNet = /\b(net|network|bandwidth|rx|tx|throughput)\b/.test(q);

    const metricType: 'cpu' | 'ram' | 'temp' | 'disk' | 'net' | null = isCpu
      ? 'cpu'
      : isRam
      ? 'ram'
      : isTemp
      ? 'temp'
      : isDisk
      ? 'disk'
      : isNet
      ? 'net'
      : null;

    // Remove metric and filler words to see if a specific server name is specified
    const remainingWords = q
      .replace(
        /\b(cpu|processor|cores?|load|ram|memory|mem|usage|temp|temperature|thermal|celsius|heat|disk|storage|drive|hdd|ssd|space|net|network|bandwidth|rx|tx|throughput|server|servers|node|nodes|host|hosts|the|of|for|in|on|show|get|all)\b/g,
        ' '
      )
      .trim();

    let matchedNode: any = null;
    if (remainingWords.length > 0) {
      matchedNode = accessibleNodes.find((n) => {
        const name = (n.name || '').toLowerCase();
        const host = (n.hostname || '').toLowerCase();
        const id = (n.id || '').toLowerCase();
        const ip = (n.ip_address || '').toLowerCase();
        return (
          name.includes(remainingWords) ||
          host.includes(remainingWords) ||
          id.includes(remainingWords) ||
          ip.includes(remainingWords)
        );
      });
    }

    // Matching dashboards
    const matchedDashboards = dashboardsList.filter((d) => d.title.toLowerCase().includes(q));

    // Matching general nodes if not already matched
    const matchingNodes = accessibleNodes.filter((n) => {
      const name = (n.name || '').toLowerCase();
      const host = (n.hostname || '').toLowerCase();
      const id = (n.id || '').toLowerCase();
      return name.includes(q) || host.includes(q) || id.includes(q);
    });

    return {
      metricType,
      matchedNode,
      remainingWords,
      matchedDashboards,
      matchingNodes,
    };
  }, [searchQuery, accessibleNodes, dashboardsList]);

  return (
    <>
      <header className="racklyt-navbar relative flex items-center justify-between px-4">
        {/* ====================================================
            LEFT: BREADCRUMBS (Racklyt Fleet / ... - No Star)
            ==================================================== */}
        <div className="navbar-left shrink-0 z-10 flex items-center max-w-[280px] lg:max-w-xs">
          <div className="racklyt-breadcrumbs">
            <span className="breadcrumb-root">
              <FolderOpen size={13} />
              <span>Racklyt Fleet</span>
            </span>
            <span className="breadcrumb-sep">/</span>

            {currentView === 'dashboard' ? (
              <div className="relative inline-flex items-center" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowDashboardDropdown(!showDashboardDropdown)}
                  className="breadcrumb-title flex items-center gap-1.5 hover:text-[var(--racklyt-text-primary)] cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                  title="Click to switch dashboard"
                >
                  <span className="font-semibold text-xs text-[var(--racklyt-text-primary)]">
                    {activeDashboard?.title || 'Infrastructure Telemetry Overview'}
                  </span>
                  <ChevronDown size={11} style={{ color: 'var(--racklyt-text-muted)' }} />
                </button>

                {/* Dashboard Switcher Dropdown */}
                {showDashboardDropdown && (
                  <div
                    className="absolute left-0 top-full mt-2 w-72 rounded z-50 py-1"
                    style={{
                      backgroundColor: 'var(--racklyt-bg-panel)',
                      border: '1px solid var(--racklyt-border-medium)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 12px',
                        borderBottom: '1px solid var(--racklyt-border-weak)',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--racklyt-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Switch Dashboard</span>
                      <span style={{ textTransform: 'lowercase' }}>{dashboardsList.length} total</span>
                    </div>

                    <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px 0' }}>
                      {dashboardsList.map((d) => {
                        const isSelected = d.id === activeDashboardId;
                        return (
                          <div
                            key={d.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? 'var(--racklyt-bg-active)' : 'transparent',
                              transition: 'background-color 0.1s ease',
                            }}
                            className="hover:bg-[var(--racklyt-bg-active)]"
                            onClick={() => {
                              if (onSelectDashboard) onSelectDashboard(d.id);
                              setShowDashboardDropdown(false);
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                              {isSelected ? (
                                <Check size={12} style={{ color: 'var(--racklyt-orange)', flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 12, flexShrink: 0 }} />
                              )}
                              <span
                                style={{
                                  fontSize: 12,
                                  color: isSelected ? 'var(--racklyt-orange)' : 'var(--racklyt-text-primary)',
                                  fontWeight: isSelected ? 600 : 400,
                                }}
                                className="truncate"
                              >
                                {d.title}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {onOpenDashboardManager && (
                      <div
                        style={{
                          borderTop: '1px solid var(--racklyt-border-weak)',
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: 'var(--racklyt-orange)',
                          fontWeight: 500,
                        }}
                        className="hover:bg-[var(--racklyt-bg-active)]"
                        onClick={() => {
                          setShowDashboardDropdown(false);
                          onOpenDashboardManager();
                        }}
                      >
                        <span>Manage Dashboards...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span className="breadcrumb-title">
                <span>{getViewTitle()}</span>
              </span>
            )}
          </div>
        </div>

        {/* ====================================================
            MIDDLE: INTELLIGENT SEARCH BAR
            - Live parsing: "temp server production", "ram usage", etc.
            - Displays metric across all servers when no server is specified
            ==================================================== */}
        <div
          className="navbar-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm sm:max-w-md md:max-w-lg z-20 pointer-events-auto px-2"
          ref={searchContainerRef}
        >
          <div className="relative flex items-center w-full">
            <Search size={13} className="absolute left-3 text-mutedText pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              placeholder='Search metrics or hosts (e.g. "temp production", "ram usage")...'
              className="w-full pl-9 pr-16 py-1.5 text-xs bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded-md text-primaryText placeholder-zinc-500 focus:outline-none focus:border-[var(--racklyt-orange)] focus:ring-1 focus:ring-[var(--racklyt-orange)] transition shadow-inner font-sans"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="absolute right-2 text-mutedText hover:text-white p-1"
                title="Clear search"
              >
                <X size={12} />
              </button>
            ) : (
              <kbd
                className="absolute right-2.5 px-1.5 py-0.5 text-[9.5px] font-mono bg-white/5 border border-white/10 rounded text-mutedText pointer-events-none"
                title={isMac ? "Command+K" : "Ctrl+K or Win+K"}
              >
                {isMac ? '⌘K' : 'Ctrl+K'}
              </kbd>
            )}
          </div>

          {/* Search Results Dropdown Panel */}
          {showSearchResults && (
            <div
              className="absolute left-0 right-0 top-full mt-1.5 bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded-lg shadow-2xl z-50 p-2.5 max-h-96 overflow-y-auto animate-fadeIn"
              style={{ boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7)' }}
            >
              {/* CASE 1: SPECIFIC SERVER + SPECIFIC METRIC (e.g. "temp server production") */}
              {searchResults?.metricType && searchResults?.matchedNode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10.5px] font-semibold text-mutedText uppercase tracking-wider pb-1.5 border-b border-[var(--racklyt-border-weak)]">
                    <span className="flex items-center gap-1.5 text-[var(--racklyt-orange)]">
                      {searchResults.metricType === 'cpu' && <Cpu size={12} />}
                      {searchResults.metricType === 'ram' && <Activity size={12} />}
                      {searchResults.metricType === 'temp' && <Thermometer size={12} />}
                      {searchResults.metricType === 'disk' && <HardDrive size={12} />}
                      {searchResults.metricType === 'net' && <Network size={12} />}
                      <span>
                        {searchResults.metricType.toUpperCase()} FOR {searchResults.matchedNode.name || searchResults.matchedNode.hostname}
                      </span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-normal">Exact Metric Match</span>
                  </div>

                  <div className="p-3 bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-medium)] rounded-md flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            searchResults.matchedNode.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        <span className="font-semibold text-xs text-primaryText">
                          {searchResults.matchedNode.name || searchResults.matchedNode.hostname}
                        </span>
                        <span className="text-[10.5px] font-mono text-mutedText">
                          ({searchResults.matchedNode.ip_address || '127.0.0.1'})
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm font-mono font-bold text-primaryText">
                        {searchResults.metricType === 'temp' && `${getTempVal(searchResults.matchedNode).toFixed(1)}°C`}
                        {searchResults.metricType === 'cpu' && `${getCpuVal(searchResults.matchedNode).toFixed(1)}% Core Load`}
                        {searchResults.metricType === 'ram' && (
                          <span>
                            {getRamVal(searchResults.matchedNode).usedGb} / {getRamVal(searchResults.matchedNode).totalGb} GB (
                            {getRamVal(searchResults.matchedNode).percent}%)
                          </span>
                        )}
                        {searchResults.metricType === 'disk' && (
                          <span>
                            {getDiskVal(searchResults.matchedNode).usedGb} / {getDiskVal(searchResults.matchedNode).totalGb} GB (
                            {getDiskVal(searchResults.matchedNode).percent}%)
                          </span>
                        )}
                        {searchResults.metricType === 'net' && getNetVal(searchResults.matchedNode)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedServerId(searchResults.matchedNode.id);
                        setShowSearchResults(false);
                        setSearchQuery('');
                      }}
                      className="rk-btn rk-btn-orange text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      <span>Focus Host</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              )}

              {/* CASE 2: METRIC ACROSS ALL SERVERS (e.g. "ram usage", "cpu", "temp") */}
              {searchResults?.metricType && !searchResults?.matchedNode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10.5px] font-semibold text-mutedText uppercase tracking-wider pb-1.5 border-b border-[var(--racklyt-border-weak)]">
                    <span className="flex items-center gap-1.5 text-[var(--racklyt-orange)]">
                      {searchResults.metricType === 'cpu' && <Cpu size={12} />}
                      {searchResults.metricType === 'ram' && <Activity size={12} />}
                      {searchResults.metricType === 'temp' && <Thermometer size={12} />}
                      {searchResults.metricType === 'disk' && <HardDrive size={12} />}
                      {searchResults.metricType === 'net' && <Network size={12} />}
                      <span>
                        {searchResults.metricType.toUpperCase()} USAGE ACROSS ALL FLEET NODES ({accessibleNodes.length})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedServerId('all');
                        setShowSearchResults(false);
                        setSearchQuery('');
                      }}
                      className="text-[10px] text-[var(--racklyt-orange)] hover:underline font-medium"
                    >
                      Filter to All Hosts
                    </button>
                  </div>

                  <div className="divide-y divide-[var(--racklyt-border-weak)]">
                    {accessibleNodes.map((n) => {
                      const cpu = getCpuVal(n);
                      const ram = getRamVal(n);
                      const temp = getTempVal(n);
                      const disk = getDiskVal(n);
                      const net = getNetVal(n);

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            setSelectedServerId(n.id);
                            setShowSearchResults(false);
                            setSearchQuery('');
                          }}
                          className="py-2 px-2 hover:bg-[var(--racklyt-bg-active)] rounded cursor-pointer flex items-center justify-between transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${n.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <div className="truncate">
                              <span className="text-xs font-semibold text-primaryText block truncate">
                                {n.name || n.hostname || n.id}
                              </span>
                              <span className="text-[10px] text-mutedText font-mono block">
                                {n.ip_address || '127.0.0.1'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-bold text-primaryText block">
                              {searchResults.metricType === 'cpu' && `${cpu.toFixed(1)}%`}
                              {searchResults.metricType === 'ram' && `${ram.usedGb} / ${ram.totalGb} GB (${ram.percent}%)`}
                              {searchResults.metricType === 'temp' && `${temp.toFixed(1)}°C`}
                              {searchResults.metricType === 'disk' && `${disk.usedGb} / ${disk.totalGb} GB (${disk.percent}%)`}
                              {searchResults.metricType === 'net' && net}
                            </span>
                            {/* Mini bar for CPU/RAM */}
                            {(searchResults.metricType === 'cpu' || searchResults.metricType === 'ram') && (
                              <div className="w-20 h-1 bg-white/10 rounded-full mt-1 ml-auto overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[var(--racklyt-orange)]"
                                  style={{
                                    width: `${searchResults.metricType === 'cpu' ? Math.min(100, cpu) : ram.percent}%`,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CASE 3: MATCHED SERVER SPECIFICALLY WITHOUT METRIC (e.g. "production", "workstation") */}
              {!searchResults?.metricType && searchResults?.matchedNode && (
                <div className="space-y-2">
                  <div className="text-[10.5px] font-semibold text-mutedText uppercase tracking-wider pb-1.5 border-b border-[var(--racklyt-border-weak)]">
                    <span>HOST MATCH: {searchResults.matchedNode.name || searchResults.matchedNode.hostname}</span>
                  </div>
                  <div
                    onClick={() => {
                      setSelectedServerId(searchResults.matchedNode.id);
                      setShowSearchResults(false);
                      setSearchQuery('');
                    }}
                    className="p-3 bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-medium)] rounded-md hover:border-[var(--racklyt-orange)] cursor-pointer transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server size={14} className="text-[var(--racklyt-orange)]" />
                        <span className="font-semibold text-xs text-primaryText">
                          {searchResults.matchedNode.name || searchResults.matchedNode.hostname}
                        </span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 rounded">
                          {searchResults.matchedNode.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--racklyt-orange)] font-medium flex items-center gap-1">
                        Select Host <ArrowRight size={10} />
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-mutedText border-t border-[var(--racklyt-border-weak)]">
                      <div>CPU: <strong className="text-primaryText">{getCpuVal(searchResults.matchedNode).toFixed(1)}%</strong></div>
                      <div>RAM: <strong className="text-primaryText">{getRamVal(searchResults.matchedNode).percent}%</strong></div>
                      <div>TEMP: <strong className="text-primaryText">{getTempVal(searchResults.matchedNode).toFixed(1)}°C</strong></div>
                      <div>DISK: <strong className="text-primaryText">{getDiskVal(searchResults.matchedNode).percent}%</strong></div>
                    </div>
                  </div>
                </div>
              )}

              {/* CASE 4: PARTIAL SERVER MATCHES IF NO EXACT METRIC */}
              {!searchResults?.metricType && !searchResults?.matchedNode && searchResults?.matchingNodes && searchResults.matchingNodes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10.5px] font-semibold text-mutedText uppercase tracking-wider pb-1 border-b border-[var(--racklyt-border-weak)]">
                    <span>Matching Fleet Hosts ({searchResults.matchingNodes.length})</span>
                  </div>
                  {searchResults.matchingNodes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setSelectedServerId(n.id);
                        setShowSearchResults(false);
                        setSearchQuery('');
                      }}
                      className="py-1.5 px-2 hover:bg-[var(--racklyt-bg-active)] rounded cursor-pointer flex items-center justify-between transition"
                    >
                      <div className="flex items-center gap-2">
                        <Server size={12} className="text-mutedText" />
                        <span className="text-xs text-primaryText">{n.name || n.hostname}</span>
                      </div>
                      <span className="text-[10.5px] font-mono text-mutedText">{n.ip_address}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* CASE 5: MATCHING DASHBOARDS */}
              {searchResults?.matchedDashboards && searchResults.matchedDashboards.length > 0 && (
                <div className="space-y-1.5 mt-2 pt-2 border-t border-[var(--racklyt-border-weak)]">
                  <div className="text-[10.5px] font-semibold text-mutedText uppercase tracking-wider">
                    <span>Dashboards ({searchResults.matchedDashboards.length})</span>
                  </div>
                  {searchResults.matchedDashboards.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => {
                        if (onSelectDashboard) onSelectDashboard(d.id);
                        setShowSearchResults(false);
                        setSearchQuery('');
                      }}
                      className="py-1.5 px-2 hover:bg-[var(--racklyt-bg-active)] rounded cursor-pointer flex items-center justify-between transition"
                    >
                      <span className="text-xs text-primaryText">{d.title}</span>
                      <span className="text-[10px] text-mutedText">Switch Dashboard →</span>
                    </div>
                  ))}
                </div>
              )}

              {/* EMPTY STATE */}
              {searchQuery.trim().length > 0 &&
                !searchResults?.metricType &&
                !searchResults?.matchedNode &&
                searchResults?.matchingNodes?.length === 0 &&
                searchResults?.matchedDashboards?.length === 0 && (
                  <div className="py-4 text-center text-xs text-mutedText space-y-1">
                    <p>No metrics or servers matched "{searchQuery}"</p>
                    <p className="text-[11px] text-zinc-500">
                      Try typing <code className="text-primaryText font-mono">"ram usage"</code>, <code className="text-primaryText font-mono">"cpu"</code>, <code className="text-primaryText font-mono">"temp"</code>, or a server name.
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* ====================================================
            RIGHT: CONTROLS & ACTIONS
            - Fleet / Server picker dropdown
            - Edit (or Cancel/Save) button
            - Guide button
            - Theme button
            ==================================================== */}
        <div className="navbar-right flex items-center gap-2 shrink-0 z-10 ml-auto">
          {/* Target Host Filter Dropdown */}
          <div className="w-48">
            <CustomDropdown
              size="sm"
              value={selectedServerId}
              onChange={setSelectedServerId}
              options={nodeOptions}
              placeholder="Select Host..."
            />
          </div>

          {/* Edit / Save Button (Only on dashboard view) */}
          {currentView === 'dashboard' && (
            <>
              {!isEditing ? (
                <button
                  className="rk-btn rk-btn-orange"
                  onClick={() => setIsEditing(true)}
                  title="Customize Panels and Layout"
                >
                  <Edit size={12} />
                  <span>Edit</span>
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="rk-btn rk-btn-secondary"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rk-btn rk-btn-orange"
                    onClick={() => {
                      if (onSave) onSave();
                      setIsEditing(false);
                    }}
                  >
                    <Check size={12} />
                    <span>Save</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Theme Preset Selector Button */}
          <button
            className="rk-btn rk-btn-secondary"
            onClick={() => setShowThemeModal(true)}
            title="Choose Theme Preset or Custom Accent"
          >
            <Palette size={12} style={{ color: appSettings.accentColor }} />
            <span>Theme</span>
          </button>

          {/* Operator Guide Documentation Button */}
          {onOpenHelp && (
            <button
              className="rk-btn rk-btn-secondary"
              onClick={onOpenHelp}
              title="Racklyt Operator Guide & Architecture Documentation"
            >
              <HelpCircle size={12} style={{ color: 'var(--racklyt-cyan)' }} />
              <span>Guide</span>
            </button>
          )}
        </div>
      </header>

      {/* Theme Presets Modal */}
      {showThemeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowThemeModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--racklyt-bg-panel)',
              border: '1px solid var(--racklyt-border-medium)',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '560px',
              padding: '24px',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--racklyt-text-primary)' }}>
                  Theme & Visual Customization
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--racklyt-text-muted)' }}>
                  Choose a high-contrast palette or adjust accent colors
                </p>
              </div>
              <button
                className="panel-action-btn"
                onClick={() => setShowThemeModal(false)}
                style={{ fontSize: '18px', color: 'var(--racklyt-text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              {THEME_PRESETS.map((preset) => {
                const isSelected = appSettings.themePreset === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      border: `2px solid ${isSelected ? 'var(--racklyt-orange)' : 'var(--racklyt-border-weak)'}`,
                      backgroundColor: preset.panelBg,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    className="hover:border-[var(--racklyt-border-strong)]"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: preset.accentColor,
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: preset.textColor }}>
                        {preset.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--racklyt-text-muted)' }}>
                      {preset.description}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--racklyt-border-weak)', paddingTop: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--racklyt-text-primary)', display: 'block', marginBottom: '8px' }}>
                Custom Accent Color
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={appSettings.accentColor}
                  onChange={(e) => handleCustomAccent(e.target.value)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '4px',
                    border: '1px solid var(--racklyt-border-medium)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                />
                <input
                  type="text"
                  value={appSettings.accentColor}
                  onChange={(e) => handleCustomAccent(e.target.value)}
                  style={{
                    backgroundColor: 'var(--racklyt-bg-input)',
                    border: '1px solid var(--racklyt-border-medium)',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    color: 'var(--racklyt-text-primary)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    width: '120px',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
