/**
 * Guard for specs that drive the REAL sign-in form (#353).
 *
 * ## Why these specs cannot run against a CAPTCHA-protected backend
 *
 * `SECURITY_CAPTCHA_ENABLED` is global to Supabase Auth, so the password grant
 * is refused with `captcha_failed` unless a Turnstile token is attached. A
 * token can only come from Cloudflare solving a challenge, and Turnstile exists
 * precisely to withhold tokens from automated browsers. If Playwright could
 * satisfy it, it would not be doing its job — so this is not a gap to engineer
 * around, it is the control working.
 *
 * The E2E build compounds this: `NEXT_PUBLIC_CAPTCHA_SITE_KEY` is passed only
 * by `deploy.yml`, so E2E builds render no widget at all. The form therefore
 * submits token-less and the server refuses it. The failure is not even a
 * captcha prompt the test could see — it surfaces as a raw
 * `captcha protection: request disallowed` string where the spec expected
 * `invalid credentials`.
 *
 * ## Why this PROBES instead of hard-coding a skip
 *
 * A literal `test.skip(true, ...)` would keep skipping after protection is
 * turned off, and nothing would notice — the same silent-coverage-loss trap
 * that let the missing CAPTCHA go unseen in the first place. Asking the backend
 * what is actually true means these specs resume automatically wherever captcha
 * is disabled, which is exactly the case for the local-Supabase runs
 * (`signup-mailer.yml`) where real-form auth coverage belongs.
 *
 * @module tests/e2e/utils/captcha-guard
 */
import { test } from '@playwright/test';

let cached: Promise<boolean> | null = null;

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
 * Skip the current test when the backend requires a captcha token, because the
 * spec signs in through the real form and no token can be obtained in CI.
 *
 * @param reason - What this spec covers, named so a skipped run still says what
 * is no longer being verified.
 */
export async function skipIfBackendCaptchaProtected(
  reason: string
): Promise<void> {
  const protectedBackend = await isBackendCaptchaProtected();
  test.skip(
    protectedBackend,
    `${reason} — the backend is CAPTCHA-protected (#353) and the real sign-in ` +
      `form cannot be submitted without a Turnstile token, which Cloudflare ` +
      `withholds from automation by design. Coverage belongs on a local ` +
      `Supabase run where captcha is off (see signup-mailer.yml).`
  );
}
