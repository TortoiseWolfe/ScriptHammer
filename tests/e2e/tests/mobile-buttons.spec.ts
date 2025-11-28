/**
 * Mobile Button Test (T015)
 * PRP-017: Mobile-First Design Overhaul
 */

import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';

test.describe('Mobile Button Standards', () => {
  const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minWidth;
  const TOLERANCE = 1;

  test('All buttons meet 44x44px minimum on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const buttons = await page.locator('button, [role="button"]').all();
    const failures: string[] = [];

    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];

      if (await button.isVisible()) {
        const box = await button.boundingBox();

        if (box) {
          const text =
            (await button.textContent())?.trim().substring(0, 20) || '';

          if (box.width < MINIMUM - TOLERANCE) {
            failures.push(
              `Button ${i} "${text}": width ${box.width.toFixed(1)}px`
            );
          }

          if (box.height < MINIMUM - TOLERANCE) {
            failures.push(
              `Button ${i} "${text}": height ${box.height.toFixed(1)}px`
            );
          }
        }
      }
    }

    if (failures.length > 0) {
      expect(
        failures.length,
        `${failures.length} buttons too small:\n${failures.join('\n')}`
      ).toBe(0);
    }
  });

  test('Buttons have 8px minimum spacing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const buttonGroups = await page.locator('[class*="gap"]').all();

    for (const group of buttonGroups.slice(0, 10)) {
      const gap = await group.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).gap)
      );

      if (gap > 0) {
        expect(gap, 'Button spacing should be ≥ 8px').toBeGreaterThanOrEqual(8);
      }
    }
  });
});
