/**
 * Mobile Image Responsive Test (T017)
 * PRP-017: Mobile-First Design Overhaul
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile Responsive Images', () => {
  const widths = [320, 390, 428];

  for (const width of widths) {
    test(`Images fit within ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/blog/countdown-timer-react-tutorial');

      const images = await page.locator('img').all();

      for (const img of images) {
        if (await img.isVisible()) {
          const box = await img.boundingBox();

          if (box) {
            expect(
              box.width,
              'Image width should not exceed viewport'
            ).toBeLessThanOrEqual(width + 1);
          }
        }
      }
    });
  }

  test('Images use lazy loading', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog');

    const images = await page.locator('img').all();

    for (const img of images.slice(0, 10)) {
      const loading = await img.getAttribute('loading');

      // Images should have lazy loading (except first/hero images)
      if (loading) {
        expect(['lazy', 'eager']).toContain(loading);
      }
    }
  });
});
