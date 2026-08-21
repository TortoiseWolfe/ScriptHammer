/**
 * Mobile Typography Test
 * PRP-017: Mobile-First Design Overhaul
 * Task: T011
 *
 * Test text is readable without zoom (≥16px on mobile)
 * This test should FAIL initially if text is too small (TDD RED phase)
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * Wait for layout to stabilize after viewport/page change
 */
async function waitForLayoutStability(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => {
      return new Promise((resolve) => {
        let stable = 0;
        const check = () => {
          stable++;
          if (stable >= 3) resolve(true);
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
    },
    { timeout: 5000 }
  );
}

test.describe('Mobile Typography', () => {
  test('Body text is readable without zoom (≥14px minimum)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-tutorial');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // Test article body paragraphs
    const bodyText = page.locator('article p, .prose p, main p').first();

    if (await bodyText.isVisible()) {
      const fontSize = await bodyText.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );

      // Mobile minimum: 14px (0.875rem) per research.md
      // Ideal: 16px (1rem)
      expect(
        fontSize,
        'Body text font size should be at least 14px on mobile'
      ).toBeGreaterThanOrEqual(14);
    }
  });

  test('Line height is comfortable (≥1.5)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-tutorial');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    const bodyText = page.locator('article p, .prose p, main p').first();

    if (await bodyText.isVisible()) {
      const lineHeight = await bodyText.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        const lineHeightPx = parseFloat(computed.lineHeight);
        const fontSizePx = parseFloat(computed.fontSize);
        return lineHeightPx / fontSizePx;
      });

      // WCAG recommends 1.5 minimum
      expect(
        lineHeight,
        'Line height should be at least 1.5'
      ).toBeGreaterThanOrEqual(1.5);
    }
  });

  test('Headings scale appropriately on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-tutorial');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // Test heading hierarchy
    const h1 = page.locator('h1').first();
    const h2 = page.locator('h2').first();
    const body = page.locator('p').first();

    if (
      (await h1.isVisible()) &&
      (await h2.isVisible()) &&
      (await body.isVisible())
    ) {
      const h1Size = await h1.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );
      const h2Size = await h2.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );
      const bodySize = await body.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );

      // H1 should be at least as large as H2 (same size is acceptable on mobile)
      expect(
        h1Size,
        'H1 should be at least as large as H2'
      ).toBeGreaterThanOrEqual(h2Size);

      // H2 should be larger than body
      expect(h2Size, 'H2 should be larger than body text').toBeGreaterThan(
        bodySize
      );

      // H1 should be at least 24px on mobile
      expect(
        h1Size,
        'H1 should be at least 24px on mobile'
      ).toBeGreaterThanOrEqual(24);
    }
  });

  test('Font sizes scale with viewport using fluid typography', async ({
    page,
  }) => {
    // Test at minimum width
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await waitForLayoutStability(page);

    const h1 = page.locator('h1').first();

    if (await h1.isVisible()) {
      const minSize = await h1.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );

      // Resize to larger mobile viewport
      await page.setViewportSize({ width: 428, height: 926 });
      await waitForLayoutStability(page);

      const maxSize = await h1.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );

      // Font size should scale (or at least not decrease)
      expect(
        maxSize,
        'Font size should scale with viewport (fluid typography)'
      ).toBeGreaterThanOrEqual(minSize);
    }
  });

  // The absolute floor below which text is not a design choice, it is a bug.
  //
  // This is NOT the 12px this test used to name. That number was never enforced --
  // the test collected everything under 12px and only `console.warn`ed it, under the
  // comment "Don't fail, just warn - some small text may be intentional". It ran zero
  // assertions in either branch, so it could not fail for any input (#861).
  //
  // The comment was right that the small text is intentional, which is why nobody
  // ever made it assert. Measured at 390px across /, /blog, a blog post,
  // /accessibility, /sign-in, /contact, /status and /docs: the 2a Machine Shop type
  // scale deliberately sets eyebrows, tag chips and meta lines at 10.5-11px
  // (`text-[11px]`, `text-[10.5px]`, uppercase with wide tracking), while every
  // paragraph of running prose is 14px or larger. The smallest text anywhere was
  // 10.5px.
  //
  // So 12px is not this product's floor and asserting it would fail on correct
  // design. 10px is a floor nothing legitimate approaches, and it still catches the
  // regressions that matter -- a broken clamp, a bad token, a shrunk container.
  // Raising it is a design decision for the owner, recorded on #861.
  const ABSOLUTE_MIN_FONT_PX = 10;

  test('No text renders below the absolute minimum size', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForLayoutStability(page);

    // ONE evaluate over every matching element, not a per-element round trip over
    // the first 50. The sampled version measured 5 of the 133 visible text elements
    // on this page -- the first 50 nodes in document order are mostly inside <head>
    // and hidden wrappers -- so it covered about 4% of its own subject while looking
    // like it covered the page. A gate is only as wide as what it points at (#396).
    const { measured, tooSmall } = await page.evaluate((floor) => {
      const nodes = Array.from(
        document.querySelectorAll('p, span, a, button, li, td, th, label')
      );
      const small: string[] = [];
      let seen = 0;
      for (const el of nodes) {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const text = (el.textContent ?? '').trim();
        if (
          cs.display === 'none' ||
          cs.visibility === 'hidden' ||
          rect.width === 0 ||
          rect.height === 0 ||
          !text
        ) {
          continue;
        }
        seen++;
        const fontSize = parseFloat(cs.fontSize);
        if (fontSize < floor) {
          small.push(`${fontSize.toFixed(1)}px: "${text.substring(0, 30)}"`);
        }
      }
      return { measured: seen, tooSmall: small };
    }, ABSOLUTE_MIN_FONT_PX);

    // Coverage floor, set well above zero. A visibility filter stands between the
    // selector and every reading, so a page that failed to render would produce an
    // empty list and a green result (#842). The homepage carries 133 visible text
    // elements; 25 is a floor that a real regression in rendering would breach long
    // before this assertion could pass vacuously.
    expect(
      measured,
      `only ${measured} visible text elements were measured; this test is not seeing the page`
    ).toBeGreaterThan(25);

    expect(
      tooSmall,
      `${tooSmall.length} of ${measured} elements render below ${ABSOLUTE_MIN_FONT_PX}px:\n${tooSmall.join('\n')}`
    ).toEqual([]);
  });

  test('Text remains readable in landscape orientation', async ({ page }) => {
    // Landscape mobile (844x390)
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/blog');
    await waitForLayoutStability(page);

    const bodyText = page.locator('p').first();

    if (await bodyText.isVisible()) {
      const fontSize = await bodyText.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );

      // Text should still be at least 14px in landscape
      expect(
        fontSize,
        'Text should remain readable in landscape'
      ).toBeGreaterThanOrEqual(14);
    }
  });

  test('Text does not overflow containers on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-tutorial');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // The previous version guarded on `box.width > 390`, but boundingBox() returns the
    // BORDER box — a container with `overflow-x: auto` never exceeds the viewport, so
    // that guard was false by construction and its assertion never ran (#850). It was
    // also backwards: it asked whether wide containers HANDLE overflow, when the
    // question is whether content overflows at all.
    //
    // scrollWidth vs clientWidth is the measurement that answers it. 1px of slack
    // absorbs sub-pixel rounding, which is real at fractional device ratios.
    const containers = page.locator('article, .prose, main, section');
    const count = await containers.count();

    // Coverage floor. Without it a selector that matches nothing reports success, which
    // is exactly the failure mode this whole queue exists to remove (#396, #843, #851).
    expect(
      count,
      'no text containers found — the selector has gone stale'
    ).toBeGreaterThan(0);

    const overflowing: string[] = [];
    for (let i = 0; i < Math.min(count, 10); i++) {
      const container = containers.nth(i);
      if (!(await container.isVisible())) continue;

      const measured = await container.evaluate((el) => ({
        tag: el.tagName.toLowerCase(),
        cls: el.className?.toString().slice(0, 40) ?? '',
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: window.getComputedStyle(el).overflowX,
      }));

      // A container that scrolls its own content is handling overflow deliberately.
      if (['auto', 'scroll', 'hidden'].includes(measured.overflowX)) continue;

      if (measured.scrollWidth > measured.clientWidth + 1) {
        overflowing.push(
          `<${measured.tag} class="${measured.cls}"> scrollWidth ${measured.scrollWidth} > clientWidth ${measured.clientWidth}`
        );
      }
    }

    expect(
      overflowing,
      `Text overflows its container at 390px:\n${overflowing.join('\n')}`
    ).toEqual([]);
  });
});
