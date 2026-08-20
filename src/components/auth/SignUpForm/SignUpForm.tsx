'use client';

import React, { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { setSessionPersistence } from '@/lib/supabase/client';
import {
  checkRateLimit,
  recordFailedAttempt,
  formatLockoutTime,
} from '@/lib/auth/rate-limit-check';
import { validateEmail } from '@/lib/auth/email-validator';
import { logAuthEvent } from '@/lib/auth/audit-logger';
import PasswordStrengthIndicator from '@/components/atomic/PasswordStrengthIndicator';
import CaptchaWidget, {
  type CaptchaWidgetHandle,
} from '@/components/auth/CaptchaWidget';
import { captchaConfig } from '@/config/captcha.config';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:auth:SignUpForm');

export interface SignUpFormProps {
  /** Callback on successful sign up */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SignUpForm component
 * Email/password sign-up with server-side rate limiting
 *
 * @category molecular
 */
export default function SignUpForm({
  onSuccess,
  className = '',
}: SignUpFormProps) {
  const { signUp, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * The error for ONE named field, kept apart from `error` (#857).
   *
   * THREE distinct field conditions used to funnel into `error` and render in a
   * single form-level alert with no `id`: an invalid email, a short password,
   * and a mismatched confirmation. No input carried `aria-invalid` or
   * `aria-describedby`, so a screen-reader user heard "Passwords do not match"
   * with nothing tying it to the field that was wrong.
   *
   * Only client-side validation is field-scoped. The captcha challenge, the rate
   * limit and the sign-up failure from Supabase stay form-level — none is about
   * one field.
   */
  const [fieldError, setFieldError] = useState<{
    field: 'email' | 'password' | 'confirmPassword';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  // (#353) Null until Turnstile solves; cleared on expiry/error so a stale
  // single-use token is never submitted. Always null when CAPTCHA is
  // unconfigured, which is why the submit guard checks `captchaConfig.enabled`.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    // Enhanced email validation (REQ-SEC-004). Field-scoped (#857).
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setFieldError({
        field: 'email',
        message: emailValidation.errors[0] || 'Invalid email address',
      });
      return;
    }

    // Show warning for disposable emails
    if (emailValidation.warnings.length > 0) {
      logger.warn('Email validation warnings', {
        warnings: emailValidation.warnings,
      });
    }

    if (password.length < 8) {
      setFieldError({
        field: 'password',
        message: 'Password must be at least 8 characters',
      });
      return;
    }

    // Confirm password match
    if (password !== confirmPassword) {
      // Announced against the CONFIRMATION field, not the password: that is the
      // one the user is being asked to change.
      setFieldError({
        field: 'confirmPassword',
        message: 'Passwords do not match',
      });
      return;
    }

    // (#353) Require a solved CAPTCHA when one is configured. Note the rate
    // limit below is keyed on the EMAIL ADDRESS, so a bot rotating addresses
    // never trips it — this check is what actually costs an attacker something.
    if (captchaConfig.enabled && !captchaToken) {
      setError('Please complete the verification challenge.');
      return;
    }

    // Check server-side rate limit for sign-up attempts (REQ-SEC-003)
    const rateLimit = await checkRateLimit(email, 'sign_up');

    if (!rateLimit.allowed) {
      const timeUntilReset = rateLimit.locked_until
        ? formatLockoutTime(rateLimit.locked_until)
        : '15 minutes';
      setError(
        `Too many sign-up attempts. Please try again in ${timeUntilReset}.`
      );
      return;
    }

    setLoading(true);

    // Recorded before the auth call (#375). Sign-up matters as much as sign-in
    // here: the preference has to survive the email-verification round trip, so
    // that when the user returns via the confirmation link and a session is
    // finally established, it lands in the store they actually chose.
    setSessionPersistence(rememberMe);

    const { error: signUpError } = await signUp(
      email,
      password,
      captchaToken ?? undefined
    );

    setLoading(false);

    if (signUpError) {
      // Turnstile tokens are single-use: whatever the failure was, the old
      // token is spent. Reset the widget (which also clears our state) so the
      // user can actually retry — clearing state alone would leave the solved
      // widget sitting there, never firing onSuccess again.
      captchaRef.current?.reset();

      // Record failed attempt on server
      await recordFailedAttempt(email, 'sign_up');

      // Log failed sign-up attempt (T034)
      await logAuthEvent({
        event_type: 'sign_up',
        event_data: { email, provider: 'email' },
        success: false,
        error_message: signUpError.message,
      });

      setError(signUpError.message);
    } else {
      // #49: the successful 'sign_up' audit event is now written by the
      // create_user_profile() trigger (AFTER INSERT ON auth.users), which fires
      // for EVERY signup path (form, OAuth, admin API) — so the previous
      // form-only logAuthEvent() call here was both incomplete (missed OAuth/
      // admin) and, after the trigger, a double-write. Removed; the trigger is
      // the single source of truth for successful signups. The failed-attempt
      // logAuthEvent() above stays (no auth.users INSERT happens on failure).

      // Initialize encryption keys and send welcome message (Feature 004)
      try {
        const { keyManagementService } = await import(
          '@/services/messaging/key-service'
        );

        // Initialize keys with password
        logger.info('New user - initializing encryption keys');
        const keyPair = await keyManagementService.initializeKeys(password);

        // Send welcome message (non-blocking)
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
      } catch (keyError) {
        logger.error('Failed to initialize encryption keys', {
          error: keyError,
        });
        // Don't block signup flow
      }

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
            className={`input input-bordered min-h-11 w-full ${
              fieldError?.field === 'password' ? 'input-error' : ''
            }`}
            placeholder="••••••••"
            required
            disabled={loading}
            aria-invalid={fieldError?.field === 'password'}
            aria-describedby={
              fieldError?.field === 'password' ? 'password-error' : undefined
            }
          />
          {fieldError?.field === 'password' && (
            <div className="label" id="password-error">
              <span className="text-error" role="alert" aria-live="polite">
                {fieldError.message}
              </span>
            </div>
          )}
          {/* Password strength indicator (T042) */}
          <div className="mt-2">
            <PasswordStrengthIndicator password={password} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-6">
        <label
          className="label sm:w-36 sm:shrink-0 sm:text-right"
          htmlFor="confirm-password"
        >
          <span className="label-text">Confirm Password</span>
        </label>
        <div className="min-w-0 flex-1">
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`input input-bordered min-h-11 w-full ${
              fieldError?.field === 'confirmPassword' ? 'input-error' : ''
            }`}
            placeholder="••••••••"
            required
            disabled={loading}
            aria-invalid={fieldError?.field === 'confirmPassword'}
            aria-describedby={
              fieldError?.field === 'confirmPassword'
                ? 'confirm-password-error'
                : undefined
            }
          />
          {fieldError?.field === 'confirmPassword' && (
            <div className="label" id="confirm-password-error">
              <span className="text-error" role="alert" aria-live="polite">
                {fieldError.message}
              </span>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => {
              setRememberMe(e.target.checked);
              // On toggle, so the OAuth buttons below this form inherit the
              // choice (#375). Same reasoning as SignInForm.
              setSessionPersistence(e.target.checked);
            }}
            className="checkbox min-h-11 min-w-11"
            disabled={loading}
          />
          <span>Remember me</span>
        </label>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>{error}</span>
        </div>
      )}

      {/* (#353) Bot protection. Renders nothing when CAPTCHA is unconfigured. */}
      <CaptchaWidget ref={captchaRef} onToken={setCaptchaToken} />

      {/*
        The CAPTCHA gate lives in handleSubmit, NOT in `disabled`, on purpose:
        a disabled button is a dead end if Turnstile fails to load (blocked
        script, CSP regression, offline) — the user gets no explanation and no
        way forward. Guarding in the handler surfaces an actionable message
        instead, and keeps the client-side validation errors above it reachable.
      */}
      <button
        type="submit"
        className="btn btn-primary min-h-11 w-full"
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-md"></span>
        ) : (
          'Sign Up'
        )}
      </button>
    </form>
  );
}
