/**
 * The URL Stripe actually returns a buyer to shows them their booking link (#1126).
 *
 * WHY THIS EXISTS. `BookingStep` was mounted only on `/checkout`, while `success_url` sent
 * buyers to `/payment-result`. Nothing navigated to `/checkout?session_id=`, so the per-SKU
 * booking work of #1092 / #1100 / #1113 ran on a route with no traffic. A buyer paid for a
 * scheduled session and was offered "Back to Payment Demo".
 *
 * The whole test suite missed it because every test was individually correct:
 * `BookingStep.test.tsx` renders the component with props (blind to mounting),
 * `checkout-paid-return.test.tsx` mocks a `session_id` production never emits, and
 * `payment-return.test.ts` is right about the URL's shape and silent about its destination.
 *
 * So this spec drives the ACTUAL return path — the pathname taken from the Edge Function, with
 * a `session_id` — and asserts a booking link appears carrying the SKU that was purchased.
 *
 * WHAT IS STUBBED, AND WHY THAT IS HONEST. Everything downstream of the redirect:
 * `verify-stripe-session`, and the three Supabase reads. A real hosted-Stripe round trip is
 * not reachable here — Stripe's webhook cannot reach a local runner, so `payment_results` is
 * never written, and Turnstile refuses tokens to automated browsers on production by design.
 * What this proves is the part that was broken: given the real return URL and a real order,
 * the page resolves the SKU and renders the link. It does not prove Stripe's redirect itself.
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

const INTENT_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = 'cs_test_returnleg1126';

/** The SKU under test — the one whose booking link differs from the default. */
const SKU = 'prd-office-hours';

test.describe('the hosted-Stripe return leg (#1126)', () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    // Stripe's session → our intent.
    await page.route('**/functions/v1/verify-stripe-session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, intent_id: INTENT_ID }),
      })
    );

    // Our record of the payment. The page asks US, never the redirect.
    await page.route('**/rest/v1/payment_results*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '33333333-3333-4333-8333-333333333333',
          intent_id: INTENT_ID,
          status: 'succeeded',
        }),
      })
    );

    // The order carries the SKU. This is the link that was missing: the return URL has no
    // `sku`, so anything reading the URL gets undefined and falls through to the free call.
    await page.route('**/rest/v1/orders*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: ORDER_ID,
          buyer_email: 'buyer@example.com',
          product_id: SKU,
        }),
      })
    );

    await page.route('**/rest/v1/products*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: SKU,
          name: 'Office Hours',
          amount: 3900,
          amount_mode: 'fixed',
          type: 'one_time',
          active: true,
        }),
      })
    );
  });

  test('a returning buyer is offered a booking link', async ({ page }) => {
    await page.goto(
      `/payment-result?session_id=${SESSION_ID}&status=succeeded`
    );
    await dismissCookieBanner(page);

    // The booking control. `BookingStep` renders either a scheduling link or an explicit
    // "not configured" notice — both are acceptable here, because the defect was that
    // NEITHER appeared: the component was not on this route at all.
    const booking = page
      .getByRole('link', { name: /choose a time/i })
      .or(page.getByText(/scheduling is not configured/i));

    await expect(
      booking,
      'no booking control on the page Stripe returns buyers to — BookingStep is not mounted ' +
        'on this route (#1126)'
    ).toBeVisible({ timeout: 20000 });
  });

  test('the booking link carries the purchased SKU, not the default call', async ({
    page,
  }) => {
    await page.goto(
      `/payment-result?session_id=${SESSION_ID}&status=succeeded`
    );
    await dismissCookieBanner(page);

    const link = page.getByRole('link', { name: /choose a time/i });
    // Skip rather than fail when no scheduler is configured for this environment — the
    // sibling test above still proves the component is mounted, which is the defect.
    const count = await link.count().catch(() => 0);
    test.skip(count === 0, 'no calendar configured in this environment');

    const href = await link.first().getAttribute('href');
    expect(href, 'the booking link has no href').toBeTruthy();
    expect(
      href,
      'the booking link points at the DEFAULT event, so the per-SKU resolution did not run — ' +
        'this is #1092 reappearing on the return leg'
    ).toContain('office-hours');
  });

  test('the confirmation names the product that was bought', async ({
    page,
  }) => {
    await page.goto(
      `/payment-result?session_id=${SESSION_ID}&status=succeeded`
    );
    await dismissCookieBanner(page);
    await expect(page.getByText(/office hours/i).first()).toBeVisible({
      timeout: 20000,
    });
  });
});
