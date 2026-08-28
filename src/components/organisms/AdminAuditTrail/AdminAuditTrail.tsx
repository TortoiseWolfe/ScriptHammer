'use client';

import React from 'react';
import { AdminStatCard } from '@/components/molecular/AdminStatCard';
import { AdminDataTable } from '@/components/molecular/AdminDataTable';
import DateRangeFilter, {
  type DateRange,
} from '@/components/molecular/DateRangeFilter';
import type { AdminDataTableColumn } from '@/components/molecular/AdminDataTable';
import type {
  AdminAuthStats,
  AuditLogEntry,
  AdminAuditTrends,
} from '@/services/admin/admin-audit-service';

export interface AdminAuditTrailProps {
  /** Authentication/audit statistics */
  stats: AdminAuthStats | null;
  /** Audit log events */
  events: AuditLogEntry[];
  /** Date-ranged sign-in totals and series — section hidden when absent */
  trends?: AdminAuditTrends | null;
  /** Current date range for the filter */
  range?: DateRange;
  /** Fires when the user changes the date range */
  onRangeChange?: (range: DateRange) => void;
  /** Show loading spinner */
  isLoading?: boolean;
  /** Current event type filter */
  eventTypeFilter?: string;
  /** Callback when event type filter changes */
  onEventTypeChange?: (type: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

const EVENT_TYPES = [
  'sign_in_success',
  'sign_in_failed',
  'sign_up',
  'sign_out',
  'password_change',
  'password_reset',
  'email_change',
  'mfa_challenge',
  'token_refresh',
];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatId(id: string | null): string {
  if (!id) return 'N/A';
  return id;
}

type EventRow = AuditLogEntry & Record<string, unknown>;

const columns: AdminDataTableColumn<EventRow>[] = [
  {
    key: 'created_at',
    label: 'Time',
    sortable: true,
    render: (row) => formatTime(row.created_at as string),
  },
  {
    key: 'event_type',
    label: 'Event Type',
    sortable: true,
    render: (row) => (
      <span className="badge badge-outline">{row.event_type as string}</span>
    ),
  },
  {
    key: 'user_id',
    label: 'User ID',
    sortable: true,
    render: (row) => (
      <span className="font-mono text-xs">
        {formatId(row.user_id as string | null)}
      </span>
    ),
  },
  {
    key: 'success',
    label: 'Success',
    sortable: true,
    render: (row) =>
      row.success ? (
        <span className="badge badge-success">Yes</span>
      ) : (
        <span className="badge badge-error">No</span>
      ),
  },
];

/**
 * AdminAuditTrail component - Audit event log with stats and anomaly detection
 *
 * @category organisms
 */
export function AdminAuditTrail({
  stats,
  events,
  trends,
  range,
  onRangeChange,
  isLoading = false,
  eventTypeFilter = '',
  onEventTypeChange,
  className = '',
  testId,
}: AdminAuditTrailProps) {
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
      <section aria-labelledby="audit-stats-heading">
        <h2 id="audit-stats-heading" className="mb-4 text-xl font-semibold">
          Authentication Statistics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Logins Today"
            value={stats?.logins_today ?? 0}
            testId="stat-logins-today"
          />
          <AdminStatCard
            label="Failed This Week"
            value={stats?.failed_this_week ?? 0}
            trend={stats && stats.failed_this_week > 0 ? 'down' : undefined}
            testId="stat-failed-week"
          />
          <AdminStatCard
            label="Rate Limited"
            value={stats?.rate_limited_users ?? 0}
            testId="stat-rate-limited"
          />
          <AdminStatCard
            label="Signups (30d)"
            value={stats?.signups_this_month ?? 0}
            trend="up"
            testId="stat-signups"
          />
        </div>
      </section>

      {/* Sign-in activity over the selected range.
          This was the "Failed Login Bursts" section until #839. The IP-keyed burst panel
          was removed because nothing ever wrote an ip_address: production carried 7440
          rows in auth_audit_logs and ZERO with an IP, GoTrue emits no failed-login event,
          and a static-export app has no server-side place to observe a client IP honestly
          (a browser-reported one is set by the very attacker the panel would detect).
          The range filter and the two range totals lived INSIDE that section and are real,
          so the section stays and carries them. */}
      {trends && (
        <section aria-labelledby="audit-range-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <h2 id="audit-range-heading" className="text-xl font-semibold">
              Sign-in Activity
            </h2>
            {onRangeChange && (
              <DateRangeFilter
                value={range}
                onChange={onRangeChange}
                testId="audit-range-filter"
              />
            )}
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AdminStatCard
              label="Failed Sign-ins"
              value={trends.totals?.sign_in_failed ?? 0}
              testId="stat-range-failed"
            />
            <AdminStatCard
              label="Successful Sign-ins"
              value={trends.totals?.sign_in_success ?? 0}
              testId="stat-range-success"
            />
          </div>
        </section>
      )}

      {/* Event Type Filter */}
      <section aria-labelledby="event-filter-heading">
        <h2 id="event-filter-heading" className="mb-4 text-xl font-semibold">
          Event Log
        </h2>
        {onEventTypeChange && (
          <div className="mb-4">
            <label
              htmlFor="event-type-filter"
              className="mr-2 text-sm font-medium"
            >
              Filter by event type:
            </label>
            <select
              id="event-type-filter"
              className="select select-sm"
              value={eventTypeFilter}
              onChange={(e) => onEventTypeChange(e.target.value)}
              data-testid="event-type-filter"
            >
              <option value="">All Events</option>
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        )}
        <AdminDataTable<EventRow>
          columns={columns}
          data={events as EventRow[]}
          emptyMessage="No audit events found"
          testId="audit-events-table"
        />
      </section>

      {/* Anomaly Alerts */}
      {stats?.top_failed_logins && stats.top_failed_logins.length > 0 && (
        <section aria-labelledby="anomaly-heading">
          <h2 id="anomaly-heading" className="mb-4 text-xl font-semibold">
            Anomaly Alerts
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.top_failed_logins.map((entry) => (
              <div
                key={entry.user_id}
                className="card bg-warning/10 border-warning border p-4"
              >
                <p className="font-mono text-sm">{formatId(entry.user_id)}</p>
                <p className="text-warning text-lg font-bold">
                  {entry.attempts} failed attempts
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Retention Notice */}
      <p className="text-base-content text-sm">
        Audit logs are retained for 90 days.
      </p>
    </div>
  );
}

export default AdminAuditTrail;
