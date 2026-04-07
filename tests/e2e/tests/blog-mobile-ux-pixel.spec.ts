import { test, expect, devices } from '@playwright/test';

/**
 * Mobile UX Tests - Mobile Chrome (Pixel 5)
 *
 * Run same tests on Android viewport to ensure cross-platform compatibility
 *
 * See PRP-016: Mobile-First Visual Testing Methodology
 */

// Pixel 5 emulation, stripped of fields that break specific browsers:
// - defaultBrowserType: 'chromium' is fine but explicit destructure for clarity
// - isMobile: true is not supported by Firefox (throws on newContext)
const {
  defaultBrowserType: _dbt,
  isMobile: _im,
  ...pixel5Config
} = devices['Pixel 5'];
test.use(pixel5Config);

test.describe('Blog Post Mobile UX - Pixel 5', () => {
  test('should display footer at bottom', async ({ page }) => {
    await page.goto('/blog/countdown-timer-tutorial');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Made by');
  });

  test('should not have horizontal scroll', async ({ page }) => {
    await page.goto('/blog/countdown-timer-tutorial');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;

    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});
