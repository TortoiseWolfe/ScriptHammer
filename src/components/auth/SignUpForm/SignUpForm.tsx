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
import PasswordStrengthIndicator from '@/components/atomic/PasswordStrengthIndicator';
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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Enhanced email validation (REQ-SEC-004)
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.errors[0] || 'Invalid email address');
      return;
    }

    // Show warning for disposable emails
    if (emailValidation.warnings.length > 0) {
      logger.warn('Email validation warnings', {
        warnings: emailValidation.warnings,
      });
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Confirm password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
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

    const { error: signUpError } = await signUp(email, password);

    setLoading(false);

    if (signUpError) {
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
      // Log successful sign-up (T034)
      if (user) {
        await logAuthEvent({
          user_id: user.id,
          event_type: 'sign_up',
          event_data: { email, provider: 'email' },
        });
      }

      // Initialize encryption keys and send welcome message (Feature 004)
      try {
        const { keyManagementService } = await import(
          '@/services/messaging/key-service'
        );

        // Initialize keys with password
        logger.info('New user - initializing encryption keys');
        const keyPair = await keyManagementService.initializeKeys(password);

        // Send welcome message (non-blocking)
        import('@/services/messaging/welcome-service')
          .then(({ welcomeService }) => {
            const { createClient } = require('@/lib/supabase/client');
            const supabase = createClient();
            supabase.auth
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
          required
          disabled={loading}
        />
        {/* Password strength indicator (T042) */}
        <div className="mt-2">
          <PasswordStrengthIndicator password={password} />
        </div>
      </div>

      <div className="form-control">
        <label className="label" htmlFor="confirm-password">
          <span className="label-text">Confirm Password</span>
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input input-bordered min-h-11"
          placeholder="••••••••"
          required
          disabled={loading}
        />
      </div>

      <div className="form-control">
        <label className="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="checkbox min-h-11 min-w-11"
            disabled={loading}
          />
          <span className="label-text">Remember me</span>
        </label>
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
          'Sign Up'
        )}
      </button>
    </form>
  );
}
