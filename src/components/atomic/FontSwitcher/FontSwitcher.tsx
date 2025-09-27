'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useFontFamily } from '@/hooks/useFontFamily';

export interface FontSwitcherProps {
  className?: string;
}

export const FontSwitcher: React.FC<FontSwitcherProps> = ({
  className = '',
}) => {
  const {
    fontFamily,
    currentFontConfig,
    fonts,
    setFontFamily,
    isFontLoaded,
    recentFonts,
  } = useFontFamily();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFontSelect = (fontId: string) => {
    setFontFamily(fontId);
    // Close dropdown by removing focus
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Focus management
  useEffect(() => {
    if (isOpen && focusedIndex >= 0) {
      const option = document.querySelector(
        `[data-font-index="${focusedIndex}"]`
      ) as HTMLElement;
      option?.focus();
    }
  }, [focusedIndex, isOpen]);

  // Group fonts by recent
  const recentFontObjects = recentFonts
    .map((id) => fonts.find((f) => f.id === id))
    .filter(Boolean);
  const otherFonts = fonts.filter((f) => !recentFonts.includes(f.id));

  return (
    <div className={`dropdown dropdown-end ${className}`} ref={dropdownRef}>
      <label
        tabIndex={0}
        className="btn btn-ghost gap-2"
        aria-label="Font Selection"
        role="button"
      >
        <FontIcon className="h-5 w-5" />
        <span className="hidden sm:inline">
          {currentFontConfig?.name || 'Select Font'}
        </span>
      </label>
      <div
        tabIndex={0}
        className="dropdown-content menu card card-compact bg-base-100 z-[100] mt-2 w-80 p-4 shadow-xl"
      >
        <div className="card-body">
          <h3 className="mb-2 text-lg font-bold">Font Selection</h3>

          {/* Recent fonts section */}
          {recentFontObjects.length > 0 && (
            <>
              <div className="text-sm font-semibold opacity-60">Recent</div>
              <div
                className="mb-3 space-y-1"
                role="listbox"
                aria-label="Recent fonts"
              >
                {recentFontObjects.map((font, index) => (
                  <FontOption
                    key={font!.id}
                    font={font!}
                    isActive={font!.id === fontFamily}
                    isLoaded={isFontLoaded(font!.id)}
                    onSelect={handleFontSelect}
                    dataIndex={index}
                  />
                ))}
              </div>
              <div className="divider my-2"></div>
            </>
          )}

          {/* All fonts */}
          <div className="text-sm font-semibold opacity-60">All Fonts</div>
          <div className="space-y-1" role="listbox" aria-label="Font options">
            {otherFonts.map((font, index) => (
              <FontOption
                key={font.id}
                font={font}
                isActive={font.id === fontFamily}
                isLoaded={isFontLoaded(font.id)}
                onSelect={handleFontSelect}
                dataIndex={recentFontObjects.length + index}
              />
            ))}
          </div>

          {/* Info alert */}
          <div className="alert alert-info mt-4" role="status">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="h-6 w-6 shrink-0 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm">
              {currentFontConfig?.accessibility
                ? `Using ${currentFontConfig.name} (${currentFontConfig.accessibility})`
                : `Using ${currentFontConfig?.name || 'default font'}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Font option component
interface FontOptionProps {
  font: NonNullable<ReturnType<typeof useFontFamily>['fonts'][0]>;
  isActive: boolean;
  isLoaded: boolean;
  onSelect: (fontId: string) => void;
  dataIndex: number;
}

const FontOption: React.FC<FontOptionProps> = ({
  font,
  isActive,
  isLoaded,
  onSelect,
  dataIndex,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSelect(font.id);
    }
  };

  return (
    <button
      role="option"
      aria-selected={isActive ? 'true' : 'false'}
      data-font-index={dataIndex}
      onClick={() => onSelect(font.id)}
      onKeyDown={handleKeyDown}
      className={`hover:bg-base-200 w-full rounded-lg p-3 text-left transition-colors ${
        isActive ? 'bg-primary text-primary-content active' : ''
      }`}
      style={{ fontFamily: font.stack }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 font-semibold">
            {font.name}
            {!isLoaded && font.loading !== 'system' && (
              <span className="loading loading-spinner loading-xs"></span>
            )}
          </div>
          <div className="mt-1 text-sm opacity-60">{font.description}</div>
        </div>
        {font.accessibility && (
          <span className="badge badge-success badge-sm mt-1">
            {font.accessibility}
          </span>
        )}
      </div>
    </button>
  );
};

// Font icon component
const FontIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
    />
  </svg>
);

export default FontSwitcher;
