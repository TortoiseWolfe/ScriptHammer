import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the Components page
 */
export class ComponentsPage extends BasePage {
  // Selectors
  readonly selectors = {
    // Page elements
    pageTitle: 'h1:has-text("Component")',
    searchInput: 'input[placeholder*="Search"]',
    categoryFilter: 'select, [role="combobox"]',

    // Component sections
    componentCard: '.card',
    componentTitle: '.card-title',
    componentDescription: '.card-body p',
    componentDemo: '.component-demo',
    codeSnippet: 'pre, code',

    // Interactive components
    button: 'button',
    input: 'input[type="text"], input[type="email"]',
    checkbox: 'input[type="checkbox"]',
    radio: 'input[type="radio"]',
    select: 'select',
    textarea: 'textarea',
    toggle: '.toggle, input[type="checkbox"].toggle',
    slider: 'input[type="range"]',
    modal: '.modal, [role="dialog"]',
    modalTrigger: 'button:has-text("Open Modal")',
    modalClose: '.modal button:has-text("Close"), .modal button:has-text("×")',

    // Form elements
    formControl: '.form-control',
    formLabel: 'label',
    formError: '.text-error, [role="alert"]',
    formHelp: '.label-text-alt, [id$="-help"]',
    submitButton: 'button[type="submit"]',
    resetButton: 'button[type="reset"]',

    // Navigation
    tabs: '.tabs, [role="tablist"]',
    tab: '.tab, [role="tab"]',
    tabPanel: '.tab-content, [role="tabpanel"]',
    breadcrumbs: '.breadcrumbs, [aria-label="breadcrumb"]',
    pagination: '.pagination, [role="navigation"][aria-label*="pagination"]',

    // Feedback components
    alert: '.alert, [role="alert"]',
    badge: '.badge',
    progress: '.progress, [role="progressbar"]',
    spinner: '.loading, .spinner',
    tooltip: '.tooltip, [role="tooltip"]',

    // Layout components
    card: '.card',
    accordion: '.collapse, details',
    accordionTrigger: '.collapse-title, summary',
    accordionContent: '.collapse-content',
    drawer: '.drawer',
    drawerToggle: '.drawer-toggle',
    drawerContent: '.drawer-content',
    drawerSide: '.drawer-side',
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to the components page
   */
  async goto() {
    await this.navigate('/components');
  }

  /**
   * Search for components
   * @param searchTerm - The search term to filter components
   */
  async searchComponents(searchTerm: string) {
    const searchInput = this.page.locator(this.selectors.searchInput).first();
    await searchInput.fill(searchTerm);
    await this.page.waitForTimeout(500);
  }

  /**
   * Get all visible component names
   */
  async getVisibleComponents(): Promise<string[]> {
    return await this.getAllText(this.selectors.componentTitle);
  }

  /**
   * Test a button component
   * @param buttonText - The text of the button to test
   */
  async testButton(buttonText: string) {
    const button = this.page
      .locator(`button:has-text("${buttonText}")`)
      .first();
    await button.scrollIntoViewIfNeeded();

    // Check if button is enabled
    const isEnabled = await button.isEnabled();
    expect(isEnabled).toBe(true);

    // Click the button
    await button.click();

    // Check for any feedback (could be modal, alert, etc.)
    await this.page.waitForTimeout(500);
  }

  /**
   * Test form input validation
   * @param inputSelector - The selector for the input
   * @param validValue - A valid value to test
   * @param invalidValue - An invalid value to test
   */
  async testInputValidation(
    inputSelector: string,
    validValue: string,
    invalidValue: string
  ) {
    const input = this.page.locator(inputSelector).first();

    // Test invalid value
    await input.fill(invalidValue);
    await input.blur();

    // Check for error message
    const errorMessage = this.page.locator(this.selectors.formError).first();
    const hasError = await errorMessage.isVisible();

    // Test valid value
    await input.fill(validValue);
    await input.blur();

    // Error should disappear
    if (hasError) {
      await expect(errorMessage).toBeHidden();
    }

    return { hasValidation: hasError };
  }

  /**
   * Open a modal dialog
   */
  async openModal() {
    const trigger = this.page.locator(this.selectors.modalTrigger).first();
    await trigger.click();

    // Wait for modal to appear
    const modal = this.page.locator(this.selectors.modal).first();
    await expect(modal).toBeVisible();
  }

  /**
   * Close the currently open modal
   */
  async closeModal() {
    const closeButton = this.page.locator(this.selectors.modalClose).first();
    await closeButton.click();

    // Wait for modal to disappear
    const modal = this.page.locator(this.selectors.modal).first();
    await expect(modal).toBeHidden();
  }

  /**
   * Test tab navigation
   */
  async testTabs() {
    const tabs = this.page.locator(this.selectors.tab);
    const count = await tabs.count();

    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      await tab.click();

      // Check if tab is active
      const isActive = await tab.evaluate(
        (el) =>
          el.classList.contains('tab-active') ||
          el.getAttribute('aria-selected') === 'true'
      );

      expect(isActive).toBe(true);

      // Wait for content to switch
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Test accordion/collapse component
   */
  async testAccordion() {
    const triggers = this.page.locator(this.selectors.accordionTrigger);
    const count = await triggers.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const trigger = triggers.nth(i);
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();

      // Wait for animation
      await this.page.waitForTimeout(300);

      // Check if content is visible
      const content = this.page.locator(this.selectors.accordionContent).nth(i);
      const isVisible = await content.isVisible();
      expect(isVisible).toBe(true);
    }
  }

  /**
   * Test toggle/switch component
   */
  async testToggle() {
    const toggle = this.page.locator(this.selectors.toggle).first();
    const initialState = await toggle.isChecked();

    // Toggle the switch
    await toggle.click();

    // Verify state changed
    const newState = await toggle.isChecked();
    expect(newState).toBe(!initialState);
  }

  /**
   * Test slider/range input
   * @param value - The value to set
   */
  async testSlider(value: number) {
    const slider = this.page.locator(this.selectors.slider).first();

    // Set value
    await slider.fill(value.toString());

    // Verify value was set
    const actualValue = await slider.inputValue();
    expect(actualValue).toBe(value.toString());
  }

  /**
   * Fill and submit a form
   * @param formData - The data to fill in the form
   */
  async fillAndSubmitForm(formData: Record<string, string>) {
    // Fill text inputs
    for (const [name, value] of Object.entries(formData)) {
      const input = this.page
        .locator(`input[name="${name}"], textarea[name="${name}"]`)
        .first();
      if ((await input.count()) > 0) {
        await input.fill(value);
      }
    }

    // Submit the form
    const submitButton = this.page.locator(this.selectors.submitButton).first();
    await submitButton.click();

    // Wait for submission
    await this.page.waitForTimeout(1000);
  }

  /**
   * Test form field interactions
   */
  async testFormFields() {
    const fields = {
      text: this.page.locator('input[type="text"]').first(),
      email: this.page.locator('input[type="email"]').first(),
      checkbox: this.page.locator('input[type="checkbox"]').first(),
      radio: this.page.locator('input[type="radio"]').first(),
      select: this.page.locator('select').first(),
      textarea: this.page.locator('textarea').first(),
    };

    const results: Record<string, boolean> = {};

    for (const [type, field] of Object.entries(fields)) {
      results[type] = (await field.count()) > 0;

      if (results[type]) {
        // Test basic interaction
        if (type === 'checkbox' || type === 'radio') {
          await field.click();
        } else if (type === 'select') {
          const options = await field.locator('option').count();
          if (options > 1) {
            await field.selectOption({ index: 1 });
          }
        } else {
          await field.fill('Test value');
        }
      }
    }

    return results;
  }

  /**
   * Get alert messages
   */
  async getAlertMessages(): Promise<string[]> {
    return await this.getAllText(this.selectors.alert);
  }

  /**
   * Test pagination
   */
  async testPagination() {
    const pagination = this.page.locator(this.selectors.pagination).first();
    if ((await pagination.count()) === 0) return;

    // Click next page
    const nextButton = pagination
      .locator('button:has-text("Next"), a:has-text("Next")')
      .first();
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await this.page.waitForTimeout(500);
    }

    // Click previous page
    const prevButton = pagination
      .locator('button:has-text("Previous"), a:has-text("Previous")')
      .first();
    if (await prevButton.isEnabled()) {
      await prevButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Test drawer component
   */
  async testDrawer() {
    const drawerToggle = this.page.locator(this.selectors.drawerToggle).first();
    if ((await drawerToggle.count()) === 0) return;

    // Open drawer
    await drawerToggle.click();

    // Check drawer content is visible
    const drawerSide = this.page.locator(this.selectors.drawerSide).first();
    await expect(drawerSide).toBeVisible();

    // Close drawer
    await drawerToggle.click();
    await expect(drawerSide).toBeHidden();
  }

  /**
   * Get badge texts
   */
  async getBadgeTexts(): Promise<string[]> {
    return await this.getAllText(this.selectors.badge);
  }

  /**
   * Test progress bar
   */
  async getProgressValue(): Promise<string | null> {
    const progress = this.page.locator(this.selectors.progress).first();
    if ((await progress.count()) === 0) return null;

    return (
      (await progress.getAttribute('value')) ||
      (await progress.getAttribute('aria-valuenow'))
    );
  }

  /**
   * Verify the components page loads correctly
   */
  async verifyPageLoad() {
    // Check title
    const titleVisible = await this.isVisible(this.selectors.pageTitle);
    if (!titleVisible) {
      throw new Error('Components page title not visible');
    }

    // Check for component cards
    const componentCount = await this.page
      .locator(this.selectors.componentCard)
      .count();
    if (componentCount === 0) {
      throw new Error('No component cards visible');
    }
  }

  /**
   * Test keyboard navigation through form fields
   */
  async testKeyboardNavigation() {
    const inputs = this.page.locator('input, select, textarea, button');
    const count = await inputs.count();

    if (count > 0) {
      // Focus first element
      await inputs.first().focus();

      // Tab through elements
      for (let i = 1; i < Math.min(count, 5); i++) {
        await this.page.keyboard.press('Tab');

        // Check that an element has focus
        const focusedElement = await this.page.evaluate(() => {
          return document.activeElement?.tagName;
        });

        expect(focusedElement).toBeTruthy();
      }
    }
  }
}
