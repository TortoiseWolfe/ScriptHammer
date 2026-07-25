/**
 * CAPTCHA Configuration (#353)
 *
 * Bot protection for the public sign-up form. Supabase Auth verifies the token
 * server-side, so this module only carries what the browser needs: which
 * provider renders the widget, and the public site key.
 *
 * ## Why this exists
 * The sign-up form already rate-limits (`checkRateLimit(email, 'sign_up')`), but
 * that limit is keyed on the EMAIL ADDRESS — a bot that uses a fresh address per
 * attempt never trips it. That is exactly what happened: 17 accounts created in a
 * 7-day window, 13 of which belonged to people who never asked for one, meaning
 * our domain sent them mail. A per-request bot check is the missing control.
 *
 * ## Fork-safe by default
 * Everything is INERT until `NEXT_PUBLIC_CAPTCHA_SITE_KEY` is set. A fork with no
 * key renders no widget and sends no token, exactly as before. This also makes
 * the rollout safe: the client can ship first and the Supabase-side enforcement
 * can be switched on afterwards, with no window where sign-up is broken.
 *
 * **Ordering matters.** Supabase rejects a token-less sign-up the moment
 * `SECURITY_CAPTCHA_ENABLED` is true, so the site key must be deployed BEFORE
 * that flag is flipped — never the other way round.
 *
 * Mirrors the env-var-provider precedent in `backend.config.ts` /
 * `calendar.config.ts`.
 *
 * @module config/captcha
 */

/**
 * Which CAPTCHA vendor renders the widget. Supabase Auth accepts `turnstile`
 * and `hcaptcha`; we use Cloudflare Turnstile (free, unlimited, and usually
 * invisible to real users, so it costs legitimate signups nothing).
 */
export type CaptchaProvider = 'turnstile';

export interface CaptchaConfig {
  /** The active provider. Must match Supabase's `SECURITY_CAPTCHA_PROVIDER`. */
  provider: CaptchaProvider;
  /**
   * Public site key from the Cloudflare Turnstile dashboard. Safe to expose —
   * the SECRET half lives only in Supabase Auth config and is never shipped to
   * the browser. Undefined/empty leaves CAPTCHA off.
   */
  siteKey?: string;
  /**
   * Whether to render the widget and require a token. Derived from `siteKey`
   * so there is a single source of truth and no way to half-enable it.
   */
  enabled: boolean;
}

// Read directly (not via a helper) so Next.js can inline the value at build
// time — NEXT_PUBLIC_* substitution is textual, and an indirect lookup would
// leave it undefined in the static export.
const siteKey = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY?.trim() || undefined;

export const captchaConfig: CaptchaConfig = {
  provider: 'turnstile',
  siteKey,
  enabled: Boolean(siteKey),
};
