/**
 * Supabase Server Client
 *
 * Creates Supabase clients for server-side usage.
 * Includes both authenticated client (respects RLS) and
 * service role client (bypasses RLS for admin operations).
 *
 * @module src/lib/supabase/server
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Creates a Supabase client for server-side operations with user context.
 * This client respects RLS policies based on the authenticated user.
 *
 * @returns Supabase server client instance
 *
 * @example
 * ```typescript
 * const supabase = createClient();
 * const { data } = await supabase.from('profiles').select(); // Returns only user's profile
 * ```
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Cookie setting fails in Server Components
            // This is expected behavior
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Cookie removal fails in Server Components
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client with service role privileges.
 * This client BYPASSES all RLS policies - use with caution!
 *
 * SECURITY WARNING:
 * - Never expose this client to browser code
 * - Only use in server-side code (API routes, Edge Functions)
 * - Log all operations for audit trail
 *
 * @returns Supabase service role client instance
 *
 * @example
 * ```typescript
 * const supabase = createServiceRoleClient();
 * // Can access all users' data - bypasses RLS
 * const { data } = await supabase.from('profiles').select();
 * ```
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
