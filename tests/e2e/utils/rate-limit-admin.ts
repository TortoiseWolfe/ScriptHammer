/**
 * Rate Limit Admin Utilities for E2E Tests
 *
 * Uses service role to clear rate_limit_attempts table before tests.
 * This ensures rate-limiting tests start with a clean slate.
 *
 * IMPORTANT: Only use in E2E tests. Never use in production code.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

// Create admin client if credentials are available
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Clear all rate limit attempts from the database.
 * Use in test.beforeAll() to ensure a clean slate.
 *
 * @returns true if cleared successfully, false if skipped (no admin client)
 */
export async function clearAllRateLimits(): Promise<boolean> {
  const client = getAdminClient();

  if (!client) {
    console.warn(
      '⚠️ SUPABASE_SERVICE_ROLE_KEY not set - skipping rate limit cleanup'
    );
    return false;
  }

  try {
    const { error } = await client
      .from('rate_limit_attempts')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (error) {
      // Table might not exist or RLS might block - log but don't fail
      console.warn(`⚠️ Could not clear rate_limit_attempts: ${error.message}`);
      return false;
    }

    console.log('✅ Cleared all rate limit attempts');
    return true;
  } catch (err) {
    console.warn('⚠️ Error clearing rate limits:', err);
    return false;
  }
}

/**
 * Clear rate limit attempts for a specific identifier (email or IP).
 *
 * @param identifier - Email address or IP address to clear
 * @returns true if cleared successfully, false if skipped
 */
export async function clearRateLimitsForIdentifier(
  identifier: string
): Promise<boolean> {
  const client = getAdminClient();

  if (!client) {
    console.warn(
      '⚠️ SUPABASE_SERVICE_ROLE_KEY not set - skipping rate limit cleanup'
    );
    return false;
  }

  try {
    const { error } = await client
      .from('rate_limit_attempts')
      .delete()
      .eq('identifier', identifier);

    if (error) {
      console.warn(
        `⚠️ Could not clear rate limits for ${identifier}: ${error.message}`
      );
      return false;
    }

    console.log(`✅ Cleared rate limits for: ${identifier}`);
    return true;
  } catch (err) {
    console.warn(`⚠️ Error clearing rate limits for ${identifier}:`, err);
    return false;
  }
}

/**
 * Get current rate limit state for an identifier.
 * Useful for debugging test failures.
 *
 * @param identifier - Email address or IP address to check
 * @returns Rate limit record or null
 */
export async function getRateLimitState(identifier: string): Promise<{
  attempt_count: number;
  locked_until: string | null;
  window_start: string;
} | null> {
  const client = getAdminClient();

  if (!client) {
    return null;
  }

  try {
    const { data, error } = await client
      .from('rate_limit_attempts')
      .select('attempt_count, locked_until, window_start')
      .eq('identifier', identifier)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Check if rate limit admin utilities are available.
 * Use to skip tests when service role key is not configured.
 */
export function isRateLimitAdminAvailable(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
