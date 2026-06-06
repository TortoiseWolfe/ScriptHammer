'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionManager } from '@/components/payment/SubscriptionManager';
import { featureFlags } from '@/config/payment';

/**
 * Client body of /account/subscriptions (#5). Shows the not-configured banner
 * when neither provider is set up (mirrors /payment-demo), then the
 * SubscriptionManager for the signed-in user.
 */
export function SubscriptionsContent() {
  const { user } = useAuth();
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
              New subscriptions can&apos;t be created until Stripe or PayPal is
              set up. Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and/or{' '}
              <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> in <code>.env</code>.
              See <code>docs/PAYMENT-DEPLOYMENT.md</code>.
            </p>
          </div>
        </div>
      )}

      {user && <SubscriptionManager userId={user.id} />}
    </div>
  );
}

export default SubscriptionsContent;
