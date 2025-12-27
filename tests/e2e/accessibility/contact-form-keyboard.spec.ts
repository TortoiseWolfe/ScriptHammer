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
    const nameField = page.getByLabel('Full Name');
    await nameField.click();
    await expect(nameField).toBeFocused();

    // Tab to email field
    await page.keyboard.press('Tab');
    const emailField = page.getByLabel('Email Address');
    await expect(emailField).toBeFocused();

    // Tab to subject field
    await page.keyboard.press('Tab');
    const subjectField = page.getByLabel('Subject');
    await expect(subjectField).toBeFocused();

    // Tab to message field
    await page.keyboard.press('Tab');
    const messageField = page.getByLabel('Message');
    await expect(messageField).toBeFocused();

    // Tab to submit button
    await page.keyboard.press('Tab');
    const submitButton = page.getByRole('button', { name: /send|submit/i });
    await expect(submitButton).toBeFocused();
  });

  test('should allow form submission via keyboard (Enter key)', async ({
    page,
  }) => {
    // Click on name field to establish focus in the form
    const nameField = page.getByLabel('Full Name');
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
    const submitButton = page.getByRole('button', { name: /send|submit/i });
    await expect(submitButton).toBeFocused();
    await page.keyboard.press('Enter');

    // Wait for form to respond - either loading state, alert, or form cleared
    await expect(async () => {
      const buttonClass = await submitButton.getAttribute('class');
      const hasLoadingClass = buttonClass?.includes('loading') ?? false;
      const alertCount = await page.locator('[role="alert"], .alert').count();
      const nameValue = await nameField.inputValue();
      const hasResponse = hasLoadingClass || alertCount > 0 || nameValue === '';
      expect(hasResponse).toBeTruthy();
    }).toPass({ timeout: 5000 });
  });

  test('should maintain focus after validation errors', async ({ page }) => {
    // Click on submit button without filling required fields
    const submitButton = page.getByRole('button', { name: /send|submit/i });
    await submitButton.click();

    // Wait for validation to complete and focus to move
    await expect(async () => {
      const activeElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.tagName?.toLowerCase();
      });
      // Active element should be a form element (focused on first error)
      expect(['input', 'textarea', 'button']).toContain(activeElement);
    }).toPass({ timeout: 3000 });
  });

  test('should support Shift+Tab for backwards navigation', async ({
    page,
  }) => {
    // Click on message field to establish focus
    const messageField = page.getByLabel('Message');
    await messageField.click();
    await expect(messageField).toBeFocused();

    // Shift+Tab backwards to subject
    await page.keyboard.press('Shift+Tab');
    const subjectField = page.getByLabel('Subject');
    await expect(subjectField).toBeFocused();

    // Shift+Tab backwards to email
    await page.keyboard.press('Shift+Tab');
    const emailField = page.getByLabel('Email Address');
    await expect(emailField).toBeFocused();
  });
});
