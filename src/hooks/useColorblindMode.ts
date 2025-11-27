'use client';

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '@/lib/logger';
import {
  ColorblindType,
  ColorblindSettings,
  DEFAULT_COLORBLIND_SETTINGS,
  COLORBLIND_STORAGE_KEY,
  COLORBLIND_FILTER_IDS,
} from '@/utils/colorblind';

const logger = createLogger('hooks:colorblindMode');

/**
 * Custom hook for managing colorblind mode settings
 * Handles state, persistence, and DOM manipulation
 */
export function useColorblindMode() {
  const [mode, setMode] = useState<ColorblindType>(
    DEFAULT_COLORBLIND_SETTINGS.mode
  );
  const [patternsEnabled, setPatternsEnabled] = useState(
    DEFAULT_COLORBLIND_SETTINGS.patternsEnabled
  );

  // Apply colorblind mode to the DOM
  const applyColorblindMode = useCallback(
    (type: ColorblindType, patterns: boolean) => {
      try {
        const root = document.documentElement;
        const body = document.body;

        // Apply SVG filter
        const filterValue = COLORBLIND_FILTER_IDS[type] || 'none';
        root.style.setProperty('--colorblind-filter', filterValue);
        body.style.filter = filterValue;

        // Apply pattern classes
        if (patterns && type !== ColorblindType.NONE) {
          root.classList.add('colorblind-patterns');
        } else {
          root.classList.remove('colorblind-patterns');
        }
      } catch (error) {
        logger.error('Failed to apply colorblind mode', { error });
      }
    },
    []
  );

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLORBLIND_STORAGE_KEY);
      if (saved) {
        const settings: ColorblindSettings = JSON.parse(saved);
        if (
          settings.mode &&
          Object.values(ColorblindType).includes(settings.mode)
        ) {
          setMode(settings.mode);
          setPatternsEnabled(settings.patternsEnabled ?? false);
          applyColorblindMode(settings.mode, settings.patternsEnabled ?? false);
        }
      }
    } catch (error) {
      logger.error('Failed to load colorblind settings', { error });
    }
  }, [applyColorblindMode]);

  // Save settings to localStorage
  const saveSettings = useCallback((settings: ColorblindSettings) => {
    try {
      localStorage.setItem(COLORBLIND_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      logger.error('Failed to save colorblind settings', { error });
    }
  }, []);

  // Set colorblind mode
  const setColorblindMode = useCallback(
    (type: ColorblindType) => {
      // Validate input
      if (!Object.values(ColorblindType).includes(type)) {
        logger.warn('Invalid colorblind type', { type });
        return;
      }

      setMode(type);
      applyColorblindMode(type, patternsEnabled);

      const settings: ColorblindSettings = {
        mode: type,
        patternsEnabled,
      };
      saveSettings(settings);
    },
    [patternsEnabled, applyColorblindMode, saveSettings]
  );

  // Toggle pattern overlays
  const togglePatterns = useCallback(() => {
    const newPatternsState = !patternsEnabled;
    setPatternsEnabled(newPatternsState);
    applyColorblindMode(mode, newPatternsState);

    const settings: ColorblindSettings = {
      mode,
      patternsEnabled: newPatternsState,
    };
    saveSettings(settings);
  }, [mode, patternsEnabled, applyColorblindMode, saveSettings]);

  return {
    mode,
    setColorblindMode,
    patternsEnabled,
    togglePatterns,
  };
}
