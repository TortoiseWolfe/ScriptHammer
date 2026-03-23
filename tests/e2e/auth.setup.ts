/**
 * Auth Setup - Creates shared authenticated session for E2E tests
 *
 * This runs ONCE before all tests and saves authenticated browser state
 * INCLUDING encryption keys for messaging. Tests reuse this state instead
 * of logging in repeatedly, which:
 * - Eliminates Supabase rate-limiting from concurrent sign-in attempts
 * - Speeds up test execution across shards
 * - Ensures messaging encryption keys exist in the database
 *
 * Playwright pattern: https://playwright.dev/docs/auth
 */

import { test as setup, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  performSignIn,
  handleEncryptionSetup,
  handleReAuthModal,
  getAdminClient,
  getUserByEmail,
} from './utils/test-user-factory';

const AUTH_FILE = 'tests/e2e/fixtures/storage-state-auth.json';

// Allow extra time for static page hydration + encryption setup
setup.setTimeout(120000);

setup('authenticate shared test user', async ({ page }) => {
  // Always run fresh — never use cached auth state. Cached state from
  // previous runs may lack encryption keys, causing all messaging tests
  // to redirect to /messages/setup and fail.

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

  // If already redirected away from sign-in, navigate back
  if (!page.url().includes('/sign-in')) {
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

  // Save authenticated browser state (localStorage + cookies)
  // Note: encryption private keys are in-memory only (not in localStorage).
  // Tests must call handleReAuthModal() to derive keys from password on each run.
  // The important thing is that public keys + salt exist in the DATABASE.
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✓ Auth state saved to ${AUTH_FILE}`);
});
