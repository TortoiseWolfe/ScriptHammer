// Security Hardening: Payment Isolation E2E Test
// Feature 017 - Task T016
// Purpose: Test end-to-end payment data isolation between users

import { test, expect } from '@playwright/test';

// Test users
const USER_A = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

const USER_B = {
  email: process.env.TEST_USER_SECONDARY_EMAIL || 'test2@example.com',
  password: process.env.TEST_USER_SECONDARY_PASSWORD || 'TestPassword123!',
};

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
    await pageA.fill('input[type="email"]', USER_A.email);
    await pageA.fill('input[type="password"]', USER_A.password);
    await pageA.click('button[type="submit"]');

    // Wait for redirect after sign-in
    await pageA.waitForURL(/profile|dashboard|$/, { timeout: 5000 });

    // Step 2: User A creates a payment
    await pageA.goto('/payment-demo');

    // Fill out payment form
    await pageA.fill('input[name="amount"]', '10.00');
    await pageA.fill('input[name="email"]', USER_A.email);
    await pageA.click('button:has-text("Create Payment")');

    // Wait for payment creation confirmation
    await expect(pageA.locator('text=/payment.*created|success/i')).toBeVisible(
      {
        timeout: 5000,
      }
    );

    // Capture payment ID from UI or URL
    let paymentId: string | null = null;
    const paymentIdElement = await pageA.locator('[data-payment-id]').first();
    if (await paymentIdElement.isVisible()) {
      paymentId = await paymentIdElement.getAttribute('data-payment-id');
    }

    // Step 3: User A can see their payment in history
    await pageA.goto('/payment-demo');
    await expect(pageA.locator('text=/payment.*history/i')).toBeVisible({
      timeout: 3000,
    });

    // Should see at least one payment
    const userAPayments = await pageA.locator('[data-payment-item]').count();
    expect(userAPayments).toBeGreaterThan(0);

    // Step 4: User B signs in (different session)
    await pageB.goto('/sign-in');
    await pageB.fill('input[type="email"]', USER_B.email);
    await pageB.fill('input[type="password"]', USER_B.password);
    await pageB.click('button[type="submit"]');

    await pageB.waitForURL(/profile|dashboard|$/, { timeout: 5000 });

    // Step 5: User B goes to payment page
    await pageB.goto('/payment-demo');

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
    await pageA.fill('input[type="email"]', USER_A.email);
    await pageA.fill('input[type="password"]', USER_A.password);
    await pageA.click('button[type="submit"]');
    await pageA.waitForURL(/\/$/, { timeout: 5000 }).catch(() => {});

    await pageB.goto('/sign-in');
    await pageB.fill('input[type="email"]', USER_B.email);
    await pageB.fill('input[type="password"]', USER_B.password);
    await pageB.click('button[type="submit"]');
    await pageB.waitForURL(/\/$/, { timeout: 5000 }).catch(() => {});

    // Both users create payments
    await pageA.goto('/payment-demo');
    await pageA.fill('input[name="amount"]', '25.00');
    await pageA.fill('input[name="email"]', USER_A.email);
    await pageA.click('button:has-text("Create Payment")');
    await pageA.waitForTimeout(1000);

    await pageB.goto('/payment-demo');
    await pageB.fill('input[name="amount"]', '50.00');
    await pageB.fill('input[name="email"]', USER_B.email);
    await pageB.click('button:has-text("Create Payment")');
    await pageB.waitForTimeout(1000);

    // Check payment history for both users
    await pageA.goto('/payment-demo');
    const paymentsA = await pageA.locator('[data-payment-item]').all();

    await pageB.goto('/payment-demo');
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

    // Should be redirected to sign-in
    await expect(page).toHaveURL(/sign-in/, { timeout: 3000 });

    // Or should see authentication required message
    await expect(
      page.locator('text=/sign.*in|authentication.*required/i')
    ).toBeVisible();
  });

  test('Unauthenticated users cannot view payment history', async ({
    page,
  }) => {
    // Try to access payment history without auth
    await page.goto('/payment-demo');

    // Should require authentication
    await expect(page).toHaveURL(/sign-in/, { timeout: 3000 });
  });

  test('Payment intent includes correct user association', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Sign in
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', USER_A.email);
    await page.fill('input[type="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/, { timeout: 5000 }).catch(() => {});

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
    await page.fill('input[name="amount"]', '15.00');
    await page.fill('input[name="email"]', USER_A.email);
    await page.click('button:has-text("Create Payment")');
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
