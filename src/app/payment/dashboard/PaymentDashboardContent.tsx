'use client';

import React from 'react';
import { PaymentHistory } from '@/components/payment/PaymentHistory';
import { featureFlags } from '@/config/payment';

/**
 * Client body of /payment/dashboard (#3). Shows the not-configured banner when
 * neither payment provider is set up (mirrors /payment-demo), then the user's
 * transaction history plus a link to subscription management.
 */
export function PaymentDashboardContent() {
  const noProvidersConfigured =
    !featureFlags.stripeEnabled && !featureFlags.paypalEnabled;

  return (
    <div className="flex flex-col gap-6">
      {noProvidersConfigured && (
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
              No payments can be processed until Stripe or PayPal is set up. Set{' '}
              <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and/or{' '}
              <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> in <code>.env</code>.
              See <code>docs/PAYMENT-DEPLOYMENT.md</code>.
            </p>
          </div>
        </div>
      )}

      <section aria-labelledby="payment-history-heading">
        <h2 id="payment-history-heading" className="mb-4 text-2xl font-bold">
          Payment History
        </h2>
        <PaymentHistory initialLimit={20} showFilters />
      </section>
    </div>
  );
}

export default PaymentDashboardContent;
