/**
 * Horizontal Scroll Detection Test
 * PRP-017: Mobile-First Design Overhaul
 * Task: T010
 *
 * Test zero horizontal scroll on all pages at mobile widths
 * This test should FAIL initially (TDD RED phase)
 */

import { test, expect } from '@playwright/test';
import { TEST_PAGES, CRITICAL_MOBILE_WIDTHS } from '@/config/test-viewports';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * Wait for layout to stabilize after viewport change
 * Uses DOM observation instead of arbitrary timeouts
 */
async function waitForLayoutStability(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for no layout shifts for 100ms
  await page.waitForFunction(
    () => {
      return new Promise((resolve) => {
        let lastWidth = document.documentElement.scrollWidth;
        let stableCount = 0;
        const check = () => {
          const currentWidth = document.documentElement.scrollWidth;
          if (currentWidth === lastWidth) {
            stableCount++;
            if (stableCount >= 3) {
              resolve(true);
              return;
            }
          } else {
            stableCount = 0;
            lastWidth = currentWidth;
          }
          setTimeout(check, 50);
        };
        check();
      });
    },
    { timeout: 5000 }
  );
}

test.describe('Horizontal Scroll Detection', () => {
  // Test all critical pages at all critical mobile widths
  for (const url of TEST_PAGES) {
    for (const width of CRITICAL_MOBILE_WIDTHS) {
      test(`No horizontal scroll on ${url} at ${width}px`, async ({ page }) => {
        // Set viewport to specific mobile width
        await page.setViewportSize({ width, height: 800 });

        // Navigate to page
        await page.goto(url);
        await dismissCookieBanner(page);

        // Wait for layout to stabilize
        await waitForLayoutStability(page);

        // Check document scroll width vs client width
        const scrollWidth = await page.evaluate(
          () => document.documentElement.scrollWidth
        );
        const clientWidth = await page.evaluate(
          () => document.documentElement.clientWidth
        );

        // scrollWidth should not exceed clientWidth (allowing 1px tolerance)
        expect(
          scrollWidth,
          `Horizontal scroll detected on ${url} at ${width}px: scrollWidth ${scrollWidth}px > clientWidth ${clientWidth}px`
        ).toBeLessThanOrEqual(clientWidth + 1);

        // Also check body element
        const bodyScrollWidth = await page.evaluate(
          () => document.body.scrollWidth
        );
        const bodyClientWidth = await page.evaluate(
          () => document.body.clientWidth
        );

        expect(
          bodyScrollWidth,
          `Body has horizontal scroll on ${url} at ${width}px`
        ).toBeLessThanOrEqual(bodyClientWidth + 1);
      });
    }
  }

  test('No element extends beyond viewport at 320px', async ({ page }) => {
    // Test at narrowest supported width
    const width = 320;
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // Get all elements
    const allElements = await page.locator('*').all();
    const overflowingElements: string[] = [];

    for (const element of allElements) {
      const box = await element.boundingBox();

      if (box) {
        // Check if element extends beyond viewport
        if (box.x + box.width > width + 1) {
          const tagName = await element.evaluate((el) => el.tagName);
          const className = await element.evaluate(
            (el) => el.className || 'no-class'
          );

          overflowingElements.push(
            `${tagName}.${className}: x=${box.x.toFixed(0)} width=${box.width.toFixed(0)} right=${(box.x + box.width).toFixed(0)}`
          );
        }
      }
    }

    if (overflowingElements.length > 0) {
      const summary = `${overflowingElements.length} elements overflow viewport at 320px:\n${overflowingElements.slice(0, 10).join('\n')}`;
      expect(overflowingElements.length, summary).toBe(0);
    }
  });

  test('Images do not cause horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-tutorial');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    const images = await page.locator('img').all();

    for (const img of images) {
      if (await img.isVisible()) {
        const box = await img.boundingBox();

        if (box) {
          expect(
            box.width,
            'Image width must not exceed viewport'
          ).toBeLessThanOrEqual(390 + 1);
        }
      }
    }
  });

  test('Tables are responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // Check if any tables exist
    const tables = await page.locator('table').all();

    for (const table of tables) {
      if (await table.isVisible()) {
        const box = await table.boundingBox();

        if (box) {
          // Tables should either fit or have overflow-x-auto wrapper
          const parent = await table.evaluateHandle((el) => el.parentElement);
          const parentOverflow = await parent.evaluate(
            (el) => window.getComputedStyle(el!).overflowX
          );

          const tableWidth = box.width;
          const viewportWidth = 390;

          // Either table fits OR parent has overflow scroll
          const fitsInViewport = tableWidth <= viewportWidth + 1;
          const hasScrollableParent =
            parentOverflow === 'auto' || parentOverflow === 'scroll';

          expect(
            fitsInViewport || hasScrollableParent,
            'Table must either fit viewport or have scrollable parent'
          ).toBeTruthy();
        }
      }
    }
  });

  test('Pre/code blocks are responsive', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog/countdown-timer-tutorial');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    const codeBlocks = await page.locator('pre, code').all();

    for (const block of codeBlocks) {
      if (await block.isVisible()) {
        const box = await block.boundingBox();

        if (box) {
          // Code blocks should have overflow-x-auto or fit in viewport
          const overflowX = await block.evaluate(
            (el) => window.getComputedStyle(el).overflowX
          );

          const fitsInViewport = box.width <= 390 + 1;
          const hasHorizontalScroll =
            overflowX === 'auto' || overflowX === 'scroll';

          expect(
            fitsInViewport || hasHorizontalScroll,
            'Code block must either fit or have horizontal scroll'
          ).toBeTruthy();
        }
      }
    }
  });
});
