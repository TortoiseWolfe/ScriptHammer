'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isOAuthUser, getOAuthProvider } from '@/lib/auth/oauth-utils';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('app:messages:setup');

/**
 * Messaging Setup Page
 * Full-page form for creating messaging password (better for password managers)
 *
 * OAuth users are redirected here when they don't have encryption keys set up.
 * Using a full page instead of modal ensures password managers can save credentials.
 */
export default function MessagingSetupPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingKeys, setCheckingKeys] = useState(true);
  const [hasExistingKeys, setHasExistingKeys] = useState(false);

  const oauthUser = isOAuthUser(user);
  const providerName = getOAuthProvider(user);

  // Check if user already has keys - redirect to messages if so
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/sign-in?redirect=/messages');
      return;
    }

    const checkKeys = async () => {
      setCheckingKeys(true);
      try {
        const { keyManagementService } = await import(
          '@/services/messaging/key-service'
        );
        const hasKeys = await keyManagementService.hasKeys();
        setHasExistingKeys(hasKeys);

        if (hasKeys) {
          // User already has keys, send them to messages
          router.push('/messages');
        }
      } catch (err) {
        logger.error('Error checking keys', { error: err });
      } finally {
        setCheckingKeys(false);
      }
    };

    checkKeys();
  }, [user, authLoading, router]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!password.trim()) {
        setError('Please enter a password');
        return;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setLoading(true);

      try {
        const { keyManagementService } = await import(
          '@/services/messaging/key-service'
        );

        logger.info('Initializing encryption keys');
        const keyPair = await keyManagementService.initializeKeys(password);

        // Save credentials to password manager using Credential Management API
        // This is required because React's e.preventDefault() blocks native form submission
        // which is what password managers normally hook into
        if ('credentials' in navigator && 'PasswordCredential' in window) {
          try {
            // @ts-expect-error - PasswordCredential not in all TS libs
            const cred = new PasswordCredential({
              id: user?.email || '',
              password: password,
              name: user?.email || 'Messaging Password',
            });
            await navigator.credentials.store(cred);
            logger.info('Credentials saved to password manager');
          } catch (credErr) {
            // Non-fatal - some browsers may not support this
            logger.warn('Could not save to password manager', {
              error: credErr,
            });
          }
        }

        // Send welcome message
        if (user?.id && keyPair.privateKey && keyPair.publicKeyJwk) {
          import('@/services/messaging/welcome-service')
            .then(({ welcomeService }) => {
              welcomeService
                .sendWelcomeMessage(
                  user.id,
                  keyPair.privateKey,
                  keyPair.publicKeyJwk
                )
                .catch((err: Error) => {
                  logger.error('Welcome message failed', { error: err });
                });
            })
            .catch((err: Error) => {
              logger.error('Failed to load welcome service', { error: err });
            });
        }

        // Success - show toast reminder and redirect to messages
        logger.info('Encryption setup complete, redirecting to messages');

        // Show toast reminder about password (browser native alert as fallback)
        // Using sessionStorage to show a toast on the messages page
        sessionStorage.setItem('messaging_setup_complete', 'true');

        router.push('/messages');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to set up encryption';
        setError(errorMessage);
        logger.error('Setup failed', { error: err });
      } finally {
        setLoading(false);
      }
    },
    [password, confirmPassword, user, router]
  );

  // Loading states
  if (authLoading || checkingKeys) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Redirect if already set up
  if (hasExistingKeys) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
        <span className="ml-2">Redirecting to messages...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card bg-base-100 w-full max-w-md shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-2xl">Set Up Encrypted Messaging</h1>

          <div className="alert alert-info mt-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="h-6 w-6 shrink-0 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div>
              <p className="font-semibold">Save this password!</p>
              <p className="text-sm">
                {oauthUser ? (
                  <>
                    Since you signed in with {providerName || 'OAuth'}, you need
                    a separate password to encrypt your messages. Your password
                    manager should prompt to save it.
                  </>
                ) : (
                  <>
                    This password encrypts your messages. You&apos;ll need it
                    when signing in on new devices.
                  </>
                )}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Hidden username field for password managers */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={user?.email || ''}
              readOnly
              className="hidden"
              aria-hidden="true"
            />

            {/* Visible email field */}
            <div className="form-control">
              <label className="label" htmlFor="setup-email">
                <span className="label-text">Account</span>
              </label>
              <input
                id="setup-email"
                type="email"
                name="email"
                value={user?.email || ''}
                readOnly
                className="input input-bordered bg-base-200 min-h-11 w-full"
                autoComplete="username email"
              />
            </div>

            {/* Password field */}
            <div className="form-control">
              <label className="label" htmlFor="setup-password">
                <span className="label-text">Messaging Password</span>
                <span className="label-text-alt text-warning">Save this!</span>
              </label>
              <div className="relative">
                <input
                  id="setup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input input-bordered min-h-11 w-full pr-12"
                  placeholder="Create a messaging password"
                  autoComplete="new-password"
                  disabled={loading}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="btn btn-ghost btn-sm absolute top-1/2 right-1 -translate-y-1/2"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="form-control">
              <label className="label" htmlFor="setup-confirm">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                id="setup-confirm"
                name="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input input-bordered min-h-11 w-full"
                placeholder="Confirm your password"
                autoComplete="new-password"
                disabled={loading}
                required
              />
              <label className="label">
                <span className="label-text-alt text-warning">
                  Your password manager should prompt to save this password
                </span>
              </label>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <span>{error}</span>
              </div>
            )}

            <div className="card-actions mt-6">
              <button
                type="submit"
                className="btn btn-primary min-h-11 w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Setting up...
                  </>
                ) : (
                  'Set Up Encrypted Messaging'
                )}
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-sm opacity-70">
            Your messages are end-to-end encrypted. Only you and your recipients
            can read them.
          </p>
        </div>
      </div>
    </div>
  );
}
