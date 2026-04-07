import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from './utils/test-user-factory';

test.describe('Mobile Dropdown Menu Screenshots', () => {
  test('should capture dropdown menu on mobile', async ({ page }) => {
    // Set mobile viewport — hamburger menu is visible below lg (1024px)
    await page.setViewportSize({ width: 390, height: 844 });

    // Navigate to the home page
    await page.goto('/');
    await dismissCookieBanner(page);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Find the mobile/tablet hamburger menu (it's a label, not a button).
    // Use the aria-label to match, independent of the responsive class name.
    const menuLabel = page.getByLabel('Navigation menu').first();

    // Take screenshot before opening
    await page.screenshot({
      path: 'screenshots/mobile-dropdown-closed.png',
      fullPage: false,
    });

    // Open the dropdown by clicking the label
    await menuLabel.click();

    // Wait for dropdown to be visible
    await page.waitForTimeout(500); // Animation time

    // Take screenshot with dropdown open
    await page.screenshot({
      path: 'screenshots/mobile-dropdown-open.png',
      fullPage: false,
    });

    // Verify dropdown is visible — DaisyUI dropdown-content appears after
    // clicking the trigger label with tabIndex=0.
    const dropdownMenu = page.locator('.dropdown-content.menu').first();
    await expect(dropdownMenu).toBeVisible();
  });
});
