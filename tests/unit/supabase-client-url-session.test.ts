/**
 * The Supabase client's URL-session settings (#1255).
 *
 * `flowType: 'implicit'` plus `detectSessionInUrl: true` meant auth-js consumed any
 * `#access_token=…` it found, on any page, for whoever clicked the link — login CSRF. The
 * client now uses PKCE, which a link cannot satisfy on its own: the `?code=` it carries is
 * redeemable only with the verifier this browser stored when it started the flow. And it only
 * looks at the URL at all on the two pages a sign-in lands on.
 *
 * These read the options the real `createClient` hands to supabase-js, so they fail on the
 * pre-#1255 module rather than on a restatement of it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/lib/supabase/client');

const { createSupabaseClient } = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(() => ({ auth: {} })),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: createSupabaseClient,
}));

type AuthOptions = { flowType?: string; detectSessionInUrl?: unknown };

async function authOptionsAt(path: string): Promise<AuthOptions> {
  window.history.replaceState(null, '', path);
  vi.resetModules();
  const { createClient } = await import('@/lib/supabase/client');
  createClient();
  const call = createSupabaseClient.mock.calls.at(-1) as unknown as [
    string,
    string,
    { auth: AuthOptions },
  ];
  return call[2].auth;
}

beforeEach(() => {
  createSupabaseClient.mockClear();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://abcdefgh.supabase.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, '', '/');
});

describe('supabase client URL sessions (#1255)', () => {
  it('uses PKCE, so a sign-in link only works in the browser that asked for it', async () => {
    expect((await authOptionsAt('/')).flowType).toBe('pkce');
  });

  it('redeems a code on the auth callback', async () => {
    expect(
      (await authOptionsAt('/auth/callback/?code=abc')).detectSessionInUrl
    ).toBe(true);
  });

  it('redeems a code on the password-reset page', async () => {
    expect(
      (await authOptionsAt('/reset-password/?code=abc')).detectSessionInUrl
    ).toBe(true);
  });

  it.each([
    '/#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer',
    '/?access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer',
    '/auth/callback/#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer',
    '/profile/?code=abc',
    '/auth/callback/#error=server_error&error_description=x',
    '/',
  ])('leaves the URL alone on %s', async (path) => {
    expect((await authOptionsAt(path)).detectSessionInUrl).toBe(false);
  });
});
