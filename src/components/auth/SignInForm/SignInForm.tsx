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

    // Check server-side rate limit (REQ-SEC-003). checkRateLimit is
    // fail-CLOSED by design (it returns allowed:false if the rate-limit
    // infrastructure is down, to prevent brute force) — matching SignUpForm
    // and ForgotPasswordForm, which also call it directly. Do NOT wrap it in a
    // fail-open catch: that would silently disable brute-force protection on a
    // backend outage, contradicting the wrapper's documented policy.
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
            className="input input-bordered min-h-11 w-full"
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={loading}
          />
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

      <div>
        <label
          htmlFor="remember-me"
          className="label cursor-pointer justify-start gap-3"
        >
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="checkbox checkbox-primary"
            disabled={loading}
            aria-label="Remember Me"
          />
          <span>Remember Me</span>
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
          'Sign In'
        )}
      </button>
    </form>
  );
}
