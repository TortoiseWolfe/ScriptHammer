/**
 * Integration Test: One-Time Payment (Stripe) - T055
 * Tests Stripe payment UI and consent flow
 *
 * NOTE: The full Stripe Checkout redirect tests (one-time AND subscription
 * mode) run locally when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (+
 * NEXT_PUBLIC_STRIPE_PRICE_ID for the subscription leg) are set via .env.
 * They auto-skip in CI, whose test-run env does not carry those vars
 * (isStripeConfigured is false). The remaining cancellation / declined-card
 * cases are still stubs. Cancel/resume lifecycle lives in
 * 08-subscription-lifecycle.spec.ts.
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

  // Runs locally when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set (see .env);
  // auto-skips in CI, where that var is absent from the test-run env so
  // isStripeConfigured is false. Drives a real Stripe Checkout redirect.
  test('should complete one-time payment successfully', async ({ page }) => {
    test.skip(
      !isStripeConfigured,
      'Stripe API keys not configured - run locally for full payment flow tests'
    );

    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page
      .getByRole('heading', { name: /Step 2/i })
      .waitFor({ timeout: 5000 });

    // /payment-demo renders THREE PaymentButton instances (one-time $20,
    // subscribe $9.99/mo, PayPal $15), each with its own Stripe/PayPal tablist,
    // so bare role locators are strict-mode violations. The one-time instance
    // renders first; its pay button's accessible name is unique.
    await page
      .getByRole('tab', { name: /stripe/i })
      .first()
      .click();
    await page.getByRole('button', { name: 'Pay $20.00 (One-Time)' }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });
  });

  // Subscription leg (#105): usePaymentButton routes type="recurring" through
  // createSubscriptionCheckout → create-stripe-subscription (mode=subscription).
  //
  // GATE CHANGED (#772). The price is no longer a global
  // NEXT_PUBLIC_STRIPE_PRICE_ID — the server resolves it from
  // `products.stripe_price_id` for the SKU the button names. So this needs an
  // ACTIVE recurring SKU, and all three are deliberately `active = false` until
  // #772 and #559 are both closed, at which point the server correctly answers
  // "product not found".
  //
  // Skipped on the PRECONDITION, not on an assertion: the feature is not
  // shippable yet by design, so there is no failure being hidden here.
  test('should redirect to subscription-mode Stripe Checkout', async ({
    page,
  }) => {
    test.skip(
      !isStripeConfigured || !process.env.SUBSCRIPTION_SKU_ACTIVE,
      'No recurring SKU is active yet (#772/#559) — set SUBSCRIPTION_SKU_ACTIVE=1 once one is'
    );

    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page
      .getByRole('heading', { name: /Step 2/i })
      .waitFor({ timeout: 5000 });

    // Scope to the Subscribe PaymentButton instance — three instances render
    // their own Stripe tabs (see the strict-mode note in the one-time test).
    // Name follows the demo page's button, which now says which SKU it buys
    // rather than an amount the recurring path never charged (#772).
    const subscribeButton = page.getByRole('button', {
      name: 'Subscribe to Care Plan',
    });
    const container = page
      .locator('div.flex.flex-col.gap-4')
      .filter({ has: subscribeButton })
      .last();
    await container.getByRole('tab', { name: /stripe/i }).click();
    await subscribeButton.click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });
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

    // Select Stripe tab
    const stripeTab = page.getByRole('tab', { name: /stripe/i }).first();
    await stripeTab.click();
    await expect(stripeTab).toHaveClass(/tab-active/);

    // Select PayPal tab
    const paypalTab = page.getByRole('tab', { name: /paypal/i }).first();
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
