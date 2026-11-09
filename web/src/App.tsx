import React, { useState, useRef, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { ManageDashboardsModal } from './components/ManageDashboardsModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { HelpDocsModal } from './components/HelpDocsModal';
import { EnrollNodeModal } from './components/EnrollNodeModal';
import { Login } from './views/Login';
import {
  Dashboard,
  DEFAULT_COMPLEX_WIDGETS,
  DEFAULT_PROXMOX_WIDGETS,
  DEFAULT_NETWORK_WIDGETS,
  DEFAULT_DOCKER_WIDGETS,
  DEFAULT_HARDWARE_WIDGETS,
  DEFAULT_SERVER_PROD_WIDGETS,
  DEFAULT_SERVER_STORAGE_WIDGETS,
  DEFAULT_CPU_WIDGETS,
  DEFAULT_STORAGE_WIDGETS,
  DEFAULT_SECURITY_WIDGETS,
} from './views/Dashboard';
import { Nodes } from './views/Nodes';
import { ProxmoxView } from './views/ProxmoxView';
import { UsersAdmin } from './views/UsersAdmin';
import { Settings } from './views/Settings';
import { ToastProvider } from './context/ToastContext';
import { CommandPalette } from './components/CommandPalette';
import { ActivityFeedDrawer } from './components/ActivityFeedDrawer';
import { NodeDeepDiveModal } from './components/NodeDeepDiveModal';
import { ApiClient } from './api/client';
import { Node, DashboardConfig } from './types';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const { appSettings, setAppSettings } = useTheme();

  const [currentView, setCurrentView] = useState<'dashboard' | 'nodes' | 'proxmox' | 'users' | 'settings'>('dashboard');
  const [isEditingDashboard, setIsEditingDashboard] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string>('all');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState<number>(0);

  // Global Node Deep Dive Modal State
  const [deepDiveNodeId, setDeepDiveNodeId] = useState<string | null>(null);
  const [deepDiveNodeName, setDeepDiveNodeName] = useState<string | undefined>(undefined);

  // Dashboards management state
  const [dashboardsList, setDashboardsList] = useState<DashboardConfig[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string>(() => {
    const act = localStorage.getItem('racklyt_active_dashboard_id');
    const legacyMap: Record<string, string> = {
      dash_proxmox: 'dash_server_pve',
      dash_docker: 'dash_server_apps',
      dash_hardware: 'dash_thermals',
    };
    if (act && legacyMap[act]) return legacyMap[act];
    if (act && (act.startsWith('dash_c46') || act.startsWith('dash_f2c') || act.startsWith('dash_3da') || act.startsWith('dash_808'))) return 'dash_default';
    return act || 'dash_default';
  });
  const [pinnedDashboardIds, setPinnedDashboardIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('racklyt_pinned_dashboards');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const legacyMap: Record<string, string> = {
            dash_proxmox: 'dash_server_pve',
            dash_docker: 'dash_server_apps',
            dash_hardware: 'dash_thermals',
          };
          const cleaned = parsed
            .map((id) => legacyMap[id] || id)
            .filter((id) => !id.startsWith('dash_c46') && !id.startsWith('dash_f2c') && !id.startsWith('dash_3da') && !id.startsWith('dash_808'));
          if (cleaned.length > 0) return Array.from(new Set(cleaned));
        }
      }
    } catch {}
    return ['dash_default', 'dash_server_prod', 'dash_server_pve', 'dash_server_apps'];
  });
  const [showDashboardManager, setShowDashboardManager] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showHelpDocs, setShowHelpDocs] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);

  const saveDashboardRef = useRef<(() => void) | null>(null);

  // Refresh dashboards list
  const refreshDashboards = async () => {
    if (!user) return;
    try {
      const list = await ApiClient.getDashboards();
      setDashboardsList(list);
    } catch (e) {
      console.error('Failed to load dashboards', e);
    }
  };

  // Toggle dashboard pinned to left dock
  const handleTogglePin = (id: string) => {
    setPinnedDashboardIds((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((item) => item !== id);
      } else {
        next = [...prev, id];
      }
      localStorage.setItem('racklyt_pinned_dashboards', JSON.stringify(next));
      return next;
    });
  };

  // Switch active dashboard
  const handleSelectDashboard = (id: string) => {
    setActiveDashboardId(id);
    localStorage.setItem('racklyt_active_dashboard_id', id);
  };

  // Create new dashboard
  const handleCreateDashboard = async (title: string, description: string, template: string) => {
    let widgetsToSeed: any[] = [];
    if (template === 'proxmox') {
      widgetsToSeed = DEFAULT_PROXMOX_WIDGETS;
    } else if (template === 'network') {
      widgetsToSeed = DEFAULT_NETWORK_WIDGETS;
    } else if (template === 'docker') {
      widgetsToSeed = DEFAULT_DOCKER_WIDGETS;
    } else if (template === 'hardware' || template === 'thermals') {
      widgetsToSeed = DEFAULT_HARDWARE_WIDGETS;
    } else if (template === 'server_prod') {
      widgetsToSeed = DEFAULT_SERVER_PROD_WIDGETS;
    } else if (template === 'server_storage') {
      widgetsToSeed = DEFAULT_SERVER_STORAGE_WIDGETS;
    } else if (template === 'cpu') {
      widgetsToSeed = DEFAULT_CPU_WIDGETS;
    } else if (template === 'storage') {
      widgetsToSeed = DEFAULT_STORAGE_WIDGETS;
    } else if (template === 'security') {
      widgetsToSeed = DEFAULT_SECURITY_WIDGETS;
    } else if (template === 'blank') {
      widgetsToSeed = [];
    } else {
      widgetsToSeed = DEFAULT_COMPLEX_WIDGETS;
    }
    const newDash = await ApiClient.createDashboard({
      title,
      description,
      is_public: false,
      widgets: widgetsToSeed.map((w, idx) => ({
        ...w,
        id: `w_${Date.now()}_${idx}`,
      })),
    });
    await refreshDashboards();
    handleSelectDashboard(newDash.id);
  };

  // Delete custom dashboard
  const handleDeleteDashboard = async (id: string) => {
    await ApiClient.deleteDashboard(id);
    await refreshDashboards();
    if (activeDashboardId === id) {
      handleSelectDashboard('dash_default');
    }
    setPinnedDashboardIds((prev) => {
      const next = prev.filter((p) => p !== id);
      localStorage.setItem('racklyt_pinned_dashboards', JSON.stringify(next));
      return next;
    });
  };

  // Poll nodes and notifications count
  const refreshFleetData = async () => {
    if (!user) return;
    try {
      const [nodesList, unreadRes] = await Promise.allSettled([
        ApiClient.getNodes(),
        ApiClient.getUnreadCount(),
      ]);

      if (nodesList.status === 'fulfilled') {
        const list = nodesList.value;
        setNodes(list);
      }
      if (unreadRes.status === 'fulfilled') {
        setUnreadAlertsCount(unreadRes.value.unread_count || 0);
      }
    } catch (e) {
      // Quiet fail on network retry
    }
  };

  useEffect(() => {
    if (user) {
      // Check first-launch setup state and user-specific onboarding
      const userOnboardedKey = `racklyt_onboarded_${user.id}`;
      const isUserOnboarded = localStorage.getItem(userOnboardedKey) === 'true';

      ApiClient.getSetupStatus()
        .then((res) => {
          if (!res.is_setup_completed || !isUserOnboarded) {
            setShowOnboarding(true);
          }
        })
        .catch(() => {
          if (!isUserOnboarded) {
            setShowOnboarding(true);
          }
        });

      refreshFleetData();
      refreshDashboards();

      const intervalSetting = appSettings.defaultRefreshInterval;
      let intervalMs: number | null = 2000;
      if (intervalSetting === '1s') intervalMs = 1000;
      else if (intervalSetting === '2s') intervalMs = 2000;
      else if (intervalSetting === '5s') intervalMs = 5000;
      else if (intervalSetting === '10s') intervalMs = 10000;
      else if (intervalSetting === 'off') intervalMs = null;

      if (intervalMs !== null) {
        const interval = setInterval(refreshFleetData, intervalMs);
        return () => clearInterval(interval);
      }
    }
  }, [user, appSettings.defaultRefreshInterval]);

  // Global Command Palette shortcut (⌘+Shift+P / Ctrl+Shift+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global Node Deep Dive opener event
  useEffect(() => {
    const handleOpenDeepDive = (e: any) => {
      if (e.detail?.nodeId) {
        setDeepDiveNodeId(e.detail.nodeId);
        setDeepDiveNodeName(e.detail.nodeName);
      }
    };
    window.addEventListener('racklyt_open_node_deepdive', handleOpenDeepDive);
    return () => window.removeEventListener('racklyt_open_node_deepdive', handleOpenDeepDive);
  }, []);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-[var(--racklyt-bg-canvas)] flex items-center justify-center text-xs font-mono text-mutedText">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[var(--racklyt-orange)] animate-ping" />
          <span>Connecting to Racklyt Hub...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const pinnedDashboards = pinnedDashboardIds
    .map((id) => dashboardsList.find((d) => d.id === id))
    .filter((d): d is DashboardConfig => d !== undefined);

  return (
    <div className="racklyt-app-container">
      {/* 1. Left Slim 54px Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        unreadAlertsCount={unreadAlertsCount}
        pinnedDashboards={pinnedDashboards}
        activeDashboardId={activeDashboardId}
        onSelectDashboard={(id) => {
          handleSelectDashboard(id);
          setCurrentView('dashboard');
        }}
        onOpenDashboardManager={() => setShowDashboardManager(true)}
        onOpenHelp={() => setShowHelpDocs(true)}
        onOpenActivityDrawer={() => setShowActivityDrawer(true)}
        onOpenEnrollNode={() => setShowEnrollModal(true)}
      />

      {/* 2. Main Viewport */}
      <main className="racklyt-main-viewport">
        {/* Top Navbar */}
        <TopNavbar
          user={user}
          currentView={currentView}
          isEditing={isEditingDashboard}
          setIsEditing={setIsEditingDashboard}
          onSave={() => {
            if (saveDashboardRef.current) {
              saveDashboardRef.current();
            }
          }}
          nodes={nodes}
          selectedServerId={selectedServerId}
          setSelectedServerId={setSelectedServerId}
          appSettings={appSettings}
          setAppSettings={setAppSettings}
          dashboardsList={dashboardsList}
          activeDashboardId={activeDashboardId}
          pinnedDashboardIds={pinnedDashboardIds}
          onSelectDashboard={handleSelectDashboard}
          onTogglePin={handleTogglePin}
          onOpenDashboardManager={() => setShowDashboardManager(true)}
          onOpenHelp={() => setShowHelpDocs(true)}
          onOpenEnrollNode={() => setShowEnrollModal(true)}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
        />

        {/* Content View */}
        <div className="flex-1 w-full overflow-y-auto">
          {currentView === 'dashboard' && (
            <Dashboard
              isEditing={isEditingDashboard}
              onRegisterSave={(saveFn) => {
                saveDashboardRef.current = saveFn;
              }}
              activeDashboardId={activeDashboardId}
              refreshInterval={appSettings.defaultRefreshInterval}
            />
          )}

          {currentView === 'nodes' && <Nodes />}

          {currentView === 'proxmox' && (
            <ProxmoxView
              nodes={nodes}
              selectedNodeId={selectedServerId !== 'all' ? selectedServerId : undefined}
            />
          )}

          {currentView === 'users' && <UsersAdmin />}

          {currentView === 'settings' && (
            <Settings
              user={user}
              appSettings={appSettings}
              setAppSettings={setAppSettings}
              onOpenOnboarding={() => setShowOnboarding(true)}
              onOpenHelp={() => setShowHelpDocs(true)}
            />
          )}
        </div>

        {/* Dashboard Management Modal */}
        <ManageDashboardsModal
          isOpen={showDashboardManager}
          onClose={() => setShowDashboardManager(false)}
          dashboards={dashboardsList}
          activeDashboardId={activeDashboardId}
          pinnedDashboardIds={pinnedDashboardIds}
          onSelectDashboard={(id) => {
            handleSelectDashboard(id);
            setCurrentView('dashboard');
            setShowDashboardManager(false);
          }}
          onTogglePin={handleTogglePin}
          onCreateDashboard={handleCreateDashboard}
          onDeleteDashboard={handleDeleteDashboard}
        />

        {/* First-Launch Onboarding Wizard */}
        <OnboardingWizard
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onComplete={async (pinnedIds?: string[]) => {
            setShowOnboarding(false);
            if (pinnedIds && pinnedIds.length > 0) {
              setPinnedDashboardIds(pinnedIds);
              localStorage.setItem('racklyt_pinned_dashboards', JSON.stringify(pinnedIds));
              handleSelectDashboard(pinnedIds[0]);
            }
            await refreshFleetData();
            await refreshDashboards();
          }}
          user={user}
        />

        {/* Agent Node Enrollment Modal */}
        <EnrollNodeModal
          isOpen={showEnrollModal}
          onClose={() => setShowEnrollModal(false)}
          onNodeAdded={() => {
            refreshFleetData();
          }}
        />

        {/* Operator Documentation & "How It Works" Guide */}
        <HelpDocsModal
          isOpen={showHelpDocs}
          onClose={() => setShowHelpDocs(false)}
        />

        {/* Global Command Palette (⌘K) */}
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNavigate={(view) => {
            setCurrentView(view);
            setShowCommandPalette(false);
          }}
          dashboards={dashboardsList}
          nodes={nodes}
          onSelectDashboard={(id) => {
            handleSelectDashboard(id);
            setCurrentView('dashboard');
            setShowCommandPalette(false);
          }}
          onOpenHelp={() => {
            setShowHelpDocs(true);
            setShowCommandPalette(false);
          }}
          onOpenEnrollNode={() => {
            setShowEnrollModal(true);
            setShowCommandPalette(false);
          }}
          onOpenOnboarding={() => {
            setShowOnboarding(true);
            setShowCommandPalette(false);
          }}
          onOpenThemeModal={() => {
            setShowCommandPalette(false);
          }}
        />

        {/* Activity Feed & Telemetry Alerts Drawer */}
        <ActivityFeedDrawer
          isOpen={showActivityDrawer}
          onClose={() => setShowActivityDrawer(false)}
          onRefreshCount={refreshFleetData}
        />

        {/* Global Node Deep Dive Diagnostics & Live Process/Service Manager */}
        <NodeDeepDiveModal
          isOpen={!!deepDiveNodeId}
          nodeId={deepDiveNodeId}
          nodeName={deepDiveNodeName}
          onClose={() => setDeepDiveNodeId(null)}
        />

        {/* Status Footer */}
        <footer className="border-t border-[var(--racklyt-border-weak)] py-1.5 px-5 flex items-center justify-between text-[11px] text-mutedText font-mono bg-[var(--racklyt-bg-canvas)]">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Racklyt Telemetry Hub • Multi-Node & Raspberry Pi Edition</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Tunnel: Cloudflared Active</span>
            <span>
              Fleet:{' '}
              <strong className="text-primaryText font-semibold">
                {nodes.filter((n) => n.status === 'online').length}/{nodes.length}
              </strong>{' '}
              Nodes Active
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <MainApp />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
