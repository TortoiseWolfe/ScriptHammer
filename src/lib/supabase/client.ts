/**
 * Supabase Client for Browser (Client-side)
 *
 * Creates a Supabase client for use in browser/client components.
 * Configured for static export (no server-side code exchange).
 *
 * @module lib/supabase/client
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Global singleton instance (persists across hot reloads in development)
let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Creates a Supabase client for browser use
 * Uses implicit flow for static sites (no PKCE)
 *
 * @returns Supabase client instance
 * @throws Error if environment variables are not configured (browser only)
 */
export function createClient(): SupabaseClient<Database> {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build/SSR, return a placeholder - don't throw
  // The actual client will be created when running in browser
  if (typeof window === 'undefined') {
    // Create a mock client that won't actually be used
    // This allows the build to succeed
    return {} as SupabaseClient<Database>;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
    );
  }

  supabaseInstance = createSupabaseClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        // Use implicit flow for static sites (no server-side code exchange)
        flowType: 'implicit',
        // Store session in localStorage
        storage:
          typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );

  return supabaseInstance;
}

/**
 * Get the Supabase client singleton
 * Only initializes when called (lazy loading)
 */
export function getSupabase(): SupabaseClient<Database> {
  return createClient();
}

/**
 * Lazy singleton getter - only creates client when accessed in browser
 * This prevents SSR issues while maintaining backwards compatibility
 */
function getSupabaseInstance() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase client can only be used in browser context');
  }
  return createClient();
}

// Export singleton using a getter to ensure lazy initialization
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get: (target, prop) => {
    const instance = getSupabaseInstance();
    const value = instance[prop as keyof typeof instance];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

/**
 * Helper: Check if Supabase is accessible
 * @returns Promise<boolean> - true if connected
 */
export async function isSupabaseOnline(): Promise<boolean> {
  try {
    const client = createClient();
    const { error } = await client
      .from('payment_intents')
      .select('id')
      .limit(1);
    return !error || error.code !== 'PGRST301'; // PGRST301 = connection error
  } catch {
    return false;
  }
}

/**
 * Helper: Subscribe to connection status changes
 * @param callback - Called when connection status changes
 * @returns Unsubscribe function
 */
export function onConnectionChange(
  callback: (online: boolean) => void
): () => void {
  let isOnline = true;

  const checkConnection = async () => {
    const online = await isSupabaseOnline();
    if (online !== isOnline) {
      isOnline = online;
      callback(online);
    }
  };

  // Check every 30 seconds
  const interval = setInterval(checkConnection, 30000);

  // Initial check
  checkConnection();

  // Return unsubscribe function
  return () => clearInterval(interval);
}
