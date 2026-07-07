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
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Clear only theme preference, keep consent
    await page.evaluate(() => {
      localStorage.removeItem('theme');
      sessionStorage.removeItem('theme');
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
  });

  test('theme switcher is accessible from homepage', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Navigate to themes page via the 32 Themes stats link
    await page.getByRole('link', { name: '32 Themes' }).first().click();
    await expect(page).toHaveURL(/.*themes/);

    // Check that theme buttons are visible
    await dismissCookieBanner(page);
    const themeHeading = page
      .locator('h2')
      .filter({ hasText: /Theme Selector/i });
    await expect(themeHeading).toBeVisible();

    // Check that theme buttons exist
    const darkButton = page.locator('button[data-theme="dark"]');
    await expect(darkButton).toBeVisible();
  });

  test('switch to dark theme and verify persistence', async ({ page }) => {
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Find and click the dark theme button
    const darkThemeButton = page.locator('button[data-theme="dark"]');
    await darkThemeButton.click();

    // Wait for theme to be applied and saved
    await waitForThemeSaved(page, 'dark');

    // Reload page and verify theme persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Navigate to another page and verify theme persists
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('switch to light theme and verify persistence', async ({ page }) => {
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // First set to dark theme
    const darkThemeButton = page.locator('button[data-theme="dark"]');
    await darkThemeButton.click();
    await waitForThemeSaved(page, 'dark');

    // Then switch back to light
    const lightThemeButton = page.locator('button[data-theme="light"]');
    await lightThemeButton.click();
    await waitForThemeSaved(page, 'light');

    // Verify persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('theme applies to all pages consistently', async ({ page }) => {
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Set synthwave theme
    const synthwaveButton = page.locator('button[data-theme="synthwave"]');
    await synthwaveButton.click();
    await waitForThemeSaved(page, 'synthwave');

    // Check theme on different pages
    const pages = ['/', '/themes', '/accessibility', '/status'];

    for (const pagePath of pages) {
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        'synthwave'
      );
    }
  });

  test('all theme buttons are present', async ({ page }) => {
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Check that all major themes have buttons
    const expectedThemes = [
      'light',
      'dark',
      'cupcake',
      'cyberpunk',
      'dracula',
      'synthwave',
    ];

    for (const theme of expectedThemes) {
      const themeButton = page.locator(`button[data-theme="${theme}"]`);
      await expect(themeButton).toBeVisible();
    }
  });

  test('theme preview shows correct colors', async ({ page }) => {
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Check that the Preview section exists (use exact match to avoid matching "Theme Preview")
    const previewSection = page.getByText('Preview', { exact: true });
    await expect(previewSection).toBeVisible();

    // Check for color labels in the preview section
    const primaryLabel = page.getByText('Primary', { exact: true }).first();
    const secondaryLabel = page.getByText('Secondary', { exact: true }).first();
    const accentLabel = page.getByText('Accent', { exact: true }).first();

    await expect(primaryLabel).toBeVisible();
    await expect(secondaryLabel).toBeVisible();
    await expect(accentLabel).toBeVisible();
  });

  test('localStorage stores theme preference', async ({ page }) => {
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Set dracula theme
    const draculaButton = page.locator('button[data-theme="dracula"]');
    await draculaButton.click();
    await waitForThemeSaved(page, 'dracula');

    // Check localStorage
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(theme).toBe('dracula');
  });

  test('theme transition is smooth', async ({ page }) => {
    await page.goto('/themes', { waitUntil: 'domcontentloaded' });
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
      await page.goto('/themes', { waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);

      const themeButton = page.locator(`button[data-theme="${theme}"]`);
      await themeButton.click();
      await waitForThemeSaved(page, theme);

      // Verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      await dismissCookieBanner(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });
  }
});
