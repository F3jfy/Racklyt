import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Mail,
  Server,
  Globe,
  HardDrive,
  Copy,
  Check,
  Send,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Terminal,
  Lock,
  Sparkles,
  BookOpen,
  Smartphone,
  ShieldCheck,
  X,
  Plus,
  Bell,
} from 'lucide-react';
import QRCode from 'qrcode';
import { ApiClient } from '../api/client';
import { SmtpConfig, AlertRule } from '../types';
import { useToast } from '../context/ToastContext';
import { CustomDropdown } from '../components/common/CustomDropdown';
import { AppSettings } from '../utils/theme';

interface SettingsProps {
  user?: any;
  onOpenOnboarding?: () => void;
  onOpenHelp?: () => void;
  appSettings?: AppSettings;
  setAppSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? 'bg-[var(--racklyt-orange)]' : 'bg-[#2b303c]'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-4' : 'translate-x-0'
      }`}
    />
  </button>
);

const CodeTerminalBlock: React.FC<{
  title: string;
  command: string;
  onCopy: () => void;
  isCopied: boolean;
}> = ({ title, command, onCopy, isCopied }) => (
  <div className="rounded-lg overflow-hidden border border-[#272b38] bg-[#0c0d12] shadow-lg">
    <div className="flex items-center justify-between px-3.5 py-2 bg-[#14161f] border-b border-[#222530]">
      <div className="flex items-center space-x-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/80 inline-block" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/80 inline-block" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]/80 inline-block" />
        <span className="ml-2 text-[10.5px] font-mono text-[#8b93a4]">{title}</span>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="flex items-center space-x-1.5 text-[11px] font-medium text-[#8b93a4] hover:text-white px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] transition cursor-pointer"
      >
        {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        <span>{isCopied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
    <div className="p-3.5 font-mono text-xs text-[#f0f2f5] overflow-x-auto selection:bg-[#f97316]/30 leading-relaxed whitespace-pre-wrap">
      {command}
    </div>
  </div>
);

export const Settings: React.FC<SettingsProps> = ({
  user,
  onOpenOnboarding,
  onOpenHelp,
  appSettings,
  setAppSettings,
}) => {
  const toast = useToast();
  const isAdmin = !user || user.role_id === 'role_superadmin' || user.role_id === 'role_admin' || user.permissions?.includes('*');

  const [activeTab, setActiveTab] = useState<
    'general' | 'security' | 'alerts' | 'agents' | 'cloudflare' | 'storage'
  >(isAdmin ? 'general' : 'alerts');

  // Dropdown options
  const pushIntervalOptions = [
    { value: '5', label: 'Every 5 Seconds', badge: 'Realtime', description: 'Ultra high-resolution telemetry' },
    { value: '10', label: 'Every 10 Seconds', badge: 'Recommended', description: 'Production baseline' },
    { value: '30', label: 'Every 30 Seconds', badge: 'IoT', description: 'Low power & battery savings' },
    { value: '60', label: 'Every 60 Seconds', badge: 'Minimal', description: 'Bandwidth restricted' },
  ];

  const retentionOptions = [
    { value: '7', label: '7 Days', badge: 'SD Card', description: 'For 16GB-32GB micro-SD cards' },
    { value: '14', label: '14 Days' },
    { value: '30', label: '30 Days', badge: 'Default', description: 'Recommended for NVMe / SSDs' },
    { value: '90', label: '90 Days', description: 'Long-term capacity planning' },
    { value: '365', label: '365 Days', badge: 'Full Year', description: 'Full yearly compliance audit' },
  ];

  const timeFormatOptions = [
    { value: '24h', label: '24-hour International', description: '14:30:00' },
    { value: '12h', label: '12-hour AM/PM', description: '02:30:00 PM' },
    { value: 'utc', label: 'UTC Standard', description: '12:30:00Z' },
  ];

  const sessionTimeoutOptions = [
    { value: '15', label: '15 Minutes', badge: 'High Security' },
    { value: '30', label: '30 Minutes' },
    { value: '60', label: '1 Hour', badge: 'Standard' },
    { value: '480', label: '8 Hours', badge: 'Full Shift' },
    { value: '1440', label: '24 Hours', badge: 'Kiosk Mode' },
  ];

  const rateLimitOptions = [
    { value: '60', label: '60 Requests / Minute', badge: 'Default' },
    { value: '120', label: '120 Requests / Minute' },
    { value: '300', label: '300 Requests / Minute' },
    { value: '0', label: 'Unlimited', badge: 'Internal Only' },
  ];

  const tlsOptions = [
    { value: 'starttls', label: 'STARTTLS (Port 587)', badge: 'Standard' },
    { value: 'tls', label: 'Direct TLS/SSL (Port 465)', badge: 'Encrypted' },
    { value: 'none', label: 'Plain Insecure (Port 25)', badge: 'Dev Only' },
  ];

  const uiRefreshOptions = [
    { value: '1s', label: '1s (High Frequency)', badge: 'Live' },
    { value: '2s', label: '2s (Recommended)', badge: 'Default' },
    { value: '5s', label: '5s (Balanced)', badge: 'Eco' },
    { value: '10s', label: '10s (Low Network)', badge: 'Light' },
    { value: 'off', label: 'Paused / Manual Refresh', badge: 'Off' },
  ];

  // General Settings
  const [instanceName, setInstanceName] = useState('Racklyt');
  const [fleetDomain, setFleetDomain] = useState('homelab.lan');
  const [scrapeInterval, setScrapeInterval] = useState('10');
  const [retentionDays, setRetentionDays] = useState('30');
  const [timeFormat, setTimeFormat] = useState('24h');
  const [uiRefreshInterval, setUiRefreshInterval] = useState('2s');

  // Security Settings
  const [sessionTimeout, setSessionTimeout] = useState('60');
  const [allowPublicDashboards, setAllowPublicDashboards] = useState(false);
  const [enforce2FA, setEnforce2FA] = useState(false);
  const [rateLimitPerMin, setRateLimitPerMin] = useState('60');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Personal Account 2FA State
  const [user2faEnabled, setUser2faEnabled] = useState(false);
  const [show2faSetupModal, setShow2faSetupModal] = useState(false);
  const [setupSecret, setSetupSecret] = useState('');
  const [setupQrUrl, setSetupQrUrl] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [disabling2fa, setDisabling2fa] = useState(false);
  const [copied2faSecret, setCopied2faSecret] = useState(false);

  // Alerts - SMTP
  const [smtp, setSmtp] = useState<SmtpConfig>({
    host: 'smtp.sendgrid.net',
    port: 587,
    username: 'apikey',
    from_address: 'Racklyt Alerts <alerts@racklyt.local>',
    tls_mode: 'starttls',
    is_enabled: true,
  });
  const [smtpPassword, setSmtpPassword] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Alerts - Webhooks
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [discordBotName, setDiscordBotName] = useState('Racklyt Alert Bot');
  const [discordStatus, setDiscordStatus] = useState<string | null>(null);
  const [discordLoading, setDiscordLoading] = useState(false);

  // Thresholds
  const [cpuThreshold, setCpuThreshold] = useState('85');
  const [memThreshold, setMemThreshold] = useState('90');
  const [diskThreshold, setDiskThreshold] = useState('90');
  const [tempThreshold, setTempThreshold] = useState('75');
  const [heartbeatTimeout, setHeartbeatTimeout] = useState('30');

  // Dynamic Alert Rules
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleMetric, setNewRuleMetric] = useState<'cpu' | 'memory' | 'temp' | 'disk'>('cpu');
  const [newRuleOp, setNewRuleOp] = useState<'>' | '>=' | '<' | '<='>('>');
  const [newRuleThreshold, setNewRuleThreshold] = useState<number>(90);
  const [newRuleDuration, setNewRuleDuration] = useState<number>(180);
  const [newRuleSeverity, setNewRuleSeverity] = useState<'warning' | 'critical' | 'info'>('warning');
  const [newRuleChannel, setNewRuleChannel] = useState<string>('all');

  const fetchAlertRules = async () => {
    try {
      setRulesLoading(true);
      const list = await ApiClient.getAlertRules();
      setAlertRules(list);
    } catch (e) {
      console.error('Failed to load alert rules', e);
    } finally {
      setRulesLoading(false);
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    try {
      await ApiClient.toggleAlertRule(ruleId);
      await fetchAlertRules();
      toast.success('Alert rule status toggled');
    } catch {
      toast.error('Failed to update alert rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;
    try {
      await ApiClient.deleteAlertRule(ruleId);
      await fetchAlertRules();
      toast.success('Alert rule deleted');
    } catch {
      toast.error('Failed to delete alert rule');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) {
      toast.error('Please provide a rule name');
      return;
    }
    try {
      await ApiClient.createAlertRule({
        name: newRuleName.trim(),
        metric: newRuleMetric,
        operator: newRuleOp,
        threshold: Number(newRuleThreshold),
        duration_seconds: Number(newRuleDuration),
        severity: newRuleSeverity,
        channel: newRuleChannel,
      });
      await fetchAlertRules();
      setShowNewRuleModal(false);
      setNewRuleName('');
      toast.success('Alert rule created successfully');
    } catch {
      toast.error('Failed to create alert rule');
    }
  };

  // Database Maintenance
  const [dbStats, setDbStats] = useState<{
    db_size_bytes: number;
    wal_size_bytes: number;
    metrics_count: number;
    nodes_count: number;
    alerts_count: number;
    dashboards_count: number;
  } | null>(null);
  const [vacuumLoading, setVacuumLoading] = useState(false);
  const [vacuumMessage, setVacuumMessage] = useState<string | null>(null);

  // UI state
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const hubOrigin = window.location.origin;

  // Load settings and stats
  const fetchAllSettings = async () => {
    try {
      const [sysSettings, smtpConfig, stats] = await Promise.allSettled([
        ApiClient.getSystemSettings(),
        ApiClient.getSmtp(),
        ApiClient.getDatabaseStats(),
      ]);

      if (sysSettings.status === 'fulfilled') {
        const s = sysSettings.value;
        if (s.instance_name) setInstanceName(s.instance_name);
        if (s.fleet_domain) setFleetDomain(s.fleet_domain);
        if (s.scrape_interval_secs) setScrapeInterval(s.scrape_interval_secs);
        if (s.retention_days) setRetentionDays(s.retention_days);
        if (s.session_timeout_mins) setSessionTimeout(s.session_timeout_mins);
        if (s.allow_public_dashboards) setAllowPublicDashboards(s.allow_public_dashboards === 'true');
        if (s.enforce_2fa) setEnforce2FA(s.enforce_2fa === 'true');
        if (s.rate_limit_per_min) setRateLimitPerMin(s.rate_limit_per_min);
        if (s.discord_webhook) setDiscordWebhook(s.discord_webhook);
        if (s.alert_cpu_threshold) setCpuThreshold(s.alert_cpu_threshold);
        if (s.alert_temp_threshold) setTempThreshold(s.alert_temp_threshold);
        if (s.alert_disk_threshold) setDiskThreshold(s.alert_disk_threshold);
        if (s.alert_heartbeat_timeout) setHeartbeatTimeout(s.alert_heartbeat_timeout);
      }

      if (smtpConfig.status === 'fulfilled') {
        setSmtp(smtpConfig.value);
      }

      if (stats.status === 'fulfilled') {
        setDbStats(stats.value);
      }

      try {
        const twoFa = await ApiClient.get2FAStatus();
        setUser2faEnabled(twoFa.enabled);
      } catch (err) {
        console.warn('Could not fetch 2FA status:', err);
      }

      await fetchAlertRules();
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  useEffect(() => {
    fetchAllSettings();
    if (appSettings?.defaultRefreshInterval) {
      setUiRefreshInterval(appSettings.defaultRefreshInterval);
    } else {
      try {
        const savedRaw = localStorage.getItem('homelab_app_settings');
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (parsed.defaultRefreshInterval) {
            setUiRefreshInterval(parsed.defaultRefreshInterval);
          }
        }
      } catch (e) {}
    }
  }, [appSettings?.defaultRefreshInterval]);

  const handleStart2FASetup = async () => {
    setSetupError('');
    setSetupLoading(true);
    setSetupCode('');
    try {
      const res = await ApiClient.setup2FA();
      setSetupSecret(res.totp_secret);
      const qrUrl = await QRCode.toDataURL(res.otpauth_uri, {
        width: 170,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setSetupQrUrl(qrUrl);
      setShow2faSetupModal(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed initiating 2FA setup');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleConfirm2FAActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    setSetupLoading(true);
    try {
      await ApiClient.enable2FA({ code: setupCode });
      setUser2faEnabled(true);
      setShow2faSetupModal(false);
      toast.success('Two-Phase Authentication is now enabled for your account!');
    } catch (err: any) {
      setSetupError(err.message || 'Invalid code. Please check your authenticator app.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!window.confirm('Are you sure you want to disable Two-Phase Authentication for your account?')) {
      return;
    }
    setDisabling2fa(true);
    try {
      await ApiClient.disable2FA();
      setUser2faEnabled(false);
      toast.success('Two-Phase Authentication disabled.');
    } catch (err: any) {
      toast.error(err.message || 'Failed disabling 2FA');
    } finally {
      setDisabling2fa(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    try {
      await ApiClient.updateSystemSettings({
        instance_name: instanceName,
        fleet_domain: fleetDomain,
        scrape_interval_secs: scrapeInterval,
        retention_days: retentionDays,
        time_format: timeFormat,
      });

      // Persist UI refresh interval to AppSettings in localStorage & React state
      try {
        const savedRaw = localStorage.getItem('homelab_app_settings');
        const parsed = savedRaw ? JSON.parse(savedRaw) : {};
        const updated = {
          ...parsed,
          defaultRefreshInterval: uiRefreshInterval,
        };
        localStorage.setItem('homelab_app_settings', JSON.stringify(updated));
        if (setAppSettings) {
          setAppSettings((prev: any) => ({
            ...prev,
            defaultRefreshInterval: uiRefreshInterval,
          }));
        }
      } catch (storageErr) {
        console.warn('Could not persist UI refresh interval to localStorage:', storageErr);
      }

      setSaveStatus('General & fleet configuration updated successfully.');
      toast.success('General & fleet configuration saved');
    } catch {
      setSaveStatus('Failed to update general settings.');
      toast.error('Failed to update general settings');
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);

    if (newPassword) {
      if (newPassword !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    try {
      await ApiClient.updateSystemSettings({
        session_timeout_mins: sessionTimeout,
        allow_public_dashboards: String(allowPublicDashboards),
        enforce_2fa: String(enforce2FA),
        rate_limit_per_min: rateLimitPerMin,
      });

      if (newPassword) {
        await ApiClient.completeSetup({ admin_password: newPassword });
        setNewPassword('');
        setConfirmPassword('');
      }

      setSaveStatus('Security and access control settings updated.');
      toast.success('Security & access policies updated');
    } catch {
      setSaveStatus('Failed to update security settings.');
      toast.error('Failed to update security settings');
    }
  };

  const handleSaveAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    try {
      await Promise.all([
        ApiClient.updateSmtp({
          ...smtp,
          password: smtpPassword || undefined,
        }),
        ApiClient.updateSystemSettings({
          discord_webhook: discordWebhook,
          alert_cpu_threshold: cpuThreshold,
          alert_temp_threshold: tempThreshold,
          alert_disk_threshold: diskThreshold,
          alert_heartbeat_timeout: heartbeatTimeout,
        }),
      ]);
      setSaveStatus('Alert channels & watchdog thresholds saved.');
      toast.success('Watchdogs & alert notification channels saved');
    } catch {
      setSaveStatus('Failed to save alert configuration.');
      toast.error('Failed to save alert configuration');
    }
  };

  const handleSendTestSmtp = async () => {
    if (!testRecipient) {
      toast.error('Please specify an email address for test dispatch');
      return;
    }
    setTestLoading(true);
    setTestStatus(null);
    try {
      const res = await ApiClient.testSmtp(testRecipient);
      setTestStatus(res.message);
      toast.success(res.message);
    } catch (err: any) {
      setTestStatus(`Error: ${err.message}`);
      toast.error(`SMTP error: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const handleSendTestDiscord = async () => {
    if (!discordWebhook) {
      toast.error('Please enter a Discord Webhook URL');
      return;
    }
    setDiscordLoading(true);
    setDiscordStatus(null);
    try {
      const res = await ApiClient.testDiscord(discordWebhook, discordBotName);
      setDiscordStatus(res.message);
      toast.success(res.message);
    } catch (err: any) {
      setDiscordStatus(`Discord error: ${err.message}`);
      toast.error(`Discord error: ${err.message}`);
    } finally {
      setDiscordLoading(false);
    }
  };

  const handleRunVacuum = async () => {
    setVacuumLoading(true);
    setVacuumMessage(null);
    try {
      const res = await ApiClient.vacuumDatabase();
      setVacuumMessage(res.message);
      toast.success('Database vacuumed and WAL checkpoints cleared');
      // Refresh stats
      const stats = await ApiClient.getDatabaseStats();
      setDbStats(stats);
    } catch (e: any) {
      setVacuumMessage(`Vacuum failed: ${e.message}`);
      toast.error(`Vacuum failed: ${e.message}`);
    } finally {
      setVacuumLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full px-6 py-5 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primaryText tracking-tight flex items-center space-x-2">
            <SettingsIcon className="w-5 h-5 text-[var(--racklyt-orange)]" />
            <span>Racklyt Hub Operations & System Settings</span>
          </h2>
          <p className="text-xs text-mutedText mt-0.5">
            Configure instance branding, watchdogs, alert webhooks, deployment tokens, and SQLite storage
          </p>
        </div>

        {saveStatus && (
          <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-xs flex items-center space-x-1.5 animate-fadeIn">
            <CheckCircle size={14} />
            <span>{saveStatus}</span>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center space-x-1 border-b border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-subtle)] p-1 rounded-lg text-xs overflow-x-auto">
        {(isAdmin
          ? [
              { id: 'general', label: 'General & Fleet', icon: <Server size={14} /> },
              { id: 'security', label: 'Security & Access', icon: <Shield size={14} /> },
              { id: 'alerts', label: 'Alerts & Watchdogs', icon: <Mail size={14} /> },
              { id: 'agents', label: 'Agent Deployment', icon: <Terminal size={14} /> },
              { id: 'cloudflare', label: 'Cloudflare Ingress', icon: <Globe size={14} /> },
              { id: 'storage', label: 'Storage & DB Maintenance', icon: <HardDrive size={14} /> },
            ]
          : [
              { id: 'alerts', label: 'My Alerts & Watchdogs', icon: <Mail size={14} /> },
              { id: 'security', label: 'Security & 2-Phase Login', icon: <Shield size={14} /> },
            ]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id as any);
              setSaveStatus(null);
            }}
            className={`px-3.5 py-2 rounded flex items-center space-x-2 transition font-medium whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-[var(--racklyt-bg-active)] text-primaryText font-semibold border border-[var(--racklyt-border-medium)] shadow-sm'
                : 'text-mutedText hover:text-primaryText hover:bg-[var(--racklyt-bg-panel)]'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ============================================================
          TAB 1: GENERAL & FLEET
          ============================================================ */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          {/* Operator Quick Tools */}
          <div className="bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded bg-[var(--racklyt-orange)]/10 text-[var(--racklyt-orange)]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-primaryText">Operator Onboarding & Documentation</h4>
                <p className="text-[11px] text-mutedText">
                  Need to reconfigure nodes, learn the push protocol, or explore Proxmox setups?
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {onOpenOnboarding && (
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="px-3 py-1.5 bg-[var(--racklyt-bg-panel)] hover:bg-[var(--racklyt-bg-active)] border border-[var(--racklyt-border-medium)] text-primaryText text-xs font-medium rounded transition flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--racklyt-orange)]" />
                  <span>Launch Wizard</span>
                </button>
              )}
              {onOpenHelp && (
                <button
                  type="button"
                  onClick={onOpenHelp}
                  className="px-3 py-1.5 bg-[var(--racklyt-bg-panel)] hover:bg-[var(--racklyt-bg-active)] border border-[var(--racklyt-border-medium)] text-primaryText text-xs font-medium rounded transition flex items-center space-x-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                  <span>Open Manual</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg p-6 shadow-sm space-y-6">
            <div className="border-b border-[var(--racklyt-border-weak)] pb-3">
              <h3 className="text-sm font-bold text-primaryText">Instance Identity & Fleet Defaults</h3>
              <p className="text-xs text-mutedText">
                Primary naming, subnet domain parameters, and data retention windows
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Instance Name */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primaryText flex items-center justify-between">
                  <span>Company / Organization Name</span>
                  <span className="text-[10px] text-mutedText font-normal">Login Screen & Alerts</span>
                </label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText focus:border-[var(--racklyt-orange)] outline-none"
                />
                <p className="text-[11px] text-mutedText">
                  <strong>How it works:</strong> The custom organization label displayed on the login portal, navigation headers, and system alerts.
                </p>
              </div>

              {/* Fleet Domain */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primaryText flex items-center justify-between">
                  <span>Fleet Cluster Domain</span>
                  <span className="text-[10px] text-mutedText font-mono">DNS Suffix</span>
                </label>
                <input
                  type="text"
                  value={fleetDomain}
                  onChange={(e) => setFleetDomain(e.target.value)}
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono focus:border-[var(--racklyt-orange)] outline-none"
                />
                <p className="text-[11px] text-mutedText">
                  <strong>How it works:</strong> Appended to newly enrolled node hostnames (e.g. <code className="text-primaryText font-mono">rpi-node.{fleetDomain}</code>) for local reverse DNS lookups.
                </p>
              </div>

              {/* Scrape Interval */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primaryText flex items-center justify-between">
                  <span>Agent Push Frequency</span>
                  <span className="text-[10px] text-mutedText font-normal">Push Interval</span>
                </label>
                <CustomDropdown
                  value={scrapeInterval}
                  onChange={setScrapeInterval}
                  options={pushIntervalOptions}
                />
                <p className="text-[11px] text-mutedText">
                  <strong>How it works:</strong> Configures how often the Rust agent reads kernel stats and pushes JSON packets to the Hub.
                </p>
              </div>

              {/* Dashboard Refresh Interval */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primaryText flex items-center justify-between">
                  <span>Dashboard Refresh Rate</span>
                  <span className="text-[10px] text-mutedText font-normal">Admin UI Polling</span>
                </label>
                <CustomDropdown
                  value={uiRefreshInterval}
                  onChange={setUiRefreshInterval}
                  options={uiRefreshOptions}
                />
                <p className="text-[11px] text-mutedText">
                  <strong>How it works:</strong> Global telemetry polling interval configured by administrator. Sets browser update frequency across all live panels.
                </p>
              </div>

              {/* Retention Policy */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primaryText flex items-center justify-between">
                  <span>Telemetry Retention Window</span>
                  <span className="text-[10px] text-mutedText font-normal">Automatic Compaction</span>
                </label>
                <CustomDropdown
                  value={retentionDays}
                  onChange={setRetentionDays}
                  options={retentionOptions}
                />
                <p className="text-[11px] text-mutedText">
                  <strong>How it works:</strong> The Hub background pruner runs every 10 minutes and automatically deletes raw records older than this window.
                </p>
              </div>

              {/* Time Format */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primaryText flex items-center justify-between">
                  <span>Timestamp Display Format</span>
                  <span className="text-[10px] text-mutedText font-normal">Clock Mode</span>
                </label>
                <CustomDropdown
                  value={timeFormat}
                  onChange={setTimeFormat}
                  options={timeFormatOptions}
                />
                <p className="text-[11px] text-mutedText">
                  <strong>How it works:</strong> Configures how time series chart tooltips and audit log timestamps are formatted.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--racklyt-border-weak)] flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold text-xs rounded transition shadow"
              >
                Save General Configuration
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ============================================================
          TAB 2: SECURITY & ACCESS
          ============================================================ */}
      {activeTab === 'security' && (
        <form onSubmit={handleSaveSecurity} className="space-y-6">
          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg p-6 shadow-sm space-y-6">
            <div className="border-b border-[var(--racklyt-border-weak)] pb-3">
              <h3 className="text-sm font-bold text-primaryText">Security, Authentication & Session Policies</h3>
              <p className="text-xs text-mutedText">
                Argon2id password hashing, session revocation, and API ingress rate limiting
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Session Inactivity Timeout */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primaryText">Session Idle Inactivity Timeout</label>
                <CustomDropdown
                  value={sessionTimeout}
                  onChange={setSessionTimeout}
                  options={sessionTimeoutOptions}
                />
                <p className="text-[11px] text-mutedText">
                  <strong>How it works:</strong> Automatically invalidates JWT session tokens if no user interaction occurs within this time frame.
                </p>
              </div>

              {/* Rate Limiting */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primaryText">Ingress API Rate Limiting</label>
                <CustomDropdown
                  value={rateLimitPerMin}
                  onChange={setRateLimitPerMin}
                  options={rateLimitOptions}
                />
                <p className="text-[11px] text-mutedText">
                  <strong>How it works:</strong> Prevents brute force login attempts on <code className="text-primaryText font-mono">/auth/login</code> and shields the SQLite backend from traffic surges.
                </p>
              </div>

              {/* Public Dashboards Toggle */}
              <div className="p-4 rounded-lg bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] flex items-center justify-between">
                <div className="pr-4">
                  <div className="font-semibold text-primaryText">Public Dashboard Mode</div>
                  <p className="text-[11px] text-mutedText mt-0.5">
                    Allow wall monitors and LAN visitors to view dashboards tagged as public without authenticating.
                  </p>
                </div>
                <ToggleSwitch
                  checked={allowPublicDashboards}
                  onChange={setAllowPublicDashboards}
                />
              </div>

              {/* 2FA Enforcement */}
              <div className="p-4 rounded-lg bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] flex items-center justify-between">
                <div className="pr-4">
                  <div className="font-semibold text-primaryText">Enforce Two-Factor Authentication (TOTP)</div>
                  <p className="text-[11px] text-mutedText mt-0.5">
                    Require SuperAdmin and Operator accounts to verify an authenticator 6-digit TOTP code on login.
                  </p>
                </div>
                <ToggleSwitch
                  checked={enforce2FA}
                  onChange={setEnforce2FA}
                />
              </div>
            </div>

            {/* Change Admin Password */}
            {isAdmin ? (
              <div className="border-t border-[var(--racklyt-border-weak)] pt-5 space-y-4 text-xs">
                <div className="flex items-center space-x-2 text-sm font-semibold text-primaryText">
                  <Lock size={15} className="text-[var(--racklyt-orange)]" />
                  <span>Reset Administrator Root Password</span>
                </div>
                <p className="text-mutedText">
                  Updates the SuperAdmin account credentials using hardware-salted Argon2id cryptographic hashing.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-mutedText mb-1 font-medium">New Master Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText focus:border-[var(--racklyt-orange)] outline-none"
                      placeholder="Leave blank to keep current password"
                    />
                  </div>
                  <div>
                    <label className="block text-mutedText mb-1 font-medium">Confirm New Master Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText focus:border-[var(--racklyt-orange)] outline-none"
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t border-[var(--racklyt-border-weak)] pt-5 space-y-3 text-xs">
                <div className="flex items-center space-x-2 text-sm font-semibold text-primaryText">
                  <Lock size={15} className="text-[var(--racklyt-orange)]" />
                  <span>Account Security & Provisioned Credentials</span>
                </div>
                <div className="p-3.5 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] flex items-start space-x-3">
                  <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 mt-0.5">
                    <Shield size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-primaryText">Cryptographic Password Lock Active</div>
                    <p className="text-mutedText text-[11px] mt-0.5">
                      Your account was provisioned with a secured password by the Hub Administrator. In compliance with security policy, user passwords cannot be altered. To reset your access, please contact your cluster administrator.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Account Personal 2FA Setting */}
            <div className="border-t border-[var(--racklyt-border-weak)] pt-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Smartphone size={16} className="text-[var(--racklyt-orange)]" />
                  <span className="text-sm font-semibold text-primaryText">Two-Phase Authentication (TOTP)</span>
                </div>
                {user2faEnabled ? (
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                    <CheckCircle size={12} />
                    <span>Active & Protected</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                    Disabled
                  </span>
                )}
              </div>

              <div className="p-4 rounded-lg bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-semibold text-primaryText">
                    {user2faEnabled
                      ? 'Your account is secured with a mobile authenticator app'
                      : 'Enable Two-Phase Authentication on this account'}
                  </div>
                  <p className="text-[11px] text-mutedText">
                    {user2faEnabled
                      ? 'A 6-digit TOTP code generated by Google Authenticator, Authy, or 1Password is required on every login.'
                      : 'Disabled by default. Click Enable to set up your authenticator app and protect your sign-ins with a 6-digit code.'}
                  </p>
                </div>

                <div className="shrink-0">
                  {user2faEnabled ? (
                    <button
                      type="button"
                      onClick={handleDisable2FA}
                      disabled={disabling2fa}
                      className="px-4 py-2 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 rounded font-semibold text-xs transition"
                    >
                      {disabling2fa ? 'Disabling...' : 'Disable 2-Phase Login'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStart2FASetup}
                      disabled={setupLoading}
                      className="px-4 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold text-xs rounded transition shadow flex items-center space-x-1.5"
                    >
                      <ShieldCheck size={14} />
                      <span>{setupLoading ? 'Preparing...' : 'Enable 2-Phase Login'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--racklyt-border-weak)] flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold text-xs rounded transition shadow"
              >
                Save Security Settings
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ============================================================
          TAB 3: ALERTS & WATCHDOGS
          ============================================================ */}
      {activeTab === 'alerts' && (
        <form onSubmit={handleSaveAlerts} className="space-y-6">
          {/* SMTP Email */}
          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg p-6 shadow-sm space-y-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--racklyt-border-weak)]">
              <div>
                <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                  <Mail size={16} className="text-[var(--racklyt-orange)]" />
                  <span>Outgoing Email (SMTP) Dispatch</span>
                </h3>
                <p className="text-[11px] text-mutedText">
                  Delivers formatted emergency emails when node heartbeats or hardware thermals cross thresholds
                </p>
              </div>
              <div className="flex items-center space-x-2.5">
                <span className="font-semibold text-primaryText text-xs">Enable SMTP</span>
                <ToggleSwitch
                  checked={smtp.is_enabled}
                  onChange={(checked) => setSmtp({ ...smtp, is_enabled: checked })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-mutedText mb-1">SMTP Host Server *</label>
                <input
                  type="text"
                  value={smtp.host}
                  onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono outline-none"
                  placeholder="smtp.example.com"
                />
              </div>
              <div>
                <label className="block text-mutedText mb-1">Port *</label>
                <input
                  type="number"
                  value={smtp.port}
                  onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value) || 587 })}
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-mutedText mb-1">Username / API Key</label>
                <input
                  type="text"
                  value={smtp.username || ''}
                  onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-mutedText mb-1">Password / Secret</label>
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText outline-none"
                  placeholder="••••••••••••"
                />
              </div>
              <div>
                <label className="block text-mutedText mb-1">From Sender Address *</label>
                <input
                  type="text"
                  value={smtp.from_address}
                  onChange={(e) => setSmtp({ ...smtp, from_address: e.target.value })}
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-mutedText mb-1">TLS Encryption Mode</label>
                <CustomDropdown
                  value={smtp.tls_mode}
                  onChange={(v) => setSmtp({ ...smtp, tls_mode: v })}
                  options={tlsOptions}
                />
              </div>
            </div>

            {/* Test Email */}
            <div className="pt-3 border-t border-[var(--racklyt-border-weak)] space-y-2">
              <label className="block text-mutedText font-semibold">Send Verification Test Email:</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="admin@example.com"
                  className="flex-1 bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendTestSmtp}
                  disabled={testLoading}
                  className="px-4 py-2 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded font-semibold text-primaryText transition flex items-center space-x-1.5"
                >
                  <Send size={13} />
                  <span>{testLoading ? 'Sending...' : 'Send Test'}</span>
                </button>
              </div>
              {testStatus && (
                <p className="text-[11px] font-mono text-[var(--racklyt-orange)] mt-1">{testStatus}</p>
              )}
            </div>
          </div>

          {/* Discord Webhook */}
          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg p-6 shadow-sm space-y-4 text-xs">
            <div className="border-b border-[var(--racklyt-border-weak)] pb-3">
              <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                <Globe size={16} className="text-[#5865F2]" />
                <span>Discord Webhook Notification Channel</span>
              </h3>
              <p className="text-[11px] text-mutedText">
                Posts live embeds to your Discord homelab channel whenever a node misses heartbeats or throttles
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-mutedText">Discord Webhook URL</label>
                <input
                  type="url"
                  value={discordWebhook}
                  onChange={(e) => setDiscordWebhook(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-mutedText">Bot Display Name</label>
                <input
                  type="text"
                  value={discordBotName}
                  onChange={(e) => setDiscordBotName(e.target.value)}
                  placeholder="Racklyt Monitoring"
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <button
                type="button"
                onClick={handleSendTestDiscord}
                disabled={discordLoading}
                className="px-4 py-2 bg-[#5865F2]/20 hover:bg-[#5865F2]/30 border border-[#5865F2]/50 text-white font-semibold rounded transition flex items-center space-x-1.5"
              >
                <Send size={13} />
                <span>{discordLoading ? 'Dispatching ping...' : 'Send Test Discord Alert'}</span>
              </button>
              {discordStatus && (
                <span className="text-[11px] font-mono text-[#5865F2]">{discordStatus}</span>
              )}
            </div>
          </div>

          {/* Threshold Watchdogs */}
          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg p-6 shadow-sm space-y-4 text-xs">
            <div className="border-b border-[var(--racklyt-border-weak)] pb-3">
              <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                <AlertTriangle size={16} className="text-[var(--racklyt-yellow)]" />
                <span>Automated Watchdog Threshold Triggers</span>
              </h3>
              <p className="text-[11px] text-mutedText">
                Defines the exact criteria that trigger warnings and critical notifications
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-[var(--racklyt-bg-subtle)] rounded border border-[var(--racklyt-border-weak)] space-y-2">
                <div className="font-semibold text-primaryText flex items-center justify-between">
                  <span>CPU Usage Alert</span>
                  <span className="font-mono text-[var(--racklyt-orange)] font-bold">{cpuThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="98"
                  value={cpuThreshold}
                  onChange={(e) => setCpuThreshold(e.target.value)}
                  className="w-full"
                />
                <p className="text-[10.5px] text-mutedText">Triggers warning if sustained over 3 intervals</p>
              </div>

              <div className="p-3 bg-[var(--racklyt-bg-subtle)] rounded border border-[var(--racklyt-border-weak)] space-y-2">
                <div className="font-semibold text-primaryText flex items-center justify-between">
                  <span>RAM Usage Alert</span>
                  <span className="font-mono text-cyan-400 font-bold">{memThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="98"
                  value={memThreshold}
                  onChange={(e) => setMemThreshold(e.target.value)}
                  className="w-full"
                />
                <p className="text-[10.5px] text-mutedText">Memory saturation exhaustion watchdog</p>
              </div>

              <div className="p-3 bg-[var(--racklyt-bg-subtle)] rounded border border-[var(--racklyt-border-weak)] space-y-2">
                <div className="font-semibold text-primaryText flex items-center justify-between">
                  <span>Thermal Watchdog</span>
                  <span className="font-mono text-[var(--racklyt-red)] font-bold">{tempThreshold}°C</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="90"
                  value={tempThreshold}
                  onChange={(e) => setTempThreshold(e.target.value)}
                  className="w-full"
                />
                <p className="text-[10.5px] text-mutedText">SoC thermal throttle watchdog limit</p>
              </div>

              <div className="p-3 bg-[var(--racklyt-bg-subtle)] rounded border border-[var(--racklyt-border-weak)] space-y-2">
                <div className="font-semibold text-primaryText flex items-center justify-between">
                  <span>Dead-Man Timeout</span>
                  <span className="font-mono text-emerald-400 font-bold">{heartbeatTimeout}s</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="5"
                  value={heartbeatTimeout}
                  onChange={(e) => setHeartbeatTimeout(e.target.value)}
                  className="w-full"
                />
                <p className="text-[10.5px] text-mutedText">Marks node offline and emits alert</p>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--racklyt-border-weak)] flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold text-xs rounded transition shadow"
              >
                Save Alerts & Watchdogs Configuration
              </button>
            </div>
          </div>

          {/* Dynamic Alert Rules Engine */}
          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg p-6 shadow-sm space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--racklyt-border-weak)]">
              <div>
                <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                  <Bell size={16} className="text-[var(--racklyt-orange)]" />
                  <span>Fleet Alert Rules & Duration Windows</span>
                </h3>
                <p className="text-[11px] text-mutedText">
                  Configurable threshold rules evaluated every 5 seconds. Rules require sustained breach duration to eliminate spike fatigue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewRuleModal(true)}
                className="px-3 py-1.5 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold rounded text-xs transition flex items-center space-x-1.5 shadow"
              >
                <Plus size={13} />
                <span>Add Alert Rule</span>
              </button>
            </div>

            {rulesLoading ? (
              <div className="p-6 text-center text-mutedText">Loading active alert rules...</div>
            ) : alertRules.length === 0 ? (
              <div className="p-6 text-center text-mutedText border border-dashed border-[var(--racklyt-border-weak)] rounded-lg">
                No custom alert rules configured. Click "Add Alert Rule" to define custom threshold triggers.
              </div>
            ) : (
              <div className="space-y-2">
                {alertRules.map((rule) => {
                  const metricLabel =
                    rule.metric === 'cpu'
                      ? 'CPU Utilization'
                      : rule.metric === 'memory'
                      ? 'Memory Usage'
                      : rule.metric === 'temp'
                      ? 'SoC Temperature'
                      : rule.metric === 'disk'
                      ? 'Storage Fill'
                      : rule.metric;
                  const unit = rule.metric === 'temp' ? '°C' : '%';

                  return (
                    <div
                      key={rule.id}
                      className="p-3.5 rounded-lg bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-primaryText text-xs">{rule.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              rule.severity === 'critical'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : rule.severity === 'warning'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            }`}
                          >
                            {rule.severity}
                          </span>
                          {!rule.is_enabled && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 font-medium">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-mutedText flex items-center space-x-3">
                          <span className="font-mono text-primaryText">
                            {metricLabel} {rule.operator} {rule.threshold}{unit}
                          </span>
                          <span>•</span>
                          <span>Duration: {rule.duration_seconds}s</span>
                          <span>•</span>
                          <span>Channel: {rule.channel.toUpperCase()}</span>
                          <span>•</span>
                          <span>Target: {rule.target_node_id || 'All Nodes'}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] text-mutedText font-medium">
                            {rule.is_enabled ? 'Active' : 'Muted'}
                          </span>
                          <ToggleSwitch
                            checked={rule.is_enabled}
                            onChange={() => handleToggleRule(rule.id)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded hover:bg-rose-500/10 text-rose-400 border border-transparent hover:border-rose-500/30 transition cursor-pointer"
                          title="Delete rule"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* New Rule Modal */}
          {showNewRuleModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
              <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded-lg w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--racklyt-bg-header)] border-b border-[var(--racklyt-border-weak)]">
                  <div className="flex items-center space-x-2">
                    <Bell size={16} className="text-[var(--racklyt-orange)]" />
                    <h3 className="font-bold text-primaryText text-sm">Create New Alert Rule</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewRuleModal(false)}
                    className="p-1 rounded text-mutedText hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div>
                    <label className="block text-mutedText mb-1 font-medium">Rule Name *</label>
                    <input
                      type="text"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder="e.g. Cluster Ingress Bandwidth Saturation"
                      className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-mutedText mb-1 font-medium">Telemetry Metric</label>
                      <select
                        value={newRuleMetric}
                        onChange={(e) => setNewRuleMetric(e.target.value as any)}
                        className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText outline-none"
                      >
                        <option value="cpu">CPU Usage (%)</option>
                        <option value="memory">RAM Saturation (%)</option>
                        <option value="temp">SoC / Package Temp (°C)</option>
                        <option value="disk">Storage Pool Fill (%)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-mutedText mb-1 font-medium">Condition Operator</label>
                      <select
                        value={newRuleOp}
                        onChange={(e) => setNewRuleOp(e.target.value as any)}
                        className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText outline-none font-mono"
                      >
                        <option value=">">Greater than (&gt;)</option>
                        <option value=">=">Greater or equal (&gt;=)</option>
                        <option value="<">Less than (&lt;)</option>
                        <option value="<=">Less or equal (&lt;=)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-mutedText mb-1 font-medium">
                        Threshold Value ({newRuleMetric === 'temp' ? '°C' : '%'})
                      </label>
                      <input
                        type="number"
                        value={newRuleThreshold}
                        onChange={(e) => setNewRuleThreshold(Number(e.target.value))}
                        className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-mutedText mb-1 font-medium">Duration Window</label>
                      <select
                        value={newRuleDuration}
                        onChange={(e) => setNewRuleDuration(Number(e.target.value))}
                        className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText outline-none"
                      >
                        <option value="30">Sustained 30 Seconds</option>
                        <option value="60">Sustained 1 Minute</option>
                        <option value="120">Sustained 2 Minutes</option>
                        <option value="180">Sustained 3 Minutes</option>
                        <option value="300">Sustained 5 Minutes</option>
                        <option value="600">Sustained 10 Minutes</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-mutedText mb-1 font-medium">Severity</label>
                      <select
                        value={newRuleSeverity}
                        onChange={(e) => setNewRuleSeverity(e.target.value as any)}
                        className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText outline-none"
                      >
                        <option value="warning">Warning (Amber)</option>
                        <option value="critical">Critical (Red)</option>
                        <option value="info">Informational (Blue)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-mutedText mb-1 font-medium">Dispatch Channel</label>
                      <select
                        value={newRuleChannel}
                        onChange={(e) => setNewRuleChannel(e.target.value)}
                        className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText outline-none"
                      >
                        <option value="all">All Channels (Discord, Email & App)</option>
                        <option value="discord">Discord Webhook Only</option>
                        <option value="email">SMTP Email Only</option>
                        <option value="inbox">In-App Dashboard Inbox Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[var(--racklyt-border-weak)] flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowNewRuleModal(false)}
                      className="px-4 py-2 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded font-semibold text-primaryText transition text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateRule}
                      className="px-5 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold rounded transition text-xs shadow"
                    >
                      Create Alert Rule
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      )}

      {/* ============================================================
          TAB 4: AGENT DEPLOYMENT
          ============================================================ */}
      {activeTab === 'agents' && (
        <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg p-6 shadow-sm space-y-6 text-xs">
          <div className="border-b border-[var(--racklyt-border-weak)] pb-3">
            <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
              <Terminal size={16} className="text-[var(--racklyt-orange)]" />
              <span>Agent Enrollment & Deployment Center</span>
            </h3>
            <p className="text-[11px] text-mutedText">
              Deploy <code className="text-primaryText font-mono">racklyt-agent</code> across Linux hosts, Raspberry Pis, and Proxmox VE hypervisors
            </p>
          </div>

          <div className="p-4 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-2">
            <h4 className="font-semibold text-primaryText text-xs">Why Push-Based Telemetry?</h4>
            <p className="text-mutedText leading-relaxed text-[11.5px]">
              Traditional monitoring pulls data by opening TCP ports on every monitored target and running scraping pollers. Racklyt inverses this model: nodes connect <strong>outbound</strong> to your Hub. This eliminates the need to configure firewall holes across VLANs and allows machines behind NAT or Tailscale to seamlessly report home.
            </p>
          </div>

          {/* Linux One Liner */}
          <div className="space-y-2">
            <label className="font-semibold text-primaryText flex items-center justify-between">
              <span>Standard Linux / Raspberry Pi OS One-Liner</span>
              <span className="text-[10px] text-mutedText font-mono">Bash Script</span>
            </label>
            <CodeTerminalBlock
              title="bash — root@agent-node:~"
              command={`curl -sSL ${hubOrigin}/install.sh | sudo bash -s -- --hub ${hubOrigin} --token agent_prod_token`}
              onCopy={() =>
                copyToClipboard(
                  `curl -sSL ${hubOrigin}/install.sh | sudo bash -s -- --hub ${hubOrigin} --token agent_prod_token`,
                  'agent_curl'
                )
              }
              isCopied={copiedKey === 'agent_curl'}
            />
          </div>

          {/* Docker Compose */}
          <div className="space-y-2">
            <label className="font-semibold text-primaryText flex items-center justify-between">
              <span>Docker & Container Fleet Compose Configuration</span>
              <span className="text-[10px] text-mutedText font-mono">docker-compose.yml</span>
            </label>
            <CodeTerminalBlock
              title="yaml — docker-compose.yml"
              command={`version: "3.8"\nservices:\n  racklyt-agent:\n    image: ghcr.io/racklyt/agent:latest\n    container_name: racklyt-agent\n    restart: unless-stopped\n    pid: host\n    network_mode: host\n    environment:\n      - RACKLYT_HUB_URL=${hubOrigin}\n      - RACKLYT_NODE_ID=docker-cluster-node\n      - RACKLYT_AUTH_TOKEN=agent_prod_token\n    volumes:\n      - /proc:/host/proc:ro\n      - /sys:/host/sys:ro\n      - /:/host/root:ro`}
              onCopy={() =>
                copyToClipboard(
                  `version: "3.8"\nservices:\n  racklyt-agent:\n    image: ghcr.io/racklyt/agent:latest\n    container_name: racklyt-agent\n    restart: unless-stopped\n    pid: host\n    network_mode: host\n    environment:\n      - RACKLYT_HUB_URL=${hubOrigin}\n      - RACKLYT_NODE_ID=docker-cluster-node\n      - RACKLYT_AUTH_TOKEN=agent_prod_token\n    volumes:\n      - /proc:/host/proc:ro\n      - /sys:/host/sys:ro\n      - /:/host/root:ro`,
                  'agent_compose'
                )
              }
              isCopied={copiedKey === 'agent_compose'}
            />
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 5: CLOUDFLARE INGRESS
          ============================================================ */}
      {activeTab === 'cloudflare' && (
        <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg p-6 shadow-sm space-y-6 text-xs">
          <div className="border-b border-[var(--racklyt-border-weak)] pb-3">
            <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
              <Globe size={16} className="text-[var(--racklyt-blue)]" />
              <span>Cloudflare Zero-Trust Remote Ingress</span>
            </h3>
            <p className="text-[11px] text-mutedText">
              Expose your Hub to the internet securely without opening port forwards or sharing public IPs
            </p>
          </div>

          <div className="p-4 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-2">
            <h4 className="font-semibold text-primaryText text-xs">How Cloudflare Tunnels Work</h4>
            <p className="text-mutedText leading-relaxed text-[11.5px]">
              Running <code className="text-primaryText font-mono">cloudflared</code> creates an encrypted duplex tunnel between your Raspberry Pi / server and Cloudflare’s nearest edge data center. Inbound HTTPS requests are authenticated and passed directly to <code className="text-primaryText font-mono">http://localhost:8443</code>. WebSocket feeds and Server-Sent Events (SSE) for alerts stream without termination.
            </p>
          </div>

          <div className="space-y-2">
            <label className="font-semibold text-primaryText">Quick Start Tunnel Service Command:</label>
            <CodeTerminalBlock
              title="bash — root@hub:~"
              command="cloudflared tunnel --url http://localhost:8443"
              onCopy={() => copyToClipboard('cloudflared tunnel --url http://localhost:8443', 'cf_cmd')}
              isCopied={copiedKey === 'cf_cmd'}
            />
          </div>

          <div className="space-y-2">
            <label className="font-semibold text-primaryText">Production Tunnel Configuration (/etc/cloudflared/config.yml):</label>
            <CodeTerminalBlock
              title="yaml — /etc/cloudflared/config.yml"
              command={`tunnel: racklyt-monitoring\ncredentials-file: /etc/cloudflared/cert.json\n\ningress:\n  - hostname: racklyt.yourdomain.com\n    service: http://localhost:8443\n    originRequest:\n      noTLSVerify: true\n  - service: http_status:404`}
              onCopy={() =>
                copyToClipboard(
                  `tunnel: racklyt-monitoring\ncredentials-file: /etc/cloudflared/cert.json\n\ningress:\n  - hostname: racklyt.yourdomain.com\n    service: http://localhost:8443\n    originRequest:\n      noTLSVerify: true\n  - service: http_status:404`,
                  'cf_yaml'
                )
              }
              isCopied={copiedKey === 'cf_yaml'}
            />
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 6: STORAGE ENGINE & DATABASE MAINTENANCE
          (Replacing raw tech status dump with genuine production controls)
          ============================================================ */}
      {activeTab === 'storage' && (
        <div className="space-y-6 text-xs">
          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded-lg p-6 shadow-sm space-y-5">
            <div className="border-b border-[var(--racklyt-border-weak)] pb-3">
              <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                <HardDrive size={16} className="text-emerald-400" />
                <span>Embedded SQLite WAL Storage Engine</span>
              </h3>
              <p className="text-[11px] text-mutedText">
                Telemetry persistence, flash wear-leveling optimization, and database page compaction
              </p>
            </div>

            {/* Explanatory banner */}
            <div className="p-4 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1.5 leading-relaxed">
              <strong className="text-primaryText text-xs">How SQLite WAL Engine Protects Hardware:</strong>
              <p className="text-mutedText text-[11.5px]">
                In traditional monitoring tools, incoming metrics cause continuous small random writes that rapidly degrade SD cards and flash drives. Racklyt runs SQLite in <strong>WAL (Write-Ahead Logging) mode</strong> with synchronized memory mapping: writes are sequentially appended to the WAL log file, while readers access historical metrics concurrently with zero lock contention.
              </p>
            </div>

            {/* Real DB Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
              <div className="p-3.5 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] space-y-1">
                <div className="text-mutedText text-[10px] font-sans">MAIN DATABASE SIZE</div>
                <div className="text-primaryText text-sm font-bold">
                  {dbStats ? formatBytes(dbStats.db_size_bytes) : '—'}
                </div>
                <div className="text-[10px] text-mutedText">File: racklyt.db</div>
              </div>

              <div className="p-3.5 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] space-y-1">
                <div className="text-mutedText text-[10px] font-sans">WAL LOG SIZE</div>
                <div className="text-emerald-400 text-sm font-bold">
                  {dbStats ? formatBytes(dbStats.wal_size_bytes) : '0 B'}
                </div>
                <div className="text-[10px] text-mutedText">Sequential Buffer</div>
              </div>

              <div className="p-3.5 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] space-y-1">
                <div className="text-mutedText text-[10px] font-sans">METRIC RECORDS</div>
                <div className="text-[var(--racklyt-cyan)] text-sm font-bold">
                  {dbStats ? dbStats.metrics_count.toLocaleString() : '0'}
                </div>
                <div className="text-[10px] text-mutedText">metrics_raw table</div>
              </div>

              <div className="p-3.5 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] space-y-1">
                <div className="text-mutedText text-[10px] font-sans">ACTIVE FLEET NODES</div>
                <div className="text-[var(--racklyt-orange)] text-sm font-bold">
                  {dbStats ? dbStats.nodes_count : '0'}
                </div>
                <div className="text-[10px] text-mutedText">Registered Targets</div>
              </div>
            </div>

            {/* Maintenance Actions */}
            <div className="pt-4 border-t border-[var(--racklyt-border-weak)] space-y-3">
              <h4 className="font-semibold text-primaryText text-xs">Database Maintenance Actions</h4>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRunVacuum}
                  disabled={vacuumLoading}
                  className="px-4 py-2 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded font-semibold text-primaryText transition flex items-center space-x-2"
                >
                  <RefreshCw size={13} className={vacuumLoading ? 'animate-spin' : ''} />
                  <span>{vacuumLoading ? 'Compacting database...' : 'Run SQLite VACUUM & Truncate WAL'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await ApiClient.updateSystemSettings({ retention_purge_requested: 'true' });
                    alert('Retention purge initiated. Historical telemetry outside retention window has been cleaned.');
                    const stats = await ApiClient.getDatabaseStats();
                    setDbStats(stats);
                  }}
                  className="px-4 py-2 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded font-semibold text-primaryText transition flex items-center space-x-2"
                >
                  <Trash2 size={13} className="text-coral" />
                  <span>Purge Outdated Records Now</span>
                </button>
              </div>

              {vacuumMessage && (
                <p className="text-[11px] font-mono text-emerald-400 mt-2">{vacuumMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2FA SETUP MODAL */}
      {show2faSetupModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--racklyt-border-weak)]">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5 text-[var(--racklyt-orange)]" />
                <h3 className="text-sm font-bold text-primaryText">Configure Two-Phase Authentication</h3>
              </div>
              <button
                type="button"
                onClick={() => setShow2faSetupModal(false)}
                className="text-mutedText hover:text-primaryText p-1"
              >
                <X size={18} />
              </button>
            </div>

            {setupError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-xs">
                {setupError}
              </div>
            )}

            <p className="text-xs text-mutedText leading-relaxed">
              1. Scan the QR code below with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or <strong>1Password</strong>:
            </p>

            {/* Scannable QR Code */}
            {setupQrUrl && (
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border border-[var(--racklyt-border-medium)] shadow-inner my-2">
                <img
                  src={setupQrUrl}
                  alt="2FA QR Code"
                  className="w-40 h-40 select-none"
                />
                <span className="text-[10.5px] text-zinc-700 font-semibold mt-1">
                  Point phone camera or authenticator at this code
                </span>
              </div>
            )}

            {/* Secret Key with copy */}
            <div className="bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-medium)] rounded p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[10px] text-mutedText font-semibold uppercase">
                <span>Secret Key (Manual Entry)</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(setupSecret);
                    setCopied2faSecret(true);
                    setTimeout(() => setCopied2faSecret(false), 2000);
                  }}
                  className="flex items-center space-x-1 text-[var(--racklyt-orange)] hover:underline"
                >
                  {copied2faSecret ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copied2faSecret ? 'Copied' : 'Copy Key'}</span>
                </button>
              </div>
              <div className="font-mono text-xs text-primaryText font-bold tracking-wider select-all break-all">
                {setupSecret}
              </div>
            </div>

            {/* Code Verification Form */}
            <form onSubmit={handleConfirm2FAActivation} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-mutedText mb-1 uppercase tracking-wider">
                  2. Enter 6-Digit Code from Authenticator to Activate
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded px-3 py-2 text-center text-lg tracking-widest text-primaryText font-mono focus:outline-none focus:border-[var(--racklyt-orange)]"
                  placeholder="000 000"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShow2faSetupModal(false)}
                  className="flex-1 py-2 border border-[var(--racklyt-border-medium)] text-primaryText hover:bg-[var(--racklyt-bg-subtle)] rounded text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={setupLoading || setupCode.length < 6}
                  className="flex-1 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] disabled:opacity-50 text-black font-semibold rounded text-xs transition shadow"
                >
                  {setupLoading ? 'Verifying...' : 'Verify & Activate 2FA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
