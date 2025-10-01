/**
 * Mobile Form Input Test (T016)
 * PRP-017: Mobile-First Design Overhaul
 */

import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';

test.describe('Mobile Form Inputs', () => {
  const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minHeight;
  const TOLERANCE = 1;

  test('Form inputs meet 44px height minimum', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const inputs = await page
      .locator('input[type="text"], input[type="email"], textarea, select')
      .all();

    for (const input of inputs) {
      if (await input.isVisible()) {
        const box = await input.boundingBox();

        if (box) {
          expect(
            box.height,
            'Input height must be ≥ 44px'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
        }
      }
    }
  });

  test('Form fields have adequate spacing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const formGroups = await page
      .locator('[class*="form-control"], [class*="input-group"]')
      .all();

    for (const group of formGroups) {
      const marginBottom = await group.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).marginBottom)
      );

      if (marginBottom > 0) {
        expect(
          marginBottom,
          'Form field spacing should be ≥ 16px'
        ).toBeGreaterThanOrEqual(16);
      }
    }
  });
});
