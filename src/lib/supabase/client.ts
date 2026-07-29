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
 * Flag for the E2E storage adapter: when true, auth-token removal is
 * allowed (intentional sign-out). When false, removeItem is blocked
 * for auth-token keys to prevent spurious session wipes.
 */
let _allowAuthTokenRemoval = false;
export function setAllowAuthTokenRemoval(value: boolean): void {
  _allowAuthTokenRemoval = value;
}

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
 * Where the auth token lives, and therefore what "Remember me" means (#375).
 *
 * `persistSession: true` was hard-coded, so the checkbox could express only the
 * state it could not deliver: ticking it remembered you by accident, and
 * UNticking it remembered you anyway. On a shared machine, a user who
 * deliberately left the box clear still left a session behind.
 *
 * The preference itself is deliberately kept in localStorage rather than in the
 * chosen store. It has to be readable BEFORE the session is restored in order
 * to decide where to look for it, and a preference of "do not persist" is not
 * itself a secret — it is which STORE the token goes in that carries the
 * privacy meaning.
 *
 * `session` -> sessionStorage: the token dies with the tab, which is what an
 * unticked box has always promised.
 * `local`   -> localStorage: survives restarts. The default, so existing signed
 * -in users are not silently logged out by this change.
 */
const PERSIST_PREF_KEY = 'sh-auth-persistence';

type PersistenceMode = 'local' | 'session';

function persistenceMode(): PersistenceMode {
  if (typeof window === 'undefined') return 'local';
  try {
    return window.localStorage.getItem(PERSIST_PREF_KEY) === 'session'
      ? 'session'
      : 'local';
  } catch {
    // Safari private mode throws on access. Defaulting to `local` keeps the
    // pre-#375 behaviour rather than silently signing people out.
    return 'local';
  }
}

/** The store the auth token should live in right now. */
function authStore(): Storage {
  return persistenceMode() === 'session'
    ? window.sessionStorage
    : window.localStorage;
}

/** The other one — used to keep exactly one copy of the token. */
function otherStore(): Storage {
  return persistenceMode() === 'session'
    ? window.localStorage
    : window.sessionStorage;
}

/**
 * Record what "Remember me" was set to, for every entry path.
 *
 * MUST be called BEFORE the auth call that creates the session, so the token is
 * written to the right store first time rather than migrated afterwards. That
 * matters most for OAuth, where the redirect means there is no "afterwards" in
 * the same page load — `/auth/callback` restores the session on a fresh
 * document, and the preference has to already be on disk when it does.
 *
 * @param remember - true to persist across browser restarts, false to end the
 * session with the tab.
 */
export function setSessionPersistence(remember: boolean): void {
  if (typeof window === 'undefined') return;
  const next: PersistenceMode = remember ? 'local' : 'session';
  try {
    const current = persistenceMode();
    if (current === next) return;

    window.localStorage.setItem(PERSIST_PREF_KEY, next);

    // Move any token that already exists, so a preference change mid-session
    // takes effect immediately instead of at the next sign-in. Without this,
    // unticking the box on a machine that already had a persisted session
    // would leave that session sitting in localStorage — the exact failure
    // this ticket is about.
    const from =
      next === 'session' ? window.localStorage : window.sessionStorage;
    const to = next === 'session' ? window.sessionStorage : window.localStorage;
    for (const key of Object.keys(from)) {
      if (!key.includes('auth-token')) continue;
      const value = from.getItem(key);
      if (value === null) continue;
      to.setItem(key, value);
      from.removeItem(key);
    }
  } catch {
    // Storage unavailable — the session still works for this page view; it
    // just cannot honour the preference. Better than throwing mid-sign-in.
  }
}

/** Read the current preference. Exported for the UI to reflect real state. */
export function getSessionPersistence(): boolean {
  return persistenceMode() === 'local';
}

/**
 * The auth storage adapter Supabase writes the session through.
 *
 * Exported, and built by a factory rather than inlined in `createClient`,
 * ONLY so it can be constructed in isolation by a test. The E2E that was meant
 * to cover this cannot: `performSignIn` injects a server-minted session
 * whenever the backend requires a captcha and never submits the form (#353,
 * test-user-factory.ts:1105-1170), so the prod-config run never executes the
 * component code that records the preference. A unit test against this adapter
 * is the only guard that can actually fail on the pre-#375 behaviour.
 *
 * Behaviour it must preserve, all three load-bearing:
 *
 * 1. `getItem` falls back to the other store. A token written before the
 *    preference changed would otherwise be orphaned and the user silently
 *    signed out.
 * 2. `setItem` clears the other store, so the token has exactly ONE home. A
 *    stale copy left behind is the privacy leak #375 is about — an unticked
 *    box that still leaves a session on the machine.
 * 3. `removeItem` keeps the auth-token guard. Supabase auth-js clears the
 *    session on transient 406/403s from Realtime/RLS; without the guard that
 *    wipes the token, fires SIGNED_OUT, and bounces a user with a perfectly
 *    valid access_token back to /sign-in.
 */
export function createAuthStorage() {
  return {
    getItem: (key: string): string | null => {
      const found = authStore().getItem(key);
      return found !== null ? found : otherStore().getItem(key);
    },
    setItem: (key: string, value: string): void => {
      authStore().setItem(key, value);
      try {
        otherStore().removeItem(key);
      } catch {
        // Non-fatal; the authoritative write above succeeded.
      }
    },
    removeItem: (key: string): void => {
      if (key.includes('auth-token') && !_allowAuthTokenRemoval) return;
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    },
  };
}

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
        // Custom storage adapter that prevents auth-token removal except
        // during an explicit sign-out (toggled via setAllowAuthTokenRemoval).
        // Supabase auth-js clears the session on transient 406/403 errors
        // from Realtime / RLS — without this guard, that transient error
        // wipes the auth-token, fires SIGNED_OUT, and forces the user back
        // to /sign-in even though the access_token was still valid. With
        // the guard, the token persists across the spurious event; the
        // next TOKEN_REFRESHED / SIGNED_IN fires shortly and recovers.
        // This applies in production AND E2E — the test path now exercises
        // exactly the same auth flow real users see.
        //
        // The store is now chosen per the "Remember me" preference (#375)
        // rather than always being localStorage. The removal guard above is
        // unchanged in meaning — it just has to clear both stores now.
        storage:
          typeof window !== 'undefined' ? createAuthStorage() : undefined,
        // Auto-refresh must stay on so Supabase Realtime can authenticate
        // its WebSocket connection — Realtime fetches the JWT from the
        // in-memory session, and without auto-refresh the session's access
        // token never gets refreshed via the Realtime auth handshake. The
        // channel never reaches 'SUBSCRIBED' and every messaging E2E test
        // falls back to the slow reload-retry path.
        //
        // Prior commits (d353494, 4b645aa, 18b6bf8) disabled this in E2E to
        // prevent parallel test contexts from consuming each other's
        // single-use refresh tokens, but commit 62f8a40 introduced the
        // storage adapter (above) that prevents auth-token wipes — which
        // solves the SIGNED_OUT cascade that was the original concern. The
        // boolean gate is no longer needed.
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
