/**
 * Pure cleanup function for stale `*@scripthammer.test` users (#50).
 *
 * Walks the FK chain (payment_intents → subscriptions → user_profiles
 * → auth deleteUser) for every test-suite user that matches the
 * scripthammer.test domain. Best-effort: errors are logged via the
 * provided logger and the cleanup continues. Returns a summary count.
 *
 * Used by tests/rls/__setup__/cleanup-stale.ts as a Vitest globalSetup.
 *
 * @module tests/rls/__setup__/cleanup-stale-impl
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const SCRIPTHAMMER_TEST_DOMAIN = '@scripthammer.test';

export interface CleanupSummary {
  /** Auth users hard-deleted via auth.admin.deleteUser. */
  usersRemoved: number;
  /**
   * Per-table errors logged (non-fatal; cleanup continues).
   * Operators reading the summary use this to gauge whether the cleanup
   * fully completed or punted on some FKs.
   */
  errorsLogged: number;
}

type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
};

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
};

export async function cleanupStaleScripthammerUsers(
  client: SupabaseClient,
  logger: Logger = noopLogger
): Promise<CleanupSummary> {
  const summary: CleanupSummary = {
    usersRemoved: 0,
    errorsLogged: 0,
  };

  // 1. List all auth users; filter to the scripthammer.test domain.
  const { data: listData, error: listError } =
    await client.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    logger.warn('Cleanup-stale: listUsers failed', {
      error: listError.message,
    });
    return summary;
  }
  const users = (listData?.users ?? []).filter(
    (u: { id: string; email?: string }) =>
      typeof u.email === 'string' && u.email.endsWith(SCRIPTHAMMER_TEST_DOMAIN)
  );
  if (users.length === 0) return summary;

  // 2. For each user, walk the FK chain. Order matters: leaves of the FK
  //    graph first, then the auth user.
  for (const user of users) {
    const userId = user.id;

    // payment_intents (cascade-deletes payment_results via ON DELETE CASCADE)
    const intentsResult = await client
      .from('payment_intents')
      .delete()
      .eq('template_user_id', userId);
    if (intentsResult.error) {
      logger.warn('Cleanup-stale: payment_intents delete failed', {
        userId,
        error: intentsResult.error.message,
      });
      summary.errorsLogged++;
    }

    // subscriptions (leaf w.r.t. auth.users)
    const subsResult = await client
      .from('subscriptions')
      .delete()
      .eq('template_user_id', userId);
    if (subsResult.error) {
      logger.warn('Cleanup-stale: subscriptions delete failed', {
        userId,
        error: subsResult.error.message,
      });
      summary.errorsLogged++;
    }

    // user_profiles (1:1 with auth.users; FK is profiles.id → auth.users.id)
    const profileResult = await client
      .from('user_profiles')
      .delete()
      .eq('id', userId);
    if (profileResult.error) {
      logger.warn('Cleanup-stale: user_profiles delete failed', {
        userId,
        error: profileResult.error.message,
      });
      summary.errorsLogged++;
    }

    // Hard-delete the auth user. shouldSoftDelete=false releases email
    // uniqueness immediately so createTestUser doesn't trip on it. This
    // is the only DELETE whose success we can count meaningfully —
    // PostgREST DELETEs above succeed regardless of whether any rows
    // matched, so they only contribute to errorsLogged on failure.
    const { error: authError } = await client.auth.admin.deleteUser(
      userId,
      false
    );
    if (authError) {
      logger.warn('Cleanup-stale: auth deleteUser failed', {
        userId,
        error: authError.message,
      });
      summary.errorsLogged++;
    } else {
      summary.usersRemoved++;
    }
  }

  return summary;
}
