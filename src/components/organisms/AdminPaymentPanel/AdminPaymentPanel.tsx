'use client';

import React from 'react';
import { AdminStatCard } from '@/components/molecular/AdminStatCard';
import { AdminDataTable } from '@/components/molecular/AdminDataTable';
import DateRangeFilter, {
  type DateRange,
} from '@/components/molecular/DateRangeFilter';
import PaymentTrendChart from '@/components/molecular/PaymentTrendChart';
import type { AdminDataTableColumn } from '@/components/molecular/AdminDataTable';
import type {
  AdminPaymentStats,
  AdminPaymentTrends,
  ProviderBreakdown,
} from '@/services/admin/admin-payment-service';
import type { PaymentActivity } from '@/types/payment';

export interface AdminPaymentPanelProps {
  /** Payment statistics */
  stats: AdminPaymentStats | null;
  /** Recent transactions */
  transactions: PaymentActivity[];
  /** Date-ranged trends — section hidden when absent */
  trends?: AdminPaymentTrends | null;
  /** Current date range for the filter */
  range?: DateRange;
  /** Fires when the user changes the date range */
  onRangeChange?: (range: DateRange) => void;
  /** Show loading spinner */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

// A provider with >20% of its activity failing is worth flagging.
// Answers the "is Stripe having issues" Monday-morning question.
const FAILURE_FLAG_THRESHOLD = 0.2;

function failureShare(p: ProviderBreakdown): number {
  const total = p.succeeded + p.failed + p.refunded;
  return total === 0 ? 0 : p.failed / total;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusBadgeClass: Record<string, string> = {
  succeeded: 'badge badge-success',
  failed: 'badge badge-error',
  pending: 'badge badge-warning',
  refunded: 'badge badge-info',
};

type TransactionRow = PaymentActivity & Record<string, unknown>;

const columns: AdminDataTableColumn<TransactionRow>[] = [
  {
    key: 'created_at',
    label: 'Date',
    sortable: true,
    render: (row) => formatDate(row.created_at as string),
  },
  { key: 'provider', label: 'Provider', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => (
      <span className={statusBadgeClass[row.status as string] ?? 'badge'}>
        {row.status as string}
      </span>
    ),
  },
  {
    key: 'charged_amount',
    label: 'Amount',
    sortable: true,
    render: (row) => formatCents(row.charged_amount as number),
  },
  { key: 'customer_email', label: 'Customer', sortable: true },
  {
    key: 'webhook_verified',
    label: 'Verified',
    sortable: true,
    render: (row) =>
      row.webhook_verified ? (
        <span className="badge badge-success">Yes</span>
      ) : (
        <span className="badge badge-ghost">No</span>
      ),
  },
];

/**
 * AdminPaymentPanel component - Payment stats and transaction table
 *
 * @category organisms
 */
export function AdminPaymentPanel({
  stats,
  transactions,
  trends,
  range,
  onRangeChange,
  isLoading = false,
  className = '',
  testId,
}: AdminPaymentPanelProps) {
  if (isLoading) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center"
        data-testid={testId}
      >
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const successRate =
    stats && stats.total_payments > 0
      ? Math.round((stats.successful_payments / stats.total_payments) * 100) +
        '%'
      : '0%';

  return (
    <div
      className={`space-y-8${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      {/* Stats Bar */}
      <section aria-labelledby="payment-stats-heading">
        <h2 id="payment-stats-heading" className="mb-4 text-xl font-semibold">
          Payment Statistics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Total Payments"
            value={stats?.total_payments ?? 0}
            testId="stat-total-payments"
          />
          <AdminStatCard
            label="Success Rate"
            value={successRate}
            testId="stat-success-rate"
          />
          <AdminStatCard
            label="Active Subscriptions"
            value={stats?.active_subscriptions ?? 0}
            testId="stat-active-subscriptions"
          />
          <AdminStatCard
            label="Revenue"
            value={formatCents(stats?.total_revenue_cents ?? 0)}
            testId="stat-revenue"
          />
        </div>
      </section>

      {/* Trends: date-ranged breakdown */}
      {trends && (
        <section aria-labelledby="payment-trends-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <h2 id="payment-trends-heading" className="text-xl font-semibold">
              Provider Breakdown
            </h2>
            {onRangeChange && (
              <DateRangeFilter
                value={range}
                onChange={onRangeChange}
                testId="payment-range-filter"
              />
            )}
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AdminStatCard
              label="Refund Rate"
              value={`${((trends.refund_rate ?? 0) * 100).toFixed(2)}%`}
              trend={(trends.refund_rate ?? 0) > 0.05 ? 'up' : 'neutral'}
              testId="stat-refund-rate"
            />
            <AdminStatCard
              label="Succeeded"
              value={trends.totals?.succeeded ?? 0}
              description={formatCents(trends.totals?.revenue_cents ?? 0)}
              testId="stat-range-succeeded"
            />
            <AdminStatCard
              label="Failed"
              value={trends.totals?.failed ?? 0}
              trend={(trends.totals?.failed ?? 0) > 0 ? 'down' : 'neutral'}
              testId="stat-range-failed"
            />
          </div>

          <PaymentTrendChart
            data={trends.daily_series ?? []}
            className="text-base-content mb-4"
            testId="payment-trend-chart"
          />

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Succeeded</th>
                  <th>Failed</th>
                  <th>Refunded</th>
                  <th>Revenue</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {(trends.provider_breakdown ?? []).map((p) => {
                  const flagged = failureShare(p) > FAILURE_FLAG_THRESHOLD;
                  return (
                    <tr key={p.provider}>
                      <td className="font-medium">{p.provider}</td>
                      <td>{p.succeeded}</td>
                      <td>{p.failed}</td>
                      <td>{p.refunded}</td>
                      <td>{formatCents(p.revenue_cents)}</td>
                      <td>
                        {flagged ? (
                          <span className="badge badge-error">
                            Elevated failures
                          </span>
                        ) : (
                          <span className="badge badge-success">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(trends.provider_breakdown ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-base-content/60 text-center"
                    >
                      No activity in this range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Transaction Table */}
      <section aria-labelledby="transaction-table-heading">
        <h2
          id="transaction-table-heading"
          className="mb-4 text-xl font-semibold"
        >
          Recent Transactions
        </h2>
        <AdminDataTable<TransactionRow>
          columns={columns}
          data={transactions as TransactionRow[]}
          emptyMessage="No transactions found"
          testId="payment-transactions-table"
          renderExpandedRow={(row) => (
            // The 3 PaymentActivity fields the column list doesn't surface.
            // transaction_id is the one an admin actually wants — it's the
            // pi_* / pp_* string you paste into Stripe/PayPal's dashboard.
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 py-2 text-sm">
              <dt className="text-base-content/60">Provider transaction ID</dt>
              <dd className="font-mono">{row.transaction_id as string}</dd>
              <dt className="text-base-content/60">Internal ID</dt>
              <dd className="font-mono">{row.id as string}</dd>
              <dt className="text-base-content/60">Created at</dt>
              <dd className="font-mono">{row.created_at as string}</dd>
            </dl>
          )}
        />
      </section>
    </div>
  );
}

export default AdminPaymentPanel;
