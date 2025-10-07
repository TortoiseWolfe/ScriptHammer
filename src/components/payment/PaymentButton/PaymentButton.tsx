/**
 * PaymentButton Component
 * Primary CTA for initiating payments with provider selection
 */

'use client';

import React from 'react';
import {
  usePaymentButton,
  UsePaymentButtonOptions,
} from '@/hooks/usePaymentButton';
import type { PaymentProvider } from '@/types/payment';
import { formatPaymentAmount } from '@/lib/payments/payment-service';

export interface PaymentButtonProps extends UsePaymentButtonOptions {
  className?: string;
  showProviderTabs?: boolean;
  buttonText?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Payment button with provider selection and offline support
 *
 * @example
 * ```tsx
 * <PaymentButton
 *   amount={2000}
 *   currency="usd"
 *   type="one_time"
 *   customerEmail="user@example.com"
 *   description="Premium Plan"
 *   onSuccess={(id) => router.push(`/success?id=${id}`)}
 * />
 * ```
 */
export const PaymentButton: React.FC<PaymentButtonProps> = ({
  className = '',
  showProviderTabs = true,
  buttonText,
  size = 'md',
  ...options
}) => {
  const {
    selectedProvider,
    isProcessing,
    error,
    queuedCount,
    hasConsent,
    selectProvider,
    initiatePayment,
    clearError,
  } = usePaymentButton(options);

  const formattedAmount = formatPaymentAmount(options.amount, options.currency);

  const sizeClasses = {
    sm: 'btn-sm min-h-11',
    md: 'btn-md min-h-11',
    lg: 'btn-lg min-h-11',
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Provider Selection Tabs */}
      {showProviderTabs && (
        <div role="tablist" className="tabs tabs-boxed">
          <button
            role="tab"
            className={`tab min-h-11 ${selectedProvider === 'stripe' ? 'tab-active' : ''}`}
            onClick={() => selectProvider('stripe')}
            aria-label="Select Stripe as payment provider"
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
            </svg>
            Stripe
          </button>
          <button
            role="tab"
            className={`tab min-h-11 ${selectedProvider === 'paypal' ? 'tab-active' : ''}`}
            onClick={() => selectProvider('paypal')}
            aria-label="Select PayPal as payment provider"
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.814-5.11a.914.914 0 0 1 .924-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
            </svg>
            PayPal
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div role="alert" aria-live="assertive" className="alert alert-error">
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
          <span>{error.message}</span>
          <button
            className="btn btn-ghost btn-sm min-h-11"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Offline Queue Notice */}
      {queuedCount > 0 && (
        <div role="status" className="alert alert-info">
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
            {queuedCount} payment{queuedCount > 1 ? 's' : ''} queued offline.
            Will process when connection returns.
          </span>
        </div>
      )}

      {/* No Consent Warning */}
      {!hasConsent && (
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
          <span>
            Payment consent required. Please accept the consent modal to
            continue.
          </span>
        </div>
      )}

      {/* Payment Button */}
      <button
        type="button"
        className={`btn btn-primary ${sizeClasses[size]} ${isProcessing ? 'loading' : ''}`}
        onClick={initiatePayment}
        disabled={!selectedProvider || isProcessing || !hasConsent}
        aria-label={buttonText || `Pay ${formattedAmount}`}
        aria-busy={isProcessing}
      >
        {isProcessing ? (
          <>
            <span className="loading loading-spinner"></span>
            Processing...
          </>
        ) : (
          buttonText || `Pay ${formattedAmount}`
        )}
      </button>

      {/* Provider Info */}
      {selectedProvider && (
        <p className="text-base-content/70 text-center text-sm">
          You will be redirected to{' '}
          {selectedProvider === 'stripe' ? 'Stripe' : 'PayPal'} to complete your
          payment securely.
        </p>
      )}
    </div>
  );
};

PaymentButton.displayName = 'PaymentButton';
