'use client';

import React, { useRef, useEffect, useId } from 'react';
import { useColorblindMode } from '@/hooks/useColorblindMode';
import { ColorblindType, COLORBLIND_LABELS } from '@/utils/colorblind';

/** The assistance modes offered, in menu order. Static data — it was being
 *  rebuilt on every render, and both the panel and the trigger need it. */
const COLORBLIND_OPTIONS = [
  { value: ColorblindType.NONE, label: 'No Correction Needed' },
  {
    value: ColorblindType.PROTANOPIA,
    label: 'Protanopia (Red-Blind) Correction',
  },
  {
    value: ColorblindType.PROTANOMALY,
    label: 'Protanomaly (Red-Weak) Correction',
  },
  {
    value: ColorblindType.DEUTERANOPIA,
    label: 'Deuteranopia (Green-Blind) Correction',
  },
  {
    value: ColorblindType.DEUTERANOMALY,
    label: 'Deuteranomaly (Green-Weak) Correction',
  },
  {
    value: ColorblindType.TRITANOPIA,
    label: 'Tritanopia (Blue-Blind) Correction',
  },
  {
    value: ColorblindType.TRITANOMALY,
    label: 'Tritanomaly (Blue-Weak) Correction',
  },
  {
    value: ColorblindType.ACHROMATOPSIA,
    label: 'Achromatopsia (No Color) Enhancement',
  },
  {
    value: ColorblindType.ACHROMATOMALY,
    label: 'Achromatomaly (Partial Color) Enhancement',
  },
];

export interface ColorblindToggleProps {
  className?: string;
}

/**
 * The colour-vision controls WITHOUT a popover of their own (#378).
 *
 * `Display ▾` hosts this beside the theme and text-settings panels. Nesting the
 * dropdown below inside that menu would put two popovers and two focus traps in
 * one control, so the panel stands alone and {@link ColorblindToggle} is this
 * panel plus a trigger.
 */
export const ColorVisionPanel: React.FC = () => {
  const { mode, setColorblindMode, patternsEnabled, togglePatterns } =
    useColorblindMode();
  // A literal id would collide if two panels are mounted at once.
  const selectId = useId();

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setColorblindMode(e.target.value as ColorblindType);
  };

  return (
    <div>
      {/* A SECTION LABEL, not a page heading (#469). As a standalone popover
          this was `text-lg font-bold`; inside `Display ▾` that put it a whole
          tier above the "TEXT SETTINGS" and "THEME" labels beside it, and it
          wrapped to two lines at 390px — measured 25.7px/80px against their
          18.5px/26px. */}
      <h3 className="mb-2 text-sm font-semibold tracking-wide uppercase">
        Color Vision Assistance
      </h3>

      <div>
        <label className="label" htmlFor={selectId}>
          <span>Assistance Mode</span>
        </label>
        <select
          id={selectId}
          className="select min-h-11 w-full"
          value={mode}
          onChange={handleModeChange}
          aria-label="Select assistance mode"
        >
          {COLORBLIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {mode !== ColorblindType.NONE && (
        <div className="mt-4">
          <label className="label min-h-11 cursor-pointer">
            <span>Enable Patterns</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={patternsEnabled}
              onChange={togglePatterns}
              aria-label="Toggle pattern overlays"
            />
          </label>
          <span className="text-sm">
            Adds patterns to help distinguish colors
          </span>
        </div>
      )}

      {/* A hint line, not an `alert` (#469): the tinted block measured 105px
          for one sentence inside a menu. `role="status"` and `aria-live` stay —
          the announcement when the mode changes is the point of this text. */}
      <div
        className="text-base-content mt-3 text-sm"
        role="status"
        aria-live="polite"
      >
        <span>
          {mode === ColorblindType.NONE
            ? 'Select your color vision type for visual assistance'
            : `Correcting for ${COLORBLIND_LABELS[mode]}`}
        </span>
      </div>
    </div>
  );
};

export const ColorblindToggle: React.FC<ColorblindToggleProps> = ({
  className = '',
}) => {
  const { mode, setColorblindMode, patternsEnabled, togglePatterns } =
    useColorblindMode();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        // Close the dropdown by removing focus
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && dropdownRef.current.contains(activeElement)) {
          activeElement.blur();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape key handler to close dropdown
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && dropdownRef.current?.contains(activeElement)) {
          const trigger = dropdownRef.current.querySelector('button');
          trigger?.blur();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setColorblindMode(e.target.value as ColorblindType);
  };

  const handlePatternToggle = () => {
    togglePatterns();
  };

  // Icon based on mode
  const IconComponent = mode === ColorblindType.NONE ? EyeIcon : EyeOffIcon;

  const isCompact = className?.includes('compact');

  return (
    <div className={`dropdown dropdown-end ${className}`} ref={dropdownRef}>
      <button
        tabIndex={0}
        className={
          isCompact
            ? // min-h-11 min-w-11 because DaisyUI's `btn-md` is 40px, four
              // short of the 44px this repo gates on. Pre-existing: the
              // compact toggle has sat in the nav at 40px and nothing measured
              // it, because the touch-target gate runs at 390px where this
              // control is `hidden lg:block` (#378).
              'btn btn-ghost btn-circle btn-xs sm:btn-md min-h-11 min-w-11'
            : 'btn btn-ghost gap-2'
        }
        aria-label="Color Vision Assistance"
        title="Color vision assistance"
      >
        <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" />
        {!isCompact && <span className="hidden sm:inline">Color Vision</span>}
      </button>

      <div
        tabIndex={0}
        className="dropdown-content card card-sm bg-base-100 z-50 w-64 max-w-[calc(100vw-2rem)] p-4 shadow sm:w-80"
      >
        <div className="card-body">
          <ColorVisionPanel />
        </div>
      </div>
    </div>
  );
};

// Simple Eye icon component
const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
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
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

// Simple EyeOff icon component
const EyeOffIcon: React.FC<{ className?: string }> = ({ className }) => (
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
      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
    />
  </svg>
);
