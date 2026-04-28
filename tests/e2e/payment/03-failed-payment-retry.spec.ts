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

test.describe('Failed Payment Retry Logic', () => {
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

  test('should display offline error banner when offline', async ({
    page,
    context,
  }) => {
    // Navigate ONLINE first — the static-export build can't be loaded
    // without network in CI (no SW cache warmed for this URL). After the
    // page is up, flip offline; useOfflineStatus listens for the browser
    // 'offline' event and the banner re-renders.
    await page.goto('/payment-result?id=00000000-0000-0000-0000-000000000000');
    await dismissCookieBanner(page);
    await waitForAuthenticatedState(page);

    // Wait for the loaded/not-found render to settle so the banner is in
    // the DOM tree (it mounts inside the loaded + not-found branches).
    await page
      .getByText(
        /no payment session found|payment is still processing|payment result/i
      )
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 });

    await context.setOffline(true);
    try {
      // Banner has role="status" and the offline copy is the same one
      // exercised by the unit test. Polls because useOfflineStatus + the
      // banner's poll interval need a moment to converge after the flip.
      await expect(page.getByText(/you.?re offline/i)).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByText(/we.?ll process your payment/i)
      ).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
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
