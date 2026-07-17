import { test, expect } from '@playwright/test';

/**
 * #301 — the glass nav must stay legible over the scene.
 *
 * On the twin routes the nav is translucent (base-100 at 90%) + backdrop-blur,
 * floating over a live 3D scene. Nothing in this repo could measure that, so
 * this spec exists to be the gate. Why every obvious approach fails:
 *
 *  - Pa11y: config/pa11yci.json globally ignores `color-contrast`, and its own
 *    note records that canvas routes are not axe-auditable (which is why
 *    /game/3d is omitted). Adding /chatt would repeat that mistake.
 *  - axe: it cannot resolve a flat background behind a translucent element over
 *    a canvas. Every nav node lands in `incomplete`, which reads as green.
 *  - Screenshot sampling: CI has no guaranteed WebGL (playwright.config sets no
 *    launchOptions.args), so a pixel test test.skip()s into a false green —
 *    the #288 failure mode this suite already names.
 *
 * THE METHOD, and why it is a proof rather than a sample:
 *
 *  1. Composite the nav's own computed backgroundColor over #000 and over #fff
 *     in a 2D canvas. The canvas performs the exact sRGB alpha composite the
 *     compositor performs — no modelling, no OKLCH parsing. That last part is
 *     load-bearing: Chromium serializes OKLCH-authored custom properties back
 *     as `oklch(...)`, and a naive numeric regex reads L/C/H as R/G/B and
 *     collapses the ratio toward 1:1 (this repo has measured a real 4.13:1
 *     mis-read as 1.03:1). See tests/e2e/embed-theme-contrast.spec.ts.
 *  2. #000 and #fff BRACKET every pixel the scene can ever produce, and
 *     backdrop-filter: blur() cannot escape the bracket — blur moves a pixel's
 *     backdrop toward its local mean, i.e. strictly inside [min, max].
 *  3. Assert both endpoints clear the threshold AND that sign(L_text - L_bg) is
 *     the same at both. Consistent sign => contrast is monotonic in backdrop
 *     luminance => the minimum over the whole interval IS at an endpoint.
 *     Without that second assertion the endpoints are just two samples and the
 *     interior could dip to 1:1.
 */

const AAA = 7;

test.describe('#301 glass nav contrast over the scene', () => {
  test('nav text clears AAA against ANY backdrop the scene can produce', async ({
    page,
  }) => {
    await page.goto('/chatt/?notour');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });

    const result = await page.evaluate(() => {
      const nav = document.querySelector('[data-global-nav]');
      if (!nav) return { error: 'no nav' };
      const link = nav.querySelector('a, button');
      if (!link) return { error: 'no nav link' };

      const navBg = getComputedStyle(nav).backgroundColor;
      const textColor = getComputedStyle(link).color;

      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { error: 'no 2d context' };

      // Composite `over` on top of `under`, and read back what the browser
      // actually painted. This is where OKLCH becomes sRGB correctly.
      const composite = (under: string, over: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = under;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = over;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b] as [number, number, number];
      };

      const lum = ([r, g, b]: [number, number, number]) => {
        const f = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const ratio = (a: number, b: number) =>
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

      // Text is opaque, so it composites the same over either backdrop; still
      // resolve it through the canvas so OKLCH is converted, not parsed.
      const lText = lum(composite('#808080', textColor));

      const overBlack = lum(composite('#000000', navBg));
      const overWhite = lum(composite('#ffffff', navBg));

      return {
        navBg,
        textColor,
        navAlpha: (() => {
          const m =
            navBg.match(/\/\s*([\d.]+)\s*\)/) ||
            navBg.match(/,\s*([\d.]+)\s*\)$/);
          return m ? parseFloat(m[1]) : 1;
        })(),
        ratioOverBlackScene: ratio(lText, overBlack),
        ratioOverWhiteScene: ratio(lText, overWhite),
        signOverBlack: Math.sign(lText - overBlack),
        signOverWhite: Math.sign(lText - overWhite),
      };
    });

    expect(result.error).toBeUndefined();

    // HONESTY GUARD — without this the spec passes vacuously. If the glass rule
    // ever loses the cascade the nav is fully opaque, which has SUPERB
    // contrast, and every assertion below would sail through while shipping
    // nothing. An opaque nav here means the feature is broken.
    expect(
      result.navAlpha,
      'nav must actually be translucent on /chatt or this spec proves nothing'
    ).toBeLessThan(1);

    // Monotonicity: same sign at both endpoints => the worst case IS an
    // endpoint, so bracketing the scene is a proof and not two lucky samples.
    expect(
      result.signOverBlack,
      'text/backdrop luminance order must not flip between a black and a white scene'
    ).toBe(result.signOverWhite);

    expect(result.ratioOverBlackScene).toBeGreaterThanOrEqual(AAA);
    expect(result.ratioOverWhiteScene).toBeGreaterThanOrEqual(AAA);
  });

  test('the glass is scoped to twin routes only', async ({ page }) => {
    // The other half of the honesty guard: prove the rule is route-scoped, so
    // the test above is measuring something /chatt has and / does not.
    await page.goto('/');
    const alpha = await page.evaluate(() => {
      const nav = document.querySelector('[data-global-nav]');
      if (!nav) return null;
      const bg = getComputedStyle(nav).backgroundColor;
      const m =
        bg.match(/\/\s*([\d.]+)\s*\)/) || bg.match(/,\s*([\d.]+)\s*\)$/);
      return m ? parseFloat(m[1]) : 1;
    });
    expect(alpha, 'the nav must stay opaque off the twin routes').toBe(1);
  });
});
