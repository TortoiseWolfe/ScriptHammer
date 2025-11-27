/**
 * Font Loading Utilities
 * Handles dynamic loading of web fonts with performance optimization
 */

import { FontConfig, FontLoadState } from './font-types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:font-loader');

// Track loaded fonts to avoid duplicate loading
const loadedFonts = new Set<string>();
const loadingFonts = new Map<string, Promise<void>>();

/**
 * Font configurations with CDN URLs
 */
const FONT_URLS: Record<string, string> = {
  inter:
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  opendyslexic: 'https://fonts.cdnfonts.com/css/opendyslexic',
  atkinson:
    'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
  jetbrains:
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
};

/**
 * Load a font dynamically
 * @param fontConfig Font configuration to load
 * @returns Promise that resolves when font is loaded
 */
export async function loadFont(fontConfig: FontConfig): Promise<void> {
  // Skip if system font or already loaded
  if (fontConfig.loading === 'system' || loadedFonts.has(fontConfig.id)) {
    return Promise.resolve();
  }

  // Return existing loading promise if font is currently loading
  if (loadingFonts.has(fontConfig.id)) {
    return loadingFonts.get(fontConfig.id)!;
  }

  // Create loading promise
  const loadingPromise = (async () => {
    try {
      const url = fontConfig.url || FONT_URLS[fontConfig.id];

      if (!url) {
        // No URL available, treat as system font
        loadedFonts.add(fontConfig.id);
        return;
      }

      // Check if link already exists
      const existingLink = document.querySelector(
        `link[data-font-id="${fontConfig.id}"]`
      );

      if (existingLink) {
        loadedFonts.add(fontConfig.id);
        return;
      }

      // Create and append link element
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.setAttribute('data-font-id', fontConfig.id);

      // Wait for font to load with timeout
      await new Promise<void>((resolve) => {
        const timeoutId: NodeJS.Timeout = setTimeout(() => {
          logger.warn('Font loading timeout, continuing anyway', {
            fontName: fontConfig.name,
          });
          loadedFonts.add(fontConfig.id);
          resolve();
        }, 5000);

        link.onload = () => {
          clearTimeout(timeoutId);
          loadedFonts.add(fontConfig.id);
          resolve();
        };
        link.onerror = () => {
          clearTimeout(timeoutId);
          logger.warn('Failed to load font, falling back to system font', {
            fontName: fontConfig.name,
          });
          // Don't reject, just resolve and mark as loaded to prevent retries
          loadedFonts.add(fontConfig.id);
          resolve();
        };

        document.head.appendChild(link);
      });

      // Optional: Use Font Loading API for better control
      if ('fonts' in document) {
        try {
          await document.fonts.ready;
        } catch (error) {
          logger.warn('Font loading API failed', {
            fontName: fontConfig.name,
            error,
          });
        }
      }
    } catch (error) {
      logger.error('Error loading font', { fontName: fontConfig.name, error });
      throw error;
    } finally {
      loadingFonts.delete(fontConfig.id);
    }
  })();

  loadingFonts.set(fontConfig.id, loadingPromise);
  return loadingPromise;
}

/**
 * Preload multiple fonts
 * @param fontConfigs Array of font configurations to preload
 * @returns Promise that resolves when all fonts are loaded
 */
export async function preloadFonts(fontConfigs: FontConfig[]): Promise<void[]> {
  const loadPromises = fontConfigs.map((config) => loadFont(config));
  return Promise.all(loadPromises);
}

/**
 * Check if a font is loaded
 * @param fontId Font ID to check
 * @returns Whether the font is loaded
 */
export function isFontLoaded(fontId: string): boolean {
  return loadedFonts.has(fontId);
}

/**
 * Get font load states for multiple fonts
 * @param fontIds Array of font IDs
 * @returns Map of font IDs to load states
 */
export function getFontLoadStates(
  fontIds: string[]
): Map<string, FontLoadState> {
  const states = new Map<string, FontLoadState>();

  for (const id of fontIds) {
    if (loadedFonts.has(id)) {
      states.set(id, {
        id,
        status: 'loaded',
        loadedAt: Date.now(),
      });
    } else if (loadingFonts.has(id)) {
      states.set(id, {
        id,
        status: 'loading',
      });
    } else {
      states.set(id, {
        id,
        status: 'idle',
      });
    }
  }

  return states;
}

/**
 * Remove a loaded font
 * @param fontId Font ID to remove
 */
export function removeFont(fontId: string): void {
  const link = document.querySelector(`link[data-font-id="${fontId}"]`);
  if (link) {
    link.remove();
    loadedFonts.delete(fontId);
  }
}

/**
 * Clear all loaded fonts
 */
export function clearAllFonts(): void {
  const links = document.querySelectorAll('link[data-font-id]');
  links.forEach((link) => link.remove());
  loadedFonts.clear();
  loadingFonts.clear();
}

/**
 * Apply font to document with CSS variable
 * @param fontStack Font stack to apply
 */
export function applyFontToDocument(fontStack: string): void {
  document.documentElement.style.setProperty('--font-family', fontStack);
}

/**
 * Get current font from CSS variable
 * @returns Current font stack or null
 */
export function getCurrentFontFromDocument(): string | null {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--font-family')
      .trim() || null
  );
}

/**
 * Performance optimization: Preload critical fonts on page load
 */
export function preloadCriticalFonts(): void {
  // Add preload link tags for critical fonts
  const criticalFonts = ['inter', 'atkinson'];

  criticalFonts.forEach((fontId) => {
    const url = FONT_URLS[fontId];
    if (url) {
      const preload = document.createElement('link');
      preload.rel = 'preload';
      preload.as = 'style';
      preload.href = url;
      preload.setAttribute('data-font-preload', fontId);
      document.head.appendChild(preload);
    }
  });
}
