/**
 * A resent confirmation link is bound to the browser that asked for it (#1298).
 *
 * auth-js 2.72's `resend()` sent no PKCE challenge. GoTrue then mailed an implicit-flow link,
 * which the client never consumes (#1255): it confirmed the address and signed nobody in.
 * auth-js 2.117's sends one, and stores the verifier first.
 *
 * Both halves are checked against the REAL library, driven through our own storage adapter, with
 * only the network faked. A hand-written key list would pass while auth-js renamed its keys: 2.117
 * already moved from one `<storageKey>-code-verifier` to per-flow keys beside it. So:
 *
 * - the request must carry a challenge, or the mailed link cannot sign anyone in;
 * - every verifier key the library writes must land in localStorage with "Remember me" off, or an
 *   emailed link opened in a new tab finds nothing (sessionStorage belongs to one tab);
 * - the library must be able to delete them, although they contain `auth-token`, which the
 *   session's removal guard refuses.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// tests/setup.ts mocks the app's client module for component tests; this is about the real one.
vi.unmock('@/lib/supabase/client');

import {
  createAuthStorage,
  setAllowAuthTokenRemoval,
  setSessionPersistence,
} from '@/lib/supabase/client';

interface Call {
  path: string;
  body: Record<string, unknown> | null;
}

/** A real auth client on our adapter, answering every request with `answer`. */
function client(answer: (path: string) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    calls.push({
      path,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });
    const { status, body } = answer(path);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  // The adapter, with every deletion the library ASKS for recorded, so a test can check each one
  // happened rather than guess which keys the library will choose to delete.
  const adapter = createAuthStorage();
  const removed: string[] = [];
  const storage = {
    ...adapter,
    removeItem: (key: string) => {
      removed.push(key);
      adapter.removeItem(key);
    },
  };
  const supabase = createClient('http://abcdefgh.supabase.test', 'anon-key', {
    auth: {
      flowType: 'pkce',
      storage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch },
  });
  return { supabase, calls, removed };
}

const verifierKeys = (store: Storage) =>
  Object.keys(store).filter((k) => k.includes('code-verifier'));

const ok = () => ({ status: 200, body: {} });

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  setAllowAuthTokenRemoval(false);
  setSessionPersistence(false); // the harder case: auth keys go to sessionStorage
});

describe('resend() is PKCE-bound (#1298)', () => {
  it('sends a code challenge, so the mailed link carries a code this browser can redeem', async () => {
    const { supabase, calls } = client(ok);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: 'person@example.test',
      options: { emailRedirectTo: 'http://localhost/auth/callback/' },
    });

    expect(error).toBeNull();
    const resend = calls.find((c) => c.path.endsWith('/auth/v1/resend'));
    expect(resend?.body?.code_challenge).toEqual(expect.any(String));
    expect(String(resend?.body?.code_challenge).length).toBeGreaterThan(20);
    expect(resend?.body?.code_challenge_method).toMatch(/^(s256|plain)$/i);
  });

  it('stores its verifier where an emailed link opened in a new tab can read it', async () => {
    const { supabase } = client(ok);

    await supabase.auth.resend({
      type: 'signup',
      email: 'person@example.test',
      options: { emailRedirectTo: 'http://localhost/auth/callback/' },
    });

    expect(verifierKeys(window.localStorage).length).toBeGreaterThan(0);
    expect(verifierKeys(window.sessionStorage)).toEqual([]);
    // Every key the library wrote for it carries the session key's `auth-token`, which is why it
    // needs routing at all: without it, these would follow the session into sessionStorage.
    for (const key of verifierKeys(window.localStorage)) {
      expect(key).toContain('auth-token');
    }
  });

  it('honours every verifier deletion the library makes once the code is spent', async () => {
    const { supabase, removed } = client((path) =>
      path.endsWith('/auth/v1/token')
        ? {
            status: 400,
            body: { error_code: 'flow_state_not_found', msg: 'expired' },
          }
        : ok()
    );
    await supabase.auth.resend({
      type: 'signup',
      email: 'person@example.test',
      options: { emailRedirectTo: 'http://localhost/auth/callback/' },
    });
    expect(verifierKeys(window.localStorage).length).toBeGreaterThan(0);

    // 2.117 deletes the verifier it used after an exchange, whether it succeeded or not. Without a
    // flow id in the link that is the legacy key; the per-flow slots stay, capped at five.
    await supabase.auth.exchangeCodeForSession('a-code');

    const asked = removed.filter((k) => k.includes('code-verifier'));
    expect(asked.length).toBeGreaterThan(0);
    for (const key of asked) {
      expect(window.localStorage.getItem(key)).toBeNull();
      expect(window.sessionStorage.getItem(key)).toBeNull();
    }
  });

  it('leaves no verifier behind on sign-out, although the session guard is closed', async () => {
    const { supabase } = client(ok);
    await supabase.auth.resend({
      type: 'signup',
      email: 'person@example.test',
      options: { emailRedirectTo: 'http://localhost/auth/callback/' },
    });
    // The slot, the index and the legacy key: all three shapes 2.117 writes.
    expect(verifierKeys(window.localStorage).length).toBe(3);

    await supabase.auth.signOut({ scope: 'local' });

    expect(verifierKeys(window.localStorage)).toEqual([]);
    expect(verifierKeys(window.sessionStorage)).toEqual([]);
  });
});
