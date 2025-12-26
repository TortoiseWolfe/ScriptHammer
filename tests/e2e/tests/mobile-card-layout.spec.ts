/**
 * Mobile Card Layout Test (T014)
 * PRP-017: Mobile-First Design Overhaul
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * Wait for layout to stabilize after viewport change
 */
async function waitForLayoutStability(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for layout to stabilize
  await page.waitForFunction(
    () => {
      return new Promise((resolve) => {
        let stable = 0;
        const check = () => {
          stable++;
          if (stable >= 3) {
            resolve(true);
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    },
    { timeout: 5000 }
  );
}

test.describe('Mobile Card Layout', () => {
  test('Cards stack vertically on mobile (320px-767px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    const cards = await page.locator('[class*="card"]').all();
    if (cards.length >= 2) {
      const box1 = await cards[0].boundingBox();
      const box2 = await cards[1].boundingBox();

      if (box1 && box2) {
        // Vertical stacking: second card should be below first
        expect(
          box2.y,
          'Cards should stack vertically on mobile'
        ).toBeGreaterThan(
          box1.y + box1.height - 10 // Allow small overlap for spacing
        );
      }
    }
  });

  test('Cards use grid layout on tablet (768px+)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    const container = page.locator('[class*="grid"]').first();

    if (await container.isVisible()) {
      const display = await container.evaluate(
        (el) => window.getComputedStyle(el).display
      );

      expect(display, 'Should use grid layout on tablet').toBe('grid');
    }
  });

  test('Cards fit within viewport at all mobile widths', async ({ page }) => {
    const widths = [320, 390, 428];

    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await dismissCookieBanner(page);
      await waitForLayoutStability(page);

      const cards = await page.locator('[class*="card"]').all();

      for (const card of cards.slice(0, 5)) {
        const box = await card.boundingBox();

        if (box) {
          expect(
            box.width,
            `Card width should not exceed ${width}px`
          ).toBeLessThanOrEqual(width + 1);
        }
      }
    }
  });
});
