'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isOAuthUser, getOAuthProvider } from '@/lib/auth/oauth-utils';

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

/**
 * ReAuthModal component
 * Prompts user to re-enter password to unlock encryption keys
 * Used when session is restored but keys are not in memory
 *
 * For OAuth users (Google, GitHub): Prompts to set/enter a messaging password
 * For email users: Prompts for their account password
 *
 * Feature: 032-fix-e2e-encryption
 * Task: T017
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
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [checkingKeys, setCheckingKeys] = useState(true);

  const modalRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Check if OAuth user needs to set up messaging password
  const oauthUser = isOAuthUser(user);
  const providerName = getOAuthProvider(user);

  // Check if user needs to set up encryption keys (applies to ALL users, not just OAuth)
  useEffect(() => {
    if (isOpen) {
      const checkKeys = async () => {
        setCheckingKeys(true);
        try {
          const { keyManagementService } = await import(
            '@/services/messaging/key-service'
          );
          const hasKeys = await keyManagementService.hasKeys();
          setIsSetupMode(!hasKeys);
        } catch (err) {
          console.error('[ReAuthModal] Error checking keys:', err);
          setIsSetupMode(true); // Default to setup mode on error
        } finally {
          setCheckingKeys(false);
        }
      };
      checkKeys();
    }
  }, [isOpen]);

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

      // Validate password confirmation for OAuth users creating new messaging password
      if (isSetupMode && oauthUser) {
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

        if (isSetupMode) {
          // User setting up encryption keys for first time
          console.log(
            '[ReAuthModal] Initializing encryption keys for new user'
          );
          await keyManagementService.initializeKeys(password);
        } else {
          // Check if user needs migration first
          const needsMigration = await keyManagementService.needsMigration();

          if (needsMigration) {
            // Legacy user - can't derive keys without migration
            setError(
              'Your account needs to be updated. Please sign out and sign back in.'
            );
            setLoading(false);
            return;
          }

          // Derive keys from password
          await keyManagementService.deriveKeys(password);
        }

        // Success - clear form and notify parent
        setPassword('');
        setConfirmPassword('');
        setError(null);
        onSuccess();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to unlock encryption';

        // Check for key mismatch (wrong password)
        if (
          errorMessage.includes('mismatch') ||
          errorMessage.includes('Incorrect')
        ) {
          setError('Incorrect password. Please try again.');
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    },
    [password, confirmPassword, isSetupMode, onSuccess]
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
            {isSetupMode ? 'Set Up Encrypted Messaging' : 'Unlock Messaging'}
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
            <p id="reauth-description" className="text-base-content/80 mb-4">
              {isSetupMode ? (
                oauthUser ? (
                  <>
                    Your messages are end-to-end encrypted. Since you signed in
                    with {providerName || 'OAuth'}, we need a separate password
                    to protect your encryption keys.
                    <strong className="mt-2 block">
                      Save this password in your password manager
                    </strong>{' '}
                    &ndash; you&apos;ll need it when signing in on new devices.
                  </>
                ) : (
                  <>
                    Welcome! To enable encrypted messaging, please enter your
                    account password to set up your encryption keys.
                  </>
                )
              ) : oauthUser ? (
                <>
                  Please enter your messaging password to access your encrypted
                  messages.
                </>
              ) : (
                <>
                  Your session has been restored, but your encryption keys need
                  to be unlocked. Please enter your password to access your
                  messages.
                </>
              )}
            </p>

            {/* Email field for password manager compatibility */}
            {oauthUser && (
              <div className="form-control mb-4">
                <label className="label" htmlFor="reauth-email">
                  <span className="label-text">Account</span>
                </label>
                <input
                  id="reauth-email"
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  className="input input-bordered bg-base-200 min-h-11 w-full"
                  autoComplete="username"
                />
              </div>
            )}

            <div className="form-control">
              <label className="label" htmlFor="reauth-password">
                <span className="label-text">
                  {isSetupMode ? 'Messaging Password' : 'Password'}
                </span>
              </label>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  id="reauth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input input-bordered min-h-11 w-full pr-12"
                  placeholder={
                    isSetupMode
                      ? 'Create a messaging password'
                      : 'Enter your password'
                  }
                  autoComplete={
                    isSetupMode ? 'new-password' : 'current-password'
                  }
                  disabled={loading}
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

            {/* Confirm password field for OAuth users only (they're creating a new password) */}
            {isSetupMode && oauthUser && (
              <div className="form-control mt-4">
                <label className="label" htmlFor="confirm-password">
                  <span className="label-text">Confirm Password</span>
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input input-bordered min-h-11 w-full"
                  placeholder="Confirm your messaging password"
                  autoComplete="new-password"
                  disabled={loading}
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
                ) : isSetupMode ? (
                  'Set Up Messaging'
                ) : (
                  'Unlock'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
