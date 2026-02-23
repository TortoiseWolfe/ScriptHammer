'use client';

import React from 'react';
import { AdminStatCard } from '@/components/molecular/AdminStatCard';
import { AdminDataTable } from '@/components/molecular/AdminDataTable';
import type { AdminDataTableColumn } from '@/components/molecular/AdminDataTable';
import type { AdminPaymentStats } from '@/services/admin/admin-payment-service';
import type { PaymentActivity } from '@/types/payment';

export interface AdminPaymentPanelProps {
  /** Payment statistics */
  stats: AdminPaymentStats | null;
  /** Recent transactions */
  transactions: PaymentActivity[];
  /** Show loading spinner */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
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
        />
      </section>
    </div>
  );
}

export default AdminPaymentPanel;
