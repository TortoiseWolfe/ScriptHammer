'use client';

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { captchaConfig } from '@/config/captcha.config';

export interface CaptchaWidgetProps {
  /**
   * Called with a fresh CAPTCHA token when the challenge is solved, and with
   * `null` whenever the token stops being valid (expired, errored, or reset).
   * Treat `null` as "not verified" and block submission — tokens are
   * single-use and short-lived.
   */
  onToken: (token: string | null) => void;
  /** Additional CSS classes */
  className?: string;
}

/** Imperative handle so a parent form can force a re-solve. */
export interface CaptchaWidgetHandle {
  /**
   * Discard the current challenge and issue a new one. Required after ANY
   * failed submit: Turnstile tokens are single-use, so the spent token would
   * otherwise sit in the widget, `onSuccess` would never fire again, and the
   * user could never retry.
   */
  reset: () => void;
}

/**
 * Sign-up bot protection (#353) — a Cloudflare Turnstile challenge.
 *
 * Renders NOTHING and reports no token when `NEXT_PUBLIC_CAPTCHA_SITE_KEY` is
 * unset. That keeps forks and local dev working untouched, and lets this ship
 * ahead of the Supabase-side enforcement so there is never a window where
 * sign-up is broken. See `src/config/captcha.config.ts`.
 *
 * Supabase verifies the token server-side on `auth.signUp`; nothing here is a
 * security boundary on its own — a bot can always skip the widget and post
 * directly. The control that actually matters is
 * `SECURITY_CAPTCHA_ENABLED = true` in Supabase Auth.
 *
 * Requires `https://challenges.cloudflare.com` in the CSP's `script-src`,
 * `frame-src` and `connect-src` (see `src/app/layout.tsx`).
 *
 * @category auth
 */
const CaptchaWidget = forwardRef<CaptchaWidgetHandle, CaptchaWidgetProps>(
  function CaptchaWidget({ onToken, className = '' }, ref) {
    const instance = useRef<TurnstileInstance>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        instance.current?.reset();
        onToken(null);
      },
    }));

    // `compact`, deliberately, and the numbers are why (#488).
    //
    // MEASURED on /sign-in at a 320px viewport, where the form column offers
    // 248px of content width:
    //
    //   size        widget     plate   elements past the viewport
    //   normal      300x65      348     28      <- what shipped before
    //   flexible    300x65      348     28
    //   compact     150x140     296      0
    //
    // **`flexible` is NOT a fix here**, despite reading like one: Cloudflare
    // clamps it to a 300px MINIMUM, so below ~350px it renders identically to
    // `normal`. Measured at a 500px viewport it becomes 388px wide, so the
    // clamp — not the prop — is the constraint. #488, #428 and #374 all
    // described this width as Cloudflare's and unfixable; it is ours to set,
    // but `flexible` alone does not set it low enough.
    //
    // `compact` is the only size that fits 320px, and the plate shrinks with it
    // (348 -> 296) because the plate was only ever as wide as its widest child
    // plus its own `px-6`: 300 + 48 = 348 exactly. One cause, not the two the
    // ticket originally described.
    //
    // The cost is 75px of height (140 vs 65) at EVERY width, which is the
    // vertical spend #374 objects to. A per-breakpoint size (compact below
    // `sm`, flexible above) was built and measured: the media listener flips
    // correctly on resize, but a fresh load above the breakpoint still rendered
    // `compact`, and shipping a path I could not explain was the worse trade.
    // Recorded in #488 as a follow-up with the measurements.
    if (!captchaConfig.enabled || !captchaConfig.siteKey) return null;

    return (
      <div
        className={`captcha-widget${className ? ` ${className}` : ''}`}
        data-testid="captcha-widget"
      >
        <Turnstile
          ref={instance}
          siteKey={captchaConfig.siteKey}
          onSuccess={(token) => onToken(token)}
          // A token is single-use and expires (~5 min). Clearing it forces a
          // fresh solve rather than submitting a stale token that Supabase
          // would reject with a confusing error.
          onExpire={() => onToken(null)}
          onError={() => onToken(null)}
          options={{ theme: 'auto', size: 'compact' }}
        />
      </div>
    );
  }
);

export default CaptchaWidget;
