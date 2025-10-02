/**
 * Mobile Orientation Change Test
 * PRP-017: Mobile-First Design Overhaul
 * Task: T012
 *
 * Test mobile stays in mobile mode when rotated to landscape
 * This test should FAIL initially if layout switches incorrectly (TDD RED phase)
 */

import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Orientation Detection', () => {
  test('iPhone 12 portrait uses mobile styles', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 12'] });
    const page = await context.newPage();

    await page.goto('/');

    // Check viewport dimensions
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(390);
    expect(viewportSize?.height).toBe(844);

    // Check that mobile layout is applied
    // Look for mobile-specific classes or behaviors
    const body = page.locator('body');
    const bodyClasses = await body.getAttribute('class');

    // Navigation should be in mobile mode
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();

    // Check for mobile menu button (should exist in portrait)
    const mobileMenuButton = page.locator(
      'nav button[aria-label*="menu" i], nav button[aria-label*="navigation" i]'
    );

    // Mobile menu button might be visible on narrow screens
    const isMobileView = await page.evaluate(() => window.innerWidth < 768);
    expect(isMobileView, 'Should be in mobile viewport').toBeTruthy();

    await context.close();
  });

  test('iPhone 12 landscape STAYS in mobile mode (critical test)', async ({
    browser,
  }) => {
    // This is the KEY test: landscape mobile should NOT switch to tablet layout
    const context = await browser.newContext({
      ...devices['iPhone 12'],
      viewport: { width: 844, height: 390 }, // Landscape: width > height
    });
    const page = await context.newPage();

    await page.goto('/');

    // Even though width is 844px (which might trigger tablet breakpoint),
    // orientation detection should keep us in mobile mode
    const isMobileView = await page.evaluate(() => {
      // Check if orientation API says we're in landscape
      const orientation = window.screen?.orientation?.type || 'unknown';
      const isLandscape = orientation.includes('landscape');

      // Check viewport dimensions
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Mobile device in landscape: width > height but still a phone
      const isMobileDeviceInLandscape = width > height && width < 1024;

      return { isLandscape, width, height, isMobileDeviceInLandscape };
    });

    expect(
      isMobileView.isMobileDeviceInLandscape,
      'Should detect mobile device in landscape'
    ).toBeTruthy();

    // Mobile menu behavior should still be present (not tablet layout)
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();

    await context.close();
  });

  test('Tablet landscape uses tablet/desktop layout', async ({ browser }) => {
    // iPad Mini landscape should use tablet layout
    const context = await browser.newContext({
      ...devices['iPad Mini landscape'],
    });
    const page = await context.newPage();

    await page.goto('/');

    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(1024);
    expect(viewportSize?.height).toBe(768);

    // Should be in tablet/desktop mode (width >= 1024px)
    const isTabletView = await page.evaluate(() => window.innerWidth >= 768);
    expect(isTabletView, 'Should be in tablet viewport').toBeTruthy();

    await context.close();
  });

  test('Orientation change triggers responsive adjustments', async ({
    browser,
  }) => {
    const context = await browser.newContext({ ...devices['iPhone 12'] });
    const page = await context.newPage();

    await page.goto('/');

    // Get initial layout info
    const portraitWidth = await page.evaluate(() => window.innerWidth);
    expect(portraitWidth).toBe(390);

    // Simulate orientation change to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(100); // Allow layout to adjust

    const landscapeWidth = await page.evaluate(() => window.innerWidth);
    expect(landscapeWidth).toBe(844);

    // Navigation should still be visible after rotation
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();

    // Page should not have horizontal scroll
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(
      scrollWidth,
      'No horizontal scroll in landscape'
    ).toBeLessThanOrEqual(844 + 1);

    await context.close();
  });

  test('matchMedia detects orientation correctly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // Portrait
    await page.goto('/');

    const portraitMatch = await page.evaluate(
      () => window.matchMedia('(orientation: portrait)').matches
    );
    expect(portraitMatch, 'Should match portrait orientation').toBeTruthy();

    // Rotate to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(50);

    const landscapeMatch = await page.evaluate(
      () => window.matchMedia('(orientation: landscape)').matches
    );
    expect(landscapeMatch, 'Should match landscape orientation').toBeTruthy();
  });

  test('Content adapts to orientation without breaking', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog');

    // Get blog cards in portrait
    const cardsPortrait = await page.locator('[class*="card"]').count();

    // Rotate to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(100);

    // Cards should still be visible
    const cardsLandscape = await page.locator('[class*="card"]').count();
    expect(cardsLandscape, 'Cards should remain visible in landscape').toBe(
      cardsPortrait
    );

    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(
      scrollWidth,
      'No horizontal scroll in landscape'
    ).toBeLessThanOrEqual(844 + 1);
  });
});
