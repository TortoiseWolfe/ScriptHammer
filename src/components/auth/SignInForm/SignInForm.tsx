'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  checkRateLimit,
  recordFailedAttempt,
  formatLockoutTime,
} from '@/lib/auth/rate-limit-check';
import { validateEmail } from '@/lib/auth/email-validator';
import { logAuthEvent } from '@/lib/auth/audit-logger';

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Enhanced email validation (REQ-SEC-004)
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.errors[0] || 'Invalid email address');
      return;
    }

    // Check server-side rate limit (REQ-SEC-003)
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

    const { error: signInError } = await signIn(email, password);

    setLoading(false);

    if (signInError) {
      // Record failed attempt on server (REQ-SEC-003)
      await recordFailedAttempt(email, 'sign_in');

      // Log failed sign-in attempt (T033)
      await logAuthEvent({
        event_type: 'sign_in',
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
      // Log successful sign-in (T033)
      if (user) {
        await logAuthEvent({
          user_id: user.id,
          event_type: 'sign_in',
          event_data: { email, provider: 'email' },
        });
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
          autoComplete="email"
          required
          disabled={loading}
        />
      </div>

      <div className="form-control">
        <label className="label" htmlFor="password">
          <span className="label-text">Password</span>
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input input-bordered min-h-11"
          placeholder="••••••••"
          autoComplete="current-password"
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
          'Sign In'
        )}
      </button>
    </form>
  );
}
