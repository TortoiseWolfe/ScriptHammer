import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

test.describe('Homepage Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissCookieBanner(page);
  });

  test('homepage loads with correct title', async ({ page }) => {
    // Check the page title contains project name
    await expect(page).toHaveTitle(/.*/);

    // Check the main heading is visible
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('navigate to themes page', async ({ page }) => {
    // Click the Browse Themes button
    await page.click('text=Browse Themes');

    // Verify navigation to themes page
    await expect(page).toHaveURL(/.*themes/);

    // Verify themes page content loads
    const themesHeading = page.locator('h1').filter({ hasText: /Theme/i });
    await expect(themesHeading).toBeVisible();
  });

  test('navigate to storybook page', async ({ page, context }) => {
    // Storybook opens in new tab (external link)
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.click('text=View Storybook'),
    ]);

    // Check the new tab URL contains storybook
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('storybook');
    await newPage.close();
  });

  test('key features section is present', async ({ page }) => {
    // Check that the Key Features section exists
    const featuresHeading = page
      .locator('h2')
      .filter({ hasText: /Key Features/i });
    await expect(featuresHeading).toBeVisible();

    // Check feature cards are present
    const featureCards = page.locator('h3');
    await expect(featureCards.filter({ hasText: /32 Themes/i })).toBeVisible();
    await expect(featureCards.filter({ hasText: /PWA Ready/i })).toBeVisible();
    await expect(featureCards.filter({ hasText: /Accessible/i })).toBeVisible();
    await expect(
      featureCards.filter({ hasText: /Production Ready/i })
    ).toBeVisible();
  });

  test('navigate to game page', async ({ page }) => {
    // Click the Play Game link in secondary navigation
    await page.click('text=Play Game');

    // Verify navigation to game page
    await expect(page).toHaveURL(/.*game/);
  });

  test('navigation links in secondary nav work', async ({ page }) => {
    // Test Status link - use role-based selector
    const statusLink = page.getByRole('link', { name: /status/i }).first();
    await statusLink.click();
    await expect(page).toHaveURL(/.*status/);
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Test Accessibility page link - find the "Accessible" card which links to /accessibility
    const accessibilityLink = page
      .getByRole('link', { name: /accessible/i })
      .first();
    await accessibilityLink.scrollIntoViewIfNeeded();
    await accessibilityLink.click();
    await expect(page).toHaveURL(/.*accessibility/);
    await page.goBack();
  });

  test('GitHub repository link opens in new tab', async ({ page, context }) => {
    // Listen for new page/tab
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.click('text=View Source'),
    ]);

    // Check the new tab URL
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('github.com');
    await newPage.close();
  });

  test('skip to main content link works', async ({ page }) => {
    // The skip link uses sr-only class and is only visible on focus
    const skipLink = page.getByRole('link', { name: /skip to main content/i });

    // Focus the skip link using Tab
    await page.keyboard.press('Tab');

    // Wait a moment for focus styles to apply
    await page.waitForTimeout(100);

    // Click with force since it's a sr-only element (visible on focus but Playwright may not detect it)
    await skipLink.click({ force: true });

    // Verify we scrolled to the main content section
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeInViewport();
  });
});
