'use client';

/**
 * OAuth Error Boundary
 * Catches and displays user-friendly errors during OAuth callback processing
 * REQ-SEC-003: OAuth error handling
 */

import React, { Component, ReactNode } from 'react';
import Link from 'next/link';
import { createLogger } from '@/lib/logger';

const logger = createLogger('app:auth:callback:error-boundary');

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class OAuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('OAuth callback error', { error, errorInfo });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto px-4 py-12">
          <div className="card bg-base-100 mx-auto max-w-md shadow-xl">
            <div className="card-body">
              <div className="flex items-center gap-4">
                <div className="text-error">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="card-title text-error">Sign-In Failed</h2>
                  <p className="text-base-content/70">
                    We couldn&apos;t complete your sign-in request.
                  </p>
                </div>
              </div>

              {this.state.error && (
                <div
                  className="alert alert-error mt-4"
                  role="alert"
                  aria-live="assertive"
                >
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
                  <span className="text-sm">{this.state.error.message}</span>
                </div>
              )}

              <div className="mt-6">
                <h3 className="mb-2 font-semibold">What you can do:</h3>
                <ul className="text-base-content/70 list-inside list-disc space-y-1 text-sm">
                  <li>Try signing in again using the button below</li>
                  <li>Sign in with email and password instead</li>
                  <li>Check your browser settings allow pop-ups</li>
                  <li>Contact support if the problem persists</li>
                </ul>
              </div>

              <div className="card-actions mt-6 flex-col gap-2 sm:flex-row">
                <Link
                  href="/sign-in"
                  className="btn btn-primary min-h-11 flex-1"
                >
                  Try Again
                </Link>
                <Link
                  href="/sign-in?method=email"
                  className="btn btn-ghost min-h-11 flex-1"
                >
                  Use Email/Password
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
