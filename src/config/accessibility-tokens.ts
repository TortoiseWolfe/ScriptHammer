/**
 * Accessibility token maps — the single source of truth for the values that
 * `AccessibilityProvider` writes to the DOM.
 *
 * These live outside the provider because two things need them and they must
 * never drift apart (#388):
 *
 *  1. `AccessibilityContext` applies them on mount and on every change.
 *  2. `AccessibilityScript` serialises them into a blocking inline script so
 *     the same values are applied *before first paint*. Without that, every
 *     route first-paints at the CSS default and then re-typesets when React
 *     hydrates.
 *
 * The script cannot import at runtime — it is a stringified `<script>` — so it
 * JSON-serialises these constants at build time. That is deliberate: the
 * serialisation is what guarantees the two paths agree.
 */

export type FontSize = 'small' | 'medium' | 'large' | 'x-large';
export type LineHeight = 'compact' | 'normal' | 'relaxed';
export type FontFamily = 'sans-serif' | 'serif' | 'mono';
export type ContrastMode = 'normal' | 'high';
export type MotionPreference = 'no-preference' | 'reduce';

export interface AccessibilitySettings {
  fontSize: FontSize;
  lineHeight: LineHeight;
  fontFamily: FontFamily;
  highContrast: ContrastMode;
  reduceMotion: MotionPreference;
}

/**
 * Multiplier applied to every `--text-*` token in globals.css.
 *
 * Note there is deliberately no `1` here — the smallest setting is 1.25. The
 * CSS default must therefore match `medium` (1.5), not 1, or a pre-hydration
 * render shows a size the app can never actually be set to.
 */
export const FONT_SCALE_FACTORS: Record<FontSize, number> = {
  small: 1.25, // 20px - minimum comfortable size
  medium: 1.5, // 24px - good default
  large: 1.75, // 28px - easy to read
  'x-large': 2.125, // 34px - very accessible
};

export const LINE_HEIGHTS: Record<LineHeight, string> = {
  compact: '1.25',
  normal: '1.5',
  relaxed: '1.75',
};

/**
 * Body font per accessibility setting.
 *
 * These lead with the brand faces on purpose (#377). This map is the LAST word
 * on the site's body font — it is written to `--sh-font-body`, which
 * `globals.css` applies to `body`. So a stack here that omits Archivo silently
 * defeats both `next/font` in layout.tsx and the `--font-sans` mapping in
 * `@theme`, no matter what those say. That is precisely how Geist managed to
 * be downloaded on every page and rendered on none.
 */
export const FONT_FAMILIES: Record<FontFamily, string> = {
  'sans-serif':
    'var(--font-archivo), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'var(--font-jetbrains), ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
};

/**
 * Heading font per accessibility setting, written to `--sh-font-display`.
 *
 * Kept as its own map rather than derived, so that choosing serif or mono
 * moves the headings too. #377 requires the font controls to override the
 * display face — a user who picks a legibility font should not keep getting
 * Archivo Black on every heading.
 */
export const DISPLAY_FONT_FAMILIES: Record<FontFamily, string> = {
  'sans-serif':
    'var(--font-archivo-black), var(--font-archivo), ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'var(--font-jetbrains), ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
};

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  fontSize: 'medium',
  lineHeight: 'normal',
  fontFamily: 'sans-serif',
  highContrast: 'normal',
  reduceMotion: 'no-preference',
};

/**
 * Storage keys, written as five flat top-level strings (not one JSON blob).
 * Which store they live in is consent-dependent — see `resolveStorage`.
 */
export const ACCESSIBILITY_STORAGE_KEYS = {
  fontSize: 'fontSize',
  lineHeight: 'lineHeight',
  fontFamily: 'fontFamily',
  highContrast: 'highContrast',
  reduceMotion: 'reduceMotion',
} as const;

/**
 * The consent record's key, duplicated from `StorageKey.CONSENT` in
 * `utils/consent-types`. The inline script cannot import the enum, so this is
 * re-exported here and asserted equal by
 * `src/config/__tests__/accessibility-tokens.test.ts` — if the enum ever
 * changes, that test fails rather than the pre-paint script silently reading
 * the wrong key and falling back to `sessionStorage` for everyone.
 */
export const CONSENT_STORAGE_KEY = 'cookie-consent';
