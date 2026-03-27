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
  ensureEncryptionKeys,
  getUserByEmail,
  getAdminClient,
} from './utils/test-user-factory';
import { KeyDerivationService } from '@/lib/messaging/key-derivation';

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

  // Set up encryption keys for ALL test users via admin API, then inject
  // the primary user's key cache into localStorage so storageState captures it.
  // This replaces the unreliable browser-based setup (ReAuthModal/setup form)
  // which depends on EncryptionKeyGate timing and Supabase query latency.
  console.log('Setting up encryption keys for messaging...');

  // Step 1: Create matching DB keys for the primary user
  const primaryOk = await ensureEncryptionKeys(email, password);
  if (primaryOk) {
    console.log('✓ Primary user encryption keys ready in DB');
  } else {
    console.log('⚠ Could not create primary user encryption keys');
  }

  // Step 2: Inject the primary user's derived keys into localStorage
  // so storageState captures them. Tests that load this state will have
  // sh_keys_{userId} → restoreKeysFromCache() → memory + IndexedDB.
  const primaryUser = await getUserByEmail(email);
  if (primaryUser) {
    const admin = getAdminClient();
    if (admin) {
      // Read the salt from the DB (ensureEncryptionKeys just created it)
      const { data: keyRow } = await admin
        .from('user_encryption_keys')
        .select('encryption_salt')
        .eq('user_id', primaryUser.id)
        .eq('revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (keyRow?.encryption_salt) {
        const kds = new KeyDerivationService();
        const keyPair = await kds.deriveKeyPair({
          password,
          salt: keyRow.encryption_salt,
        });
        // Export to JWK for localStorage cache format
        const privateJwk = await crypto.subtle.exportKey(
          'jwk',
          keyPair.privateKey
        );
        const publicJwk = await crypto.subtle.exportKey(
          'jwk',
          keyPair.publicKey
        );
        const cacheValue = JSON.stringify({
          privateKeyJwk: privateJwk,
          publicKeyJwk: publicJwk,
          publicKeyJwkOriginal: keyPair.publicKeyJwk,
          salt: keyPair.salt,
        });
        // Inject into browser localStorage via page.evaluate
        await page.evaluate(
          ({ key, value }) => localStorage.setItem(key, value),
          { key: `sh_keys_${primaryUser.id}`, value: cacheValue }
        );
        console.log(
          `✓ Injected sh_keys_${primaryUser.id.slice(0, 8)} into localStorage`
        );
      }
    }
  }

  // Save authenticated browser state (localStorage + cookies).
  // Now includes sh_keys_{userId} so tests can restore keys from cache
  // without needing ReAuthModal or Argon2id derivation on every test.
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✓ Auth state saved to ${AUTH_FILE}`);

  // ────────────────────────────────────────────────────────────────────────
  // Create encryption keys for SECONDARY and TERTIARY test users.
  // Multi-user tests (friend requests, encrypted messaging, group chat)
  // sign these users in manually — they MUST have encryption keys in the
  // database or they'll hit the /messages/setup → /sign-in redirect loop.
  //
  // Uses admin API (service_role) to insert password-derived keys directly.
  // This is far more reliable than the browser-based approach, which often
  // timed out on Supabase free tier (page.goto → EncryptionKeyGate → slow
  // hasKeysForUser query → timeout/ERR_ABORTED).
  // ────────────────────────────────────────────────────────────────────────
  const additionalUsers = [
    {
      email: process.env.TEST_USER_SECONDARY_EMAIL,
      password: process.env.TEST_USER_SECONDARY_PASSWORD,
    },
    {
      email: process.env.TEST_USER_TERTIARY_EMAIL,
      password: process.env.TEST_USER_TERTIARY_PASSWORD,
    },
  ].filter(
    (u): u is { email: string; password: string } => !!u.email && !!u.password
  );

  for (const { email: userEmail, password: userPwd } of additionalUsers) {
    console.log(`Setting up encryption keys for ${userEmail}...`);
    const ok = await ensureEncryptionKeys(userEmail, userPwd);
    if (!ok) {
      console.log(`⚠ Could not set up keys for ${userEmail}`);
    }
  }
});
