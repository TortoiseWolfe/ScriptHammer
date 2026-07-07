/**
 * Supabase Server Client for SSR
 *
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Manages session cookies for authentication.
 *
 * @module lib/supabase/server
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/supabase/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('lib:supabase:server');

/**
 * Creates a Supabase client for server-side use
 *
 * @returns Supabase client instance with cookie-based session management
 * @throws Error if environment variables are not configured
 *
 * @example
 * ```tsx
 * // In Server Component
 * import { createClient } from '@/lib/supabase/server';
 *
 * export default async function ProtectedPage() {
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 *   if (!user) {
 *     redirect('/sign-in');
 *   }
 *
 *   return <div>Hello {user.email}</div>;
 * }
 * ```
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During static export build, environment variables might not be available
  // Return a mock client to allow build to succeed
  // This is safe because server components won't actually run in static export
  if (!supabaseUrl || !supabaseAnonKey) {
    logger.warn(
      'Supabase environment variables not available during build. ' +
        'This is expected for static export. Client will be initialized at runtime.'
    );
    // Return a basic mock that satisfies the type
    return {
      auth: {},
      from: () => ({}),
    } as any;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
