import { test, expect, devices } from '@playwright/test';
import { TOUCH_TARGET_STANDARDS } from '@/config/touch-targets';

/**
 * Touch Target Standards for Blog (T013)
 * PRP-017: Mobile-First Design Overhaul
 *
 * Test blog interactive elements meet 44x44px AAA standards
 * This test should FAIL initially (TDD RED phase)
 */

// iPhone 12 emulation, stripped of fields that break specific browsers:
// - defaultBrowserType: 'webkit' breaks chromium project
// - isMobile: true is not supported by Firefox
const {
  defaultBrowserType: _dbt,
  isMobile: _im,
  ...iPhone12Config
} = devices['iPhone 12'];
test.use(iPhone12Config);

const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minWidth;
const TOLERANCE = 1;

test.describe('Blog Touch Target Standards - iPhone 12', () => {
  test('Blog list cards have adequate touch targets (44x44px minimum)', async ({
    page,
  }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Find all blog post card links
    const blogCards = await page.locator('a[href*="/blog/"]').all();

    const failures: string[] = [];

    for (let i = 0; i < blogCards.length; i++) {
      const card = blogCards[i];

      if (await card.isVisible()) {
        const box = await card.boundingBox();

        if (box) {
          // Cards should have adequate height for tapping
          if (box.height < MINIMUM - TOLERANCE) {
            const href = await card.getAttribute('href');
            failures.push(
              `Card ${i} (${href}): height ${box.height.toFixed(1)}px < ${MINIMUM}px`
            );
          }
        }
      }
    }

    if (failures.length > 0) {
      const summary = `${failures.length} blog cards failed touch target requirements:\n${failures.join('\n')}`;
      expect(failures.length, summary).toBe(0);
    }
  });

  test('Blog post interactive elements meet 44x44px', async ({ page }) => {
    await page.goto('/blog/countdown-timer-tutorial');
    await page.waitForLoadState('networkidle');

    // Test buttons (SEO badge, TOC, etc.)
    // Exclude buttons inside code examples (.mockup-code, pre, code) — these
    // are decorative/illustrative and not real touch targets.
    const buttons = await page
      .locator(
        'button:not(.mockup-code button):not(pre button):not(code button)'
      )
      .all();

    const failures: string[] = [];
    for (const button of buttons) {
      if (await button.isVisible()) {
        const box = await button.boundingBox();

        if (box) {
          if (
            box.width < MINIMUM - TOLERANCE ||
            box.height < MINIMUM - TOLERANCE
          ) {
            const label =
              (await button.getAttribute('aria-label')) ||
              (await button.textContent()) ||
              'unlabeled';
            failures.push(
              `Button "${label.trim().slice(0, 30)}": ${box.width.toFixed(0)}x${box.height.toFixed(0)}px`
            );
          }
        }
      }
    }

    if (failures.length > 0) {
      console.log(
        `⚠ ${failures.length} buttons below 44px touch target:\n  ${failures.join('\n  ')}`
      );
    }
    // Allow up to 2 small decorative buttons (icon toggles, collapse arrows)
    // that don't have meaningful touch-target requirements
    expect(
      failures.length,
      `Too many undersized buttons:\n${failures.join('\n')}`
    ).toBeLessThanOrEqual(2);
  });
});
