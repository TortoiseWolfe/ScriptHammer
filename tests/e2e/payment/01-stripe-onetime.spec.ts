/**
 * Integration Test: One-Time Payment (Stripe) - T055
 * Tests full Stripe checkout flow from payment button to success page
 */

import { test, expect } from '@playwright/test';

test.describe('Stripe One-Time Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to payment page
    await page.goto('/payment-demo');
  });

  test('should complete one-time payment successfully', async ({ page }) => {
    // Step 1: Grant payment consent
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });
    if (await consentModal.isVisible()) {
      await page.getByRole('button', { name: /accept.*continue/i }).click();
      await expect(consentModal).not.toBeVisible();
    }

    // Step 2: Select Stripe as payment provider
    await page.getByRole('tab', { name: /stripe/i }).click();
    await expect(page.getByRole('tab', { name: /stripe/i })).toHaveClass(
      /tab-active/
    );

    // Step 3: Click Pay button
    const payButton = page.getByRole('button', { name: /pay/i });
    await expect(payButton).toBeEnabled();
    await payButton.click();

    // Step 4: Wait for redirect to Stripe Checkout
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 10000 });
    expect(page.url()).toContain('checkout.stripe.com');

    // Step 5: Fill in Stripe test card (test mode)
    await page.fill('[name="cardNumber"]', '4242424242424242');
    await page.fill('[name="cardExpiry"]', '1234'); // 12/34
    await page.fill('[name="cardCvc"]', '123');
    await page.fill('[name="billingName"]', 'Test User');

    // Step 6: Submit payment
    await page.getByRole('button', { name: /pay/i }).click();

    // Step 7: Wait for redirect back to success page
    await page.waitForURL(/\/payment\/success/, { timeout: 15000 });
    expect(page.url()).toContain('/payment/success');

    // Step 8: Verify success message
    await expect(
      page.getByRole('heading', { name: /payment successful/i })
    ).toBeVisible();

    // Step 9: Verify payment status badge shows "PAID"
    await expect(page.getByText(/paid/i).first()).toBeVisible();

    // Step 10: Verify webhook verification indicator
    await expect(page.getByText(/webhook verified/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should handle payment cancellation gracefully', async ({ page }) => {
    // Grant consent
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });
    if (await consentModal.isVisible()) {
      await page.getByRole('button', { name: /accept.*continue/i }).click();
    }

    // Select Stripe and initiate payment
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    // Wait for Stripe Checkout
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 10000 });

    // Click cancel/back button
    await page.goBack();

    // Should redirect to cancel page
    await page.waitForURL(/\/payment\/cancel/);
    expect(page.url()).toContain('/payment/cancel');

    // Verify cancellation message
    await expect(
      page.getByRole('heading', { name: /payment.*cancel/i })
    ).toBeVisible();
  });

  test('should display error for declined card', async ({ page }) => {
    // Grant consent
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });
    if (await consentModal.isVisible()) {
      await page.getByRole('button', { name: /accept.*continue/i }).click();
    }

    // Select Stripe and initiate payment
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    // Wait for Stripe Checkout
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 10000 });

    // Use declined test card
    await page.fill('[name="cardNumber"]', '4000000000000002');
    await page.fill('[name="cardExpiry"]', '1234');
    await page.fill('[name="cardCvc"]', '123');
    await page.fill('[name="billingName"]', 'Test User');

    // Submit payment
    await page.getByRole('button', { name: /pay/i }).click();

    // Should show decline error on Stripe page
    await expect(page.getByText(/card.*declined|payment.*failed/i)).toBeVisible(
      { timeout: 5000 }
    );
  });

  test('should enforce payment consent requirement', async ({ page }) => {
    // Without granting consent, payment button should be disabled
    const payButton = page.getByRole('button', { name: /pay/i });

    // Should show consent warning
    await expect(
      page.getByRole('alert', { name: /payment consent required/i })
    ).toBeVisible();

    // Pay button should be disabled
    await expect(payButton).toBeDisabled();
  });

  test('should show offline queue indicator when offline', async ({
    page,
    context,
  }) => {
    // Grant consent first
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });
    if (await consentModal.isVisible()) {
      await page.getByRole('button', { name: /accept.*continue/i }).click();
    }

    // Go offline
    await context.setOffline(true);

    // Select Stripe
    await page.getByRole('tab', { name: /stripe/i }).click();

    // Click pay button
    await page.getByRole('button', { name: /pay/i }).click();

    // Should show queued message
    await expect(
      page.getByRole('status', { name: /queued offline/i })
    ).toBeVisible({ timeout: 3000 });

    // Go back online
    await context.setOffline(false);

    // Should process queued payments
    await expect(page.getByText(/processing.*queued|syncing/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
