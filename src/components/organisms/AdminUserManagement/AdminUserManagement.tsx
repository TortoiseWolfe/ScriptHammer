'use client';

import React from 'react';
import { AdminStatCard } from '@/components/molecular/AdminStatCard';
import { AdminDataTable } from '@/components/molecular/AdminDataTable';
import type { AdminDataTableColumn } from '@/components/molecular/AdminDataTable';
import type {
  AdminUserStats,
  AdminUserRow,
  UserActivity,
} from '@/services/admin/admin-user-service';

export interface AdminUserManagementProps {
  /** User statistics */
  stats: AdminUserStats | null;
  /** User rows */
  users: AdminUserRow[];
  /** Search-filtered total (for "showing N of M") — omit to hide the count */
  total?: number;
  /** Current search input value */
  searchQuery?: string;
  /** Fires on every search keystroke — debounce happens in the page */
  onSearchChange?: (query: string) => void;
  /** Show loading spinner */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// "3 days ago" reads faster than a timestamp when scanning for dormant accounts.
function relativeLastLogin(iso: string | null): string {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

const activityBadgeClass: Record<UserActivity, string> = {
  active: 'badge badge-success',
  idle: 'badge badge-warning',
  dormant: 'badge badge-ghost',
};

type UserRow = AdminUserRow & Record<string, unknown>;

const columns: AdminDataTableColumn<UserRow>[] = [
  {
    key: 'username',
    label: 'Username',
    sortable: true,
    render: (row) => (row.username as string) || 'N/A',
  },
  {
    key: 'display_name',
    label: 'Display Name',
    sortable: true,
    render: (row) => (row.display_name as string) || 'N/A',
  },
  {
    key: 'activity',
    label: 'Activity',
    sortable: true,
    render: (row) => (
      <span className={activityBadgeClass[row.activity as UserActivity]}>
        {row.activity as string}
      </span>
    ),
  },
  {
    key: 'last_sign_in_at',
    label: 'Last Login',
    sortable: true,
    render: (row) => relativeLastLogin(row.last_sign_in_at as string | null),
  },
  {
    key: 'created_at',
    label: 'Joined',
    sortable: true,
    render: (row) => formatDate(row.created_at as string),
  },
  {
    key: 'welcome_message_sent',
    label: 'Welcome Sent',
    sortable: true,
    render: (row) =>
      row.welcome_message_sent ? (
        <span className="badge badge-success">Yes</span>
      ) : (
        <span className="badge badge-ghost">No</span>
      ),
  },
];

/**
 * AdminUserManagement component - User listing with stats
 *
 * @category organisms
 */
export function AdminUserManagement({
  stats,
  users,
  total,
  searchQuery = '',
  onSearchChange,
  isLoading = false,
  className = '',
  testId,
}: AdminUserManagementProps) {
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

  return (
    <div
      className={`space-y-8${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      {/* Stats Bar */}
      <section aria-labelledby="user-stats-heading">
        <h2 id="user-stats-heading" className="mb-4 text-xl font-semibold">
          User Statistics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Total Users"
            value={stats?.total_users ?? 0}
            testId="stat-total-users"
          />
          <AdminStatCard
            label="Active This Week"
            value={stats?.active_this_week ?? 0}
            testId="stat-active-week"
          />
          <AdminStatCard
            label="Pending Connections"
            value={stats?.pending_connections ?? 0}
            testId="stat-pending-connections"
          />
          <AdminStatCard
            label="Total Connections"
            value={stats?.total_connections ?? 0}
            testId="stat-total-connections"
          />
        </div>
      </section>

      {/* User Table */}
      <section aria-labelledby="user-table-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="user-table-heading" className="text-xl font-semibold">
              User List
            </h2>
            {total !== undefined && (
              <p
                className="text-base-content/60 text-sm"
                data-testid="user-count"
              >
                Showing {users.length} of {total}
              </p>
            )}
          </div>
          {onSearchChange && (
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search username or display name"
              aria-label="Search users"
              className="input input-bordered input-sm w-full max-w-xs"
              data-testid="user-search"
            />
          )}
        </div>
        <AdminDataTable<UserRow>
          columns={columns}
          data={users as UserRow[]}
          emptyMessage="No users found"
          testId="user-table"
        />
      </section>
    </div>
  );
}

export default AdminUserManagement;
