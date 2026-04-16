/**
 * Integration Test: Failed Payment Retry - T057
 * Tests error handling UI and retry logic for failed payments
 *
 * NOTE: Tests that require actual Stripe Checkout redirect are skipped
 * because CI does not have Stripe API keys configured.
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

test.describe('Failed Payment Retry Logic', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear cookies and storage to reset consent state
    await context.clearCookies();

    // Sign in first - /payment-demo is a protected route
    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // Clear localStorage to reset consent state
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

  test.skip('should display retry button for failed payment', async ({
    page,
  }) => {
    // Skip: Requires actual Stripe Checkout
    test.skip(
      true,
      'Stripe API keys not configured - skipping Checkout flow test'
    );
  });

  test('should render payment result page with missing session', async ({
    page,
  }) => {
    // Navigate to payment result with no query param
    await page.goto('/payment-result');
    await dismissCookieBanner(page);
    await waitForAuthenticatedState(page);

    // Should show the "no payment session" empty state
    await expect(page.getByText(/no payment session found/i)).toBeVisible({
      timeout: 10000,
    });

    // Should have a link back to the payment demo
    await expect(
      page.getByRole('link', { name: /go to payment demo/i })
    ).toBeVisible();
  });

  test.skip('should display error message for network failure', async ({
    page,
    context,
  }) => {
    // Skip: Offline error display not yet implemented
    test.skip(true, 'Offline error handling not yet implemented');
  });

  test.skip('should handle subscription payment retry with exponential backoff', async ({
    page,
  }) => {
    // Skip: /payment/subscriptions route doesn't exist
    test.skip(true, 'Subscription management page not yet implemented');
  });

  test('should render payment result page with malformed ID', async ({
    page,
  }) => {
    // Navigate with a malformed (non-UUID) id parameter
    await page.goto('/payment-result?id=not-a-valid-uuid');
    await dismissCookieBanner(page);
    await waitForAuthenticatedState(page);

    // Malformed ID should trigger the missing-id empty state
    await expect(page.getByText(/no payment session found/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test.skip('should log error details for debugging', async ({ page }) => {
    // Skip: Requires actual Stripe Checkout
    test.skip(
      true,
      'Stripe API keys not configured - skipping Checkout flow test'
    );
  });

  test.skip('should display user-friendly error messages', async ({ page }) => {
    // Skip: Requires actual Stripe Checkout
    test.skip(
      true,
      'Stripe API keys not configured - skipping Checkout flow test'
    );
  });

  test('should show payment demo page correctly', async ({ page }) => {
    // Verify payment demo page loads correctly
    await expect(
      page.getByRole('heading', { name: /Payment Integration Demo/i })
    ).toBeVisible();

    // GDPR consent should be visible
    await expect(
      page.getByRole('heading', { name: /GDPR Consent/i })
    ).toBeVisible();
  });

  test('should grant consent and show payment options', async ({ page }) => {
    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();

    // Wait for payment options to appear
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible({
      timeout: 5000,
    });

    // Payment buttons should be visible
    await expect(
      page.getByRole('button', { name: /Pay \$20\.00/i })
    ).toBeVisible();
  });
});
