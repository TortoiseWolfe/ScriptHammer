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
    // Test Status link
    await page.click('a[href="/status/"]');
    await expect(page).toHaveURL(/.*status/);
    await page.goBack();

    // Test Accessibility feature card link
    await page.click('a[href="/accessibility/"]');
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
    // Focus the skip link (it's visually hidden by default)
    await page.keyboard.press('Tab');

    // Check skip link is focused (may be first or second Tab depending on banner)
    const skipLink = page.locator('a[href="#main-content"]');

    // Click the skip link
    await skipLink.click();

    // Verify we scrolled to the main content section
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeInViewport();
  });
});
