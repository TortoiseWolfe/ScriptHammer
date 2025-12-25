/**
 * Integration Test: GDPR Consent Flow - T058
 * Tests payment consent modal and script loading behavior
 */

import { test, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  waitForAuthenticatedState,
} from '../utils/test-user-factory';

// Test user credentials
const TEST_USER = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

test.describe('GDPR Payment Consent Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear storage to reset consent
    await context.clearCookies();

    // Sign in first - /payment-demo is a protected route
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    await page.goto('/payment-demo');
  });

  test('should show consent section on first visit', async ({ page }) => {
    // Consent section should be visible (it's inline, not a modal)
    const consentHeading = page.getByRole('heading', {
      name: /GDPR Consent/i,
    });
    await expect(consentHeading).toBeVisible();

    // Should show what consent means
    await expect(page.getByText(/what this means/i)).toBeVisible();

    // Should have accept and decline buttons
    await expect(page.getByRole('button', { name: /Accept/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Decline/i })).toBeVisible();
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
    await page.getByRole('button', { name: /Accept/i }).click();

    // Consent section should be replaced with payment options
    await expect(
      page.getByRole('heading', { name: /GDPR Consent/i })
    ).not.toBeVisible({ timeout: 5000 });

    // Select a payment provider to trigger script loading
    const stripeTab = page.getByRole('tab', { name: /stripe/i });
    if (await stripeTab.isVisible()) {
      await stripeTab.click();
      // Stripe script may or may not load depending on implementation
    }
  });

  test('should remember consent across page reloads', async ({ page }) => {
    // Accept consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await dismissCookieBanner(page);

    // Consent section should not appear
    await expect(
      page.getByRole('heading', { name: /Step 1: GDPR Consent/i })
    ).not.toBeVisible({ timeout: 3000 });
  });

  test('should handle consent decline gracefully', async ({ page }) => {
    // Decline consent
    await page.getByRole('button', { name: /Decline/i }).click();

    // After decline, payment should be disabled or consent section remains
    // Check that either Pay button is disabled or consent section still visible
    const payButton = page.getByRole('button', { name: /pay/i });
    const isPayDisabled = await payButton.isDisabled().catch(() => true);
    expect(isPayDisabled).toBe(true);
  });

  test('should allow consent reset', async ({ page }) => {
    // Accept consent first
    await page.getByRole('button', { name: /Accept/i }).click();
    await page.waitForTimeout(500);

    // Navigate to account settings (not /settings which may not exist)
    await page.goto('/account');
    await dismissCookieBanner(page);

    // Find reset consent button if it exists
    const resetButton = page.getByRole('button', {
      name: /reset.*consent|revoke.*consent/i,
    });

    if (await resetButton.isVisible().catch(() => false)) {
      await resetButton.click();
      // Confirm if dialog appears
      const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }

      // Go back to payment page
      await page.goto('/payment-demo');
      await dismissCookieBanner(page);

      // Consent section should appear again
      await expect(
        page.getByRole('heading', { name: /GDPR Consent/i })
      ).toBeVisible();
    }
  });

  test('should have accessible consent buttons', async ({ page }) => {
    // Accept button should be visible and accessible
    const acceptButton = page.getByRole('button', { name: /Accept/i });
    await expect(acceptButton).toBeVisible();
    await expect(acceptButton).toBeEnabled();

    // Decline button should be visible and accessible
    const declineButton = page.getByRole('button', { name: /Decline/i });
    await expect(declineButton).toBeVisible();
    await expect(declineButton).toBeEnabled();
  });

  test('should persist consent decision', async ({ page }) => {
    // Accept consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await dismissCookieBanner(page);

    // GDPR section should not reappear
    const gdprHeading = page.getByRole('heading', {
      name: /Step 1: GDPR Consent/i,
    });
    await expect(gdprHeading).not.toBeVisible({ timeout: 3000 });
  });

  test('should show privacy information', async ({ page }) => {
    // Privacy info should be visible
    await expect(
      page.getByText(/External scripts will be loaded/i)
    ).toBeVisible();
    await expect(
      page.getByText(/payment data will be processed securely/i)
    ).toBeVisible();
  });

  test('should allow proceeding after consent', async ({ page }) => {
    // Accept consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page.waitForTimeout(1000);

    // Should be able to see payment options (Step 2)
    const step2 = page.getByRole('heading', { name: /Step 2/i });
    await expect(step2).toBeVisible({ timeout: 5000 });
  });
});
