import { getDaisyUIColorAsThree } from '@/utils/theme-utils';

/**
 * Shared theme → third-party-embed color mapping (issues #39, #46).
 *
 * Third-party embeds (Calendly, Cal.com, Disqus) take a brand/accent/link color
 * as a plain hex string and cannot parse DaisyUI's OKLCH CSS custom properties.
 * This module reads the active DaisyUI theme's tokens off `:root`, runs the
 * OKLCH→sRGB math (via `getDaisyUIColorAsThree`), and returns a 6-digit hex in
 * whichever `#`-convention the embed expects:
 *
 * - Calendly's `pageSettings.primaryColor` wants a bare hex (`"00a2ff"`).
 * - Cal.com's `branding.brandColor` and Disqus link colors want `"#00a2ff"`.
 *
 * The brand-accent mapping ({@link getEmbedColor}) is mechanical 1:1 — a
 * button's label rides on DaisyUI's paired `*-content` token, so the accent
 * itself doesn't need to be legible against the page background.
 *
 * Link text is different: Disqus paints links in the chosen color directly on
 * its thread background, so a raw primary that happens to be pale (cupcake,
 * pastel, aqua, …) would be illegible. {@link getAccessibleEmbedColor} satisfies
 * issue #46's NFR-002 by returning the theme primary ONLY when it clears the
 * WCAG AA text bar against the given background, and a guaranteed-legible
 * fallback otherwise — the spec's "fallback for unmapped themes".
 *
 * Callers MUST re-invoke on theme change; use {@link useEmbedThemeColor} which
 * wires the canonical `data-theme` MutationObserver.
 *
 * SSR-safe: `getDaisyUIColorAsThree` returns the `#808080` fallback when
 * `document` is undefined (static export renders these client-side only).
 */

/** Minimum WCAG AA contrast for normal-size link text. */
const AA_TEXT_RATIO = 4.5;

/**
 * Brand/accent color for an embed (Calendly `primaryColor`, Cal.com
 * `brandColor`). Mechanical 1:1 map of the active theme's token.
 *
 * @param token  DaisyUI token without the `--` prefix — `"p"` (primary, default),
 *               `"s"`, `"a"`, `"b1"`, etc.
 * @param opts.hash  When true, prefix the result with `#`. Default false.
 * @returns      A 6-character hex color, optionally `#`-prefixed.
 */
export function getEmbedColor(
  token: string = 'p',
  opts: { hash?: boolean } = {}
): string {
  const hex = getDaisyUIColorAsThree(token).getHexString();
  return opts.hash ? `#${hex}` : hex;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * WCAG contrast ratio (1–21) between two hex colors. Order-independent.
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexToRgb(hexA));
  const l2 = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Theme-derived link color that is GUARANTEED legible (WCAG AA, 4.5:1) against
 * `backgroundHex` (issue #46 NFR-002). Returns the active theme's `token` color
 * if it clears the bar; otherwise the supplied legible `fallbackHex`.
 *
 * @param backgroundHex  The surface the text sits on, `#`-prefixed (e.g. the
 *                       Disqus thread bg `"#111827"` / `"#ffffff"`).
 * @param fallbackHex    A color known to be legible on `backgroundHex`,
 *                       `#`-prefixed. Used when the theme color fails contrast.
 * @param token          DaisyUI token (default `"p"`).
 * @returns              A `#`-prefixed hex that clears 4.5:1 on `backgroundHex`.
 */
export function getAccessibleEmbedColor(
  backgroundHex: string,
  fallbackHex: string,
  token: string = 'p'
): string {
  const candidate = getEmbedColor(token, { hash: true });
  return contrastRatio(candidate, backgroundHex) >= AA_TEXT_RATIO
    ? candidate
    : fallbackHex;
}
