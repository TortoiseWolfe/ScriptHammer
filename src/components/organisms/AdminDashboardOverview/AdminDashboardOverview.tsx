'use client';

import React from 'react';
import { AdminStatCard } from '@/components/molecular/AdminStatCard';
import type { AdminPaymentStats } from '@/services/admin/admin-payment-service';
import type { AdminAuthStats } from '@/services/admin/admin-audit-service';
import type { AdminUserStats } from '@/services/admin/admin-user-service';
import type { AdminMessagingStats } from '@/services/admin/admin-messaging-service';

export interface AdminDashboardOverviewProps {
  /** Payment statistics */
  paymentStats: AdminPaymentStats | null;
  /** Authentication/audit statistics */
  authStats: AdminAuthStats | null;
  /** User statistics */
  userStats: AdminUserStats | null;
  /** Messaging statistics */
  messagingStats: AdminMessagingStats | null;
  /** Show loading spinner */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * AdminDashboardOverview component - Displays 4-domain stat card grid
 *
 * @category organisms
 */
export function AdminDashboardOverview({
  paymentStats,
  authStats,
  userStats,
  messagingStats,
  isLoading = false,
  className = '',
  testId,
}: AdminDashboardOverviewProps) {
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
    paymentStats && paymentStats.total_payments > 0
      ? Math.round(
          (paymentStats.successful_payments / paymentStats.total_payments) * 100
        ) + '%'
      : '0%';

  return (
    <div
      className={`space-y-8${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      {/* Payments Section */}
      <section aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="mb-4 text-xl font-semibold">
          Payments
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Total Payments"
            value={paymentStats?.total_payments ?? 0}
            href="/admin/payments"
            testId="stat-total-payments"
          />
          <AdminStatCard
            label="Success Rate"
            value={successRate}
            testId="stat-success-rate"
          />
          <AdminStatCard
            label="Active Subscriptions"
            value={paymentStats?.active_subscriptions ?? 0}
            testId="stat-active-subscriptions"
          />
          <AdminStatCard
            label="Failed This Week"
            value={paymentStats?.failed_this_week ?? 0}
            trend={
              paymentStats && paymentStats.failed_this_week > 0
                ? 'down'
                : undefined
            }
            testId="stat-payment-failed"
          />
        </div>
      </section>

      {/* Authentication Section */}
      <section aria-labelledby="auth-heading">
        <h2 id="auth-heading" className="mb-4 text-xl font-semibold">
          Authentication
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Logins Today"
            value={authStats?.logins_today ?? 0}
            href="/admin/audit"
            testId="stat-logins-today"
          />
          <AdminStatCard
            label="Failed This Week"
            value={authStats?.failed_this_week ?? 0}
            trend={
              authStats && authStats.failed_this_week > 0 ? 'down' : undefined
            }
            testId="stat-auth-failed"
          />
          <AdminStatCard
            label="Rate Limited"
            value={authStats?.rate_limited_users ?? 0}
            testId="stat-rate-limited"
          />
          <AdminStatCard
            label="New Signups 30d"
            value={authStats?.signups_this_month ?? 0}
            trend="up"
            testId="stat-signups"
          />
        </div>
      </section>

      {/* Users Section */}
      <section aria-labelledby="users-heading">
        <h2 id="users-heading" className="mb-4 text-xl font-semibold">
          Users
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Total Users"
            value={userStats?.total_users ?? 0}
            href="/admin/users"
            testId="stat-total-users"
          />
          <AdminStatCard
            label="Active This Week"
            value={userStats?.active_this_week ?? 0}
            testId="stat-active-week"
          />
          <AdminStatCard
            label="Pending Connections"
            value={userStats?.pending_connections ?? 0}
            testId="stat-pending-connections"
          />
          <AdminStatCard
            label="Total Connections"
            value={userStats?.total_connections ?? 0}
            testId="stat-total-connections"
          />
        </div>
      </section>

      {/* Messaging Section */}
      <section aria-labelledby="messaging-heading">
        <h2 id="messaging-heading" className="mb-4 text-xl font-semibold">
          Messaging
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Conversations"
            value={messagingStats?.total_conversations ?? 0}
            href="/admin/messaging"
            testId="stat-conversations"
          />
          <AdminStatCard
            label="Messages This Week"
            value={messagingStats?.messages_this_week ?? 0}
            testId="stat-messages-week"
          />
          <AdminStatCard
            label="Group Chats"
            value={messagingStats?.group_conversations ?? 0}
            testId="stat-group-chats"
          />
          <AdminStatCard
            label="Active Connections"
            value={messagingStats?.active_connections ?? 0}
            testId="stat-active-connections"
          />
        </div>
      </section>
    </div>
  );
}

export default AdminDashboardOverview;
