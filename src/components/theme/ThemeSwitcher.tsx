'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { canUseCookies } from '../../utils/consent';
import { CookieCategory } from '../../utils/consent-types';
import { useAnalytics } from '@/hooks/useAnalytics';

// DaisyUI themes
const THEMES = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
];

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState('light');
  const { trackThemeChange } = useAnalytics();

  useEffect(() => {
    // Check if we can use persistent storage
    const canPersist = canUseCookies(CookieCategory.FUNCTIONAL);

    // Try to load saved theme
    let savedTheme = 'light';

    if (canPersist) {
      // Use localStorage if functional cookies allowed
      savedTheme = localStorage.getItem('theme') || 'light';
    } else {
      // Use sessionStorage as fallback
      savedTheme = sessionStorage.getItem('theme') || 'light';
    }

    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleThemeChange = useCallback(
    (theme: string) => {
      const previousTheme = currentTheme;
      setCurrentTheme(theme);

      // Track theme change in analytics
      trackThemeChange(theme, previousTheme);

      // Apply to DOM
      document.documentElement.setAttribute('data-theme', theme);
      document.body?.setAttribute('data-theme', theme);

      // Check if we can persist the preference
      const canPersist = canUseCookies(CookieCategory.FUNCTIONAL);

      if (canPersist) {
        // Save to localStorage for persistence across sessions
        localStorage.setItem('theme', theme);
        // Also save to sessionStorage for consistency
        sessionStorage.setItem('theme', theme);

        // Broadcast to other tabs/windows
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'theme',
            newValue: theme,
            url: window.location.href,
            storageArea: localStorage,
          })
        );
      } else {
        // Only save to sessionStorage for current session
        sessionStorage.setItem('theme', theme);
      }

      // Force update service worker if available
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'THEME_CHANGE',
          theme: theme,
        });
      }
    },
    [currentTheme, trackThemeChange]
  );

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Theme Selector</h2>
        <p className="text-sm opacity-70">Choose from 32 DaisyUI themes</p>

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
