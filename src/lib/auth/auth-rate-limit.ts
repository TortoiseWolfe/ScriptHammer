/**
 * What to tell someone whose sign-in, sign-up or reset request Supabase Auth refused for rate
 * (#1245).
 *
 * The limits that protect these forms are GoTrue's: a captcha on every password grant, sign-up
 * and recovery, and per-IP request ceilings. When one refuses, auth-js throws an `AuthApiError`
 * with status 429 and a code naming the limit. The forms used to consult a second, email-keyed
 * lockout in the browser first. It stopped nobody who called GoTrue directly, and it let anyone
 * lock anyone else out with five anonymous calls — so the only limit a person can now meet is
 * GoTrue's, and this is where it becomes a sentence.
 *
 * @module lib/auth/auth-rate-limit
 */

/**
 * GoTrue answers `over_email_send_rate_limit` for two different limits: the project's hourly
 * cap on auth email, and a per-address wait between emails to the same person. The sentence has
 * to be true for both, and must not say which — on the reset form, "an email went to this
 * address recently" would confirm the address is registered.
 */
export const EMAIL_QUOTA_MESSAGE =
  'Too many emails have been sent recently. Check your inbox, or try again later.';

/** A per-network request ceiling, which clears within minutes. */
export const REQUEST_RATE_MESSAGE =
  'Too many attempts. Please wait a few minutes, then try again.';

/**
 * The message for a rate-limit refusal, or `null` when `error` is anything else — so a caller
 * can fall through to its ordinary error handling.
 */
export function authRateLimitMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { status, code } = error as { status?: unknown; code?: unknown };
  const limited =
    status === 429 ||
    (typeof code === 'string' && /^over_[a-z_]+_rate_limit$/.test(code));
  if (!limited) return null;
  return code === 'over_email_send_rate_limit'
    ? EMAIL_QUOTA_MESSAGE
    : REQUEST_RATE_MESSAGE;
}
