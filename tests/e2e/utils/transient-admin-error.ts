/**
 * Telling a transient Supabase admin-API blip apart from a real prerequisite
 * failure (#345).
 *
 * ## Why this exists
 * Under the 28-shard push-to-main matrix, ~15 Playwright invocations hit the
 * auth admin API at once and it occasionally fails with an **empty** error —
 * the reported signature is a bare `{}`. One of those used to red an entire
 * shard's setup, turning `main` red until someone re-ran it, even though the
 * shared users were perfectly healthy.
 *
 * ## The distinction that matters
 * A GENUINE refusal always names a reason: "Invalid login credentials", "not
 * authorized", a 4xx. A transient names nothing, or names a network/5xx
 * condition. Only the latter may be retried.
 *
 * Getting this backwards in either direction is costly:
 * - Retrying a genuine failure hides real misconfiguration behind a delay.
 * - Not retrying a transient reds `main` for a blip, which trains people to
 *   re-run red builds without reading them — the habit that lets real
 *   failures through.
 *
 * It also preserves #338's guarantee: a `listUsers` error must never be read
 * as "user absent", because that triggers the destructive recreate path that
 * once corrupted the shared PRIMARY user.
 *
 * Kept in its own module so it can be unit-tested without importing
 * `global-setup.ts` and its whole dependency tree.
 *
 * @module tests/e2e/utils/transient-admin-error
 */

/** Network/gateway conditions that are safe to retry. */
const TRANSIENT_PATTERN =
  /timeout|timed out|fetch failed|network|socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN|502|503|504|upstream|gateway/i;

/**
 * Should this admin-API error be retried?
 *
 * @param error - The `error` from a supabase-js `{ data, error }` result.
 * @returns true only for errors that carry no explanation, or name a
 * network/5xx condition.
 */
export function isTransientAdminError(error: unknown): boolean {
  if (!error) return false;

  const e = error as { message?: string; status?: number };
  const message = (e.message ?? '').trim();

  // The #345 signature: an error object carrying no explanation at all. This
  // is what logs rendered as the infamous bare `{}`.
  if (message === '' || message === '{}') return true;

  // 5xx is the server failing, not us. 4xx is a real refusal — never retried.
  if (typeof e.status === 'number' && e.status >= 500) return true;

  return TRANSIENT_PATTERN.test(message);
}
