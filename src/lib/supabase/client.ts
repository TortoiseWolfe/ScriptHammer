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

/**
 * Creates a disabled mock client for when Supabase is not configured.
 * Returns a client that won't crash but all operations return errors.
 */
function createDisabledClient(): SupabaseClient<Database> {
  const notConfiguredError = {
    message: 'Supabase not configured',
    status: 503,
  };

  const errorResponse = Promise.resolve({
    data: null,
    error: notConfiguredError,
  });

  const chainableMock = () => ({
    select: chainableMock,
    eq: chainableMock,
    neq: chainableMock,
    in: chainableMock,
    order: chainableMock,
    limit: chainableMock,
    range: chainableMock,
    single: () => errorResponse,
    maybeSingle: () => errorResponse,
    insert: chainableMock,
    update: chainableMock,
    delete: chainableMock,
    upsert: () => errorResponse,
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: null, error: notConfiguredError }),
  });

  return {
    auth: {
      getSession: () => errorResponse,
      getUser: () => errorResponse,
      signInWithPassword: () => errorResponse,
      signInWithOAuth: () => errorResponse,
      signUp: () => errorResponse,
      signOut: () => errorResponse,
      resetPasswordForEmail: () => errorResponse,
      updateUser: () => errorResponse,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      exchangeCodeForSession: () => errorResponse,
    },
    from: () => chainableMock(),
    channel: () => ({
      on: function () {
        return this;
      },
      subscribe: function () {
        return this;
      },
      unsubscribe: () => Promise.resolve('ok'),
      send: () => Promise.resolve('ok'),
    }),
    removeChannel: () => Promise.resolve('ok'),
    removeAllChannels: () => Promise.resolve([]),
    getChannels: () => [],
    storage: {
      from: () => ({
        upload: () => errorResponse,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: () => errorResponse,
        download: () => errorResponse,
        list: () => errorResponse,
      }),
    },
    rpc: () => errorResponse,
  } as unknown as SupabaseClient<Database>;
}

// Global singleton instance (persists across hot reloads in development)
let supabaseInstance: SupabaseClient<Database> | null = null;
let isConfigured = false;

/**
 * Check if Supabase is properly configured
 * @returns true if environment variables are set
 */
export function isSupabaseConfigured(): boolean {
  return isConfigured;
}

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
    // Log warning instead of throwing - allows graceful degradation
    console.warn(
      'Supabase environment variables not configured. Some features will be unavailable.'
    );
    isConfigured = false;
    // Return a disabled mock client that won't crash
    return createDisabledClient();
  }

  isConfigured = true;
  supabaseInstance = createSupabaseClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        // Use implicit flow for static sites (no server-side code exchange)
        flowType: 'implicit',
        // In E2E tests, use a storage adapter that prevents auth token
        // removal. Even with autoRefreshToken disabled, Supabase may clear
        // the session on 406/403 errors from the free tier. The adapter
        // no-ops removeItem for auth-token keys, keeping the valid access
        // token in localStorage so the session can recover on page reload.
        storage:
          typeof window !== 'undefined'
            ? window.localStorage?.getItem('playwright_e2e')
              ? {
                  getItem: (key: string) => window.localStorage.getItem(key),
                  setItem: (key: string, value: string) =>
                    window.localStorage.setItem(key, value),
                  removeItem: (key: string) => {
                    if (key.includes('auth-token')) return;
                    window.localStorage.removeItem(key);
                  },
                }
              : window.localStorage
            : undefined,
        // Disable auto-refresh in E2E tests. The access token is valid for
        // 1 hour — plenty for a ~30-minute test run. Auto-refresh causes
        // single-use refresh tokens to be consumed by one test context,
        // leaving subsequent contexts with an invalid session (SIGNED_OUT
        // fires → localStorage cleared → all messaging tests fail).
        autoRefreshToken:
          typeof window === 'undefined' ||
          !window.localStorage?.getItem('playwright_e2e'),
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
