/**
 * Which URLs may sign someone in (#1255).
 *
 * The client used the implicit flow and read a session out of the URL on every page, so any
 * link carrying `#access_token=…&refresh_token=…` signed whoever clicked it into that account.
 * An attacker mints a session for an account they control, appends it to a link to this site,
 * and the victim is working inside the attacker's account — login CSRF. Restricting WHERE the
 * URL is read cannot fix that alone: the attacker simply links to the callback page.
 *
 * What fixes it is binding the link to the browser that asked for it. The client now uses PKCE:
 * starting a flow (sign-up, password reset, OAuth) stores a random verifier in this browser,
 * and the link that comes back carries a `?code=` that GoTrue exchanges only together with that
 * verifier. An attacker's code was issued against the attacker's verifier, which the victim's
 * browser has never seen.
 *
 * These rules decide the rest: only the two pages a sign-in lands on redeem a code, and tokens
 * handed over in the URL are never consumed anywhere. Pure functions, so the client, the landing
 * pages and the tests all read the same definition.
 */
import { getInternalUrl } from '@/config/project.config';

/** The pages GoTrue redirects a sign-in back to. Every `redirectTo` in src/ points at one. */
const AUTH_LANDING_ROUTES = ['/auth/callback', '/reset-password'] as const;

/** Implicit-flow session parameters, in either half of a URL. */
const SESSION_TOKEN_KEYS = [
  'access_token',
  'refresh_token',
  'expires_at',
  'expires_in',
  'token_type',
  'type',
  'provider_token',
  'provider_refresh_token',
] as const;

const ERROR_KEYS = ['error', 'error_description', 'error_code'] as const;

const withoutTrailingSlash = (path: string) =>
  path.length > 1 ? path.replace(/\/+$/, '') : path;

/**
 * True for exactly the auth landing routes, under whatever basePath this build serves. An exact
 * match: a prefix or substring test would also accept `/auth/callback-x/` or `/x/auth/callback/`.
 */
export function isAuthLandingPath(pathname: string): boolean {
  const path = withoutTrailingSlash(pathname);
  return AUTH_LANDING_ROUTES.some(
    (route) => withoutTrailingSlash(getInternalUrl(route)) === path
  );
}

export interface AuthLinkParams {
  /** A PKCE authorization code — redeemable only with the verifier this browser stored. */
  code: string | null;
  /** An implicit-flow session in the fragment or query. Never consumed (#1255). */
  hasTokens: boolean;
  error: string | null;
  errorDescription: string | null;
}

function halves(href: string): [URLSearchParams, URLSearchParams] {
  const url = new URL(href, 'http://localhost');
  return [url.searchParams, new URLSearchParams(url.hash.replace(/^#/, ''))];
}

/** What a sign-in link carried, read from both halves of the URL. */
export function readAuthLinkParams(href: string): AuthLinkParams {
  const [query, hash] = halves(href);
  const read = (key: string) => query.get(key) || hash.get(key) || null;
  return {
    code: query.get('code') || null,
    hasTokens: read('access_token') !== null || read('refresh_token') !== null,
    error: read('error') ?? read('error_code'),
    errorDescription: read('error_description'),
  };
}

/**
 * Whether auth-js should look at this URL at all. Only a code, only on a landing route, and
 * never beside an error: auth-js answers an error URL by clearing the stored session, and the
 * landing pages report errors themselves.
 */
export function shouldDetectSessionInUrl(href: string): boolean {
  const [query, hash] = halves(href);
  const hasError = ERROR_KEYS.some((key) => query.has(key) || hash.has(key));
  return (
    !hasError &&
    Boolean(query.get('code')) &&
    isAuthLandingPath(new URL(href, 'http://localhost').pathname)
  );
}

/**
 * The same URL, relative, without any implicit-flow session parameters — or null when it
 * carried none, so the caller leaves history alone. A link that is refused should not leave a
 * live session sitting in the address bar and the history.
 */
export function stripSessionTokens(href: string): string | null {
  const url = new URL(href, 'http://localhost');
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const carried = (params: URLSearchParams) =>
    params.has('access_token') || params.has('refresh_token');
  if (!carried(url.searchParams) && !carried(hash)) return null;

  for (const key of SESSION_TOKEN_KEYS) {
    url.searchParams.delete(key);
    hash.delete(key);
  }
  const search = url.searchParams.toString();
  const fragment = hash.toString();
  return `${url.pathname}${search ? `?${search}` : ''}${fragment ? `#${fragment}` : ''}`;
}
