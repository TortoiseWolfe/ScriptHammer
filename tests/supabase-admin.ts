/**
 * Supabase Admin Client for Tests
 * Uses service role key to bypass RLS for test cleanup
 *
 * IMPORTANT: Only use in tests for database cleanup.
 * Never use in production code.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { assertLocalBackend, resolveBackendUrl } from './utils/local-backend';

const supabaseUrl = resolveBackendUrl();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase environment variables for admin client. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
  );
}

// REFUSE A NON-LOCAL BACKEND AT CONSTRUCTION (#959).
//
// This file used to check only that the variables were PRESENT, never where they
// pointed. In the dev container they point at the live cloud project, and the one
// consumer — tests/integration/auth/rate-limiting.integration.test.ts — issues
// `.from('rate_limit_attempts').delete()` four times. Running that file by hand,
// which is exactly what someone touching rate limiting would do, deleted rows
// from production.
//
// Nothing would have noticed: the file is excluded in vitest.config.ts, so it
// never runs in CI and `vitest list` finds zero cases in it. An exclusion removes
// the observer, not the hazard — #944 guarded the three admin E2E specs and this
// path was missed for exactly that reason.
//
// At construction rather than per-test, so a future consumer inherits the refusal
// instead of having to remember it.
assertLocalBackend('The service-role admin client');

/**
 * Admin Supabase client with service role key
 * Bypasses RLS - use only for test cleanup
 */
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
