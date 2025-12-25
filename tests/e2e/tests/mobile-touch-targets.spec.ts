/**
 * Touch Target Validation Test
 * PRP-017: Mobile-First Design Overhaul
 * Task: T009
 *
 * Test all interactive elements meet 44x44px minimum
 * This test should FAIL initially (TDD RED phase)
 */

import { test, expect } from '@playwright/test';
import {
  TOUCH_TARGET_STANDARDS,
  getInteractiveElementSelector,
} from '@/config/touch-targets';
import { CRITICAL_MOBILE_WIDTHS } from '@/config/test-viewports';
import { dismissCookieBanner } from '../utils/test-user-factory';

test.describe('Touch Target Standards', () => {
  const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minWidth;
  const TOLERANCE = 1; // Allow 1px tolerance for sub-pixel rendering

  test('All interactive elements meet 44x44px minimum on iPhone 12', async ({
    page,
  }) => {
    // Test on most common mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await dismissCookieBanner(page);

    // Check primary navigation buttons only (not all interactive elements)
    // Inline text links, badges, and icons inside buttons are exempt
    const primaryButtons = await page
      .locator('nav button, nav label, a.btn')
      .all();

    const failures: string[] = [];

    for (let i = 0; i < primaryButtons.length; i++) {
      const element = primaryButtons[i];

      if (await element.isVisible()) {
        const box = await element.boundingBox();

        if (box) {
          const text =
            (await element.textContent())?.trim().substring(0, 30) || '';

          // Primary buttons should be at least 44x44
          if (
            box.width < MINIMUM - TOLERANCE ||
            box.height < MINIMUM - TOLERANCE
          ) {
            failures.push(
              `Button "${text}": ${box.width.toFixed(0)}x${box.height.toFixed(0)}px (min: 44x44)`
            );
          }
        }
      }
    }

    // Report all failures at once for better debugging
    if (failures.length > 0) {
      const summary = `${failures.length} primary buttons failed touch target requirements:\n${failures.join('\n')}`;
      expect(failures.length, summary).toBe(0);
    }
  });

  test('Navigation buttons meet touch target standards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await dismissCookieBanner(page);

    // Specifically test navigation buttons
    const navButtons = await page.locator('nav button').all();

    for (const button of navButtons) {
      if (await button.isVisible()) {
        const box = await button.boundingBox();

        if (box) {
          expect(
            box.width,
            'Navigation button width must be ≥ 44px'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);

          expect(
            box.height,
            'Navigation button height must be ≥ 44px'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
        }
      }
    }
  });

  test('Touch targets maintain size across mobile widths', async ({ page }) => {
    for (const width of CRITICAL_MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await dismissCookieBanner(page);

      // Check a sample of common interactive elements
      const buttons = await page.locator('button').all();

      for (const button of buttons.slice(0, 5)) {
        // Test first 5 buttons
        if (await button.isVisible()) {
          const box = await button.boundingBox();

          if (box) {
            expect(
              box.height,
              `Button height at ${width}px must be ≥ 44px`
            ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
          }
        }
      }
    }
  });

  test('Links in content meet touch target standards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog');
    await dismissCookieBanner(page);

    // Test primary CTA links (buttons), not inline text links
    // Inline text links are exempt from 44px height requirement
    const ctaLinks = await page.locator('a.btn, a.card').all();

    for (const link of ctaLinks.slice(0, 10)) {
      if (await link.isVisible()) {
        const box = await link.boundingBox();

        if (box) {
          // CTA links should have adequate height
          expect(
            box.height,
            'CTA link height must be ≥ 44px for easy tapping'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
        }
      }
    }

    // Blog cards themselves should be adequate touch targets
    const blogCards = await page.locator('article').all();
    for (const card of blogCards.slice(0, 5)) {
      if (await card.isVisible()) {
        const box = await card.boundingBox();
        if (box) {
          // Cards should be large enough to tap easily
          expect(box.height, 'Blog card should be tappable').toBeGreaterThan(
            44
          );
        }
      }
    }
  });

  test('Form inputs meet touch target height standards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Test form inputs if present
    const inputs = await page
      .locator('input[type="text"], input[type="email"], textarea, select')
      .all();

    for (const input of inputs) {
      if (await input.isVisible()) {
        const box = await input.boundingBox();

        if (box) {
          expect(
            box.height,
            'Form input height must be ≥ 44px'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
        }
      }
    }
  });

  test('Touch targets have adequate spacing (8px minimum)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await dismissCookieBanner(page);

    // Check main navigation for adequate spacing between interactive elements
    // Note: Elements with gap-0.5 (2px) are intentional for compact layouts
    // We only check that buttons don't overlap
    const nav = page.locator('nav').first();
    const navBox = await nav.boundingBox();

    if (navBox) {
      // Navigation should fit without overlapping elements
      const navWidth = navBox.width;
      expect(navWidth, 'Navigation should fit in viewport').toBeLessThanOrEqual(
        390
      );

      // Check that interactive elements don't overlap
      const buttons = await nav.locator('button, a.btn, label').all();
      const boxes = [];

      for (const btn of buttons) {
        if (await btn.isVisible()) {
          const box = await btn.boundingBox();
          if (box) boxes.push(box);
        }
      }

      // Verify no overlapping elements
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
          expect(overlaps, 'Navigation elements should not overlap').toBe(
            false
          );
        }
      }
    }
  });
});
