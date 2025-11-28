'use client';

import React, { useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isOAuthUser } from '@/lib/auth/oauth-utils';

export interface MessagingGateProps {
  /** Child content to render when email is verified */
  children: ReactNode;
}

/**
 * MessagingGate component
 * Blocks access to messaging features for users with unverified email.
 * OAuth users bypass this gate (provider-verified).
 *
 * @category auth
 */
export default function MessagingGate({ children }: MessagingGateProps) {
  const { user, isLoading } = useAuth();
  const supabase = createClient();
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span
          className="loading loading-spinner loading-lg"
          role="status"
          aria-label="Loading"
        ></span>
      </div>
    );
  }

  // Not logged in - should be handled by auth middleware, but safety check
  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">Sign in required</h2>
          <p className="text-base-content/70">
            Please sign in to access messaging.
          </p>
        </div>
      </div>
    );
  }

  // Check if email is verified
  const isEmailVerified = user.email_confirmed_at != null;
  const isOAuth = isOAuthUser(user);

  // Allow access if verified OR OAuth user (provider-verified)
  if (isEmailVerified || isOAuth) {
    return <>{children}</>;
  }

  // Handle resend verification email
  const handleResend = async () => {
    if (!user.email) return;

    setResending(true);
    setResendError(null);
    setResendSuccess(false);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    });

    setResending(false);

    if (error) {
      setResendError(error.message);
    } else {
      setResendSuccess(true);
    }
  };

  // Blocked state - show verification required UI
  return (
    <div className="bg-base-100 flex h-full items-center justify-center p-4">
      <div className="card bg-base-200 w-full max-w-md shadow-xl">
        <div className="card-body items-center text-center">
          {/* Lock icon */}
          <div className="text-warning mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-16 w-16"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>

          <h2 className="card-title text-2xl">Email Verification Required</h2>

          <p className="text-base-content/70 mt-2">
            To protect your privacy and ensure secure messaging, please verify
            your email address first.
          </p>

          <div className="bg-base-300 mt-4 rounded-lg p-3">
            <p className="text-sm">
              <span className="font-medium">Your email:</span> {user.email}
            </p>
          </div>

          {resendSuccess ? (
            <div className="alert alert-success mt-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Verification email sent! Check your inbox.</span>
            </div>
          ) : (
            <div className="card-actions mt-6">
              <button
                onClick={handleResend}
                disabled={resending}
                className="btn btn-primary min-h-11 min-w-11"
              >
                {resending ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Sending...
                  </>
                ) : (
                  'Resend Verification Email'
                )}
              </button>
            </div>
          )}

          {resendError && (
            <div className="alert alert-error mt-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{resendError}</span>
            </div>
          )}

          <p className="text-base-content/50 mt-4 text-xs">
            After verifying, refresh this page to access messaging.
          </p>
        </div>
      </div>
    </div>
  );
}
