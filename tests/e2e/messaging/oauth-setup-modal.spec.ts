/**
 * E2E coverage for Feature 013 — OAuth Messaging Password
 * (in-modal setup + per-spec unlock polish for OAuth users)
 *
 * Three user stories from features/auth-oauth/013-oauth-messaging-password/spec.md:
 *
 *   US-1 (P1) — OAuth user with no encryption keys lands on /messages,
 *               sees ReAuthModal in setup mode, creates a messaging
 *               password, gets keys initialized.
 *   US-2 (P2) — OAuth user with existing keys + cleared IndexedDB lands
 *               on /messages, sees ReAuthModal in unlock mode with
 *               provider badge + "separate from your Google/GitHub
 *               login" subtext.
 *   US-3 (P3) — Email user lands on /messages, sees the unchanged
 *               unlock modal (regression-only).
 *
 * What runs in CI vs. what doesn't:
 *
 *   US-3 — runs in CI. The existing email/password test fixture is
 *          enough; we just navigate to /messages, clear IndexedDB to
 *          force the unlock modal, and assert byte-identical pre-
 *          feature copy.
 *
 *   US-1 / US-2 — skipped in CI. Triggering the OAuth-user code paths
 *                 requires `isOAuthUser(user)` to return true, which
 *                 means the user must have
 *                 `app_metadata.provider !== 'email'` set. The repo
 *                 does NOT yet have a dedicated OAuth test fixture
 *                 (no Google/GitHub test app credentials in CI), so
 *                 the unit tests in
 *                 src/components/auth/ReAuthModal/ReAuthModal.test.tsx
 *                 carry the behavioral coverage for OAuth detection,
 *                 mode-switching, badge rendering, and submit
 *                 branching. Manual smoke at T018 in tasks.md exercises
 *                 the real OAuth flow end-to-end.
 *
 *                 Promoting these to running tests is a follow-up:
 *                 either flip the existing test user's app_metadata
 *                 via the Supabase admin API in beforeAll (mutating
 *                 fixture, needs careful teardown), or add a
 *                 dedicated OAuth fixture user. Out of scope for #28.
 */

import { test, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  handleReAuthModal,
} from '../utils/test-user-factory';

const BASE_URL = process.env.NEXT_PUBLIC_DEPLOY_URL || 'http://localhost:3000';

const USER_PRIMARY = {
  email: process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!',
};

test.describe('Feature 013 — OAuth Messaging Password', () => {
  // US-3: email user regression. The new feature must not change anything
  // for users whose `app_metadata.provider === 'email'`.
  test('US-3: email user sees unchanged unlock modal (regression)', async ({
    page,
  }) => {
    // Sign in as the primary email/password test user.
    await page.goto(`${BASE_URL}/sign-in`);
    await dismissCookieBanner(page);
    await page.getByLabel(/email/i).fill(USER_PRIMARY.email);
    await page.getByLabel(/^password$/i).fill(USER_PRIMARY.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from /sign-in.
    await page.waitForURL((url) => !url.pathname.includes('/sign-in'), {
      timeout: 30000,
    });

    // Clear IndexedDB so the next /messages visit forces the unlock modal
    // (keys exist in DB from prior runs; this evicts the in-memory cache).
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      await Promise.all(
        dbs
          .filter((db) => db.name)
          .map(
            (db) =>
              new Promise<void>((resolve) => {
                const req = indexedDB.deleteDatabase(db.name!);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              })
          )
      );
    });

    await page.goto(`${BASE_URL}/messages`);

    // The pre-Feature-013 modal copy: title is "Enter Your Messaging
    // Password" (NOT "Create a Messaging Password"). No provider badge.
    // Label is "Password" (NOT "Messaging Password"). Submit button says
    // "Unlock Messages" (NOT "Create Messaging Password").
    const dialog = page.getByRole('dialog', {
      name: /re-authentication required/i,
    });
    await expect(dialog).toBeVisible({ timeout: 30000 });

    await expect(
      dialog.getByRole('heading', { name: /enter your messaging password/i })
    ).toBeVisible();

    // No provider badge for email users (FR-014, FR-020).
    await expect(dialog.getByTestId('oauth-provider-badge')).not.toBeVisible();

    // Email user keeps "Password" label, NOT "Messaging Password".
    await expect(dialog.getByLabel('Password', { exact: true })).toBeVisible();

    // Submit button is the unlock copy.
    await expect(
      dialog.getByRole('button', { name: 'Unlock Messages' })
    ).toBeVisible();

    // Then unlock with the real password to leave the test environment
    // in a usable state for downstream specs in the same shard.
    await handleReAuthModal(page, USER_PRIMARY.password);
  });

  // US-1 — OAuth user no-keys → modal in setup mode.
  // See block comment at top of file for why this is skipped in CI.
  test.skip('US-1: OAuth user with no keys sees setup mode', async () => {
    // Future implementation:
    //   1. Promote PRIMARY user to OAuth via supabase.auth.admin.updateUserById(...)
    //      with app_metadata: { provider: 'google' }.
    //   2. Delete any existing user_encryption_keys row for this user.
    //   3. Sign in, navigate to /messages.
    //   4. Assert dialog title is "Create a Messaging Password".
    //   5. Assert confirm-password field renders.
    //   6. Assert provider badge "Signed in via Google".
    //   7. Submit matching passwords; assert keys initialize and modal closes.
    //   8. Teardown: revert app_metadata to email; delete created keys row.
  });

  // US-2 — OAuth user with keys → modal unlock mode with badge + subtext.
  test.skip('US-2: returning OAuth user sees unlock mode with provider badge', async () => {
    // Future implementation:
    //   1. Same OAuth-promotion trick as US-1.
    //   2. Pre-seed user_encryption_keys for this user.
    //   3. Sign in, clear IndexedDB, navigate to /messages.
    //   4. Assert dialog title is "Enter Your Messaging Password".
    //   5. Assert provider badge "Signed in via Google" renders.
    //   6. Assert subtext contains "separate from your Google login".
    //   7. Submit with the (seeded) messaging password; assert unlock succeeds.
  });
});
