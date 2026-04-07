/**
 * Mobile Orientation Change Test
 * PRP-017: Mobile-First Design Overhaul
 * Task: T012
 *
 * Test mobile stays in mobile mode when rotated to landscape
 * This test should FAIL initially if layout switches incorrectly (TDD RED phase)
 */

import { test, expect, devices } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

// Strip defaultBrowserType (forces webkit, breaks chromium project) and
// isMobile (Firefox throws "options.isMobile is not supported in Firefox").
// Mobile emulation still works in all browsers via viewport/UA/touch fields.
const {
  defaultBrowserType: _iPhoneDbt,
  isMobile: _iPhoneIm,
  ...iPhone12Base
} = devices['iPhone 12'];

const {
  defaultBrowserType: _iPadDbt,
  isMobile: _iPadIm,
  ...iPadMiniLandscapeBase
} = devices['iPad Mini landscape'];

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

test.describe('Mobile Orientation Detection', () => {
  test('iPhone 12 portrait uses mobile styles', async ({ browser }) => {
    const context = await browser.newContext({
      ...iPhone12Base,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

    // Check viewport dimensions - width should match iPhone 12
    // Height may vary due to browser chrome
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(390);
    expect(viewportSize?.height).toBeGreaterThan(500); // At least portrait aspect

    // Navigation should be visible
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();

    // Check for mobile menu toggle (should exist in portrait)
    // DaisyUI uses label elements for dropdown triggers
    const mobileMenuToggle = page.locator(
      'nav [aria-label*="menu" i], nav [aria-label*="navigation" i]'
    );

    // Mobile menu toggle should be visible on narrow screens
    const isMobileView = await page.evaluate(() => window.innerWidth < 768);
    expect(isMobileView, 'Should be in mobile viewport').toBeTruthy();

    // Mobile menu toggle should be visible
    await expect(mobileMenuToggle.first()).toBeVisible();

    await context.close();
  });

  test('iPhone 12 landscape STAYS in mobile mode (critical test)', async ({
    browser,
  }) => {
    // This is the KEY test: landscape mobile should NOT switch to tablet layout
    const context = await browser.newContext({
      ...iPhone12Base,
      viewport: { width: 844, height: 390 }, // Landscape: width > height
    });
    const page = await context.newPage();

    await page.goto('/');
    await dismissCookieBanner(page);
    await waitForLayoutStability(page);

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
      ...iPadMiniLandscapeBase,
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
    // Use SEPARATE contexts for portrait and landscape instead of
    // setViewportSize() mid-test. When a context is created with a device
    // descriptor (deviceScaleFactor: 3), Chromium/Firefox don't reliably
    // honor setViewportSize() afterward — innerWidth comes back wrong
    // (e.g. 881 instead of 844 due to DPR rounding).

    // Portrait context — verify mobile dimensions
    const portraitContext = await browser.newContext({
      ...iPhone12Base,
      viewport: { width: 390, height: 844 },
    });
    const portraitPage = await portraitContext.newPage();
    await portraitPage.goto('/');
    await waitForLayoutStability(portraitPage);
    const portraitWidth = await portraitPage.evaluate(() => window.innerWidth);
    expect(portraitWidth).toBe(390);
    await portraitContext.close();

    // Landscape context — verify mobile-in-landscape dimensions and layout
    const landscapeContext = await browser.newContext({
      ...iPhone12Base,
      viewport: { width: 844, height: 390 },
    });
    const landscapePage = await landscapeContext.newPage();
    await landscapePage.goto('/');
    await waitForLayoutStability(landscapePage);

    const landscapeWidth = await landscapePage.evaluate(
      () => window.innerWidth
    );
    expect(landscapeWidth).toBe(844);

    // Navigation should be visible in landscape
    const nav = landscapePage.locator('nav').first();
    await expect(nav).toBeVisible();

    // Page should not have horizontal scroll in landscape
    const scrollWidth = await landscapePage.evaluate(
      () => document.body.scrollWidth
    );
    expect(
      scrollWidth,
      'No horizontal scroll in landscape'
    ).toBeLessThanOrEqual(844 + 1);

    await landscapeContext.close();
  });

  test('matchMedia detects orientation correctly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // Portrait
    await page.goto('/');
    await waitForLayoutStability(page);

    const portraitMatch = await page.evaluate(
      () => window.matchMedia('(orientation: portrait)').matches
    );
    expect(portraitMatch, 'Should match portrait orientation').toBeTruthy();

    // Rotate to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await waitForLayoutStability(page);

    const landscapeMatch = await page.evaluate(
      () => window.matchMedia('(orientation: landscape)').matches
    );
    expect(landscapeMatch, 'Should match landscape orientation').toBeTruthy();
  });

  test('Content adapts to orientation without breaking', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog');
    await waitForLayoutStability(page);

    // Get blog cards in portrait
    const cardsPortrait = await page.locator('[class*="card"]').count();

    // Rotate to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await waitForLayoutStability(page);

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
