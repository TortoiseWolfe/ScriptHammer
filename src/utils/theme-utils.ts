/**
 * Centralized dark theme detection for DaisyUI themes.
 * Used by map tiles, Disqus, Calendly, Cal.com, and Leaflet CSS.
 */
export const DARK_THEMES = [
  'scripthammer-dark',
  'dark',
  'synthwave',
  'halloween',
  'forest',
  'black',
  'luxury',
  'dracula',
  'business',
  'night',
  'coffee',
  'dim',
  'sunset',
] as const;

export type DarkTheme = (typeof DARK_THEMES)[number];

/**
 * Check whether a DaisyUI theme name is a dark theme.
 * Falls back to prefers-color-scheme when theme is null/auto/system.
 */
export function isDarkTheme(theme: string | null): boolean {
  if (theme && (DARK_THEMES as readonly string[]).includes(theme)) {
    return true;
  }
  if (!theme || theme === 'system' || theme === 'auto') {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }
  return false;
}
