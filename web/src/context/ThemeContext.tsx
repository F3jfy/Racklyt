import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS, THEME_PRESETS, applyThemeToDom } from '../utils/theme';

export interface AccentPreset {
  name: string;
  hex: string;
  rgb: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: 'Racklyt Amber', hex: '#F99C1C', rgb: '249 156 28' },
  { name: 'Midnight Cyan', hex: '#00D2FF', rgb: '0 210 255' },
  { name: 'Emerald Green', hex: '#10B981', rgb: '16 185 129' },
  { name: 'Matrix Green', hex: '#00FF66', rgb: '0 255 102' },
  { name: 'Nord Frost', hex: '#88C0D0', rgb: '136 192 208' },
  { name: 'Violet Code', hex: '#8B5CF6', rgb: '139 92 246' },
  { name: 'Sunset Amber', hex: '#FFAA00', rgb: '255 170 0' },
  { name: 'Electric Rose', hex: '#F43F5E', rgb: '244 63 94' },
];

interface ThemeContextType {
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  accentColor: string;
  setAccentColor: (hex: string) => void;
  selectPreset: (presetId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('homelab_app_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.themePreset === 'grafana-dark') {
          parsed.themePreset = 'racklyt-dark';
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        console.error('Failed to parse saved app settings', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    applyThemeToDom(appSettings);
    localStorage.setItem('homelab_app_settings', JSON.stringify(appSettings));
  }, [appSettings]);

  const setAccentColor = (hex: string) => {
    setAppSettings((prev) => ({
      ...prev,
      accentColor: hex,
    }));
  };

  const selectPreset = (presetId: string) => {
    const found = THEME_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setAppSettings((prev) => ({
        ...prev,
        themePreset: found.id,
        accentColor: found.accentColor,
        canvasBg: found.canvasBg,
        panelBg: found.panelBg,
        textColor: found.textColor,
      }));
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        appSettings,
        setAppSettings,
        accentColor: appSettings.accentColor,
        setAccentColor,
        selectPreset,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
