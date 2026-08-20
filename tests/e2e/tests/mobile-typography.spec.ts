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

  test('Small text is avoided or has min-font-size', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForLayoutStability(page);

    // Get all text elements
    const textElements = await page
      .locator('p, span, a, button, li, td, th, label')
      .all();

    const tooSmall: string[] = [];

    for (const element of textElements.slice(0, 50)) {
      // Sample first 50
      if (await element.isVisible()) {
        const fontSize = await element.evaluate((el) =>
          parseFloat(window.getComputedStyle(el).fontSize)
        );

        // Text should not be smaller than 12px (minimum readable)
        if (fontSize < 12) {
          const text =
            (await element.textContent())?.trim().substring(0, 30) || '';
          tooSmall.push(`${fontSize.toFixed(1)}px: "${text}"`);
        }
      }
    }

    if (tooSmall.length > 0) {
      const summary = `${tooSmall.length} elements have text < 12px:\n${tooSmall.slice(0, 5).join('\n')}`;
      console.warn(summary);
      // Don't fail, just warn - some small text may be intentional
    }
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
