import React from 'react';
import { GripVertical, Trash2, Plus, Minus } from 'lucide-react';
import { WidgetConfig } from '../types';

interface WidgetContainerProps {
  widget: WidgetConfig;
  isEditing: boolean;
  onRemove: (id: string) => void;
  onResizeWidth: (id: string, delta: number) => void;
  children: React.ReactNode;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  widget,
  isEditing,
  onRemove,
  onResizeWidth,
  children,
}) => {
  // Map grid_w to Tailwind column span class
  const getColSpanClass = (w: number) => {
    switch (w) {
      case 12:
        return 'col-span-12';
      case 8:
        return 'col-span-12 lg:col-span-8';
      case 6:
        return 'col-span-12 md:col-span-6';
      case 4:
        return 'col-span-12 md:col-span-6 lg:col-span-4';
      case 3:
        return 'col-span-12 sm:col-span-6 lg:col-span-3';
      default:
        return 'col-span-12 md:col-span-6';
    }
  };

  return (
    <div
      className={`${getColSpanClass(
        widget.grid_w
      )} bg-surface border rounded-lg transition-all shadow-solid relative flex flex-col min-h-[160px] ${
        isEditing
          ? 'border-accent/60 ring-1 ring-accent/30'
          : 'border-[var(--racklyt-border-weak)] hover:border-[var(--racklyt-border-medium)]'
      }`}
    >
      {isEditing && (
        <div className="bg-elevated border-b border-subtle px-3 py-1.5 flex items-center justify-between text-xs text-mutedText">
          <div className="flex items-center space-x-1.5 font-mono">
            <GripVertical className="w-4 h-4 text-accent cursor-move" />
            <span className="text-primaryText font-medium text-[11px] truncate max-w-[140px]">
              {widget.title}
            </span>
            <span className="text-[10px] text-mutedText">({widget.grid_w}/12 cols)</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => onResizeWidth(widget.id, -1)}
              disabled={widget.grid_w <= 3}
              className="p-1 hover:bg-subtle disabled:opacity-30 rounded text-mutedText hover:text-primaryText"
              title="Narrow widget"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onResizeWidth(widget.id, 1)}
              disabled={widget.grid_w >= 12}
              className="p-1 hover:bg-subtle disabled:opacity-30 rounded text-mutedText hover:text-primaryText"
              title="Widen widget"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onRemove(widget.id)}
              className="p-1 hover:bg-coral/20 rounded text-mutedText hover:text-coral transition ml-1"
              title="Remove widget"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 w-full h-full">{children}</div>
    </div>
  );
};
