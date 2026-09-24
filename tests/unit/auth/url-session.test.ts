/**
 * Which URLs may sign someone in (#1255).
 *
 * The client used to consume a session from the URL on EVERY page: any link carrying
 * `#access_token=…&refresh_token=…` signed whoever clicked it into that account. An attacker
 * mints a session for an account they control, appends it to a link to this site, and the
 * victim is now working inside the attacker's account — login CSRF.
 *
 * The fix binds every sign-in link to the browser that asked for it (PKCE: a `?code=` that only
 * the verifier stored at the start of the flow can redeem), and only two pages redeem one. These
 * are the rules those pages and the client read.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isAuthLandingPath,
  readAuthLinkParams,
  shouldDetectSessionInUrl,
  stripSessionTokens,
} from '@/lib/auth/url-session';

const TOKENS =
  'access_token=AT&expires_at=9999999999&expires_in=3600&refresh_token=RT&token_type=bearer&type=signup';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isAuthLandingPath', () => {
  it.each(['/auth/callback/', '/auth/callback', '/reset-password/'])(
    'accepts the landing route %s',
    (path) => expect(isAuthLandingPath(path)).toBe(true)
  );

  it.each([
    '/',
    '/profile/',
    '/sign-in/',
    '/auth/callback-x/',
    '/auth/callback/x/',
    '/x/auth/callback/',
  ])('refuses %s — an exact match, never a prefix or substring', (path) =>
    expect(isAuthLandingPath(path)).toBe(false)
  );

  it('follows the basePath a fork deploys under', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/ScriptHammer');
    expect(isAuthLandingPath('/ScriptHammer/auth/callback/')).toBe(true);
    expect(isAuthLandingPath('/ScriptHammer/reset-password')).toBe(true);
    expect(isAuthLandingPath('/auth/callback/')).toBe(false);
  });
});

describe('shouldDetectSessionInUrl', () => {
  it.each([
    'https://site.test/auth/callback/?code=abc',
    'https://site.test/reset-password/?code=abc',
  ])('redeems a PKCE code on a landing route: %s', (href) =>
    expect(shouldDetectSessionInUrl(href)).toBe(true)
  );

  it.each([
    // The attack: a session handed over in the URL. Never consumed, on any route.
    [`https://site.test/#${TOKENS}`, 'tokens in the fragment, home page'],
    [`https://site.test/?${TOKENS}`, 'tokens in the query, home page'],
    [`https://site.test/auth/callback/#${TOKENS}`, 'tokens on the callback'],
    [`https://site.test/auth/callback/?${TOKENS}`, 'query tokens, callback'],
    [`https://site.test/reset-password/#${TOKENS}`, 'tokens on reset'],
    // A code is only redeemed where a sign-in lands.
    ['https://site.test/?code=abc', 'a code off the landing routes'],
    ['https://site.test/profile/?code=abc', 'a code on another page'],
    // An error URL makes auth-js clear the stored session. The page shows the error itself.
    [
      'https://site.test/auth/callback/?error=access_denied&error_description=denied',
      'an error in the query',
    ],
    [
      'https://site.test/auth/callback/#error=server_error&error_description=x',
      'an error in the fragment',
    ],
    [
      'https://site.test/auth/callback/?code=abc#error_description=x',
      'a code beside an error',
    ],
    ['https://site.test/auth/callback/', 'nothing to redeem'],
    ['https://site.test/auth/callback/?code=', 'an empty code'],
  ])('does not detect %s (%s)', (href) =>
    expect(shouldDetectSessionInUrl(href)).toBe(false)
  );
});

describe('readAuthLinkParams', () => {
  it('reads a PKCE code from the query', () => {
    expect(
      readAuthLinkParams('https://site.test/auth/callback/?code=abc')
    ).toEqual({
      code: 'abc',
      hasTokens: false,
      error: null,
      errorDescription: null,
    });
  });

  it('notices tokens in either half of the URL', () => {
    expect(
      readAuthLinkParams(`https://site.test/auth/callback/#${TOKENS}`).hasTokens
    ).toBe(true);
    expect(
      readAuthLinkParams(`https://site.test/?refresh_token=RT`).hasTokens
    ).toBe(true);
  });

  it('reads an error from the fragment or the query', () => {
    expect(
      readAuthLinkParams(
        'https://site.test/auth/callback/#error=otp_expired&error_description=Email+link+is+invalid'
      )
    ).toMatchObject({
      error: 'otp_expired',
      errorDescription: 'Email link is invalid',
    });
    expect(
      readAuthLinkParams('https://site.test/auth/callback/?error=access_denied')
        .error
    ).toBe('access_denied');
  });
});

describe('stripSessionTokens', () => {
  it('removes a fragment that carried only a session', () => {
    expect(
      stripSessionTokens(`https://site.test/auth/callback/#${TOKENS}`)
    ).toBe('/auth/callback/');
  });

  it('removes token keys from the query and keeps everything else', () => {
    expect(
      stripSessionTokens(
        'https://site.test/?access_token=AT&refresh_token=RT&utm_source=mail'
      )
    ).toBe('/?utm_source=mail');
  });

  it('keeps the rest of a fragment', () => {
    expect(
      stripSessionTokens('https://site.test/x/#access_token=AT&tab=2')
    ).toBe('/x/#tab=2');
  });

  it('returns null when there is nothing to strip, so callers leave history alone', () => {
    expect(stripSessionTokens('https://site.test/profile/')).toBeNull();
    expect(stripSessionTokens('https://site.test/docs/#section-2')).toBeNull();
    expect(
      stripSessionTokens('https://site.test/auth/callback/?code=abc')
    ).toBeNull();
  });
});
