'use client';

import { useEffect, useState } from 'react';
import { getEmbedColor } from '@/utils/embed-theme';
import { isDarkTheme } from '@/utils/theme-utils';

export interface EmbedThemeColor {
  /** Bare 6-digit hex, e.g. `"00a2ff"` (Calendly `primaryColor`). */
  hex: string;
  /** `#`-prefixed hex, e.g. `"#00a2ff"` (Cal.com `brandColor`, Disqus links). */
  hexWithHash: string;
  /** Whether the active theme is a dark theme. */
  isDark: boolean;
}

/**
 * Theme-aware embed color for third-party widgets (issues #39, #46).
 *
 * Returns the active DaisyUI theme's color for `token` in both `#`-conventions
 * plus an `isDark` flag, and recomputes whenever the `data-theme` attribute
 * changes (via MutationObserver) or the system color scheme flips. Mirrors the
 * `useMapTheme` reactivity pattern so a single hook drives all three embeds
 * without duplicate observers.
 *
 * @param token  DaisyUI token without the `--` prefix (default `"p"` = primary).
 */
export function useEmbedThemeColor(token: string = 'p'): EmbedThemeColor {
  const [color, setColor] = useState<EmbedThemeColor>({
    hex: getEmbedColor(token),
    hexWithHash: getEmbedColor(token, { hash: true }),
    isDark: false,
  });

  useEffect(() => {
    const recompute = () =>
      setColor({
        hex: getEmbedColor(token),
        hexWithHash: getEmbedColor(token, { hash: true }),
        isDark: isDarkTheme(
          document.documentElement.getAttribute('data-theme')
        ),
      });

    // Seed once on mount (covers the SSR → client hydration delta and the
    // initial theme, which the useState initializer ran before `document` was
    // guaranteed to carry the resolved theme).
    recompute();

    const observer = new MutationObserver(recompute);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', recompute);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', recompute);
    };
  }, [token]);

  return color;
}

export default useEmbedThemeColor;
