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

    // Clear localStorage to reset consent
    await page.evaluate(() => {
      localStorage.removeItem('payment_consent');
      localStorage.removeItem('gdpr_consent');
    });

    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    await page.goto('/payment-demo');
    await dismissCookieBanner(page);
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
    // Check that the main Stripe.js SDK and PayPal SDK are not loaded before consent
    // Note: @stripe/stripe-js package may include lightweight loader scripts in the bundle,
    // but the main js.stripe.com/v3 SDK should NOT load until loadStripe() is called
    const stripeMainSDK = page.locator('script[src*="js.stripe.com/v3"]');
    const paypalSDK = page.locator('script[src*="paypal.com/sdk"]');

    // Main SDKs should not be loaded before consent
    await expect(stripeMainSDK).toHaveCount(0);
    await expect(paypalSDK).toHaveCount(0);
  });

  test('should show payment options after consent granted', async ({
    page,
  }) => {
    // Accept consent
    await page.getByRole('button', { name: /Accept/i }).click();

    // Consent section should be replaced with payment options
    await expect(
      page.getByRole('heading', { name: /GDPR Consent/i })
    ).not.toBeVisible({ timeout: 5000 });

    // Step 2 should now be visible
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible();

    // Payment provider tabs should be visible (use .first() - 3 PaymentButton components each have tabs)
    await expect(
      page.getByRole('tab', { name: /stripe/i }).first()
    ).toBeVisible();
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

    // Step 2 should be visible instead
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible();
  });

  test('should handle consent decline gracefully', async ({ page }) => {
    // Decline consent
    await page.getByRole('button', { name: /Decline/i }).click();

    // After decline, an alert should appear explaining consent is required
    // The page uses window.alert for decline (check the page.tsx)
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Payment features require consent');
      await dialog.accept();
    });
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

  test.skip('should allow consent reset', async ({ page }) => {
    // Skip: Consent reset feature may not be implemented in /account
    test.skip(true, 'Consent reset feature not yet implemented');
  });
});
