/**
 * PaymentStatusDisplay Component
 * Real-time payment status updates with retry functionality
 */

'use client';

import React from 'react';
import { usePaymentRealtime } from '@/hooks/usePaymentRealtime';
import { usePaymentRetryStatus } from '@/hooks/usePaymentRetryStatus';
import {
  retryFailedPayment,
  formatPaymentAmount,
  PaymentRetryLimitError,
  PaymentRetryCoolingError,
  PaymentRetryExpiredError,
} from '@/lib/payments/payment-service';
import { categorizePaymentError } from '@/lib/payments/error-categorization';
import { SwitchProviderPanel } from '@/components/payment/SwitchProviderPanel';
import type { Currency } from '@/types/payment';

export interface PaymentStatusDisplayProps {
  paymentResultId: string | null;
  showDetails?: boolean;
  onRetrySuccess?: (newIntentId: string) => void;
  onRetryError?: (error: Error) => void;
  className?: string;
}

/**
 * Display payment status with real-time updates
 *
 * @example
 * ```tsx
 * function PaymentPage({ resultId }: { resultId: string }) {
 *   return (
 *     <PaymentStatusDisplay
 *       paymentResultId={resultId}
 *       showDetails={true}
 *       onRetrySuccess={(id) => router.push(`/payment/${id}`)}
 *     />
 *   );
 * }
 * ```
 */
export const PaymentStatusDisplay: React.FC<PaymentStatusDisplayProps> = ({
  paymentResultId,
  showDetails = true,
  onRetrySuccess,
  onRetryError,
  className = '',
}) => {
  const { paymentResult, loading, error } = usePaymentRealtime(paymentResultId);
  const retryStatus = usePaymentRetryStatus(paymentResult?.intent_id ?? null);
  const [isRetrying, setIsRetrying] = React.useState(false);
  // Surfaces user-facing errors thrown by retryFailedPayment (limit, cooling,
  // expired). Cleared on the next click attempt.
  const [retryError, setRetryError] = React.useState<string | null>(null);
  // US3: SwitchProviderPanel toggle. Closed by default; opened when the user
  // clicks "Use a different payment method".
  const [showSwitchPanel, setShowSwitchPanel] = React.useState(false);

  const handleRetry = async () => {
    if (!paymentResult?.intent_id) return;

    setRetryError(null);
    setIsRetrying(true);

    try {
      const newIntent = await retryFailedPayment(paymentResult.intent_id);

      if (onRetrySuccess) {
        onRetrySuccess(newIntent.id);
      }
    } catch (err) {
      // Map known retry-flow errors to actionable user messages. Anything
      // else falls back to the existing onRetryError callback so callers
      // can surface their own toast/alert.
      if (
        err instanceof PaymentRetryLimitError ||
        err instanceof PaymentRetryCoolingError ||
        err instanceof PaymentRetryExpiredError
      ) {
        setRetryError(err.message);
      } else {
        const errorObj = err instanceof Error ? err : new Error('Retry failed');
        if (onRetryError) {
          onRetryError(errorObj);
        }
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div
        className={`flex flex-col gap-4 ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="skeleton h-20 w-full"></div>
        {showDetails && (
          <>
            <div className="skeleton h-4 w-3/4"></div>
            <div className="skeleton h-4 w-1/2"></div>
          </>
        )}
        <span className="sr-only">Loading payment status...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`alert alert-error ${className}`} role="alert">
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
        <span>Error loading payment status: {error.message}</span>
      </div>
    );
  }

  // No result found
  if (!paymentResult) {
    return (
      <div className={`alert alert-info ${className}`} role="status">
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
        <span>No payment result found</span>
      </div>
    );
  }

  // Map status to badge style
  const statusConfig = {
    succeeded: {
      badge: 'badge-success',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
      message: 'Payment Successful',
    },
    failed: {
      badge: 'badge-error',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ),
      message: 'Payment Failed',
    },
    refunded: {
      badge: 'badge-warning',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
      ),
      message: 'Payment Refunded',
    },
    pending: {
      badge: 'badge-info',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      ),
      message: 'Payment Pending',
    },
  };

  const config = statusConfig[paymentResult.status] || statusConfig.pending;

  return (
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`text-${config.badge.split('-')[1]}`}>
              {config.icon}
            </div>
            <div>
              <h3 className="text-xl font-bold">{config.message}</h3>
              <span className={`badge ${config.badge} mt-1`}>
                {paymentResult.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        {showDetails && (
          <div className="mt-4 space-y-2 border-t pt-4">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Amount:</span>
              <span>
                {formatPaymentAmount(
                  paymentResult.charged_amount,
                  paymentResult.charged_currency as Currency
                )}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="font-semibold">Provider:</span>
              <span className="capitalize">{paymentResult.provider}</span>
            </div>

            {paymentResult.transaction_id && (
              <div className="flex justify-between text-sm">
                <span className="font-semibold">Transaction ID:</span>
                <code className="bg-base-200 rounded px-2 py-1 text-xs">
                  {paymentResult.transaction_id}
                </code>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="font-semibold">Date:</span>
              <span>
                {new Date(paymentResult.created_at).toLocaleDateString()}
              </span>
            </div>

            {paymentResult.webhook_verified && (
              <div className="text-success flex items-center gap-2 text-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span>Webhook Verified</span>
              </div>
            )}
          </div>
        )}

        {/* Failed state — categorized error + retry surface */}
        {paymentResult.status === 'failed' &&
          (() => {
            const categorized = categorizePaymentError(
              paymentResult.error_code,
              paymentResult.error_message
            );
            const coolingSeconds = Math.ceil(
              retryStatus.coolingMsRemaining / 1000
            );

            return (
              <>
                {/* FR-001 + FR-003: user-facing message + resolution hint */}
                <div
                  className="alert alert-warning mt-4"
                  role="alert"
                  aria-live="polite"
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold">{categorized.userMessage}</p>
                    <p className="text-sm">{categorized.resolutionHint}</p>
                    {paymentResult.transaction_id && (
                      <p className="text-xs opacity-70">
                        Reference:{' '}
                        <code className="bg-base-200 rounded px-1">
                          {paymentResult.transaction_id}
                        </code>
                      </p>
                    )}
                  </div>
                </div>

                {/* Retry-flow error from a click that hit limit/cooling/expired */}
                {retryError && (
                  <div
                    className="alert alert-error mt-4"
                    role="alert"
                    aria-live="assertive"
                  >
                    {retryError}
                  </div>
                )}

                {/* FR-006: only show retry + switch for recoverable categories.
                    Non-recoverable failures route to support contact (FR-019 lite).
                    US4 progressive disclosure: at retry_count >= 2, the recovery
                    list is expanded by default; otherwise collapsed. */}
                {categorized.recoverable ? (
                  <>
                    <div className="card-actions mt-4 flex-wrap items-center justify-between gap-2">
                      {/* FR-008: attempt counter */}
                      <p
                        className="text-sm opacity-70"
                        aria-label={`Attempt ${retryStatus.retryCount + 1} of ${retryStatus.maxRetries}`}
                      >
                        Attempt {retryStatus.retryCount + 1} of{' '}
                        {retryStatus.maxRetries}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-primary min-h-11"
                          onClick={handleRetry}
                          disabled={isRetrying || !retryStatus.canRetry}
                          aria-label={
                            retryStatus.disabledReason === 'cooling'
                              ? `Retry available in ${coolingSeconds} seconds`
                              : retryStatus.disabledReason === 'limit'
                                ? 'Retry limit reached'
                                : retryStatus.disabledReason === 'expired'
                                  ? 'Payment session expired'
                                  : 'Retry failed payment'
                          }
                        >
                          {isRetrying ? (
                            <>
                              <span className="loading loading-spinner"></span>
                              Retrying...
                            </>
                          ) : retryStatus.disabledReason === 'cooling' ? (
                            <>Try again in {coolingSeconds}s</>
                          ) : (
                            <>Retry Payment</>
                          )}
                        </button>
                        {/* US3 (FR-018): always-visible switch-provider option for
                            recoverable failures. The button itself is small; the panel
                            mounts inline below when toggled. */}
                        <button
                          type="button"
                          className="btn btn-outline min-h-11"
                          onClick={() => setShowSwitchPanel((s) => !s)}
                          aria-expanded={showSwitchPanel}
                          aria-controls="switch-provider-panel"
                        >
                          {showSwitchPanel
                            ? 'Cancel'
                            : 'Use a different payment method'}
                        </button>
                      </div>
                    </div>

                    {/* US3: SwitchProviderPanel — inline expand below the action row */}
                    {showSwitchPanel && paymentResult.intent_id && (
                      <div id="switch-provider-panel" className="mt-4">
                        <SwitchProviderPanel
                          parentIntentId={paymentResult.intent_id}
                          onSwitchSuccess={(newIntentId) => {
                            window.location.href = `/payment-result?id=${newIntentId}`;
                          }}
                        />
                      </div>
                    )}

                    {/* US4 (FR-016/017/019): progressive recovery disclosure.
                        - retry_count 0: nothing extra
                        - retry_count 1: collapsed <details> hint
                        - retry_count >= 2: expanded by default, retry de-emphasized
                          when at the cap */}
                    {retryStatus.retryCount >= 1 && (
                      <details
                        className="mt-4"
                        open={retryStatus.retryCount >= 2}
                      >
                        <summary className="cursor-pointer text-sm font-semibold">
                          Need more help?
                        </summary>
                        <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm">
                          <li
                            className={
                              retryStatus.disabledReason === 'limit'
                                ? 'line-through opacity-50'
                                : ''
                            }
                          >
                            Try again — payment failures are sometimes
                            temporary.
                          </li>
                          <li>
                            Use a different payment method (Stripe, PayPal, Cash
                            App, or Chime).
                          </li>
                          <li
                            className={
                              retryStatus.disabledReason === 'limit'
                                ? 'font-semibold'
                                : ''
                            }
                          >
                            <a href="/contact" className="link">
                              Contact support
                            </a>{' '}
                            with the transaction reference above.
                          </li>
                        </ol>
                      </details>
                    )}
                  </>
                ) : (
                  <div className="card-actions mt-4 justify-end">
                    <a
                      href="/contact"
                      className="btn btn-outline min-h-11"
                      aria-label="Contact support about this payment"
                    >
                      Contact Support
                    </a>
                  </div>
                )}
              </>
            );
          })()}
      </div>
    </div>
  );
};

PaymentStatusDisplay.displayName = 'PaymentStatusDisplay';
