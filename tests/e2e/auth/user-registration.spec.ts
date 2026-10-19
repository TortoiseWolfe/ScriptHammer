/**
 * E2E Test: User Registration Flow (T066)
 *
 * Client-side validation and navigation on the sign-up page. The full
 * sign-up and confirm-email journey is covered by
 * tests/e2e/signup-mailer/signup-confirm.spec.ts.
 *
 * Email domain is derived from TEST_USER_PRIMARY_EMAIL.
 */

import { test, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  DEFAULT_TEST_PASSWORD,
} from '../utils/test-user-factory';

/**
 * Generate a test email for registration tests.
 * Derives domain from TEST_USER_PRIMARY_EMAIL to ensure valid emails.
 */
function generateRegistrationEmail(prefix: string): string {
  const baseEmail = process.env.TEST_USER_PRIMARY_EMAIL || '';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  // Derive domain from primary test user
  if (baseEmail.includes('@gmail.com')) {
    const baseUser = baseEmail.split('+')[0] || baseEmail.split('@')[0];
    return `${baseUser}+reg-${prefix}-${timestamp}-${random}@gmail.com`;
  }

  const domain = baseEmail.split('@')[1] || 'example.com';
  return `reg-${prefix}-${timestamp}-${random}@${domain}`;
}

test.describe('User Registration E2E', () => {
  const testPassword = DEFAULT_TEST_PASSWORD;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
  });

  test('should show validation errors for invalid TLD email', async ({
    page,
  }) => {
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
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
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Fill with weak password
    const weakEmail = generateRegistrationEmail('weak-pass');
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
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Fill with mismatched passwords
    const mismatchEmail = generateRegistrationEmail('mismatch');
    await page.getByLabel('Email').fill(mismatchEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill('DifferentPass123!');

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should navigate to sign-in from sign-up page', async ({ page }) => {
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
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
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
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
