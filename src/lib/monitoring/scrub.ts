/**
 * PII scrubber for Sentry events.
 *
 * Pure, SDK-free transforms (only Sentry *types* are imported, which erase at
 * build time) so the logic is exhaustively unit-testable without initializing
 * the SDK. Used as Sentry's `beforeSend` / `beforeBreadcrumb` so no sensitive
 * data ever leaves the browser:
 *  - emails, JWTs, Bearer tokens, access/refresh-token pairs, Supabase
 *    `sb-<ref>-auth-token` localStorage keys (string-level regex)
 *  - decrypted message bodies + secrets, by whole-value redaction of known
 *    sensitive object keys (`content`, `plaintext_content`, `new_content`,
 *    `encrypted_content`, `password`) — these may not match any regex, so the
 *    whole value is dropped.
 *
 * Every transform is defensive: a throw inside `beforeSend` silently drops the
 * event, so this must never throw on a missing/oddly-shaped field.
 */

import type { Event, Breadcrumb } from '@sentry/react';

const REDACTED = '[REDACTED]';

// Run key/token patterns BEFORE the broad email pattern so partial matches in
// tokens don't get half-redacted by the email regex first.
const SB_AUTH_KEY_RE = /sb-[a-z0-9]+-auth-token/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._-]+/gi;
const TOKEN_KV_RE =
  /("?(?:access_token|refresh_token)"?\s*[:=]\s*"?)[^"\s,&]+/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Object keys whose VALUE is always sensitive (plaintext message bodies,
// ciphertext, secrets) — redacted wholesale regardless of value shape.
const SENSITIVE_KEYS = new Set([
  'content',
  'plaintext_content',
  'new_content',
  'encrypted_content',
  'password',
]);

/** Redact PII patterns from a single string. */
export function scrubString(input: string): string {
  if (typeof input !== 'string' || input.length === 0) return input;
  return input
    .replace(SB_AUTH_KEY_RE, REDACTED)
    .replace(JWT_RE, REDACTED)
    .replace(BEARER_RE, `Bearer ${REDACTED}`)
    .replace(TOKEN_KV_RE, `$1${REDACTED}`)
    .replace(EMAIL_RE, REDACTED);
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === 'object') {
    return scrubObject(value as Record<string, unknown>);
  }
  return value;
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = SENSITIVE_KEYS.has(key) ? REDACTED : scrubValue(value);
  }
  return out;
}

/** Scrub a Sentry breadcrumb's message and data in place. */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  if (typeof crumb.message === 'string') {
    crumb.message = scrubString(crumb.message);
  }
  if (crumb.data && typeof crumb.data === 'object') {
    crumb.data = scrubObject(crumb.data as Record<string, unknown>);
  }
  return crumb;
}

/**
 * Sentry `beforeSend` hook. Scrubs every field that can carry user data, then
 * returns the (mutated) event. Returns `null` only if Sentry passes null.
 */
export function scrubEvent(event: Event): Event | null {
  if (!event) return event;

  if (typeof event.message === 'string') {
    event.message = scrubString(event.message);
  }

  event.exception?.values?.forEach((ex) => {
    if (typeof ex.value === 'string') ex.value = scrubString(ex.value);
  });

  if (event.request && typeof event.request === 'object') {
    event.request = scrubObject(
      event.request as unknown as Record<string, unknown>
    ) as unknown as Event['request'];
  }

  if (event.extra && typeof event.extra === 'object') {
    event.extra = scrubObject(event.extra);
  }

  if (event.contexts && typeof event.contexts === 'object') {
    event.contexts = scrubObject(
      event.contexts as Record<string, unknown>
    ) as Event['contexts'];
  }

  if (event.tags && typeof event.tags === 'object') {
    event.tags = scrubObject(
      event.tags as Record<string, unknown>
    ) as Event['tags'];
  }

  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }

  return event;
}
