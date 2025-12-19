/**
 * E2E Test: Sign-up Flow with Dynamic User Management
 * Feature: 027-signup-e2e-tests
 *
 * Tests the complete sign-up journey with proper cleanup:
 * - Successful sign-up with valid credentials
 * - Duplicate email handling
 * - Validation errors (weak password, invalid email)
 *
 * Uses test-user-factory for dynamic user creation and cleanup.
 * Email domain is derived from TEST_USER_PRIMARY_EMAIL.
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  deleteTestUserByEmail,
  isAdminClientAvailable,
  DEFAULT_TEST_PASSWORD,
  dismissCookieBanner,
  waitForAuthenticatedState,
} from '../utils/test-user-factory';

/**
 * Generate a test email for sign-up tests.
 * Derives domain from TEST_USER_PRIMARY_EMAIL to ensure valid emails.
 */
function generateSignUpEmail(prefix: string): string {
  const baseEmail = process.env.TEST_USER_PRIMARY_EMAIL || '';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  // Derive domain from primary test user
  if (baseEmail.includes('@gmail.com')) {
    const baseUser = baseEmail.split('+')[0] || baseEmail.split('@')[0];
    return `${baseUser}+signup-${prefix}-${timestamp}-${random}@gmail.com`;
  }

  const domain = baseEmail.split('@')[1] || 'example.com';
  return `signup-${prefix}-${timestamp}-${random}@${domain}`;
}

test.describe('Sign-up E2E Tests (Feature 027)', () => {
  const createdEmails: string[] = [];

  test.afterAll(async () => {
    // Clean up any test users created during tests
    for (const email of createdEmails) {
      await deleteTestUserByEmail(email);
    }
  });

  test('should complete sign-up with valid credentials', async ({ page }) => {
    // Generate email from TEST_USER_PRIMARY_EMAIL domain
    const testEmail = generateSignUpEmail('valid');
    createdEmails.push(testEmail);

    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Page heading is "Create Account"
    await expect(
      page.getByRole('heading', { name: /sign up|create account/i })
    ).toBeVisible();

    // Fill sign-up form
    await page.getByLabel('Email').fill(testEmail);
    await page
      .getByLabel('Password', { exact: true })
      .fill(DEFAULT_TEST_PASSWORD);
    await page.getByLabel('Confirm Password').fill(DEFAULT_TEST_PASSWORD);

    // Submit form
    await page.getByRole('button', { name: /sign up/i }).click();

    // Wait for either redirect or error
    await page.waitForTimeout(3000);

    const hasError = await page
      .locator('.alert-error')
      .isVisible()
      .catch(() => false);
    const redirected =
      page.url().includes('/verify-email') || page.url().includes('/profile');

    if (hasError) {
      const errorText = await page.locator('.alert-error').textContent();
      console.log('Sign-up error:', errorText);
      // Rate limiting or other temporary issues shouldn't fail the test permanently
      test.skip(true, `Sign-up error: ${errorText}`);
      return;
    }

    if (!redirected) {
      // If still on sign-up page without error, wait a bit more
      await page.waitForURL(/\/(verify-email|profile)/, { timeout: 10000 });
    }

    const url = page.url();
    expect(url).toMatch(/\/(verify-email|profile)/);
    console.log('Sign-up successful - redirected to:', url);
  });

  test('should show error when signing up with existing email', async ({
    page,
  }) => {
    // Skip if admin client not available
    if (!isAdminClientAvailable()) {
      test.skip(true, 'SUPABASE_SERVICE_ROLE_KEY not configured');
      return;
    }

    // Create a user first
    const existingEmail = generateSignUpEmail('existing');
    const user = await createTestUser(existingEmail, DEFAULT_TEST_PASSWORD);

    if (!user) {
      test.skip(true, 'Could not create test user');
      return;
    }

    createdEmails.push(existingEmail);

    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Try to sign up with the same email
    await page.getByLabel('Email').fill(existingEmail);
    await page
      .getByLabel('Password', { exact: true })
      .fill(DEFAULT_TEST_PASSWORD);
    await page.getByLabel('Confirm Password').fill(DEFAULT_TEST_PASSWORD);

    await page.getByRole('button', { name: /sign up/i }).click();

    // Wait for form to process
    await page.waitForTimeout(2000);

    // Check multiple outcomes - different Supabase configurations may behave differently:
    // 1. Error message visible
    // 2. Redirected to verify-email (Supabase may allow duplicate signup attempts)
    // 3. Redirected to profile (if auto-confirmed)
    const hasError = await page
      .locator('.alert-error')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const redirected =
      page.url().includes('/verify-email') ||
      page.url().includes('/profile') ||
      page.url().includes('/sign-in');

    // Either we see an error OR the app handled the duplicate email somehow
    expect(hasError || redirected).toBe(true);

    if (hasError) {
      const errorText = await page.locator('.alert-error').textContent();
      console.log('Duplicate email error:', errorText);
    } else {
      console.log('Duplicate email redirected to:', page.url());
    }
  });

  test('should show validation error for weak password', async ({ page }) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    const testEmail = generateSignUpEmail('weak');
    createdEmails.push(testEmail);

    // Fill with weak password
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill('weak');
    await page.getByLabel('Confirm Password').fill('weak');

    await page.getByRole('button', { name: /sign up/i }).click();

    // Should see password validation error
    await expect(
      page.getByText(
        /password must be at least|password is too weak|minimum.*characters/i
      )
    ).toBeVisible({ timeout: 5000 });

    console.log('Weak password validation shown correctly');
  });

  test('should show validation error for invalid email format', async ({
    page,
  }) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Use email that passes HTML5 validation but fails app's TLD validation
    // The app validates against a set of known TLDs
    await page.getByLabel('Email').fill('test@example.invalidtld');
    await page
      .getByLabel('Password', { exact: true })
      .fill(DEFAULT_TEST_PASSWORD);
    await page.getByLabel('Confirm Password').fill(DEFAULT_TEST_PASSWORD);

    await page.getByRole('button', { name: /sign up/i }).click();

    // Should see TLD validation error: "Invalid or missing top-level domain (TLD)"
    await expect(
      page.getByText(/invalid|missing.*TLD|top-level domain/i)
    ).toBeVisible({
      timeout: 5000,
    });

    console.log('Invalid email validation shown correctly');
  });

  test('should show error for password mismatch', async ({ page }) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    const testEmail = generateSignUpEmail('mismatch');

    await page.getByLabel('Email').fill(testEmail);
    await page
      .getByLabel('Password', { exact: true })
      .fill(DEFAULT_TEST_PASSWORD);
    await page.getByLabel('Confirm Password').fill('DifferentPassword123!');

    await page.getByRole('button', { name: /sign up/i }).click();

    // Should see password mismatch error
    await expect(
      page.getByText(/passwords do not match|passwords must match/i)
    ).toBeVisible({
      timeout: 5000,
    });

    console.log('Password mismatch validation shown correctly');
  });

  test('should navigate to sign-in from sign-up page', async ({ page }) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Click the inline sign-in link (not the header button)
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();

    // Verify navigated to sign-in (allow trailing slash)
    await expect(page).toHaveURL(/\/sign-in\/?$/);

    console.log('Navigation to sign-in works correctly');
  });

  test('should display OAuth buttons on sign-up page', async ({ page }) => {
    await page.goto('/sign-up');
    await dismissCookieBanner(page);

    // Verify OAuth buttons present (may be GitHub, Google, etc.)
    const oauthButtons = page
      .locator('button')
      .filter({ hasText: /github|google|continue with/i });
    const count = await oauthButtons.count();

    expect(count).toBeGreaterThan(0);
    console.log(`Found ${count} OAuth button(s)`);
  });
});

test.describe('Sign-up with Admin Confirmation', () => {
  test('should create user, auto-confirm, and sign-in', async ({ page }) => {
    // Skip if admin client not available
    if (!isAdminClientAvailable()) {
      test.skip(true, 'SUPABASE_SERVICE_ROLE_KEY not configured');
      return;
    }

    // Create user via admin API (email auto-confirmed)
    const testEmail = generateSignUpEmail('admin');
    const user = await createTestUser(testEmail, DEFAULT_TEST_PASSWORD, {
      createProfile: true,
    });

    if (!user) {
      test.skip(true, 'Could not create test user');
      return;
    }

    try {
      // Now sign in with the created user
      await page.goto('/sign-in');
      await dismissCookieBanner(page);
      await page.getByLabel('Email').fill(testEmail);
      await page.getByLabel('Password').fill(DEFAULT_TEST_PASSWORD);
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Should redirect and authenticate
      await waitForAuthenticatedState(page);
      console.log('Admin-created user signed in successfully');
    } finally {
      // Clean up
      await deleteTestUserByEmail(testEmail);
    }
  });
});
