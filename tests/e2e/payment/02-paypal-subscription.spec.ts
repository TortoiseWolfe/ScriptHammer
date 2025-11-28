/**
 * Integration Test: Subscription Creation (PayPal) - T056
 * Tests PayPal recurring subscription flow
 */

import { test, expect } from '@playwright/test';

test.describe('PayPal Subscription Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/payment-demo');
  });

  test('should create PayPal subscription successfully', async ({ page }) => {
    // Step 1: Grant payment consent
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });
    if (await consentModal.isVisible()) {
      await page.getByRole('button', { name: /accept.*continue/i }).click();
      await expect(consentModal).not.toBeVisible();
    }

    // Step 2: Select PayPal as payment provider
    await page.getByRole('tab', { name: /paypal/i }).click();
    await expect(page.getByRole('tab', { name: /paypal/i })).toHaveClass(
      /tab-active/
    );

    // Step 3: Select subscription type
    await page.getByRole('radio', { name: /monthly|subscription/i }).check();

    // Step 4: Click Subscribe button
    const subscribeButton = page.getByRole('button', {
      name: /subscribe|pay/i,
    });
    await expect(subscribeButton).toBeEnabled();
    await subscribeButton.click();

    // Step 5: Wait for PayPal popup/redirect
    const paypalPage = await page.waitForEvent('popup', { timeout: 10000 });
    expect(paypalPage.url()).toContain('paypal.com');

    // Step 6: Log in to PayPal sandbox
    await paypalPage.fill('[name="login_email"]', 'sb-buyer@test.paypal.com');
    await paypalPage.getByRole('button', { name: /next/i }).click();
    await paypalPage.fill('[name="login_password"]', 'test1234');
    await paypalPage.getByRole('button', { name: /log.*in/i }).click();

    // Step 7: Approve subscription
    await paypalPage
      .getByRole('button', { name: /agree.*continue|subscribe/i })
      .click();

    // Step 8: Wait for redirect back to success page
    await page.waitForURL(/\/payment\/success/, { timeout: 15000 });
    expect(page.url()).toContain('/payment/success');

    // Step 9: Verify subscription created message
    await expect(
      page.getByRole('heading', { name: /subscription.*created|active/i })
    ).toBeVisible();

    // Step 10: Verify subscription details
    await expect(page.getByText(/monthly|recurring/i)).toBeVisible();
    await expect(page.getByText(/next.*billing/i)).toBeVisible();
  });

  test('should display subscription details correctly', async ({ page }) => {
    // Navigate to subscription manager after setup
    await page.goto('/payment/subscriptions');

    // Should show subscription card
    const subCard = page.getByRole('article', { name: /subscription/i });
    await expect(subCard).toBeVisible();

    // Should show provider (PayPal)
    await expect(subCard.getByText(/paypal/i)).toBeVisible();

    // Should show billing cycle
    await expect(subCard.getByText(/monthly|month/i)).toBeVisible();

    // Should show amount
    await expect(subCard.getByText(/\$\d+\.\d{2}/)).toBeVisible();

    // Should show next billing date
    await expect(subCard.getByText(/next.*billing/i)).toBeVisible();
  });

  test('should allow subscription cancellation', async ({ page }) => {
    await page.goto('/payment/subscriptions');

    // Click cancel button
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Confirm cancellation in modal
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /confirm|yes/i })
      .click();

    // Should show cancellation success
    await expect(
      page.getByText(/subscription.*cancel.*end.*period/i)
    ).toBeVisible({ timeout: 5000 });

    // Should update status badge
    await expect(page.getByText(/cancel.*period.*end/i)).toBeVisible();
  });

  test('should handle failed payment retry logic', async ({ page }) => {
    await page.goto('/payment/subscriptions');

    // Simulate failed payment (requires backend test data)
    // This would normally be set up via API or database seed

    // Should show past due badge
    await expect(page.getByText(/past.*due/i)).toBeVisible();

    // Should show update payment method button
    const updateButton = page.getByRole('button', {
      name: /update.*payment/i,
    });
    await expect(updateButton).toBeVisible();

    // Click update payment
    await updateButton.click();

    // Should redirect to PayPal for payment method update
    await page.waitForURL(/paypal\.com/, { timeout: 10000 });
  });

  test('should show grace period warning', async ({ page }) => {
    await page.goto('/payment/subscriptions');

    // Should show grace period alert (if subscription in grace period)
    const graceAlert = page.getByRole('alert', {
      name: /grace.*period|payment.*failed/i,
    });

    if (await graceAlert.isVisible()) {
      // Verify warning message
      await expect(graceAlert).toContainText(/update.*payment|renew/i);

      // Verify update button is present
      await expect(
        graceAlert.getByRole('button', { name: /update/i })
      ).toBeVisible();
    }
  });

  test('should prevent duplicate subscriptions', async ({ page }) => {
    // Try to create second subscription for same product
    await page.goto('/payment-demo');

    // Grant consent
    const consentModal = page.getByRole('dialog', {
      name: /payment consent/i,
    });
    if (await consentModal.isVisible()) {
      await page.getByRole('button', { name: /accept.*continue/i }).click();
    }

    // Select PayPal subscription
    await page.getByRole('tab', { name: /paypal/i }).click();
    await page.getByRole('radio', { name: /monthly|subscription/i }).check();

    // Try to subscribe
    await page.getByRole('button', { name: /subscribe/i }).click();

    // Should show error about existing subscription
    await expect(
      page.getByRole('alert', {
        name: /already.*subscribed|active.*subscription/i,
      })
    ).toBeVisible({ timeout: 5000 });
  });
});
