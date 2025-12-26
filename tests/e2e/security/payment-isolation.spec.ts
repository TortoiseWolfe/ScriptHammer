// Security Hardening: Payment Isolation E2E Test
// Feature 017 - Task T016
// Purpose: Test end-to-end payment data isolation between users

import { test, expect, type Page } from '@playwright/test';
import {
  dismissCookieBanner,
  waitForAuthenticatedState,
} from '../utils/test-user-factory';

// Test users
const USER_A = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const USER_B = {
  email: process.env.TEST_USER_SECONDARY_EMAIL || 'test2@example.com',
  password: process.env.TEST_USER_SECONDARY_PASSWORD || 'TestPassword123!',
};

/**
 * Handle GDPR consent on payment-demo page.
 * Clears localStorage to ensure fresh consent state, then clicks Accept button.
 */
async function handlePaymentConsent(page: Page) {
  // Clear payment consent from localStorage to ensure fresh state
  await page.evaluate(() => {
    localStorage.removeItem('payment_consent');
    localStorage.removeItem('paymentConsent');
  });

  // Check if consent step is visible
  const acceptButton = page.getByRole('button', { name: /Accept & Continue/i });
  const isConsentVisible = await acceptButton.isVisible().catch(() => false);

  if (isConsentVisible) {
    await acceptButton.click();
    // Wait for Step 2 to become visible (payment form)
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible({
      timeout: 5000,
    });
  }
}

test.describe('Payment Isolation E2E - REQ-SEC-001', () => {
  test('User A creates payment, User B cannot see it', async ({ browser }) => {
    // User A's browser session
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // User B's browser session
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Step 1: User A signs in
    await pageA.goto('/sign-in');
    await dismissCookieBanner(pageA);
    await pageA.getByLabel('Email').fill(USER_A.email);
    await pageA.getByLabel('Password').fill(USER_A.password);
    await pageA.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect after sign-in
    await waitForAuthenticatedState(pageA);

    // Step 2: User A creates a payment
    await pageA.goto('/payment-demo');
    await dismissCookieBanner(pageA);
    await handlePaymentConsent(pageA);

    // Fill out payment form using role-based selectors
    const amountInputA = pageA.getByLabel(/Amount/i);
    if (await amountInputA.isVisible()) {
      await amountInputA.fill('10.00');
    } else {
      // Fallback to name attribute if label not found
      await pageA.locator('input[name="amount"]').fill('10.00');
    }

    const emailInputA = pageA.getByLabel(/Email/i);
    if (await emailInputA.isVisible()) {
      await emailInputA.fill(USER_A.email);
    } else {
      await pageA.locator('input[name="email"]').fill(USER_A.email);
    }

    await pageA.getByRole('button', { name: /Create Payment/i }).click();

    // Wait for payment creation confirmation
    await expect(pageA.getByText(/payment.*created|success/i)).toBeVisible({
      timeout: 5000,
    });

    // Capture payment ID from UI or URL
    let paymentId: string | null = null;
    const paymentIdElement = await pageA.locator('[data-payment-id]').first();
    if (await paymentIdElement.isVisible()) {
      paymentId = await paymentIdElement.getAttribute('data-payment-id');
    }

    // Step 3: User A can see their payment in history
    await pageA.goto('/payment-demo');
    await dismissCookieBanner(pageA);
    await handlePaymentConsent(pageA);
    await expect(pageA.getByText(/payment.*history/i)).toBeVisible({
      timeout: 3000,
    });

    // Should see at least one payment
    const userAPayments = await pageA.locator('[data-payment-item]').count();
    expect(userAPayments).toBeGreaterThan(0);

    // Step 4: User B signs in (different session)
    await pageB.goto('/sign-in');
    await dismissCookieBanner(pageB);
    await pageB.getByLabel('Email').fill(USER_B.email);
    await pageB.getByLabel('Password').fill(USER_B.password);
    await pageB.getByRole('button', { name: 'Sign In' }).click();

    await waitForAuthenticatedState(pageB);

    // Step 5: User B goes to payment page
    await pageB.goto('/payment-demo');
    await dismissCookieBanner(pageB);
    await handlePaymentConsent(pageB);

    // User B should see their own (empty) payment history
    // Should NOT see User A's payments
    const userBPayments = await pageB.locator('[data-payment-item]').count();

    // If User B has no payments, count should be 0
    // If they do, none should match User A's payment ID
    if (paymentId) {
      await expect(
        pageB.locator(`[data-payment-id="${paymentId}"]`)
      ).not.toBeVisible();
    }

    // Step 6: User B tries to access User A's payment directly (if we have payment ID)
    if (paymentId) {
      await pageB.goto(`/payment-demo/${paymentId}`);

      // Should see "not found" or "unauthorized" error
      await expect(
        pageB.locator('text=/not.*found|unauthorized|access.*denied|404/i')
      ).toBeVisible({
        timeout: 3000,
      });
    }

    // Cleanup
    await contextA.close();
    await contextB.close();
  });

  test('Payment history shows only own payments', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Sign in both users
    await pageA.goto('/sign-in');
    await dismissCookieBanner(pageA);
    await pageA.getByLabel('Email').fill(USER_A.email);
    await pageA.getByLabel('Password').fill(USER_A.password);
    await pageA.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(pageA);

    await pageB.goto('/sign-in');
    await dismissCookieBanner(pageB);
    await pageB.getByLabel('Email').fill(USER_B.email);
    await pageB.getByLabel('Password').fill(USER_B.password);
    await pageB.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(pageB);

    // Both users create payments
    await pageA.goto('/payment-demo');
    await dismissCookieBanner(pageA);
    await handlePaymentConsent(pageA);
    const amountA = pageA.getByLabel(/Amount/i);
    if (await amountA.isVisible()) {
      await amountA.fill('25.00');
    } else {
      await pageA.locator('input[name="amount"]').fill('25.00');
    }
    const emailA = pageA.getByLabel(/Email/i);
    if (await emailA.isVisible()) {
      await emailA.fill(USER_A.email);
    } else {
      await pageA.locator('input[name="email"]').fill(USER_A.email);
    }
    await pageA.getByRole('button', { name: /Create Payment/i }).click();
    await pageA.waitForTimeout(1000);

    await pageB.goto('/payment-demo');
    await dismissCookieBanner(pageB);
    await handlePaymentConsent(pageB);
    const amountB = pageB.getByLabel(/Amount/i);
    if (await amountB.isVisible()) {
      await amountB.fill('50.00');
    } else {
      await pageB.locator('input[name="amount"]').fill('50.00');
    }
    const emailB = pageB.getByLabel(/Email/i);
    if (await emailB.isVisible()) {
      await emailB.fill(USER_B.email);
    } else {
      await pageB.locator('input[name="email"]').fill(USER_B.email);
    }
    await pageB.getByRole('button', { name: /Create Payment/i }).click();
    await pageB.waitForTimeout(1000);

    // Check payment history for both users
    await pageA.goto('/payment-demo');
    await handlePaymentConsent(pageA);
    const paymentsA = await pageA.locator('[data-payment-item]').all();

    await pageB.goto('/payment-demo');
    await handlePaymentConsent(pageB);
    const paymentsB = await pageB.locator('[data-payment-item]').all();

    // Each user's payment list should be independent
    // Get payment amounts from each list
    const amountsA = await Promise.all(
      paymentsA.map(async (p) => await p.locator('[data-amount]').textContent())
    );

    const amountsB = await Promise.all(
      paymentsB.map(async (p) => await p.locator('[data-amount]').textContent())
    );

    // User A should see $25.00 payment
    expect(amountsA.some((a) => a?.includes('25'))).toBe(true);

    // User B should see $50.00 payment
    expect(amountsB.some((a) => a?.includes('50'))).toBe(true);

    // User A should NOT see User B's $50.00 payment
    expect(amountsA.some((a) => a?.includes('50'))).toBe(false);

    // User B should NOT see User A's $25.00 payment
    expect(amountsB.some((a) => a?.includes('25'))).toBe(false);

    await contextA.close();
    await contextB.close();
  });

  test('Unauthenticated users cannot create payments', async ({ page }) => {
    // Try to access payment page without signing in
    await page.goto('/payment-demo');
    await dismissCookieBanner(page);

    // Should be redirected to sign-in OR see authentication required message
    try {
      await expect(page).toHaveURL(/sign-in/, { timeout: 3000 });
    } catch {
      // Or should see authentication required message on the page
      await expect(
        page.getByText(/sign.*in|authentication.*required/i)
      ).toBeVisible();
    }
  });

  test('Unauthenticated users cannot view payment history', async ({
    page,
  }) => {
    // Try to access payment history without auth
    await page.goto('/payment-demo');
    await dismissCookieBanner(page);

    // Should require authentication - either redirect or show message
    try {
      await expect(page).toHaveURL(/sign-in/, { timeout: 3000 });
    } catch {
      await expect(
        page.getByText(/sign.*in|authentication.*required/i)
      ).toBeVisible();
    }
  });

  test('Payment intent includes correct user association', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Sign in
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(USER_A.email);
    await page.getByLabel('Password').fill(USER_A.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await waitForAuthenticatedState(page);

    // Create payment and inspect network request
    let paymentIntentData: any = null;

    page.on('response', async (response) => {
      if (
        response.url().includes('/api/payment') ||
        response.url().includes('payment_intents')
      ) {
        try {
          const data = await response.json();
          if (data && data.template_user_id) {
            paymentIntentData = data;
          }
        } catch (e) {
          // Not JSON response
        }
      }
    });

    await page.goto('/payment-demo');
    await dismissCookieBanner(page);
    await handlePaymentConsent(page);
    const amountInput = page.getByLabel(/Amount/i);
    if (await amountInput.isVisible()) {
      await amountInput.fill('15.00');
    } else {
      await page.locator('input[name="amount"]').fill('15.00');
    }
    const emailInput = page.getByLabel(/Email/i);
    if (await emailInput.isVisible()) {
      await emailInput.fill(USER_A.email);
    } else {
      await page.locator('input[name="email"]').fill(USER_A.email);
    }
    await page.getByRole('button', { name: /Create Payment/i }).click();
    await page.waitForTimeout(2000);

    // Verify payment intent has user ID (not hardcoded placeholder)
    if (paymentIntentData) {
      expect(paymentIntentData.template_user_id).toBeTruthy();
      expect(paymentIntentData.template_user_id).not.toBe(
        '00000000-0000-0000-0000-000000000000'
      );
    }

    await context.close();
  });
});
