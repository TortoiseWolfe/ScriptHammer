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
import { featureFlags } from '@/config/payment';
import { getPaymentStatus } from '@/lib/payments/payment-service';

type ResultState =
  | { kind: 'loading' }
  | { kind: 'missing-id' }
  | { kind: 'not-configured' }
  | { kind: 'loaded'; resultId: string }
  | { kind: 'not-found'; intentId: string }
  | { kind: 'error'; message: string };

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const intentId = searchParams?.get('id') ?? null;
  const [state, setState] = useState<ResultState>({ kind: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  const noProvidersConfigured =
    !featureFlags.stripeEnabled && !featureFlags.paypalEnabled;

  useEffect(() => {
    if (noProvidersConfigured) {
      setState({ kind: 'not-configured' });
      return;
    }

    if (!intentId) {
      setState({ kind: 'missing-id' });
      return;
    }

    // Validate UUID format
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(intentId)) {
      setState({ kind: 'missing-id' });
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const result = await getPaymentStatus(intentId!);
        if (cancelled) return;

        if (result) {
          setState({ kind: 'loaded', resultId: result.id });
        } else {
          setState({ kind: 'not-found', intentId: intentId! });
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
  }, [intentId, noProvidersConfigured, retryCount]);

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
          <p className="text-base-content/70">Verifying payment status...</p>
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
          <Link href="/payment-demo" className="btn btn-ghost min-h-11">
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
        <PaymentStatusDisplay
          paymentResultId={state.resultId}
          showDetails
          onRetrySuccess={(newIntentId) => {
            // Navigate to the new intent's result page
            window.location.href = `/payment-result?id=${newIntentId}`;
          }}
        />
      </div>

      <div className="mt-8 flex gap-4">
        <Link href="/payment-demo" className="btn btn-ghost min-h-11">
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
              <p className="text-base-content/70">Loading...</p>
            </div>
          </main>
        }
      >
        <PaymentResultContent />
      </Suspense>
    </ProtectedRoute>
  );
}
