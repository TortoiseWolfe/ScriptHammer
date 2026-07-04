/**
 * Payment E2E: Stripe Subscription Lifecycle — live sandbox (#105)
 *
 * Drives the deployed cancel-subscription / resume-subscription Edge
 * Functions end-to-end against a REAL test-mode Stripe subscription, and
 * cross-checks provider state (cancel_at_period_end) after each action.
 *
 * Local-only by design: requires STRIPE_SECRET_KEY +
 * NEXT_PUBLIC_STRIPE_PRICE_ID (both via .env / dotenv) plus the admin
 * client. CI carries none of these, so the test auto-skips there — the same
 * pattern as 01-stripe-onetime's live redirect tests.
 */

import { test, expect } from '@playwright/test';
import {
  seedLiveStripeSubscription,
  deleteLiveStripeSubscription,
  getStripeSubscription,
  openSubscriptionsAs,
  getAdminClient,
} from '../utils/test-user-factory';

const isLiveStripeConfigured =
  !!process.env.STRIPE_SECRET_KEY && !!process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

test.describe('Stripe Subscription Lifecycle (live sandbox)', () => {
  // Seeding provisions a real customer + subscription at Stripe.
  test.describe.configure({ timeout: 120_000 });

  test('cancel and resume round-trip through the deployed Edge Functions', async ({
    browser,
  }) => {
    test.skip(
      !isLiveStripeConfigured,
      'STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PRICE_ID not set — run locally for the live lifecycle test'
    );

    const fixture = await seedLiveStripeSubscription();
    test.skip(!fixture, 'admin client unavailable or Stripe seed failed');

    const opened = await openSubscriptionsAs(browser, fixture!);
    const { page } = opened;
    try {
      // Seeded row renders as an Active card.
      await expect(
        page.locator('.badge', { hasText: 'Active' }).first()
      ).toBeVisible({ timeout: 20_000 });

      // Cancel: local model flips to 'canceled' immediately; at Stripe this
      // is active + cancel_at_period_end=true (access until period end).
      page.once('dialog', (d) => d.accept());
      await page
        .getByRole('button', { name: 'Cancel subscription' })
        .first()
        .click();
      await expect(
        page.locator('.badge', { hasText: 'Canceled' }).first()
      ).toBeVisible({ timeout: 20_000 });
      await expect
        .poll(
          async () =>
            (await getStripeSubscription(fixture!.stripeSubscriptionId))
              .cancel_at_period_end,
          { timeout: 15_000 }
        )
        .toBe(true);

      // Resume: back to active on both sides.
      await page
        .getByRole('button', { name: 'Resume subscription' })
        .first()
        .click();
      await expect(
        page.locator('.badge', { hasText: 'Active' }).first()
      ).toBeVisible({ timeout: 20_000 });
      await expect
        .poll(
          async () =>
            (await getStripeSubscription(fixture!.stripeSubscriptionId))
              .cancel_at_period_end,
          { timeout: 15_000 }
        )
        .toBe(false);

      // DB row ends consistent: active with cancellation fields cleared.
      const admin = getAdminClient();
      await expect
        .poll(
          async () => {
            const { data } = await admin!
              .from('subscriptions')
              .select('status, canceled_at')
              .eq('id', fixture!.subscriptionId)
              .single();
            return (
              data && data.status === 'active' && data.canceled_at === null
            );
          },
          { timeout: 10_000 }
        )
        .toBe(true);
    } finally {
      await opened.close();
      await deleteLiveStripeSubscription(fixture);
    }
  });
});
