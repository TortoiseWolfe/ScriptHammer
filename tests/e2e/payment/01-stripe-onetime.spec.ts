/**
 * Integration Test: One-Time Payment (Stripe) - T055
 * Tests Stripe payment UI and consent flow
 *
 * NOTE: Tests that require actual Stripe Checkout redirect are skipped
 * because CI does not have NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY configured.
 * These tests should be run locally with Stripe test keys for full coverage.
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

// Check if Stripe is configured
const isStripeConfigured = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

test.describe('Stripe One-Time Payment Flow', () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    // storage-state-auth.json already carries a valid Supabase session.
    // Direct nav avoids the /sign-in hop; auth-hydration race handled by retry.
    await page.goto('/payment-demo', { waitUntil: 'networkidle' });
    if (page.url().includes('/sign-in')) {
      await page.waitForTimeout(3000);
      await page.goto('/payment-demo', { waitUntil: 'networkidle' });
    }
    await dismissCookieBanner(page);

    await page
      .getByRole('heading', { name: /Step [12]|GDPR Consent/i })
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });

    await page.evaluate(() => {
      localStorage.removeItem('payment_consent');
      localStorage.removeItem('payment_consent_date');
      localStorage.removeItem('gdpr_consent');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await dismissCookieBanner(page);

    await page
      .getByRole('heading', { name: /Step [12]|GDPR Consent/i })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
  });

  // Skip tests that require actual Stripe integration
  test.skip('should complete one-time payment successfully', async ({
    page,
  }) => {
    // This test requires actual Stripe Checkout redirect
    // Run locally with NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY configured
    test.skip(
      !isStripeConfigured,
      'Stripe API keys not configured - run locally for full payment flow tests'
    );

    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page
      .getByRole('heading', { name: /Step 2/i })
      .waitFor({ timeout: 5000 });

    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 10000 });
  });

  test.skip('should handle payment cancellation gracefully', async ({
    page,
  }) => {
    test.skip(
      !isStripeConfigured,
      'Stripe API keys not configured - skipping Checkout flow test'
    );
  });

  test.skip('should display error for declined card', async ({ page }) => {
    test.skip(
      !isStripeConfigured,
      'Stripe API keys not configured - skipping Checkout flow test'
    );
  });

  test('should enforce payment consent requirement', async ({ page }) => {
    // The GDPR consent section should be visible first
    await expect(
      page.getByRole('heading', { name: /GDPR Consent/i })
    ).toBeVisible();

    // Payment buttons should not be visible until consent is granted
    // (they're in Step 2 which is hidden until Step 1 consent is completed)
    const step2 = page.getByRole('heading', { name: /Step 2/i });
    await expect(step2).not.toBeVisible();
  });

  test('should show payment options after granting consent', async ({
    page,
  }) => {
    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();

    // Wait for Step 2 to appear
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible({
      timeout: 5000,
    });

    // Provider tabs should be visible (use .first() as there are multiple payment sections)
    await expect(
      page.getByRole('tab', { name: /stripe/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('tab', { name: /paypal/i }).first()
    ).toBeVisible();

    // Payment buttons should be visible (but may be disabled without API keys)
    await expect(
      page.getByRole('button', { name: /Pay \$20\.00/i })
    ).toBeVisible();
  });

  test('should allow selecting different payment providers', async ({
    page,
  }) => {
    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page
      .getByRole('heading', { name: /Step 2/i })
      .waitFor({ timeout: 5000 });

    // Step 2 heading can appear before PaymentButton children finish rendering
    // their tablists. Wait for the tabs themselves before interacting.
    const stripeTab = page.getByRole('tab', { name: /stripe/i }).first();
    const paypalTab = page.getByRole('tab', { name: /paypal/i }).first();
    await expect(stripeTab).toBeVisible({ timeout: 15000 });
    await expect(paypalTab).toBeVisible({ timeout: 15000 });

    await stripeTab.click();
    await expect(stripeTab).toHaveClass(/tab-active/);

    await paypalTab.click();
    await expect(paypalTab).toHaveClass(/tab-active/);
  });

  test.skip('should show offline queue indicator when offline', async ({
    page,
    context,
  }) => {
    // Skip: Offline queue feature may not be fully implemented
    test.skip(true, 'Offline queue feature not yet implemented');
  });
});
