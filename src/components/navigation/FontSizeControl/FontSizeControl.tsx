'use client';

import React from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/contexts/AccessibilityContext';

/**
 * The text-settings controls WITHOUT a popover of their own (#378).
 *
 * `Display ▾` needs to host these next to the theme and colour-vision controls,
 * and nesting this component's DaisyUI dropdown inside that menu would mean two
 * popovers and two competing focus traps. So the panel is its own component and
 * `FontSizeControl` below is just this panel plus a trigger.
 */
export function TextSettingsPanel() {
  const { settings, updateSettings, resetSettings } = useAccessibility();
  const { fontSize, lineHeight } = settings;

  return (
    <div>
      <h3 className="text-base-content mb-3 text-sm font-semibold tracking-wide uppercase">
        Text Settings
      </h3>

      {/* Font Size */}
      <div className="mb-4">
        <label className="text-base-content mb-2 block text-xs font-medium">
          Size
        </label>
        <div className="btn-group btn-group-horizontal w-full">
          {(['small', 'medium', 'large', 'x-large'] as const).map((size) => (
            <button
              key={size}
              onClick={() => updateSettings({ fontSize: size })}
              className={`btn min-h-11 min-w-11 flex-1 ${
                fontSize === size ? 'btn-primary' : 'btn-ghost'
              }`}
              title={
                size.charAt(0).toUpperCase() + size.slice(1).replace('-', ' ')
              }
            >
              {size === 'small'
                ? 'S'
                : size === 'medium'
                  ? 'M'
                  : size === 'large'
                    ? 'L'
                    : 'XL'}
            </button>
          ))}
        </div>
      </div>

      {/* Line Height */}
      <div className="mb-4">
        <label className="text-base-content mb-2 block text-xs font-medium">
          Spacing
        </label>
        <div className="btn-group btn-group-horizontal w-full">
          {(['compact', 'normal', 'relaxed'] as const).map((height) => (
            <button
              key={height}
              onClick={() => updateSettings({ lineHeight: height })}
              className={`btn min-h-11 min-w-11 flex-1 ${
                lineHeight === height ? 'btn-primary' : 'btn-ghost'
              }`}
            >
              {height === 'compact'
                ? '1.2'
                : height === 'normal'
                  ? '1.5'
                  : '1.8'}
            </button>
          ))}
        </div>
      </div>

      <div className="divider my-2"></div>

      <div className="flex gap-2">
        {/* Reset button */}
        <button
          onClick={resetSettings}
          className="btn btn-outline min-h-11 flex-1"
          title="Reset all accessibility settings to defaults"
        >
          Reset
        </button>

        {/* Link to accessibility page with wheelchair icon */}
        <Link
          href="/accessibility"
          className="btn btn-ghost min-h-11 flex-1"
          title="All accessibility options"
          aria-label="View all accessibility options"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M21 9H15L13.5 7.5C13.1 7.1 12.6 6.9 12 6.9S10.9 7.1 10.5 7.5L7.91 10.09C7.66 10.34 7.66 10.76 7.91 11.01L10.5 13.6C10.9 14 11.4 14.2 12 14.2S13.1 14 13.5 13.6L15 12.1H21C21.6 12.1 22 11.7 22 11.1V10C22 9.4 21.6 9 21 9M8.5 12.5L12 16L15.5 12.5L12 22L8.5 12.5Z"
            />
          </svg>
          <span className="hidden sm:inline">More Options</span>
          <span className="sm:hidden">Options</span>
        </Link>
      </div>
    </div>
  );
}

/**
 * The nav's text-settings control: {@link TextSettingsPanel} behind a trigger.
 *
 * Still a DaisyUI `:focus-within` dropdown, which is NOT keyboard-correct — the
 * trigger is a `<label>` with no `aria-expanded` and Escape cannot return focus
 * without re-opening it (see `GlobalNav`'s `NavGroupMenu` for why). That is
 * #378's `Display ▾` work; this wrapper exists so extracting the panel changes
 * nothing about the current nav in the meantime.
 */
export function FontSizeControl() {
  return (
    <div className="dropdown dropdown-end">
      <label
        tabIndex={0}
        className="btn btn-ghost btn-circle min-h-11 min-w-11"
        title="Text size and spacing"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 sm:h-5 sm:w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h12m-6 6h6"
          />
        </svg>
      </label>
      <div
        tabIndex={0}
        className="dropdown-content bg-base-100 rounded-box z-[1] w-56 max-w-[calc(100vw-2rem)] p-4 shadow-lg sm:w-72"
      >
        <TextSettingsPanel />
      </div>
    </div>
  );
}
