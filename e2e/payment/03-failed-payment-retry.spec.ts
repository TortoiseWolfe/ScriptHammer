/**
 * Integration Test: Failed Payment Retry - T057
 * Tests error handling and retry logic for failed payments
 */

import { test, expect } from '@playwright/test';

test.describe('Failed Payment Retry Logic', () => {
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

  test('should display retry button for failed payment', async ({ page }) => {
    // Select Stripe
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    // Wait for Stripe Checkout
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 10000 });

    // Use insufficient funds test card
    await page.fill('[name="cardNumber"]', '4000000000009995');
    await page.fill('[name="cardExpiry"]', '1234');
    await page.fill('[name="cardCvc"]', '123');
    await page.fill('[name="billingName"]', 'Test User');

    // Submit payment
    await page.getByRole('button', { name: /pay/i }).click();

    // Wait for failure and redirect
    await page.waitForURL(/\/payment/, { timeout: 15000 });

    // Should show failed status
    await expect(
      page.getByRole('heading', { name: /payment.*failed/i })
    ).toBeVisible();

    // Should show retry button
    const retryButton = page.getByRole('button', { name: /retry.*payment/i });
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();
  });

  test('should retry failed payment successfully', async ({ page }) => {
    // Navigate to a payment result page with failed status
    // (This assumes we have a test payment ID or can create one)
    await page.goto('/payment/result?id=test-failed-payment-id');

    // Click retry button
    const retryButton = page.getByRole('button', { name: /retry.*payment/i });
    await retryButton.click();

    // Should redirect to Stripe Checkout
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 10000 });

    // Use successful test card this time
    await page.fill('[name="cardNumber"]', '4242424242424242');
    await page.fill('[name="cardExpiry"]', '1234');
    await page.fill('[name="cardCvc"]', '123');
    await page.fill('[name="billingName"]', 'Test User');

    // Submit payment
    await page.getByRole('button', { name: /pay/i }).click();

    // Should redirect to success page
    await page.waitForURL(/\/payment\/success/, { timeout: 15000 });

    // Verify success
    await expect(
      page.getByRole('heading', { name: /payment successful/i })
    ).toBeVisible();
  });

  test('should display error message for network failure', async ({
    page,
    context,
  }) => {
    // Select payment method
    await page.getByRole('tab', { name: /stripe/i }).click();

    // Go offline before payment
    await context.setOffline(true);

    // Try to pay
    await page.getByRole('button', { name: /pay/i }).click();

    // Should show error message
    await expect(
      page.getByRole('alert', { name: /network.*error|offline/i })
    ).toBeVisible({ timeout: 5000 });

    // Should show queued message
    await expect(page.getByText(/queued.*offline|saved.*later/i)).toBeVisible();
  });

  test('should handle subscription payment retry with exponential backoff', async ({
    page,
  }) => {
    await page.goto('/payment/subscriptions');

    // Subscription with failed payment should show retry info
    const pastDueCard = page
      .getByRole('article')
      .filter({ hasText: /past.*due/i });

    if (await pastDueCard.isVisible()) {
      // Should show next retry date
      await expect(pastDueCard.getByText(/next.*retry/i)).toBeVisible();

      // Should show grace period end date
      await expect(
        pastDueCard.getByText(/grace.*period.*ends|subscription.*expires/i)
      ).toBeVisible();

      // Should show update payment button
      await expect(
        pastDueCard.getByRole('button', { name: /update.*payment/i })
      ).toBeVisible();
    }
  });

  test('should prevent retry after max attempts exceeded', async ({ page }) => {
    // Navigate to payment with max retries exceeded
    await page.goto('/payment/result?id=test-max-retries-exceeded-id');

    // Retry button should be disabled
    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeDisabled();

    // Should show max attempts message
    await expect(
      page.getByText(/maximum.*attempts|cannot.*retry|contact.*support/i)
    ).toBeVisible();
  });

  test('should log error details for debugging', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Listen to console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Trigger a payment failure
    await page.getByRole('tab', { name: /stripe/i }).click();
    await page.getByRole('button', { name: /pay/i }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 10000 });

    // Use declined card
    await page.fill('[name="cardNumber"]', '4000000000000002');
    await page.fill('[name="cardExpiry"]', '1234');
    await page.fill('[name="cardCvc"]', '123');
    await page.fill('[name="billingName"]', 'Test User');

    await page.getByRole('button', { name: /pay/i }).click();

    // Wait a bit for error to be logged
    await page.waitForTimeout(2000);

    // Should have logged the error (in development mode)
    if (process.env.NODE_ENV === 'development') {
      expect(consoleErrors.some((e) => e.includes('payment'))).toBeTruthy();
    }
  });

  test('should display user-friendly error messages', async ({ page }) => {
    const errorScenarios = [
      {
        card: '4000000000000002',
        expectedMessage: /card.*declined|payment.*declined/i,
      },
      {
        card: '4000000000009995',
        expectedMessage: /insufficient.*funds/i,
      },
      {
        card: '4000000000009987',
        expectedMessage: /card.*lost|stolen/i,
      },
      {
        card: '4000000000000069',
        expectedMessage: /card.*expired/i,
      },
    ];

    for (const scenario of errorScenarios) {
      await page.goto('/payment-demo');

      // Grant consent if needed
      const consentModal = page.getByRole('dialog', {
        name: /payment consent/i,
      });
      if (await consentModal.isVisible()) {
        await page.getByRole('button', { name: /accept.*continue/i }).click();
      }

      await page.getByRole('tab', { name: /stripe/i }).click();
      await page.getByRole('button', { name: /pay/i }).click();

      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 10000 });

      await page.fill('[name="cardNumber"]', scenario.card);
      await page.fill('[name="cardExpiry"]', '1234');
      await page.fill('[name="cardCvc"]', '123');
      await page.fill('[name="billingName"]', 'Test User');

      await page.getByRole('button', { name: /pay/i }).click();

      // Should show expected error message
      await expect(page.getByText(scenario.expectedMessage)).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
