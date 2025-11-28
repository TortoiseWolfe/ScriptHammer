import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the Homepage
 */
export class HomePage extends BasePage {
  // Selectors
  readonly selectors = {
    // Header elements
    logo: 'a[href="/"]',
    skipLink: 'a[href="#game-demo"], a[href="#main"]',

    // Hero section
    heroTitle: 'h1',
    heroDescription: 'text=/Next.js.*template/i',
    progressBadge: '.badge.badge-success',

    // Navigation buttons
    browseThemesButton: 'text=Browse Themes',
    exploreComponentsButton: 'text=Explore Components',
    viewSourceButton: 'text=View Source',

    // Game demo section
    gameDemoSection: '#game-demo',
    gameTitle: 'h1:has-text("Captain, Ship & Crew")',
    startGameButton: 'button:has-text("Start Game")',
    rollButton: 'button:has-text("Roll")',
    diceContainer: '.dice-container',

    // Footer navigation
    statusDashboardLink: 'text=Status Dashboard',
    accessibilityLink: 'text=Accessibility',
    githubLink: 'a[href*="github.com"]',

    // Feature cards
    featureCard: '.card',
    featureTitle: '.card-title',
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to the homepage
   */
  async goto() {
    await this.navigate('/');
  }

  /**
   * Get the hero title text
   */
  async getHeroTitle(): Promise<string> {
    return await this.getText(this.selectors.heroTitle);
  }

  /**
   * Get the progress badge text
   */
  async getProgressBadgeText(): Promise<string> {
    return await this.getText(this.selectors.progressBadge);
  }

  /**
   * Navigate to the themes page
   */
  async navigateToThemes() {
    await this.clickWithRetry(this.selectors.browseThemesButton);
    await this.expectURL(/.*themes/);
  }

  /**
   * Navigate to the components page
   */
  async navigateToComponents() {
    await this.clickWithRetry(this.selectors.exploreComponentsButton);
    await this.expectURL(/.*components/);
  }

  /**
   * Navigate to the status dashboard
   */
  async navigateToStatus() {
    await this.clickWithRetry(this.selectors.statusDashboardLink);
    await this.expectURL(/.*status/);
  }

  /**
   * Navigate to the accessibility page
   */
  async navigateToAccessibility() {
    await this.clickWithRetry(this.selectors.accessibilityLink);
    await this.expectURL(/.*accessibility/);
  }

  /**
   * Check if the game demo section is visible
   */
  async isGameDemoVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.gameDemoSection);
  }

  /**
   * Play the dice game
   * @param rolls - Number of times to roll the dice
   */
  async playDiceGame(rolls: number = 1) {
    // Scroll to game section
    const gameSection = this.page.locator(this.selectors.gameDemoSection);
    await gameSection.scrollIntoViewIfNeeded();

    // Check if we need to start the game first
    const startButton = this.page.locator(this.selectors.startGameButton);
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await this.page.waitForTimeout(500); // Wait for game to initialize
    }

    // Now roll the dice
    const rollButton = this.page.locator(this.selectors.rollButton);
    for (let i = 0; i < rolls; i++) {
      // Wait for roll button to be available
      await rollButton
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => {});
      if (await rollButton.isVisible()) {
        await rollButton.click();
        await this.page.waitForTimeout(1000); // Wait for dice animation
      }
    }
  }

  /**
   * Get all feature card titles
   */
  async getFeatureCardTitles(): Promise<string[]> {
    return await this.getAllText(this.selectors.featureTitle);
  }

  /**
   * Check if skip link is functional
   */
  async testSkipLink() {
    // Focus the skip link
    await this.page.keyboard.press('Tab');

    const skipLink = this.page.locator(this.selectors.skipLink).first();
    await skipLink.focus();

    // Force click the skip link to avoid interception
    await skipLink.click({ force: true });

    // Wait a moment for navigation
    await this.page.waitForTimeout(500);

    // Verify navigation to game demo
    const gameDemo = this.page.locator(this.selectors.gameDemoSection);
    return await gameDemo.isVisible();
  }

  /**
   * Open GitHub repository in new tab
   * @returns The new page object for the GitHub tab
   */
  async openGitHubRepo() {
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.clickWithRetry(this.selectors.viewSourceButton),
    ]);

    await newPage.waitForLoadState();
    return newPage;
  }

  /**
   * Get the count of dice currently displayed
   */
  async getDiceCount(): Promise<number> {
    // Try multiple possible selectors for dice
    const diceSelectors = [
      `${this.selectors.diceContainer} .die`,
      '.die',
      '[data-testid*="die"]',
      '.dice',
      'svg[class*="die"]',
    ];

    for (const selector of diceSelectors) {
      const dice = this.page.locator(selector);
      const count = await dice.count();
      if (count > 0) return count;
    }

    return 0;
  }

  /**
   * Check if the homepage hero section is visible
   */
  async isHeroSectionVisible(): Promise<boolean> {
    const title = await this.isVisible(this.selectors.heroTitle);
    const description = await this.isVisible(this.selectors.heroDescription);
    const badge = await this.isVisible(this.selectors.progressBadge);

    return title && description && badge;
  }

  /**
   * Get all navigation link texts from the footer
   */
  async getFooterNavigationLinks(): Promise<string[]> {
    return await this.getAllText('footer a');
  }

  /**
   * Verify the homepage loads correctly
   */
  async verifyPageLoad() {
    // Check title
    await this.page.waitForSelector(this.selectors.heroTitle);

    // Check critical elements
    const heroVisible = await this.isHeroSectionVisible();
    if (!heroVisible) {
      throw new Error('Homepage hero section not fully visible');
    }

    // Check navigation buttons
    const themesButton = await this.isVisible(
      this.selectors.browseThemesButton
    );
    const componentsButton = await this.isVisible(
      this.selectors.exploreComponentsButton
    );

    if (!themesButton || !componentsButton) {
      throw new Error('Navigation buttons not visible');
    }
  }

  /**
   * Get the current game score if displayed
   */
  async getGameScore(): Promise<string | null> {
    const scoreElement = this.page
      .locator('.score, [data-testid="score"]')
      .first();
    const isVisible = await scoreElement.isVisible().catch(() => false);

    if (isVisible) {
      return await scoreElement.textContent();
    }

    return null;
  }
}
