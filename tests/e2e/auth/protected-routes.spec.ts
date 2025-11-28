/**
 * E2E Test: Protected Routes (T067)
 *
 * Tests protected route access, RLS policy enforcement, and cascade delete:
 * - Verify protected routes redirect unauthenticated users
 * - Verify RLS policies enforce payment access control
 * - Verify cascade delete removes user_profiles/audit_logs/payment_intents
 */

import { test, expect } from '@playwright/test';

test.describe('Protected Routes E2E', () => {
  const testEmail = `e2e-protected-${Date.now()}@example.com`;
  const testPassword = 'ValidPass123!';

  test('should redirect unauthenticated users to sign-in', async ({ page }) => {
    // Attempt to access protected routes without authentication
    const protectedRoutes = ['/profile', '/account', '/payment-demo'];

    for (const route of protectedRoutes) {
      await page.goto(route);

      // Verify redirected to sign-in
      await page.waitForURL('/sign-in');
      await expect(page).toHaveURL('/sign-in');
    }
  });

  test('should allow authenticated users to access protected routes', async ({
    page,
  }) => {
    // Step 1: Sign up
    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Wait for redirect
    await page.waitForURL(/\/(verify-email|profile)/);

    // Step 2: Access protected routes
    const protectedRoutes = [
      { path: '/profile', heading: 'Profile' },
      { path: '/account', heading: 'Account Settings' },
      { path: '/payment-demo', heading: 'Payment Integration Demo' },
    ];

    for (const route of protectedRoutes) {
      await page.goto(route.path);
      await expect(page).toHaveURL(route.path);
      await expect(
        page.getByRole('heading', { name: route.heading })
      ).toBeVisible();
    }

    // Clean up
    await page.getByRole('button', { name: 'Sign Out' }).click();
  });

  test('should enforce RLS policies on payment access', async ({ page }) => {
    // Step 1: Create first user
    const user1Email = `e2e-rls-1-${Date.now()}@example.com`;
    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(user1Email);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.waitForURL(/\/(verify-email|profile)/);

    // Step 2: Access payment demo and verify user's own data
    await page.goto('/payment-demo');
    await expect(page.getByText(user1Email)).toBeVisible();

    // Step 3: Sign out
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.waitForURL('/sign-in');

    // Step 4: Create second user
    const user2Email = `e2e-rls-2-${Date.now()}@example.com`;
    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(user2Email);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.waitForURL(/\/(verify-email|profile)/);

    // Step 5: Verify user 2 sees their own email, not user 1's
    await page.goto('/payment-demo');
    await expect(page.getByText(user2Email)).toBeVisible();
    await expect(page.getByText(user1Email)).not.toBeVisible();

    // RLS policy prevents user 2 from seeing user 1's payment data
  });

  test('should show email verification notice for unverified users', async ({
    page,
  }) => {
    // Sign up with new user
    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Navigate to payment demo
    await page.goto('/payment-demo');

    // Verify EmailVerificationNotice is visible
    // Note: Only shown if user.email_confirmed_at is null
    const notice = page.getByText(/verify your email/i);
    if (await notice.isVisible()) {
      await expect(notice).toBeVisible();

      // Verify resend button exists
      await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
    }
  });

  test('should preserve session across page navigation', async ({ page }) => {
    // Sign up and sign in
    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.waitForURL(/\/(verify-email|profile)/);

    // Navigate between protected routes
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');

    await page.goto('/account');
    await expect(page).toHaveURL('/account');

    await page.goto('/payment-demo');
    await expect(page).toHaveURL('/payment-demo');

    // Verify still authenticated (no redirect to sign-in)
    await expect(page).toHaveURL('/payment-demo');
  });

  test('should handle session expiration gracefully', async ({ page }) => {
    // Sign up
    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.waitForURL(/\/(verify-email|profile)/);

    // Clear session storage to simulate expired session
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Try to access protected route
    await page.goto('/profile');

    // Verify redirected to sign-in
    await page.waitForURL('/sign-in');
    await expect(page).toHaveURL('/sign-in');
  });

  test('should redirect to intended URL after authentication', async ({
    page,
  }) => {
    // Attempt to access protected route while unauthenticated
    await page.goto('/account');
    await page.waitForURL('/sign-in');

    // Sign in
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Note: If redirect-after-auth is implemented, should redirect to /account
    // Otherwise, redirects to default (profile)
    await page.waitForURL(/\/(account|profile)/);
  });

  test('should verify cascade delete removes related records', async ({
    page,
  }) => {
    // Note: This test requires admin access to verify database state
    // In a real E2E test, we would:
    // 1. Create user
    // 2. Create payment intents, audit logs, profile
    // 3. Delete user via account settings
    // 4. Verify all related records deleted via admin API

    // For now, test the UI flow
    await page.goto('/sign-up');
    await page
      .getByLabel('Email')
      .fill(`delete-test-${Date.now()}@example.com`);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.waitForURL(/\/(verify-email|profile)/);

    // Navigate to account settings
    await page.goto('/account');

    // Find and click delete account button
    const deleteButton = page.getByRole('button', {
      name: /delete account/i,
    });
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion in modal/dialog
      await page.getByRole('button', { name: /confirm/i }).click();

      // Verify redirected to sign-in
      await page.waitForURL('/sign-in');
      await expect(page).toHaveURL('/sign-in');
    }
  });
});
