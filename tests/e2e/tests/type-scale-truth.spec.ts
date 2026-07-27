import { test, expect } from '@playwright/test';

/**
 * #388 — the declared font size must be the rendered one.
 *
 * Two defects, two tests. Both are written so that reverting the fix makes
 * them fail; see the mutation notes on each. That matters here because every
 * pre-existing font assertion in this repo was a one-sided floor, a jsdom
 * class-name check, or diagnostic metadata — none could catch either defect.
 */

/** Tailwind's `sm:` breakpoint is remapped in globals.css `@theme`. */
const SM_BREAKPOINT = 430;
/** Comfortably below `sm`, and a real device width. */
const BELOW_SM = 390;
/** Comfortably above `sm` without hitting `md` (768). */
const ABOVE_SM = 500;

test.describe('#388 type scale truth', () => {
  /**
   * T1 — D1: the font scale must be correct at first paint.
   *
   * `AccessibilityProvider` reads storage in a mount effect, so without a
   * pre-paint script the page renders at the CSS default and then re-typesets
   * on hydration. We read the custom property at `domcontentloaded`, before
   * React has hydrated.
   *
   * MUTATION CHECK: remove `<AccessibilityScript />` from `app/layout.tsx`.
   * The stored-preference case below must fail (it will report the CSS
   * default 1.5 instead of the stored 2.125).
   */
  test('the font scale is applied before hydration, including a stored preference', async ({
    page,
  }) => {
    // Seed a NON-default preference plus the functional consent that decides
    // which store the app reads. Both must be in place before first paint.
    await page.addInitScript(() => {
      try {
        localStorage.setItem(
          'cookie-consent',
          JSON.stringify({
            necessary: true,
            functional: true,
            analytics: false,
            marketing: false,
          })
        );
        localStorage.setItem('fontSize', 'x-large');
      } catch {
        /* storage unavailable — the assertion below will surface it */
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const factor = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--font-scale-factor')
        .trim()
    );

    // 'x-large' maps to 2.125 in @/config/accessibility-tokens.
    expect(parseFloat(factor)).toBeCloseTo(2.125, 3);
  });

  /**
   * T1b — the same read with no stored preference must yield the medium
   * default, not the old unreachable `1`.
   */
  test('a first-time visitor paints at the medium default, not 1', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const factor = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--font-scale-factor')
        .trim()
    );

    expect(parseFloat(factor)).toBeCloseTo(1.5, 3);
  });

  /**
   * T2 — D2: responsive font ladders must actually step.
   *
   * `/docs`'s h1 is `text-4xl sm:text-5xl`. While the unlayered
   * `.text-4xl{...!important}` block existed, the `sm:` variant lost the
   * cascade and the heading rendered at one size at every width.
   *
   * The comparison is STRICT (`>`). A `toBeGreaterThanOrEqual` would pass with
   * the bug present — which is exactly why `mobile-typography.spec.ts` never
   * caught this.
   *
   * MUTATION CHECK: restore the `.text-*{ font-size: var(--text-*) !important }`
   * block in globals.css. This test must fail.
   */
  test('the /docs h1 grows across the sm breakpoint', async ({ page }) => {
    await page.goto('/docs', { waitUntil: 'domcontentloaded' });
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    const measure = async (width: number) => {
      await page.setViewportSize({ width, height: 900 });
      // Let the media query settle before reading.
      await expect
        .poll(async () =>
          h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
        )
        .toBeGreaterThan(0);
      return h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    };

    const below = await measure(BELOW_SM);
    const above = await measure(ABOVE_SM);

    expect(
      above,
      `h1 is text-4xl sm:text-5xl; at ${ABOVE_SM}px (>= sm ${SM_BREAKPOINT}px) it must render larger than at ${BELOW_SM}px, got ${above} vs ${below}`
    ).toBeGreaterThan(below);
  });
});
