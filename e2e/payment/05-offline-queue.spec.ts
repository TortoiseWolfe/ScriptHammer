/**
 * Integration Test: Offline Queue - T059
 * Tests payment queuing when offline and automatic sync when reconnected
 */

import { test, expect } from '@playwright/test';

test.describe('Offline Payment Queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/payment-demo');

    // Grant consent
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });
    if (await consentModal.isVisible()) {
      await page.getByRole('button', { name: /accept.*continue/i }).click();
    }
  });

  test('should queue payment when offline', async ({ page, context }) => {
    // Select payment method
    await page.getByRole('tab', { name: /stripe/i }).click();

    // Go offline
    await context.setOffline(true);

    // Try to initiate payment
    await page.getByRole('button', { name: /pay/i }).click();

    // Should show queued message
    await expect(
      page.getByRole('status', { name: /queued.*offline|saved.*later/i })
    ).toBeVisible({ timeout: 5000 });

    // Should show queued count
    await expect(page.getByText(/1.*payment.*queued/i)).toBeVisible();
  });

  test('should automatically sync queue when coming online', async ({
    page,
    context,
  }) => {
    // Go offline
    await context.setOffline(true);

    // Queue a payment
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    // Verify queued
    await expect(page.getByText(/queued.*offline/i)).toBeVisible({
      timeout: 5000,
    });

    // Go back online
    await context.setOffline(false);

    // Should show processing/syncing message
    await expect(
      page.getByText(/processing.*queue|syncing.*payments/i)
    ).toBeVisible({ timeout: 10000 });

    // Queue count should go to zero
    await expect(page.getByText(/0.*payment.*queued/i)).toBeVisible({
      timeout: 15000,
    });
  });

  test('should handle multiple queued payments', async ({ page, context }) => {
    // Go offline
    await context.setOffline(true);

    // Queue multiple payments
    for (let i = 0; i < 3; i++) {
      await page.getByRole('tab', { name: /stripe/i }).click();
      await page.getByRole('button', { name: /pay/i }).click();
      await page.waitForTimeout(500);
    }

    // Should show 3 queued payments
    await expect(page.getByText(/3.*payments.*queued/i)).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Should process all queued payments
    await expect(page.getByText(/processing.*3.*payments/i)).toBeVisible({
      timeout: 5000,
    });

    // Wait for queue to clear
    await expect(page.getByText(/0.*payment.*queued/i)).toBeVisible({
      timeout: 20000,
    });
  });

  test('should persist queue across page reloads', async ({
    page,
    context,
  }) => {
    // Go offline and queue payment
    await context.setOffline(true);
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    // Wait for queue confirmation
    await expect(page.getByText(/queued.*offline/i)).toBeVisible();

    // Reload page (still offline)
    await page.reload();

    // Queue should still show 1 payment
    await expect(page.getByText(/1.*payment.*queued/i)).toBeVisible();
  });

  test('should retry failed queue items with exponential backoff', async ({
    page,
    context,
  }) => {
    // Queue payment while offline
    await context.setOffline(true);
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    await expect(page.getByText(/queued/i)).toBeVisible();

    // Go online but simulate network error (close connection immediately)
    await context.setOffline(false);

    // Mock a failed API response
    await page.route('**/functions/v1/stripe-create-payment', (route) => {
      route.abort('failed');
    });

    // Should show retry message
    await expect(page.getByText(/retry.*failed|retrying/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should remove queued items after max retry attempts', async ({
    page,
    context,
  }) => {
    // Queue payment
    await context.setOffline(true);
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    // Go online
    await context.setOffline(false);

    // Mock continuous failures
    await page.route('**/functions/v1/**', (route) => {
      route.abort('failed');
    });

    // Wait for max retries (5 attempts)
    await page.waitForTimeout(30000);

    // Should show abandoned/removed message
    await expect(
      page.getByText(/failed.*attempts|removed.*queue|contact.*support/i)
    ).toBeVisible();

    // Queue count should be 0
    await expect(page.getByText(/0.*payment.*queued/i)).toBeVisible();
  });

  test('should show queue status in payment history', async ({
    page,
    context,
  }) => {
    // Queue a payment
    await context.setOffline(true);
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    // Navigate to payment history
    await page.goto('/payment/history');

    // Should show queued status
    await expect(
      page.getByRole('status', { name: /queued|pending/i })
    ).toBeVisible();

    // Should have indicator that it's offline
    await expect(page.getByText(/offline.*queue/i)).toBeVisible();
  });

  test('should handle queue overflow gracefully', async ({ page, context }) => {
    // Go offline
    await context.setOffline(true);

    // Try to queue many payments (more than allowed)
    for (let i = 0; i < 100; i++) {
      await page.getByRole('tab', { name: /stripe/i }).click();
      await page.getByRole('button', { name: /pay/i }).click();
      await page.waitForTimeout(100);
    }

    // Should show quota warning
    await expect(
      page.getByRole('alert', { name: /queue.*full|storage.*limit/i })
    ).toBeVisible();
  });

  test('should clear queue manually', async ({ page, context }) => {
    // Queue some payments
    await context.setOffline(true);
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    await expect(page.getByText(/1.*payment.*queued/i)).toBeVisible();

    // Find and click clear queue button
    const clearButton = page.getByRole('button', {
      name: /clear.*queue|remove.*queued/i,
    });
    await clearButton.click();

    // Confirm in modal
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /confirm|yes/i })
      .click();

    // Queue should be empty
    await expect(page.getByText(/0.*payment.*queued/i)).toBeVisible();
  });
});
