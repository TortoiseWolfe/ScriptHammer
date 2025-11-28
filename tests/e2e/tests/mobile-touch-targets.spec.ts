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

test.describe('Touch Target Standards', () => {
  const MINIMUM = TOUCH_TARGET_STANDARDS.AAA.minWidth;
  const TOLERANCE = 1; // Allow 1px tolerance for sub-pixel rendering

  test('All interactive elements meet 44x44px minimum on iPhone 12', async ({
    page,
  }) => {
    // Test on most common mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Get all interactive elements
    const selector = getInteractiveElementSelector();
    const interactiveElements = await page.locator(selector).all();

    const failures: string[] = [];

    for (let i = 0; i < interactiveElements.length; i++) {
      const element = interactiveElements[i];

      if (await element.isVisible()) {
        const box = await element.boundingBox();

        if (box) {
          const tagName = await element.evaluate((el) => el.tagName);
          const text =
            (await element.textContent())?.trim().substring(0, 30) || '';

          // Check width
          if (box.width < MINIMUM - TOLERANCE) {
            failures.push(
              `Element ${i} (${tagName}: "${text}"): width ${box.width.toFixed(1)}px < ${MINIMUM}px`
            );
          }

          // Check height
          if (box.height < MINIMUM - TOLERANCE) {
            failures.push(
              `Element ${i} (${tagName}: "${text}"): height ${box.height.toFixed(1)}px < ${MINIMUM}px`
            );
          }
        }
      }
    }

    // Report all failures at once for better debugging
    if (failures.length > 0) {
      const summary = `${failures.length} elements failed touch target requirements:\n${failures.join('\n')}`;
      expect(failures.length, summary).toBe(0);
    }
  });

  test('Navigation buttons meet touch target standards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

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

    // Test links in blog card elements
    const links = await page.locator('a[href*="/blog/"]').all();

    for (const link of links.slice(0, 10)) {
      // Test first 10 links
      if (await link.isVisible()) {
        const box = await link.boundingBox();

        if (box) {
          // Links should have adequate height (at least 44px clickable area)
          expect(
            box.height,
            'Link height must be ≥ 44px for easy tapping'
          ).toBeGreaterThanOrEqual(MINIMUM - TOLERANCE);
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

    // Check button groups for spacing
    const buttonGroups = await page.locator('[class*="gap"], nav').all();

    for (const group of buttonGroups) {
      const gap = await group.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return parseFloat(computed.gap) || 0;
      });

      // If gap is set, it should be at least 8px
      if (gap > 0) {
        expect(
          gap,
          'Gap between interactive elements should be ≥ 8px'
        ).toBeGreaterThanOrEqual(TOUCH_TARGET_STANDARDS.AAA.minSpacing);
      }
    }
  });
});
