/**
 * Guard for specs that drive the REAL sign-in form (#353).
 *
 * ## Why these specs cannot run against a CAPTCHA-protected backend
 *
 * `SECURITY_CAPTCHA_ENABLED` is global to Supabase Auth, so the password grant
 * is refused with `captcha_failed` unless a Turnstile token is attached. A
 * production token can only come from Cloudflare solving a challenge, and
 * Turnstile exists precisely to withhold tokens from automated browsers. The
 * local signup-mailer lane is the exception: it uses Cloudflare's published
 * always-pass test key pair to exercise the same widget and server verification
 * without touching production.
 *
 * Hosted E2E builds omit `NEXT_PUBLIC_CAPTCHA_SITE_KEY`, so those forms submit
 * token-less and the protected cloud backend refuses them. The local
 * signup-mailer build instead renders the test widget and uses the matching
 * local GoTrue secret.
 *
 * ## Why this PROBES instead of hard-coding a skip
 *
 * A literal `test.skip(true, ...)` would keep skipping after protection is
 * turned off, and nothing would notice — the same silent-coverage-loss trap
 * that let the missing CAPTCHA go unseen in the first place. Asking the backend
 * what is actually true means these specs resume automatically wherever captcha
 * is disabled, and the explicit local Turnstile test configuration lets them
 * exercise the protected path in `signup-mailer.yml`.
 *
 * @module tests/e2e/utils/captcha-guard
 */
import { expect, test, type Page } from '@playwright/test';

let cached: Promise<boolean> | null = null;

/**
 * Limit the test-key exception to the local signup-mailer stack. The explicit
 * flag alone is insufficient: never submit against a remote backend or a build
 * that did not render the test widget.
 */
export function isLocalTurnstileTestEnabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return (
    process.env.E2E_LOCAL_TURNSTILE_TESTS === 'true' &&
    Boolean(process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY?.trim()) &&
    /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(url)
  );
}

/**
 * Wait until Cloudflare's published local test key has produced its dummy
 * token. The widget loads asynchronously; submitting before it calls onSuccess
 * only exercises the client-side "verification required" guard.
 */
export async function waitForLocalTurnstileToken(page: Page): Promise<void> {
  if (!isLocalTurnstileTestEnabled()) return;

  await expect(page.getByTestId('captcha-widget')).toBeVisible();
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(
    /\S/,
    { timeout: 30_000 }
  );
}

/**
 * Ask the live backend whether the password grant requires a captcha token.
 *
 * Uses an address that cannot belong to a real user, so the only interesting
 * outcomes are `captcha_failed` (protection on) versus `invalid_credentials`
 * (protection off). Deliberately does NOT create or touch any user.
 */
export function isBackendCaptchaProtected(): Promise<boolean> {
  if (cached) return cached;

  cached = (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return false;

    try {
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'captcha-probe@e2e.invalid',
          password: 'not-a-real-password',
        }),
      });
      const body = await res.json().catch(() => ({}));
      return body?.error_code === 'captcha_failed';
    } catch {
      // Unreachable backend is a different failure; let the spec report it
      // rather than skipping and reporting nothing.
      return false;
    }
  })();

  return cached;
}

/**
 * Skip the current test when the backend requires a captcha token, except when
 * the local stack is using the explicit published Turnstile test-key pair.
 *
 * @param reason - What this spec covers, named so a skipped run still says what
 * is no longer being verified.
 */
export async function skipIfBackendCaptchaProtected(
  reason: string
): Promise<void> {
  const protectedBackend = await isBackendCaptchaProtected();
  test.skip(
    protectedBackend && !isLocalTurnstileTestEnabled(),
    `${reason} — the backend is CAPTCHA-protected (#353) and the real sign-in ` +
      `form cannot be submitted with production keys in automation. Use the ` +
      `local signup-mailer run with Cloudflare's published Turnstile test keys.`
  );
}
