import React from 'react';
import {
  Server,
  Activity,
  Cpu,
  HardDrive,
  Network,
  Thermometer,
  Layers,
  Terminal,
  Radio,
  Shield,
  Database,
  Gauge,
  BarChart,
  Wifi,
  Cloud,
  Flame,
  Eye,
  Zap,
  Box,
  Globe,
  Lock,
  Sliders,
  Compass,
  Bell,
  Monitor,
  Folder,
} from 'lucide-react';

export interface IconDefinition {
  id: string;
  label: string;
  component: React.ComponentType<any>;
}

export const AVAILABLE_ICONS: IconDefinition[] = [
  { id: 'Activity', label: 'Activity & Telemetry', component: Activity },
  { id: 'Server', label: 'Server & Host', component: Server },
  { id: 'Cpu', label: 'Processor & Cores', component: Cpu },
  { id: 'HardDrive', label: 'Storage & Disk', component: HardDrive },
  { id: 'Network', label: 'Network & Bandwidth', component: Network },
  { id: 'Thermometer', label: 'Thermals & Sensors', component: Thermometer },
  { id: 'Layers', label: 'Virtualization & Containers', component: Layers },
  { id: 'Terminal', label: 'Logs & Console', component: Terminal },
  { id: 'Radio', label: 'Ports & Wireless', component: Radio },
  { id: 'Shield', label: 'Firewall & Security', component: Shield },
  { id: 'Database', label: 'Database & SQL', component: Database },
  { id: 'Gauge', label: 'Gauge & Meter', component: Gauge },
  { id: 'BarChart', label: 'Metrics & Analytics', component: BarChart },
  { id: 'Wifi', label: 'WiFi & Access Point', component: Wifi },
  { id: 'Cloud', label: 'Cloud & Ingress', component: Cloud },
  { id: 'Flame', label: 'Thermal & High Load', component: Flame },
  { id: 'Eye', label: 'Watchdog & Monitor', component: Eye },
  { id: 'Zap', label: 'Power & Voltage', component: Zap },
  { id: 'Box', label: 'Container & Pod', component: Box },
  { id: 'Globe', label: 'Web & CDN', component: Globe },
  { id: 'Lock', label: 'Auth & Encryption', component: Lock },
  { id: 'Sliders', label: 'Controls & Settings', component: Sliders },
  { id: 'Compass', label: 'Routing & Gateway', component: Compass },
  { id: 'Bell', label: 'Alerts & Events', component: Bell },
  { id: 'Monitor', label: 'Display & Node', component: Monitor },
  { id: 'Folder', label: 'Filesystem & Mounts', component: Folder },
];

export const AVAILABLE_ICON_COLORS = [
  { id: 'orange', name: 'Racklyt Amber', color: 'var(--racklyt-orange)' },
  { id: 'cyan', name: 'Cyan Blue', color: 'var(--racklyt-cyan)' },
  { id: 'green', name: 'Emerald', color: 'var(--racklyt-green)' },
  { id: 'red', name: 'Coral Red', color: 'var(--racklyt-red)' },
  { id: 'yellow', name: 'Bright Yellow', color: 'var(--racklyt-yellow)' },
  { id: 'purple', name: 'Violet Purple', color: 'var(--racklyt-purple)' },
  { id: 'blue', name: 'Deep Blue', color: 'var(--racklyt-blue)' },
  { id: 'white', name: 'Silver White', color: 'var(--racklyt-text-primary)' },
];

export interface CustomIconConfig {
  icon: string;
  color: string;
}

const STORAGE_KEY = 'racklyt_custom_icons';

export function getAllCustomIcons(): Record<string, CustomIconConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse custom icons from localStorage', e);
  }
  return {};
}

export function getCustomIconFor(targetId: string): CustomIconConfig | null {
  const all = getAllCustomIcons();
  return all[targetId] || null;
}

export function setCustomIconFor(targetId: string, icon: string, color: string) {
  const all = getAllCustomIcons();
  all[targetId] = { icon, color };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('racklyt-icon-changed', { detail: { targetId, icon, color } }));
  } catch (e) {
    console.error('Failed to save custom icon', e);
  }
}

export function removeCustomIconFor(targetId: string) {
  const all = getAllCustomIcons();
  delete all[targetId];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('racklyt-icon-changed', { detail: { targetId } }));
  } catch (e) {
    console.error('Failed to remove custom icon', e);
  }
}

export function renderDynamicIcon(
  iconName?: string,
  color?: string,
  size = 17,
  fallback = <Activity size={size} style={{ color: color || 'var(--racklyt-green)' }} />
): React.ReactElement {
  if (!iconName) return fallback;
  const def = AVAILABLE_ICONS.find((i) => i.id.toLowerCase() === iconName.toLowerCase());
  if (!def) return fallback;
  const Comp = def.component;
  return <Comp size={size} style={{ color: color || 'var(--racklyt-orange)' }} />;
}
