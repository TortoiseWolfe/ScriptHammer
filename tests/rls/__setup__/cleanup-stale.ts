/**
 * Vitest globalSetup hook that scrubs stale *@scripthammer.test users +
 * their FK-blocking dependent rows before pnpm test:rls runs (#50).
 *
 * Wired in vitest.rls.config.ts. Skips silently when
 * SUPABASE_SERVICE_ROLE_KEY is absent — same gate as the tests'
 * describe.skipIf(!hasRlsTestEnvironment()) — no env, no cleanup.
 *
 * @module tests/rls/__setup__/cleanup-stale
 */

import { createClient } from '@supabase/supabase-js';
import { cleanupStaleScripthammerUsers } from './cleanup-stale-impl';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function setup() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      '[rls cleanup-stale] Skipping (SUPABASE_URL or service key missing)'
    );
    return;
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const consoleLogger = {
    info: (msg: string, meta?: Record<string, unknown>) =>
      console.log(`[rls cleanup-stale] ${msg}`, meta ?? ''),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      console.warn(`[rls cleanup-stale] ${msg}`, meta ?? ''),
  };

  const summary = await cleanupStaleScripthammerUsers(client, consoleLogger);

  if (
    summary.usersRemoved > 0 ||
    summary.intentsRemoved > 0 ||
    summary.subscriptionsRemoved > 0 ||
    summary.profilesRemoved > 0
  ) {
    console.log(
      `[rls cleanup-stale] removed ${summary.usersRemoved} user(s), ${summary.intentsRemoved} intent(s), ${summary.subscriptionsRemoved} subscription(s), ${summary.profilesRemoved} profile(s)`
    );
  }
}
