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

function PaymentDemoContent() {
  const { user } = useAuth();
  const [showConsent, setShowConsent] = useState(true);
  const [paymentResultId, setPaymentResultId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<Error | null>(null);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handlePaymentSuccess = (paymentIntentId: string) => {
    setPaymentResultId(paymentIntentId);
    setPaymentError(null);
  };

  const handlePaymentError = (error: Error) => {
    setPaymentError(error);
    setPaymentResultId(null);
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
      {/* Email verification notice */}
      {user && !user.email_confirmed_at && (
        <div className="mb-8">
          <EmailVerificationNotice />
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold">Payment Integration Demo</h1>
        <p className="text-base-content/70 text-lg">
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

      {/* GDPR Consent Modal */}
      {showConsent && (
        <div className="mb-8">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Step 1: GDPR Consent</h2>
              <p className="text-base-content/70 mb-4">
                Before processing payments, we need your consent to load
                third-party payment scripts (Stripe, PayPal).
              </p>

              {/* Inline consent UI for demo */}
              <div className="bg-base-200 rounded-lg p-4">
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
                  onClick={() => setShowConsent(false)}
                >
                  Accept & Continue
                </button>
                <button
                  type="button"
                  className="btn btn-ghost min-h-11 flex-1"
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
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Step 2: Make a Payment</h2>
              <p className="text-base-content/70 mb-4">
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

                {/* Recurring payment */}
                <PaymentButton
                  amount={999}
                  currency="usd"
                  type="recurring"
                  customerEmail={user?.email || 'demo@example.com'}
                  description="Demo Subscription - $9.99/month"
                  buttonText="Subscribe $9.99/month"
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
            </div>
          </div>
        </div>
      )}

      {/* Payment Result Display */}
      {(paymentResultId || paymentError) && (
        <div className="mb-8">
          <div className="card bg-base-100 shadow-xl">
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
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Step 4: Payment History</h2>
              <p className="text-base-content/70 mb-4">
                View all past transactions with filters and pagination.
              </p>
              <PaymentHistory initialLimit={50} showFilters={true} />
            </div>
          </div>
        </div>
      )}

      {/* Feature Documentation */}
      <div className="card bg-base-200">
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
          <div className="overflow-x-auto">
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
    </div>
  );
}

export default function PaymentDemoPage() {
  return (
    <ProtectedRoute>
      <PaymentDemoContent />
    </ProtectedRoute>
  );
}
