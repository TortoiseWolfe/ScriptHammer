import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * Example of refactoring tests to use Page Object Model
 * This shows how the original homepage.spec.ts should be updated
 */
test.describe('Homepage Navigation (with Page Objects)', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
    // Dismiss cookie banner to prevent it from intercepting clicks
    await dismissCookieBanner(page);
  });

  test('homepage loads with correct title', async ({ page }) => {
    // Verify page loaded
    await homePage.verifyPageLoad();

    // Check the page title
    await expect(page).toHaveTitle(/ScriptHammer/);

    // Check the hero title
    const heroTitle = await homePage.getHeroTitle();
    expect(heroTitle).toContain('ScriptHammer');
  });

  test('navigate to themes page', async () => {
    await homePage.navigateToThemes();
    // Navigation and URL check is handled in the page object
  });

  test('navigate to storybook', async () => {
    const storybookPage = await homePage.navigateToStorybook();
    // Storybook opens in a new tab
    expect(storybookPage.url()).toContain('storybook');
    await storybookPage.close();
  });

  test('navigate to blog page', async () => {
    await homePage.navigateToBlog();
    // Navigation and URL check is handled in the page object
  });

  test('GitHub repository link opens in new tab', async () => {
    const newPage = await homePage.openGitHubRepo();
    expect(newPage.url()).toContain('github.com');
    await newPage.close();
  });
});
