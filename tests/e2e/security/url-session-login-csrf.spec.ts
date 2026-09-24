// Login CSRF: a link carrying someone else's session must not sign the visitor in (#1255)
//
// The client used the implicit flow and read a session out of the URL on every page. So an
// attacker could sign in to an account they control, copy the access and refresh tokens into a
// link to this site — `/#access_token=…&refresh_token=…`, any page — and whoever clicked it was
// silently working inside the attacker's account: messages, payment details, everything they
// typed. If the victim was already signed in, the link replaced their session.
//
// The fix binds sign-in links to the browser that asked for them (PKCE) and never consumes a
// session from the URL. Every test below fails against the pre-#1255 client, which consumed the
// attacker's tokens in each case.
//
// The waits are on outcomes the app only reaches AFTER auth has settled — ProtectedRoute sending
// a signed-out visitor to /sign-in, the callback's explanation, the reset page's explanation — so
// an assertion cannot pass merely because it ran before the tokens were consumed.

import { test, expect, type Page } from '@playwright/test';
import {
  createTestUser,
  deleteTestUserByEmail,
  generateTestEmail,
  isAdminClientAvailable,
  signInAsInjectable,
} from '../utils/test-user-factory';

type Minted = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

let attackerEmail = '';
let attackerId = '';
let attacker: Minted;

/** The attacker's session, as the implicit flow would have put it in a URL. */
function sessionParams(type: 'signup' | 'recovery' = 'signup'): string {
  return new URLSearchParams({
    access_token: attacker.access_token,
    expires_at: String(attacker.expires_at),
    expires_in: '3600',
    refresh_token: attacker.refresh_token,
    token_type: 'bearer',
    type,
  }).toString();
}

/** The user id of whatever session this page's storage holds, or null. */
async function storedUserId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (const key of Object.keys(store)) {
        if (!/^sb-.+-auth-token$/.test(key)) continue;
        try {
          return (
            (JSON.parse(store.getItem(key) ?? '') as { user?: { id?: string } })
              .user?.id ?? null
          );
        } catch {
          return null;
        }
      }
    }
    return null;
  });
}

test.beforeAll(async () => {
  if (!isAdminClientAvailable()) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is unset, so no attacker account can be minted. A skip would ' +
        'report a security test as passing.'
    );
  }
  attackerEmail = generateTestEmail('login-csrf');
  const password = 'LoginCsrf123!attacker';
  const user = await createTestUser(attackerEmail, password, {
    createProfile: true,
  });
  if (!user)
    throw new Error(`could not create the attacker account ${attackerEmail}`);
  attackerId = user.id;
  const { session, error } = await signInAsInjectable(attackerEmail, password);
  if (!session)
    throw new Error(`could not mint the attacker's session: ${error}`);
  attacker = session;
});

test.afterAll(async () => {
  if (attackerEmail) await deleteTestUserByEmail(attackerEmail);
});

test.describe('a signed-out visitor who follows the link', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('is not signed in by tokens in the fragment of an ordinary page', async ({
    page,
  }) => {
    await page.goto(`/profile/#${sessionParams()}`);

    // ProtectedRoute only redirects once auth has settled with nobody signed in. Before #1255 the
    // attacker's profile rendered here instead.
    await page.waitForURL(/\/sign-in/, { timeout: 20_000 });
    expect(await storedUserId(page)).toBeNull();
  });

  test('is not signed in by tokens in the query of an ordinary page', async ({
    page,
  }) => {
    await page.goto(`/profile/?${sessionParams()}`);

    await page.waitForURL(/\/sign-in/, { timeout: 20_000 });
    expect(await storedUserId(page)).toBeNull();
  });

  test('is not signed in by tokens on the auth callback, and is told to sign in', async ({
    page,
  }) => {
    await page.goto(`/auth/callback/#${sessionParams()}`);

    // Before #1255: the callback consumed the session and pushed to the attacker's /profile.
    await expect(
      page.getByRole('heading', { name: /sign in to continue/i })
    ).toBeVisible({ timeout: 20_000 });
    expect(await storedUserId(page)).toBeNull();
    // The live session in the link does not stay in the address bar.
    await expect.poll(() => page.url()).not.toContain('access_token');
  });

  test('is not handed a password form for the attacker account on the reset page', async ({
    page,
  }) => {
    await page.goto(`/reset-password/#${sessionParams('recovery')}`);

    // Before #1255: signed in as the attacker, looking at a form that sets THEIR password.
    await expect(page.getByText(/only works in the browser/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel(/new password/i)).toHaveCount(0);
    expect(await storedUserId(page)).toBeNull();
  });
});

test.describe('a signed-in visitor who follows the link', () => {
  // The project's storageState: the primary test user, the victim here.

  test('keeps their own session', async ({ page }) => {
    await page.goto('/');
    const victimId = await storedUserId(page);
    expect(
      victimId,
      'the storageState fixture carries a session'
    ).not.toBeNull();
    expect(victimId).not.toBe(attackerId);

    await page.goto(`/auth/callback/#${sessionParams()}`);

    // The callback forwards whoever is signed in once auth settles. Before #1255 that was the
    // attacker, whose session had silently replaced the victim's.
    await page.waitForURL(/\/profile/, { timeout: 20_000 });
    expect(await storedUserId(page)).toBe(victimId);
  });
});
