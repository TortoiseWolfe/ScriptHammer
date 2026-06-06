/**
 * Integration Test: Subscription Creation (PayPal) - T056
 * Tests PayPal payment UI components
 *
 * NOTE: Tests that require actual PayPal Checkout redirect are skipped
 * because CI does not have PayPal API keys configured.
 * These tests should be run locally with PayPal sandbox credentials for full coverage.
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

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

  // The flows below assert behavior against a SEEDED subscription row (cancel,
  // grace-period countdown, duplicate-prevention). They need the per-test
  // subscription-seeding fixture (service-role insert + cleanup) which isn't
  // wired yet — the route + grace UI + 23505 guard themselves are covered by
  // SubscriptionManager.test.tsx and the migration. Un-skip once seeding lands.
  test.skip('should allow subscription cancellation', async ({ page }) => {
    test.skip(
      true,
      'Needs a seeded subscription row (per-test fixture) to drive cancel'
    );
  });

  test.skip('should handle failed payment retry logic', async ({ page }) => {
    test.skip(true, 'Needs a seeded past_due/grace row + PayPal sandbox keys');
  });

  test.skip('should show grace period warning', async ({ page }) => {
    // Covered as a component test in SubscriptionManager.test.tsx; an E2E here
    // needs a seeded grace_period row.
    test.skip(true, 'Needs a seeded grace_period subscription row');
  });

  test.skip('should prevent duplicate subscriptions', async ({ page }) => {
    // The DB-level guard (idx_subscriptions_one_live_per_user) + webhook 23505
    // catch enforce this server-side; a browser E2E needs a seeded live row.
    test.skip(
      true,
      'Needs a seeded live subscription row to trigger the guard'
    );
  });
});
