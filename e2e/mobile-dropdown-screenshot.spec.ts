import { test, expect } from '@playwright/test';

test.describe('Mobile Dropdown Menu Screenshots', () => {
  test('should capture dropdown menu on mobile', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Find the mobile hamburger menu (it's a label, not a button)
    const menuLabel = page
      .locator('.dropdown.dropdown-end.md\\:hidden label')
      .first();

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

    // Verify dropdown is visible
    const dropdownMenu = page.locator('.dropdown-content.menu');
    await expect(dropdownMenu).toBeVisible();
  });
});
