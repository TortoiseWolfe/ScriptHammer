/**
 * Integration Test: Dashboard Real-Time Updates - T060
 * Tests Supabase realtime subscription for payment status updates
 *
 * NOTE: Most tests are skipped because:
 * 1. /payment/dashboard route doesn't exist (only /payment-demo)
 * 2. Real-time status updates require actual payment processing
 * 3. Tests assume UI elements that aren't implemented
 */

import { test, expect, type Page } from '@playwright/test';
import {
  dismissCookieBanner,
  getAdminClient,
  seedIsolatedPayment,
  deleteIsolatedPayment,
  openPaymentHubAs,
  seedIsolatedSubscription,
  deleteIsolatedSubscription,
  openSubscriptionsAs,
  type IsolatedPayment,
  type IsolatedSubscription,
} from '../utils/test-user-factory';

/**
 * Wait for the realtime channel to be JOINED before driving it (#497).
 *
 * `subscribe()` returning is not the same as the channel being joined, and the
 * initial list rendering is not evidence of either — it comes from a plain REST
 * fetch. Inserting before the join publishes the event to nobody, and the
 * failure then reads as "the count never advanced", which is indistinguishable
 * from realtime being genuinely broken. It cost two red `main` runs to tell
 * those apart by hand.
 *
 * With this guard the two causes name themselves: a timeout HERE means the
 * channel never joined (the shared backend was saturated — 28 shards open
 * channels against one free-tier project), and a timeout on the count assertion
 * that follows means the channel was live and the event did not arrive.
 *
 * The join latency is recorded as an annotation so the next occurrence has a
 * number instead of a guess.
 */
async function waitForRealtimeLive(
  page: Page,
  testId: 'realtime-status' | 'subscription-realtime-status' = 'realtime-status'
): Promise<void> {
  const startedAt = Date.now();
  await expect(page.getByTestId(testId)).toHaveText(/Live/i, {
    timeout: 30000,
  });
  const ms = Date.now() - startedAt;
  // Both, deliberately. The annotation reaches the HTML/blob report; the
  // console line reaches the JOB LOG, which is the only one of the two a
  // person reads six hours later while working out whether main went red for
  // a real reason. The `list` reporter does not print annotations for passing
  // tests, so annotation-only would have been a number nobody could see —
  // and a trend nobody could spot. Rising joins across green runs are the
  // evidence that would justify priming a realtime channel the way
  // `e2e.yml` already primes the REST pool.
  console.log(`[realtime-join] ${testId} reached Live in ${ms}ms`);
  test.info().annotations.push({
    type: 'realtime-join',
    description: `${testId} reached Live in ${ms}ms`,
  });
}

test.describe('Payment Dashboard Real-Time Updates', () => {
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

  test('should load payment demo page', async ({ page }) => {
    // Basic test - verify page loads
    await expect(
      page.getByRole('heading', { name: /Payment Integration Demo/i })
    ).toBeVisible();
  });

  test('should show payment history section after consent', async ({
    page,
  }) => {
    // Grant consent
    await page.getByRole('button', { name: /Accept/i }).click();

    // Wait for Step 2 and Step 4 (Payment History) to appear
    await expect(page.getByRole('heading', { name: /Step 4/i })).toBeVisible({
      timeout: 5000,
    });

    // ANCHOR ON "Step 4" — a bare /Payment History/i matches TWO headings and is a
    // latent strict-mode violation, not a flake. `payment-demo/page.tsx:299` renders
    // `<h2>Step 4: Payment History</h2>`, and `PaymentHistory.tsx:315` renders its own
    // `<h2>Payment History</h2>` once the fetch resolves. Slow fetch => one match and
    // green; fast fetch => two and a failure. It surfaced against local Supabase
    // (#575 parity) purely because it is quicker, and would have started failing on
    // cloud too. `PaymentHubContent.tsx:148` documents the same collision biting once
    // before. Same anchor as `security/payment-isolation.spec.ts:102`.
    await expect(
      page.getByRole('heading', { name: /Step 4.*Payment History/i })
    ).toBeVisible();
  });

  test.skip('should show real-time payment status updates', async ({
    page,
  }) => {
    // Skip: Requires actual payment processing and real-time updates
    test.skip(
      true,
      'Real-time payment status updates require actual Stripe integration'
    );
  });

  test('should update payment list when new payment added', async ({
    browser,
  }) => {
    // Seed a throwaway user with one payment, open the hub Overview tab AS them,
    // then service-role insert a SECOND payment and assert the list grows live
    // (realtime → 1s debounce → refetch). No provider/creds needed.
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openPaymentHubAs>> | null = null;
    try {
      fixture = await seedIsolatedPayment();
      test.skip(!fixture, 'Admin client unavailable to seed payment');
      if (!fixture) return;

      opened = await openPaymentHubAs(browser, fixture.session);
      const { page } = opened;
      const count = page.getByTestId('transaction-count');
      await expect(count).toContainText('1 total', { timeout: 30000 });
      await waitForRealtimeLive(page);

      await fixture.addResult(); // live insert
      await expect(count).toContainText('2 total', { timeout: 15000 });
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });

  test.skip('should update webhook verification status in real-time', async ({
    page,
  }) => {
    // Skip: Requires actual webhook processing
    test.skip(true, 'Webhook verification requires actual Stripe webhooks');
  });

  test('should handle subscription status changes in real-time', async ({
    browser,
  }) => {
    // Seed an active subscription, open the hub Subscriptions tab AS that user,
    // then service-role UPDATE the row to grace_period and assert the badge
    // flips live (useSubscriptionsRealtime → refetch).
    let fixture: IsolatedSubscription | null = null;
    let opened: Awaited<ReturnType<typeof openSubscriptionsAs>> | null = null;
    try {
      fixture = await seedIsolatedSubscription('active', {
        provider: 'stripe',
      });
      const admin = getAdminClient();
      test.skip(!fixture || !admin, 'Admin client unavailable to seed');
      if (!fixture || !admin) return;

      opened = await openSubscriptionsAs(browser, fixture);
      const { page } = opened;
      await expect(page.getByText(/Active/i).first()).toBeVisible({
        timeout: 30000,
      });
      await waitForRealtimeLive(page, 'subscription-realtime-status');

      // Flip status server-side; the realtime subscription should refetch.
      const graceExpires = fixture.gracePeriodExpires ?? '2099-01-01';
      await admin
        .from('subscriptions')
        .update({ status: 'grace_period', grace_period_expires: graceExpires })
        .eq('id', fixture.subscriptionId);

      await expect(page.getByText(/Grace Period/i).first()).toBeVisible({
        timeout: 15000,
      });
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedSubscription(fixture);
    }
  });

  test('should show live transaction counter', async ({ browser }) => {
    // The hub's PaymentHistory shows a `transaction-count` badge + a
    // `realtime-status` indicator. Seed a payment, open the hub, assert the
    // counter reads 1 and the realtime status reaches "Live".
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openPaymentHubAs>> | null = null;
    try {
      fixture = await seedIsolatedPayment();
      test.skip(!fixture, 'Admin client unavailable to seed payment');
      if (!fixture) return;

      opened = await openPaymentHubAs(browser, fixture.session);
      const { page } = opened;
      await expect(page.getByTestId('transaction-count')).toContainText(
        '1 total',
        { timeout: 30000 }
      );
      await expect(page.getByTestId('realtime-status')).toHaveText(/Live/i, {
        timeout: 30000,
      });
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });

  test('should show a realtime connection-status indicator', async ({
    browser,
  }) => {
    // The hub surfaces the channel connection state via a `realtime-status`
    // badge. Assert it renders and reaches "Live" on a healthy connection.
    // (Simulating a true mid-session channel drop is out of scope; the badge is
    // the affordance a reconnection/offline UI would build on.)
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openPaymentHubAs>> | null = null;
    try {
      fixture = await seedIsolatedPayment();
      test.skip(!fixture, 'Admin client unavailable to seed payment');
      if (!fixture) return;

      opened = await openPaymentHubAs(browser, fixture.session);
      const status = opened.page.getByTestId('realtime-status');
      await expect(status).toBeVisible({ timeout: 30000 });
      await expect(status).toHaveText(/Live/i, { timeout: 30000 });
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });

  // The reconnection state machine (live → 'reconnecting' on a drop AFTER being
  // live → 'live' + refetch on recovery) is DETERMINISTICALLY unit-tested in
  // src/hooks/usePaymentResultsRealtime.test.ts and useSubscriptionsRealtime.test.ts
  // (drives the exact SUBSCRIBED / CHANNEL_ERROR / SUBSCRIBED callback sequence).
  // We intentionally do NOT drive it via E2E: `context.setOffline(true)` does not
  // deterministically make Supabase's realtime WebSocket emit CHANNEL_ERROR/
  // TIMED_OUT within a test-friendly window (it depends on the phoenix-socket
  // heartbeat timeout, which is long and variable) — an E2E assertion here flakes.
  // The "Live" indicator itself is covered by the connection-status test above;
  // the transient "Reconnecting…" badge is the same badge map, exercised in unit.
  test.skip('should show "Reconnecting…" on a channel drop (unit-covered)', async () => {
    test.skip(
      true,
      'Reconnect state machine is deterministically unit-tested; a real WS drop is not deterministic in E2E'
    );
  });

  test('should coalesce a burst of updates into an "N updates" indicator', async ({
    browser,
  }) => {
    // Insert several payment_results rows near-simultaneously; the realtime
    // channel fires a burst of events that the hook coalesces (1s debounce) into
    // ONE refetch + a "N updates" pill. No provider/creds needed.
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openPaymentHubAs>> | null = null;
    try {
      fixture = await seedIsolatedPayment();
      test.skip(!fixture, 'Admin client unavailable to seed payment');
      if (!fixture) return;

      opened = await openPaymentHubAs(browser, fixture.session);
      const { page } = opened;
      await expect(page.getByTestId('transaction-count')).toContainText(
        '1 total',
        { timeout: 30000 }
      );
      await waitForRealtimeLive(page);

      // Burst: 3 inserts within the debounce window → one coalesced batch.
      await Promise.all([
        fixture.addResult(),
        fixture.addResult(),
        fixture.addResult(),
      ]);

      // The batch pill shows a count > 1 (exact number depends on how many of
      // the burst land in one debounce window — assert the pill with a
      // multi-update count, and that the list grew).
      await expect(page.getByTestId('batch-update-count')).toContainText(
        /\d+ updates/,
        { timeout: 15000 }
      );
      await expect(page.getByTestId('transaction-count')).toContainText(
        '4 total',
        { timeout: 15000 }
      );
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });

  test('should surface an error alert when a realtime payment fails', async ({
    browser,
  }) => {
    // Seed a payment, open the hub, then service-role insert a FAILED
    // payment_results row. The realtime onEvent handler sees status='failed' and
    // PaymentHistory shows a transient error alert. Deterministic — no creds.
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openPaymentHubAs>> | null = null;
    try {
      fixture = await seedIsolatedPayment();
      test.skip(!fixture, 'Admin client unavailable to seed payment');
      if (!fixture) return;

      opened = await openPaymentHubAs(browser, fixture.session);
      const { page } = opened;
      await expect(page.getByTestId('transaction-count')).toContainText(
        '1 total',
        { timeout: 30000 }
      );
      await waitForRealtimeLive(page);

      await fixture.addResult('failed'); // live insert of a failed payment

      await expect(page.getByTestId('realtime-error-alert')).toBeVisible({
        timeout: 15000,
      });
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });

  test("should render a payment trend chart from the user's payments", async ({
    browser,
  }) => {
    // Seed a payment, open the hub — the user-scoped trend chart aggregates the
    // fetched payments into a daily series and renders. Deterministic.
    let fixture: IsolatedPayment | null = null;
    let opened: Awaited<ReturnType<typeof openPaymentHubAs>> | null = null;
    try {
      fixture = await seedIsolatedPayment();
      test.skip(!fixture, 'Admin client unavailable to seed payment');
      if (!fixture) return;

      opened = await openPaymentHubAs(browser, fixture.session);
      const { page } = opened;
      await expect(page.getByTestId('transaction-count')).toContainText(
        '1 total',
        { timeout: 30000 }
      );
      // The trend chart (SVG) renders from the aggregated daily series.
      await expect(page.getByTestId('payment-trend-chart')).toBeVisible({
        timeout: 15000,
      });
    } finally {
      if (opened) await opened.close();
      await deleteIsolatedPayment(fixture);
    }
  });
});
