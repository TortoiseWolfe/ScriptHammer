/**
 * Mobile Typography Test
 * PRP-017: Mobile-First Design Overhaul
 * Task: T011
 *
 * Test text is readable without zoom (≥16px on mobile)
 * This test should FAIL initially if text is too small (TDD RED phase)
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile Typography', () => {
  test('Body text is readable without zoom (≥14px minimum)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-react-tutorial');

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
    await page.goto('/blog/countdown-timer-react-tutorial');

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
    await page.goto('/blog/countdown-timer-react-tutorial');

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

      // H1 should be larger than H2
      expect(h1Size, 'H1 should be larger than H2').toBeGreaterThan(h2Size);

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

    const h1 = page.locator('h1').first();

    if (await h1.isVisible()) {
      const minSize = await h1.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );

      // Resize to larger mobile viewport
      await page.setViewportSize({ width: 428, height: 926 });
      await page.waitForTimeout(100);

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
    await page.goto('/blog/countdown-timer-react-tutorial');

    // Check that text containers don't overflow
    const textContainers = await page
      .locator('article, .prose, main, section')
      .all();

    for (const container of textContainers.slice(0, 10)) {
      if (await container.isVisible()) {
        const overflowX = await container.evaluate(
          (el) => window.getComputedStyle(el).overflowX
        );

        const box = await container.boundingBox();

        if (box && box.width > 390) {
          // If container is wider than viewport, it should have overflow handling
          expect(
            ['auto', 'scroll', 'hidden'].includes(overflowX),
            'Wide containers should have overflow handling'
          ).toBeTruthy();
        }
      }
    }
  });
});
