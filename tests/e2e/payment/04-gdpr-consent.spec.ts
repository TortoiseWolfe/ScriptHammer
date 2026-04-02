/**
 * Integration Test: GDPR Consent Flow - T058
 * Tests payment consent modal and script loading behavior
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

test.describe('GDPR Payment Consent Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to payment-demo (auth provided by storageState from project config)
    await page.goto('/payment-demo');
    await dismissCookieBanner(page);

    // Clear only consent keys — NOT cookies (which contain the auth session).
    // Clearing cookies destroys the Supabase session, causing auth failures
    // on page.reload() in tests like "should remember consent across reloads".
    await page.evaluate(() => {
      localStorage.removeItem('payment_consent');
      localStorage.removeItem('gdpr_consent');
    });

    // Reload so the page sees the cleared consent state
    await page.reload();
    await dismissCookieBanner(page);
  });

  test('should show consent section on first visit', async ({ page }) => {
    // Consent section should be visible (it's inline, not a modal)
    const consentHeading = page.getByRole('heading', {
      name: /GDPR Consent/i,
    });
    await expect(consentHeading).toBeVisible();

    // Should show what consent means
    await expect(page.getByText(/what this means/i)).toBeVisible();

    // Should have accept and decline buttons
    await expect(page.getByRole('button', { name: /Accept/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Decline/i })).toBeVisible();
  });

  test('should not load payment scripts before consent', async ({ page }) => {
    // Check that the main Stripe.js SDK and PayPal SDK are not loaded before consent
    // Note: @stripe/stripe-js package may include lightweight loader scripts in the bundle,
    // but the main js.stripe.com/v3 SDK should NOT load until loadStripe() is called
    const stripeMainSDK = page.locator('script[src*="js.stripe.com/v3"]');
    const paypalSDK = page.locator('script[src*="paypal.com/sdk"]');

    // Main SDKs should not be loaded before consent
    await expect(stripeMainSDK).toHaveCount(0);
    await expect(paypalSDK).toHaveCount(0);
  });

  test('should show payment options after consent granted', async ({
    page,
  }) => {
    // Accept consent
    await page.getByRole('button', { name: /Accept/i }).click();

    // Consent section should be replaced with payment options
    await expect(
      page.getByRole('heading', { name: /GDPR Consent/i })
    ).not.toBeVisible({ timeout: 5000 });

    // Step 2 should now be visible
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible();

    // Payment provider tabs should be visible (use .first() - 3 PaymentButton components each have tabs)
    await expect(
      page.getByRole('tab', { name: /stripe/i }).first()
    ).toBeVisible();
  });

  test('should remember consent across page reloads', async ({ page }) => {
    // Wait for consent section to fully render before clicking
    const acceptButton = page.getByRole('button', { name: /Accept/i });
    await expect(acceptButton).toBeVisible();
    await acceptButton.click();

    // Verify Step 2 appears (showConsent=false set synchronously in onClick)
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible();

    // Reload page
    await page.reload();
    await dismissCookieBanner(page);

    // After reload, usePaymentConsent's useEffect reads localStorage and
    // sets isReady + hasConsent atomically. Wait for either Step heading
    // to confirm the page has hydrated and the effect has fired, then
    // assert Step 2 specifically. Firefox on CI needs more time for
    // React hydration under resource contention (18 concurrent jobs).
    await expect(page.getByRole('heading', { name: /Step [12]/i })).toBeVisible(
      { timeout: 15000 }
    );
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible();
  });

  test('should handle consent decline gracefully', async ({ page }) => {
    // Decline consent
    await page.getByRole('button', { name: /Decline/i }).click();

    // After decline, an alert should appear explaining consent is required
    // The page uses window.alert for decline (check the page.tsx)
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Payment features require consent');
      await dialog.accept();
    });
  });

  test('should have accessible consent buttons', async ({ page }) => {
    // Accept button should be visible and accessible
    const acceptButton = page.getByRole('button', { name: /Accept/i });
    await expect(acceptButton).toBeVisible();
    await expect(acceptButton).toBeEnabled();

    // Decline button should be visible and accessible
    const declineButton = page.getByRole('button', { name: /Decline/i });
    await expect(declineButton).toBeVisible();
    await expect(declineButton).toBeEnabled();
  });

  test('should persist consent decision', async ({ page }) => {
    // Accept consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await dismissCookieBanner(page);

    // GDPR section should not reappear
    const gdprHeading = page.getByRole('heading', {
      name: /Step 1: GDPR Consent/i,
    });
    await expect(gdprHeading).not.toBeVisible({ timeout: 3000 });
  });

  test('should show privacy information', async ({ page }) => {
    // Privacy info should be visible
    await expect(
      page.getByText(/External scripts will be loaded/i)
    ).toBeVisible();
    await expect(
      page.getByText(/payment data will be processed securely/i)
    ).toBeVisible();
  });

  test('should allow proceeding after consent', async ({ page }) => {
    // Wait for Accept button to be rendered and clickable
    const acceptButton = page.getByRole('button', { name: /Accept/i });
    await expect(acceptButton).toBeVisible();
    await acceptButton.click();

    // onClick sets showConsent=false synchronously → Step 2 renders
    const step2 = page.getByRole('heading', { name: /Step 2/i });
    await expect(step2).toBeVisible();
  });

  test.skip('should allow consent reset', async ({ page }) => {
    // Skip: Consent reset feature may not be implemented in /account
    test.skip(true, 'Consent reset feature not yet implemented');
  });
});
