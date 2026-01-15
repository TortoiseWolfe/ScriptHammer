/**
 * Supabase Browser Client
 *
 * Creates a Supabase client for browser/client-side usage.
 * Uses the anon key which is safe to expose in client code.
 *
 * @module src/lib/supabase/client
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Creates a Supabase client for browser-side operations.
 * This client uses the anon key and respects RLS policies.
 *
 * @returns Supabase browser client instance
 *
 * @example
 * ```typescript
 * const supabase = createClient();
 * const { data, error } = await supabase.from('profiles').select();
 * ```
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Default export for convenience
 */
export default createClient;
