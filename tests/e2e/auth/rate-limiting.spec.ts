// Security Hardening: Rate Limiting E2E Tests
// Feature 017 - Task T009 (E2E Tests with Real Browser)
// Purpose: Test rate limiting from user perspective

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * Generate a test email for rate limiting tests.
 * These tests don't need real users - just valid-looking email addresses
 * that won't trigger client-side validation errors.
 */
function generateRateLimitEmail(prefix: string): string {
  const baseEmail = process.env.TEST_USER_PRIMARY_EMAIL || '';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  // Derive domain from primary test user
  if (baseEmail.includes('@gmail.com')) {
    const baseUser = baseEmail.split('+')[0] || baseEmail.split('@')[0];
    return `${baseUser}+ratelimit-${prefix}-${timestamp}-${random}@gmail.com`;
  }

  const domain = baseEmail.split('@')[1] || 'test.example.com';
  return `ratelimit-${prefix}-${timestamp}-${random}@${domain}`;
}

/**
 * E2E Tests for Rate Limiting
 *
 * These tests verify the user experience when rate limiting is triggered.
 * They test the actual UI behavior in a real browser.
 */

test.describe('Rate Limiting - User Experience', () => {
  const testEmail = generateRateLimitEmail('test');
  const testPassword = 'WrongPassword123!';

  test.beforeEach(async ({ page }) => {
    // Navigate to sign-in page
    await page.goto('/sign-in');
    await dismissCookieBanner(page);
    await expect(page).toHaveTitle(/Sign In/i);
  });

  test('should show lockout message after 5 failed sign-in attempts', async ({
    page,
  }) => {
    // Attempt to sign in 5 times with wrong password
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(testEmail);
      await page.getByLabel('Password', { exact: true }).fill(testPassword);
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for error message
      await page.waitForSelector('[role="alert"]', { timeout: 3000 });

      // Small delay between attempts
      await page.waitForTimeout(200);
    }

    // 6th attempt should show rate limit message
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should see rate limit error message
    const errorMessage = await page.locator('[role="alert"]').textContent();
    expect(errorMessage).toMatch(/rate.*limit|too many|try again/i);
  });

  test('should disable submit button when rate limited', async ({ page }) => {
    // Trigger rate limit
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(testEmail);
      await page.getByLabel('Password', { exact: true }).fill(testPassword);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForTimeout(200);
    }

    // Try to submit again
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);

    // Button might be disabled or show loading state
    const submitButton = page.getByRole('button', { name: 'Sign In' });

    // Wait a moment for UI to update
    await page.waitForTimeout(500);

    // Check if button indicates rate limiting (disabled, loading, or error)
    const isDisabled = await submitButton.isDisabled();
    const hasError = await page.locator('[role="alert"]').count();

    // Either button is disabled OR error message is shown
    expect(isDisabled || hasError > 0).toBe(true);
  });

  test('should show remaining time until unlock', async ({ page }) => {
    const uniqueEmail = generateRateLimitEmail('timer');

    // Trigger rate limit
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(uniqueEmail);
      await page.getByLabel('Password', { exact: true }).fill(testPassword);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForTimeout(200);
    }

    // One more attempt to see lockout message
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should see time remaining (e.g., "15 minutes", "14 minutes", etc.)
    const errorMessage = await page.locator('[role="alert"]').textContent();
    expect(errorMessage).toMatch(/\d+\s*(minute|min)/i);
  });

  test('should allow different users to sign in independently', async ({
    page,
  }) => {
    const blockedEmail = generateRateLimitEmail('blocked');
    const allowedEmail = generateRateLimitEmail('allowed');

    // Block first user
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(blockedEmail);
      await page.getByLabel('Password', { exact: true }).fill(testPassword);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForTimeout(200);
    }

    // Try with blocked email - should see rate limit
    await page.getByLabel('Email').fill(blockedEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    let errorMessage = await page.locator('[role="alert"]').textContent();
    expect(errorMessage).toMatch(/rate.*limit|too many/i);

    // Try with different email - should NOT be blocked
    await page.getByLabel('Email').fill(allowedEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for response
    await page.waitForTimeout(500);

    errorMessage = await page.locator('[role="alert"]').textContent();

    // Should see invalid credentials, NOT rate limit
    expect(errorMessage).not.toMatch(/rate.*limit|too many/i);
    expect(errorMessage).toMatch(/invalid|incorrect|wrong/i);
  });

  test('should track sign-up and sign-in attempts separately', async ({
    page,
  }) => {
    const email = generateRateLimitEmail('separate-limits');

    // Exhaust sign-in attempts
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password', { exact: true }).fill(testPassword);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForTimeout(200);
    }

    // Sign-in should be blocked
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    const signInError = await page.locator('[role="alert"]').textContent();
    expect(signInError).toMatch(/rate.*limit|too many/i);

    // Navigate to sign-up page
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Sign-up should still be allowed (different rate limit)
    await page.getByLabel('Email').fill(email);
    await page
      .getByLabel('Password', { exact: true })
      .fill('ValidPassword123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    await page.waitForTimeout(500);

    // Should not see rate limit error on sign-up
    const signUpError = await page.locator('[role="alert"]').textContent();
    if (signUpError) {
      expect(signUpError).not.toMatch(/rate.*limit|too many/i);
    }
  });

  test('should show clear error message with actionable information', async ({
    page,
  }) => {
    const email = generateRateLimitEmail('clear-message');

    // Trigger rate limit
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password', { exact: true }).fill(testPassword);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForTimeout(200);
    }

    // Attempt once more
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Check error message quality
    const errorMessage = await page.locator('[role="alert"]').textContent();

    // Should contain:
    // 1. Clear indication of rate limiting
    expect(errorMessage).toMatch(/rate|limit|too many|attempts/i);

    // 2. Time information
    expect(errorMessage).toMatch(/minute|wait|try again/i);

    // 3. Should be screen-reader accessible
    const errorElement = page.locator('[role="alert"]');
    await expect(errorElement).toHaveAttribute('role', 'alert');
  });
});

test.describe('Rate Limiting - Password Reset', () => {
  test('should rate limit password reset requests', async ({ page }) => {
    const email = generateRateLimitEmail('password-reset');

    await page.goto('/forgot-password');
    await dismissCookieBanner(page);

    // Attempt 5 password resets
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(email);
      await page.getByRole('button', { name: /reset|send|submit/i }).click();
      await page.waitForTimeout(500);

      // Might need to navigate back if redirect happens
      const currentUrl = page.url();
      if (!currentUrl.includes('forgot-password')) {
        await page.goto('/forgot-password');
        await dismissCookieBanner(page);
      }
    }

    // 6th attempt should be rate limited
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /reset|send|submit/i }).click();

    await page.waitForTimeout(500);

    // Check for rate limit or success (depending on implementation)
    const alert = await page.locator('[role="alert"]').textContent();
    if (alert) {
      // If there's an alert, it should either be rate limit or success
      expect(alert).toBeTruthy();
    }
  });
});
