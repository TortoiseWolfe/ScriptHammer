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

    // Open the dropdown deterministically. DaisyUI v5's CSS-only dropdown
    // keeps .dropdown-content display:none unless one of these is true on
    // the .dropdown parent: :focus-within, :hover (with .dropdown-hover),
    // or the .dropdown-open class. Relying on :focus-within via click or
    // .focus() is unreliable in Playwright headless because <label> focus
    // semantics differ, and clicking a label after it opens triggers
    // "intercepts pointer events" errors (DaisyUI sets pointer-events:none
    // on the open dropdown's tabindex child). Instead, add .dropdown-open
    // directly to the parent — this is an officially supported DaisyUI class.
    await menuLabel.evaluate((el) => {
      const parent = el.closest('.dropdown');
      parent?.classList.add('dropdown-open');
    });

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
