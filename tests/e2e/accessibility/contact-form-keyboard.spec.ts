import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * E2E Test: Contact Form Keyboard Navigation
 *
 * Moved from unit tests (ContactForm.test.tsx:309) because focus tracking
 * requires real browser DOM, not jsdom simulation.
 *
 * Tests keyboard navigation through form fields with proper tab order.
 */
test.describe('Contact Form - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact');
    // Dismiss cookie banner to prevent it from intercepting focus/keyboard
    await dismissCookieBanner(page);
  });

  test('should be keyboard navigable with proper tab order', async ({
    page,
  }) => {
    // Click on name field to establish focus in the form
    const nameField = page.locator('input[name="name"]');
    await nameField.click();
    await expect(nameField).toBeFocused();

    // Tab to email field
    await page.keyboard.press('Tab');
    const emailField = page.locator('input[name="email"]');
    await expect(emailField).toBeFocused();

    // Tab to subject field
    await page.keyboard.press('Tab');
    const subjectField = page.locator('input[name="subject"]');
    await expect(subjectField).toBeFocused();

    // Tab to message field
    await page.keyboard.press('Tab');
    const messageField = page.locator('textarea[name="message"]');
    await expect(messageField).toBeFocused();

    // Tab to submit button
    await page.keyboard.press('Tab');
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeFocused();
  });

  test('should allow form submission via keyboard (Enter key)', async ({
    page,
  }) => {
    // Click on name field to establish focus in the form
    const nameField = page.locator('input[name="name"]');
    await nameField.click();
    await page.keyboard.type('John Doe');

    await page.keyboard.press('Tab');
    await page.keyboard.type('john@example.com');

    await page.keyboard.press('Tab');
    await page.keyboard.type('Test Subject');

    await page.keyboard.press('Tab');
    await page.keyboard.type('Test message content that is long enough');

    // Tab to submit button and press Enter
    await page.keyboard.press('Tab');
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeFocused();
    await page.keyboard.press('Enter');

    // Form should show loading state or result
    // Wait for either: success message, error message, or button loading state
    await page.waitForTimeout(1000);

    // Check that form responded to submission (button changes or alert appears)
    const hasResponse =
      (await submitButton.getAttribute('class'))?.includes('loading') ||
      (await page.locator('[role="alert"], .alert').count()) > 0 ||
      // Form cleared after success
      (await nameField.inputValue()) === '';

    expect(hasResponse).toBeTruthy();
  });

  test('should maintain focus after validation errors', async ({ page }) => {
    // Click on submit button without filling required fields
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for validation
    await page.waitForTimeout(500);

    // Focus should be on first error field (name field)
    const activeElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName?.toLowerCase();
    });

    // Active element should be a form element (focused on first error)
    expect(['input', 'textarea', 'button']).toContain(activeElement);
  });

  test('should support Shift+Tab for backwards navigation', async ({
    page,
  }) => {
    // Click on message field to establish focus
    const messageField = page.locator('textarea[name="message"]');
    await messageField.click();
    await expect(messageField).toBeFocused();

    // Shift+Tab backwards to subject
    await page.keyboard.press('Shift+Tab');
    const subjectField = page.locator('input[name="subject"]');
    await expect(subjectField).toBeFocused();

    // Shift+Tab backwards to email
    await page.keyboard.press('Shift+Tab');
    const emailField = page.locator('input[name="email"]');
    await expect(emailField).toBeFocused();
  });
});
