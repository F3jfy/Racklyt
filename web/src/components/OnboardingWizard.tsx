import React, { useState } from 'react';
import {
  LayoutDashboard,
  Server,
  Layers,
  Network,
  Bell,
  Mail,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Check,
  MessageSquare,
  ShieldAlert,
  Thermometer,
  HardDrive,
  Cpu,
  Shield,
  Globe,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { useToast } from '../context/ToastContext';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (pinnedIds?: string[]) => void;
  user?: any;
}

interface DashboardPreset {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  widgets: any[];
}

export const STARTER_DASHBOARD_PRESETS: DashboardPreset[] = [
  {
    id: 'fleet',
    title: 'Fleet Master Cockpit',
    description: '1 for everything: cross-fleet health, multi-host dials, latency matrix, network, docker, logs & alerts.',
    icon: <Server size={20} className="text-[var(--racklyt-orange)]" />,
    badge: 'Recommended',
    widgets: [
      { id: 'w_sysinfo', widget_type: 'sysinfo', title: 'Hardware Specs & OS', grid_x: 0, grid_y: 0, grid_w: 6, grid_h: 3, config: {} },
      { id: 'w_cpu_gauge', widget_type: 'circular-gauge', title: 'CPU Core Load', grid_x: 6, grid_y: 0, grid_w: 2, grid_h: 3, config: { query: 'cpu_overall', unit: '%' } },
      { id: 'w_temp_gauge', widget_type: 'circular-gauge', title: 'Hardware Thermals', grid_x: 8, grid_y: 0, grid_w: 2, grid_h: 3, config: { query: 'rpi_soc_temp', unit: '°C' } },
      { id: 'w_mem_gauge', widget_type: 'circular-gauge', title: 'Memory Usage', grid_x: 10, grid_y: 0, grid_w: 2, grid_h: 3, config: { query: 'memory_percent', unit: '%' } },
      { id: 'w_timeseries', widget_type: 'time-series', title: 'Cluster CPU & RAM History', grid_x: 0, grid_y: 3, grid_w: 12, grid_h: 4, config: { query: 'cpu_overall', unit: '%' } },
    ],
  },
  {
    id: 'server_prod',
    title: 'Server: Production Edge Gateway',
    description: 'Edge reverse proxy, Nginx/Envoy bindings, CDN ingress/egress bandwidth, and SSL certificates.',
    icon: <Globe size={20} className="text-blue-400" />,
    badge: 'Server 1',
    widgets: [
      { id: 'w_prod_specs', widget_type: 'sysinfo', title: 'Edge Gateway Specs', grid_x: 0, grid_y: 0, grid_w: 6, grid_h: 3, config: {} },
      { id: 'w_prod_ports', widget_type: 'ports-table', title: 'Edge HTTP & TLS Sockets', grid_x: 6, grid_y: 0, grid_w: 6, grid_h: 3, config: {} },
      { id: 'w_prod_net', widget_type: 'network-traffic', title: 'Edge Bandwidth Interface', grid_x: 0, grid_y: 3, grid_w: 12, grid_h: 4, config: {} },
    ],
  },
  {
    id: 'server_pve',
    title: 'Server: Proxmox Hypervisor',
    description: 'Hypervisor cluster health, virtual machine allocation, LXC container status, and memory distribution.',
    icon: <Layers size={20} className="text-purple-400" />,
    badge: 'Server 2',
    widgets: [
      { id: 'w_pve_summary', widget_type: 'proxmox-summary', title: 'Proxmox Hypervisors & Nodes', grid_x: 0, grid_y: 0, grid_w: 12, grid_h: 4, config: {} },
      { id: 'w_pve_ts', widget_type: 'time-series', title: 'Hypervisor Workload Timeline', grid_x: 0, grid_y: 4, grid_w: 12, grid_h: 3, config: { query: 'cpu_overall', unit: '%' } },
    ],
  },
  {
    id: 'server_apps',
    title: 'Server: Docker & Apps Fleet',
    description: 'Monitor container status loops, restart events, active daemon services, and process allocations.',
    icon: <Zap size={20} className="text-cyan-400" />,
    badge: 'Server 3',
    widgets: [
      { id: 'w_docker_fleet', widget_type: 'docker-fleet', title: 'Docker Containers Fleet', grid_x: 0, grid_y: 0, grid_w: 12, grid_h: 4, config: {} },
      { id: 'w_docker_logs', widget_type: 'log-stream', title: 'Container Event Logs', grid_x: 0, grid_y: 4, grid_w: 12, grid_h: 3, config: {} },
    ],
  },
  {
    id: 'server_storage',
    title: 'Server: TrueNAS Storage NAS',
    description: 'ZFS storage pool capacity, RAIDZ health, NVMe cache tiers, SMB/NFS shares, and IOPS read/write rates.',
    icon: <HardDrive size={20} className="text-emerald-400" />,
    badge: 'Server 4',
    widgets: [
      { id: 'w_nas_store', widget_type: 'storage-gauge', title: 'ZFS Storage Pools', grid_x: 0, grid_y: 0, grid_w: 8, grid_h: 4, config: {} },
      { id: 'w_nas_ports', widget_type: 'ports-table', title: 'Storage Protocol Sockets', grid_x: 8, grid_y: 0, grid_w: 4, grid_h: 4, config: {} },
    ],
  },
  {
    id: 'thermals',
    title: 'Thermals & Environmental Center',
    description: 'Dedicated temperature center: SoC sensors, CPU package temps, NVMe thermals & ambient watchdogs.',
    icon: <Thermometer size={20} className="text-red-400" />,
    badge: 'Thermals',
    widgets: [
      { id: 'w_hw_soc', widget_type: 'circular-gauge', title: 'SoC Thermal Sensor', grid_x: 0, grid_y: 0, grid_w: 2, grid_h: 3, config: { query: 'rpi_soc_temp', unit: '°C', value: 43.5 } },
      { id: 'w_hw_pkg', widget_type: 'circular-gauge', title: 'CPU Package Die', grid_x: 2, grid_y: 0, grid_w: 2, grid_h: 3, config: { query: 'pkg_temp', unit: '°C', value: 48.2 } },
      { id: 'w_hw_ambient', widget_type: 'circular-gauge', title: 'Ambient Homelab', grid_x: 4, grid_y: 0, grid_w: 2, grid_h: 3, config: { query: 'ambient_temp', unit: '°C', value: 23.5 } },
      { id: 'w_hw_ts', widget_type: 'time-series', title: 'Thermal History Timeline', grid_x: 0, grid_y: 3, grid_w: 12, grid_h: 4, config: { query: 'cpu_overall', unit: '°C' } },
    ],
  },
  {
    id: 'cpu',
    title: 'Processor & Multi-Core Distribution',
    description: 'Per-core workload distribution, DVFS turbo frequencies, and normalized 1m/5m/15m system load averages.',
    icon: <Cpu size={20} className="text-amber-400" />,
    badge: 'Compute',
    widgets: [
      { id: 'w_cpu_cores_full', widget_type: 'cpu-breakdown', title: 'Multi-Core Load', grid_x: 0, grid_y: 0, grid_w: 12, grid_h: 4, config: {} },
    ],
  },
  {
    id: 'network',
    title: 'Network Operations & Sockets',
    description: 'Real-time bandwidth Rx/Tx network rates, network adapter statistics, and open socket listeners.',
    icon: <Network size={20} className="text-emerald-400" />,
    badge: 'Network',
    widgets: [
      { id: 'w_net_traffic', widget_type: 'network-traffic', title: 'Network Bandwidth Rx/Tx', grid_x: 0, grid_y: 0, grid_w: 6, grid_h: 4, config: {} },
      { id: 'w_ports', widget_type: 'ports-table', title: 'Open Ports & Services', grid_x: 6, grid_y: 0, grid_w: 6, grid_h: 4, config: {} },
    ],
  },
  {
    id: 'storage',
    title: 'Storage, Volumes & Filesystems',
    description: 'Storage deep-dive: ZFS & ext4 mount points, NVMe capacity dials, IOPS read/write & volume alerts.',
    icon: <HardDrive size={20} className="text-emerald-400" />,
    badge: 'Storage',
    widgets: [
      { id: 'w_storage_main', widget_type: 'storage-gauge', title: 'Filesystems & Mounts', grid_x: 0, grid_y: 0, grid_w: 12, grid_h: 4, config: {} },
    ],
  },
  {
    id: 'security',
    title: 'Security, Audits & Watchdogs',
    description: 'Listening sockets exposure audit (0.0.0.0 vs Loopback), SSH journals, and dead-man watchdog alerts.',
    icon: <Shield size={20} className="text-purple-400" />,
    badge: 'Audits',
    widgets: [
      { id: 'w_sec_ports', widget_type: 'ports-table', title: 'Listening Sockets Audit', grid_x: 0, grid_y: 0, grid_w: 6, grid_h: 4, config: {} },
      { id: 'w_sec_alerts', widget_type: 'recent-alerts', title: 'Security Incident Alerts', grid_x: 6, grid_y: 0, grid_w: 6, grid_h: 4, config: {} },
    ],
  },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
  user,
}) => {
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Dashboards Choice
  const [selectedDashboardPresetIds, setSelectedDashboardPresetIds] = useState<string[]>(['fleet']);
  const [isNoneDashboardsSelected, setIsNoneDashboardsSelected] = useState<boolean>(false);

  // Step 2: Notifications Choice
  const [notificationChannel, setNotificationChannel] = useState<'in_app' | 'discord' | 'email' | 'none'>('in_app');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [notificationEmail, setNotificationEmail] = useState(user?.email || '');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleTogglePreset = (id: string) => {
    if (isNoneDashboardsSelected) {
      setIsNoneDashboardsSelected(false);
      setSelectedDashboardPresetIds([id]);
      return;
    }

    if (selectedDashboardPresetIds.includes(id)) {
      const next = selectedDashboardPresetIds.filter((p) => p !== id);
      setSelectedDashboardPresetIds(next);
      if (next.length === 0) {
        setIsNoneDashboardsSelected(true);
      }
    } else {
      setSelectedDashboardPresetIds([...selectedDashboardPresetIds, id]);
    }
  };

  const handleSelectNoneDashboards = () => {
    setIsNoneDashboardsSelected(true);
    setSelectedDashboardPresetIds([]);
  };

  const handleFinishSetup = async () => {
    setIsSubmitting(true);
    try {
      const createdDashboardIds: string[] = [];

      // 1. Create selected dashboards or custom blank dashboard
      if (isNoneDashboardsSelected || selectedDashboardPresetIds.length === 0) {
        // User wants to start from scratch and make them themselves
        const blankDash = await ApiClient.createDashboard({
          title: 'My Custom Dashboard',
          description: 'Custom blank dashboard created by operator',
          is_public: false,
          widgets: [],
        });
        createdDashboardIds.push(blankDash.id);
      } else {
        // Create each selected starter dashboard
        for (const presetId of selectedDashboardPresetIds) {
          const preset = STARTER_DASHBOARD_PRESETS.find((p) => p.id === presetId);
          if (preset) {
            const created = await ApiClient.createDashboard({
              title: preset.title,
              description: preset.description,
              is_public: false,
              widgets: preset.widgets,
            });
            createdDashboardIds.push(created.id);
          }
        }
      }

      // 2. Save Notification Preferences
      if (notificationChannel === 'discord' && discordWebhookUrl.trim()) {
        await ApiClient.updateSystemSettings({
          discord_webhook: discordWebhookUrl.trim(),
        }).catch(() => {});
      }

      // 3. Complete system setup if not done yet
      await ApiClient.completeSetup({
        instance_name: 'Racklyt',
        monitoring_focus: 'homelab',
      }).catch(() => {});

      // 4. Mark user as onboarded in localStorage
      if (user?.id) {
        localStorage.setItem(`racklyt_onboarded_${user.id}`, 'true');
      }
      localStorage.setItem('racklyt_first_login_completed', 'true');

      toast.success('Welcome to Racklyt! Workspace configured successfully.');
      onComplete(createdDashboardIds);
    } catch (err: any) {
      console.error('Failed finishing onboarding:', err);
      toast.error('Could not complete setup automatically. Proceeding to dashboard.');
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div
        className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded-xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp"
        style={{ boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-header)] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--racklyt-orange)]/15 border border-[var(--racklyt-orange)]/30 flex items-center justify-center text-[var(--racklyt-orange)] font-mono font-bold text-base shadow-sm">
              R
            </div>
            <div>
              <h2 className="text-sm font-bold text-primaryText flex items-center gap-2">
                <span>Welcome to Racklyt</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--racklyt-orange)]/20 text-[var(--racklyt-orange)] font-semibold">
                  Step {currentStep} of 3
                </span>
              </h2>
              <p className="text-[11px] text-mutedText">
                {currentStep === 1 && 'Choose starter dashboards for your workspace'}
                {currentStep === 2 && 'Set where you would like notifications delivered'}
                {currentStep === 3 && 'Ready to launch your operations hub'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${currentStep >= 1 ? 'bg-[var(--racklyt-orange)]' : 'bg-white/10'}`} />
            <div className={`w-2.5 h-2.5 rounded-full ${currentStep >= 2 ? 'bg-[var(--racklyt-orange)]' : 'bg-white/10'}`} />
            <div className={`w-2.5 h-2.5 rounded-full ${currentStep >= 3 ? 'bg-[var(--racklyt-orange)]' : 'bg-white/10'}`} />
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* ============================================================
              STEP 1: CHOOSE DASHBOARDS OR NONE
              ============================================================ */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-primaryText flex items-center gap-2">
                  <LayoutDashboard size={16} className="text-[var(--racklyt-orange)]" />
                  <span>What dashboards do you want to add?</span>
                </h3>
                <p className="text-xs text-mutedText mt-0.5">
                  Pick any pre-configured starter dashboards you'd like pinned in your left sidebar, or choose none so you can build them yourself from scratch.
                </p>
              </div>

              {/* Option: None / Make them yourself */}
              <div
                onClick={handleSelectNoneDashboards}
                className={`p-3.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                  isNoneDashboardsSelected
                    ? 'bg-[var(--racklyt-orange)]/10 border-[var(--racklyt-orange)] ring-1 ring-[var(--racklyt-orange)]'
                    : 'bg-[var(--racklyt-bg-subtle)] border-[var(--racklyt-border-medium)] hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isNoneDashboardsSelected ? 'bg-[var(--racklyt-orange)] text-black' : 'bg-white/5 text-mutedText'
                  }`}>
                    0
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-primaryText">None — I want to make them myself</h4>
                    <p className="text-[11px] text-mutedText">
                      Start with a clean blank canvas. You will design and add custom telemetry panels yourself.
                    </p>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded flex items-center justify-center border transition ${
                  isNoneDashboardsSelected
                    ? 'bg-[var(--racklyt-orange)] border-[var(--racklyt-orange)] text-black'
                    : 'border-zinc-600 bg-black/20'
                }`}>
                  {isNoneDashboardsSelected && <Check size={12} strokeWidth={3} />}
                </div>
              </div>

              {/* Preset Cards List */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold text-mutedText uppercase tracking-wider flex items-center justify-between">
                  <span>Pre-configured Starter Dashboards</span>
                  {!isNoneDashboardsSelected && (
                    <span className="text-[var(--racklyt-orange)] lowercase font-mono">
                      {selectedDashboardPresetIds.length} selected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STARTER_DASHBOARD_PRESETS.map((preset) => {
                    const isSelected = !isNoneDashboardsSelected && selectedDashboardPresetIds.includes(preset.id);
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleTogglePreset(preset.id)}
                        className={`p-3.5 rounded-lg border cursor-pointer transition space-y-2 flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[var(--racklyt-bg-active)] border-[var(--racklyt-orange)] shadow-md'
                            : 'bg-[var(--racklyt-bg-subtle)] border-[var(--racklyt-border-weak)] hover:border-[var(--racklyt-border-medium)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-2.5">
                            <div className="p-1.5 rounded bg-white/5 border border-white/10 shrink-0">
                              {preset.icon}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-primaryText">{preset.title}</h4>
                              <span className="text-[9.5px] font-mono text-[var(--racklyt-orange)] bg-[var(--racklyt-orange)]/10 px-1.5 py-0.5 rounded">
                                {preset.badge}
                              </span>
                            </div>
                          </div>

                          <div className={`w-4 h-4 rounded flex items-center justify-center border transition shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-[var(--racklyt-orange)] border-[var(--racklyt-orange)] text-black'
                              : 'border-zinc-600 bg-black/20'
                          }`}>
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                        </div>

                        <p className="text-[11px] text-mutedText leading-relaxed">
                          {preset.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              STEP 2: NOTIFICATION CHANNELS
              ============================================================ */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-primaryText flex items-center gap-2">
                  <Bell size={16} className="text-[var(--racklyt-orange)]" />
                  <span>Where do you want to receive notifications?</span>
                </h3>
                <p className="text-xs text-mutedText mt-0.5">
                  Select your notification destination for hardware warnings, offline node alerts, and metric spikes.
                </p>
              </div>

              <div className="space-y-3">
                {/* 1. In-App */}
                <div
                  onClick={() => setNotificationChannel('in_app')}
                  className={`p-3.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                    notificationChannel === 'in_app'
                      ? 'bg-[var(--racklyt-orange)]/10 border-[var(--racklyt-orange)] ring-1 ring-[var(--racklyt-orange)]'
                      : 'bg-[var(--racklyt-bg-subtle)] border-[var(--racklyt-border-weak)] hover:border-[var(--racklyt-border-medium)]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded bg-amber-500/10 text-amber-400">
                      <Bell size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-primaryText">In-App Live Alert Center (Default)</h4>
                      <p className="text-[11px] text-mutedText">
                        Live slide-out alert drawer and notification badge inside the topbar and sidebar.
                      </p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    notificationChannel === 'in_app' ? 'border-[var(--racklyt-orange)] bg-[var(--racklyt-orange)] text-black' : 'border-zinc-600'
                  }`}>
                    {notificationChannel === 'in_app' && <Check size={10} strokeWidth={3} />}
                  </div>
                </div>

                {/* 2. Discord Webhook */}
                <div
                  onClick={() => setNotificationChannel('discord')}
                  className={`p-3.5 rounded-lg border cursor-pointer transition space-y-3 ${
                    notificationChannel === 'discord'
                      ? 'bg-[var(--racklyt-orange)]/10 border-[var(--racklyt-orange)] ring-1 ring-[var(--racklyt-orange)]'
                      : 'bg-[var(--racklyt-bg-subtle)] border-[var(--racklyt-border-weak)] hover:border-[var(--racklyt-border-medium)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded bg-indigo-500/10 text-indigo-400">
                        <MessageSquare size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-primaryText">Discord Webhook Channel</h4>
                        <p className="text-[11px] text-mutedText">
                          Instant message alerts pushed directly to your Discord operations channel.
                        </p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      notificationChannel === 'discord' ? 'border-[var(--racklyt-orange)] bg-[var(--racklyt-orange)] text-black' : 'border-zinc-600'
                    }`}>
                      {notificationChannel === 'discord' && <Check size={10} strokeWidth={3} />}
                    </div>
                  </div>

                  {notificationChannel === 'discord' && (
                    <div className="pt-2 border-t border-[var(--racklyt-border-weak)] space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[11px] font-semibold text-primaryText">Discord Webhook URL</label>
                      <input
                        type="url"
                        placeholder="https://discord.com/api/webhooks/..."
                        value={discordWebhookUrl}
                        onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                        className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded px-3 py-1.5 text-xs text-primaryText font-mono focus:border-[var(--racklyt-orange)] outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Email (SMTP) */}
                <div
                  onClick={() => setNotificationChannel('email')}
                  className={`p-3.5 rounded-lg border cursor-pointer transition space-y-3 ${
                    notificationChannel === 'email'
                      ? 'bg-[var(--racklyt-orange)]/10 border-[var(--racklyt-orange)] ring-1 ring-[var(--racklyt-orange)]'
                      : 'bg-[var(--racklyt-bg-subtle)] border-[var(--racklyt-border-weak)] hover:border-[var(--racklyt-border-medium)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded bg-blue-500/10 text-blue-400">
                        <Mail size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-primaryText">Email / SMTP Notifications</h4>
                        <p className="text-[11px] text-mutedText">
                          High-priority outage and node status digests delivered to your inbox.
                        </p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      notificationChannel === 'email' ? 'border-[var(--racklyt-orange)] bg-[var(--racklyt-orange)] text-black' : 'border-zinc-600'
                    }`}>
                      {notificationChannel === 'email' && <Check size={10} strokeWidth={3} />}
                    </div>
                  </div>

                  {notificationChannel === 'email' && (
                    <div className="pt-2 border-t border-[var(--racklyt-border-weak)] space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[11px] font-semibold text-primaryText">Destination Email Address</label>
                      <input
                        type="email"
                        placeholder="admin@yourdomain.com"
                        value={notificationEmail}
                        onChange={(e) => setNotificationEmail(e.target.value)}
                        className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded px-3 py-1.5 text-xs text-primaryText font-mono focus:border-[var(--racklyt-orange)] outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* 4. None / Silent */}
                <div
                  onClick={() => setNotificationChannel('none')}
                  className={`p-3.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                    notificationChannel === 'none'
                      ? 'bg-[var(--racklyt-orange)]/10 border-[var(--racklyt-orange)] ring-1 ring-[var(--racklyt-orange)]'
                      : 'bg-[var(--racklyt-bg-subtle)] border-[var(--racklyt-border-weak)] hover:border-[var(--racklyt-border-medium)]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded bg-zinc-500/10 text-zinc-400">
                      <ShieldAlert size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-primaryText">None / Skip for Now</h4>
                      <p className="text-[11px] text-mutedText">
                        Notifications will be disabled until you configure them in Settings.
                      </p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    notificationChannel === 'none' ? 'border-[var(--racklyt-orange)] bg-[var(--racklyt-orange)] text-black' : 'border-zinc-600'
                  }`}>
                    {notificationChannel === 'none' && <Check size={10} strokeWidth={3} />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              STEP 3: CONFIRMATION & LAUNCH
              ============================================================ */}
          {currentStep === 3 && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-full bg-[var(--racklyt-orange)]/15 border border-[var(--racklyt-orange)]/30 mx-auto flex items-center justify-center text-[var(--racklyt-orange)] shadow-lg">
                <Sparkles size={28} />
              </div>

              <div>
                <h3 className="text-base font-bold text-primaryText">Workspace Configuration Ready</h3>
                <p className="text-xs text-mutedText max-w-md mx-auto mt-1">
                  Your customized monitoring hub is prepared with your chosen dashboard pins and notification channels.
                </p>
              </div>

              <div className="p-4 bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] rounded-lg text-left text-xs space-y-2.5 max-w-md mx-auto">
                <div className="flex items-center justify-between">
                  <span className="text-mutedText">Pinned Dashboards:</span>
                  <span className="font-semibold text-primaryText">
                    {isNoneDashboardsSelected
                      ? 'Blank Canvas (Make them myself)'
                      : `${selectedDashboardPresetIds.length} starter dashboard${selectedDashboardPresetIds.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-mutedText">Notification Channel:</span>
                  <span className="font-semibold text-[var(--racklyt-orange)] uppercase text-[11px]">
                    {notificationChannel.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-mutedText">Sidebar Configuration:</span>
                  <span className="font-mono text-emerald-400 text-[11px]">Pins Only + Settings + Account</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="px-6 py-4 border-t border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-header)] flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="px-3.5 py-1.5 rounded bg-white/5 hover:bg-white/10 text-primaryText text-xs font-medium transition flex items-center space-x-1.5"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-mutedText hover:text-white text-xs transition"
              >
                Skip Setup
              </button>
            )}
          </div>

          <div>
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                className="px-4 py-1.5 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black text-xs font-bold rounded transition shadow flex items-center space-x-1.5"
              >
                <span>Continue</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinishSetup}
                className="px-5 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] disabled:opacity-50 text-black text-xs font-bold rounded transition shadow-lg flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <span>Preparing Workspace...</span>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Launch Racklyt</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
