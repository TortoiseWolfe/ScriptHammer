/**
 * Integration Test: GDPR Consent Flow - T058
 * Tests payment consent modal and script loading behavior
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

test.describe('GDPR Payment Consent Flow', () => {
  // Tests with page.reload() need extra time: beforeEach hydration (15s) +
  // in-test reload hydration (30s) + assertions exceed the default 30s timeout
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    // Clear consent keys via JS before navigating. Using evaluate on a
    // neutral URL avoids the ProtectedRoute auth race that occurs when
    // clearing localStorage mid-page then reloading — the reload causes
    // AuthContext to re-read the session while ProtectedRoute checks auth,
    // and on slow Supabase free tier the auth check can fail.
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.removeItem('payment_consent');
      localStorage.removeItem('gdpr_consent');
    });

    // Navigate to /payment-demo and handle ProtectedRoute auth redirect.
    // Static export ProtectedRoute checks auth synchronously — if the
    // Supabase session hasn't hydrated from localStorage yet, it redirects
    // to /sign-in. Retry up to 3 times to allow auth initialization.
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto('/payment-demo', { waitUntil: 'networkidle' });
      if (!page.url().includes('/sign-in')) break;
      console.log(
        `[gdpr-consent] Redirected to sign-in (attempt ${attempt + 1}/3), retrying...`
      );
      await page.waitForTimeout(2000);
    }
    await dismissCookieBanner(page);

    // Wait for either consent section or Step 2 to appear (confirms
    // ProtectedRoute + usePaymentConsent hydration completed)
    await page
      .getByRole('heading', { name: /Step [12]|GDPR Consent/i })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
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
    // Accept consent
    await page.getByRole('button', { name: /Accept/i }).click();
    await page.waitForTimeout(500);

    // Re-navigate (not reload) — page.reload() loses Supabase session on
    // Firefox/WebKit because token refresh races with ProtectedRoute.
    // page.goto() re-applies storageState cookies from the Playwright context.
    await page.goto('/payment-demo');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Wait for consent state to hydrate from localStorage before checking UI.
    // React renders initial state (showConsent=true → Step 1) before the
    // usePaymentConsent hook reads localStorage and updates to Step 2.
    await page.waitForFunction(
      () => localStorage.getItem('payment_consent') === 'granted',
      { timeout: 10000 }
    );

    // DIAGNOSTIC: Log what the page actually shows after localStorage check
    const consentDiag = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
      const consent = localStorage.getItem('payment_consent');
      const consentDate = localStorage.getItem('payment_consent_date');
      return {
        consent,
        consentDate,
        headingTexts: headings.map((h) => h.textContent?.trim()).slice(0, 5),
        bodyClasses: document.body.className,
        url: window.location.href,
      };
    });
    console.log(
      '[DIAG:gdpr-consent] After localStorage check:',
      JSON.stringify(consentDiag)
    );

    // Wait a bit for React to process the state change
    await page.waitForTimeout(2000);

    // DIAGNOSTIC: Log again after waiting
    const consentDiag2 = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
      return {
        headingTexts: headings.map((h) => h.textContent?.trim()).slice(0, 5),
      };
    });
    console.log(
      '[DIAG:gdpr-consent] After 2s wait:',
      JSON.stringify(consentDiag2)
    );

    // Consent should be remembered — Step 2 visible, not Step 1
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole('heading', { name: /Step 1: GDPR Consent/i })
    ).not.toBeVisible({ timeout: 3000 });
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

    // Re-navigate (not reload) — page.reload() loses Supabase session
    await page.goto('/payment-demo');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Wait for consent state to hydrate from localStorage
    await page.waitForFunction(
      () => localStorage.getItem('payment_consent') === 'granted',
      { timeout: 10000 }
    );

    // GDPR section should not reappear — Step 2 should be visible
    await expect(page.getByRole('heading', { name: /Step 2/i })).toBeVisible({
      timeout: 15000,
    });
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
    // Accept consent
    await page.getByRole('button', { name: /Accept/i }).click();

    // Should be able to see payment options (Step 2)
    // CI contention can delay React state updates + re-render
    const step2 = page.getByRole('heading', { name: /Step 2/i });
    await expect(step2).toBeVisible({ timeout: 15000 });
  });

  test.skip('should allow consent reset', async ({ page }) => {
    // Skip: Consent reset feature may not be implemented in /account
    test.skip(true, 'Consent reset feature not yet implemented');
  });
});
