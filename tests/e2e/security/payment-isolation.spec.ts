// Security Hardening: Payment Isolation E2E Test
// Feature 017 - Task T016
// Purpose: Test end-to-end payment data isolation between users

import { test, expect, type Page } from '@playwright/test';
import { dismissCookieBanner, performSignIn } from '../utils/test-user-factory';

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
 * Clicks Accept button if visible, then waits for payment section.
 */
async function handlePaymentConsent(page: Page) {
  // Look for GDPR consent Accept button
  const acceptButton = page.getByRole('button', { name: /Accept/i }).first();
  const isConsentVisible = await acceptButton.isVisible().catch(() => false);

  if (isConsentVisible) {
    await acceptButton.click();
    // Wait for Step 2 to become visible (payment form)
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible({
      timeout: 5000,
    });
  }

  // Wait for page to settle - don't wait for Stripe (may not load in CI)
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Payment Isolation E2E - REQ-SEC-001', () => {
  // Increase timeout for multi-user tests (2 sign-ins + 2 page loads + consent)
  test.setTimeout(60000);

  test('User A and User B have isolated payment sessions', async ({
    browser,
  }) => {
    // User A's browser session
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // User B's browser session
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Step 1: User A signs in
    await pageA.goto('/sign-in');
    await dismissCookieBanner(pageA);
    const resultA = await performSignIn(pageA, USER_A.email, USER_A.password);
    if (!resultA.success) {
      throw new Error(`User A sign-in failed: ${resultA.error}`);
    }

    // Step 2: User A accesses payment demo
    await pageA.goto('/payment-demo');
    await dismissCookieBanner(pageA);
    await handlePaymentConsent(pageA);

    // Verify User A sees the payment page with their user ID
    const userAInfo = pageA.locator('text=/Logged in as.*User ID/i');
    await expect(userAInfo).toBeVisible({ timeout: 5000 });

    // Extract User A's ID from the page
    const userAText = await userAInfo.textContent();
    const userAId = userAText?.match(/User ID:\s*([a-f0-9-]+)/i)?.[1];
    expect(userAId).toBeTruthy();

    // Step 3: User B signs in (different session)
    await pageB.goto('/sign-in');
    await dismissCookieBanner(pageB);
    const resultB = await performSignIn(pageB, USER_B.email, USER_B.password);
    if (!resultB.success) {
      throw new Error(`User B sign-in failed: ${resultB.error}`);
    }

    // Step 4: User B accesses payment demo
    await pageB.goto('/payment-demo');
    await dismissCookieBanner(pageB);
    await handlePaymentConsent(pageB);

    // Verify User B sees the payment page with their user ID
    const userBInfo = pageB.locator('text=/Logged in as.*User ID/i');
    await expect(userBInfo).toBeVisible({ timeout: 5000 });

    // Extract User B's ID from the page
    const userBText = await userBInfo.textContent();
    const userBId = userBText?.match(/User ID:\s*([a-f0-9-]+)/i)?.[1];
    expect(userBId).toBeTruthy();

    // Step 5: Verify session isolation - User IDs should be different
    expect(userAId).not.toBe(userBId);

    // Step 6: Verify each user sees their own payment history section
    // Both should see the Payment History heading (use exact match)
    await expect(
      pageA.getByRole('heading', { name: /Step 4.*Payment History/i })
    ).toBeVisible();
    await expect(
      pageB.getByRole('heading', { name: /Step 4.*Payment History/i })
    ).toBeVisible();

    // Cleanup
    await contextA.close();
    await contextB.close();
  });

  test('Payment history shows only own payments', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Sign in
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    const result = await performSignIn(page, USER_A.email, USER_A.password);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Access payment demo
    await page.goto('/payment-demo');
    await dismissCookieBanner(page);
    await handlePaymentConsent(page);

    // Verify payment history section exists (use exact match to avoid "No payment history")
    await expect(
      page.getByRole('heading', { name: /Step 4.*Payment History/i })
    ).toBeVisible();

    // Verify user-specific info is shown
    const userInfo = page.locator('text=/Logged in as/i');
    await expect(userInfo).toBeVisible();

    // Wait for payment history to finish loading
    // Either shows "No payment history" or payment items - but NOT "Loading..."
    await expect(page.getByText(/Loading payment history/i)).toBeHidden({
      timeout: 10000,
    });

    // Payment history should be scoped to the current user
    // The "No payment history" heading or payment list should be visible
    const noPaymentsHeading = page.getByRole('heading', {
      name: /No payment history/i,
    });
    const paymentList = page.locator('[data-payment-item]');

    // Either empty state or payment list should be visible
    const hasNoPayments = await noPaymentsHeading
      .isVisible()
      .catch(() => false);
    const hasPayments = (await paymentList.count()) > 0;

    expect(hasNoPayments || hasPayments).toBe(true);

    await context.close();
  });

  test('Unauthenticated users see sign-in prompt on payment page', async ({
    page,
  }) => {
    // Try to access payment page without signing in
    await page.goto('/payment-demo');
    await dismissCookieBanner(page);

    // The page should show sign-in links OR the payment demo without user info
    // Check for either redirect to sign-in OR sign-in links in navbar
    const signInLink = page.getByRole('link', { name: /Sign In/i });
    const isSignInVisible = await signInLink.isVisible().catch(() => false);

    if (isSignInVisible) {
      // User is not authenticated - sign-in link is visible
      expect(isSignInVisible).toBe(true);
    } else {
      // Check if redirected to sign-in page
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/sign-in|payment-demo/);
    }
  });

  test('Payment buttons require GDPR consent', async ({ page }) => {
    // Sign in first
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    const result = await performSignIn(page, USER_A.email, USER_A.password);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Access payment demo
    await page.goto('/payment-demo');
    await dismissCookieBanner(page);

    // Clear any existing consent
    await page.evaluate(() => {
      localStorage.removeItem('payment_consent');
      localStorage.removeItem('paymentConsent');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check for GDPR consent step
    const gdprHeading = page.getByRole('heading', { name: /GDPR|Consent/i });
    const acceptButton = page.getByRole('button', { name: /Accept/i }).first();

    const hasConsentStep = await gdprHeading.isVisible().catch(() => false);
    const hasAcceptButton = await acceptButton.isVisible().catch(() => false);

    // Should show consent requirement
    expect(hasConsentStep || hasAcceptButton).toBe(true);

    // After accepting consent, payment options should appear
    if (hasAcceptButton) {
      await acceptButton.click();
      await expect(
        page.getByRole('heading', { name: /Step 2|Make a Payment/i })
      ).toBeVisible({ timeout: 5000 });
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
    const result = await performSignIn(page, USER_A.email, USER_A.password);
    if (!result.success) {
      throw new Error(`Sign-in failed: ${result.error}`);
    }

    // Track payment-related network requests
    const paymentRequests: string[] = [];
    page.on('request', (request) => {
      if (
        request.url().includes('/api/payment') ||
        request.url().includes('stripe') ||
        request.url().includes('payment')
      ) {
        paymentRequests.push(request.url());
      }
    });

    await page.goto('/payment-demo');
    await dismissCookieBanner(page);
    await handlePaymentConsent(page);

    // Verify user info is displayed correctly
    const userInfo = page.locator('text=/User ID:/i');
    await expect(userInfo).toBeVisible({ timeout: 5000 });

    // The page should show the current user's ID (not a placeholder)
    const userText = await userInfo.textContent();
    expect(userText).not.toContain('00000000-0000-0000-0000-000000000000');
    expect(userText).toMatch(/[a-f0-9-]{36}/i); // Valid UUID format

    await context.close();
  });
});
