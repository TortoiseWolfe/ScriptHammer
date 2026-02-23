'use client';

import React from 'react';
import { AdminStatCard } from '@/components/molecular/AdminStatCard';
import { AdminDataTable } from '@/components/molecular/AdminDataTable';
import type { AdminDataTableColumn } from '@/components/molecular/AdminDataTable';
import type {
  AdminUserStats,
  AdminUserRow,
} from '@/services/admin/admin-user-service';

export interface AdminUserManagementProps {
  /** User statistics */
  stats: AdminUserStats | null;
  /** User rows */
  users: AdminUserRow[];
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
        <h2 id="user-table-heading" className="mb-4 text-xl font-semibold">
          User List
        </h2>
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
