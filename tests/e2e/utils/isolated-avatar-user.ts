/**
 * A throwaway user for the avatar specs (#1514).
 *
 * The avatar specs upload and remove avatars. They used to do that as the ONE
 * shared test user, from three browser shards at once, so one shard's upload or
 * removal changed what every other shard's pages tried to load. A page that
 * asked for a file another shard had just deleted got a 400 from storage, and
 * WebKit logs that as a console error that the hosted lane treats as a failure.
 *
 * Each test now gets its own user, so nothing else can touch its avatar.
 */

import type { Page } from '@playwright/test';
import {
  DEFAULT_TEST_PASSWORD,
  createTestUser,
  deleteTestUser,
  generateTestEmail,
  getAdminClient,
  injectSessionIntoPage,
  requireAdminClient,
  signInAsInjectable,
} from './test-user-factory';

export interface IsolatedAvatarUser {
  userId: string;
  email: string;
  /** A signed-in session for this user; inject it into a page with signPageIn. */
  session: NonNullable<
    Awaited<ReturnType<typeof signInAsInjectable>>['session']
  >;
  /** Remove the user's files from the avatars bucket, then the user. */
  cleanup: () => Promise<void>;
}

/**
 * Create a fresh user and a session for it. Call it once per file (in a
 * beforeAll), then use signPageIn in each test, so the user setup and cleanup
 * do not count against every test's own time limit.
 * Throws if any step fails, so a test never runs as an anonymous visitor.
 */
export async function createIsolatedAvatarUser(options?: {
  /** Account metadata to create the user with (for example a stale avatar_url). */
  metadata?: Record<string, unknown>;
}): Promise<IsolatedAvatarUser> {
  requireAdminClient('createIsolatedAvatarUser');

  const email = generateTestEmail('e2e-avatar');
  const user = await createTestUser(email, DEFAULT_TEST_PASSWORD, {
    metadata: options?.metadata,
  });

  const { session, error } = await signInAsInjectable(
    email,
    DEFAULT_TEST_PASSWORD
  );
  if (!session) {
    await deleteTestUser(user.id);
    throw new Error(
      `createIsolatedAvatarUser: sign-in failed for ${email}: ${error}`
    );
  }

  return {
    userId: user.id,
    email,
    session,
    cleanup: async () => {
      const admin = getAdminClient();
      if (admin) {
        // The user's files live under `<userId>/`. Deleting the user does not
        // delete them, so remove them first or each run leaves files behind.
        const { data: files } = await admin.storage
          .from('avatars')
          .list(user.id);
        const paths = (files ?? []).map((f) => `${user.id}/${f.name}`);
        if (paths.length > 0) {
          await admin.storage.from('avatars').remove(paths);
        }
      }
      await deleteTestUser(user.id);
    },
  };
}

/** Sign a page in as the isolated user. */
export async function signPageIn(
  page: Page,
  user: IsolatedAvatarUser
): Promise<void> {
  await injectSessionIntoPage(page, user.session);
}

/** Create a fresh user, sign the page in as it, and return a cleanup function. */
export async function signInAsIsolatedAvatarUser(
  page: Page,
  options?: { metadata?: Record<string, unknown> }
): Promise<IsolatedAvatarUser> {
  const user = await createIsolatedAvatarUser(options);
  await signPageIn(page, user);
  return user;
}
