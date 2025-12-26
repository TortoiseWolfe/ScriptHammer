import { test, expect, type Page } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * Wait for theme to be applied and saved to localStorage.
 * ThemeSwitcher saves synchronously but we need to wait for DOM update.
 */
async function waitForThemeSaved(page: Page, theme: string): Promise<void> {
  // Wait for data-theme attribute to be set on html element
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme, {
    timeout: 5000,
  });

  // Verify theme is saved to localStorage
  await page.waitForFunction(
    (expectedTheme) => localStorage.getItem('theme') === expectedTheme,
    theme,
    { timeout: 3000 }
  );
}

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
    // Clear localStorage to ensure clean state, but preserve consent
    await page.goto('/');
    await dismissCookieBanner(page);

    // Clear only theme preference, keep consent
    await page.evaluate(() => {
      localStorage.removeItem('theme');
      sessionStorage.removeItem('theme');
    });

    await page.reload();
    await dismissCookieBanner(page);
  });

  test('theme switcher is accessible from homepage', async ({ page }) => {
    await page.goto('/');
    await dismissCookieBanner(page);

    // Navigate to themes page
    await page.click('text=Browse Themes');
    await expect(page).toHaveURL(/.*themes/);

    // Check that theme cards are visible
    await dismissCookieBanner(page);
    const themeCards = page.locator('.card').first();
    await expect(themeCards).toBeVisible();
  });

  test('switch to dark theme and verify persistence', async ({ page }) => {
    await page.goto('/themes');
    await dismissCookieBanner(page);

    // Find and click the dark theme button
    const darkThemeButton = page.getByRole('button', { name: 'dark' });
    await darkThemeButton.click();

    // Wait for theme to be applied and saved
    await waitForThemeSaved(page, 'dark');

    // Reload page and verify theme persists
    await page.reload();
    await dismissCookieBanner(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Navigate to another page and verify theme persists
    await page.goto('/themes');
    await dismissCookieBanner(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('switch to light theme and verify persistence', async ({ page }) => {
    await page.goto('/themes');
    await dismissCookieBanner(page);

    // First set to dark theme
    const darkThemeButton = page.getByRole('button', { name: 'dark' });
    await darkThemeButton.click();
    await waitForThemeSaved(page, 'dark');

    // Then switch back to light
    const lightThemeButton = page.getByRole('button', { name: 'light' });
    await lightThemeButton.click();
    await waitForThemeSaved(page, 'light');

    // Verify persistence
    await page.reload();
    await dismissCookieBanner(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('theme applies to all pages consistently', async ({ page }) => {
    await page.goto('/themes');
    await dismissCookieBanner(page);

    // Set synthwave theme
    const synthwaveButton = page.getByRole('button', { name: 'synthwave' });
    await synthwaveButton.click();
    await waitForThemeSaved(page, 'synthwave');

    // Check theme on different pages
    const pages = ['/', '/themes', '/accessibility', '/status'];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await dismissCookieBanner(page);
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        'synthwave'
      );
    }
  });

  test('search for themes works', async ({ page }) => {
    await page.goto('/themes');
    await dismissCookieBanner(page);

    // Search for "cyber"
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('cyber');

    // Check that cyberpunk theme button is visible
    const cyberpunkButton = page.getByRole('button', { name: 'cyberpunk' });
    await expect(cyberpunkButton).toBeVisible();

    // Check that unrelated themes are filtered out
    const lightButton = page.getByRole('button', {
      name: 'light',
      exact: true,
    });
    await expect(lightButton).not.toBeVisible();
  });

  test('theme preview shows correct colors', async ({ page }) => {
    await page.goto('/themes');
    await dismissCookieBanner(page);

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
    await dismissCookieBanner(page);

    // Set dracula theme
    const draculaButton = page.getByRole('button', { name: 'dracula' });
    await draculaButton.click();
    await waitForThemeSaved(page, 'dracula');

    // Check localStorage
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(theme).toBe('dracula');
  });

  test('theme transition is smooth', async ({ page }) => {
    await page.goto('/themes');
    await dismissCookieBanner(page);

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
      await dismissCookieBanner(page);

      const themeButton = page.getByRole('button', {
        name: theme,
        exact: true,
      });
      await themeButton.click();
      await waitForThemeSaved(page, theme);

      // Verify persistence
      await page.reload();
      await dismissCookieBanner(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });
  }
});
