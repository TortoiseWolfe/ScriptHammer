'use client';

import React, { useState } from 'react';
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
  AuditBurst,
} from '@/services/admin/admin-audit-service';

export interface AdminAuditTrailProps {
  /** Authentication/audit statistics */
  stats: AdminAuthStats | null;
  /** Audit log events */
  events: AuditLogEntry[];
  /** Date-ranged burst detection — section hidden when absent */
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

function burstSpanMinutes(b: AuditBurst): number {
  const ms = new Date(b.last_seen).getTime() - new Date(b.first_seen).getTime();
  return Math.max(1, Math.round(ms / 60_000));
}

// 1 distinct user → someone targeting an account. Many → spray.
// The card wording changes because the triage action differs.
function burstKindLabel(b: AuditBurst): string {
  return b.distinct_users <= 1 ? 'Targeted account' : 'Credential spray';
}

// ISO8601 UTC strings sort lexically, so string >= / <= is correct
// without Date parsing. ip_address on AuditLogEntry is nullable;
// AuditBurst.ip_address is not, so the === filters out null for free.
function eventsInBurst(
  events: AuditLogEntry[],
  b: AuditBurst
): AuditLogEntry[] {
  return events.filter(
    (e) =>
      e.ip_address === b.ip_address &&
      e.created_at >= b.first_seen &&
      e.created_at <= b.last_seen
  );
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
  {
    key: 'ip_address',
    label: 'IP Address',
    sortable: true,
    render: (row) => (
      <span className="font-mono text-xs">
        {(row.ip_address as string) || 'N/A'}
      </span>
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
  // Accordion state — keyed the same as the React key so it survives
  // re-ordering if the bursts array ever comes back in a different order.
  const [expandedBurstKey, setExpandedBurstKey] = useState<string | null>(null);
  const toggleBurst = (key: string) => {
    setExpandedBurstKey((prev) => (prev === key ? null : key));
  };

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

      {/* Burst detection — the primary view. Raw event log below is the fallback. */}
      {trends && (
        <section aria-labelledby="audit-bursts-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <h2 id="audit-bursts-heading" className="text-xl font-semibold">
              Failed Login Bursts
            </h2>
            {onRangeChange && (
              <DateRangeFilter
                value={range}
                onChange={onRangeChange}
                testId="audit-range-filter"
              />
            )}
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AdminStatCard
              label="Bursts Detected"
              value={trends.totals?.bursts ?? 0}
              trend={(trends.totals?.bursts ?? 0) > 0 ? 'down' : 'neutral'}
              testId="stat-bursts"
            />
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

          {(trends.bursts ?? []).length > 0 ? (
            <div
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              data-testid="burst-cards"
            >
              {(trends.bursts ?? []).map((b) => {
                const burstKey = `${b.ip_address}-${b.first_seen}`;
                const isExpanded = expandedBurstKey === burstKey;
                const matched = isExpanded ? eventsInBurst(events, b) : [];
                // Card-click is the mouse affordance. The button is the
                // a11y-correct trigger — aria-expanded is valid on button
                // but not on a plain div. Same pattern as AdminDataTable.
                return (
                  <div
                    key={burstKey}
                    className="card border-error bg-error/10 cursor-pointer border p-4"
                    data-testid="burst-card"
                    onClick={() => toggleBurst(burstKey)}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="font-mono text-sm">{b.ip_address}</span>
                      <span className="badge badge-error">
                        {burstKindLabel(b)}
                      </span>
                    </div>
                    <p className="text-error text-2xl font-bold">
                      {b.attempts} attempts
                    </p>
                    <p className="text-base-content text-sm">
                      {b.distinct_users}{' '}
                      {b.distinct_users === 1 ? 'user' : 'users'} ·{' '}
                      {burstSpanMinutes(b)} min span
                    </p>
                    <p className="text-base-content mt-1 text-xs">
                      {formatTime(b.first_seen)} → {formatTime(b.last_seen)}
                    </p>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded
                          ? `Hide events for ${b.ip_address}`
                          : `Show events for ${b.ip_address}`
                      }
                      className="btn btn-ghost btn-sm mt-2 min-h-11 min-w-11 self-start"
                      data-testid="burst-toggle"
                      onClick={(e) => {
                        // Card also listens. Without this the click bubbles
                        // and toggles twice — open then immediately close.
                        e.stopPropagation();
                        toggleBurst(burstKey);
                      }}
                    >
                      <span aria-hidden="true">
                        {isExpanded ? '\u25be' : '\u25b8'} Events
                      </span>
                    </button>
                    {isExpanded && (
                      <div
                        className="border-error/30 mt-3 cursor-default border-t pt-3"
                        data-testid="burst-detail"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-base-content mb-2 text-xs">
                          {matched.length} of {b.attempts} in current log
                        </p>
                        {matched.length > 0 && (
                          <ul className="space-y-1 text-xs">
                            {matched.map((e) => (
                              <li
                                key={e.id}
                                className="flex justify-between gap-2 font-mono"
                                data-testid="burst-event-row"
                              >
                                <span>{formatTime(e.created_at)}</span>
                                <span className="text-base-content">
                                  {formatId(e.user_id)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p
              className="text-base-content text-sm"
              data-testid="burst-empty"
            >
              No bursts detected in this range.
            </p>
          )}
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
              className="select select-bordered select-sm"
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
