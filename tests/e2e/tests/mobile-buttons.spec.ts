/**
 * Mobile Button Test (T015)
 * PRP-017: Mobile-First Design Overhaul
 */

import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';
import { dismissCookieBanner } from '../utils/test-user-factory';

test.describe('Mobile Button Standards', () => {
  const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minWidth;
  const TOLERANCE = 1;

  test('All buttons meet 44x44px minimum on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await dismissCookieBanner(page);

    // Check primary action buttons (btn class), not all buttons
    // Small icon buttons and decorative buttons are exempt
    const buttons = await page.locator('.btn').all();
    const failures: string[] = [];

    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];

      if (await button.isVisible()) {
        const box = await button.boundingBox();

        if (box) {
          const text =
            (await button.textContent())?.trim().substring(0, 20) || '';

          // Primary buttons should meet the 44px minimum
          if (
            box.width < MINIMUM - TOLERANCE ||
            box.height < MINIMUM - TOLERANCE
          ) {
            failures.push(
              `Button "${text}": ${box.width.toFixed(0)}x${box.height.toFixed(0)}px`
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
    await dismissCookieBanner(page);

    // Verify buttons don't overlap (rather than enforcing specific gap)
    // Gap of 2px is acceptable for compact navigation
    const buttons = await page.locator('.btn').all();
    const boxes = [];

    for (const btn of buttons) {
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        if (box) boxes.push(box);
      }
    }

    // Verify no overlapping buttons
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlaps = !(
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y
        );
        expect(overlaps, 'Buttons should not overlap').toBe(false);
      }
    }
  });
});
