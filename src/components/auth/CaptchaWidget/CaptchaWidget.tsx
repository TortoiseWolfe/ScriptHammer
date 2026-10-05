'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { captchaConfig } from '@/config/captcha.config';

/** The library's default id for the script it injects, stated so it can be removed. */
export const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_FAILED_EVENT = 'turnstile-script:failed';

/*
 * Spot a failed Turnstile script without the library's `scriptOptions.onError`. Passing
 * that option makes the library delete Cloudflare's onload callback, and Cloudflare then
 * logs "Unable to find onload callback" on every page with a widget (measured, #1321).
 *
 * Resource load errors don't bubble, but a CAPTURING listener on `window` sees them. It is
 * installed once, at import, so it is in place before the library injects the script.
 */
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.id === TURNSTILE_SCRIPT_ID) {
        target.dataset.failed = 'true';
        window.dispatchEvent(new Event(SCRIPT_FAILED_EVENT));
      }
    },
    true
  );
}

/** Remove the Turnstile script if it failed to load, so the next mount injects it again. */
function clearFailedScript(): boolean {
  const el = document.getElementById(TURNSTILE_SCRIPT_ID);
  if (el?.dataset.failed !== 'true') return false;
  el.remove();
  return true;
}

export interface CaptchaWidgetProps {
  /**
   * Called with a fresh CAPTCHA token when the challenge is solved, and with
   * `null` whenever the token stops being valid (expired, errored, or reset).
   * Treat `null` as "not verified" and block submission — tokens are
   * single-use and short-lived.
   */
  onToken: (token: string | null) => void;
  /**
   * When the widget is visible. `always` (the default, and what sign-up uses)
   * shows it from load. `interaction-only` keeps it hidden — out of the layout
   * AND out of the tab order — unless Cloudflare actually wants the visitor to
   * do something, which is the right trade on a form most people use once
   * (/contact/, #1319). Visible, it is a control like any other and takes its
   * tab stop between the last field and submit.
   */
  appearance?: 'always' | 'interaction-only';
  /**
   * Called when the challenge itself fails, for example a blocked script, no network, or a
   * domain the key doesn't allow. `onToken(null)` fires then too, but it also fires on
   * expiry and reset, so a caller with no visible widget to fall back on needs this to
   * tell "failed" from "not yet". The offline sender uses it (#1321).
   */
  onError?: () => void;
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
  function CaptchaWidget(
    { onToken, appearance = 'always', onError, className = '' },
    ref
  ) {
    const instance = useRef<TurnstileInstance>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        instance.current?.reset();
        onToken(null);
      },
    }));

    // A FAILED SCRIPT LOAD MUST NOT BE PERMANENT (#1321). The library injects
    // `<script id="cf-turnstile-script">` once and never again while that element
    // exists, even when it failed. A visitor who opened the page offline, which is
    // exactly when a contact message gets saved, therefore never got a token after
    // the connection came back. Measured: the offline sender sat on "Sending..."
    // forever.
    //
    // So a failed load is reported, and the widget remounts after removing the dead
    // element, which makes the library inject the script afresh. That happens on the
    // next `online` event, and on mount when an earlier widget's load already failed.
    const [generation, setGeneration] = useState(0);
    const callbacks = useRef({ onToken, onError });
    callbacks.current = { onToken, onError };
    useEffect(() => {
      const failed = () => {
        callbacks.current.onToken(null);
        callbacks.current.onError?.();
      };
      const retry = () => {
        if (clearFailedScript()) setGeneration((g) => g + 1);
      };
      if (navigator.onLine) retry();
      window.addEventListener(SCRIPT_FAILED_EVENT, failed);
      window.addEventListener('online', retry);
      return () => {
        window.removeEventListener(SCRIPT_FAILED_EVENT, failed);
        window.removeEventListener('online', retry);
      };
    }, []);

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
          key={generation}
          ref={instance}
          siteKey={captchaConfig.siteKey}
          onSuccess={(token) => onToken(token)}
          // A token is single-use and expires (~5 min). Clearing it forces a
          // fresh solve rather than submitting a stale token that Supabase
          // would reject with a confusing error.
          onExpire={() => onToken(null)}
          onError={() => {
            onToken(null);
            onError?.();
          }}
          options={{ theme: 'auto', size: 'compact', appearance }}
        />
      </div>
    );
  }
);

export default CaptchaWidget;
