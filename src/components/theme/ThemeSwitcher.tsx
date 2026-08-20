'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';

import {
  THEMES,
  THEME_COUNT,
  HOUSE_THEME_COUNT,
  DAISYUI_THEME_COUNT,
} from '@/config/themes';
import {
  applyTheme,
  readStoredTheme,
  DEFAULT_THEME,
} from '@/utils/apply-theme';

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);
  const { trackThemeChange } = useAnalytics();

  useEffect(() => {
    const savedTheme = readStoredTheme();

    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleThemeChange = useCallback(
    (theme: string) => {
      const previousTheme = currentTheme;
      setCurrentTheme(theme);

      // Track theme change in analytics
      trackThemeChange(theme, previousTheme);

      // One implementation, shared with /themes' curated plates (#382).
      applyTheme(theme);
    },
    [currentTheme, trackThemeChange]
  );

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Theme Selector</h2>
        {/* Derived, not written down (#514). Both numbers were hardcoded here
            and happened to be correct — 34 = 2 + 32 — which is exactly how a
            claim survives long enough to go stale: it reads right until
            someone adds a theme, and then it is wrong on a live page with
            nothing checking. */}
        <p className="text-base-content text-sm">
          Choose from {THEME_COUNT} themes ({HOUSE_THEME_COUNT} house +{' '}
          {DAISYUI_THEME_COUNT} DaisyUI)
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {THEMES.map((theme) => (
            <button
              key={theme}
              onClick={() => handleThemeChange(theme)}
              className={`btn btn-sm ${
                currentTheme === theme ? 'btn-primary' : 'btn-ghost'
              }`}
              data-theme={theme}
            >
              <span className="capitalize">{theme}</span>
            </button>
          ))}
        </div>

        <div className="divider">Preview</div>

        <div className="flex flex-wrap gap-2">
          <div className="badge badge-primary">Primary</div>
          <div className="badge badge-secondary">Secondary</div>
          <div className="badge badge-accent">Accent</div>
          <div className="badge badge-neutral">Neutral</div>
          <div className="badge badge-info">Info</div>
          <div className="badge badge-success">Success</div>
          <div className="badge badge-warning">Warning</div>
          <div className="badge badge-error">Error</div>
        </div>

        <div className="mt-4">
          <button className="btn btn-primary">Primary Button</button>
          <button className="btn btn-secondary ml-2">Secondary</button>
        </div>
      </div>
    </div>
  );
}

export default ThemeSwitcher;
