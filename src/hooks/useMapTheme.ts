'use client';

import { useEffect, useState } from 'react';
import { isDarkTheme } from '@/utils/theme-utils';
import { OSM_TILE_URL, OSM_ATTRIBUTION } from '@/utils/map-utils';

export type MapTheme = 'light' | 'dark' | 'auto';

export interface MapTileConfig {
  tileUrl: string;
  attribution: string;
  isDark: boolean;
}

/**
 * Hook to get theme-aware Leaflet tile configuration.
 * Watches DaisyUI data-theme attribute via MutationObserver and
 * returns CartoDB Voyager tiles + isDark flag. Dark appearance is
 * handled via CSS filter on .leaflet-tile-pane (see globals.css).
 *
 * Adapted from SpokeToWork's useMapTheme (MapLibre → Leaflet).
 */
export function useMapTheme(preferredTheme: MapTheme = 'auto'): MapTileConfig {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const detect = () =>
      isDarkTheme(document.documentElement.getAttribute('data-theme'));

    setIsDark(detect());

    // Watch for DaisyUI theme changes
    const observer = new MutationObserver(() => {
      setIsDark(detect());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Also listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => setIsDark(detect());
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const dark =
    preferredTheme === 'dark' || (preferredTheme === 'auto' && isDark);

  return {
    tileUrl: OSM_TILE_URL,
    attribution: OSM_ATTRIBUTION,
    isDark: dark,
  };
}

export default useMapTheme;
