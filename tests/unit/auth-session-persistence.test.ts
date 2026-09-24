/**
 * Unit tests for what "Remember me" actually does to the session (#375).
 *
 * ## Why these exist, and why they are unit tests
 * `persistSession: true` was hard-coded, so the checkbox could only express the
 * state it could not deliver: ticking it remembered you by accident, and
 * UNticking it remembered you anyway. On a shared machine a user who
 * deliberately left the box clear still left a session behind.
 *
 * The E2E that was supposed to cover this **cannot**. `performSignIn` has two
 * paths (`tests/e2e/utils/test-user-factory.ts:1105-1170`): when the backend
 * requires a captcha it injects a server-minted session and never submits the
 * form (#353). `session-persistence.spec.ts` runs against that config, so it
 * never executes the component code that records the preference — which is how
 * its own assertion ended up as
 *
 *     expect(JSON.stringify(window.sessionStorage)).toBeDefined()
 *
 * a tautology whose sibling comment concedes it does not test its own name.
 *
 * So the guard lives here, against the real adapter, where it can fail on the
 * pre-#375 behaviour. Verified by reverting: with the old always-localStorage
 * adapter, the "session mode" cases below go red.
 *
 * @module tests/unit/auth-session-persistence.test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// `tests/setup.ts:236` mocks this module globally so component tests never
// reach a real Supabase client. These tests are ABOUT the real module — the
// storage adapter is the subject — so they opt out, which is the escape the
// setup file documents at `:234-235`.
vi.unmock('@/lib/supabase/client');

import {
  createAuthStorage,
  setSessionPersistence,
  getSessionPersistence,
  setAllowAuthTokenRemoval,
} from '@/lib/supabase/client';

/** The shape Supabase uses for its session key. */
const AUTH_KEY = 'sb-abcdefgh-auth-token';
const PREF_KEY = 'sh-auth-persistence';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  setAllowAuthTokenRemoval(false);
});

describe('session persistence preference (#375)', () => {
  it('defaults to persisting, so existing signed-in users are not logged out', () => {
    expect(getSessionPersistence()).toBe(true);
    createAuthStorage().setItem(AUTH_KEY, 'token');
    expect(window.localStorage.getItem(AUTH_KEY)).toBe('token');
    expect(window.sessionStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('writes the token to sessionStorage when Remember Me is OFF', () => {
    // THE REGRESSION GUARD. Before the fix the adapter always used
    // localStorage, so an unticked box still left a session on the machine.
    setSessionPersistence(false);
    createAuthStorage().setItem(AUTH_KEY, 'token');

    expect(window.sessionStorage.getItem(AUTH_KEY)).toBe('token');
    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('writes the token to localStorage when Remember Me is ON', () => {
    setSessionPersistence(false);
    setSessionPersistence(true);
    createAuthStorage().setItem(AUTH_KEY, 'token');

    expect(window.localStorage.getItem(AUTH_KEY)).toBe('token');
    expect(window.sessionStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('keeps exactly one copy when the preference flips mid-session', () => {
    // The leak this ticket is about is a copy left behind, not a missing one.
    const storage = createAuthStorage();
    storage.setItem(AUTH_KEY, 'token');
    expect(window.localStorage.getItem(AUTH_KEY)).toBe('token');

    setSessionPersistence(false);

    expect(window.sessionStorage.getItem(AUTH_KEY)).toBe('token');
    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('still finds a token written under the previous preference', () => {
    // Without the fallback read, changing the preference orphans the token and
    // silently signs the user out — worse than the bug being fixed.
    window.localStorage.setItem(AUTH_KEY, 'token');
    window.localStorage.setItem(PREF_KEY, 'session'); // pref says session, token is not there

    expect(createAuthStorage().getItem(AUTH_KEY)).toBe('token');
  });

  it('does not persist the preference change when storage throws', () => {
    // Safari private mode. The session must still work for this page view
    // rather than throwing mid-sign-in.
    expect(() => setSessionPersistence(false)).not.toThrow();
  });
});

describe('auth-token removal guard survives the store change (#375)', () => {
  it('blocks auth-token removal unless explicitly allowed', () => {
    // The guard exists because auth-js clears the session on transient 406/403s
    // from Realtime/RLS, which fires SIGNED_OUT and bounces a user with a valid
    // access_token back to /sign-in. Routing storage must not weaken it.
    const storage = createAuthStorage();
    storage.setItem(AUTH_KEY, 'token');

    storage.removeItem(AUTH_KEY);

    expect(storage.getItem(AUTH_KEY)).toBe('token');
  });

  it('removes from BOTH stores on an explicit sign-out', () => {
    // A token can be in either store depending on the preference, so sign-out
    // has to clear both or it leaves one behind — the same leak from the other
    // direction.
    window.localStorage.setItem(AUTH_KEY, 'stale-local');
    window.sessionStorage.setItem(AUTH_KEY, 'stale-session');

    setAllowAuthTokenRemoval(true);
    createAuthStorage().removeItem(AUTH_KEY);

    expect(window.localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('removes non-auth keys freely', () => {
    const storage = createAuthStorage();
    storage.setItem('sb-abcdefgh-other', 'value');
    storage.removeItem('sb-abcdefgh-other');
    expect(storage.getItem('sb-abcdefgh-other')).toBeNull();
  });
});

/**
 * The PKCE code verifier (#1255) is not a session, and must not be stored like one.
 *
 * auth-js writes it under `<storageKey>-code-verifier` when a flow starts (sign-up, password
 * reset, OAuth) and reads it back when the emailed or redirected link lands. Two properties of
 * the session store would break that:
 *
 * - "Remember me" OFF puts auth keys in sessionStorage, which belongs to ONE tab. An emailed link
 *   opens in a new tab, finds no verifier, and the sign-in silently fails.
 * - The removal guard matches any key containing `auth-token`, which this one does. auth-js
 *   deletes the verifier once redeemed; the guard would keep a spent secret forever.
 */
describe('PKCE code verifier storage (#1255)', () => {
  const VERIFIER_KEY = `${AUTH_KEY}-code-verifier`;

  it('lives in localStorage even when Remember Me is OFF, so the emailed link can find it', () => {
    setSessionPersistence(false);
    const storage = createAuthStorage();

    storage.setItem(VERIFIER_KEY, 'verifier');

    expect(window.localStorage.getItem(VERIFIER_KEY)).toBe('verifier');
    expect(window.sessionStorage.getItem(VERIFIER_KEY)).toBeNull();
    expect(storage.getItem(VERIFIER_KEY)).toBe('verifier');
  });

  it('is deleted once redeemed, although the session guard is closed', () => {
    const storage = createAuthStorage();
    storage.setItem(VERIFIER_KEY, 'verifier');

    storage.removeItem(VERIFIER_KEY);

    expect(window.localStorage.getItem(VERIFIER_KEY)).toBeNull();
    // Control: the same call on the session itself is still refused.
    storage.setItem(AUTH_KEY, 'token');
    storage.removeItem(AUTH_KEY);
    expect(storage.getItem(AUTH_KEY)).toBe('token');
  });

  it('is not moved into sessionStorage when the preference changes', () => {
    createAuthStorage().setItem(VERIFIER_KEY, 'verifier');

    setSessionPersistence(false);

    expect(window.localStorage.getItem(VERIFIER_KEY)).toBe('verifier');
    expect(window.sessionStorage.getItem(VERIFIER_KEY)).toBeNull();
  });
});
