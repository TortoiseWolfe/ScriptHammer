'use client';

import React from 'react';
import { AdminStatCard } from '@/components/molecular/AdminStatCard';
import { AdminDataTable } from '@/components/molecular/AdminDataTable';
import type { AdminDataTableColumn } from '@/components/molecular/AdminDataTable';
import Pagination from '@/components/molecular/Pagination';
import DateRangeFilter, {
  type DateRange,
} from '@/components/molecular/DateRangeFilter';
import MessagingTrendChart from '@/components/molecular/MessagingTrendChart';
import type {
  AdminMessagingStats,
  AdminMessagingTrends,
  AdminConversationRow,
} from '@/services/admin/admin-messaging-service';

export interface AdminMessagingOverviewProps {
  /** Messaging statistics */
  stats: AdminMessagingStats | null;
  /** Date-ranged volume trends — when absent the whole trends section hides */
  trends?: AdminMessagingTrends | null;
  /** Controlled range for the filter */
  range?: DateRange;
  /** Fires when the date filter changes — omit to hide the filter */
  onRangeChange?: (range: DateRange) => void;
  /** Paginated conversation list (metadata only) — when absent the section hides */
  conversations?: AdminConversationRow[];
  /** Total conversation count for pagination */
  conversationTotal?: number;
  /** Current conversation list page (0-indexed) */
  conversationPage?: number;
  /** Fires when conversation page changes */
  onConversationPageChange?: (page: number) => void;
  /** Search query for conversations */
  conversationSearch?: string;
  /** Fires on conversation search input */
  onConversationSearchChange?: (query: string) => void;
  /** Show loading spinner */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatParticipants(row: AdminConversationRow): string {
  if (row.is_group) {
    return row.group_name || `Group (${row.participant_count} members)`;
  }
  if (!row.participants || row.participants.length < 2) return 'Unknown';
  const name = (p: { display_name: string | null; username: string | null }) =>
    p.display_name || p.username || 'N/A';
  return `${name(row.participants[0])} \u2194 ${name(row.participants[1])}`;
}

type ConvRow = AdminConversationRow & Record<string, unknown>;

const conversationColumns: AdminDataTableColumn<ConvRow>[] = [
  {
    key: 'is_group',
    label: 'Type',
    sortable: true,
    render: (row) => (
      <span
        className={
          row.is_group ? 'badge badge-secondary badge-sm' : 'badge badge-primary badge-sm'
        }
      >
        {row.is_group ? 'Group' : 'Direct'}
      </span>
    ),
  },
  {
    key: 'participants',
    label: 'Participants',
    render: (row) => formatParticipants(row as unknown as AdminConversationRow),
  },
  {
    key: 'message_count',
    label: 'Messages',
    sortable: true,
    render: (row) => (
      <span className="font-mono">{row.message_count as number}</span>
    ),
  },
  {
    key: 'last_message_at',
    label: 'Last Activity',
    sortable: true,
    render: (row) => relativeTime(row.last_message_at as string | null),
  },
  {
    key: 'created_at',
    label: 'Created',
    sortable: true,
    render: (row) => formatDate(row.created_at as string),
  },
];

/**
 * AdminMessagingOverview component - Messaging stats with connection distribution
 *
 * @category organisms
 */
export function AdminMessagingOverview({
  stats,
  trends,
  range,
  onRangeChange,
  conversations,
  conversationTotal,
  conversationPage = 0,
  onConversationPageChange,
  conversationSearch = '',
  onConversationSearchChange,
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

      {/* Conversation List — metadata only, no message content */}
      {conversations && (
        <section aria-labelledby="conversation-list-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="conversation-list-heading"
                className="text-xl font-semibold"
              >
                Conversation List
              </h2>
              {conversationTotal !== undefined && (
                <p
                  className="text-base-content text-sm"
                  data-testid="conversation-count"
                >
                  Showing {conversations.length} of {conversationTotal}
                </p>
              )}
            </div>
            {onConversationSearchChange && (
              <input
                type="search"
                value={conversationSearch}
                onChange={(e) => onConversationSearchChange(e.target.value)}
                placeholder="Search participants or group name"
                aria-label="Search conversations"
                className="input input-bordered input-sm w-full max-w-xs"
                data-testid="conversation-search"
              />
            )}
          </div>
          <AdminDataTable<ConvRow>
            columns={conversationColumns}
            data={(conversations ?? []) as ConvRow[]}
            emptyMessage="No conversations found"
            testId="conversation-table"
          />
          {onConversationPageChange && conversationTotal !== undefined && (
            <Pagination
              currentPage={conversationPage}
              totalItems={conversationTotal}
              pageSize={25}
              onPageChange={onConversationPageChange}
              testId="conversation-pagination"
            />
          )}
        </section>
      )}

      {/* Volume Trends — count and trend, not decrypt and display.
          Sits directly above the privacy notice so the "what you CAN see"
          and "what you CANNOT see" land as one unit. */}
      {trends && (
        <section aria-labelledby="messaging-trends-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <h2 id="messaging-trends-heading" className="text-xl font-semibold">
              Volume Trends
            </h2>
            {onRangeChange && (
              <DateRangeFilter
                value={range}
                onChange={onRangeChange}
                testId="messaging-range-filter"
              />
            )}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AdminStatCard
              label="Messages"
              value={trends.totals?.messages ?? 0}
              testId="stat-range-messages"
            />
            <AdminStatCard
              label="Conversations Created"
              value={trends.totals?.conversations_created ?? 0}
              testId="stat-range-convs"
            />
            <AdminStatCard
              label="Active Senders"
              value={trends.totals?.active_senders ?? 0}
              testId="stat-range-senders"
            />
          </div>

          <MessagingTrendChart
            data={trends.daily_series ?? []}
            className="text-base-content mb-6"
            testId="messaging-trend-chart"
          />

          <h3 className="mb-2 text-lg font-semibold">Top Senders</h3>
          {(trends.top_senders ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table-sm table" data-testid="top-senders-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th className="text-right">Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {(trends.top_senders ?? []).map((s) => (
                    <tr key={s.user_id}>
                      <td>
                        <div className="font-medium">
                          {s.display_name ?? s.username ?? 'N/A'}
                        </div>
                        {s.username && s.display_name && (
                          <div className="text-base-content text-xs">
                            @{s.username}
                          </div>
                        )}
                      </td>
                      <td className="text-right font-mono">{s.messages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p
              className="text-base-content text-sm"
              data-testid="top-senders-empty"
            >
              No messages in this range.
            </p>
          )}
        </section>
      )}

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
