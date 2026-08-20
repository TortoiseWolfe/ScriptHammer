'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { setSessionPersistence } from '@/lib/supabase/client';
import CaptchaWidget, {
  type CaptchaWidgetHandle,
} from '@/components/auth/CaptchaWidget';
import { captchaConfig } from '@/config/captcha.config';
import {
  checkRateLimit,
  recordFailedAttempt,
  formatLockoutTime,
} from '@/lib/auth/rate-limit-check';
import { validateEmail } from '@/lib/auth/email-validator';
import { logAuthEvent } from '@/lib/auth/audit-logger';
import { getInternalUrl } from '@/config/project.config';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:auth:SignInForm');

export interface SignInFormProps {
  /** Callback on successful sign in */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SignInForm component
 * Email/password sign-in with server-side rate limiting
 *
 * @category molecular
 */
export default function SignInForm({
  onSuccess,
  className = '',
}: SignInFormProps) {
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * The error for ONE named field, kept apart from `error` (#857).
   *
   * Everything used to funnel into `error` and render in a single form-level
   * alert with no `id`, while no input carried `aria-invalid` or
   * `aria-describedby`. A screen-reader user heard "Invalid email address" with
   * nothing tying it to the field it was about.
   *
   * Only CLIENT-SIDE validation is field-scoped. The post-submit sign-in failure
   * deliberately stays form-level: that message is generic to avoid account
   * enumeration, and pinning it to the email input would both mislead and hint
   * at which half was wrong. Rate limiting and the captcha challenge are not
   * about one field either.
   */
  const [fieldError, setFieldError] = useState<{
    field: 'email';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null
  );
  // (#353) SECURITY_CAPTCHA_ENABLED is GLOBAL to Supabase auth — it gates
  // sign-IN as well as sign-up. Omitting this here is what locked every
  // existing user out of production the first time the flag was flipped.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    // Enhanced email validation (REQ-SEC-004). Field-scoped: this one IS about
    // the email input, so it is announced against it (#857).
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setFieldError({
        field: 'email',
        message: emailValidation.errors[0] || 'Invalid email address',
      });
      return;
    }

    // Check server-side rate limit (REQ-SEC-003). checkRateLimit is
    // fail-CLOSED by design (it returns allowed:false if the rate-limit
    // infrastructure is down, to prevent brute force) — matching SignUpForm
    // and ForgotPasswordForm, which also call it directly. Do NOT wrap it in a
    // fail-open catch: that would silently disable brute-force protection on a
    // backend outage, contradicting the wrapper's documented policy.
    if (captchaConfig.enabled && !captchaToken) {
      setError('Please complete the verification challenge.');
      return;
    }

    const rateLimit = await checkRateLimit(email, 'sign_in');

    if (!rateLimit.allowed) {
      const timeUntilReset = rateLimit.locked_until
        ? formatLockoutTime(rateLimit.locked_until)
        : '15 minutes';
      setError(
        `Too many failed attempts. Your account has been temporarily locked. Please try again in ${timeUntilReset}.`
      );
      setRemainingAttempts(0);
      return;
    }

    setRemainingAttempts(rateLimit.remaining);
    setLoading(true);

    // BEFORE the auth call, not after (#375). The session is written to storage
    // as part of signIn, so the preference has to already be recorded or the
    // token lands in the wrong store and has to be migrated. Until this line
    // existed, `rememberMe` reached nothing at all: its only consumers were the
    // checkbox's own `checked` and `onChange`.
    setSessionPersistence(rememberMe);

    const { error: signInError } = await signIn(
      email,
      password,
      captchaToken ?? undefined
    );

    setLoading(false);

    if (signInError) {
      // Turnstile tokens are single-use; reset so a retry can get a fresh one.
      captchaRef.current?.reset();

      // Check if email needs verification
      if (signInError.message.toLowerCase().includes('email not confirmed')) {
        window.location.href = getInternalUrl('/verify-email');
        return;
      }

      // Record failed attempt on server (REQ-SEC-003)
      await recordFailedAttempt(email, 'sign_in');

      // Log failed sign-in attempt (T033). #241: use 'sign_in_failed' — the
      // event_type the admin failed-attempt stats + burst detector actually
      // read (they never matched the old 'sign_in'+success:false shape).
      await logAuthEvent({
        event_type: 'sign_in_failed',
        event_data: { email, provider: 'email' },
        success: false,
        error_message: signInError.message,
      });

      // Update remaining attempts display
      const newRemaining = rateLimit.remaining - 1;
      setRemainingAttempts(newRemaining);

      let errorMessage = signInError.message;
      if (newRemaining > 0 && newRemaining <= 3) {
        errorMessage += ` (${newRemaining} attempts remaining)`;
      }

      setError(errorMessage);
    } else {
      // Log successful sign-in (T033). The `user` from useAuth() is still
      // null at this point — Supabase's onAuthStateChange hasn't propagated
      // to AuthContext yet — so read user_id directly from getUser() to
      // avoid silently dropping the audit log entry on success.
      const { supabase: supabaseClient } = await import(
        '@/lib/supabase/client'
      );
      const {
        data: { user: freshUser },
      } = await supabaseClient.auth.getUser();
      if (freshUser) {
        // #241: 'sign_in_success' — what admin_auth_stats.logins_today counts.
        await logAuthEvent({
          user_id: freshUser.id,
          event_type: 'sign_in_success',
          event_data: { email, provider: 'email' },
        });
      }

      // Derive encryption keys from password (Feature 032)
      try {
        const { keyManagementService } = await import(
          '@/services/messaging/key-service'
        );

        // Check if user has existing keys
        // In E2E tests, skip key initialization entirely — auth.setup.ts
        // already created all test user keys with correct salts. Running
        // initializeKeys() here would create duplicate keys with different
        // salts, breaking ECDH across concurrent shards.
        const isE2E =
          typeof localStorage !== 'undefined' &&
          localStorage.getItem('playwright_e2e') === 'true';
        const hasKeys = isE2E || (await keyManagementService.hasKeys());

        if (!hasKeys) {
          // New user: initialize keys with password
          logger.info('New user - initializing encryption keys');
          const keyPair = await keyManagementService.initializeKeys(password);

          // Send welcome message (non-blocking, Feature 003-feature-004-welcome)
          // Pass privateKey for ECDH shared secret derivation with admin's public key
          Promise.all([
            import('@/services/messaging/welcome-service'),
            import('@/lib/supabase/client'),
          ])
            .then(([{ welcomeService }, { supabase: supabaseClient }]) => {
              supabaseClient.auth
                .getUser()
                .then(({ data }: { data: { user: { id: string } | null } }) => {
                  if (
                    data?.user?.id &&
                    keyPair.privateKey &&
                    keyPair.publicKeyJwk
                  ) {
                    welcomeService
                      .sendWelcomeMessage(
                        data.user.id,
                        keyPair.privateKey,
                        keyPair.publicKeyJwk
                      )
                      .catch((err: Error) => {
                        logger.error('Welcome message failed', { error: err });
                      });
                  }
                });
            })
            .catch((err: Error) => {
              logger.error('Failed to load welcome service', { error: err });
            });
        } else {
          // Check if user needs migration (legacy random keys)
          const needsMigration = await keyManagementService.needsMigration();

          let keyPair;
          if (needsMigration) {
            // Legacy user with ONLY NULL-salt keys - auto-initialize new keys (Feature 033)
            logger.info('Legacy user - auto-initializing new encryption keys');
            keyPair = await keyManagementService.initializeKeys(password);
          } else {
            // Existing user: derive keys from password
            logger.info('Existing user - deriving encryption keys');
            keyPair = await keyManagementService.deriveKeys(password);
          }

          // Check if user needs welcome message (Feature 004)
          // This handles cases where keys exist but welcome message wasn't sent
          if (keyPair?.privateKey && keyPair?.publicKeyJwk) {
            Promise.all([
              import('@/services/messaging/welcome-service'),
              import('@/lib/supabase/client'),
            ])
              .then(([{ welcomeService }, { supabase: supabaseClient }]) => {
                supabaseClient.auth
                  .getUser()
                  .then(
                    ({ data }: { data: { user: { id: string } | null } }) => {
                      if (data?.user?.id) {
                        welcomeService
                          .sendWelcomeMessage(
                            data.user.id,
                            keyPair.privateKey,
                            keyPair.publicKeyJwk
                          )
                          .catch((err: Error) => {
                            logger.error('Welcome message failed', {
                              error: err,
                            });
                          });
                      }
                    }
                  );
              })
              .catch((err: Error) => {
                logger.error('Failed to load welcome service', { error: err });
              });
          }
        }
      } catch (keyError) {
        logger.error('Failed to initialize/derive encryption keys', {
          error: keyError,
        });
        // Don't block sign-in flow, but log the error
        // User will be prompted to re-authenticate when accessing messages
      }

      // Successful sign-in
      onSuccess?.();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4${className ? ` ${className}` : ''}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-6">
        <label
          className="label sm:w-36 sm:shrink-0 sm:text-right"
          htmlFor="email"
        >
          <span className="label-text">Email</span>
        </label>
        <div className="min-w-0 flex-1">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`input input-bordered min-h-11 w-full ${
              fieldError?.field === 'email' ? 'input-error' : ''
            }`}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={loading}
            aria-invalid={fieldError?.field === 'email'}
            aria-describedby={
              fieldError?.field === 'email' ? 'email-error' : undefined
            }
          />
          {fieldError?.field === 'email' && (
            <div className="label" id="email-error">
              <span className="text-error" role="alert" aria-live="polite">
                {fieldError.message}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-6">
        <label
          className="label sm:w-36 sm:shrink-0 sm:text-right"
          htmlFor="password"
        >
          <span className="label-text">Password</span>
        </label>
        <div className="min-w-0 flex-1">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input input-bordered min-h-11 w-full"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            disabled={loading}
          />
        </div>
      </div>

      {/* #374. This row was a classless `<div>` sitting 168px LEFT of the
          inputs with a 310x31 empty rectangle beside it, while "Forgot
          password?" was stranded below the submit button over in
          `sign-in/page.tsx`, costing a 46px line of its own.

          The row spans the FULL 448px column rather than being indented to the
          280px input column behind a label-width spacer. That was tried first,
          because the ticket's "also in scope" note asks for a spacer cell — and
          measuring it showed the two controls do not fit: Remember Me (138px)
          + Forgot password (162px) = 300px against 280px, so they wrapped onto
          separate lines and gave back the row this change exists to reclaim.
          Full width fits them with room to spare, and is what the ticket's own
          mock draws.

          `flex-wrap` is still load-bearing at the narrow end: 300px clears the
          448px and 382px columns, but NOT the 288px column below 430px, nor
          the `x-large` accessibility font setting. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <label
          htmlFor="remember-me"
          className="label cursor-pointer justify-start gap-3"
        >
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => {
              setRememberMe(e.target.checked);
              // Written on TOGGLE, not only on submit (#375). OAuthButtons sits
              // directly below this form and passes no storage option of its
              // own, so a GitHub/Google user would otherwise get unconditional
              // persistence with no control at all — which the scope decision
              // on this ticket explicitly rules out. Recording the preference
              // here means whichever entry path they take next honours the box
              // they can see, with no prop plumbing between two sibling
              // components that do not otherwise know about each other.
              setSessionPersistence(e.target.checked);
            }}
            className="checkbox checkbox-primary"
            disabled={loading}
            aria-label="Remember Me"
          />
          <span>Remember Me</span>
        </label>
        {/* Conventionally belongs on this row, not below the submit button.
            `min-h-11` keeps the 44px touch target the mobile gate requires.

            NOT link-primary (#778). Measured against the hero gradient: 6.8:1
            on dark and 6.08:1 on light, both under the 7:1 this text needs.
            text-base-content measures 11.81 / 10.1. `link` stays so the
            UNDERLINE carries the affordance rather than colour alone, which
            WCAG prefers regardless. */}
        <Link
          href="/forgot-password"
          className="link text-base-content min-h-11 content-center text-sm"
        >
          Forgot password?
        </Link>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>{error}</span>
        </div>
      )}

      {/* (#353) Renders nothing when CAPTCHA is unconfigured. */}
      <CaptchaWidget ref={captchaRef} onToken={setCaptchaToken} />

      <button
        type="submit"
        // `secondary`, not `primary` (#384). The 3e mock renders the submit in
        // the warm secondary, and on scripthammer-dark `--color-primary` is a
        // silver/steel (oklch 76% 0.024 258) that reads as a DISABLED control
        // on the primary action of the page. Accessible name is untouched —
        // `performSignIn` matches `getByRole('button', { name: 'Sign In' })`.
        className="btn btn-secondary min-h-11 w-full"
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-md"></span>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
}
