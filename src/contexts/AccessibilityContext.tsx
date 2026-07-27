'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { canUseCookies } from '../utils/consent';
import { CookieCategory } from '../utils/consent-types';
import {
  DEFAULT_ACCESSIBILITY_SETTINGS,
  FONT_FAMILIES,
  DISPLAY_FONT_FAMILIES,
  FONT_SCALE_FACTORS,
  LINE_HEIGHTS,
  type AccessibilitySettings,
  type ContrastMode,
  type FontFamily,
  type FontSize,
  type LineHeight,
  type MotionPreference,
} from '@/config/accessibility-tokens';

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  resetSettings: () => void;
}

// Shared with AccessibilityScript, which serialises the same values into a
// pre-paint inline script. Do not re-declare these locally (#388).
const defaultSettings = DEFAULT_ACCESSIBILITY_SETTINGS;

const AccessibilityContext = createContext<
  AccessibilityContextType | undefined
>(undefined);

export function AccessibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] =
    useState<AccessibilitySettings>(defaultSettings);

  // Apply settings to DOM
  const applySettings = useCallback((newSettings: AccessibilitySettings) => {
    // Token maps live in @/config/accessibility-tokens so AccessibilityScript
    // can serialise the identical values into its pre-paint inline script.
    const scaleFactors = FONT_SCALE_FACTORS;
    const lineHeights = LINE_HEIGHTS;
    const fontFamilies = FONT_FAMILIES;
    const displayFontFamilies = DISPLAY_FONT_FAMILIES;

    const root = document.documentElement;

    root.style.setProperty(
      '--font-scale-factor',
      scaleFactors[newSettings.fontSize].toString()
    );
    root.style.setProperty(
      '--base-line-height',
      lineHeights[newSettings.lineHeight]
    );

    // The single channel for font choice (#377). globals.css applies these to
    // `body` and to h1-h6 respectively. Setting a CSS variable rather than
    // `document.body.style.fontFamily` matters twice over: an inline style
    // outranks every stylesheet rule (so the brand face could never show), and
    // the FontSwitcher writes the same choice — as an inline style the two
    // controls raced on one property and the last writer silently won.
    root.style.setProperty(
      '--sh-font-body',
      fontFamilies[newSettings.fontFamily]
    );
    root.style.setProperty(
      '--sh-font-display',
      displayFontFamilies[newSettings.fontFamily]
    );

    // Apply high contrast mode
    if (newSettings.highContrast === 'high') {
      root.setAttribute('data-high-contrast', 'true');
      root.style.setProperty('--contrast-boost', '1.2');
    } else {
      root.removeAttribute('data-high-contrast');
      root.style.setProperty('--contrast-boost', '1');
    }

    // Apply reduced motion preference
    if (newSettings.reduceMotion === 'reduce') {
      root.setAttribute('data-reduce-motion', 'true');
    } else {
      root.removeAttribute('data-reduce-motion');
    }

    document.body.style.lineHeight = lineHeights[newSettings.lineHeight];
  }, []);

  // Load settings from storage on mount (respecting consent)
  useEffect(() => {
    const canPersist = canUseCookies(CookieCategory.FUNCTIONAL);
    const storage = canPersist ? localStorage : sessionStorage;

    const savedFontSize = storage.getItem('fontSize') as FontSize;
    const savedLineHeight = storage.getItem('lineHeight') as LineHeight;
    const savedFontFamily = storage.getItem('fontFamily') as FontFamily;
    const savedHighContrast = storage.getItem('highContrast') as ContrastMode;
    const savedReduceMotion = storage.getItem(
      'reduceMotion'
    ) as MotionPreference;

    const initialSettings: AccessibilitySettings = {
      fontSize: savedFontSize || defaultSettings.fontSize,
      lineHeight: savedLineHeight || defaultSettings.lineHeight,
      fontFamily: savedFontFamily || defaultSettings.fontFamily,
      highContrast: savedHighContrast || defaultSettings.highContrast,
      reduceMotion: savedReduceMotion || defaultSettings.reduceMotion,
    };

    setSettings(initialSettings);
    applySettings(initialSettings);
  }, [applySettings]);

  // Mirror current settings into a ref so the cross-tab storage listener
  // can read fallback values without depending on `settings` (which would
  // tear down + re-register the listener on every settings change and
  // double-apply settings during cross-tab sync).
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Listen for storage events (changes from other tabs/windows)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'fontSize' ||
        e.key === 'lineHeight' ||
        e.key === 'fontFamily' ||
        e.key === 'highContrast' ||
        e.key === 'reduceMotion'
      ) {
        const current = settingsRef.current;
        const newSettings: AccessibilitySettings = {
          fontSize:
            (localStorage.getItem('fontSize') as FontSize) || current.fontSize,
          lineHeight:
            (localStorage.getItem('lineHeight') as LineHeight) ||
            current.lineHeight,
          fontFamily:
            (localStorage.getItem('fontFamily') as FontFamily) ||
            current.fontFamily,
          highContrast:
            (localStorage.getItem('highContrast') as ContrastMode) ||
            current.highContrast,
          reduceMotion:
            (localStorage.getItem('reduceMotion') as MotionPreference) ||
            current.reduceMotion,
        };
        setSettings(newSettings);
        applySettings(newSettings);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [applySettings]);

  // Update settings function (respecting consent)
  const updateSettings = useCallback(
    (newSettings: Partial<AccessibilitySettings>) => {
      const updatedSettings = { ...settingsRef.current, ...newSettings };
      const canPersist = canUseCookies(CookieCategory.FUNCTIONAL);
      const storage = canPersist ? localStorage : sessionStorage;

      // Save to appropriate storage
      if (newSettings.fontSize)
        storage.setItem('fontSize', newSettings.fontSize);
      if (newSettings.lineHeight)
        storage.setItem('lineHeight', newSettings.lineHeight);
      if (newSettings.fontFamily)
        storage.setItem('fontFamily', newSettings.fontFamily);
      if (newSettings.highContrast)
        storage.setItem('highContrast', newSettings.highContrast);
      if (newSettings.reduceMotion)
        storage.setItem('reduceMotion', newSettings.reduceMotion);

      // Update state and apply
      setSettings(updatedSettings);
      applySettings(updatedSettings);

      // Note: No need to dispatch StorageEvent to self — state is already
      // updated via setSettings/applySettings above. The storage event listener
      // handles cross-tab synchronization natively.
    },
    [applySettings]
  );

  // Reset settings function
  const resetSettings = useCallback(() => {
    // Clear from both storages
    [
      'fontSize',
      'lineHeight',
      'fontFamily',
      'highContrast',
      'reduceMotion',
    ].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    setSettings(defaultSettings);
    applySettings(defaultSettings);
  }, [applySettings]);

  // Memoize provider value so consumers don't re-render on every parent
  // render. ConsentContext does this correctly; copy that pattern here.
  const value = useMemo<AccessibilityContextType>(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error(
      'useAccessibility must be used within AccessibilityProvider'
    );
  }
  return context;
}
