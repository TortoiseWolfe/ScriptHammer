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

  // Skip: Progress badge not present on current homepage design
  test.skip('progress badge displays correctly', async () => {
    const progressText = await homePage.getProgressBadgeText();
    expect(progressText).toMatch(/\d+% Complete/);
  });

  // Skip: Game demo section not present on current homepage design
  test.skip('game demo section is present', async () => {
    const isVisible = await homePage.isGameDemoVisible();
    expect(isVisible).toBe(true);

    // Try to play the game (may need to start it first)
    await homePage.playDiceGame(1);

    // Game should be interactive (either started or dice shown)
    // We just verify the game section exists and is interactive
    const gameSection = await homePage.isGameDemoVisible();
    expect(gameSection).toBe(true);
  });

  // Skip: Status/Accessibility footer links not present on current design
  test.skip('navigation links in footer work', async ({ page }) => {
    // Test Status Dashboard link
    await homePage.navigateToStatus();
    await page.goBack();

    // Test Accessibility link
    await homePage.navigateToAccessibility();
    await page.goBack();
  });

  test('GitHub repository link opens in new tab', async () => {
    const newPage = await homePage.openGitHubRepo();
    expect(newPage.url()).toContain('github.com');
    await newPage.close();
  });

  // Skip: Skip link to game demo not present on current design
  test.skip('skip to game demo link works', async () => {
    const skipWorked = await homePage.testSkipLink();
    expect(skipWorked).toBe(true);
  });
});
