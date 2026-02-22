'use client';

import React from 'react';
import { AdminStatCard } from '@/components/molecular/AdminStatCard';
import type { AdminMessagingStats } from '@/services/admin/admin-messaging-service';

export interface AdminMessagingOverviewProps {
  /** Messaging statistics */
  stats: AdminMessagingStats | null;
  /** Show loading spinner */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * AdminMessagingOverview component - Messaging stats with connection distribution
 *
 * @category organisms
 */
export function AdminMessagingOverview({
  stats,
  isLoading = false,
  className = '',
  testId,
}: AdminMessagingOverviewProps) {
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

  const distribution = stats?.connection_distribution ?? {};
  const distributionEntries = Object.entries(distribution);

  return (
    <div
      className={`space-y-8${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      {/* Stats Bar */}
      <section aria-labelledby="messaging-stats-heading">
        <h2 id="messaging-stats-heading" className="mb-4 text-xl font-semibold">
          Messaging Statistics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Total Conversations"
            value={stats?.total_conversations ?? 0}
            testId="stat-total-conversations"
          />
          <AdminStatCard
            label="Messages This Week"
            value={stats?.messages_this_week ?? 0}
            testId="stat-messages-week"
          />
          <AdminStatCard
            label="Group Chats"
            value={stats?.group_conversations ?? 0}
            testId="stat-group-chats"
          />
          <AdminStatCard
            label="Active Connections"
            value={stats?.active_connections ?? 0}
            testId="stat-active-connections"
          />
        </div>
      </section>

      {/* Connection Distribution */}
      {distributionEntries.length > 0 && (
        <section aria-labelledby="distribution-heading">
          <h2 id="distribution-heading" className="mb-4 text-xl font-semibold">
            Connection Distribution
          </h2>
          <div className="stats stats-vertical bg-base-100 lg:stats-horizontal shadow">
            {distributionEntries.map(([status, count]) => (
              <div key={status} className="stat">
                <div className="stat-title capitalize">{status}</div>
                <div className="stat-value">{count}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Conversation Breakdown */}
      <section aria-labelledby="breakdown-heading">
        <h2 id="breakdown-heading" className="mb-4 text-xl font-semibold">
          Conversation Breakdown
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdminStatCard
            label="Direct Conversations"
            value={stats?.direct_conversations ?? 0}
            testId="stat-direct-conversations"
          />
          <AdminStatCard
            label="Group Conversations"
            value={stats?.group_conversations ?? 0}
            testId="stat-group-conversations"
          />
        </div>
      </section>

      {/* Privacy Notice */}
      <div className="alert alert-info">
        <span>
          Message content is end-to-end encrypted and not accessible to admins.
        </span>
      </div>
    </div>
  );
}

export default AdminMessagingOverview;
