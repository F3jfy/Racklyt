import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme, ACCENT_PRESETS } from '../context/ThemeContext';

export const AccentColorPicker: React.FC = () => {
  const { accentColor, setAccentColor } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-elevated text-mutedText hover:text-primaryText border border-transparent hover:border-subtle flex items-center space-x-1.5 transition"
        title="Customize Accent Color"
      >
        <span
          className="w-3.5 h-3.5 rounded-full border border-subtle shadow-inner"
          style={{ backgroundColor: accentColor }}
        />
        <Palette className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-surface border border-subtle rounded-lg p-3 shadow-elevated z-50 text-xs">
          <div className="font-semibold text-primaryText mb-2 text-[11px] uppercase tracking-wider">
            Accent Theme
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {ACCENT_PRESETS.map((preset) => {
              const isSelected = accentColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.name}
                  onClick={() => {
                    setAccentColor(preset.hex);
                  }}
                  className="w-full h-8 rounded flex items-center justify-center border transition relative hover:scale-105"
                  style={{
                    backgroundColor: preset.hex,
                    borderColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.1)',
                  }}
                  title={preset.name}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2.5 border-t border-[var(--racklyt-border-weak)] flex items-center justify-between">
            <span className="text-[11px] text-mutedText font-mono">Custom Hex:</span>
            <div className="flex items-center space-x-1.5">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
              />
              <span className="font-mono text-[11px] text-primaryText">{accentColor.toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
