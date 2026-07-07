'use client';

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '@/lib/logger';
import type { UseFontFamilyReturn, FontSettings } from '@/utils/font-types';
import { loadFont, isFontLoaded as checkFontLoaded } from '@/utils/font-loader';
import {
  fonts,
  getFontById,
  DEFAULT_FONT_ID,
  FONT_STORAGE_KEYS,
  FONT_CSS_VARS,
  MAX_RECENT_FONTS,
} from '@/config/fonts';

const logger = createLogger('hooks:fontFamily');

/**
 * Custom hook for managing font family settings
 * Handles font selection, persistence, and DOM updates
 */
export function useFontFamily(): UseFontFamilyReturn {
  const [fontFamily, setFontFamilyState] = useState<string>(DEFAULT_FONT_ID);
  const [recentFonts, setRecentFonts] = useState<string[]>([]);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(
    new Set(['system', 'georgia'])
  );

  // Apply font to DOM
  const applyFontToDOM = useCallback(
    (fontId: string) => {
      const font = getFontById(fontId);
      if (!font) return;

      // Update CSS variable
      document.documentElement.style.setProperty(
        FONT_CSS_VARS.FONT_FAMILY,
        font.stack
      );

      // Update body font-family to use the CSS variable
      document.body.style.fontFamily = `var(${FONT_CSS_VARS.FONT_FAMILY})`;

      // Dispatch custom event
      window.dispatchEvent(
        new CustomEvent('fontchange', {
          detail: {
            previousFont: fontFamily,
            newFont: fontId,
            timestamp: Date.now(),
          },
        })
      );
    },
    [fontFamily]
  );

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      // Load font family
      const savedFont = localStorage.getItem(FONT_STORAGE_KEYS.FONT_FAMILY);
      const validFontId =
        savedFont && getFontById(savedFont) ? savedFont : DEFAULT_FONT_ID;

      setFontFamilyState(validFontId);
      applyFontToDOM(validFontId);

      // Load font settings
      const savedSettings = localStorage.getItem(
        FONT_STORAGE_KEYS.FONT_SETTINGS
      );
      if (savedSettings) {
        const settings: FontSettings = JSON.parse(savedSettings);
        if (settings.recentFonts) {
          setRecentFonts(settings.recentFonts);
        }
      }
    } catch (error) {
      logger.error('Failed to load font settings', { error });
      setFontFamilyState(DEFAULT_FONT_ID);
      applyFontToDOM(DEFAULT_FONT_ID);
    }
  }, [applyFontToDOM]);

  // Save settings to localStorage
  const saveSettings = useCallback((fontId: string, recent: string[]) => {
    try {
      // Save simple font family
      localStorage.setItem(FONT_STORAGE_KEYS.FONT_FAMILY, fontId);

      // Save full settings object
      const settings: FontSettings = {
        fontFamily: fontId,
        lastUpdated: Date.now(),
        recentFonts: recent,
      };
      localStorage.setItem(
        FONT_STORAGE_KEYS.FONT_SETTINGS,
        JSON.stringify(settings)
      );
    } catch (error) {
      logger.error('Failed to save font settings', { error });
    }
  }, []);

  // Set font family
  const setFontFamily = useCallback(
    async (fontId: string) => {
      // Validate font ID
      const font = getFontById(fontId);
      if (!font) {
        logger.warn('Invalid font ID', { fontId });
        return;
      }

      // Load font if needed
      if (font.loading !== 'system' && !loadedFonts.has(fontId)) {
        try {
          await loadFont(font);
          setLoadedFonts((prev) => new Set([...prev, fontId]));
        } catch (error) {
          logger.error('Failed to load font', { fontId, error });
        }
      }

      setFontFamilyState(fontId);
      applyFontToDOM(fontId);

      // Update recent fonts
      const newRecent = recentFonts.filter((id) => id !== fontId);
      newRecent.unshift(fontId);
      const updatedRecent = newRecent.slice(0, MAX_RECENT_FONTS);
      setRecentFonts(updatedRecent);

      // Save to localStorage
      saveSettings(fontId, updatedRecent);

      // Mark font as loaded
      if (font?.loading === 'system') {
        setLoadedFonts((prev) => new Set([...prev, fontId]));
      }
    },
    [recentFonts, saveSettings, applyFontToDOM, loadedFonts]
  );

  // Get font by ID
  const getFontByIdWrapper = useCallback((fontId: string) => {
    return getFontById(fontId);
  }, []);

  // Check if font is loaded
  const isFontLoaded = useCallback(
    (fontId: string) => {
      const font = getFontById(fontId);

      // System fonts are always loaded
      if (font?.loading === 'system') {
        return true;
      }

      // Check if web font is loaded
      return loadedFonts.has(fontId) || checkFontLoaded(fontId);
    },
    [loadedFonts]
  );

  // Reset to default font
  const resetFont = useCallback(async () => {
    await setFontFamily(DEFAULT_FONT_ID);
  }, [setFontFamily]);

  // Get current font configuration
  const currentFontConfig = getFontById(fontFamily);

  return {
    fontFamily,
    currentFontConfig,
    fonts,
    setFontFamily,
    getFontById: getFontByIdWrapper,
    isFontLoaded,
    recentFonts,
    resetFont,
  };
}
