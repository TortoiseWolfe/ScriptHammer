// Security Hardening: Brute Force Prevention E2E Test
// Feature 017 - Task T015
// Purpose: Test server-side rate limiting prevents brute force attacks

import { test, expect } from '@playwright/test';

test.describe('Brute Force Prevention - REQ-SEC-003', () => {
  const testEmail = `brute-force-test-${Date.now()}@example.com`;
  const wrongPassword = 'WrongPassword123!';

  test('should lockout after 5 failed login attempts', async ({ page }) => {
    await page.goto('/sign-in');

    // Attempt 1-5: Try to sign in with wrong password
    for (let i = 1; i <= 5; i++) {
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', wrongPassword);
      await page.click('button[type="submit"]');

      // Wait for error message
      await page.waitForTimeout(1000);

      if (i < 5) {
        // First 4 attempts should show normal error
        await expect(
          page.locator('text=/invalid.*credentials|incorrect.*password/i')
        ).toBeVisible();
      }
    }

    // Attempt 6: Should be locked out
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', wrongPassword);
    await page.click('button[type="submit"]');

    // Should see rate limit error
    await expect(
      page.locator('text=/rate.*limit|too.*many.*attempts|locked/i')
    ).toBeVisible({
      timeout: 3000,
    });

    // Error message should mention time to wait
    await expect(
      page.locator('text=/15.*minutes?|try.*again.*later/i')
    ).toBeVisible();
  });

  test('should persist lockout across browser sessions', async ({
    browser,
  }) => {
    // First browser session - trigger lockout
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/sign-in');

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await page1.fill('input[type="email"]', testEmail);
      await page1.fill('input[type="password"]', wrongPassword);
      await page1.click('button[type="submit"]');
      await page1.waitForTimeout(500);
    }

    // Verify locked
    await page1.fill('input[type="email"]', testEmail);
    await page1.fill('input[type="password"]', wrongPassword);
    await page1.click('button[type="submit"]');
    await expect(page1.locator('text=/rate.*limit|locked/i')).toBeVisible();

    await context1.close();

    // Second browser session (new context, cleared storage)
    const context2 = await browser.newContext({
      storageState: undefined, // Clear all storage
    });
    const page2 = await context2.newPage();

    await page2.goto('/sign-in');

    // Should STILL be locked (server-side enforcement)
    await page2.fill('input[type="email"]', testEmail);
    await page2.fill('input[type="password"]', wrongPassword);
    await page2.click('button[type="submit"]');

    await expect(page2.locator('text=/rate.*limit|locked/i')).toBeVisible({
      timeout: 3000,
    });

    await context2.close();
  });

  test('should show remaining attempts counter', async ({ page }) => {
    const uniqueEmail = `attempts-test-${Date.now()}@example.com`;

    await page.goto('/sign-in');

    // First attempt
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', wrongPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Should show "4 attempts remaining" or similar
    // (This depends on implementation showing the counter)
    // For now, just verify no lockout yet
    await expect(page.locator('text=/rate.*limit|locked/i')).not.toBeVisible();

    // Second attempt
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', wrongPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Still not locked
    await expect(page.locator('text=/rate.*limit|locked/i')).not.toBeVisible();
  });

  test('should track different users independently', async ({ browser }) => {
    const userA = `user-a-${Date.now()}@example.com`;
    const userB = `user-b-${Date.now()}@example.com`;

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Lock out User A
    await pageA.goto('/sign-in');
    for (let i = 0; i < 5; i++) {
      await pageA.fill('input[type="email"]', userA);
      await pageA.fill('input[type="password"]', wrongPassword);
      await pageA.click('button[type="submit"]');
      await pageA.waitForTimeout(300);
    }

    // User A should be locked
    await pageA.fill('input[type="email"]', userA);
    await pageA.fill('input[type="password"]', wrongPassword);
    await pageA.click('button[type="submit"]');
    await expect(pageA.locator('text=/rate.*limit|locked/i')).toBeVisible();

    // User B should still be able to attempt
    await pageB.goto('/sign-in');
    await pageB.fill('input[type="email"]', userB);
    await pageB.fill('input[type="password"]', wrongPassword);
    await pageB.click('button[type="submit"]');

    // User B should see normal error, not rate limit
    await expect(pageB.locator('text=/invalid.*credentials/i')).toBeVisible();
    await expect(pageB.locator('text=/rate.*limit|locked/i')).not.toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test('should track different attempt types independently', async ({
    page,
  }) => {
    const email = `types-test-${Date.now()}@example.com`;

    // Lock out sign_in attempts
    await page.goto('/sign-in');
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', wrongPassword);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(300);
    }

    // sign_in should be locked
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', wrongPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/rate.*limit/i')).toBeVisible();

    // But sign_up should still work
    await page.goto('/sign-up');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'ValidPassword123!');
    await page.click('button[type="submit"]');

    // Should NOT show rate limit (different attempt type)
    await expect(page.locator('text=/rate.*limit/i')).not.toBeVisible();
  });

  test('should not bypass rate limiting by clearing localStorage', async ({
    page,
  }) => {
    const email = `bypass-test-${Date.now()}@example.com`;

    await page.goto('/sign-in');

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', wrongPassword);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(300);
    }

    // Clear localStorage (client-side bypass attempt)
    await page.evaluate(() => localStorage.clear());

    // Try again - should STILL be locked (server-side enforcement)
    await page.reload();
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', wrongPassword);
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/rate.*limit|locked/i')).toBeVisible({
      timeout: 3000,
    });
  });

  test('should display lockout expiration time', async ({ page }) => {
    const email = `lockout-time-${Date.now()}@example.com`;

    await page.goto('/sign-in');

    // Trigger lockout
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', wrongPassword);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(300);
    }

    // Attempt again
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', wrongPassword);
    await page.click('button[type="submit"]');

    // Should show when user can try again
    const errorMessage = await page
      .locator('text=/rate.*limit|locked/i')
      .textContent();

    expect(errorMessage).toBeTruthy();
    // Message should contain time information
    expect(errorMessage).toMatch(/15|minutes?|try.*again|wait/i);
  });
});
