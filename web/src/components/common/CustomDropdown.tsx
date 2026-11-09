import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  description?: string;
}

export interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
  ariaLabel?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
  size = 'md',
  id,
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Sync highlighted index when opened
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((opt) => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, value, options]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          onChange(options[highlightedIndex].value);
          setIsOpen(false);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  // Sizing styles
  const sizeClasses = {
    sm: 'text-xs py-1 px-2.5 min-h-[28px]',
    md: 'text-xs py-2 px-3 min-h-[36px]',
    lg: 'text-sm py-2.5 px-3.5 min-h-[42px]',
  }[size];

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block w-full text-left font-sans ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        id={id}
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between rounded bg-[var(--racklyt-bg-input)] border transition-all text-left outline-none ${sizeClasses} ${
          isOpen
            ? 'border-[var(--racklyt-orange)] ring-1 ring-[var(--racklyt-orange)]/30 shadow-md'
            : 'border-[var(--racklyt-border-medium)] hover:border-[var(--racklyt-border-strong)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--racklyt-bg-subtle)]' : 'cursor-pointer hover:bg-[var(--racklyt-bg-panel)]'}`}
      >
        <div className="flex items-center space-x-2 truncate mr-2">
          {selectedOption?.icon && (
            <span className="shrink-0 text-mutedText flex items-center">
              {selectedOption.icon}
            </span>
          )}
          <span
            className={`truncate font-medium ${
              selectedOption ? 'text-primaryText' : 'text-mutedText'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={`shrink-0 text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                selectedOption.badgeColor ||
                'bg-[var(--racklyt-orange)]/10 text-[var(--racklyt-orange)] border-[var(--racklyt-orange)]/30'
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={size === 'sm' ? 13 : 15}
          className={`shrink-0 text-mutedText transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--racklyt-orange)]' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] shadow-2xl backdrop-blur-xl py-1 focus:outline-none animate-fadeIn"
          style={{ minWidth: '100%' }}
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-xs text-mutedText text-center font-mono">
              No options available
            </li>
          ) : (
            options.map((option, idx) => {
              const isSelected = option.value === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isHighlighted
                      ? 'bg-[var(--racklyt-bg-subtle)] text-primaryText'
                      : 'text-primaryText'
                  } ${
                    isSelected
                      ? 'bg-[var(--racklyt-orange)]/10 font-semibold text-[var(--racklyt-orange)]'
                      : ''
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate mr-2">
                    {option.icon && (
                      <span
                        className={`shrink-0 ${
                          isSelected ? 'text-[var(--racklyt-orange)]' : 'text-mutedText'
                        }`}
                      >
                        {option.icon}
                      </span>
                    )}
                    <div className="flex flex-col truncate">
                      <span className="truncate">{option.label}</span>
                      {option.description && (
                        <span className="text-[10px] text-mutedText font-normal truncate">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {option.badge && (
                      <span
                        className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded border ${
                          option.badgeColor ||
                          'bg-[var(--racklyt-bg-subtle)] text-mutedText border-[var(--racklyt-border-weak)]'
                        }`}
                      >
                        {option.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check
                        size={13}
                        className="text-[var(--racklyt-orange)] stroke-[2.5]"
                      />
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};
