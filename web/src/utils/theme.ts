export interface AppSettings {
  appTitle: string;
  appSubtitle: string;
  themePreset: string;
  accentColor: string;
  canvasBg: string;
  panelBg: string;
  textColor: string;
  fontFamily: string;
  panelRadius: number;
  uiDensity: 'compact' | 'balanced' | 'comfortable';
  glassmorphism: boolean;
  glowEffects: boolean;
  chartCurve: number;
  chartFillOpacity: number;
  chartAnimations: boolean;
  defaultView: string;
  defaultRefreshInterval: string;
  tempUnit: 'celsius' | 'fahrenheit';
  bandwidthUnit: 'bytes' | 'bits';
  timeFormat: '24h' | '12h';
  showStoppedContainers: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  appTitle: 'Racklyt Fleet Hub',
  appSubtitle: 'Central Operations Platform',
  themePreset: 'racklyt-dark',
  accentColor: '#f99c1c',
  canvasBg: '#0b0c0e',
  panelBg: '#181b1f',
  textColor: '#f0f2f5',
  fontFamily: 'Inter',
  panelRadius: 4,
  uiDensity: 'balanced',
  glassmorphism: false,
  glowEffects: true,
  chartCurve: 0.3,
  chartFillOpacity: 0.25,
  chartAnimations: true,
  defaultView: 'dashboard',
  defaultRefreshInterval: '2s',
  tempUnit: 'celsius',
  bandwidthUnit: 'bytes',
  timeFormat: '24h',
  showStoppedContainers: true,
};

export const THEME_PRESETS = [
  {
    id: 'racklyt-dark',
    name: 'Racklyt Dark',
    description: 'Iconic DevOps aesthetic with signature amber/orange accents',
    accentColor: '#f99c1c',
    canvasBg: '#0b0c0e',
    panelBg: '#181b1f',
    textColor: '#f0f2f5',
  },
  {
    id: 'midnight-oled',
    name: 'Midnight OLED Black',
    description: 'True #000000 deep contrast for OLED monitors & ultra-low power',
    accentColor: '#00d2ff',
    canvasBg: '#000000',
    panelBg: '#0e1013',
    textColor: '#f5f7fa',
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: 'Deep violet space with electric cyan and hot magenta glows',
    accentColor: '#00ffff',
    canvasBg: '#0a0a14',
    panelBg: '#131325',
    textColor: '#e6e8ff',
  },
  {
    id: 'matrix-green',
    name: 'Matrix Terminal Green',
    description: 'Phosphor green terminal theme for serious system operators',
    accentColor: '#00ff66',
    canvasBg: '#030805',
    panelBg: '#08140c',
    textColor: '#d4ffd9',
  },
  {
    id: 'nord-slate',
    name: 'Nordic Slate Frost',
    description: 'Arctic blue cold palette inspired by the Nord design system',
    accentColor: '#88c0d0',
    canvasBg: '#1a1c23',
    panelBg: '#232732',
    textColor: '#eceff4',
  },
  {
    id: 'sunset-amber',
    name: 'Sunset Amber & Gold',
    description: 'Warm obsidian slate with burning golden amber highlights',
    accentColor: '#ffaa00',
    canvasBg: '#100d0a',
    panelBg: '#1a1510',
    textColor: '#fff5ea',
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro Violet',
    description: 'Refined code-editor contrast with electric violet accents',
    accentColor: '#ab9df2',
    canvasBg: '#141315',
    panelBg: '#1d1c1f',
    textColor: '#fcfcfa',
  },
  {
    id: 'dracula-emerald',
    name: 'Emerald Dracula',
    description: 'Vibrant emerald green highlights on Dracula deep slate',
    accentColor: '#50fa7b',
    canvasBg: '#191a21',
    panelBg: '#21222c',
    textColor: '#f8f8f2',
  },
];

export function hexToRgbStr(hex: string): string {
  const sanitized = hex.replace('#', '');
  if (sanitized.length === 3) {
    const r = parseInt(sanitized[0] + sanitized[0], 16);
    const g = parseInt(sanitized[1] + sanitized[1], 16);
    const b = parseInt(sanitized[2] + sanitized[2], 16);
    return `${r} ${g} ${b}`;
  } else if (sanitized.length === 6) {
    const r = parseInt(sanitized.substring(0, 2), 16);
    const g = parseInt(sanitized.substring(2, 4), 16);
    const b = parseInt(sanitized.substring(4, 6), 16);
    return `${r} ${g} ${b}`;
  }
  return '249 156 28';
}

export function applyThemeToDom(s: AppSettings) {
  const root = document.documentElement;

  if (s.canvasBg) root.style.setProperty('--racklyt-bg-canvas', s.canvasBg);
  if (s.panelBg) {
    root.style.setProperty('--racklyt-bg-panel', s.panelBg);
    root.style.setProperty('--racklyt-bg-subtle', s.panelBg);
  }
  if (s.accentColor) {
    root.style.setProperty('--racklyt-orange', s.accentColor);
    root.style.setProperty('--racklyt-border-focus', s.accentColor);
    root.style.setProperty('--color-accent', s.accentColor);
    root.style.setProperty('--color-accent-rgb', hexToRgbStr(s.accentColor));
  }
  if (s.textColor) root.style.setProperty('--racklyt-text-primary', s.textColor);
  if (s.panelRadius !== undefined) {
    root.style.setProperty('--panel-radius', `${s.panelRadius}px`);
    root.style.setProperty('--radius-md', `${s.panelRadius}px`);
  }

  // Modifiers
  if (s.glassmorphism) {
    root.classList.add('theme-glassmorphism');
  } else {
    root.classList.remove('theme-glassmorphism');
  }

  if (s.glowEffects) {
    root.classList.add('theme-glow-active');
  } else {
    root.classList.remove('theme-glow-active');
  }

  root.classList.remove('density-compact', 'density-balanced', 'density-comfortable');
  root.classList.add(`density-${s.uiDensity || 'balanced'}`);
}
