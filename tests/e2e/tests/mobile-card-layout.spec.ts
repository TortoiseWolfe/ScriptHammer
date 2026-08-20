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
    // `/blog/`, not `/` (#842). The home page has ZERO `[class*="card"]` elements —
    // the 2a refresh (#376) replaced its cards with grid layouts — so every
    // assertion in this file sat behind a guard that was never true. Measured at
    // 390px with the page proven loaded: `/` 0 cards, `/blog/` 56.
    await page.goto('/blog/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // `.card`, not `[class*="card"]` (#842). The loose selector matches 56 elements
    // on /blog/ including `card-body`, which is a CHILD of the first card — so
    // cards[0] vs cards[1] compared a card against its own child and the "stacking"
    // assertion was meaningless. `.card` matches the 14 real card roots.
    const cards = await page.locator('.card').all();

    // ASSERT the precondition rather than branching on it. A guard makes "the cards
    // are gone" and "the cards are correct" report identically.
    expect(
      cards.length,
      'fewer than two cards found — this test cannot measure stacking, and a guard ' +
        'here would hide that (#842)'
    ).toBeGreaterThanOrEqual(2);

    {
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
    await page.goto('/', { waitUntil: 'domcontentloaded' });
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
      await page.goto('/blog/', { waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);
      await waitForLayoutStability(page);

      const cards = await page.locator('.card').all();

      expect(
        cards.length,
        `no cards found at ${width}px — nothing is being measured (#842)`
      ).toBeGreaterThan(0);

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
