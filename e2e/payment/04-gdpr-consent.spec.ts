/**
 * Integration Test: GDPR Consent Flow - T058
 * Tests payment consent modal and script loading behavior
 */

import { test, expect } from '@playwright/test';

test.describe('GDPR Payment Consent Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear storage to reset consent
    await context.clearCookies();
    await page.goto('/payment-demo');
  });

  test('should show consent modal on first visit', async ({ page }) => {
    // Consent modal should be visible
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });
    await expect(consentModal).toBeVisible();

    // Should have lock icon
    await expect(
      consentModal.locator('svg[aria-hidden="true"]').first()
    ).toBeVisible();

    // Should show what consent means
    await expect(consentModal.getByText(/what this means/i)).toBeVisible();

    // Should show GDPR compliance notice
    await expect(consentModal.getByText(/gdpr.*compliance/i)).toBeVisible();

    // Should have accept and decline buttons
    await expect(
      consentModal.getByRole('button', { name: /accept/i })
    ).toBeVisible();
    await expect(
      consentModal.getByRole('button', { name: /decline/i })
    ).toBeVisible();
  });

  test('should not load payment scripts before consent', async ({ page }) => {
    // Check that Stripe/PayPal scripts are not loaded
    const stripeScript = page.locator('script[src*="stripe"]');
    const paypalScript = page.locator('script[src*="paypal"]');

    await expect(stripeScript).toHaveCount(0);
    await expect(paypalScript).toHaveCount(0);
  });

  test('should load payment scripts after consent granted', async ({
    page,
  }) => {
    // Accept consent
    await page
      .getByRole('dialog', { name: /payment consent/i })
      .getByRole('button', { name: /accept/i })
      .click();

    // Modal should close
    await expect(
      page.getByRole('dialog', { name: /payment consent/i })
    ).not.toBeVisible();

    // Select a payment provider to trigger script loading
    await page.getByRole('tab', { name: /stripe/i }).click();

    // Stripe script should be loaded
    await expect(page.locator('script[src*="stripe"]')).toHaveCount(1);
  });

  test('should remember consent across page reloads', async ({ page }) => {
    // Accept consent
    await page
      .getByRole('dialog', { name: /payment consent/i })
      .getByRole('button', { name: /accept/i })
      .click();

    // Reload page
    await page.reload();

    // Modal should not appear
    await expect(
      page.getByRole('dialog', { name: /payment consent/i })
    ).not.toBeVisible();

    // Payment options should be enabled
    await expect(page.getByRole('tab', { name: /stripe/i })).toBeEnabled();
  });

  test('should handle consent decline gracefully', async ({ page }) => {
    // Decline consent
    await page
      .getByRole('dialog', { name: /payment consent/i })
      .getByRole('button', { name: /decline/i })
      .click();

    // Modal should close
    await expect(
      page.getByRole('dialog', { name: /payment consent/i })
    ).not.toBeVisible();

    // Payment button should be disabled
    await expect(page.getByRole('button', { name: /pay/i })).toBeDisabled();

    // Should show consent required message
    await expect(
      page.getByText(/consent.*required|accept.*consent/i)
    ).toBeVisible();
  });

  test('should allow consent reset', async ({ page }) => {
    // Accept consent
    await page
      .getByRole('dialog', { name: /payment consent/i })
      .getByRole('button', { name: /accept/i })
      .click();

    // Navigate to settings
    await page.goto('/settings');

    // Find and click reset consent button
    const resetButton = page.getByRole('button', {
      name: /reset.*consent|revoke.*consent/i,
    });
    await resetButton.click();

    // Confirm reset
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /confirm|yes/i })
      .click();

    // Go back to payment page
    await page.goto('/payment-demo');

    // Consent modal should appear again
    await expect(
      page.getByRole('dialog', { name: /payment consent/i })
    ).toBeVisible();
  });

  test('should focus accept button when modal opens', async ({ page }) => {
    const acceptButton = page
      .getByRole('dialog', { name: /payment consent/i })
      .getByRole('button', { name: /accept/i });

    // Accept button should have focus
    await expect(acceptButton).toBeFocused();
  });

  test('should prevent ESC key from closing modal', async ({ page }) => {
    // Press ESC key
    await page.keyboard.press('Escape');

    // Modal should still be visible
    await expect(
      page.getByRole('dialog', { name: /payment consent/i })
    ).toBeVisible();
  });

  test('should link to privacy policy', async ({ page }) => {
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });

    // Privacy policy link should be present
    const privacyLink = consentModal.getByRole('link', {
      name: /privacy.*policy/i,
    });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  test('should show consent date after acceptance', async ({ page }) => {
    // Accept consent
    await page
      .getByRole('dialog', { name: /payment consent/i })
      .getByRole('button', { name: /accept/i })
      .click();

    // Navigate to settings
    await page.goto('/settings');

    // Should show consent granted date
    await expect(page.getByText(/consent.*granted.*\d{4}/i)).toBeVisible();
  });
});
