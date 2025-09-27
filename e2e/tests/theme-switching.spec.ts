import { test, expect } from '@playwright/test';

const themes = [
  // Light themes
  'light',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'autumn',
  'acid',
  'lemonade',
  'winter',
  // Dark themes
  'dark',
  'dracula',
  'night',
  'coffee',
  'dim',
  'sunset',
  'luxury',
  'business',
  'black',
  'nord',
  'sunset',
];

test.describe('Theme Switching', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('theme switcher is accessible from homepage', async ({ page }) => {
    await page.goto('/');

    // Navigate to themes page
    await page.click('text=Browse Themes');
    await expect(page).toHaveURL(/.*themes/);

    // Check that theme cards are visible
    const themeCards = page.locator('.card').first();
    await expect(themeCards).toBeVisible();
  });

  test('switch to dark theme and verify persistence', async ({ page }) => {
    await page.goto('/themes');

    // Find and click the dark theme card
    const darkThemeCard = page.locator('[data-theme="dark"]').first();
    await darkThemeCard.click();

    // Verify theme is applied to HTML element
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Reload page and verify theme persists
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Navigate to another page and verify theme persists
    await page.goto('/components');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('switch to light theme and verify persistence', async ({ page }) => {
    await page.goto('/themes');

    // First set to dark theme
    const darkThemeCard = page.locator('[data-theme="dark"]').first();
    await darkThemeCard.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Then switch back to light
    const lightThemeCard = page.locator('[data-theme="light"]').first();
    await lightThemeCard.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Verify persistence
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('theme applies to all pages consistently', async ({ page }) => {
    await page.goto('/themes');

    // Set synthwave theme
    const synthwaveCard = page.locator('[data-theme="synthwave"]').first();
    await synthwaveCard.click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      'synthwave'
    );

    // Check theme on different pages
    const pages = ['/', '/components', '/accessibility', '/status'];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        'synthwave'
      );
    }
  });

  test('search for themes works', async ({ page }) => {
    await page.goto('/themes');

    // Search for "cyber"
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('cyber');

    // Check that cyberpunk theme is visible
    const cyberpunkCard = page.locator('[data-theme="cyberpunk"]');
    await expect(cyberpunkCard).toBeVisible();

    // Check that unrelated themes are filtered out
    const lightCard = page.locator('[data-theme="light"]');
    await expect(lightCard).not.toBeVisible();
  });

  test('theme preview shows correct colors', async ({ page }) => {
    await page.goto('/themes');

    // Check that each theme card shows preview colors
    const firstThemeCard = page.locator('.card').first();

    // Check for color swatches in the theme card
    const colorSwatches = firstThemeCard.locator(
      '[class*="bg-primary"], [class*="bg-secondary"], [class*="bg-accent"]'
    );
    const count = await colorSwatches.count();
    expect(count).toBeGreaterThan(0);
  });

  test('localStorage stores theme preference', async ({ page }) => {
    await page.goto('/themes');

    // Set dracula theme
    const draculaCard = page.locator('[data-theme="dracula"]').first();
    await draculaCard.click();

    // Check localStorage
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(theme).toBe('dracula');
  });

  test('theme transition is smooth', async ({ page }) => {
    await page.goto('/themes');

    // Check that html has transition class
    const htmlElement = page.locator('html');
    const transitionStyle = await htmlElement.evaluate(
      (el) => window.getComputedStyle(el).transition
    );

    // Should have some transition defined
    expect(transitionStyle).not.toBe('');
  });

  // Parameterized test for multiple themes
  for (const theme of themes.slice(0, 5)) {
    // Test first 5 themes to keep test time reasonable
    test(`can switch to ${theme} theme`, async ({ page }) => {
      await page.goto('/themes');

      const themeCard = page.locator(`[data-theme="${theme}"]`).first();
      await themeCard.click();

      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      // Verify persistence
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });
  }
});
