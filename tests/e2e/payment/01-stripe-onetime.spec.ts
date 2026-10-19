/**
 * Integration Test: One-Time Payment (Stripe) - T055
 * Tests Stripe payment UI and consent flow
 *
 * The Stripe Checkout redirect legs (one-time and subscription) run on every
 * lane: the Edge Function that mints the hosted Checkout URL is route-mocked
 * and checkout.stripe.com is fulfilled with a stub page, so nothing leaves the
 * runner and no provider key is needed (the client redirects with
 * window.location.assign(url) and never loads Stripe.js). One-time still goes
 * through the real create-order function to create its payment_intent.
 * Cancel/resume lifecycle lives in 08-subscription-lifecycle.spec.ts.
 */

import { test, expect, type Page } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

const STUB_CHECKOUT_URL =
  'https://checkout.stripe.com/c/pay/cs_test_e2e_stub#fragment';

/** Fulfil the hosted Checkout page so the redirect has somewhere to land. */
async function stubStripeCheckoutPage(page: Page) {
  await page.route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><h1>Stripe Checkout stub</h1></body></html>',
    })
  );
}

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

  test('should complete one-time payment successfully', async ({ page }) => {
    // The real create-order makes the intent; only the Stripe-facing function
    // is mocked, and it must be handed that intent's id.
    let checkoutBody: { payment_intent_id?: string } | null = null;
    await page.route('**/functions/v1/create-stripe-checkout', (route) => {
      checkoutBody = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ url: STUB_CHECKOUT_URL }),
      });
    });
    await stubStripeCheckoutPage(page);

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

    await page.waitForURL(/checkout\.stripe\.com\/c\/pay\/cs_test_e2e_stub/, {
      timeout: 15000,
    });
    expect(checkoutBody).not.toBeNull();
    expect(checkoutBody!.payment_intent_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  // Subscription leg (#105): usePaymentButton routes type="recurring" through
  // createSubscriptionCheckout → create-stripe-subscription (mode=subscription).
  // The server resolves the price from products.stripe_price_id for the SKU the
  // button names (#772), so the request must carry that SKU and no price.
  test('should redirect to subscription-mode Stripe Checkout', async ({
    page,
  }) => {
    let subscriptionBody: Record<string, unknown> | null = null;
    await page.route('**/functions/v1/create-stripe-subscription', (route) => {
      subscriptionBody = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ url: STUB_CHECKOUT_URL }),
      });
    });
    await stubStripeCheckoutPage(page);

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

    await page.waitForURL(/checkout\.stripe\.com\/c\/pay\/cs_test_e2e_stub/, {
      timeout: 15000,
    });
    expect(subscriptionBody).not.toBeNull();
    expect(subscriptionBody!.product_id).toBe('svc-care');
    expect(subscriptionBody).not.toHaveProperty('price_id');
  });

  test('should handle payment cancellation gracefully', async ({ page }) => {
    // Stripe's cancel_url carries no id: a buyer who changed their mind.
    await page.goto('/payment-result?status=cancelled', {
      waitUntil: 'networkidle',
    });

    const notice = page.getByRole('status').filter({
      hasText: 'Checkout cancelled',
    });
    await expect(notice).toBeVisible({ timeout: 15000 });
    await expect(notice).toContainText('You were not charged');
    await expect(
      page.getByRole('link', { name: 'Back to pricing' })
    ).toBeVisible();
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
});
