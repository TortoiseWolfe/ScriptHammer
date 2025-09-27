'use client';

import React, { useRef, useEffect } from 'react';
import { useColorblindMode } from '@/hooks/useColorblindMode';
import { ColorblindType, COLORBLIND_LABELS } from '@/utils/colorblind';

export interface ColorblindToggleProps {
  className?: string;
}

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

  const colorblindOptions = [
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
            ? 'btn btn-ghost btn-circle btn-xs sm:btn-md'
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
        className="dropdown-content card card-compact bg-base-100 z-50 w-64 max-w-[calc(100vw-2rem)] p-4 shadow sm:w-80"
      >
        <div className="card-body">
          <h3 className="text-lg font-bold">Color Vision Assistance</h3>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Assistance Mode</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={mode}
              onChange={handleModeChange}
              aria-label="Select assistance mode"
            >
              {colorblindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {mode !== ColorblindType.NONE && (
            <div className="form-control mt-4">
              <label className="label cursor-pointer">
                <span className="label-text">Enable Patterns</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={patternsEnabled}
                  onChange={handlePatternToggle}
                  aria-label="Toggle pattern overlays"
                />
              </label>
              <span className="label-text-alt">
                Adds patterns to help distinguish colors
              </span>
            </div>
          )}

          <div
            className="alert alert-info mt-4"
            role="status"
            aria-live="polite"
          >
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
              {mode === ColorblindType.NONE
                ? 'Select your color vision type for visual assistance'
                : `Correcting for ${COLORBLIND_LABELS[mode]}`}
            </span>
          </div>
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
