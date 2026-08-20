/**
 * Payment Demo Page
 * Showcases all payment integration components (protected route)
 */

'use client';

import React, { useState } from 'react';
import { PaymentButton } from '@/components/payment/PaymentButton/PaymentButton';
import { PaymentConsentModal } from '@/components/payment/PaymentConsentModal/PaymentConsentModal';
import { PaymentHistory } from '@/components/payment/PaymentHistory/PaymentHistory';
import { PaymentStatusDisplay } from '@/components/payment/PaymentStatusDisplay/PaymentStatusDisplay';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import EmailVerificationNotice from '@/components/auth/EmailVerificationNotice';
import { useAuth } from '@/contexts/AuthContext';
import { usePaymentConsent } from '@/hooks/usePaymentConsent';
import { featureFlags } from '@/config/payment';

function PaymentDemoContent() {
  const { user } = useAuth();
  const { hasConsent, consentDate, grantConsent, resetConsent } =
    usePaymentConsent();
  const [showConsent, setShowConsent] = useState(true);
  const [paymentResultId, setPaymentResultId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<Error | null>(null);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
    // Sync showConsent with persisted consent state
    if (hasConsent) {
      setShowConsent(false);
    }
  }, [hasConsent]);

  const handlePaymentSuccess = (paymentIntentId: string) => {
    setPaymentResultId(paymentIntentId);
    setPaymentError(null);
  };

  const handlePaymentError = (error: Error) => {
    setPaymentError(error);
    setPaymentResultId(null);
  };

  // GDPR right to withdraw consent: clear the stored payment consent and return
  // to Step 1. resetConsent() clears localStorage + the hook's hasConsent, but
  // the sync effect above only drives showConsent → false on grant, so flip it
  // back to true here to re-show the consent step immediately.
  const handleWithdrawConsent = () => {
    resetConsent();
    setShowConsent(true);
    setPaymentResultId(null);
    setPaymentError(null);
  };

  const noProvidersConfigured =
    !featureFlags.stripeEnabled && !featureFlags.paypalEnabled;

  return (
    <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
      {/* Email verification notice */}
      {user && !user.email_confirmed_at && (
        <div className="mb-8">
          <EmailVerificationNotice />
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold">Payment Integration Demo</h1>
        <p className="text-base-content text-lg">
          Explore the payment system features: Stripe integration, GDPR consent,
          offline queue, and transaction history.
        </p>
        {mounted && (
          <div className="alert alert-info mt-4">
            <span>
              Logged in as: {user?.email} - User ID: {user?.id}
            </span>
          </div>
        )}
      </div>

      {/* Missing-config banner — shown prominently at the top when no
          payment provider is configured. Without this, clicking a Pay
          button produces opaque SDK errors. */}
      {noProvidersConfigured && (
        <div role="alert" className="alert alert-warning mb-8">
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
              This demo requires Stripe or PayPal API keys. Set{' '}
              <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and/or{' '}
              <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> in <code>.env</code>,
              plus their server secrets in Supabase Vault. See{' '}
              <code>docs/PAYMENT-DEPLOYMENT.md</code> for the full setup
              walkthrough (~30-60 min including account signup).
            </p>
          </div>
        </div>
      )}

      {/* GDPR Consent Modal */}
      {showConsent && (
        <div className="mb-8">
          <div className="card bg-base-100 rounded-box">
            <div className="card-body">
              <h2 className="card-title">Step 1: GDPR Consent</h2>
              <p className="text-base-content mb-4">
                Before processing payments, we need your consent to load
                third-party payment scripts (Stripe, PayPal).
              </p>

              {/* Inline consent UI for demo */}
              <div className="sh-well bg-base-200 rounded-box p-4">
                <h4 className="mb-2 font-semibold">What this means:</h4>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>
                    External scripts will be loaded from Stripe and PayPal
                  </li>
                  <li>
                    Your payment data will be processed securely by these
                    providers
                  </li>
                  <li>
                    No payment scripts are loaded without your explicit consent
                  </li>
                  <li>You can revoke this consent at any time in settings</li>
                </ul>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary min-h-11 flex-1"
                  onClick={() => {
                    grantConsent(); // Persist consent to localStorage
                    setShowConsent(false);
                  }}
                >
                  Accept & Continue
                </button>
                {/* `.btn-ghost` is deliberately excluded from #427's depth,
                    so a ghost button on these pages reads as bare text with no
                    boundary at all. `sh-btn sh-btn-ghost` is the cut twin
                    (the /docs/[slug] precedent) and keeps the 44px height. */}
                <button
                  type="button"
                  className="sh-btn sh-btn-ghost flex-1"
                  onClick={() =>
                    alert('Payment features require consent to function')
                  }
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Button Demo */}
      {!showConsent && (
        <div className="mb-8">
          <div className="card bg-base-100 rounded-box">
            <div className="card-body">
              <h2 className="card-title">Step 2: Make a Payment</h2>
              <p className="text-base-content mb-4">
                Click the button below to test the Stripe payment flow. Use test
                card{' '}
                <code className="bg-base-200 rounded px-2 py-1">
                  4242 4242 4242 4242
                </code>
                .
              </p>

              <div className="flex flex-wrap gap-4">
                {/* One-time payment */}
                <PaymentButton
                  amount={2000}
                  currency="usd"
                  type="one_time"
                  customerEmail={user?.email || 'demo@example.com'}
                  description="Demo Product - $20.00"
                  buttonText="Pay $20.00 (One-Time)"
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  className="btn-primary"
                />

                {/*
                  Recurring payment.

                  `amount` is DISPLAY ONLY on this path and always was — the
                  charge comes from the Stripe Price, so the old "$9.99/month"
                  label was never what a subscriber would have been billed
                  (#772). The price now comes from `products.stripe_price_id`
                  for the SKU named below, so the label and the charge finally
                  agree.

                  All three recurring SKUs are `active = false` until #772 and
                  #559 are both closed, so this button surfaces a clear "product
                  not found" rather than charging. That is the honest state, and
                  better than the previous version, which silently charged
                  whatever one global env var pointed at.
                */}
                <PaymentButton
                  amount={9900}
                  currency="usd"
                  type="recurring"
                  productId="svc-care"
                  customerEmail={user?.email || 'demo@example.com'}
                  description="Care Plan - $99.00/month"
                  buttonText="Subscribe to Care Plan"
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  className="btn-secondary"
                />

                {/* PayPal */}
                <PaymentButton
                  amount={1500}
                  currency="usd"
                  type="one_time"
                  customerEmail={user?.email || 'demo@example.com'}
                  description="Demo PayPal Payment - $15.00"
                  buttonText="PayPal $15.00"
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  className="btn-accent"
                />
              </div>

              {/* GDPR: withdraw payment consent (right to withdraw). Returns to
                  Step 1 and clears the stored consent. */}
              <div className="border-base-300 mt-6 border-t pt-4">
                <p className="text-base-content mb-2 text-sm">
                  You granted payment consent
                  {consentDate
                    ? ` on ${new Date(consentDate).toLocaleDateString()}`
                    : ''}
                  . You can withdraw it at any time.
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost text-error min-h-11"
                  onClick={handleWithdrawConsent}
                  data-testid="withdraw-payment-consent"
                  aria-label="Withdraw payment consent"
                >
                  Withdraw payment consent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Result Display */}
      {(paymentResultId || paymentError) && (
        <div className="mb-8">
          <div className="card bg-base-100 rounded-box">
            <div className="card-body">
              <h2 className="card-title">Step 3: Payment Result</h2>
              {paymentError ? (
                <div className="alert alert-error">
                  <span>Error: {paymentError.message}</span>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setPaymentResultId(null);
                      setPaymentError(null);
                    }}
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <PaymentStatusDisplay
                  paymentResultId={paymentResultId}
                  showDetails
                  onRetrySuccess={(newId) => {
                    setPaymentResultId(newId);
                  }}
                  onRetryError={(error) => {
                    setPaymentError(error);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      {!showConsent && user?.id && (
        <div className="mb-8">
          <div className="card bg-base-100 rounded-box">
            <div className="card-body">
              <h2 className="card-title">Step 4: Payment History</h2>
              <p className="text-base-content mb-4">
                View all past transactions with filters and pagination.
              </p>
              <PaymentHistory initialLimit={50} showFilters={true} />
            </div>
          </div>
        </div>
      )}

      {/* Feature Documentation */}
      <div className="card sh-well bg-base-100 rounded-box">
        <div className="card-body">
          <h2 className="card-title">Features Implemented</h2>
          <ul className="list-inside list-disc space-y-2">
            <li>
              <strong>GDPR Compliance</strong> - Consent modal before loading
              payment scripts
            </li>
            <li>
              <strong>Multiple Providers</strong> - Stripe and PayPal support
            </li>
            <li>
              <strong>Payment Types</strong> - One-time and recurring
              subscriptions
            </li>
            <li>
              <strong>Offline Queue</strong> - IndexedDB queue with automatic
              sync
            </li>
            <li>
              <strong>Real-time Updates</strong> - Supabase realtime
              subscriptions
            </li>
            <li>
              <strong>Security</strong> - Row Level Security (RLS) policies on
              all tables
            </li>
            <li>
              <strong>Webhook Verification</strong> - Signature validation for
              all webhooks
            </li>
            <li>
              <strong>Transaction History</strong> - Filterable payment history
              with pagination
            </li>
          </ul>

          <div className="divider"></div>

          <h3 className="text-lg font-semibold">Test Cards</h3>
          <div className="sh-well bg-base-100 rounded-box overflow-x-auto px-4 py-2">
            <table className="table-sm table">
              <thead>
                <tr>
                  <th>Card Number</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>4242 4242 4242 4242</code>
                  </td>
                  <td>Success</td>
                </tr>
                <tr>
                  <td>
                    <code>4000 0000 0000 0002</code>
                  </td>
                  <td>Declined</td>
                </tr>
                <tr>
                  <td>
                    <code>4000 0000 0000 9995</code>
                  </td>
                  <td>Insufficient funds</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="divider"></div>

          <div className="alert alert-info">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="h-6 w-6 shrink-0 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div>
              <p className="font-semibold">Environment Setup Required</p>
              <p className="text-sm">
                To process real payments, configure your Stripe/PayPal API keys
                in <code>.env.local</code>. See{' '}
                <code>docs/PAYMENT-DEPLOYMENT.md</code> for setup instructions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PaymentDemoPage() {
  return (
    <ProtectedRoute>
      <PaymentDemoContent />
    </ProtectedRoute>
  );
}
