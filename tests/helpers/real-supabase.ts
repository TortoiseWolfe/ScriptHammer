/**
 * Real Supabase client for contract and integration tests.
 * Bypasses the mock in tests/setup.ts by importing directly from @supabase/supabase-js
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Contract/integration tests require NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

/**
 * Create a real Supabase client with anon key (respects RLS)
 */
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Create a real Supabase client with service role key (bypasses RLS)
 */
export function createServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error('Service role tests require SUPABASE_SERVICE_ROLE_KEY');
  }
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Pre-created clients for convenience
 */
export const supabase = createClient();
export const supabaseAdmin = createServiceClient();
