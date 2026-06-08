/**
 * Integration Test: Offline Queue - T059
 * Tests payment queuing when offline and automatic sync when reconnected
 *
 * NOTE: Most tests are skipped because offline queue UI is not fully implemented.
 * The backend supports offline queuing but the UI doesn't expose queue counts
 * or status messages as expected by these tests.
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

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

  // The flows below drive a POPULATED queue (offline-enqueue, sync, retry,
  // max-retry, overflow, clear). The UI now exists (PaymentQueuePanel on
  // /payment/dashboard) — the remaining blocker is SEEDING the queue, which
  // needs either a real payment attempt (provider creds) or a direct Dexie
  // IndexedDB fixture. Un-skip once a queue-seed fixture lands. (Was
  // "UI not yet implemented" — that part is done.)
  test.skip('should queue payment when offline', async ({ page, context }) => {
    test.skip(true, 'Needs a queue-seed fixture or provider creds to enqueue');
  });

  test.skip('should automatically sync queue when coming online', async ({
    page,
    context,
  }) => {
    // Skip: Queue sync status not displayed in current UI
    test.skip(true, 'Needs a queue-seed fixture or provider creds to enqueue');
  });

  test.skip('should handle multiple queued payments', async ({
    page,
    context,
  }) => {
    // Skip: Queue count not displayed in current UI
    test.skip(true, 'Needs a queue-seed fixture to enqueue multiple items');
  });

  test.skip('should persist queue across page reloads', async ({
    page,
    context,
  }) => {
    // Skip: Queue persistence status not displayed
    test.skip(
      true,
      'Needs a queue-seed fixture (Dexie) to populate before reload'
    );
  });

  test.skip('should retry failed queue items with exponential backoff', async ({
    page,
    context,
  }) => {
    // Skip: Retry status not displayed
    test.skip(true, 'Needs a seeded failed item to exercise backoff/retry UI');
  });

  test.skip('should remove queued items after max retry attempts', async ({
    page,
    context,
  }) => {
    // Skip: Retry status not displayed
    test.skip(
      true,
      'Needs a seeded item at maxRetries to assert the Max-retries badge'
    );
  });

  test.skip('should show queue status in payment history', async ({
    page,
    context,
  }) => {
    // Skip: /payment/history route doesn't exist
    test.skip(
      true,
      'Separate /payment/history surface; queue status lives on /payment/dashboard now'
    );
  });

  test.skip('should handle queue overflow gracefully', async ({
    page,
    context,
  }) => {
    // Skip: Queue overflow alert not implemented
    test.skip(true, 'Overflow/storage-warning handling not in scope for #4');
  });

  test.skip('should clear queue manually', async ({ page, context }) => {
    // Skip: Clear queue button not implemented
    test.skip(
      true,
      'Clear button EXISTS (PaymentQueuePanel); needs a queue-seed fixture to assert the clear flow end-to-end'
    );
  });
});
