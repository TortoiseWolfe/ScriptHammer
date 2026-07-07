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

    // Get the hamburger's .dropdown parent — NOT the user account dropdown.
    // When the test runs logged-in (auth storageState is loaded), the nav
    // shows TWO dropdowns: the user account avatar (first in DOM) AND the
    // hamburger menu. The previous selector `.dropdown-content.menu`.first()
    // was matching the user account dropdown-content instead of the
    // hamburger's, which is why toBeVisible() always failed — we opened
    // the hamburger but asserted against a different dropdown.
    const hamburgerDropdown = page
      .locator('.dropdown', { has: menuLabel })
      .first();

    // Open the dropdown deterministically via DaisyUI's .dropdown-open class.
    // CSS-only :focus-within is unreliable because <label> focus semantics
    // differ across browsers/headless modes, and clicking a label after
    // the dropdown opens triggers "intercepts pointer events" errors.
    await hamburgerDropdown.evaluate((el) => {
      el.classList.add('dropdown-open');
    });

    // Wait for dropdown to be visible
    await page.waitForTimeout(500); // Animation time

    // Take screenshot with dropdown open
    await page.screenshot({
      path: 'screenshots/mobile-dropdown-open.png',
      fullPage: false,
    });

    // Verify the hamburger's dropdown-content is visible (scoped to the
    // hamburger parent, not the user account dropdown).
    const dropdownMenu = hamburgerDropdown.locator('.dropdown-content.menu');
    await expect(dropdownMenu).toBeVisible();
  });
});
