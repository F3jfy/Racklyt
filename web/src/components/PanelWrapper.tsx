import React, { useRef, useState, useEffect } from 'react';
import {
  GripVertical,
  Trash2,
  Cpu,
  HardDrive,
  Network,
  Activity,
  Thermometer,
  Layers,
  Server,
  Plus,
  Minus,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Radio,
} from 'lucide-react';
import { renderDynamicIcon } from '../utils/iconRegistry';

interface PanelWrapperProps {
  title: string;
  type?: string;
  customIcon?: string;
  customIconColor?: string;
  isEditMode: boolean;
  gridW?: number;
  onResizeWidth?: (delta: number) => void;
  onSetWidth?: (width: number) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPickIcon?: () => void;
  children: React.ReactNode;
}

export const PanelWrapper: React.FC<PanelWrapperProps> = ({
  title,
  type,
  customIcon,
  customIconColor,
  isEditMode,
  gridW = 6,
  onResizeWidth,
  onSetWidth,
  onMoveLeft,
  onMoveRight,
  onEdit,
  onDelete,
  onPickIcon,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [liveWidth, setLiveWidth] = useState(gridW);

  useEffect(() => {
    setLiveWidth(gridW);
  }, [gridW]);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setLiveWidth(gridW);

    const startX = e.clientX;
    const startW = gridW;

    const parent = panelRef.current?.parentElement;
    const parentWidth = parent ? parent.getBoundingClientRect().width : window.innerWidth;
    const colWidth = parentWidth / 12;

    let lastCol = startW;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const colDelta = Math.round(deltaX / colWidth);
      const targetW = Math.max(1, Math.min(12, startW + colDelta));

      if (targetW !== lastCol) {
        lastCol = targetW;
        setLiveWidth(targetW);
        if (onSetWidth) {
          onSetWidth(targetW);
        } else if (onResizeWidth) {
          onResizeWidth(targetW - gridW);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStartResize = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const startX = e.touches[0].clientX;
    const startW = gridW;
    setIsResizing(true);
    setLiveWidth(gridW);

    const parent = panelRef.current?.parentElement;
    const parentWidth = parent ? parent.getBoundingClientRect().width : window.innerWidth;
    const colWidth = parentWidth / 12;

    let lastCol = startW;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      const deltaX = moveEvent.touches[0].clientX - startX;
      const colDelta = Math.round(deltaX / colWidth);
      const targetW = Math.max(1, Math.min(12, startW + colDelta));

      if (targetW !== lastCol) {
        lastCol = targetW;
        setLiveWidth(targetW);
        if (onSetWidth) {
          onSetWidth(targetW);
        } else if (onResizeWidth) {
          onResizeWidth(targetW - gridW);
        }
      }
    };

    const handleTouchEnd = () => {
      setIsResizing(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  const renderPanelIcon = () => {
    if (customIcon) {
      return renderDynamicIcon(customIcon, customIconColor || 'var(--racklyt-orange)', 13);
    }
    const t = (title || '').toLowerCase();
    const pType = (type || '').toLowerCase();

    if (t.includes('temp') || t.includes('thermal') || pType.includes('temp')) {
      return <Thermometer size={13} style={{ color: 'var(--racklyt-red)' }} />;
    }
    if (t.includes('cpu') || t.includes('core') || t.includes('load') || pType.includes('cpu')) {
      return <Cpu size={13} style={{ color: 'var(--racklyt-orange)' }} />;
    }
    if (t.includes('ram') || t.includes('memory') || t.includes('swap') || pType.includes('mem')) {
      return <Activity size={13} style={{ color: 'var(--racklyt-blue)' }} />;
    }
    if (t.includes('net') || t.includes('bandwidth') || t.includes('rx') || t.includes('tx') || pType.includes('network')) {
      return <Network size={13} style={{ color: 'var(--racklyt-cyan)' }} />;
    }
    if (t.includes('port') || t.includes('socket') || pType.includes('port')) {
      return <Radio size={13} style={{ color: 'var(--racklyt-green)' }} />;
    }
    if (t.includes('disk') || t.includes('storage') || t.includes('io') || pType.includes('storage')) {
      return <HardDrive size={13} style={{ color: 'var(--racklyt-green)' }} />;
    }
    if (t.includes('docker') || t.includes('container') || pType === 'docker-fleet') {
      return <Layers size={13} style={{ color: 'var(--racklyt-purple)' }} />;
    }
    if (t.includes('proxmox') || pType === 'proxmox-summary') {
      return <Server size={13} style={{ color: 'var(--racklyt-orange)' }} />;
    }
    if (t.includes('journal') || t.includes('log') || pType === 'log-stream') {
      return <Terminal size={13} style={{ color: 'var(--racklyt-cyan)' }} />;
    }
    if (t.includes('sys') || pType === 'sysinfo' || t.includes('fleet')) {
      return <Server size={13} style={{ color: 'var(--racklyt-blue)' }} />;
    }
    return <Activity size={13} style={{ color: 'var(--racklyt-text-muted)' }} />;
  };

  const getColSpanClass = (w: number) => {
    switch (w) {
      case 1:
        return 'col-span-12 sm:col-span-3 md:col-span-2 lg:col-span-1';
      case 2:
        return 'col-span-12 sm:col-span-4 md:col-span-3 lg:col-span-2';
      case 3:
        return 'col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3';
      case 4:
        return 'col-span-12 sm:col-span-6 md:col-span-6 lg:col-span-4';
      case 5:
        return 'col-span-12 md:col-span-6 lg:col-span-5';
      case 6:
        return 'col-span-12 md:col-span-6';
      case 7:
        return 'col-span-12 lg:col-span-7';
      case 8:
        return 'col-span-12 lg:col-span-8';
      case 9:
        return 'col-span-12 lg:col-span-9';
      case 10:
        return 'col-span-12 lg:col-span-10';
      case 11:
        return 'col-span-12 lg:col-span-11';
      case 12:
      default:
        return 'col-span-12';
    }
  };

  const currentW = isResizing ? liveWidth : gridW;

  return (
    <div
      ref={panelRef}
      className={`panel-container ${getColSpanClass(currentW)} ${isResizing ? 'panel-resizing-active' : ''} transition-all duration-150`}
      style={{
        gridColumn: `span ${Math.max(1, Math.min(12, currentW))} / span ${Math.max(1, Math.min(12, currentW))}`,
      }}
    >
      {/* Live Mouse-Resize HUD indicator */}
      {isResizing && (
        <div className="panel-resize-hud">
          <span className="font-mono font-bold">{currentW}/12</span>
          <span className="text-[10px] text-mutedText">({Math.round((currentW / 12) * 100)}% width)</span>
        </div>
      )}

      {/* Header */}
      <div className={`panel-header ${isEditMode ? 'panel-header-active' : ''}`}>
        <div className="panel-title-wrapper">
          {isEditMode && (
            <span className="panel-drag-handle drag-handle cursor-move" title="Drag to reorder">
              <GripVertical size={13} />
            </span>
          )}
          <span
            className="panel-title-icon"
            onClick={() => {
              if (isEditMode && onPickIcon) onPickIcon();
            }}
            style={{ cursor: isEditMode && onPickIcon ? 'pointer' : 'default' }}
            title={isEditMode && onPickIcon ? 'Click to change panel icon & color' : undefined}
          >
            {renderPanelIcon()}
          </span>
          <h3 className="panel-title truncate" title={title}>{title}</h3>
          {isEditMode && (
            <span className="text-[10px] text-mutedText font-mono shrink-0">({currentW}/12)</span>
          )}
        </div>

        {isEditMode && (
          <div className="panel-actions flex items-center space-x-1">
            {/* Move Left / Right */}
            {onMoveLeft && (
              <button
                type="button"
                onClick={onMoveLeft}
                className="panel-action-btn"
                title="Move panel earlier"
              >
                <ChevronLeft size={11} />
              </button>
            )}
            {onMoveRight && (
              <button
                type="button"
                onClick={onMoveRight}
                className="panel-action-btn"
                title="Move panel later"
              >
                <ChevronRight size={11} />
              </button>
            )}

            {/* Resize Width Buttons */}
            {onResizeWidth && (
              <>
                <button
                  type="button"
                  onClick={() => onResizeWidth(-1)}
                  disabled={currentW <= 1}
                  className="panel-action-btn disabled:opacity-30"
                  title="Narrow panel width (-1 col)"
                >
                  <Minus size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => onResizeWidth(1)}
                  disabled={currentW >= 12}
                  className="panel-action-btn disabled:opacity-30"
                  title="Widen panel width (+1 col)"
                >
                  <Plus size={11} />
                </button>
              </>
            )}

            {/* Configure Modal */}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="panel-action-btn"
                style={{ color: 'var(--racklyt-orange)' }}
                title="Configure panel properties"
              >
                <Sliders size={11} />
              </button>
            )}

            {/* Remove */}
            {onDelete && (
              <button
                type="button"
                className="panel-action-btn"
                style={{ color: 'var(--racklyt-red)' }}
                onClick={onDelete}
                title="Remove panel"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="panel-body">{children}</div>

      {/* Interactive Mouse Drag Resize Handles (Right Edge & Corner) */}
      <div
        className="panel-resize-handle-right"
        onMouseDown={handleMouseDownResize}
        onTouchStart={handleTouchStartResize}
        title="Click and drag horizontally with mouse to scale panel width (1-12 columns)"
      />
      <div
        className="panel-resize-handle-corner"
        onMouseDown={handleMouseDownResize}
        onTouchStart={handleTouchStartResize}
        title="Click and drag horizontally with mouse to scale panel width (1-12 columns)"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};

export default PanelWrapper;
