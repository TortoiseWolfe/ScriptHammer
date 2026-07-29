'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';

import { THEMES } from '@/config/themes';
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
        <p className="text-base-content/85 text-sm">
          Choose from 34 themes (2 custom + 32 DaisyUI)
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
