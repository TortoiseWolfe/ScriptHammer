/**
 * PaymentHistory Component
 * Dashboard displaying user's payment history with filters and pagination
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getPaymentHistory,
  formatPaymentAmount,
} from '@/lib/payments/payment-service';
import {
  usePaymentResultsRealtime,
  type PaymentResultsChange,
} from '@/hooks/usePaymentResultsRealtime';
import type { PaymentActivity, Currency, PaymentStatus } from '@/types/payment';
import PaymentTrendChart from '@/components/molecular/PaymentTrendChart';
import { aggregateDailyPayments } from '@/lib/payments/aggregate-daily';

export interface PaymentHistoryProps {
  initialLimit?: number;
  showFilters?: boolean;
  className?: string;
  /** Live-update the list via Supabase Realtime (default true). Tests/stories
   * pass false to avoid opening a channel. */
  realtime?: boolean;
}

const REALTIME_BADGE: Record<
  ReturnType<typeof usePaymentResultsRealtime>,
  { cls: string; label: string }
> = {
  live: { cls: 'badge-success', label: 'Live' },
  connecting: { cls: 'badge-ghost', label: 'Connecting' },
  reconnecting: { cls: 'badge-info', label: 'Reconnecting…' },
  error: { cls: 'badge-warning', label: 'Realtime offline' },
};

type StatusFilter = 'all' | 'paid' | 'failed' | 'refunded' | 'pending';

/**
 * Payment history dashboard with filters
 * REQ-SEC-001: Automatically uses authenticated user's payment history
 *
 * @example
 * ```tsx
 * function DashboardPage() {
 *   return (
 *     <PaymentHistory
 *       initialLimit={20}
 *       showFilters={true}
 *     />
 *   );
 * }
 * ```
 */
export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  initialLimit = 20,
  showFilters = true,
  className = '',
  realtime = true,
}) => {
  const [payments, setPayments] = useState<PaymentActivity[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentActivity[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [providerFilter, setProviderFilter] = useState<
    'all' | 'stripe' | 'paypal'
  >('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch payment history (uses authenticated user). Extracted as a stable
  // callback so the realtime hook can re-run it on a payment_results change.
  //
  // Retries transient failures before surfacing the error alert. The query
  // runs right after auth/session hydration; under load (e.g. Supabase
  // Realtime/RLS returning a transient 401/406 during a session refresh) the
  // FIRST attempt can throw even though a retry a moment later succeeds.
  // Without this, a momentary blip stranded the user on "Error loading
  // payment history" — a real UX regression, and the cause of the flaky
  // payment-isolation E2E under concurrent-backend load.
  const refetch = useCallback(async () => {
    setError(null);
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // getPaymentHistory uses the authenticated user automatically (REQ-SEC-001)
        const history = await getPaymentHistory(initialLimit);
        setPayments(history);
        setFilteredPayments(history);
        setLoading(false);
        return;
      } catch (err) {
        if (attempt === maxAttempts) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to load payment history')
          );
          setLoading(false);
          return;
        }
        // Linear backoff (300ms, 600ms) before the next attempt.
        await new Promise((r) => setTimeout(r, attempt * 300));
      }
    }
  }, [initialLimit]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  // Transient "N updates" indicator: when a burst of realtime events is
  // coalesced into one refetch, show how many were batched, then auto-dismiss.
  const [batchCount, setBatchCount] = useState(0);
  const handleBatch = useCallback((count: number) => {
    if (count > 1) {
      setBatchCount(count);
      window.setTimeout(() => setBatchCount(0), 4000);
    }
  }, []);

  // Transient error notification: when a realtime payment_results event carries
  // a failed status, surface it immediately (not waiting for the debounced
  // refetch), then auto-dismiss.
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const handleEvent = useCallback((payload: PaymentResultsChange) => {
    if (payload.new?.status === 'failed') {
      setRealtimeError('A payment just failed.');
      window.setTimeout(() => setRealtimeError(null), 6000);
    }
  }, []);

  // Live-update on payment_results changes (debounced inside the hook). The
  // returned status drives the connection indicator badge; onBatch surfaces the
  // coalesced-burst count; onEvent surfaces per-event failures. When realtime is
  // off the hook is fully inert.
  const realtimeStatus = usePaymentResultsRealtime(
    refetch,
    realtime,
    handleBatch,
    handleEvent
  );

  // Daily series for the trend chart, aggregated from the user's own payments
  // (the admin chart's RPC is all-users and not callable here).
  const trendSeries = useMemo(
    () => aggregateDailyPayments(payments),
    [payments]
  );

  // Apply filters
  useEffect(() => {
    let filtered = [...payments];

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (providerFilter !== 'all') {
      filtered = filtered.filter((p) => p.provider === providerFilter);
    }

    setFilteredPayments(filtered);
    setCurrentPage(1); // Reset to first page on filter change
  }, [statusFilter, providerFilter, payments]);

  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPayments = filteredPayments.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Status badge styling
  const getStatusBadge = (status: PaymentActivity['status']) => {
    const badges: Record<PaymentStatus, string> = {
      succeeded: 'badge-success',
      failed: 'badge-error',
      refunded: 'badge-warning',
      pending: 'badge-info',
    };
    return badges[status] || 'badge-ghost';
  };

  if (loading) {
    return (
      <div
        className={`flex flex-col gap-4 ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="skeleton h-12 w-full"></div>
        <div className="skeleton h-64 w-full"></div>
        <span className="sr-only">Loading payment history...</span>
      </div>
    );
  }

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
        <span>Error loading payment history: {error.message}</span>
      </div>
    );
  }

  const realtimeBadge = REALTIME_BADGE[realtimeStatus];

  // Transient pill shown when a burst of realtime updates was coalesced.
  const batchPill =
    batchCount > 1 ? (
      <span
        className="badge badge-info gap-1"
        data-testid="batch-update-count"
        role="status"
        aria-live="polite"
      >
        {batchCount} updates
      </span>
    ) : null;

  // Transient error banner surfaced when a realtime event reports a failed
  // payment. Auto-dismisses; assertive so it's announced promptly.
  const realtimeErrorAlert = realtimeError ? (
    <div
      className="alert alert-error p-2 text-sm"
      role="alert"
      aria-live="assertive"
      data-testid="realtime-error-alert"
    >
      <span>{realtimeError}</span>
    </div>
  ) : null;

  if (payments.length === 0) {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        {realtimeErrorAlert}
        {/* Keep the count + realtime indicator visible in the empty state so a
            live INSERT flips it from 0 without a structural remount. */}
        <div className="flex items-center justify-end gap-2">
          {realtime && (
            <span
              className={`badge ${realtimeBadge.cls}`}
              data-testid="realtime-status"
            >
              {realtimeBadge.label}
            </span>
          )}
          {batchPill}
          <span className="badge badge-outline" data-testid="transaction-count">
            {payments.length} total payments
          </span>
        </div>
        <div className="card bg-base-100 rounded-box">
          <div className="card-body items-center text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="text-base-content h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            <h3 className="mt-4 text-xl font-bold">No payment history</h3>
            <p className="text-base-content">
              You haven&apos;t made any payments yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {realtimeErrorAlert}
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-2xl font-bold">Payment History</h2>
        <div className="flex items-center gap-2">
          {realtime && (
            <span
              className={`badge ${realtimeBadge.cls}`}
              data-testid="realtime-status"
            >
              {realtimeBadge.label}
            </span>
          )}
          {batchPill}
          <span className="badge badge-outline" data-testid="transaction-count">
            {payments.length} total payments
          </span>
        </div>
      </div>

      {/* Payment trend chart (user-scoped daily succeeded/failed series). */}
      {trendSeries.length > 0 && (
        <PaymentTrendChart data={trendSeries} testId="payment-trend-chart" />
      )}

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <div>
            <label htmlFor="status-filter" className="label">
              <span>Status</span>
            </label>
            <select
              id="status-filter"
              className="select min-h-11 w-full sm:w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div>
            <label htmlFor="provider-filter" className="label">
              <span>Provider</span>
            </label>
            <select
              id="provider-filter"
              className="select min-h-11 w-full sm:w-auto"
              value={providerFilter}
              onChange={(e) =>
                setProviderFilter(e.target.value as typeof providerFilter)
              }
            >
              <option value="all">All Providers</option>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>
        </div>
      )}

      {/* Table - Desktop */}
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Transaction ID</th>
              <th>Verified</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPayments.map((payment) => (
              <tr key={payment.id} className="hover" data-payment-item>
                <td>{new Date(payment.created_at).toLocaleDateString()}</td>
                <td className="font-semibold">
                  {formatPaymentAmount(
                    payment.charged_amount,
                    payment.charged_currency as Currency
                  )}
                </td>
                <td className="capitalize">{payment.provider}</td>
                <td>
                  <span className={`badge ${getStatusBadge(payment.status)}`}>
                    {payment.status}
                  </span>
                </td>
                <td>
                  <code className="bg-base-200 rounded px-2 py-1 text-xs">
                    {payment.transaction_id || 'N/A'}
                  </code>
                </td>
                <td>
                  {payment.webhook_verified ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-success h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-label="Webhook verified"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-warning h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-label="Webhook not verified"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards - Mobile */}
      <div className="flex flex-col gap-3 sm:hidden">
        {paginatedPayments.map((payment) => (
          <div
            key={payment.id}
            className="card bg-base-100 shadow"
            data-payment-item
          >
            <div className="card-body p-4">
              <div className="flex items-center justify-between">
                <span className="text-base-content text-sm">
                  {new Date(payment.created_at).toLocaleDateString()}
                </span>
                <span className={`badge ${getStatusBadge(payment.status)}`}>
                  {payment.status}
                </span>
              </div>
              <div className="text-xl font-bold">
                {formatPaymentAmount(
                  payment.charged_amount,
                  payment.charged_currency as Currency
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{payment.provider}</span>
                {payment.webhook_verified && (
                  <span className="text-success flex items-center gap-1">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {filteredPayments.length === 0 && payments.length > 0 && (
        <div className="alert alert-info">
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
          <span>No payments match your filters</span>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <div className="btn-group">
            <button
              type="button"
              className="btn min-h-11"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              «
            </button>
            <button
              type="button"
              className="btn min-h-11"
              aria-label={`Page ${currentPage} of ${totalPages}`}
            >
              Page {currentPage} of {totalPages}
            </button>
            <button
              type="button"
              className="btn min-h-11"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

PaymentHistory.displayName = 'PaymentHistory';
