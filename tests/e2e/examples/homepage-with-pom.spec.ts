import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';

/**
 * Example of refactoring tests to use Page Object Model
 * This shows how the original homepage.spec.ts should be updated
 */
test.describe('Homepage Navigation (with Page Objects)', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
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

  test('navigate to components page', async () => {
    await homePage.navigateToComponents();
    // Navigation and URL check is handled in the page object
  });

  test('progress badge displays correctly', async () => {
    const progressText = await homePage.getProgressBadgeText();
    expect(progressText).toMatch(/\d+% Complete/);
  });

  test('game demo section is present', async () => {
    const isVisible = await homePage.isGameDemoVisible();
    expect(isVisible).toBe(true);

    // Try to play the game (may need to start it first)
    await homePage.playDiceGame(1);

    // Game should be interactive (either started or dice shown)
    // We just verify the game section exists and is interactive
    const gameSection = await homePage.isGameDemoVisible();
    expect(gameSection).toBe(true);
  });

  test('navigation links in footer work', async ({ page }) => {
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

  test('skip to game demo link works', async () => {
    const skipWorked = await homePage.testSkipLink();
    expect(skipWorked).toBe(true);
  });
});
