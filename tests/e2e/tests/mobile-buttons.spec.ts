/**
 * Mobile Button Test (T015)
 * PRP-017: Mobile-First Design Overhaul
 */

import { test, expect } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';
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

test.describe('Mobile Button Standards', () => {
  const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minWidth;
  const TOLERANCE = 1;

  /**
   * Routes this gate visits. `/` ALONE WAS NOT ENOUGH (#396).
   *
   * Its three visible `.btn` elements all pass, so the gate ran green while the
   * contact form's PRIMARY ACTION rendered at 40px — a bare `btn btn-primary` with
   * no height floor, on the one button that page exists for. Measured on production
   * at 390px. A gate is only as wide as what it points at.
   *
   * Each route earns its place by holding buttons the others do not:
   *   /          nav and hero chrome
   *   /contact/  a form submit — the case that was missed
   *   /blog/     card actions
   */
  const BUTTON_ROUTES = ['/', '/contact/', '/blog/'];

  test('All buttons meet 44x44px minimum on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const failures: string[] = [];
    let measured = 0;

    for (const route of BUTTON_ROUTES) {
      await page.goto(route);
      await dismissCookieBanner(page);
      await waitForLayoutStability(page);

      // Check primary action buttons (btn class), not all buttons
      // Small icon buttons and decorative buttons are exempt
      const buttons = await page.locator('.btn').all();

      for (const button of buttons) {
        if (!(await button.isVisible())) continue;
        const box = await button.boundingBox();
        if (!box) continue;

        measured++;
        const text =
          (await button.textContent())?.trim().substring(0, 20) || '';

        if (
          box.width < MINIMUM - TOLERANCE ||
          box.height < MINIMUM - TOLERANCE
        ) {
          failures.push(
            `${route} — "${text}": ${box.width.toFixed(0)}x${box.height.toFixed(0)}px`
          );
        }
      }
    }

    // COVERAGE FLOOR, asserted unconditionally. Without it a selector change or an
    // empty route makes this pass having measured nothing — and it would look
    // identical to a clean sweep in the report (#396).
    expect(
      measured,
      `no visible .btn elements found across ${BUTTON_ROUTES.join(', ')} — this ` +
        'gate measured nothing'
    ).toBeGreaterThanOrEqual(BUTTON_ROUTES.length);

    expect(
      failures,
      `${failures.length} button(s) below ${MINIMUM}px:\n${failures.join('\n')}`
    ).toEqual([]);
  });

  test('Buttons have 8px minimum spacing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

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
