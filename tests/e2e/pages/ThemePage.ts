import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the Themes page
 */
export class ThemePage extends BasePage {
  // Selectors
  readonly selectors = {
    // Page elements
    pageTitle: 'h1:has-text("Theme")',
    searchInput: 'input[placeholder*="Search"]',
    themeCard: '.card[data-theme]',
    activeThemeIndicator: '.badge:has-text("Active")',

    // Theme card elements
    themeCardTitle: '.card-title',
    themeCardBody: '.card-body',
    colorSwatch:
      '[class*="bg-primary"], [class*="bg-secondary"], [class*="bg-accent"]',

    // Categories
    lightThemesSection: 'text=/Light Themes/i',
    darkThemesSection: 'text=/Dark Themes/i',

    // Theme preview
    previewContainer: '.theme-preview',
    applyButton: 'button:has-text("Apply")',
    resetButton: 'button:has-text("Reset")',
  };

  // Available themes
  readonly themes = {
    light: [
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
    ],
    dark: [
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
    ],
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to the themes page
   */
  async goto() {
    await this.navigate('/themes');
  }

  /**
   * Select a theme by name
   * @param themeName - The name of the theme to select
   */
  async selectTheme(themeName: string) {
    const themeCard = this.page.locator(`[data-theme="${themeName}"]`).first();

    // Scroll to the theme card
    await themeCard.scrollIntoViewIfNeeded();

    // Click the theme card
    await themeCard.click();

    // Wait for theme to be applied
    await expect(this.page.locator('html')).toHaveAttribute(
      'data-theme',
      themeName
    );
  }

  /**
   * Search for themes
   * @param searchTerm - The search term to filter themes
   */
  async searchThemes(searchTerm: string) {
    const searchInput = this.page.locator(this.selectors.searchInput);
    await searchInput.fill(searchTerm);

    // Wait for filtering to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Get all visible theme names
   */
  async getVisibleThemes(): Promise<string[]> {
    const themeCards = this.page.locator(this.selectors.themeCard);
    const count = await themeCards.count();
    const themes: string[] = [];

    for (let i = 0; i < count; i++) {
      const card = themeCards.nth(i);
      const isVisible = await card.isVisible();

      if (isVisible) {
        const theme = await card.getAttribute('data-theme');
        if (theme) themes.push(theme);
      }
    }

    return themes;
  }

  /**
   * Get the currently active theme
   */
  async getActiveTheme(): Promise<string | null> {
    const html = this.page.locator('html');
    return await html.getAttribute('data-theme');
  }

  /**
   * Verify a theme is applied correctly
   * @param themeName - The theme to verify
   */
  async verifyThemeApplied(themeName: string) {
    // Check HTML attribute
    await expect(this.page.locator('html')).toHaveAttribute(
      'data-theme',
      themeName
    );

    // Check localStorage
    const storedTheme = await this.page.evaluate(() =>
      localStorage.getItem('theme')
    );
    expect(storedTheme).toBe(themeName);
  }

  /**
   * Switch between light and dark mode themes
   * @param mode - 'light' or 'dark'
   */
  async switchToMode(mode: 'light' | 'dark') {
    const themes = mode === 'light' ? this.themes.light : this.themes.dark;
    const firstTheme = themes[0];

    await this.selectTheme(firstTheme);
  }

  /**
   * Get color swatches for a specific theme
   * @param themeName - The theme to get colors for
   */
  async getThemeColors(themeName: string): Promise<string[]> {
    const themeCard = this.page.locator(`[data-theme="${themeName}"]`).first();
    const swatches = themeCard.locator(this.selectors.colorSwatch);
    const count = await swatches.count();
    const colors: string[] = [];

    for (let i = 0; i < count; i++) {
      const swatch = swatches.nth(i);
      const className = await swatch.getAttribute('class');
      if (className) {
        // Extract color class (e.g., bg-primary, bg-secondary)
        const colorMatch = className.match(
          /bg-(primary|secondary|accent|base-\d+)/
        );
        if (colorMatch) {
          colors.push(colorMatch[1]);
        }
      }
    }

    return colors;
  }

  /**
   * Test theme persistence across page reloads
   * @param themeName - The theme to test
   */
  async testThemePersistence(themeName: string) {
    // Select theme
    await this.selectTheme(themeName);

    // Reload page
    await this.page.reload();
    await this.waitForLoad();

    // Verify theme is still applied
    await this.verifyThemeApplied(themeName);
  }

  /**
   * Test theme application across different pages
   * @param themeName - The theme to test
   */
  async testThemeAcrossPages(themeName: string) {
    // Select theme
    await this.selectTheme(themeName);

    // Navigate to different pages and verify theme
    const pages = ['/', '/components', '/accessibility', '/status'];

    for (const path of pages) {
      await this.navigate(path);
      const currentTheme = await this.getActiveTheme();
      expect(currentTheme).toBe(themeName);
    }
  }

  /**
   * Clear theme search
   */
  async clearSearch() {
    const searchInput = this.page.locator(this.selectors.searchInput);
    await searchInput.clear();
  }

  /**
   * Get the count of theme cards
   */
  async getThemeCount(): Promise<number> {
    const themeCards = this.page.locator(this.selectors.themeCard);
    return await themeCards.count();
  }

  /**
   * Check if a specific theme is visible
   * @param themeName - The theme to check
   */
  async isThemeVisible(themeName: string): Promise<boolean> {
    const themeCard = this.page.locator(`[data-theme="${themeName}"]`).first();
    return await themeCard.isVisible();
  }

  /**
   * Get theme card details
   * @param themeName - The theme to get details for
   */
  async getThemeCardDetails(themeName: string) {
    const themeCard = this.page.locator(`[data-theme="${themeName}"]`).first();

    const title = await themeCard
      .locator(this.selectors.themeCardTitle)
      .textContent();
    const hasColorSwatches =
      (await themeCard.locator(this.selectors.colorSwatch).count()) > 0;

    return {
      title,
      hasColorSwatches,
      isVisible: await themeCard.isVisible(),
    };
  }

  /**
   * Reset to default theme
   */
  async resetToDefaultTheme() {
    // Clear localStorage
    await this.page.evaluate(() => localStorage.removeItem('theme'));

    // Reload page
    await this.page.reload();
    await this.waitForLoad();
  }

  /**
   * Test theme transition smoothness
   */
  async testThemeTransition() {
    const html = this.page.locator('html');

    // Get transition style
    const transition = await html.evaluate((el) => {
      return window.getComputedStyle(el).transition;
    });

    // Transition should be defined for smooth switching
    expect(transition).not.toBe('');
    expect(transition).not.toBe('none');
  }

  /**
   * Verify the themes page loads correctly
   */
  async verifyPageLoad() {
    // Check title
    const titleVisible = await this.isVisible(this.selectors.pageTitle);
    if (!titleVisible) {
      throw new Error('Themes page title not visible');
    }

    // Check search input
    const searchVisible = await this.isVisible(this.selectors.searchInput);
    if (!searchVisible) {
      throw new Error('Theme search input not visible');
    }

    // Check theme cards are present
    const themeCount = await this.getThemeCount();
    if (themeCount === 0) {
      throw new Error('No theme cards visible');
    }
  }
}
