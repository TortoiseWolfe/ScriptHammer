import { test, expect } from '@playwright/test';

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
  });

  test('should be keyboard navigable with proper tab order', async ({
    page,
  }) => {
    // Start at the beginning of the page
    await page.keyboard.press('Tab');

    // Tab to name field
    const nameField = page.locator('input[name="name"]');
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
    // Fill form using keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.type('John Doe');

    await page.keyboard.press('Tab');
    await page.keyboard.type('john@example.com');

    await page.keyboard.press('Tab');
    await page.keyboard.type('Test Subject');

    await page.keyboard.press('Tab');
    await page.keyboard.type('Test message content');

    // Tab to submit button and press Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Verify form submission (success message or validation)
    // Note: Adjust selector based on actual implementation
    const result = await page
      .waitForSelector('[role="alert"], .alert', {
        timeout: 5000,
      })
      .catch(() => null);

    // Form should either submit or show validation
    expect(result).toBeTruthy();
  });

  test('should maintain focus after validation errors', async ({ page }) => {
    // Tab to submit button without filling required fields
    await page.keyboard.press('Tab'); // name
    await page.keyboard.press('Tab'); // email
    await page.keyboard.press('Tab'); // subject
    await page.keyboard.press('Tab'); // message
    await page.keyboard.press('Tab'); // submit
    await page.keyboard.press('Enter');

    // Wait for validation
    await page.waitForTimeout(500);

    // Focus should remain in form (not lost)
    const activeElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName?.toLowerCase();
    });

    // Active element should be a form element or button
    expect(['input', 'textarea', 'button']).toContain(activeElement);
  });

  test('should support Shift+Tab for backwards navigation', async ({
    page,
  }) => {
    // Tab forward to message field
    await page.keyboard.press('Tab'); // name
    await page.keyboard.press('Tab'); // email
    await page.keyboard.press('Tab'); // subject
    await page.keyboard.press('Tab'); // message

    const messageField = page.locator('textarea[name="message"]');
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
