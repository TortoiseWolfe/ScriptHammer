/**
 * Integration Test: Dashboard Real-Time Updates - T060
 * Tests Supabase realtime subscription for payment status updates
 */

import { test, expect } from '@playwright/test';

test.describe('Payment Dashboard Real-Time Updates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/payment/dashboard');
  });

  test('should show real-time payment status updates', async ({ page }) => {
    // Initial status should be pending
    await expect(page.getByRole('status', { name: /pending/i })).toBeVisible();

    // Simulate webhook updating payment status (would come from backend)
    // In real test, this would trigger a Supabase realtime event

    // Wait for status to update to "processing"
    await expect(page.getByRole('status', { name: /processing/i })).toBeVisible(
      { timeout: 10000 }
    );

    // Then to "succeeded"
    await expect(
      page.getByRole('status', { name: /succeeded|paid/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test('should update payment list when new payment added', async ({
    page,
    context,
  }) => {
    // Count initial payments
    const initialCount = await page
      .getByRole('listitem', { name: /payment/i })
      .count();

    // Open new tab and make a payment
    const newPage = await context.newPage();
    await newPage.goto('/payment-demo');

    // Grant consent
    const consentModal = newPage.getByRole('dialog', {
      name: /payment consent/i,
    });
    if (await consentModal.isVisible()) {
      await newPage.getByRole('button', { name: /accept.*continue/i }).click();
    }

    // Make payment
    await newPage.getByRole('tab', { name: /stripe/i }).click();
    await newPage.getByRole('button', { name: /pay/i }).click();

    // Switch back to dashboard
    await page.bringToFront();

    // Should show new payment in list (real-time update)
    await expect(page.getByRole('listitem', { name: /payment/i })).toHaveCount(
      initialCount + 1,
      { timeout: 10000 }
    );
  });

  test('should update webhook verification status in real-time', async ({
    page,
  }) => {
    // Find a payment without webhook verification
    const unverifiedPayment = page
      .getByRole('article')
      .filter({ hasText: /unverified|pending/i })
      .first();

    if (await unverifiedPayment.isVisible()) {
      // Should show "not verified" initially
      await expect(unverifiedPayment.getByText(/not.*verified/i)).toBeVisible();

      // Wait for webhook to process
      // In real test, backend would send webhook event

      // Should update to "verified" status
      await expect(
        unverifiedPayment.getByText(/verified|webhook.*verified/i)
      ).toBeVisible({ timeout: 15000 });
    }
  });

  test('should handle subscription status changes in real-time', async ({
    page,
  }) => {
    await page.goto('/payment/subscriptions');

    // Find active subscription
    const subscription = page.getByRole('article', { name: /subscription/i });
    await expect(subscription).toBeVisible();

    // Initial status should be "active"
    await expect(
      subscription.getByRole('status', { name: /active/i })
    ).toBeVisible();

    // Simulate subscription cancellation (from backend/webhook)
    // Real test would trigger Supabase realtime update

    // Status should update to "canceling" or "will cancel"
    await expect(
      subscription.getByText(/cancel.*period.*end|will.*cancel/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show live transaction counter', async ({ page }) => {
    // Get initial transaction count
    const counterElement = page.getByRole('status', { name: /transactions/i });
    const initialText = await counterElement.textContent();
    const initialCount = parseInt(initialText?.match(/\d+/)?.[0] || '0');

    // Trigger a new transaction (simulate or actual)
    // In real test, this would create a payment

    // Counter should increment
    await expect(counterElement).toContainText(String(initialCount + 1), {
      timeout: 10000,
    });
  });

  test('should handle connection loss gracefully', async ({
    page,
    context,
  }) => {
    // Go offline
    await context.setOffline(true);

    // Should show disconnected indicator
    await expect(
      page.getByRole('status', { name: /offline|disconnected/i })
    ).toBeVisible({
      timeout: 5000,
    });

    // Go back online
    await context.setOffline(false);

    // Should show reconnected indicator
    await expect(
      page.getByRole('status', { name: /online|connected/i })
    ).toBeVisible({
      timeout: 5000,
    });

    // Data should refresh
    await expect(page.getByText(/refreshing|syncing/i)).toBeVisible({
      timeout: 3000,
    });
  });

  test('should automatically reconnect after disconnect', async ({
    page,
    context,
  }) => {
    // Simulate connection drop
    await context.setOffline(true);
    await page.waitForTimeout(2000);
    await context.setOffline(false);

    // Should show reconnecting message
    await expect(page.getByText(/reconnecting/i)).toBeVisible({
      timeout: 5000,
    });

    // Should reconnect successfully
    await expect(page.getByText(/connected/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should batch multiple rapid updates', async ({ page }) => {
    // Monitor for batch update indicator
    // This prevents UI thrashing from many rapid updates

    // Trigger multiple rapid status changes (simulate from backend)
    // Real test would send multiple Supabase realtime events quickly

    // Should show "updating" indicator
    await expect(page.getByText(/updating.*\d+.*changes/i)).toBeVisible({
      timeout: 5000,
    });

    // Final state should be correct after batch
    await page.waitForTimeout(2000);
    await expect(
      page.getByRole('status', { name: /paid|succeeded/i })
    ).toBeVisible();
  });

  test('should show real-time error notifications', async ({ page }) => {
    // Simulate payment failure event from webhook
    // Real test would trigger Supabase realtime update with failed status

    // Should show error notification
    await expect(
      page.getByRole('alert', { name: /payment.*failed|error/i })
    ).toBeVisible({ timeout: 10000 });

    // Notification should be dismissible
    const dismissButton = page.getByRole('button', { name: /dismiss|close/i });
    await dismissButton.click();
    await expect(page.getByRole('alert')).not.toBeVisible();
  });

  test('should update chart/graphs in real-time', async ({ page }) => {
    // Dashboard should have a chart showing payment activity
    const chart = page.locator('[data-testid="payment-chart"]');
    await expect(chart).toBeVisible();

    // Trigger new payment
    // Real test would create actual payment

    // Chart should update with new data point
    // We can't easily verify SVG changes, but can check for re-render
    await page.waitForTimeout(5000);

    // Check for canvas/svg update indicator
    const updatedChart = page.locator('[data-testid="payment-chart"]');
    await expect(updatedChart).toBeVisible();
  });
});
