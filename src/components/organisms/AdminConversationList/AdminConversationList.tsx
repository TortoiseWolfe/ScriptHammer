'use client';

import React, { useMemo } from 'react';
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from '@/components/molecular/AdminDataTable/AdminDataTable';
import type { AdminConversationRow } from '@/services/admin/admin-messaging-service';

export interface AdminConversationListProps {
  data: AdminConversationRow[];
  /** Total rows server-side — drives the "showing N of M" line and Next. */
  total: number;
  offset: number;
  pageSize: number;
  onPageChange: (nextOffset: number) => void;
  isLoading?: boolean;
  className?: string;
  testId?: string;
}

/**
 * Conversations with no messages in this many ms are flagged stale.
 * "2 months ago" reads the same whether a channel is dormant or dead;
 * the badge is the scannable cue an admin uses to find channels worth
 * pruning without reading every relative-time string. 30 days matches
 * the coarsest REL_UNITS step below 'year' — a conversation tips into
 * "last month" and stale on the same day.
 *
 * Exported for tests/e2e/admin/admin-conversation-list.spec.ts so the
 * spec's seeded timestamp and this threshold can't drift apart.
 */
export const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

// Relative-time formatting for the Last Activity column. Intl handles the
// pluralisation and locale; we just pick the coarsest unit that fits. Beyond
// ~30 days the relative phrasing ("2 months ago") reads more naturally than
// an absolute date in a recency-sorted list, so the formatter goes all the
// way up to years rather than falling back to toLocaleDateString.
const RTF = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const REL_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
];

function relativeTime(iso: string): string {
  const deltaSec = (Date.parse(iso) - Date.now()) / 1000;
  for (const [unit, sec] of REL_UNITS) {
    if (Math.abs(deltaSec) >= sec) {
      return RTF.format(Math.round(deltaSec / sec), unit);
    }
  }
  return RTF.format(Math.round(deltaSec), 'second');
}

// UUIDs are noise in a table — first 8 chars are enough to distinguish rows
// at a glance, and the full value lives in the title= tooltip for copy.
function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/**
 * AdminConversationList — per-conversation metadata drill-down.
 *
 * Presentational wrapper over AdminDataTable. The page owns fetch state
 * and pagination; this component owns column definitions and the
 * prev/next buttons. Server-sorted by last_activity DESC; AdminDataTable's
 * client sort re-orders within the current page only.
 *
 * @category organisms
 */
export function AdminConversationList({
  data,
  total,
  offset,
  pageSize,
  onPageChange,
  isLoading = false,
  className = '',
  testId = 'admin-conversation-list',
}: AdminConversationListProps) {
  const columns = useMemo<AdminDataTableColumn<AdminConversationRow>[]>(
    () => [
      {
        key: 'conversation_id',
        label: 'Conversation',
        render: (row) => (
          <div className="flex items-center gap-2">
            <code
              className="bg-base-200 rounded px-1.5 py-0.5 font-mono text-xs"
              title={row.conversation_id}
            >
              {truncateId(row.conversation_id)}
            </code>
            {row.is_group && (
              <span className="badge badge-sm badge-neutral">group</span>
            )}
          </div>
        ),
      },
      {
        key: 'participant_count',
        label: 'Participants',
        sortable: true,
        render: (row) => (
          <span className="tabular-nums">{row.participant_count}</span>
        ),
      },
      {
        key: 'message_count',
        label: 'Messages',
        sortable: true,
        render: (row) => (
          <span className="tabular-nums">
            {row.message_count.toLocaleString()}
          </span>
        ),
      },
      {
        key: 'last_activity',
        label: 'Last activity',
        sortable: true,
        render: (row) => {
          const stale =
            Date.now() - Date.parse(row.last_activity) > STALE_THRESHOLD_MS;
          return (
            <span
              className="inline-flex items-center gap-2"
              title={new Date(row.last_activity).toLocaleString()}
              data-stale={stale}
            >
              {relativeTime(row.last_activity)}
              {stale && (
                <span className="badge badge-ghost badge-sm">stale</span>
              )}
            </span>
          );
        },
      },
      {
        key: 'created_at',
        label: 'Created',
        sortable: true,
        render: (row) => new Date(row.created_at).toLocaleDateString(),
      },
    ],
    []
  );

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + data.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + pageSize < total;

  return (
    <section
      className={`flex flex-col gap-3 ${className}`.trim()}
      data-testid={testId}
      aria-labelledby={`${testId}-heading`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${testId}-heading`} className="text-xl font-semibold">
          Conversations
        </h2>
        <span
          className="text-base-content/70 text-sm tabular-nums"
          aria-live="polite"
        >
          Showing {from}–{to} of {total.toLocaleString()}
        </span>
      </div>

      <AdminDataTable<AdminConversationRow>
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage="No conversations yet"
        keyField="conversation_id"
        testId={`${testId}-table`}
      />

      <nav
        className="flex items-center justify-end gap-2"
        aria-label="Conversation list pagination"
      >
        <button
          type="button"
          className="btn btn-sm min-h-11"
          disabled={!hasPrev || isLoading}
          onClick={() => onPageChange(Math.max(0, offset - pageSize))}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-sm min-h-11"
          disabled={!hasNext || isLoading}
          onClick={() => onPageChange(offset + pageSize)}
        >
          Next
        </button>
      </nav>
    </section>
  );
}

export default AdminConversationList;
