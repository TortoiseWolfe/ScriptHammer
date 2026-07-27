/**
 * Pure cleanup function for stale `*@scripthammer.test` users (#50).
 *
 * Walks the FK chain (payment_intents → webhook_events → subscriptions →
 * user_profiles → auth deleteUser) for every test-suite user that matches the
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
   * Users a CONCURRENT sweep had already removed (#360).
   *
   * Counted rather than ignored. `globalSetup` runs once per Playwright
   * invocation and the E2E workflow invokes Playwright ~15 times, so two
   * sweeps overlap routinely and both try to delete the same backlog. The
   * loser's deletes come back "not found", which is a SUCCESS condition — the
   * row is gone, which is what was wanted.
   *
   * Previously those surfaced as ~49 `deleteUser failed` warnings in a green
   * run. Nothing was broken, but a green run printing a wall of red-flag
   * warnings teaches people to stop reading warnings, and that habit is what
   * lets a real failure through unnoticed.
   *
   * Kept as its own counter instead of silently swallowed: a genuine delete
   * failure and a benign race must stay distinguishable.
   */
  usersAlreadyGone: number;
  /**
   * Per-table errors logged (non-fatal; cleanup continues).
   * Operators reading the summary use this to gauge whether the cleanup
   * fully completed or punted on some FKs.
   */
  errorsLogged: number;
}

/**
 * Did this delete fail because the row was already gone? (#360)
 *
 * A concurrent sweep having removed it first is the outcome we wanted, not a
 * failure. Matched narrowly — on an explicit 404 or a not-found message — so
 * that any other failure still counts as an error.
 */
function isAlreadyDeleted(error: unknown): boolean {
  if (!error) return false;
  const e = error as { message?: string; status?: number };
  if (e.status === 404) return true;
  return /not found|does not exist|no rows/i.test(e.message ?? '');
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
    usersAlreadyGone: 0,
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
    await deleteUserFkSafe(client, user.id, logger, summary);
  }

  return summary;
}

/**
 * Delete ONE auth user and everything that references it, in FK-safe order.
 *
 * Extracted so the two sweepers ({@link cleanupStaleScripthammerUsers} for the
 * Vitest `@scripthammer.test` fixtures, {@link sweepOrphanedE2EUsers} for the
 * Playwright `scripthammer.e2e+` isolates) share one implementation. A PARTIAL
 * delete is what corrupts a shared user (#338 / #341 / #342) — the fix must not
 * reintroduce that failure mode in a second copy of the logic.
 *
 * Best-effort: every step logs and continues, so one wedged FK cannot strand
 * the rest of the sweep. Mutates `summary`.
 */
async function deleteUserFkSafe(
  client: SupabaseClient,
  userId: string,
  logger: Logger,
  summary: CleanupSummary
): Promise<void> {
  {
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

    // webhook_events (NO ACTION → subscriptions) must be cleared BEFORE the
    // subscriptions delete, or a stale user whose subscription has a webhook
    // row wedges the cleanup. Fetch this user's subscription ids first, then
    // delete its webhook rows. Mirrors tests/e2e/utils/test-user-factory.ts
    // deleteTestUser (#338 / #341).
    const { data: subsData, error: subsSelectError } = await client
      .from('subscriptions')
      .select('id')
      .eq('template_user_id', userId);
    if (subsSelectError) {
      logger.warn('Cleanup-stale: subscriptions select failed', {
        userId,
        error: subsSelectError.message,
      });
      summary.errorsLogged++;
    }
    const subIds = (subsData ?? []).map((s: { id: string }) => s.id);
    if (subIds.length > 0) {
      const webhookResult = await client
        .from('webhook_events')
        .delete()
        .in('related_subscription_id', subIds);
      if (webhookResult.error) {
        logger.warn('Cleanup-stale: webhook_events delete failed', {
          userId,
          error: webhookResult.error.message,
        });
        summary.errorsLogged++;
      }
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
      if (isAlreadyDeleted(authError)) {
        // A concurrent sweep won the race (#360). The row is gone, which is
        // the outcome we wanted — count it, do not warn.
        summary.usersAlreadyGone++;
      } else {
        logger.warn('Cleanup-stale: auth deleteUser failed', {
          userId,
          error: authError.message,
        });
        summary.errorsLogged++;
      }
    } else {
      summary.usersRemoved++;
    }
  }
}

// ============================================================================
// #354 — Playwright per-test isolate sweeper
// ============================================================================

/** Prefix every Playwright per-test isolated user is minted under. */
const E2E_ISOLATE_PREFIX = 'scripthammer.e2e+';

/**
 * The three NAMED fixtures, which must never be swept. They share the isolate
 * prefix, so a prefix match alone would delete them and break every suite.
 * Matched exactly, and defended twice: the literal `+test-` names plus whatever
 * the environment configures, in case a fork renames them.
 */
function buildAllowlist(env: EnvLike): Set<string> {
  const allow = new Set<string>();
  for (const v of [
    env.TEST_USER_PRIMARY_EMAIL,
    env.TEST_USER_SECONDARY_EMAIL,
    env.TEST_USER_TERTIARY_EMAIL,
  ]) {
    if (v) allow.add(v.trim().toLowerCase());
  }
  for (const name of ['primary', 'secondary', 'tertiary']) {
    allow.add(`${E2E_ISOLATE_PREFIX}test-${name}@gmail.com`);
  }
  return allow;
}

/** Only the handful of optional string keys the sweeper reads. */
type EnvLike = Record<string, string | undefined>;

export interface SweepOptions {
  /** Only sweep users created longer ago than this. Default 2h. */
  olderThanMs?: number;
  /** Report what WOULD be deleted without deleting. */
  dryRun?: boolean;
  logger?: Logger;
  /** Injectable for tests. Defaults to `process.env`. */
  env?: EnvLike;
  /** Injectable for tests. Defaults to `Date.now()`. */
  now?: number;
}

export interface SweepSummary extends CleanupSummary {
  /** Matched the prefix, survived the allowlist, and were old enough. */
  candidates: number;
  /** Skipped because they are named fixtures. */
  allowlisted: number;
  /** Skipped because they are younger than the age guard. */
  tooRecent: number;
  dryRun: boolean;
}

/**
 * Sweep orphaned Playwright per-test isolated users (#354).
 *
 * Per-test isolation is deliberate — it is what ended the shared-test-user
 * corruption class (#338/#341/#342) — but the per-test `afterAll` cleanup never
 * runs when a shard is cancelled or times out, which is exactly when it is
 * needed. 381 orphans accumulated on prod between 2026-05-30 and 2026-07-24.
 *
 * Three independent safety properties, because this hard-deletes real auth rows:
 *
 * 1. **Prefix scoping** — only `scripthammer.e2e+…`. Owner accounts, genuine
 *    sign-ups and the Vitest `@scripthammer.test` fixtures are unreachable.
 * 2. **Allowlist** — the three named fixtures are never swept, even though they
 *    match the prefix.
 * 3. **Age guard** — nothing younger than `olderThanMs` (default 2h), so a
 *    concurrently-running suite's fresh users can never be pulled out from
 *    under it. This is why the sweep belongs in globalSetup rather than
 *    teardown: at run start every in-flight user is younger than the guard.
 */
export async function sweepOrphanedE2EUsers(
  client: SupabaseClient,
  options: SweepOptions = {}
): Promise<SweepSummary> {
  const {
    olderThanMs = 2 * 60 * 60 * 1000,
    dryRun = false,
    logger = noopLogger,
    env = process.env,
    now = Date.now(),
  } = options;

  const summary: SweepSummary = {
    usersRemoved: 0,
    usersAlreadyGone: 0,
    errorsLogged: 0,
    candidates: 0,
    allowlisted: 0,
    tooRecent: 0,
    dryRun,
  };
  const allowlist = buildAllowlist(env);

  // Paginate. listUsers silently caps a page, so a single call would leave
  // orphans behind and quietly under-report (#197 — the same trap that made
  // "find a user" break past 50).
  const all: { id: string; email?: string; created_at?: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      logger.warn('Sweep: listUsers failed', { page, error: error.message });
      summary.errorsLogged++;
      break;
    }
    const batch = data?.users ?? [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 200) break;
  }

  for (const user of all) {
    const email = user.email?.trim().toLowerCase();
    if (!email || !email.startsWith(E2E_ISOLATE_PREFIX)) continue;

    if (allowlist.has(email)) {
      summary.allowlisted++;
      continue;
    }

    const createdAt = user.created_at ? Date.parse(user.created_at) : NaN;
    // Unparseable timestamp → treat as too recent. Failing closed on a hard
    // delete is the only safe default.
    if (!Number.isFinite(createdAt) || now - createdAt < olderThanMs) {
      summary.tooRecent++;
      continue;
    }

    summary.candidates++;
    if (dryRun) continue;
    await deleteUserFkSafe(client, user.id, logger, summary);
  }

  // `errorsLogged` was missing here (#360). The field existed on the summary
  // and drove the outcome, but was never logged — so a run emitting ~49
  // warnings still printed a clean-looking summary line, and the race had to be
  // found by reading raw warnings instead. A summary that omits the failure
  // count is not a summary.
  logger.info('Sweep: orphaned E2E users', {
    scanned: all.length,
    candidates: summary.candidates,
    removed: summary.usersRemoved,
    alreadyGone: summary.usersAlreadyGone,
    allowlisted: summary.allowlisted,
    tooRecent: summary.tooRecent,
    errors: summary.errorsLogged,
    dryRun,
  });

  return summary;
}
