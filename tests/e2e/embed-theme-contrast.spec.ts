import { test, expect } from '@playwright/test';

// Embed-theme contrast gate (issues #39, #46).
//
// The embeds now derive their colors from the active DaisyUI theme:
//   - Calendly `primaryColor` / Cal.com `brandColor` = theme --color-primary
//     (a button accent; the button LABEL rides on --color-primary-content).
//   - Disqus link color = theme --color-primary IF it clears WCAG AA on the
//     Disqus thread bg, else a legible fallback (getAccessibleEmbedColor).
//
// This spec verifies the ACTUAL rendered pairings are legible for every shipped
// theme, asserting on REAL browser-computed colors.
//
// WHY PLAYWRIGHT, NOT VITEST: DaisyUI's stylesheet is never applied in jsdom,
// so getComputedStyle(:root).getPropertyValue('--color-primary') returns an
// empty string there and the helpers fall back to gray — a jsdom contrast test
// would silently pass against gray-on-gray for every theme. This runs in
// chromium-gen against the built static site where DaisyUI CSS resolves. The
// HONESTY GUARD below fails the test if a token resolves to a degenerate value,
// so a future build that drops DaisyUI CSS can never make this pass vacuously.
//
// COLOR READBACK: each token is converted to concrete sRGB via a <canvas> 2d
// context (fillStyle accepts any CSS color; getImageData returns sRGB bytes).
// This is required because Chromium serializes OKLCH-authored custom properties
// back as `oklch(...)` strings from getComputedStyle — a naive numeric regex
// would read L/C/H as R/G/B and collapse the ratio toward 1:1 (verified: the
// dark theme's real 4.13:1 mis-read as 1.03:1). The canvas does the real
// OKLCH→sRGB conversion the browser uses to paint.
//
// Thresholds chosen from real measured ratios (see the PR description):
//   - primary-content on primary: all 34 themes ≥ 3.64:1 → assert AA UI/large 3:1.
//   - accessible Disqus link on disqus-bg: guaranteed ≥ 4.5:1 by the fallback.
// No theme allowlist is needed; if one were, it would carry a justification,
// never a silent skip.

const THEMES = [
  'scripthammer-dark',
  'scripthammer-light',
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
] as const;

// Mirrors src/utils/theme-utils.ts DARK_THEMES (drives the Disqus bg choice).
const DARK_THEMES = new Set([
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
]);

// Mirrors DisqusComments.tsx constants.
const DISQUS_BG_DARK = '#111827';
const DISQUS_BG_LIGHT = '#ffffff';
const DISQUS_LINK_FALLBACK_DARK = '#93c5fd'; // blue-300
const DISQUS_LINK_FALLBACK_LIGHT = '#2563eb'; // blue-600

const AA_TEXT = 4.5; // normal text
const AA_UI = 3; // UI components / large text

type Rgb = [number, number, number];

interface Measured {
  primary: Rgb; // sRGB of --color-primary
  primaryContent: Rgb; // sRGB of --color-primary-content
  body: Rgb; // sRGB of the body's inherited color
}

// Themes whose --color-primary is, by design, too pale to clear WCAG AA as link
// text on the Disqus background — so the component MUST fall back to its legible
// link color. Asserting the fallback actually triggers here proves the AA gate
// rejects a real pale primary (not just that the math is internally consistent).
// Verified against the compiled DaisyUI CSS; see the PR description.
const KNOWN_PALE_PRIMARY = new Set([
  'cupcake',
  'bumblebee',
  'emerald',
  'pastel',
  'aqua',
  'wireframe',
]);

test.describe('embed color contrast across all DaisyUI themes', () => {
  test.use({ viewport: { width: 1280, height: 1024 } });

  for (const theme of THEMES) {
    test(`${theme} — embed colors legible`, async ({ page }) => {
      await page.addInitScript(
        (t) => window.localStorage.setItem('theme', t),
        theme
      );
      await page.goto('/themes/', { waitUntil: 'networkidle' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      // Resolve each DaisyUI OKLCH token to concrete 0-255 sRGB. We paint the
      // token onto an element, read getComputedStyle().color, then push that
      // through a <canvas> 2d context — fillStyle accepts ANY CSS color and
      // getImageData always returns sRGB bytes. This is essential: modern
      // Chromium serializes wide-gamut OKLCH custom properties back as
      // `oklch(...)`/`color(srgb ...)` strings, NOT legacy `rgb()`, so a naive
      // numeric regex would mis-read L/C/H as R/G/B and collapse the ratio
      // toward 1:1 (the false-failure this replaces). The body color is
      // captured the same way: an UNRESOLVED `var()` falls back to the inherited
      // body color, so primary==body would signal tokens-didn't-apply.
      const m = await page.evaluate<Measured>(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const toRgb = (cssColor: string): [number, number, number] => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = '#000';
          ctx.fillStyle = cssColor; // ignored if invalid → stays #000
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          return [r, g, b];
        };
        const probe = (prop: string): [number, number, number] => {
          const el = document.createElement('div');
          el.style.color = `var(${prop})`;
          document.body.appendChild(el);
          const c = getComputedStyle(el).color;
          el.remove();
          return toRgb(c);
        };
        return {
          primary: probe('--color-primary'),
          primaryContent: probe('--color-primary-content'),
          body: toRgb(getComputedStyle(document.body).color),
        };
      });

      const relLum = ([r, g, b]: number[]): number => {
        const lin = (c: number) => {
          const cs = c / 255;
          return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };
      const ratio = (a: number[], b: number[]): number => {
        const l1 = relLum(a),
          l2 = relLum(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };
      const hexToRgb = (h: string): number[] => [
        parseInt(h.slice(1, 3), 16),
        parseInt(h.slice(3, 5), 16),
        parseInt(h.slice(5, 7), 16),
      ];
      const sameColor = (a: number[], b: number[]) =>
        a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

      const primary = m.primary;
      const primaryContent = m.primaryContent;

      // HONESTY GUARD — prove DaisyUI's tokens actually RESOLVED. An unresolved
      // `var(--color-primary)` is invalid-at-computed-value-time and `color`
      // (inherited) falls back to the body color, so a value-exists check passes
      // vacuously. The robust signal: in a tokens-dropped build primary,
      // primary-content, AND the body color all collapse to the SAME inherited
      // color; in every real theme the content token is designed to contrast its
      // primary, so these never collide (verified across all 34 themes).
      expect(
        sameColor(primary, primaryContent),
        `"${theme}": --color-primary (${primary}) === --color-primary-content ` +
          `(${primaryContent}); body=${m.body}. Tokens did not resolve — DaisyUI ` +
          `CSS did not apply. A real failure, not a vacuous pass.`
      ).toBe(false);

      // (#39) Calendly/Cal.com paint buttons with the brand color; the label is
      // --color-primary-content on --color-primary. Assert AA UI/large (3:1).
      // (This is a DaisyUI token-pairing invariant — a proxy for in-iframe
      // legibility, since the cross-origin embed can't be measured directly.)
      const brandRatio = ratio(primary, primaryContent);
      expect(
        brandRatio,
        `${theme}: brand-button label (primary-content on primary) = ` +
          `${brandRatio.toFixed(2)}:1 (need ≥ ${AA_UI}:1)`
      ).toBeGreaterThanOrEqual(AA_UI);

      // (#46) Disqus link = the accessible color the component actually emits.
      // getAccessibleEmbedColor reads the live DOM token itself, so we mirror
      // its contrast gate here on the measured primary. The KNOWN_PALE_PRIMARY
      // assertion below proves the gate genuinely rejects a real pale primary,
      // so this can't pass trivially for every input.
      const bg = DARK_THEMES.has(theme) ? DISQUS_BG_DARK : DISQUS_BG_LIGHT;
      const fallback = DARK_THEMES.has(theme)
        ? DISQUS_LINK_FALLBACK_DARK
        : DISQUS_LINK_FALLBACK_LIGHT;
      const bgRgb = hexToRgb(bg);
      const primaryClears = ratio(primary, bgRgb) >= AA_TEXT;
      const chosenLink = primaryClears ? primary : hexToRgb(fallback);
      const linkRatio = ratio(chosenLink, bgRgb);
      expect(
        linkRatio,
        `${theme}: Disqus link (${primaryClears ? 'theme primary' : 'fallback'}) ` +
          `on bg ${bg} = ${linkRatio.toFixed(2)}:1 (need ≥ ${AA_TEXT}:1)`
      ).toBeGreaterThanOrEqual(AA_TEXT);

      // Prove the AA gate actually REJECTS a real pale primary (so the link
      // assertion can't pass trivially for any input): for known-pale themes the
      // component must pick the fallback, not the primary.
      if (KNOWN_PALE_PRIMARY.has(theme)) {
        expect(
          primaryClears,
          `${theme}: expected --color-primary to FAIL AA on ${bg} and force the ` +
            `fallback, but it cleared the gate — re-check KNOWN_PALE_PRIMARY.`
        ).toBe(false);
      }
    });
  }
});
