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
    // Fail-open: if rate limit check fails, allow sign-in attempt
    let rateLimit: {
      allowed: boolean;
      remaining: number;
      locked_until?: string | null;
    } = {
      allowed: true,
      remaining: 5,
    };
    try {
      rateLimit = await checkRateLimit(email, 'sign_in');
    } catch (rateLimitError) {
      logger.warn('Rate limit check failed, allowing sign-in attempt', {
        error: rateLimitError,
      });
      // Continue with sign-in (fail-open for UX)
    }

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
      // Check if email needs verification
      if (signInError.message.toLowerCase().includes('email not confirmed')) {
        window.location.href = '/verify-email';
        return;
      }

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

      // Derive encryption keys from password (Feature 032)
      try {
        const { keyManagementService } = await import(
          '@/services/messaging/key-service'
        );

        // Check if user has existing keys
        const hasKeys = await keyManagementService.hasKeys();

        if (!hasKeys) {
          // New user: initialize keys with password
          logger.info('New user - initializing encryption keys');
          const keyPair = await keyManagementService.initializeKeys(password);

          // Send welcome message (non-blocking, Feature 003-feature-004-welcome)
          // Pass privateKey for ECDH shared secret derivation with admin's public key
          import('@/services/messaging/welcome-service')
            .then(({ welcomeService }) => {
              // Get current user ID from auth context or session
              const { createClient } = require('@/lib/supabase/client');
              const supabase = createClient();
              supabase.auth.getUser().then(({ data }: any) => {
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
            import('@/services/messaging/welcome-service')
              .then(({ welcomeService }) => {
                const { createClient } = require('@/lib/supabase/client');
                const supabase = createClient();
                supabase.auth.getUser().then(({ data }: any) => {
                  if (data?.user?.id) {
                    // welcomeService.sendWelcomeMessage checks welcome_message_sent flag
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
