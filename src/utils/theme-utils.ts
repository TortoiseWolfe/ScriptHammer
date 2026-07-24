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
 * Format an sRGB triplet (each channel 0..1) as a 6-digit lowercase hex string
 * (no `#`).
 *
 * This intentionally reproduces `new THREE.Color(r, g, b).getHexString()`
 * BYTE-FOR-BYTE, which is what this module used to return before three.js was
 * removed from the non-3D bundle (#291). THREE stores constructor args in its
 * linear working color space and `getHex()` applies the linear→sRGB transfer
 * (`linearSrgbToSrgb`) on the way out — so applying it once here matches THREE
 * exactly (verified across 45,260 samples). Do NOT "simplify" to
 * `round(c * 255)`: that drops the transfer and shifts every theme color,
 * breaking the WCAG contrast in tests/e2e/embed-theme-contrast.spec.ts.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const ch = (c: number) =>
    Math.round(linearSrgbToSrgb(c) * 255)
      .toString(16)
      .padStart(2, '0');
  return ch(r) + ch(g) + ch(b);
}

/**
 * Convert a DaisyUI OKLCH value (as stored in CSS custom properties) to an sRGB
 * triplet (each channel 0..1). Accepts both formats DaisyUI has used:
 *
 * - DaisyUI 4 (deprecated): bare triplet `"0.7 0.15 250"` — no wrapper, no `%`
 * - DaisyUI 5 (current):    `"oklch(58% .233 277.117)"` — function wrapper, `%` on L
 *
 * @param oklch  CSS custom property value. Whitespace tolerated. Optional
 *               `oklch()` wrapper. `L` may carry a trailing `%`; in that case
 *               it's interpreted as 0-100 and converted to 0-1.
 * @returns      `{ r, g, b }` in sRGB (0..1), or null if the string is malformed.
 */
function parseOklchTriplet(
  oklch: string
): { r: number; g: number; b: number } | null {
  // Strip `oklch(` prefix + `)` suffix if present.
  let stripped = oklch.trim();
  const wrapMatch = stripped.match(/^oklch\(([^)]+)\)$/i);
  if (wrapMatch) stripped = wrapMatch[1];

  const parts = stripped.trim().split(/[\s,]+/);
  if (parts.length < 3) return null;

  // DaisyUI 5 stores L as a percentage with `%`. Treat `45%` as 0.45.
  const lRaw = parts[0];
  let L: number;
  if (lRaw.endsWith('%')) {
    L = parseFloat(lRaw.slice(0, -1)) / 100;
  } else {
    L = parseFloat(lRaw);
  }
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

  return { r, g, b };
}

/**
 * Map a short DaisyUI token name (legacy `p`, `s`, `a`, `b1`) to the DaisyUI 5
 * CSS custom property name (`--color-primary`, etc.).
 */
const SHORT_TOKEN_TO_DAISYUI5: Record<string, string> = {
  p: 'color-primary',
  s: 'color-secondary',
  a: 'color-accent',
  n: 'color-neutral',
  b1: 'color-base-100',
  b2: 'color-base-200',
  b3: 'color-base-300',
  bc: 'color-base-content',
  pc: 'color-primary-content',
  sc: 'color-secondary-content',
  ac: 'color-accent-content',
  nc: 'color-neutral-content',
  in: 'color-info',
  su: 'color-success',
  wa: 'color-warning',
  er: 'color-error',
};

/**
 * Read a DaisyUI theme token from `:root` (`document.documentElement`) and
 * return it as a 6-digit lowercase hex string (no `#`). Mirrors the
 * `useMapTheme` pattern from `src/hooks/useMapTheme.ts` for theme reactivity —
 * callers MUST subscribe via `MutationObserver` on `data-theme` to be notified
 * of theme changes and re-call this helper.
 *
 * Formerly `getDaisyUIColorAsThree` (returned a `THREE.Color`). Renamed +
 * de-three'd in #291: this module is imported by non-3D routes (the blog's
 * Disqus embed via embed-theme.ts), so a static `three` import here dragged the
 * 2.66MB three chunk onto `/blog/[slug]`. The output is byte-identical — see
 * {@link rgbToHex}. 3D callers that need a THREE.Color reconstruct one from the
 * hex (`new Color('#' + getDaisyUIColorAsHex(token))`).
 *
 * Per research.md Decision 3:
 * - DaisyUI 4+ stores theme tokens as OKLCH triplets in CSS custom properties.
 * - The CSS value format is `"L C H"` (no `oklch()` wrapper, no commas).
 * - This helper does the OKLCH→sRGB math inline so unit tests in jsdom work
 *   without requiring a real browser's CSS color resolution.
 *
 * @param token  DaisyUI token name without the `--` prefix (e.g. `"p"` for primary).
 * @returns      A 6-digit hex string (no `#`). Returns middle gray (`"808080"`)
 *               if the token is unset or malformed — never throws, so calling
 *               code can use the result directly without try/catch.
 */
export function getDaisyUIColorAsHex(token: string): string {
  const fallback = '808080';

  if (typeof document === 'undefined') return fallback;

  const root = getComputedStyle(document.documentElement);

  // DaisyUI 5 uses verbose `--color-primary` etc. Map a short token (`p`) to
  // its DaisyUI 5 name first; fall back to reading the literal `--<token>`
  // for DaisyUI 4-style themes and for tests that set bare custom properties.
  const tryNames = [
    SHORT_TOKEN_TO_DAISYUI5[token],
    token, // already long-form ("color-primary"), or DaisyUI 4 short name
  ].filter((n): n is string => typeof n === 'string' && n.length > 0);

  for (const name of tryNames) {
    const value = root.getPropertyValue(`--${name}`).trim();
    if (!value) continue;
    const parsed = parseOklchTriplet(value);
    if (parsed) return rgbToHex(parsed.r, parsed.g, parsed.b);
  }

  return fallback;
}
