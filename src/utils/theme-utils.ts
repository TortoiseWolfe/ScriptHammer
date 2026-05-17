import { Color as ThreeColor } from 'three';

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

// ---------------------------------------------------------------------------
// OKLCH → sRGB color conversion (Feature 047 — Three.js Game)
// ---------------------------------------------------------------------------

/**
 * Convert OKLCH to OKLab.
 * Reference: https://bottosson.github.io/posts/oklab/
 */
function oklchToOklab(
  L: number,
  C: number,
  H: number
): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  return [L, C * Math.cos(hRad), C * Math.sin(hRad)];
}

/**
 * Convert OKLab to linear sRGB.
 * Reference: https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
 */
function oklabToLinearSrgb(
  L: number,
  a: number,
  b: number
): [number, number, number] {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * Convert linear sRGB to gamma-corrected sRGB (the values browsers render).
 */
function linearSrgbToSrgb(c: number): number {
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * Convert a DaisyUI OKLCH triplet (as stored in CSS custom properties — e.g.
 * `--p: 0.7 0.15 250`) to a Three.js Color.
 *
 * @param oklch  String containing space-separated L C H values (no `oklch()` wrapper).
 *               Example: "0.7 0.15 250" or with optional leading/trailing whitespace.
 * @returns      THREE.Color in sRGB, or null if the string is malformed.
 */
function parseOklchTriplet(oklch: string): ThreeColor | null {
  const parts = oklch.trim().split(/\s+/);
  if (parts.length < 3) return null;

  const L = parseFloat(parts[0]);
  const C = parseFloat(parts[1]);
  const H = parseFloat(parts[2]);

  if (!Number.isFinite(L) || !Number.isFinite(C) || !Number.isFinite(H)) {
    return null;
  }

  const [labL, labA, labB] = oklchToOklab(L, C, H);
  const [linR, linG, linB] = oklabToLinearSrgb(labL, labA, labB);
  const r = linearSrgbToSrgb(linR);
  const g = linearSrgbToSrgb(linG);
  const b = linearSrgbToSrgb(linB);

  return new ThreeColor(r, g, b);
}

/**
 * Read a DaisyUI theme token from `:root` (`document.documentElement`) and
 * return it as a `THREE.Color`. Mirrors the `useMapTheme` pattern from
 * `src/hooks/useMapTheme.ts` for theme reactivity — callers MUST subscribe
 * via `MutationObserver` on `data-theme` to be notified of theme changes
 * and re-call this helper.
 *
 * Per research.md Decision 3:
 * - DaisyUI 4+ stores theme tokens as OKLCH triplets in CSS custom properties.
 * - The CSS value format is `"L C H"` (no `oklch()` wrapper, no commas).
 * - Three.js r184's color parser does NOT understand `oklch()` strings.
 * - This helper does the OKLCH→sRGB math inline so unit tests in jsdom work
 *   without requiring a real browser's CSS color resolution.
 *
 * @param token  DaisyUI token name without the `--` prefix (e.g. `"p"` for primary).
 * @returns      A Three.js Color. Returns middle gray (`#808080`) if the token
 *               is unset or malformed — never throws, so calling code can use
 *               the result directly without try/catch.
 */
export function getDaisyUIColorAsThree(token: string): ThreeColor {
  const fallback = new ThreeColor(0x808080);

  if (typeof document === 'undefined') return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();

  if (!value) return fallback;

  const parsed = parseOklchTriplet(value);
  return parsed ?? fallback;
}
