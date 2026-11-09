import React, { useState } from 'react';
import { X, Check, Search, RotateCcw } from 'lucide-react';
import {
  AVAILABLE_ICONS,
  AVAILABLE_ICON_COLORS,
  setCustomIconFor,
  removeCustomIconFor,
  getCustomIconFor,
} from '../utils/iconRegistry';

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetTitle: string;
  initialIcon?: string;
  initialColor?: string;
  onApplied?: (icon: string, color: string) => void;
}

export const IconPickerModal: React.FC<IconPickerModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetTitle,
  initialIcon,
  initialColor,
  onApplied,
}) => {
  if (!isOpen) return null;

  const existing = getCustomIconFor(targetId);
  const [selectedIcon, setSelectedIcon] = useState<string>(
    initialIcon || existing?.icon || 'Server'
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    initialColor || existing?.color || 'var(--racklyt-orange)'
  );
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIcons = AVAILABLE_ICONS.filter((item) =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApply = () => {
    setCustomIconFor(targetId, selectedIcon, selectedColor);
    if (onApplied) {
      onApplied(selectedIcon, selectedColor);
    }
    onClose();
  };

  const handleReset = () => {
    removeCustomIconFor(targetId);
    if (onApplied) {
      onApplied('', '');
    }
    onClose();
  };

  // Preview component
  const currentDef = AVAILABLE_ICONS.find((i) => i.id === selectedIcon) || AVAILABLE_ICONS[0];
  const PreviewComp = currentDef.component;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--racklyt-bg-panel)',
          border: '1px solid var(--racklyt-border-medium)',
          borderRadius: 'var(--panel-radius)',
          width: 520,
          maxWidth: '94vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--racklyt-border-weak)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                backgroundColor: 'var(--racklyt-bg-input)',
                border: '1px solid var(--racklyt-border-weak)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PreviewComp size={18} style={{ color: selectedColor }} />
            </div>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--racklyt-text-primary)' }}>
                Customize Icon
              </h3>
              <p style={{ fontSize: 11, color: 'var(--racklyt-text-muted)' }} className="truncate max-w-[280px]">
                {targetTitle}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="panel-action-btn" title="Close">
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Color Palette Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--racklyt-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Icon Accent Color
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AVAILABLE_ICON_COLORS.map((col) => {
                const isSelected = selectedColor === col.color;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedColor(col.color)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      backgroundColor: 'var(--racklyt-bg-input)',
                      border: isSelected ? '2px solid #ffffff' : '1px solid var(--racklyt-border-weak)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? `0 0 10px ${col.color}` : 'none',
                    }}
                    title={col.name}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: col.color,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Icon */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--racklyt-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Select Icon
            </label>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search
                size={13}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--racklyt-text-muted)' }}
              />
              <input
                type="text"
                placeholder="Search icon name (server, network, cpu, database...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-input"
                style={{ width: '100%', height: 32, paddingLeft: 30, fontSize: 12 }}
              />
            </div>

            {/* Grid of Icons */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                gap: 8,
                maxHeight: '260px',
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {filteredIcons.map((item) => {
                const IconComponent = item.component;
                const isSelected = selectedIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIcon(item.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 4px',
                      borderRadius: 4,
                      backgroundColor: isSelected ? 'var(--racklyt-bg-active)' : 'var(--racklyt-bg-input)',
                      border: isSelected
                        ? `1px solid ${selectedColor}`
                        : '1px solid var(--racklyt-border-weak)',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                    title={item.label}
                  >
                    <IconComponent
                      size={20}
                      style={{ color: isSelected ? selectedColor : 'var(--racklyt-text-secondary)', marginBottom: 4 }}
                    />
                    <span
                      style={{
                        fontSize: 9.5,
                        color: isSelected ? selectedColor : 'var(--racklyt-text-muted)',
                        fontWeight: isSelected ? 600 : 400,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.id}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--racklyt-border-weak)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--racklyt-bg-canvas)',
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            className="rk-btn rk-btn-secondary"
            style={{ fontSize: 11, padding: '4px 10px' }}
            title="Reset to automatic category icon"
          >
            <RotateCcw size={11} />
            <span>Reset Default</span>
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} className="rk-btn rk-btn-secondary" style={{ fontSize: 11 }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rk-btn rk-btn-orange"
              style={{ fontSize: 11 }}
            >
              <Check size={12} />
              <span>Save Icon</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IconPickerModal;
