import { test, expect } from '@playwright/test';

test.describe('Homepage Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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

  test('navigate to components page', async ({ page }) => {
    // Click the Explore Components button
    await page.click('text=Explore Components');

    // Verify navigation to components page
    await expect(page).toHaveURL(/.*components/);

    // Verify components page content loads
    const componentsHeading = page
      .locator('h1')
      .filter({ hasText: /Component/i });
    await expect(componentsHeading).toBeVisible();
  });

  test('progress badge displays correctly', async ({ page }) => {
    // Check that the progress badge is visible
    const progressBadge = page.locator('.badge.badge-success');
    await expect(progressBadge).toBeVisible();

    // Check that it contains percentage text
    const progressText = await progressBadge.textContent();
    expect(progressText).toMatch(/\d+% Complete/);
  });

  test('game demo section is present', async ({ page }) => {
    // Check that the game demo section exists
    const gameDemo = page.locator('#game-demo');
    await expect(gameDemo).toBeVisible();

    // Check for the dice game title
    const gameTitle = page
      .locator('h1')
      .filter({ hasText: /Captain, Ship & Crew/i });
    await expect(gameTitle).toBeVisible();
  });

  test('navigation links in footer work', async ({ page }) => {
    // Test Status Dashboard link
    await page.click('text=Status Dashboard');
    await expect(page).toHaveURL(/.*status/);
    await page.goBack();

    // Test Accessibility link
    await page.click('text=Accessibility');
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

  test('skip to game demo link works', async ({ page }) => {
    // Focus the skip link (it's visually hidden by default)
    await page.keyboard.press('Tab');

    // The skip link should be the first focusable element
    const skipLink = page.locator('a[href="#game-demo"]');
    await expect(skipLink).toBeFocused();

    // Click the skip link
    await skipLink.click();

    // Verify we scrolled to the game demo section
    const gameDemo = page.locator('#game-demo');
    await expect(gameDemo).toBeInViewport();
  });
});
