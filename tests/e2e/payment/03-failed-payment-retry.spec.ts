/**
 * Integration Test: Failed Payment Retry - T057
 * Tests error handling UI and retry logic for failed payments
 *
 * The failed-payment surfaces are driven by seeded rows (a failed
 * payment_results row with error_code card_declined, plus the intent's
 * retry_count), so no real Stripe decline is needed.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  dismissCookieBanner,
  waitForAuthenticatedState,
  seedIsolatedSubscription,
  deleteIsolatedSubscription,
  openSubscriptionsAs,
  openAuthedPage,
  getAdminClient,
  seedIsolatedPayment,
  deleteIsolatedPayment,
  type IsolatedSubscription,
  type IsolatedPayment,
} from '../utils/test-user-factory';

/**
 * A user whose payment was declined: the seeded result is flipped to 'failed'
 * with a recoverable `card_declined`, and the parent intent carries the given
 * retry_count (what the recovery list and attempt counter read). Service-role
 * writes, so no real Stripe decline is needed. Throws rather than skipping.
 */
async function seedFailedPayment(retryCount: number): Promise<IsolatedPayment> {
  const fixture = await seedIsolatedPayment({ prefix: 'iso-fail' });
  const admin = getAdminClient();
  expect(fixture, 'seedIsolatedPayment returned null').not.toBeNull();
  expect(admin, 'admin client unavailable').not.toBeNull();
  const seeded = fixture!;

  const result = await admin!
    .from('payment_results')
    .update({
      status: 'failed',
      error_code: 'card_declined',
      error_message: 'Your card was declined.',
      webhook_verified: true,
    })
    .eq('id', seeded.resultId);
  expect(result.error).toBeNull();

  const intent = await admin!
    .from('payment_intents')
    .update({ retry_count: retryCount })
    .eq('id', seeded.intentId);
  expect(intent.error).toBeNull();
  return seeded;
}

async function openResult(page: Page, fixture: IsolatedPayment): Promise<void> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  await page.goto(`${basePath}/payment-result?id=${fixture.intentId}`, {
    waitUntil: 'domcontentloaded',
  });
  await dismissCookieBanner(page);
}

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

  test('should display offline error banner when offline', async ({ page }) => {
    // Navigate ONLINE first — the static-export build can't be loaded
    // without network in CI (no SW cache warmed for this URL). After the
    // page is up, synthesize the 'offline' browser event; useOfflineStatus
    // listens for it and the banner re-renders.
    //
    // Why dispatch instead of context.setOffline(true)? Playwright's
    // setOffline blocks request traffic but does NOT fire the 'offline'
    // event in Firefox/WebKit (Chromium does). Real browsers DO fire it
    // on real network drops — which is exactly what the hook listens for —
    // so synthesizing the event here mimics production behavior and works
    // cross-browser.
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

    // Override navigator.onLine + dispatch the offline event. The hook
    // reads navigator.onLine on its update path, so both must flip.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });
      window.dispatchEvent(new Event('offline'));
    });

    try {
      // Banner has role="status" and the offline copy is the same one
      // exercised by the unit test.
      await expect(page.getByText(/you.?re offline/i)).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByText(/we.?ll process your payment/i)
      ).toBeVisible();
    } finally {
      // Restore so subsequent tests don't see a stuck offline state.
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          get: () => true,
        });
        window.dispatchEvent(new Event('online'));
      });
    }
  });

  test('should offer + run a dunning retry for a past_due subscription', async ({
    browser,
  }) => {
    // Seed a past_due subscription, open the hub's Subscriptions tab, and click
    // "Retry payment now". The retry-subscription edge function (credentials-free
    // dunning) advances the retry_schedule and returns success, so the click
    // completes without an error alert. (The actual provider re-charge is a
    // creds-gated leg; the automatic dunning + webhook flip status to active.)
    let fixture: IsolatedSubscription | null = null;
    let opened: Awaited<ReturnType<typeof openSubscriptionsAs>> | null = null;
    try {
      fixture = await seedIsolatedSubscription('past_due', {
        provider: 'stripe',
      });
      test.skip(!fixture, 'Admin client unavailable to seed subscription');
      if (!fixture) return;

      opened = await openSubscriptionsAs(browser, fixture);
      const { page } = opened;

      const retryBtn = page.getByTestId(
        `retry-payment-${fixture.subscriptionId}`
      );
      await expect(retryBtn).toBeVisible({ timeout: 30000 });

      // Fail the test if the retry surfaces an error dialog (a real backend break).
      let dialogMessage: string | null = null;
      page.on('dialog', async (d) => {
        dialogMessage = d.message();
        await d.accept();
      });

      await retryBtn.click();
      // The button leaves its loading state once the edge fn responds.
      await expect(retryBtn).not.toContainText('Retrying', { timeout: 20000 });
      expect(
        dialogMessage,
        `retry surfaced an error: ${dialogMessage}`
      ).toBeNull();
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedSubscription(fixture);
    }
  });

  test('should mount SwitchProviderPanel when "Use a different payment method" is clicked', async ({
    browser,
  }) => {
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openAuthedPage>> | null = null;
    try {
      fixture = await seedFailedPayment(0);
      opened = await openAuthedPage(browser, fixture.session);
      const { page } = opened;
      await openResult(page, fixture);

      const toggle = page.getByRole('button', {
        name: 'Use a different payment method',
      });
      await expect(toggle).toBeVisible({ timeout: 30000 });
      await expect(page.locator('#switch-provider-panel')).toHaveCount(0);

      await toggle.click();

      const panel = page.locator('#switch-provider-panel');
      await expect(panel).toBeVisible();
      await expect(
        panel.getByRole('heading', { name: 'Use a different payment method' })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Cancel' })
      ).toHaveAttribute('aria-expanded', 'true');
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });

  test('should expand recovery list at retry_count >= 2', async ({
    browser,
  }) => {
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openAuthedPage>> | null = null;
    try {
      fixture = await seedFailedPayment(2);
      opened = await openAuthedPage(browser, fixture.session);
      const { page } = opened;
      await openResult(page, fixture);

      await expect(
        page.getByLabel('Attempt 3 of', { exact: false })
      ).toBeVisible({ timeout: 30000 });
      const help = page.locator('details', { hasText: 'Need more help?' });
      await expect(help).toHaveAttribute('open', '');
      await expect(help.getByRole('listitem')).toHaveCount(3);
      await expect(
        help.getByRole('link', { name: 'Contact support' })
      ).toBeVisible();
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
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
