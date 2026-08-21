'use client';

import React, { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  checkRateLimit,
  recordFailedAttempt,
  formatLockoutTime,
} from '@/lib/auth/rate-limit-check';
import { validateEmail } from '@/lib/auth/email-validator';
import { logAuthEvent } from '@/lib/auth/audit-logger';
import { getRedirectUrl } from '@/config/project.config';
import CaptchaWidget, {
  type CaptchaWidgetHandle,
} from '@/components/auth/CaptchaWidget';
import { captchaConfig } from '@/config/captcha.config';

export interface ForgotPasswordFormProps {
  /** Callback on success */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ForgotPasswordForm component
 * Send password reset email with server-side rate limiting
 *
 * @category molecular
 */
export default function ForgotPasswordForm({
  onSuccess,
  className = '',
}: ForgotPasswordFormProps) {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  /**
   * The error for ONE named field, kept apart from `error` (#867, same shape as #857).
   *
   * `validateEmail` produces a message about the email box specifically, and it used to
   * land in the form-level alert with no `id` while the input carried neither
   * `aria-invalid` nor `aria-describedby` — so a screen reader announced it with nothing
   * tying it to the field.
   *
   * The rate limit, the captcha challenge and the reset failure stay form-level: none is
   * about one field, and the reset response is deliberately generic so it cannot confirm
   * whether an address is registered.
   */
  const [fieldError, setFieldError] = useState<{
    field: 'email';
    message: string;
  } | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  // (#353) SECURITY_CAPTCHA_ENABLED is global to Supabase auth — password
  // recovery is gated the same as sign-in and sign-up.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    setSuccess(false);

    // Enhanced email validation (REQ-SEC-004)
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setFieldError({
        field: 'email',
        message: emailValidation.errors[0] || 'Invalid email address',
      });
      return;
    }

    // Check server-side rate limit for password reset attempts (REQ-SEC-003)
    const rateLimit = await checkRateLimit(email, 'password_reset');

    if (!rateLimit.allowed) {
      const timeUntilReset = rateLimit.locked_until
        ? formatLockoutTime(rateLimit.locked_until)
        : '15 minutes';
      setError(
        `Too many password reset attempts. Please try again in ${timeUntilReset}.`
      );
      return;
    }

    if (captchaConfig.enabled && !captchaToken) {
      setError('Please complete the verification challenge.');
      return;
    }

    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: getRedirectUrl('/reset-password'),
        captchaToken: captchaToken ?? undefined,
      }
    );

    setLoading(false);

    if (resetError) {
      // Single-use token: reset so a retry can get a fresh one.
      captchaRef.current?.reset();

      // Record failed attempt
      await recordFailedAttempt(email, 'password_reset');

      // Log failed password reset attempt (T036)
      await logAuthEvent({
        event_type: 'password_reset_request',
        event_data: { email },
        success: false,
        error_message: resetError.message,
      });

      setError(resetError.message);
    } else {
      // Log successful password reset request (T036)
      await logAuthEvent({
        event_type: 'password_reset_request',
        event_data: { email },
      });

      setSuccess(true);
      onSuccess?.();
    }
  };

  if (success) {
    return (
      <div className="alert alert-success">
        <span>Password reset email sent! Check your inbox.</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4${className ? ` ${className}` : ''}`}
    >
      <div>
        <label className="label" htmlFor="email">
          <span>Email</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`input min-h-11 ${
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

      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>{error}</span>
        </div>
      )}
      {/* (#353) Renders nothing when CAPTCHA is unconfigured. */}
      <CaptchaWidget ref={captchaRef} onToken={setCaptchaToken} />

      <button
        type="submit"
        className="btn btn-primary min-h-11 w-full"
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-md"></span>
        ) : (
          'Send Reset Link'
        )}
      </button>
    </form>
  );
}
