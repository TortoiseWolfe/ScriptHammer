/**
 * E2E Test: User Registration Flow (T066)
 *
 * Tests the complete registration journey from quickstart.md:
 * sign-up → verify email → sign-in → access protected pages
 */

import { test, expect } from '@playwright/test';
import {
  generateTestEmail,
  dismissCookieBanner,
  DEFAULT_TEST_PASSWORD,
} from '../utils/test-user-factory';

test.describe('User Registration E2E', () => {
  const testEmail = generateTestEmail('registration');
  const testPassword = DEFAULT_TEST_PASSWORD;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissCookieBanner(page);
  });

  // Skip: Requires real Supabase user creation - run with proper env setup
  test.skip('should complete full registration flow from sign-up to protected access', async ({
    page,
  }) => {
    // Step 1: Navigate to sign-up page
    await page.goto('/sign-up');
    await expect(page).toHaveURL(/\/sign-up\/?$/);
    await expect(
      page.getByRole('heading', { name: 'Create Account' })
    ).toBeVisible();

    // Step 2: Fill sign-up form
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);

    // Step 3: Check Remember Me (optional)
    await page.getByLabel('Remember Me').check();

    // Step 4: Submit sign-up form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Step 5: Verify redirected to verify-email or profile
    // Note: In development, email verification might be disabled
    await page.waitForURL(/\/(verify-email|profile)/);

    // Step 6: If on verify-email page, check for verification notice
    if (page.url().includes('verify-email')) {
      await expect(page.getByText(/check your inbox/i)).toBeVisible();

      // In real scenario, user would click link in email
      // For E2E test, we can skip to profile if email verification is disabled
    }

    // Step 7: Navigate to profile (protected route)
    await page.goto('/profile');

    // Step 8: Verify user is authenticated and can access profile
    await expect(page.getByText(testEmail)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

    // Step 9: Verify payment demo access (another protected route)
    await page.goto('/payment-demo');
    await expect(page).toHaveURL('/payment-demo');
    await expect(
      page.getByRole('heading', { name: 'Payment Integration Demo' })
    ).toBeVisible();

    // Step 10: Sign out
    await page.getByRole('button', { name: 'Sign Out' }).click();

    // Step 11: Verify redirected to sign-in
    await page.waitForURL('/sign-in');
    await expect(page).toHaveURL('/sign-in');

    // Clean up: Delete test user (would need admin API or manual cleanup)
  });

  test('should show validation errors for invalid TLD email', async ({
    page,
  }) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Fill with email that has invalid TLD (passes browser validation, fails our TLD check)
    // Browser validates format, our validator checks TLD against allowed list
    await page.getByLabel('Email').fill('test@example.xyz123');
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown (invalid TLD not in allowed list)
    await expect(page.getByText(/invalid.*domain/i)).toBeVisible();
  });

  test('should show validation errors for weak password', async ({ page }) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Fill with weak password
    const weakEmail = generateTestEmail('weak-pass');
    await page.getByLabel('Email').fill(weakEmail);
    await page.getByLabel('Password', { exact: true }).fill('weak');
    await page.getByLabel('Confirm Password').fill('weak');

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown
    await expect(
      page.getByText(/password must be at least 8 characters/i)
    ).toBeVisible();
  });

  test('should show error for password mismatch', async ({ page }) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Fill with mismatched passwords
    const mismatchEmail = generateTestEmail('mismatch');
    await page.getByLabel('Email').fill(mismatchEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill('DifferentPass123!');

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should navigate to sign-in from sign-up page', async ({ page }) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Click sign-in link in the "Already have an account?" section (not the header link)
    // Use locator that targets the link after the specific text
    await page
      .locator('text=Already have an account?')
      .locator('..')
      .getByRole('link')
      .click();

    // Verify navigated to sign-in (with optional trailing slash)
    await expect(page).toHaveURL(/\/sign-in\/?/);
  });

  test('should display OAuth buttons on sign-up page', async ({ page }) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Verify OAuth buttons present (buttons say "Continue with X")
    await expect(
      page.getByRole('button', { name: /continue with github/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continue with google/i })
    ).toBeVisible();
  });
});
