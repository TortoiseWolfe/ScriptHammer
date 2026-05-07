'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isOAuthUser, getOAuthProvider } from '@/lib/auth/oauth-utils';
import { sendWelcomeMessageOnSetup } from '@/lib/messaging/welcome/send-welcome-message';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:auth:ReAuthModal');

export interface ReAuthModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when re-authentication succeeds */
  onSuccess: () => void;
  /** Optional callback when modal is closed without success */
  onClose?: () => void;
  /** Additional CSS classes */
  className?: string;
}

type ReAuthMode = 'unlock' | 'setup';

/**
 * ReAuthModal — re-enter / create the messaging password.
 *
 * Two modes, decided at open time by inspecting `hasKeysForUser(user.id)`:
 *   - unlock: existing keys in DB but not in IndexedDB → derive from password
 *     (fires `keyManagementService.deriveKeys`)
 *   - setup:  OAuth user with no keys yet → create a messaging password
 *     (fires `keyManagementService.initializeKeys` + welcome-message dispatch)
 *
 * Setup mode is reachable only when EncryptionKeyGate flags an OAuth user
 * with no keys (Feature 013). Email users with no keys still get the
 * full-page redirect to /messages/setup, which itself remains as a deep-
 * link fallback (FR-022).
 *
 * @category molecular
 */
export function ReAuthModal({
  isOpen,
  onSuccess,
  onClose,
  className = '',
}: ReAuthModalProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingKeys, setCheckingKeys] = useState(true);
  const [mode, setMode] = useState<ReAuthMode>('unlock');

  const modalRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Check if OAuth user needs to set up messaging password
  const oauthUser = isOAuthUser(user);
  const providerName = getOAuthProvider(user);

  // Resolve mode when the modal opens. EncryptionKeyGate already verified
  // *something* about keys before mounting us; we re-check here so the
  // modal owns its own mode decision (testable in isolation, no implicit
  // contract with the caller).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const resolveMode = async () => {
      setCheckingKeys(true);
      try {
        if (!user?.id || !oauthUser) {
          // Email user OR no user yet — keep default unlock mode.
          if (!cancelled) setMode('unlock');
          return;
        }
        const { keyManagementService } = await import(
          '@/services/messaging/key-service'
        );
        const hasKeys = await keyManagementService.hasKeys();
        if (!cancelled) setMode(hasKeys ? 'unlock' : 'setup');
      } catch (err) {
        logger.error('Error resolving ReAuthModal mode', { error: err });
        if (!cancelled) setMode('unlock');
      } finally {
        if (!cancelled) setCheckingKeys(false);
      }
    };
    resolveMode();
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id, oauthUser]);

  // Try to auto-fill from password manager using Credential Management API
  useEffect(() => {
    if (isOpen && !checkingKeys && user?.email) {
      const tryAutoFill = async () => {
        if ('credentials' in navigator && 'PasswordCredential' in window) {
          try {
            const cred = await navigator.credentials.get({
              password: true,
              mediation: 'optional',
            } as CredentialRequestOptions);
            if (cred && 'password' in cred && cred.password) {
              setPassword(cred.password as string);
              logger.info('Auto-filled password from credential manager');
            }
          } catch (err) {
            // Non-fatal - user can still type manually
            logger.debug('Credential auto-fill not available', { error: err });
          }
        }
      };
      tryAutoFill();
    }
  }, [isOpen, checkingKeys, user?.email]);

  // Focus password input when modal opens
  useEffect(() => {
    if (isOpen && passwordInputRef.current) {
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!password.trim()) {
        setError('Please enter your password');
        return;
      }

      // Setup mode: enforce password-confirm match (FR-006) before any
      // key-service call. We do this client-side because the password is
      // never persisted (FR-018) — the server has nothing to compare against.
      if (mode === 'setup') {
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
      }

      setLoading(true);

      try {
        const { keyManagementService } = await import(
          '@/services/messaging/key-service'
        );

        if (mode === 'setup') {
          // OAuth user creating a messaging password for the first time.
          // initializeKeys generates a fresh salt, derives the keypair,
          // uploads salt + public key to Supabase, stores the
          // non-extractable private key in IndexedDB.
          const keyPair = await keyManagementService.initializeKeys(password);
          // Mark the toast reminder for /messages to pick up (parity with
          // the full-page setup flow).
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('messaging_setup_complete', 'true');
          }
          // Fire-and-forget greeting message dispatch.
          sendWelcomeMessageOnSetup(user, keyPair, logger);
        } else {
          // Unlock mode: derive keys from password. Check migration first
          // (legacy random-key users can't derive without a fresh login).
          const needsMigration = await keyManagementService.needsMigration();
          if (needsMigration) {
            setError(
              'Your account needs to be updated. Please sign out and sign back in.'
            );
            setLoading(false);
            return;
          }
          await keyManagementService.deriveKeys(password);
        }

        // Success - clear form and notify parent
        setPassword('');
        setConfirmPassword('');
        setError(null);
        onSuccess();
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : mode === 'setup'
              ? 'Failed to create messaging password'
              : 'Failed to unlock encryption';

        // Check for key mismatch (wrong password) — only meaningful in unlock mode
        if (
          mode === 'unlock' &&
          (errorMessage.includes('mismatch') ||
            errorMessage.includes('Incorrect'))
        ) {
          setError('Incorrect password. Please try again.');
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    },
    [password, confirmPassword, mode, user, onSuccess]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-label="Re-authentication required"
        aria-modal="true"
        aria-describedby="reauth-description"
        className={`bg-base-100 mx-4 flex w-full max-w-md flex-col overflow-hidden rounded-lg shadow-xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-base-300 flex items-center justify-between border-b p-6">
          <h2 className="text-xl font-bold">
            {mode === 'setup'
              ? 'Create a Messaging Password'
              : 'Enter Your Messaging Password'}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost"
              aria-label="Close modal"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        {checkingKeys ? (
          <div className="flex items-center justify-center p-6">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            {/* Provider badge — surfaces the OAuth provider so users
                immediately understand "this is the messaging password,
                not the Google/GitHub login". Wireframes 01 + 02 (Feature 013). */}
            {oauthUser && providerName && (
              <p
                className="text-base-content/85 mb-2 text-sm"
                data-testid="oauth-provider-badge"
              >
                Signed in via {providerName}
              </p>
            )}

            <p id="reauth-description" className="text-base-content/80 mb-4">
              {mode === 'setup' ? (
                <>
                  Since you signed in with {providerName || 'OAuth'}, you need a
                  separate messaging password to encrypt your messages. Save it
                  — losing it means losing access to old encrypted messages.
                </>
              ) : oauthUser ? (
                <>
                  Enter your messaging password to unlock your encrypted
                  messages. This is separate from your {providerName || 'OAuth'}{' '}
                  login.
                </>
              ) : (
                <>
                  Your session has been restored, but your encryption keys need
                  to be unlocked. Please enter your password to access your
                  messages.
                </>
              )}
            </p>

            {/* Hidden username field for password manager matching */}
            <input
              type="hidden"
              name="username"
              autoComplete="username"
              value={user?.email || ''}
            />

            {/* Email field for password manager compatibility - shown for all users */}
            <div className="form-control mb-4">
              <label className="label" htmlFor="reauth-email">
                <span className="label-text">Account</span>
              </label>
              <input
                id="reauth-email"
                type="email"
                name="email"
                value={user?.email || ''}
                readOnly
                className="input input-bordered bg-base-200 min-h-11 w-full"
                autoComplete="username"
              />
            </div>

            <div className="form-control">
              <label className="label" htmlFor="reauth-password">
                <span className="label-text">
                  {mode === 'setup' || oauthUser
                    ? 'Messaging Password'
                    : 'Password'}
                </span>
              </label>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  id="reauth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input input-bordered min-h-11 w-full pr-12"
                  placeholder={
                    mode === 'setup'
                      ? 'Create a messaging password'
                      : 'Enter your password'
                  }
                  autoComplete={
                    mode === 'setup' ? 'new-password' : 'current-password'
                  }
                  disabled={loading}
                  minLength={mode === 'setup' ? 8 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="btn btn-ghost btn-sm absolute top-1/2 right-1 -translate-y-1/2"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Setup mode: confirm-password field. The page at /messages/setup
                is preserved as a deep-link fallback (FR-022); this in-modal
                setup is the primary path for OAuth users from /messages
                (FR-021, Feature 013). */}
            {mode === 'setup' && (
              <div className="form-control mt-4">
                <label className="label" htmlFor="reauth-confirm-password">
                  <span className="label-text">Confirm Password</span>
                </label>
                <input
                  id="reauth-confirm-password"
                  name="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input input-bordered min-h-11 w-full"
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={8}
                />
              </div>
            )}

            {error && (
              <div
                className="alert alert-error mt-4"
                role="alert"
                aria-live="assertive"
              >
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-ghost min-h-11"
                  disabled={loading}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary min-h-11"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner loading-md"></span>
                ) : mode === 'setup' ? (
                  'Create Messaging Password'
                ) : (
                  'Unlock Messages'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
