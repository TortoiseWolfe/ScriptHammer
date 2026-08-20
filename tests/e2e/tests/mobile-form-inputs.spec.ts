/**
 * Mobile Form Input Test (T016)
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

test.describe('Mobile Form Inputs', () => {
  const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minHeight;
  const TOLERANCE = 1;

  test('Form inputs meet 44px height minimum', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/contact/');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // `:not([tabindex="-1"])` excludes the spam honeypot, on the property that
    // matters rather than by name: it is positioned off-screen with tabIndex -1, so
    // it is not keyboard-reachable and a touch-target minimum cannot apply to it.
    // Playwright's isVisible() returns true for off-screen elements, so filtering on
    // visibility alone does not exclude it.
    const inputs = await page
      .locator(
        'input[type="text"]:not([tabindex="-1"]), input[type="email"]:not([tabindex="-1"]), textarea:not([tabindex="-1"]), select:not([tabindex="-1"])'
      )
      .all();

    // ASSERT the precondition, do not branch on it (#842). This spec used to visit
    // `/`, which has ZERO form inputs and zero `<form>` elements — measured at 390px
    // with the page proven loaded. Every assertion below sat inside the loop, so the
    // test passed having asserted nothing, on every run, in the required lane.
    expect(
      inputs.length,
      'no form inputs found — this spec measures nothing unless the page it visits ' +
        'actually has a form (#842)'
    ).toBeGreaterThan(0);

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
    await page.goto('/contact/');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // DaisyUI v5 dropped .form-control; field wrappers are now fieldsets or the
    // div/label groups around an input. Match those plus any legacy input-group.
    const formGroups = await page
      .locator('fieldset.fieldset, label.label, [class*="input-group"]')
      .all();

    expect(
      formGroups.length,
      'no field groups found — see #842; branching on this instead of asserting it ' +
        'is what let this spec pass against a page with no form'
    ).toBeGreaterThan(0);

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
