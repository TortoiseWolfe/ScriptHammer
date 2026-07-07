/**
 * E2E coverage for Feature 013 — OAuth Messaging Password
 * (in-modal setup + per-spec unlock polish for OAuth users)
 *
 * #116 Phase 2: per-test fixture isolation (workers>1).
 *
 * The one running test (US-3) used to sign in as the shared PRIMARY email user,
 * clear IndexedDB, and assert the unlock-mode ReAuthModal copy. That coupled it
 * to shared mutable state (the PRIMARY storageState + its DB encryption keys).
 * It now seeds its OWN throwaway email viewer via seedIsolatedConversation(),
 * injects that session into a fresh context, and asserts the same modal copy.
 *
 * Why an isolated *email* viewer reproduces the exact assertions: the throwaway
 * user is created through the admin createUser path, so it carries
 * `app_metadata.provider === 'email'` and an email identity. isOAuthUser(user)
 * therefore returns false and ReAuthModal renders the unlock-mode copy
 * (heading "Enter Your Messaging Password", NO provider badge, "Password" label,
 * "Unlock Messages" button) — byte-identical to what the PRIMARY user produced.
 *
 * We intentionally do NOT use openAsViewer() here: that helper auto-dismisses
 * the ReAuthModal by entering the password, but this test must observe the modal
 * BEFORE it is unlocked. So we inline the session-injection portion of
 * openConversationAs() (the documented offline-queue-sync pattern), assert the
 * modal, then unlock via handleReAuthModal() to leave the page usable.
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
 * All three run in CI. US-1 / US-2 exercise the OAuth code paths without any
 * Google/GitHub app or live handshake: `isOAuthUser(user)` only checks
 * `app_metadata.provider !== 'email'`, so promoteToOAuthAndReSignIn() flips a
 * throwaway user's app_metadata via the Supabase admin API and re-signs-in to
 * get a session whose embedded user carries the provider. US-1 also deletes the
 * user's encryption keys (→ setup mode); US-2 keeps them (→ unlock mode). The
 * throwaway user + its keys are torn down in afterEach (deleteIsolatedConversation).
 */

import { test, expect } from '@playwright/test';
import {
  seedIsolatedConversation,
  deleteIsolatedConversation,
  dismissCookieBanner,
  handleReAuthModal,
  promoteToOAuthAndReSignIn,
  deleteUserEncryptionKeys,
  DEFAULT_TEST_PASSWORD,
  type IsolatedConversation,
  type InjectableSession,
} from '../utils/test-user-factory';

// Per-test isolation removes the shared-user data race that forced serial mode.
test.describe.configure({ mode: 'parallel' });

/**
 * Inject `session` into a fresh context's localStorage and land on
 * `/messages?conversation=<id>` WITHOUT unlocking the ReAuthModal.
 *
 * This is the session-injection half of openConversationAs() — replicated here
 * (rather than reused) precisely because openConversationAs() goes on to call
 * handleReAuthModal(), which dismisses the very modal this test needs to assert
 * against. The injection / storage-key derivation logic must stay in lockstep
 * with openConversationAs() in tests/e2e/utils/test-user-factory.ts.
 */
async function openMessagesWithoutUnlock(
  browser: import('@playwright/test').Browser,
  session: InjectableSession,
  conversationId: string
): Promise<{
  page: import('@playwright/test').Page;
  context: import('@playwright/test').BrowserContext;
  close: () => Promise<void>;
}> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  // The browser talks to Supabase via NEXT_PUBLIC_SUPABASE_URL. The localStorage
  // auth key is `sb-<first-host-label>-auth-token`.
  const browserUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_ADMIN_URL ||
    '';
  const supabaseHost = new URL(browserUrl).hostname.split('.')[0];
  const sbStorageKey = `sb-${supabaseHost}-auth-token`;

  await page.goto(`${basePath}/`);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    ({ key, s }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          expires_at: s.expires_at,
          expires_in: 3600,
          token_type: 'bearer',
          user: s.user,
        })
      );
    },
    { key: sbStorageKey, s: session }
  );
  // Reload so Supabase picks up the injected session on init.
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // Land on the conversation. The fresh context has no cached CryptoKey for this
  // throwaway user, so EncryptionKeyGate surfaces the ReAuthModal in UNLOCK mode
  // (keys exist in the DB). We deliberately stop here — the caller asserts the
  // modal copy, then unlocks.
  await page.goto(`${basePath}/messages?conversation=${conversationId}`, {
    waitUntil: 'domcontentloaded',
  });
  await dismissCookieBanner(page);

  return { page, context, close: () => context.close() };
}

test.describe('Feature 013 — OAuth Messaging Password', () => {
  let fixture: IsolatedConversation | null = null;

  test.beforeEach(async () => {
    fixture = await seedIsolatedConversation();
    test.skip(!fixture, 'isolation seed failed (no admin client / anon key?)');
  });

  test.afterEach(async () => {
    await deleteIsolatedConversation(fixture);
    fixture = null;
  });

  // US-3: email user regression. The feature must not change anything for users
  // whose `app_metadata.provider === 'email'`. The isolated throwaway viewer is
  // exactly such a user, so it renders the unchanged unlock modal.
  test('US-3: email user sees unchanged unlock modal (regression)', async ({
    browser,
  }) => {
    const viewer = await openMessagesWithoutUnlock(
      browser,
      fixture!.viewerSession,
      fixture!.conversationId
    );

    try {
      // The pre-Feature-013 modal copy: title is "Enter Your Messaging
      // Password" (NOT "Create a Messaging Password"). No provider badge.
      // Label is "Password" (NOT "Messaging Password"). Submit button says
      // "Unlock Messages" (NOT "Create Messaging Password").
      const dialog = viewer.page.getByRole('dialog', {
        name: /re-authentication required/i,
      });
      await expect(dialog).toBeVisible({ timeout: 30000 });

      await expect(
        dialog.getByRole('heading', {
          name: /enter your messaging password/i,
        })
      ).toBeVisible();

      // No provider badge for email users (FR-014, FR-020).
      await expect(
        dialog.getByTestId('oauth-provider-badge')
      ).not.toBeVisible();

      // Email user keeps "Password" label, NOT "Messaging Password".
      await expect(
        dialog.getByLabel('Password', { exact: true })
      ).toBeVisible();

      // Submit button is the unlock copy.
      await expect(
        dialog.getByRole('button', { name: 'Unlock Messages' })
      ).toBeVisible();

      // Then unlock with the real password to leave the page in a usable state
      // (proves the unlock path still works end-to-end for an email user).
      await handleReAuthModal(viewer.page, DEFAULT_TEST_PASSWORD);
    } finally {
      await viewer.close();
    }
  });

  // US-1 — OAuth user with NO keys → modal in SETUP mode.
  // The throwaway viewer is promoted to an OAuth identity (app_metadata.provider
  // = google) and its encryption keys are deleted, so isOAuthUser(user) is true
  // AND hasKeys() is false → ReAuthModal resolves to setup mode. No live OAuth
  // handshake is needed: the app reads app_metadata off the injected session.
  test('US-1: OAuth user with no keys sees setup mode', async ({ browser }) => {
    // Delete the viewer's keys → no-keys user → setup mode.
    await deleteUserEncryptionKeys(fixture!.viewer.id);
    const oauthSession = await promoteToOAuthAndReSignIn(
      fixture!.viewer,
      'google'
    );
    test.skip(!oauthSession, 'OAuth promotion failed (no admin client?)');

    const viewer = await openMessagesWithoutUnlock(
      browser,
      oauthSession!,
      fixture!.conversationId
    );
    try {
      const dialog = viewer.page.getByRole('dialog', {
        name: /re-authentication required/i,
      });
      await expect(dialog).toBeVisible({ timeout: 30000 });

      // Setup-mode copy (FR-006): "Create a Messaging Password", a
      // confirm-password field, and the OAuth provider badge.
      await expect(
        dialog.getByRole('heading', { name: /create a messaging password/i })
      ).toBeVisible();
      await expect(dialog.locator('#reauth-confirm-password')).toBeVisible();
      await expect(dialog.getByTestId('oauth-provider-badge')).toHaveText(
        /Signed in via Google/i
      );
      await expect(
        dialog.getByRole('button', { name: /create messaging password/i })
      ).toBeVisible();
    } finally {
      await viewer.close();
    }
  });

  // US-2 — returning OAuth user WITH keys (but no cached CryptoKey in this fresh
  // context) → modal in UNLOCK mode, with the provider badge + "separate from
  // your Google login" subtext. Keys already exist in the DB
  // (seedIsolatedConversation seeded them); only the promotion is added.
  test('US-2: returning OAuth user sees unlock mode with provider badge', async ({
    browser,
  }) => {
    const oauthSession = await promoteToOAuthAndReSignIn(
      fixture!.viewer,
      'google'
    );
    test.skip(!oauthSession, 'OAuth promotion failed (no admin client?)');

    const viewer = await openMessagesWithoutUnlock(
      browser,
      oauthSession!,
      fixture!.conversationId
    );
    try {
      const dialog = viewer.page.getByRole('dialog', {
        name: /re-authentication required/i,
      });
      await expect(dialog).toBeVisible({ timeout: 30000 });

      // Unlock-mode copy for an OAuth user: "Enter Your Messaging Password",
      // the provider badge, and the "separate from your Google login" subtext.
      await expect(
        dialog.getByRole('heading', { name: /enter your messaging password/i })
      ).toBeVisible();
      await expect(dialog.getByTestId('oauth-provider-badge')).toHaveText(
        /Signed in via Google/i
      );
      await expect(dialog).toContainText(/separate from your Google login/i);
      await expect(
        dialog.getByRole('button', { name: /unlock messages/i })
      ).toBeVisible();
    } finally {
      await viewer.close();
    }
  });
});
