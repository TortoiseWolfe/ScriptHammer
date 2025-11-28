/**
 * E2E Test: User Registration Flow (T066)
 *
 * Tests the complete registration journey from quickstart.md:
 * sign-up → verify email → sign-in → access protected pages
 */

import { test, expect } from '@playwright/test';

test.describe('User Registration E2E', () => {
  const testEmail = `e2e-registration-${Date.now()}@example.com`;
  const testPassword = 'ValidPass123!';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should complete full registration flow from sign-up to protected access', async ({
    page,
  }) => {
    // Step 1: Navigate to sign-up page
    await page.goto('/sign-up');
    await expect(page).toHaveURL('/sign-up');
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();

    // Step 2: Fill sign-up form
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
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

  test('should show validation errors for invalid email', async ({ page }) => {
    await page.goto('/sign-up');

    // Fill with invalid email
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown
    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test('should show validation errors for weak password', async ({ page }) => {
    await page.goto('/sign-up');

    // Fill with weak password
    await page.getByLabel('Email').fill(`${Date.now()}@example.com`);
    await page.getByLabel('Password').fill('weak');
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

    // Fill with mismatched passwords
    await page.getByLabel('Email').fill(`${Date.now()}@example.com`);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Confirm Password').fill('DifferentPass123!');

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should navigate to sign-in from sign-up page', async ({ page }) => {
    await page.goto('/sign-up');

    // Click sign-in link
    await page.getByRole('link', { name: /already have an account/i }).click();

    // Verify navigated to sign-in
    await expect(page).toHaveURL('/sign-in');
  });

  test('should display OAuth buttons on sign-up page', async ({ page }) => {
    await page.goto('/sign-up');

    // Verify OAuth buttons present
    await expect(
      page.getByRole('button', { name: /sign up with github/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /sign up with google/i })
    ).toBeVisible();
  });
});
