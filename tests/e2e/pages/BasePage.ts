import { Page, expect } from '@playwright/test';

/**
 * Base Page Object Model class
 * Contains common functionality shared across all pages
 */
export class BasePage {
  readonly page: Page;
  readonly baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = process.env.BASE_URL || 'http://localhost:3000/ScriptHammer';
  }

  /**
   * Navigate to a specific path
   * @param path - The path to navigate to (e.g., '/themes', '/components')
   */
  async navigate(path: string = '') {
    const url = path.startsWith('http') ? path : `${this.baseURL}${path}`;
    await this.page.goto(url);
    await this.waitForLoad();
  }

  /**
   * Wait for the page to be fully loaded
   * Waits for network idle and ensures no loading spinners
   */
  async waitForLoad() {
    // Wait for the network to be idle
    await this.page.waitForLoadState('networkidle');

    // Wait for any loading indicators to disappear
    const loadingIndicators = this.page.locator(
      '.loading, .spinner, [aria-busy="true"]'
    );
    const count = await loadingIndicators.count();

    if (count > 0) {
      // Wait for all loading indicators to be hidden
      await expect(loadingIndicators.first()).toBeHidden({ timeout: 10000 });
    }

    // Ensure the page is interactive
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Get the current theme from the HTML element
   * @returns The current theme name
   */
  async getTheme(): Promise<string | null> {
    return await this.page.locator('html').getAttribute('data-theme');
  }

  /**
   * Set a theme by clicking on the theme card
   * @param themeName - The name of the theme to set
   */
  async setTheme(themeName: string) {
    // Navigate to themes page if not already there
    const url = this.page.url();
    if (!url.includes('/themes')) {
      await this.navigate('/themes');
    }

    // Click the theme card
    const themeCard = this.page.locator(`[data-theme="${themeName}"]`).first();
    await themeCard.click();

    // Wait for theme to be applied
    await expect(this.page.locator('html')).toHaveAttribute(
      'data-theme',
      themeName
    );
  }

  /**
   * Take a screenshot with a descriptive name
   * @param name - The name for the screenshot
   */
  async screenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Check if an element is visible
   * @param selector - The selector for the element
   * @returns True if the element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).first().waitFor({
        state: 'visible',
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Click an element with retry logic
   * @param selector - The selector for the element to click
   * @param options - Click options
   */
  async clickWithRetry(selector: string, options = {}) {
    const element = this.page.locator(selector).first();

    // Scroll into view if needed
    await element.scrollIntoViewIfNeeded();

    // Try to click with retry
    let retries = 3;
    while (retries > 0) {
      try {
        await element.click({ ...options, timeout: 5000 });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Fill a form field with retry logic
   * @param selector - The selector for the input field
   * @param value - The value to fill
   */
  async fillWithRetry(selector: string, value: string) {
    const element = this.page.locator(selector).first();

    // Clear existing value first
    await element.clear();

    // Fill with retry
    let retries = 3;
    while (retries > 0) {
      try {
        await element.fill(value);

        // Verify the value was set
        const actualValue = await element.inputValue();
        if (actualValue === value) break;

        retries--;
        if (retries === 0) {
          throw new Error(`Failed to fill ${selector} with ${value}`);
        }
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await this.page.waitForTimeout(500);
      }
    }
  }

  /**
   * Get text content from an element
   * @param selector - The selector for the element
   * @returns The text content
   */
  async getText(selector: string): Promise<string> {
    const element = this.page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout: 5000 });
    return (await element.textContent()) || '';
  }

  /**
   * Check if the page has a specific URL pattern
   * @param pattern - The URL pattern to match (can be string or regex)
   */
  async expectURL(pattern: string | RegExp) {
    await expect(this.page).toHaveURL(pattern);
  }

  /**
   * Wait for navigation to complete
   * @param action - The action that triggers navigation
   */
  async waitForNavigation(action: () => Promise<void>) {
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle' }),
      action(),
    ]);
  }

  /**
   * Get all text content from elements matching a selector
   * @param selector - The selector for the elements
   * @returns Array of text content
   */
  async getAllText(selector: string): Promise<string[]> {
    const elements = this.page.locator(selector);
    const count = await elements.count();
    const texts: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await elements.nth(i).textContent();
      if (text) texts.push(text.trim());
    }

    return texts;
  }

  /**
   * Check if the page is in mobile viewport
   * @returns True if viewport width is less than 768px
   */
  async isMobile(): Promise<boolean> {
    const viewport = this.page.viewportSize();
    return viewport ? viewport.width < 768 : false;
  }

  /**
   * Set viewport size for responsive testing
   * @param device - Preset device or custom dimensions
   */
  async setViewport(
    device: 'mobile' | 'tablet' | 'desktop' | { width: number; height: number }
  ) {
    const presets = {
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1920, height: 1080 },
    };

    const size = typeof device === 'string' ? presets[device] : device;
    await this.page.setViewportSize(size);
  }

  /**
   * Handle cookie consent if present
   */
  async handleCookieConsent() {
    const consentButton = this.page
      .locator('button:has-text("Accept"), button:has-text("OK")')
      .first();
    const isVisible = await consentButton.isVisible().catch(() => false);

    if (isVisible) {
      await consentButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Close any modals or popups that might be open
   */
  async closeModals() {
    const closeButtons = this.page.locator(
      '[aria-label="Close"], button:has-text("Close"), button:has-text("×")'
    );
    const count = await closeButtons.count();

    for (let i = 0; i < count; i++) {
      const button = closeButtons.nth(i);
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        await button.click();
        await this.page.waitForTimeout(300);
      }
    }
  }

  /**
   * Verify accessibility of the current page
   * @param options - Accessibility check options (currently unused but reserved for future use)
   */
  async checkAccessibility(options = {}) {
    // Options parameter reserved for future axe-playwright integration
    void options; // Mark as intentionally unused
    // This would integrate with axe-playwright if needed
    // For now, we'll do basic checks

    // Check for page title
    const title = await this.page.title();
    expect(title).toBeTruthy();

    // Check for main landmark
    const main = this.page.locator('main, [role="main"]');
    await expect(main).toHaveCount(1);

    // Check for skip link
    const skipLink = this.page.locator('a[href^="#"]').first();
    await expect(skipLink).toBeAttached();
  }
}
