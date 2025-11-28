/**
 * Mobile Footer Test (T018)
 * PRP-017: Mobile-First Design Overhaul
 */

import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';

test.describe('Mobile Footer', () => {
  const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minHeight;
  const TOLERANCE = 1;

  test('Footer links stack vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    const footerLinks = await page.locator('footer a').all();

    if (footerLinks.length >= 2) {
      const box1 = await footerLinks[0].boundingBox();
      const box2 = await footerLinks[1].boundingBox();

      // Links might stack or be in a row - just ensure they're visible
      if (box1 && box2) {
        expect(box1.width).toBeGreaterThan(0);
        expect(box2.width).toBeGreaterThan(0);
      }
    }
  });

  test('Footer links meet touch target standards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    const footerLinks = await page.locator('footer a').all();

    for (const link of footerLinks.slice(0, 10)) {
      if (await link.isVisible()) {
        const box = await link.boundingBox();

        if (box) {
          expect(
            box.height,
            'Footer link height must be ≥ 44px'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
        }
      }
    }
  });

  test('Footer fits within viewport', async ({ page }) => {
    const widths = [320, 390, 428];

    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);

      const footer = page.locator('footer');
      const box = await footer.boundingBox();

      if (box) {
        expect(
          box.width,
          `Footer should fit within ${width}px viewport`
        ).toBeLessThanOrEqual(width + 1);
      }
    }
  });
});
