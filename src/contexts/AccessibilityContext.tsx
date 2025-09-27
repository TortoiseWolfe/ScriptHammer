'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { canUseCookies } from '../utils/consent';
import { CookieCategory } from '../utils/consent-types';

type FontSize = 'small' | 'medium' | 'large' | 'x-large';
type LineHeight = 'compact' | 'normal' | 'relaxed';
type FontFamily = 'sans-serif' | 'serif' | 'mono';
type ContrastMode = 'normal' | 'high';
type MotionPreference = 'no-preference' | 'reduce';

interface AccessibilitySettings {
  fontSize: FontSize;
  lineHeight: LineHeight;
  fontFamily: FontFamily;
  highContrast: ContrastMode;
  reduceMotion: MotionPreference;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: AccessibilitySettings = {
  fontSize: 'medium',
  lineHeight: 'normal',
  fontFamily: 'sans-serif',
  highContrast: 'normal',
  reduceMotion: 'no-preference',
};

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
    // Font scale factors
    const scaleFactors: Record<FontSize, number> = {
      small: 1.25, // 20px - minimum comfortable size
      medium: 1.5, // 24px - good default
      large: 1.75, // 28px - easy to read
      'x-large': 2.125, // 34px - very accessible
    };

    // Line heights
    const lineHeights: Record<LineHeight, string> = {
      compact: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    };

    // Font families
    const fontFamilies: Record<FontFamily, string> = {
      'sans-serif':
        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    };

    const root = document.documentElement;

    root.style.setProperty(
      '--font-scale-factor',
      scaleFactors[newSettings.fontSize].toString()
    );
    root.style.setProperty(
      '--base-line-height',
      lineHeights[newSettings.lineHeight]
    );
    root.style.setProperty(
      '--base-font-family',
      fontFamilies[newSettings.fontFamily]
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
    document.body.style.fontFamily = fontFamilies[newSettings.fontFamily];
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
        const newSettings: AccessibilitySettings = {
          fontSize:
            (localStorage.getItem('fontSize') as FontSize) || settings.fontSize,
          lineHeight:
            (localStorage.getItem('lineHeight') as LineHeight) ||
            settings.lineHeight,
          fontFamily:
            (localStorage.getItem('fontFamily') as FontFamily) ||
            settings.fontFamily,
          highContrast:
            (localStorage.getItem('highContrast') as ContrastMode) ||
            settings.highContrast,
          reduceMotion:
            (localStorage.getItem('reduceMotion') as MotionPreference) ||
            settings.reduceMotion,
        };
        setSettings(newSettings);
        applySettings(newSettings);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [settings, applySettings]);

  // Update settings function (respecting consent)
  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    const canPersist = canUseCookies(CookieCategory.FUNCTIONAL);
    const storage = canPersist ? localStorage : sessionStorage;

    // Save to appropriate storage
    if (newSettings.fontSize) storage.setItem('fontSize', newSettings.fontSize);
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

    // Dispatch storage event for same-tab updates (only if using localStorage)
    if (canPersist) {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: Object.keys(newSettings)[0],
          newValue: Object.values(newSettings)[0],
          url: window.location.href,
        })
      );
    }
  };

  // Reset settings function
  const resetSettings = () => {
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
  };

  return (
    <AccessibilityContext.Provider
      value={{ settings, updateSettings, resetSettings }}
    >
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
