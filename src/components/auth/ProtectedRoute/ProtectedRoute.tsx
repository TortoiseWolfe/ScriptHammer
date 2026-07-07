'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export interface ProtectedRouteProps {
  /** Children to render if authenticated */
  children: React.ReactNode;
  /** Redirect path if not authenticated */
  redirectTo?: string;
}

// Supabase's auth events can briefly flip isAuthenticated to false during
// token refresh and initial-session hydration. Without a debounce, the
// redirect useEffect fires mid-interaction and navigates the user away
// from the page they're actively using — observed as provider-tab click
// failures on Firefox CI shards of /payment-demo, where the tab node
// detaches and Playwright's click retries until timeout.
//
// Real sign-outs go through window.location.href='/' in AuthContext.signOut(),
// which unmounts the component and clears the debounce timer before it ever
// fires router.push, so they still work.
const AUTH_FLIP_DEBOUNCE_MS = 500;

/**
 * ProtectedRoute component
 * Wraps children and redirects to sign-in if not authenticated
 *
 * @category molecular
 */
export default function ProtectedRoute({
  children,
  redirectTo = '/sign-in',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (isAuthenticated) wasAuthenticated.current = true;
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) return;
    // If this mount was ever authenticated, don't fire router.push. The
    // auth provider will re-settle (transient refresh flip) or the real
    // sign-out flow (window.location.href='/') will unmount us. Issuing
    // router.push while window.location.href is in flight causes Firefox
    // to abort the pending navigation with NS_BINDING_ABORTED.
    if (wasAuthenticated.current) return;

    const returnUrl = encodeURIComponent(pathname);
    const timer = setTimeout(() => {
      router.push(`${redirectTo}?returnUrl=${returnUrl}`);
    }, AUTH_FLIP_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, router, redirectTo, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Keep children mounted during the debounce window if we've ever been
  // authenticated on this mount. A transient refresh flip shouldn't
  // unmount the user's active work into the sign-in card; on a real
  // sign-out the component unmounts via window.location.href anyway.
  if (!isAuthenticated && !wasAuthenticated.current) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card bg-base-100 w-full max-w-md shadow-xl">
          <div className="card-body items-center text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="text-warning mb-4 h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>

            <h2 className="card-title mb-2">Authentication Required</h2>
            <p className="text-base-content/85 mb-6">
              Please sign in to access this page. You&apos;ll be redirected back
              here after signing in.
            </p>

            <div className="card-actions flex w-full flex-col gap-3 sm:flex-row">
              <Link
                href={`${redirectTo}?returnUrl=${encodeURIComponent(pathname)}`}
                className="btn btn-primary min-h-11 flex-1"
              >
                Sign In
              </Link>
              <Link
                href={`/sign-up?returnUrl=${encodeURIComponent(pathname)}`}
                className="btn btn-neutral btn-outline min-h-11 flex-1"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
