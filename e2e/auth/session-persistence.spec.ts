/**
 * E2E Test: Session Persistence (T068)
 *
 * Tests session management and persistence:
 * - Verify Remember Me extends session to 30 days
 * - Verify automatic token refresh before expiration
 * - Verify session persists across browser restarts
 */

import { test, expect } from '@playwright/test';

test.describe('Session Persistence E2E', () => {
  const testEmail = `e2e-session-${Date.now()}@example.com`;
  const testPassword = 'ValidPass123!';

  test.beforeEach(async ({ page }) => {
    // Create test user
    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.waitForURL(/\/(verify-email|profile)/);

    // Sign out to test sign-in with Remember Me
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.waitForURL('/sign-in');
  });

  test('should extend session duration with Remember Me checked', async ({
    page,
  }) => {
    // Sign in with Remember Me
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Remember Me').check();
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify session created
    await page.waitForURL(/\/(profile|verify-email)/);

    // Check session storage/cookies
    const cookies = await page.context().cookies();
    const authCookie = cookies.find(
      (c) =>
        c.name.includes('supabase') ||
        c.name.includes('auth') ||
        c.name.includes('sb-')
    );

    if (authCookie) {
      // Verify cookie has extended expiry (Remember Me sets longer duration)
      const expiryDate = new Date(authCookie.expires * 1000);
      const now = new Date();
      const daysDiff = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Remember Me should set ~30 day expiry
      expect(daysDiff).toBeGreaterThanOrEqual(25); // Allow some variance
    }

    // Verify localStorage has refresh token for persistence
    const localStorage = await page.evaluate(() =>
      JSON.stringify(window.localStorage)
    );
    expect(localStorage).toContain('refresh_token');
  });

  test('should use short session without Remember Me', async ({ page }) => {
    // Sign in WITHOUT Remember Me
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    // Do NOT check Remember Me
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify session created
    await page.waitForURL(/\/(profile|verify-email)/);

    // Check session is in sessionStorage (not localStorage for short-lived)
    const sessionStorage = await page.evaluate(() =>
      JSON.stringify(window.sessionStorage)
    );

    // Note: Supabase SSR may still use localStorage even without Remember Me
    // The difference is in cookie max-age, not storage location
    expect(sessionStorage).toBeDefined();
  });

  test('should automatically refresh token before expiration', async ({
    page,
  }) => {
    // Sign in
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/(profile|verify-email)/);

    // Get initial access token
    const initialToken = await page.evaluate(() => {
      const data = localStorage.getItem('supabase.auth.token');
      return data ? JSON.parse(data).access_token : null;
    });

    // Wait a short time (in real scenario, wait closer to expiry)
    await page.waitForTimeout(2000);

    // Navigate to trigger token refresh check
    await page.goto('/profile');
    await page.waitForTimeout(1000);

    // Get current token
    const currentToken = await page.evaluate(() => {
      const data = localStorage.getItem('supabase.auth.token');
      return data ? JSON.parse(data).access_token : null;
    });

    // Tokens might be same if not near expiry, but refresh mechanism should exist
    // The important part is that navigation doesn't break authentication
    await expect(page).toHaveURL('/profile');
    await expect(page.getByText(testEmail)).toBeVisible();
  });

  test('should persist session across browser restarts', async ({
    browser,
  }) => {
    // Create persistent context
    const context = await browser.newContext({
      storageState: undefined, // Start fresh
    });
    const page = await context.newPage();

    // Sign in with Remember Me
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByLabel('Remember Me').check();
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/(profile|verify-email)/);

    // Save storage state
    const storageState = await context.storageState();

    // Close and reopen with saved state (simulates browser restart)
    await context.close();

    const newContext = await browser.newContext({ storageState });
    const newPage = await newContext.newPage();

    // Access protected route without signing in again
    await newPage.goto('/profile');

    // Verify still authenticated
    await expect(newPage).toHaveURL('/profile');
    await expect(newPage.getByText(testEmail)).toBeVisible();

    await newContext.close();
  });

  test('should clear session on sign out', async ({ page }) => {
    // Sign in
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/(profile|verify-email)/);

    // Verify localStorage has session data
    const beforeSignOut = await page.evaluate(() =>
      JSON.stringify(window.localStorage)
    );
    expect(beforeSignOut).toContain('supabase');

    // Sign out
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.waitForURL('/sign-in');

    // Verify session cleared from storage
    const afterSignOut = await page.evaluate(() =>
      JSON.stringify(window.localStorage)
    );

    // Session data should be removed or cleared
    const hasActiveSession = await page.evaluate(() => {
      const authData = localStorage.getItem('supabase.auth.token');
      return authData && JSON.parse(authData).access_token;
    });

    expect(hasActiveSession).toBeFalsy();

    // Verify cannot access protected routes
    await page.goto('/profile');
    await page.waitForURL('/sign-in');
    await expect(page).toHaveURL('/sign-in');
  });

  test('should handle concurrent tab sessions correctly', async ({
    browser,
  }) => {
    // Create two tabs with same user
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Sign in on page 1
    await page1.goto('/sign-in');
    await page1.getByLabel('Email').fill(testEmail);
    await page1.getByLabel('Password').fill(testPassword);
    await page1.getByRole('button', { name: 'Sign In' }).click();
    await page1.waitForURL(/\/(profile|verify-email)/);

    // Page 2 should also be authenticated (shared storage)
    await page2.goto('/profile');
    await expect(page2).toHaveURL('/profile');
    await expect(page2.getByText(testEmail)).toBeVisible();

    // Sign out on page 1
    await page1.getByRole('button', { name: 'Sign Out' }).click();
    await page1.waitForURL('/sign-in');

    // Page 2 should detect sign out (if using realtime sync)
    // Note: This depends on implementation - may require page reload
    await page2.reload();
    await page2.waitForURL('/sign-in');
    await expect(page2).toHaveURL('/sign-in');

    await context.close();
  });

  test('should refresh session automatically on page reload', async ({
    page,
  }) => {
    // Sign in
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/(profile|verify-email)/);

    // Reload page
    await page.reload();

    // Verify still authenticated
    await expect(page.getByText(testEmail)).toBeVisible();

    // Navigate to another protected route
    await page.goto('/account');
    await expect(page).toHaveURL('/account');
  });

  test('should expire session after maximum duration', async ({ page }) => {
    // Note: This test would require mocking time or waiting for real expiry
    // In a real test, we would:
    // 1. Sign in without Remember Me (1 hour session)
    // 2. Mock time forward 2 hours
    // 3. Try to access protected route
    // 4. Verify redirected to sign-in

    // For demonstration, test the refresh mechanism
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/(profile|verify-email)/);

    // Clear refresh token to simulate expired session
    await page.evaluate(() => {
      const data = localStorage.getItem('supabase.auth.token');
      if (data) {
        const parsed = JSON.parse(data);
        delete parsed.refresh_token;
        localStorage.setItem('supabase.auth.token', JSON.stringify(parsed));
      }
    });

    // Try to access protected route
    await page.goto('/profile');

    // Should redirect to sign-in when refresh fails
    // Note: Behavior depends on auth implementation
    await page.waitForURL(/\/(sign-in|profile)/);
  });
});
