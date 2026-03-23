/**
 * Auth Setup - Creates shared authenticated session for E2E tests
 *
 * This runs ONCE before all tests and saves authenticated browser state.
 * Tests then reuse this state instead of logging in repeatedly, which:
 * - Eliminates Supabase rate-limiting from concurrent sign-in attempts
 * - Speeds up test execution across shards
 * - Matches the pattern used by SpokeToWork
 *
 * Playwright pattern: https://playwright.dev/docs/auth
 */

import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import {
  dismissCookieBanner,
  performSignIn,
  handleEncryptionSetup,
  handleReAuthModal,
  getAdminClient,
  getUserByEmail,
} from './utils/test-user-factory';

const AUTH_FILE = 'tests/e2e/fixtures/storage-state-auth.json';

/**
 * Check if existing auth state is still valid.
 *
 * Validates:
 * 1. File exists
 * 2. Contains auth token for a localhost origin
 * 3. Token expires more than 10 minutes from now
 */
function isAuthStateValid(): boolean {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      console.log('Auth state file not found, will authenticate');
      return false;
    }

    const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));

    // Find origin matching localhost
    const origin = state.origins?.find(
      (o: { origin: string }) =>
        o.origin.includes('localhost') || o.origin.includes('127.0.0.1')
    );

    if (!origin) {
      console.log('No localhost origin found in auth state');
      return false;
    }

    // Look for Supabase auth token in localStorage
    const authToken = origin.localStorage?.find(
      (item: { name: string }) =>
        item.name.includes('auth-token') || item.name.match(/sb-.*-auth-token/)
    );

    if (!authToken) {
      console.log('No auth-token found in localStorage');
      return false;
    }

    const tokenData = JSON.parse(authToken.value);
    const expiresAt = tokenData.expires_at;

    if (!expiresAt) {
      console.log('Token has no expires_at field');
      return false;
    }

    // Check if token expires more than 10 minutes from now
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = expiresAt - now;

    if (timeRemaining < 600) {
      console.log(
        `Token expires in ${timeRemaining}s (< 10 min), will re-authenticate`
      );
      return false;
    }

    console.log(`Auth state valid, token expires in ${timeRemaining}s`);
    return true;
  } catch (error) {
    console.log('Error checking auth state:', error);
    return false;
  }
}

// Allow extra time for static page hydration
setup.setTimeout(120000);

setup('authenticate shared test user', async ({ page }) => {
  // Skip login if we already have a valid auth state
  if (isAuthStateValid()) {
    console.log('✓ Auth setup skipped: valid session cached');
    return;
  }

  const email = process.env.TEST_USER_PRIMARY_EMAIL;
  const password = process.env.TEST_USER_PRIMARY_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_USER_PRIMARY_EMAIL and TEST_USER_PRIMARY_PASSWORD must be set'
    );
  }

  console.log(`Authenticating as: ${email}`);

  // Navigate to sign-in
  await page.goto('/sign-in');
  await page.waitForLoadState('domcontentloaded');

  // Check if already redirected (user might be logged in from cached state)
  if (!page.url().includes('/sign-in')) {
    const userMenu = page.locator('[aria-label="User account menu"]');
    if (await userMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✓ User already logged in, saving auth state');
      await page.context().storageState({ path: AUTH_FILE });
      return;
    }
    // Not actually logged in, navigate back
    await page.goto('/sign-in');
    await page.waitForLoadState('domcontentloaded');
  }

  // Dismiss cookie banner before signing in
  await dismissCookieBanner(page);

  // Sign in using the existing helper
  const result = await performSignIn(page, email, password, { timeout: 30000 });

  if (!result.success) {
    // Take screenshot for debugging
    await page
      .screenshot({ path: 'test-results/auth-setup-failure.png' })
      .catch(() => {});
    throw new Error(
      `Auth setup sign-in failed: ${result.error}. Check test-results/auth-setup-failure.png`
    );
  }

  // Verify authenticated state
  console.log('✓ Sign-in successful, verifying auth state...');

  // Ensure we're on a page that confirms authentication
  await expect(page).not.toHaveURL(/\/sign-in/);

  // Set up encryption keys for messaging tests
  // Delete any stale encryption keys from previous CI runs so we get a
  // fresh setup flow with the known login password. Without this, the
  // ReAuthModal appears but the old keys were created with an unknown
  // password, causing the modal to never close.
  console.log('Setting up encryption keys for messaging...');
  const adminClient = getAdminClient();
  if (adminClient && email) {
    const testUser = await getUserByEmail(email);
    if (testUser) {
      const { error: delError } = await adminClient
        .from('user_encryption_keys')
        .delete()
        .eq('user_id', testUser.id);
      if (delError) {
        console.log(`⚠ Could not delete stale keys: ${delError.message}`);
      } else {
        console.log('✓ Cleared stale encryption keys');
      }
    }
  }

  // Navigate to /messages to trigger EncryptionKeyGate
  // With keys deleted, this will redirect to /messages/setup
  await page.goto('/messages');
  await page.waitForLoadState('domcontentloaded');
  await dismissCookieBanner(page);

  // Handle first-time encryption setup (redirects to /messages/setup)
  const setupHandled = await handleEncryptionSetup(page, password);
  if (setupHandled) {
    console.log('✓ Encryption keys created with login password');
  } else {
    // Fallback: keys might still exist (admin delete failed) — try re-auth
    const reAuthHandled = await handleReAuthModal(page, password);
    if (reAuthHandled) {
      console.log('✓ Encryption keys unlocked (re-auth)');
    } else {
      console.log('⚠ No encryption setup needed (keys already active)');
    }
  }

  // Save authenticated browser state (localStorage + cookies + encryption keys)
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✓ Auth state saved to ${AUTH_FILE}`);
});
