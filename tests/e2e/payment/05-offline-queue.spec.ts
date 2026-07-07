/**
 * Integration Test: Offline Queue - T059
 * Tests payment queuing when offline and automatic sync when reconnected.
 *
 * The offline-queue UI (PaymentQueuePanel on the /payment hub) is shipped, and
 * the queue is a client-side Dexie store we can seed directly via
 * seedPaymentQueue() — so the populated-queue flows below drive real queue rows
 * and assert the panel's rendered state (count, per-item retry badge,
 * online/offline, clear). No payment provider / creds needed. The panel only
 * mounts when a provider is configured; CI sets dummy Stripe/PayPal keys so it
 * renders (see e2e.yml), locally it may be hidden — every test guards on
 * panel.count() the way the "#4" render test does.
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  dismissCookieBanner,
  seedPaymentQueue,
  clearPaymentQueue,
} from '../utils/test-user-factory';

test.describe('Offline Payment Queue', () => {
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

  test('should show payment demo page', async ({ page }) => {
    // Basic test - verify page loads
    await expect(
      page.getByRole('heading', { name: /Payment Integration Demo/i })
    ).toBeVisible();
  });

  test('should grant consent successfully', async ({ page }) => {
    // Grant consent
    const gdprHeading = page.getByRole('heading', { name: /GDPR Consent/i });
    await expect(gdprHeading).toBeVisible();

    await page.getByRole('button', { name: /Accept/i }).click();

    // Step 2 should appear
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test('queue management UI renders on the payment hub (#4)', async ({
    page,
  }) => {
    // The offline-queue management UI now exists (#4): PaymentQueuePanel on the
    // payment hub's Overview tab (/payment). With an empty queue the test user
    // sees the empty state + disabled controls; this asserts the panel + its
    // affordances are wired (no payment provider/creds needed — queue is client-side).
    await page.goto('/payment', { waitUntil: 'networkidle' });
    if (page.url().includes('/sign-in')) {
      await page.waitForTimeout(3000);
      await page.goto('/payment', { waitUntil: 'networkidle' });
    }
    await dismissCookieBanner(page);

    // The panel only renders when a provider is configured (the queue itself
    // works regardless). When unconfigured, assert the page at least loads.
    const panel = page.getByTestId('payment-queue-panel');
    if (await panel.count()) {
      await expect(panel).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('queue-count')).toBeVisible();
      // Empty queue → retry + clear are present but disabled.
      await expect(page.getByTestId('queue-retry')).toBeDisabled();
      await expect(page.getByTestId('queue-clear')).toBeDisabled();
    } else {
      await expect(
        page.getByRole('heading', { name: 'Payments', level: 1 })
      ).toBeVisible({ timeout: 30000 });
    }
  });

  // ── Populated-queue flows ────────────────────────────────────────────────
  // Open the /payment hub and return the PaymentQueuePanel locator, or null when
  // the panel isn't rendered (no provider configured — the queue is client-side
  // and seedable regardless, but the panel is what these tests assert against).
  async function openHubPanel(page: Page) {
    await page.goto('/payment', { waitUntil: 'networkidle' });
    if (page.url().includes('/sign-in')) {
      await page.waitForTimeout(3000);
      await page.goto('/payment', { waitUntil: 'networkidle' });
    }
    await dismissCookieBanner(page);
    const panel = page.getByTestId('payment-queue-panel');
    return (await panel.count()) ? panel : null;
  }

  test('should show queued items and the Offline badge when offline', async ({
    page,
    context,
  }) => {
    const panel = await openHubPanel(page);
    test.skip(
      !panel,
      'PaymentQueuePanel not rendered (no provider configured)'
    );

    // Seed + render the queue while ONLINE (reloading offline errors with
    // ERR_INTERNET_DISCONNECTED). IndexedDB rows persist across the offline
    // toggle, and the panel polls getQueue() every 5s, so once we go offline
    // the panel shows the queued item AND flips the badge to "Offline".
    await seedPaymentQueue(page, [{ type: 'payment_intent' }]);
    await page.reload({ waitUntil: 'networkidle' });
    await dismissCookieBanner(page);
    await expect(page.getByTestId('queue-count')).toContainText('1 pending', {
      timeout: 15000,
    });

    await context.setOffline(true);
    // setOffline() drops the network at the CDP layer but does NOT reliably
    // flip navigator.onLine / fire the `offline` DOM event in Firefox/WebKit
    // (only Chromium honors it for the JS API). useOfflineStatus listens for
    // the `offline` window event, so dispatch it explicitly for cross-browser
    // determinism (same rationale as the WebKit scroll-event dispatch in
    // CLAUDE.md).
    await page.evaluate(() =>
      window.dispatchEvent(new Event('offline', { bubbles: true }))
    );
    await expect(page.getByTestId('queue-conn-state')).toHaveText(/Offline/i, {
      timeout: 15000,
    });
    // The queued item remains listed while offline.
    await expect(page.getByTestId('queue-items').locator('li')).toHaveCount(1);

    await context.setOffline(false);
    await page.evaluate(() =>
      window.dispatchEvent(new Event('online', { bubbles: true }))
    );
    await clearPaymentQueue(page);
  });

  test('should handle multiple queued payments', async ({ page }) => {
    const panel = await openHubPanel(page);
    test.skip(
      !panel,
      'PaymentQueuePanel not rendered (no provider configured)'
    );

    await seedPaymentQueue(page, [
      { type: 'payment_intent' },
      { type: 'payment_intent' },
      { type: 'subscription_update' },
    ]);
    await page.reload({ waitUntil: 'networkidle' });
    await dismissCookieBanner(page);

    await expect(page.getByTestId('queue-count')).toContainText('3 pending', {
      timeout: 15000,
    });
    await expect(page.getByTestId('queue-items').locator('li')).toHaveCount(3);
    await clearPaymentQueue(page);
  });

  test('should persist queue across page reloads', async ({ page }) => {
    const panel = await openHubPanel(page);
    test.skip(
      !panel,
      'PaymentQueuePanel not rendered (no provider configured)'
    );

    await seedPaymentQueue(page, [
      { type: 'payment_intent' },
      { type: 'payment_intent' },
    ]);
    // IndexedDB survives navigation by nature; the panel re-reads it on mount.
    await page.reload({ waitUntil: 'networkidle' });
    await dismissCookieBanner(page);

    await expect(page.getByTestId('queue-items').locator('li')).toHaveCount(2, {
      timeout: 15000,
    });
    await clearPaymentQueue(page);
  });

  test('should show retry count on queued items', async ({ page }) => {
    const panel = await openHubPanel(page);
    test.skip(
      !panel,
      'PaymentQueuePanel not rendered (no provider configured)'
    );

    // A pending item that has already failed twice renders "Attempt 2/5". We
    // assert the DISPLAYED retry count/error, not wall-clock backoff timing
    // (which is flaky in E2E — the backoff logic itself is unit-tested).
    await seedPaymentQueue(page, [
      { type: 'payment_intent', retries: 2, lastError: 'network error' },
    ]);
    await page.reload({ waitUntil: 'networkidle' });
    await dismissCookieBanner(page);

    const item = page.getByTestId('queue-items').locator('li').first();
    await expect(item).toContainText('Attempt 2/5', { timeout: 15000 });
    await expect(item).toContainText('network error');
    await clearPaymentQueue(page);
  });

  test('should show Max-retries badge after max attempts', async ({ page }) => {
    const panel = await openHubPanel(page);
    test.skip(
      !panel,
      'PaymentQueuePanel not rendered (no provider configured)'
    );

    // retries >= maxRetries(5) → the panel shows a "Max retries" badge-error.
    await seedPaymentQueue(page, [
      { type: 'payment_intent', status: 'failed', retries: 5 },
    ]);
    await page.reload({ waitUntil: 'networkidle' });
    await dismissCookieBanner(page);

    const badge = page.getByTestId('queue-items').locator('li .badge').first();
    await expect(badge).toHaveText(/Max retries/i, { timeout: 15000 });
    await expect(badge).toHaveClass(/badge-error/);
    await clearPaymentQueue(page);
  });

  // KEEP-AS-MARKER: draining the queue via "Retry now" runs the REAL sync
  // (paymentQueue.sync → provider charge → Supabase upsert). Against the dummy
  // provider keys CI uses, the charge can't complete, so the item stays pending
  // — the panel only empties with a live provider/backend. Asserting the drain
  // needs real Stripe/PayPal sandbox creds, so this stays a documented skip.
  // (The retry button's presence/enablement is covered by the "#4" render test;
  // the sync/backoff LOGIC is covered by base-queue unit tests.)
  test.skip('should drain the queue on Retry (needs live provider)', async ({
    page,
  }) => {
    test.skip(
      true,
      'Retry runs a real provider charge — needs live Stripe/PayPal sandbox creds'
    );
  });

  test('should clear the queue manually', async ({ page }) => {
    const panel = await openHubPanel(page);
    test.skip(
      !panel,
      'PaymentQueuePanel not rendered (no provider configured)'
    );

    await seedPaymentQueue(page, [
      { type: 'payment_intent' },
      { type: 'payment_intent' },
    ]);
    await page.reload({ waitUntil: 'networkidle' });
    await dismissCookieBanner(page);
    await expect(page.getByTestId('queue-items').locator('li')).toHaveCount(2, {
      timeout: 15000,
    });

    await page.getByTestId('queue-clear').click();
    await page.getByTestId('queue-clear-confirm-yes').click();
    await expect(page.getByTestId('queue-count')).toContainText(
      'No queued payments',
      { timeout: 15000 }
    );
    await clearPaymentQueue(page);
  });

  test('should warn when device storage is near quota', async ({ page }) => {
    // Force navigator.storage.estimate() to report 90% usage so the panel's
    // storage-quota warning (estimateStorage → warning at ≥80%) renders. This
    // must be installed BEFORE the app reads storage on mount — inject then
    // reload so the override is present when PaymentQueuePanel polls.
    //
    // WebKit does NOT implement StorageManager.estimate(), and navigator.storage
    // may be absent or its members non-writable — a plain `navigator.storage.
    // estimate = …` assignment silently no-ops there (the cause of the webkit-gen
    // failure). Define the whole `storage` object via Object.defineProperty so
    // the mock lands cross-browser.
    await page.addInitScript(() => {
      const mockStorage = {
        estimate: async () => ({ usage: 9_000_000, quota: 10_000_000 }),
      };
      try {
        Object.defineProperty(navigator, 'storage', {
          configurable: true,
          get: () => mockStorage,
        });
      } catch {
        // If navigator.storage is non-configurable, fall back to patching
        // estimate directly (works in Chromium/Firefox where it exists).
        try {
          (navigator.storage as unknown as { estimate: unknown }).estimate =
            mockStorage.estimate;
        } catch {
          /* nothing more we can do; the test will skip via the assertion */
        }
      }
    });

    const panel = await openHubPanel(page);
    test.skip(
      !panel,
      'PaymentQueuePanel not rendered (no provider configured)'
    );

    // Seed an item so the queue is non-empty (realistic near-full scenario).
    await seedPaymentQueue(page, [{ type: 'payment_intent' }]);
    await page.reload({ waitUntil: 'networkidle' });
    await dismissCookieBanner(page);

    // The near-quota warning appears (panel re-estimates on each 5s poll).
    await expect(page.getByTestId('queue-storage-warning')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId('queue-storage-warning')).toContainText(
      /storage is almost full/i
    );
    await clearPaymentQueue(page);
  });
});
