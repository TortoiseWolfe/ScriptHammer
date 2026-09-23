'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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

  /**
   * The same return URL the redirect uses, made available to RENDER (#1155).
   *
   * #1126 added the query string to the redirect below and left the two card links on
   * `pathname` alone. The only assertions were `stringContaining('/sign-in?returnUrl=')`,
   * which passes with an empty value — so the divergence was invisible. `/payment-result`
   * and `/checkout` are both behind this component and both carry `session_id`, so a
   * visitor who clicked "Sign In" on the card during the 500 ms debounce, instead of
   * waiting for the automatic redirect, lost exactly the id their receipt needs.
   *
   * The query string is part of where the user was (#1126): a buyer bounced to sign-in
   * from `/payment-result?session_id=cs_…` and returned to a bare `/payment-result`
   * classifies as `missing-id`, so their receipt and booking link become unreachable with
   * nothing on screen explaining why — reachable whenever a session lapses while they are
   * on Stripe's hosted page, the moment they are least able to guess what went wrong.
   *
   * Populated from an effect rather than read during render: `window` does not exist when
   * the static export prerenders this, and `useSearchParams()` is ruled out below.
   */
  const [search, setSearch] = useState('');
  useEffect(() => {
    setSearch(window.location.search);
  }, []);
  const returnUrl = encodeURIComponent(`${pathname}${search}`);

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

    // READ window.location, NOT useSearchParams(). This component wraps whole pages from
    // OUTSIDE their own Suspense boundary, and `useSearchParams()` forces one — it fails the
    // static export with "should be wrapped in a suspense boundary" on every protected route.
    // This runs inside an effect, so `window` is always defined and no boundary is needed.
    // READ WINDOW DIRECTLY HERE, not the `returnUrl` computed above from state. They
    // agree in practice, but state is populated by a mount effect while this timer is
    // already counting down — unifying them would mean a redirect that fires before the
    // state lands navigates to a bare pathname, silently reintroducing #1126. The render
    // path cannot read window and the redirect path cannot wait for state, so each reads
    // what is correct for it, and the test asserts BOTH exits carry the query string.
    const search = typeof window === 'undefined' ? '' : window.location.search;
    const redirectUrl = encodeURIComponent(`${pathname}${search}`);
    const timer = setTimeout(() => {
      router.push(`${redirectTo}?returnUrl=${redirectUrl}`);
    }, AUTH_FLIP_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, router, redirectTo, pathname]);

  if (isLoading) {
    // <main>, not <div> (#475). These two branches render INSTEAD of the page,
    // so on every gated route the page's own <main> is never reached and the
    // document has no main landmark at all. That is most of the routes the
    // ticket counted. Safe to make a landmark: it is an alternative branch —
    // when children render, this does not.
    return (
      <main className="flex min-h-full items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </main>
    );
  }

  // Keep children mounted during the debounce window if we've ever been
  // authenticated on this mount. A transient refresh flip shouldn't
  // unmount the user's active work into the sign-in card; on a real
  // sign-out the component unmounts via window.location.href anyway.
  if (!isAuthenticated && !wasAuthenticated.current) {
    return (
      <main className="flex min-h-full items-center justify-center px-4">
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
            <p className="text-base-content mb-6">
              Please sign in to access this page. You&apos;ll be redirected back
              here after signing in.
            </p>

            <div className="card-actions flex w-full flex-col gap-3 sm:flex-row">
              <Link
                href={`${redirectTo}?returnUrl=${returnUrl}`}
                className="btn btn-primary min-h-11 flex-1"
              >
                Sign In
              </Link>
              <Link
                href={`/sign-up?returnUrl=${returnUrl}`}
                className="btn btn-outline min-h-11 flex-1"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
