/**
 * Font Configuration
 * Defines all available fonts for the font switcher feature
 */

import type { FontConfig } from '@/utils/font-types';

/**
 * Available font configurations
 * Includes system fonts, web fonts, and accessibility-focused fonts
 */
export const fonts: FontConfig[] = [
  {
    id: 'system',
    name: 'System Default',
    stack:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    category: 'sans-serif',
    description: "Uses your operating system's default font",
    loading: 'system',
    previewText: 'The quick brown fox jumps over the lazy dog',
  },
  {
    id: 'inter',
    name: 'Inter',
    stack: '"Inter", system-ui, -apple-system, sans-serif',
    category: 'sans-serif',
    description: 'Modern, highly legible font designed for screens',
    loading: 'google-fonts',
    weights: [300, 400, 500, 600, 700],
    url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300..700&display=swap',
    previewText: 'The quick brown fox jumps over the lazy dog',
  },
  {
    id: 'opendyslexic',
    name: 'OpenDyslexic',
    stack: '"OpenDyslexic", "Comic Sans MS", sans-serif',
    category: 'sans-serif',
    description: 'Designed to help with dyslexia',
    accessibility: 'dyslexia-friendly',
    loading: 'local',
    url: '/fonts/OpenDyslexic-Regular.woff2',
    weights: [400, 700],
    previewText: 'The quick brown fox jumps over the lazy dog',
  },
  {
    id: 'atkinson',
    name: 'Atkinson Hyperlegible',
    stack: '"Atkinson Hyperlegible", system-ui, sans-serif',
    category: 'sans-serif',
    description: 'Designed for maximum legibility',
    accessibility: 'high-readability',
    loading: 'google-fonts',
    weights: [400, 700],
    url: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
    previewText: 'The quick brown fox jumps over the lazy dog',
  },
  {
    id: 'georgia',
    name: 'Georgia',
    stack: 'Georgia, "Times New Roman", Times, serif',
    category: 'serif',
    description: 'Classic serif font for long-form reading',
    loading: 'system',
    previewText: 'The quick brown fox jumps over the lazy dog',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    stack: '"JetBrains Mono", "SF Mono", Monaco, "Courier New", monospace',
    category: 'monospace',
    description: 'Developer-friendly monospace font',
    loading: 'google-fonts',
    weights: [400, 500, 600, 700],
    url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
    previewText: 'const code = "Hello, World!";',
  },
];

/**
 * Get font configuration by ID
 */
export function getFontById(fontId: string): FontConfig | undefined {
  return fonts.find((font) => font.id === fontId);
}

/**
 * Get fonts by category
 */
export function getFontsByCategory(
  category: FontConfig['category']
): FontConfig[] {
  return fonts.filter((font) => font.category === category);
}

/**
 * Get accessibility-focused fonts
 */
export function getAccessibilityFonts(): FontConfig[] {
  return fonts.filter((font) => font.accessibility !== undefined);
}

/**
 * Get system fonts (no loading required)
 */
export function getSystemFonts(): FontConfig[] {
  return fonts.filter((font) => font.loading === 'system');
}

/**
 * Get web fonts (require loading)
 */
export function getWebFonts(): FontConfig[] {
  return fonts.filter((font) => font.loading !== 'system');
}

/**
 * Storage Keys for localStorage
 */
export const FONT_STORAGE_KEYS = {
  /** Current font selection */
  FONT_FAMILY: 'font-family',
  /** Full settings object */
  FONT_SETTINGS: 'font-settings',
  /** Cache for loaded fonts */
  FONT_CACHE: 'font-cache',
  /** User's font history */
  FONT_HISTORY: 'font-history',
} as const;

/**
 * CSS Variable Names
 */
export const FONT_CSS_VARS = {
  /** Primary font family variable */
  FONT_FAMILY: '--font-family',
  /** Font size adjustment for consistency */
  FONT_SIZE_ADJUST: '--font-size-adjust',
  /** Font smoothing settings */
  FONT_SMOOTHING: '--font-smoothing',
  /** Letter spacing adjustments */
  FONT_LETTER_SPACING: '--font-letter-spacing',
  /** Line height for readability */
  FONT_LINE_HEIGHT: '--font-line-height',
} as const;

/**
 * Default font ID
 */
export const DEFAULT_FONT_ID = 'system';

/**
 * Default font size adjust value
 */
export const DEFAULT_FONT_SIZE_ADJUST = '0.5';

/**
 * Maximum number of recent fonts to track
 */
export const MAX_RECENT_FONTS = 5;

/**
 * Font loading timeout in milliseconds
 */
export const FONT_LOAD_TIMEOUT = 3000;

/**
 * Get default font configuration
 */
export function getDefaultFont(): FontConfig {
  return getFontById(DEFAULT_FONT_ID) || fonts[0];
}
