import { test, expect, devices } from '@playwright/test';

/**
 * Mobile UX Tests - Mobile Chrome (Pixel 5)
 *
 * Run same tests on Android viewport to ensure cross-platform compatibility
 *
 * See PRP-016: Mobile-First Visual Testing Methodology
 */

// Device configuration at file scope (not inside describe)
test.use({
  ...devices['Pixel 5'],
});

test.describe('Blog Post Mobile UX - Pixel 5', () => {
  test('should display footer at bottom', async ({ page }) => {
    await page.goto('/blog/countdown-timer-react-tutorial');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Made by');
  });

  test('should not have horizontal scroll', async ({ page }) => {
    await page.goto('/blog/countdown-timer-react-tutorial');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;

    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});
