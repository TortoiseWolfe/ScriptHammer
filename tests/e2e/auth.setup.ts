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

  // Set up encryption keys for messaging tests.
  // IMPORTANT: Do NOT delete keys unconditionally. deriveKeys() only puts
  // keys in memory — it does NOT re-insert DB rows. If we delete keys and
  // then derive, the DB is empty and every shard's hasKeys() returns false,
  // causing an infinite /messages/setup ↔ /sign-in redirect loop.
  //
  // Instead: try to unlock existing keys first (idempotent). Only delete
  // and recreate if derivation fails (e.g. keys from a different password).
  console.log('Setting up encryption keys for messaging...');

  await page.goto('/messages');
  await dismissCookieBanner(page);

  // Wait for EncryptionKeyGate to decide: ReAuthModal or /messages/setup
  // Give it 15s for React hydration + DB query on Supabase Cloud free tier.
  await page.waitForTimeout(3000);

  if (page.url().includes('/messages/setup')) {
    // Path A: No keys in DB — create them via the setup form
    console.log('No encryption keys found — running setup...');
    const setupHandled = await handleEncryptionSetup(page, password);
    if (setupHandled) {
      console.log('✓ Encryption keys created via setup form');
    } else {
      console.log('⚠ handleEncryptionSetup returned false');
    }
  } else {
    // Path B: Keys exist in DB — unlock via ReAuthModal
    const reAuthHandled = await handleReAuthModal(page, password);
    if (reAuthHandled) {
      console.log('✓ Encryption keys unlocked via ReAuthModal');
    } else {
      // Path C: No modal appeared — keys might already be in memory,
      // or the page is still loading. Try waiting for setup redirect.
      try {
        await page.waitForURL(/\/messages\/setup/, { timeout: 10000 });
        console.log('Late redirect to /messages/setup — running setup...');
        const setupHandled = await handleEncryptionSetup(page, password);
        if (setupHandled) {
          console.log('✓ Encryption keys created via setup form (late)');
        }
      } catch {
        console.log(
          '⚠ No encryption modal or setup page — keys may already be unlocked'
        );
      }
    }
  }

  // Save authenticated browser state (localStorage + cookies)
  // Note: encryption private keys are in-memory only (not in localStorage).
  // Tests must call handleReAuthModal() to derive keys from password on each run.
  // The important thing is that public keys + salt exist in the DATABASE.
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✓ Auth state saved to ${AUTH_FILE}`);

  // ────────────────────────────────────────────────────────────────────────
  // Create encryption keys for SECONDARY and TERTIARY test users.
  // Multi-user tests (friend requests, encrypted messaging, group chat)
  // sign these users in manually — they MUST have encryption keys in the
  // database or they'll hit the /messages/setup → /sign-in redirect loop.
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
    const browser = page.context().browser();
    if (!browser) continue;

    const ctx = await browser.newContext();
    const p = await ctx.newPage();

    try {
      // Sign in as this user
      await p.goto('/sign-in');
      await p.waitForLoadState('domcontentloaded');
      await dismissCookieBanner(p);
      const emailInput = p.locator('input[type="email"], input[name="email"]');
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill(userEmail);
      await p.fill('input[type="password"], input[name="password"]', userPwd);
      await p.click('button[type="submit"]');
      await p
        .waitForURL((url) => !url.pathname.includes('/sign-in'), {
          timeout: 15000,
        })
        .catch(() => {});

      // Navigate to /messages — handle setup or ReAuth
      await p.goto('/messages');
      await p.waitForLoadState('domcontentloaded');
      await p.waitForTimeout(3000);

      // Handle encryption setup page (no keys yet → full setup form)
      const setupBtn = p.locator(
        'button:has-text("Set Up Encrypted Messaging")'
      );
      if (await setupBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await p.locator('#setup-password').fill(userPwd);
        await p.locator('#setup-confirm').fill(userPwd);
        await setupBtn.click();
        await p.waitForURL(/\/messages(?!\/setup)/, { timeout: 60000 });
        console.log(`✓ Encryption keys created for ${userEmail}`);
      } else {
        // Keys already exist — handle ReAuth modal
        const handled = await handleReAuthModal(p, userPwd);
        if (handled) {
          console.log(`✓ Encryption keys unlocked for ${userEmail}`);
        } else {
          console.log(`⚠ No setup or modal for ${userEmail} — keys may exist`);
        }
      }
    } catch (err) {
      console.log(
        `⚠ Could not set up keys for ${userEmail}: ${err instanceof Error ? err.message : err}`
      );
    } finally {
      await ctx.close();
    }
  }
});
