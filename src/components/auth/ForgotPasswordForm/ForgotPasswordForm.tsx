'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  checkRateLimit,
  recordFailedAttempt,
  formatLockoutTime,
} from '@/lib/auth/rate-limit-check';
import { validateEmail } from '@/lib/auth/email-validator';
import { logAuthEvent } from '@/lib/auth/audit-logger';

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
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Enhanced email validation (REQ-SEC-004)
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.errors[0] || 'Invalid email address');
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

    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    setLoading(false);

    if (resetError) {
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
      <div className="form-control">
        <label className="label" htmlFor="email">
          <span className="label-text">Email</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input input-bordered min-h-11"
          placeholder="you@example.com"
          required
          disabled={loading}
        />
      </div>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <span>{error}</span>
        </div>
      )}

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
