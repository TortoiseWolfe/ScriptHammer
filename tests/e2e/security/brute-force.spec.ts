// Security Hardening: Brute Force Prevention E2E Test
// Feature 017 - Task T015
// Purpose: Test server-side rate limiting prevents brute force attacks
//
// This test suite uses Playwright project ordering to run after rate-limiting
// tests but before sign-up tests, preserving IP-based rate limit quota.

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';
import { clearAllRateLimits } from '../utils/rate-limit-admin';

/**
 * Generate a test email using real email domain from TEST_USER_PRIMARY_EMAIL.
 */
function generateBruteForceEmail(prefix: string): string {
  const baseEmail = process.env.TEST_USER_PRIMARY_EMAIL || '';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  if (baseEmail.includes('@gmail.com')) {
    const baseUser = baseEmail.split('+')[0] || baseEmail.split('@')[0];
    return `${baseUser}+bf-${prefix}-${timestamp}-${random}@gmail.com`;
  }

  if (baseEmail.includes('@')) {
    const domain = baseEmail.split('@')[1];
    return `bf-${prefix}-${timestamp}-${random}@${domain}`;
  }

  console.error(
    '❌ TEST_USER_PRIMARY_EMAIL not configured - brute force tests may fail'
  );
  return `bf-${prefix}-${timestamp}-${random}@gmail.com`;
}

function isBruteForceEmailConfigValid(): boolean {
  const baseEmail = process.env.TEST_USER_PRIMARY_EMAIL || '';
  return baseEmail.includes('@');
}

test.describe('Brute Force Prevention - REQ-SEC-003', () => {
  const wrongPassword = 'WrongPassword123!';
  let testEmail: string;

  // Clear rate limits and generate test email before suite
  test.beforeAll(async () => {
    await clearAllRateLimits();
    testEmail = generateBruteForceEmail('main');
  });

  test.beforeEach(async ({ page }, testInfo) => {
    if (!isBruteForceEmailConfigValid()) {
      testInfo.skip(
        true,
        'TEST_USER_PRIMARY_EMAIL not configured - brute force tests require valid email domain'
      );
      return;
    }
  });

  test('should lockout after 5 failed login attempts', async ({ page }) => {
    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // Attempt 1-5: Try to sign in with wrong password
    for (let i = 1; i <= 5; i++) {
      await page.getByLabel('Email').fill(testEmail);
      await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for error response (filter excludes Next.js route announcer)
      await expect(
        page.getByRole('alert').filter({
          hasText: /failed|error|locked|invalid|incorrect|attempts/i,
        })
      ).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(300);
    }

    // Attempt 6: Should be locked out
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should see rate limit error
    const errorAlert = page.getByRole('alert').filter({
      hasText: /too many.*attempts|temporarily locked|rate.*limit/i,
    });
    await expect(errorAlert).toBeVisible({ timeout: 5000 });

    // Error message should mention time to wait
    const errorMessage = await errorAlert.textContent();
    expect(errorMessage).toMatch(/15|minutes?|try.*again/i);
  });

  test('should persist lockout across browser sessions', async ({
    browser,
  }) => {
    // Use unique email for this test
    const sessionEmail = generateBruteForceEmail('session');

    // First browser session - trigger lockout
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/sign-in');
    await dismissCookieBanner(page1);

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await page1.getByLabel('Email').fill(sessionEmail);
      await page1.getByLabel('Password', { exact: true }).fill(wrongPassword);
      await page1.getByRole('button', { name: 'Sign In' }).click();
      await page1.waitForTimeout(500);
    }

    // Verify locked
    await page1.getByLabel('Email').fill(sessionEmail);
    await page1.getByLabel('Password', { exact: true }).fill(wrongPassword);
    await page1.getByRole('button', { name: 'Sign In' }).click();
    await expect(
      page1.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 5000 });

    await context1.close();

    // Second browser session (new context, cleared storage)
    const context2 = await browser.newContext({
      storageState: undefined, // Clear all storage
    });
    const page2 = await context2.newPage();

    await page2.goto('/sign-in');
    await dismissCookieBanner(page2);

    // Should STILL be locked (server-side enforcement)
    await page2.getByLabel('Email').fill(sessionEmail);
    await page2.getByLabel('Password', { exact: true }).fill(wrongPassword);
    await page2.getByRole('button', { name: 'Sign In' }).click();

    await expect(
      page2.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 5000 });

    await context2.close();
  });

  test('should show remaining attempts counter', async ({ page }) => {
    const uniqueEmail = generateBruteForceEmail('attempts');

    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // First attempt
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for error response
    await expect(
      page.getByRole('alert').filter({
        hasText: /failed|error|invalid|incorrect/i,
      })
    ).toBeVisible({ timeout: 5000 });

    // Should NOT show lockout yet (only 1 attempt)
    const errorText1 = await page
      .getByRole('alert')
      .filter({ hasText: /.+/ })
      .textContent();
    expect(errorText1).not.toMatch(/too many|locked|rate.*limit/i);

    // Second attempt
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(
      page.getByRole('alert').filter({
        hasText: /failed|error|invalid|incorrect/i,
      })
    ).toBeVisible({ timeout: 5000 });

    // Still not locked
    const errorText2 = await page
      .getByRole('alert')
      .filter({ hasText: /.+/ })
      .textContent();
    expect(errorText2).not.toMatch(/too many|locked|rate.*limit/i);
  });

  test('should track different users independently', async ({ browser }) => {
    const userA = generateBruteForceEmail('userA');
    const userB = generateBruteForceEmail('userB');

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Lock out User A
    await pageA.goto('/sign-in');
    await dismissCookieBanner(pageA);
    for (let i = 0; i < 5; i++) {
      await pageA.getByLabel('Email').fill(userA);
      await pageA.getByLabel('Password', { exact: true }).fill(wrongPassword);
      await pageA.getByRole('button', { name: 'Sign In' }).click();
      await pageA.waitForTimeout(300);
    }

    // User A should be locked
    await pageA.getByLabel('Email').fill(userA);
    await pageA.getByLabel('Password', { exact: true }).fill(wrongPassword);
    await pageA.getByRole('button', { name: 'Sign In' }).click();
    await expect(
      pageA.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 5000 });

    // User B should still be able to attempt
    await pageB.goto('/sign-in');
    await dismissCookieBanner(pageB);
    await pageB.getByLabel('Email').fill(userB);
    await pageB.getByLabel('Password', { exact: true }).fill(wrongPassword);
    await pageB.getByRole('button', { name: 'Sign In' }).click();

    // User B should see normal error, not rate limit
    const errorAlertB = pageB.getByRole('alert').filter({ hasText: /.+/ });
    await expect(errorAlertB).toBeVisible({ timeout: 5000 });
    const errorTextB = await errorAlertB.textContent();
    expect(errorTextB).toMatch(/invalid|incorrect|failed/i);
    expect(errorTextB).not.toMatch(/too many|locked|rate.*limit/i);

    await contextA.close();
    await contextB.close();
  });

  test('should track different attempt types independently', async ({
    page,
  }) => {
    const email = generateBruteForceEmail('types');

    // Lock out sign_in attempts
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForTimeout(300);
    }

    // sign_in should be locked
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(
      page.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 5000 });

    // But sign_up should still work (different attempt type)
    await page.goto('/sign-up');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(email);
    await page
      .getByLabel('Password', { exact: true })
      .fill('ValidPassword123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Wait for response - should NOT show rate limit
    await page.waitForTimeout(1000);
    const alerts = await page
      .getByRole('alert')
      .filter({ hasText: /.+/ })
      .all();
    for (const alert of alerts) {
      const text = await alert.textContent();
      expect(text).not.toMatch(/too many|locked|rate.*limit/i);
    }
  });

  test('should not bypass rate limiting by clearing localStorage', async ({
    page,
  }) => {
    const email = generateBruteForceEmail('bypass');

    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForTimeout(300);
    }

    // Clear localStorage (client-side bypass attempt)
    await page.evaluate(() => localStorage.clear());

    // Try again - should STILL be locked (server-side enforcement)
    await page.reload();
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(
      page.getByRole('alert').filter({
        hasText: /too many|locked|rate.*limit/i,
      })
    ).toBeVisible({ timeout: 5000 });
  });

  test('should display lockout expiration time', async ({ page }) => {
    const email = generateBruteForceEmail('lockout-time');

    await page.goto('/sign-in');
    await dismissCookieBanner(page);

    // Trigger lockout
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForTimeout(300);
    }

    // Attempt again
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(wrongPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should show when user can try again
    const errorAlert = page.getByRole('alert').filter({
      hasText: /too many|locked|rate.*limit/i,
    });
    await expect(errorAlert).toBeVisible({ timeout: 5000 });

    const errorMessage = await errorAlert.textContent();
    expect(errorMessage).toBeTruthy();
    // Message should contain time information
    expect(errorMessage).toMatch(/15|minutes?|try.*again|wait/i);
  });
});
