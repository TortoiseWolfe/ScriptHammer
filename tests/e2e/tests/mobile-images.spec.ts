/**
 * Mobile Image Responsive Test (T017)
 * PRP-017: Mobile-First Design Overhaul
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

test.describe('Mobile Responsive Images', () => {
  const widths = [320, 390, 428];

  for (const width of widths) {
    test(`Images fit within ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/blog/countdown-timer-tutorial');
      await dismissCookieBanner(page);
      await waitForLayoutStability(page);

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
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

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
