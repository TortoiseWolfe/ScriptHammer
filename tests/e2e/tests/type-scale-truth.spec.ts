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
   * cascade and the heading rendered at the 4xl size at every width.
   *
   * IMPORTANT — why this does not simply assert "bigger at a wider viewport".
   * The `--text-*` tokens are fluid: `clamp(1.75rem, 1.5rem + 1.5vw, 2.25rem)`.
   * A frozen `text-4xl` heading STILL grows with viewport width. Measured with
   * the bug deliberately reintroduced: 44.775px at 390px and 47.25px at 500px —
   * so a `toBeGreaterThan` comparison passes with the defect present. The first
   * draft of this test did exactly that and survived its own mutation check.
   *
   * Instead we compare the heading against probe elements carrying the two
   * classes. That is exact and immune to fluid growth: below `sm` the heading
   * must match a `text-4xl` probe, at/above `sm` it must match a `text-5xl`
   * probe, and the two probes must differ.
   *
   * MUTATION CHECK: append
   * `.text-4xl{font-size:var(--text-4xl)!important}` to the built stylesheet
   * (or restore the block in globals.css). The at/above assertion must fail,
   * because the heading stays pinned to the 4xl probe.
   */
  test('the /docs h1 uses text-5xl at/above sm and text-4xl below', async ({
    page,
  }) => {
    await page.goto('/docs', { waitUntil: 'domcontentloaded' });
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    // Probes rendered in the same document, so they resolve through the same
    // tokens, the same scale factor and the same media queries.
    await page.evaluate(() => {
      for (const cls of ['text-4xl', 'text-5xl']) {
        const el = document.createElement('span');
        el.className = cls;
        el.dataset.probe = cls;
        el.textContent = 'probe';
        document.body.appendChild(el);
      }
    });

    const sample = async (width: number) => {
      await page.setViewportSize({ width, height: 900 });
      return page.evaluate(() => {
        const px = (sel: string) =>
          parseFloat(
            getComputedStyle(document.querySelector(sel)!).fontSize as string
          );
        return {
          h1: px('h1'),
          fourXl: px('[data-probe="text-4xl"]'),
          fiveXl: px('[data-probe="text-5xl"]'),
        };
      });
    };

    const below = await sample(BELOW_SM);
    expect(
      below.fiveXl,
      'the two probes must differ, or this test proves nothing'
    ).toBeGreaterThan(below.fourXl);
    expect(below.h1, `below sm (${BELOW_SM}px) the h1 should be text-4xl`).toBe(
      below.fourXl
    );

    const above = await sample(ABOVE_SM);
    expect(above.fiveXl).toBeGreaterThan(above.fourXl);
    expect(
      above.h1,
      `at ${ABOVE_SM}px (>= sm ${SM_BREAKPOINT}px) the h1 must match the text-5xl probe (${above.fiveXl}px), not text-4xl (${above.fourXl}px) — a frozen ladder pins it to the latter`
    ).toBe(above.fiveXl);
  });
});
