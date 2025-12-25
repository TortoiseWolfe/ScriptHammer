/**
 * Mobile Navigation Test
 * PRP-017: Mobile-First Design Overhaul
 * Task: T008
 *
 * Test navigation fits mobile viewport with no horizontal scroll
 * This test should FAIL initially (TDD RED phase)
 */

import { test, expect } from '@playwright/test';
import { TEST_VIEWPORTS } from '@/config/test-viewports';
import { dismissCookieBanner } from '../utils/test-user-factory';

test.describe('Mobile Navigation', () => {
  // Test at multiple mobile viewports
  const mobileViewports = TEST_VIEWPORTS.filter((v) => v.category === 'mobile');

  for (const viewport of mobileViewports) {
    test(`Navigation fits within ${viewport.name} viewport (${viewport.width}px)`, async ({
      page,
    }) => {
      // Set viewport size
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      // Navigate to homepage
      await page.goto('/');
      await dismissCookieBanner(page);

      // Wait for navigation to be visible
      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible();

      // Get navigation bounding box
      const navBox = await nav.boundingBox();
      expect(navBox).not.toBeNull();

      if (navBox) {
        // Navigation must fit within viewport width
        expect(
          navBox.width,
          'Navigation width exceeds viewport'
        ).toBeLessThanOrEqual(
          viewport.width + 1 // Allow 1px tolerance for sub-pixel rendering
        );

        // Navigation must not cause horizontal overflow
        expect(navBox.x, 'Navigation starts off-screen').toBeGreaterThanOrEqual(
          0
        );
      }

      // Check for horizontal scroll on entire page
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const clientWidth = await page.evaluate(() => document.body.clientWidth);

      expect(
        scrollWidth,
        `Horizontal scroll detected (scrollWidth: ${scrollWidth}px, viewport: ${viewport.width}px)`
      ).toBeLessThanOrEqual(clientWidth + 1);
    });
  }

  test('Navigation controls are all visible at 320px (narrowest mobile)', async ({
    page,
  }) => {
    // Test at absolute minimum supported width
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await dismissCookieBanner(page);

    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();

    // Check that nav doesn't overflow
    const navBox = await nav.boundingBox();
    if (navBox) {
      expect(
        navBox.width,
        'Navigation width exceeds viewport'
      ).toBeLessThanOrEqual(320 + 1);
    }

    // Check for visible interactive elements in the nav (not hidden dropdown contents)
    // At 320px, we expect: logo link, hamburger menu button
    const logo = nav.locator('a').first();
    await expect(logo, 'Logo should be visible').toBeVisible();

    // Mobile menu toggle (label or button with menu icon)
    const menuToggle = nav
      .locator('[aria-label*="menu" i], [aria-label*="navigation" i]')
      .first();
    await expect(
      menuToggle,
      'Mobile menu toggle should be visible'
    ).toBeVisible();

    // Verify menu toggle is within viewport
    const menuBox = await menuToggle.boundingBox();
    if (menuBox) {
      expect(
        menuBox.x,
        'Menu toggle positioned off-screen'
      ).toBeGreaterThanOrEqual(0);
      expect(
        menuBox.x + menuBox.width,
        'Menu toggle extends beyond viewport'
      ).toBeLessThanOrEqual(320 + 1);
    }
  });

  test('Mobile menu toggle works on narrow viewports', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await dismissCookieBanner(page);

    // Look for mobile menu button (hamburger icon) - it's a label in DaisyUI dropdown
    const menuButton = page
      .locator('[aria-label*="menu" i], [aria-label*="navigation" i]')
      .first();

    if (await menuButton.isVisible()) {
      // Click to open mobile menu
      await menuButton.click();

      // Menu content should become visible (DaisyUI uses dropdown-content class)
      const menuContent = page.locator('nav .dropdown-content').first();

      // Allow time for animation
      await page.waitForTimeout(300);

      // Menu should be visible after click
      await expect(menuContent).toBeVisible();

      // Verify menu contains navigation items
      const menuLinks = menuContent.locator('a');
      const linkCount = await menuLinks.count();
      expect(linkCount, 'Menu should contain navigation links').toBeGreaterThan(
        0
      );

      // Close by clicking outside (DaisyUI dropdowns are focus-based)
      await page.locator('body').click({ position: { x: 10, y: 10 } });
    }
  });

  test('Navigation adapts to orientation change', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await dismissCookieBanner(page);

    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();

    // Rotate to landscape (width > height but still mobile)
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(100);

    // Navigation should still be visible and fit
    await expect(nav).toBeVisible();

    const navBox = await nav.boundingBox();
    if (navBox) {
      expect(
        navBox.width,
        'Navigation overflows in landscape'
      ).toBeLessThanOrEqual(844 + 1);
    }
  });
});
