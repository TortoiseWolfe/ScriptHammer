/**
 * E2E Test: a stale avatar address on the auth account is never requested (#1514)
 *
 * The auth account keeps a best-effort copy of the avatar address in
 * `user_metadata.avatar_url`. The copy can be left pointing at a file that was
 * deleted. Storage answers a request for a missing file with HTTP 400, and
 * WebKit logs that as a console error, which failed two tests in the hosted
 * lane. The profile row (`user_profiles.avatar_url`) is the source of truth,
 * so a profile that says "no avatar" must mean no avatar request at all.
 *
 * Before the fix this test failed on WebKit with two 400 image responses.
 */

import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';
import {
  signInAsIsolatedAvatarUser,
  type IsolatedAvatarUser,
} from '../utils/isolated-avatar-user';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Stale avatar copy on the auth account (#1514)', () => {
  let avatarUser: IsolatedAvatarUser | null = null;

  test.afterEach(async () => {
    await avatarUser?.cleanup();
    avatarUser = null;
  });

  test('a profile with no avatar never requests the stale copy', async ({
    page,
  }) => {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_ADMIN_URL ||
      '';
    // An empty URL would make `gone` a relative path that never reaches storage.
    expect(supabaseUrl, 'a Supabase URL is configured').not.toBe('');
    const gone = `${supabaseUrl}/storage/v1/object/public/avatars/00000000-0000-4000-8000-000000000000/deleted-${Date.now()}.webp`;

    const avatarResponses: string[] = [];
    const consoleErrors: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/storage/v1/object/public/avatars/')) {
        avatarResponses.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    // The profile row is created with no avatar; only the account copy is stale.
    avatarUser = await signInAsIsolatedAvatarUser(page, {
      metadata: { avatar_url: gone },
    });

    await page.goto('/');
    await dismissCookieBanner(page);
    const accountMenu = page
      .getByRole('navigation')
      .getByRole('button', { name: 'User account menu' });
    await expect(accountMenu).toBeVisible({ timeout: 15000 });
    // The avatar rendered something (the initials), so an empty request list below
    // means "nothing was asked for", not "nothing was drawn".
    await expect(accountMenu).toContainText(/\S/);
    await page.waitForLoadState('networkidle');

    expect(
      avatarResponses,
      'the page asked storage for an avatar the profile does not have'
    ).toEqual([]);
    expect(
      consoleErrors.filter((text) => /Failed to load resource/.test(text)),
      'a resource failed to load'
    ).toEqual([]);
  });
});
