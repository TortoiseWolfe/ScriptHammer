/**
 * Payment Result Page
 * Post-checkout landing page — users arrive here after a provider redirect.
 * Reads the payment intent ID from the query string, verifies the outcome,
 * and renders the appropriate status via PaymentStatusDisplay.
 */

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { PaymentStatusDisplay } from '@/components/payment/PaymentStatusDisplay/PaymentStatusDisplay';
import { OfflineRetryBanner } from '@/components/payment/OfflineRetryBanner';
import { featureFlags } from '@/config/payment';
import { getInternalUrl } from '@/config/project.config';
import { getPaymentStatus } from '@/lib/payments/payment-service';
import { handleStripeRedirect } from '@/lib/payments/stripe';
import { classifyReturn, UUID_RE } from '@/lib/payments/payment-return';

type ResultState =
  | { kind: 'loading' }
  | { kind: 'missing-id' }
  | { kind: 'checkout-cancelled' }
  | { kind: 'not-configured' }
  | { kind: 'loaded'; resultId: string }
  | { kind: 'not-found'; intentId: string }
  | { kind: 'error'; message: string };

function PaymentResultContent() {
  const searchParams = useSearchParams();
  // THREE ways a buyer arrives here, and until now only the first was handled:
  //
  //   ?id=<uuid>                      our own links (PaymentButton, history)
  //   ?session_id=cs_…&status=…       Stripe's success_url — the REAL purchase
  //                                   path (create-stripe-checkout/index.ts:145,
  //                                   create-stripe-subscription/index.ts:116)
  //   ?status=cancelled               Stripe's cancel_url, carrying NO id at all
  //
  // Reading only `id` meant every completed Stripe payment landed on the
  // "no payment ID" screen, and a buyer who backed out saw the same thing as a
  // broken link. handleStripeRedirect() — the function that bridges session_id to
  // an intent id — had zero callers anywhere in the repo.
  const intentId = searchParams?.get('id') ?? null;
  const sessionId = searchParams?.get('session_id') ?? null;
  const status = searchParams?.get('status') ?? null;

  const [state, setState] = useState<ResultState>({ kind: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  // Resolved from session_id when Stripe sent us here; otherwise the ?id= value.
  const [resolvedIntentId, setResolvedIntentId] = useState<string | null>(null);

  const noProvidersConfigured =
    !featureFlags.stripeEnabled && !featureFlags.paypalEnabled;

  // Step 1 — turn whatever the URL carries into an intent id.
  useEffect(() => {
    // Single `cancelled` flag and a single return, so every branch gets the same
    // cleanup — an effect that returns a teardown on some paths and undefined on
    // others is TS7030, and worse, easy to get subtly wrong on unmount.
    let cancelled = false;

    // The decision itself lives in classifyReturn() so it can be tested without
    // React or auth — see src/lib/payments/__tests__/payment-return.test.ts.
    const route = classifyReturn({
      id: intentId,
      sessionId,
      status,
      providersConfigured: !noProvidersConfigured,
    });

    if (route.kind === 'not-configured') {
      setState({ kind: 'not-configured' });
    } else if (route.kind === 'intent') {
      setState({ kind: 'loading' });
      setResolvedIntentId(route.intentId);
    } else if (route.kind === 'session') {
      setState({ kind: 'loading' });
      handleStripeRedirect(route.sessionId)
        .then(({ intentId: resolved, error }) => {
          if (cancelled) return;
          if (resolved && UUID_RE.test(resolved)) {
            // Resolve the real state from our own records either way. `success`
            // is deliberately ignored here: a redirect is not proof of payment —
            // the webhook is — so we show whatever payment_results actually says.
            setResolvedIntentId(resolved);
            return;
          }
          setState({
            kind: 'error',
            message: error ?? 'Could not verify the Stripe session',
          });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setState({
            kind: 'error',
            message:
              err instanceof Error ? err.message : 'Failed to verify session',
          });
        });
    } else if (route.kind === 'cancelled') {
      setState({ kind: 'checkout-cancelled' });
    } else {
      setState({ kind: 'missing-id' });
    }

    return () => {
      cancelled = true;
    };
  }, [intentId, sessionId, status, noProvidersConfigured]);

  // Step 2 — resolve the payment status once an intent id is known.
  useEffect(() => {
    if (!resolvedIntentId || noProvidersConfigured) return;

    let cancelled = false;

    async function verify() {
      try {
        const result = await getPaymentStatus(resolvedIntentId!);
        if (cancelled) return;

        if (result) {
          setState({ kind: 'loaded', resultId: result.id });
        } else {
          setState({ kind: 'not-found', intentId: resolvedIntentId! });
        }
      } catch (err) {
        if (cancelled) return;

        // Auto-retry once on network error
        if (retryCount < 1) {
          setRetryCount((c) => c + 1);
          return;
        }

        setState({
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'Failed to verify payment',
        });
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [resolvedIntentId, noProvidersConfigured, retryCount]);

  // Feature flag gate
  if (state.kind === 'not-configured') {
    return (
      <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
        <div role="alert" className="alert alert-warning">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="font-semibold">Payment providers not configured</p>
            <p className="text-sm">
              Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and/or{' '}
              <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> in <code>.env</code>.
              See <code>docs/PAYMENT-DEPLOYMENT.md</code> for the full setup
              walkthrough.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Stripe's cancel_url lands here with `?status=cancelled` and no id. That is a
  // buyer who changed their mind, not an error — nothing failed, nothing was
  // charged, and the useful thing to offer is the way back.
  if (state.kind === 'checkout-cancelled') {
    return (
      <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div role="status" className="alert alert-info max-w-lg">
            <div>
              <p className="font-semibold">Checkout cancelled</p>
              <p className="text-sm">
                You were not charged. Your selection is still there if you want
                to pick up where you left off.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={getInternalUrl('/pricing')}
              className="btn btn-primary min-h-11 min-w-11"
            >
              Back to pricing
            </Link>
            <Link
              href={getInternalUrl('/payment')}
              className="btn btn-ghost min-h-11 min-w-11"
            >
              View your payments
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Missing or malformed ID
  if (state.kind === 'missing-id') {
    return (
      <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div role="status" className="alert alert-info max-w-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="h-6 w-6 shrink-0 stroke-current"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              No payment session found. If you just completed a checkout, try
              returning from your payment provider.
            </span>
          </div>
          <Link href="/payment-demo" className="btn btn-primary min-h-11">
            Go to Payment Demo
          </Link>
        </div>
      </main>
    );
  }

  // Loading
  if (state.kind === 'loading') {
    return (
      <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
        <div
          className="flex flex-col items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <span className="loading loading-spinner loading-lg"></span>
          <p className="text-base-content">Verifying payment status...</p>
          <span className="sr-only">Loading payment status</span>
        </div>
      </main>
    );
  }

  // Network/verification error with manual retry
  if (state.kind === 'error') {
    return (
      <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <div role="alert" className="alert alert-error max-w-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{state.message}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary min-h-11"
            onClick={() => setRetryCount((c) => c + 1)}
            aria-label="Retry payment verification"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  // Intent exists but no result yet (payment still processing)
  if (state.kind === 'not-found') {
    return (
      <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <OfflineRetryBanner className="max-w-lg" />
          <div role="status" className="alert alert-info max-w-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="h-6 w-6 shrink-0 stroke-current"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Payment is still processing. This page will update automatically
              when the result is ready.
            </span>
          </div>
          <Link href="/payment-demo" className="sh-btn sh-btn-ghost">
            Back to Payment Demo
          </Link>
        </div>
      </main>
    );
  }

  // Success — render the status display with real-time updates
  return (
    <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">Payment Result</h1>
      </div>

      <div className="max-w-lg">
        <OfflineRetryBanner className="mb-4" />
        <PaymentStatusDisplay
          paymentResultId={state.resultId}
          showDetails
          onRetrySuccess={(newIntentId) => {
            // Navigate to the new intent's result page. Raw window.location does
            // NOT get the basePath prefixed (unlike next/link), so wrap it in
            // getInternalUrl or a project-site fork escapes to the domain root (#159).
            window.location.href = getInternalUrl(
              `/payment-result?id=${newIntentId}`
            );
          }}
        />
      </div>

      <div className="mt-8 flex gap-4">
        <Link href="/payment-demo" className="sh-btn sh-btn-ghost">
          Back to Payment Demo
        </Link>
      </div>
    </main>
  );
}

export default function PaymentResultPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
            <div
              className="flex flex-col items-center gap-4"
              role="status"
              aria-live="polite"
            >
              <span className="loading loading-spinner loading-lg"></span>
              <p className="text-base-content">Loading...</p>
            </div>
          </main>
        }
      >
        <PaymentResultContent />
      </Suspense>
    </ProtectedRoute>
  );
}
