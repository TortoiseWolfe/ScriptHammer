/**
 * Integration Test: Subscription Creation (PayPal) - T056
 * Tests PayPal payment UI components
 *
 * NOTE: Tests that require actual PayPal Checkout redirect are skipped
 * because CI does not have PayPal API keys configured.
 * These tests should be run locally with PayPal sandbox credentials for full coverage.
 */

import { test, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  getAdminClient,
  seedIsolatedSubscription,
  deleteIsolatedSubscription,
  openSubscriptionsAs,
  type IsolatedSubscription,
} from '../utils/test-user-factory';

test.describe('PayPal Subscription Creation Flow', () => {
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

  test.skip('should create PayPal subscription successfully', async ({
    page,
  }) => {
    // Skip: Requires actual PayPal integration
    test.skip(true, 'PayPal API keys not configured - skipping flow test');
  });

  test('should show PayPal provider tab', async ({ page }) => {
    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page
      .getByRole('heading', { name: /Step 2/i })
      .waitFor({ timeout: 5000 });

    // PayPal tab should be visible
    const paypalTab = page.getByRole('tab', { name: /paypal/i }).first();
    await expect(paypalTab).toBeVisible();

    // Click PayPal tab
    await paypalTab.click();
    await expect(paypalTab).toHaveClass(/tab-active/);
  });

  test('should show PayPal payment button', async ({ page }) => {
    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page
      .getByRole('heading', { name: /Step 2/i })
      .waitFor({ timeout: 5000 });

    // PayPal button should be visible
    await expect(
      page.getByRole('button', { name: /PayPal \$15\.00/i })
    ).toBeVisible();
  });

  test('subscription management route renders for an authed user (#5)', async ({
    page,
  }) => {
    // The /account/subscriptions route now exists (#5). With no seeded
    // subscription the test user sees the empty-state; this asserts the route
    // is wired (ProtectedRoute → SubscriptionManager) and reachable.
    await page.goto('/account/subscriptions', { waitUntil: 'networkidle' });
    if (page.url().includes('/sign-in')) {
      await page.waitForTimeout(3000);
      await page.goto('/account/subscriptions', { waitUntil: 'networkidle' });
    }
    await dismissCookieBanner(page);

    await expect(
      page.getByRole('heading', { name: 'Subscriptions', level: 1 })
    ).toBeVisible({ timeout: 30000 });
    // Either the empty-state card or at least one subscription card renders.
    await expect(
      page.getByText(/No active subscriptions|subscription\(s\)/i).first()
    ).toBeVisible();
  });

  // The grace-period + duplicate-prevention flows below run against a SEEDED
  // subscription row via the per-test fixture (seedIsolatedSubscription —
  // service-role insert + cleanup, no provider creds). Cancel + failed-retry
  // remain skipped: cancel drives the cancel-subscription edge function and
  // failed-retry needs PayPal sandbox keys.

  test.skip('should allow subscription cancellation', async ({ page }) => {
    // Fixture exists (seedIsolatedSubscription) but cancel drives the
    // cancel-subscription Edge Function end-to-end; un-skip once that flow is
    // exercised against a deployed function with provider config.
    test.skip(true, 'Cancel drives the cancel-subscription Edge Function');
  });

  test.skip('should handle failed payment retry logic', async ({ page }) => {
    test.skip(true, 'Needs a seeded past_due/grace row + PayPal sandbox keys');
  });

  test('should show grace period warning', async ({ browser }) => {
    // Seed a grace_period subscription (expires in 5 days) for a throwaway user,
    // open /account/subscriptions AS that user, and assert the countdown + badge
    // render — driven by a real row through real RLS (no provider creds needed).
    let fixture: IsolatedSubscription | null = null;
    let opened: Awaited<ReturnType<typeof openSubscriptionsAs>> | null = null;
    try {
      fixture = await seedIsolatedSubscription('grace_period', {
        provider: 'stripe',
        graceDays: 5,
      });
      // No admin client / anon key (unconfigured env) → skip rather than fail.
      test.skip(!fixture, 'Admin client unavailable to seed subscription');
      if (!fixture) return;

      opened = await openSubscriptionsAs(browser, fixture);
      const { page } = opened;

      await expect(
        page.getByRole('heading', { name: 'Subscriptions', level: 1 })
      ).toBeVisible({ timeout: 30000 });

      // Grace-period alert with the day countdown (graceDays=5).
      await expect(
        page.getByText(/Grace period: 5 days remaining/i)
      ).toBeVisible({ timeout: 30000 });
      // The status badge.
      await expect(page.getByText(/Grace Period/i).first()).toBeVisible();
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedSubscription(fixture);
    }
  });

  test('should prevent duplicate subscriptions', async () => {
    // The one-live-per-user guard (idx_subscriptions_one_live_per_user) is
    // enforced server-side. Seed one live (active) row, then attempt a SECOND
    // live row for the same user via the service-role client and assert it is
    // rejected with Postgres unique_violation (23505) — the same rejection the
    // webhook upsert catches in prod. No provider creds needed.
    let fixture: IsolatedSubscription | null = null;
    try {
      fixture = await seedIsolatedSubscription('active', {
        provider: 'stripe',
      });
      const admin = getAdminClient();
      test.skip(
        !fixture || !admin,
        'Admin client unavailable to seed subscription'
      );
      if (!fixture || !admin) return;

      const { error } = await admin.from('subscriptions').insert({
        template_user_id: fixture.user.id,
        provider: 'paypal',
        provider_subscription_id: `iso_dup_${Date.now()}`,
        customer_email: fixture.user.email,
        plan_amount: 999,
        plan_interval: 'month',
        status: 'active', // second LIVE row for the same user → must be rejected
        failed_payment_count: 0,
      });

      expect(error).not.toBeNull();
      // Postgres unique_violation, on the one-live-per-user partial index.
      expect(error?.code).toBe('23505');
      expect(error?.message).toMatch(/idx_subscriptions_one_live_per_user/i);
    } finally {
      await deleteIsolatedSubscription(fixture);
    }
  });
});
