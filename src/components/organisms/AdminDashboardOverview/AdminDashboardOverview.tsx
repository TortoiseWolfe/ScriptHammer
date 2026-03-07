'use client';

import React from 'react';
import { AdminStatCard } from '@/components/molecular/AdminStatCard';
import {
  AdminTrendChart,
  type ChartColorToken,
} from '@/components/molecular/AdminTrendChart';
import { DateRangePicker } from '@/components/molecular/DateRangePicker';
import type { DateRange } from '@/components/molecular/DateRangePicker';
import type {
  AdminOverview,
  OverviewTrendPoint,
} from '@/services/admin/admin-overview-service';
import type { AdminPaymentStats } from '@/services/admin/admin-payment-service';
import type { AdminAuthStats } from '@/services/admin/admin-audit-service';
import type { AdminMessagingStats } from '@/services/admin/admin-messaging-service';

export interface AdminDashboardOverviewProps {
  /** Composite overview from admin_overview(). Null during initial load. */
  overview: AdminOverview | null;
  /**
   * Trend window. When absent the RPC's server-side default (7 days) is in
   * effect and the titles say so. When present, the span between `from` and
   * `to` labels all four sparklines — the stat cards above them are all-time
   * counters from the `_stats()` sub-RPCs and don't move with the window.
   */
  dateRange?: DateRange;
  /** Picker edits land here. Both this and `dateRange` must be set for the picker to mount. */
  onDateRangeChange?: (range: DateRange) => void;
  /** Full-page spinner. */
  isLoading?: boolean;
  className?: string;
  testId?: string;
}

// ─── Attention scoring ────────────────────────────────────────────────────
// The whole point of the overview rewrite: problems float. Each domain gets
// an `ok | warn | alert` level plus human-readable reasons. Sections sort
// by level descending; reasons feed the banner at the top. Thresholds below
// are first-pass guesses — tune once production traffic gives real baselines.

type Domain = 'payments' | 'auth' | 'users' | 'messaging';
type AttentionLevel = 'ok' | 'warn' | 'alert';

interface Attention {
  level: AttentionLevel;
  reasons: string[];
}

const LEVEL_RANK: Record<AttentionLevel, number> = { alert: 2, warn: 1, ok: 0 };

function scorePayments(s: AdminPaymentStats): Attention {
  const reasons: string[] = [];
  let level: AttentionLevel = 'ok';

  // Success rate is the headline. Rate only meaningful with a sample; a
  // single failed payment on a quiet day shouldn't scream alert.
  if (s.total_payments >= 10) {
    const rate = s.successful_payments / s.total_payments;
    if (rate < 0.9) {
      level = 'alert';
      reasons.push(`Payment success rate ${Math.round(rate * 100)}%`);
    } else if (rate < 0.95) {
      level = 'warn';
      reasons.push(`Payment success rate ${Math.round(rate * 100)}%`);
    }
  }

  if (s.failed_this_week > 0) {
    if (level === 'ok') level = 'warn';
    reasons.push(
      `${s.failed_this_week} failed payment${s.failed_this_week === 1 ? '' : 's'} this week`
    );
  }

  return { level, reasons };
}

function scoreAuth(s: AdminAuthStats): Attention {
  const reasons: string[] = [];
  let level: AttentionLevel = 'ok';

  // Rate-limit lockout is present-tense: someone is locked out right now.
  // That's an active incident, not a historical trend — alert regardless of
  // count.
  if (s.rate_limited_users > 0) {
    level = 'alert';
    reasons.push(
      `${s.rate_limited_users} user${s.rate_limited_users === 1 ? '' : 's'} rate-limited right now`
    );
  }

  // Failed-login volume. 50/week is "someone's running a credential list";
  // 10/week is "worth a glance".
  if (s.failed_this_week >= 50) {
    if (level !== 'alert') level = 'alert';
    reasons.push(`${s.failed_this_week} failed login attempts this week`);
  } else if (s.failed_this_week >= 10) {
    if (level === 'ok') level = 'warn';
    reasons.push(`${s.failed_this_week} failed login attempts this week`);
  }

  return { level, reasons };
}

function scoreMessaging(s: AdminMessagingStats): Attention {
  const reasons: string[] = [];
  let level: AttentionLevel = 'ok';

  // Blocks are user-managed and normal in small numbers. Only flag when the
  // blocked share is high enough to suggest a platform-wide problem (spam
  // wave, harassment ring) rather than individual disputes.
  const total = s.blocked_connections + s.active_connections;
  if (s.blocked_connections > 0 && total > 0) {
    const blockRate = s.blocked_connections / total;
    if (blockRate > 0.1) {
      level = 'warn';
      reasons.push(
        `${s.blocked_connections} blocked connection${s.blocked_connections === 1 ? '' : 's'} (${Math.round(blockRate * 100)}% of total)`
      );
    }
  }

  return { level, reasons };
}

// Users has no present-tense failure signal. Pending connections are a
// backlog, not an incident. If a future metric (e.g. mass deletions,
// banned-user count) shows up, score it here.
function scoreUsers(): Attention {
  return { level: 'ok', reasons: [] };
}

// ─── Layout ───────────────────────────────────────────────────────────────

// ISO day → local-midnight short label. new Date('YYYY-MM-DD') parses as UTC
// midnight and renders as yesterday for anyone west of UTC.
function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface SectionDescriptor {
  domain: Domain;
  title: string;
  href: string;
  attention: Attention;
  cards: Array<{
    label: string;
    value: string | number;
    testId: string;
    trend?: 'up' | 'down';
  }>;
  trend: OverviewTrendPoint[];
  trendTitle: string;
  colorToken: ChartColorToken;
}

const LEVEL_BADGE: Record<AttentionLevel, string | null> = {
  alert: 'badge-error',
  warn: 'badge-warning',
  ok: null, // don't clutter healthy sections
};

const LEVEL_LABEL: Record<AttentionLevel, string> = {
  alert: 'alert',
  warn: 'attention',
  ok: '',
};

/**
 * AdminDashboardOverview — attention-sorted landing page for /admin.
 *
 * Takes one composite `overview` prop (one RPC, not four). Computes per-domain
 * attention scores client-side, sorts sections so problems surface first, and
 * renders an alert banner summarising anything above `ok`. Each domain gets a
 * 7-day trend chart so direction-of-travel is visible without clicking through.
 *
 * @category organisms
 */
export function AdminDashboardOverview({
  overview,
  dateRange,
  onDateRangeChange,
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

  // Null overview → still render the grid skeleton with zeros, same as the
  // four-prop version did. Lets the page settle visually before data arrives.
  const p = overview?.payments ?? null;
  const a = overview?.auth ?? null;
  const u = overview?.users ?? null;
  const m = overview?.messaging ?? null;
  const trends = overview?.trends;

  const successRate =
    p && p.total_payments > 0
      ? Math.round((p.successful_payments / p.total_payments) * 100) + '%'
      : '0%';

  // Window label for the four trend titles. Falls back to 7 when no range is
  // wired (server default) or when a bound is null (user cleared an input —
  // the RPC will COALESCE on its side but we can't know to what from here).
  // Can't derive this from trends.*.length: the RPC skips zero-activity days,
  // so a quiet 30-day window might return 4 rows.
  const windowDays =
    dateRange?.from && dateRange?.to
      ? Math.round(
          (dateRange.to.getTime() - dateRange.from.getTime()) / 86_400_000
        )
      : 7;
  const windowLabel = `(${windowDays}d)`;

  // Build descriptors in canonical order. Sort happens after; canonical order
  // is the tiebreaker so the page doesn't shuffle when everything is green.
  const sections: SectionDescriptor[] = [
    {
      domain: 'payments',
      title: 'Payments',
      href: '/admin/payments',
      attention: p ? scorePayments(p) : { level: 'ok', reasons: [] },
      cards: [
        { label: 'Total Payments', value: p?.total_payments ?? 0, testId: 'stat-total-payments' },
        { label: 'Success Rate', value: successRate, testId: 'stat-success-rate' },
        { label: 'Active Subscriptions', value: p?.active_subscriptions ?? 0, testId: 'stat-active-subscriptions' },
        {
          label: 'Failed This Week',
          value: p?.failed_this_week ?? 0,
          testId: 'stat-payment-failed',
          trend: p && p.failed_this_week > 0 ? 'down' : undefined,
        },
      ],
      trend: trends?.payments_daily ?? [],
      trendTitle: `Payments ${windowLabel}`,
      // Money → green is the convention everyone already reads correctly.
      colorToken: 'success',
    },
    {
      domain: 'auth',
      title: 'Authentication',
      href: '/admin/audit',
      attention: a ? scoreAuth(a) : { level: 'ok', reasons: [] },
      cards: [
        { label: 'Logins Today', value: a?.logins_today ?? 0, testId: 'stat-logins-today' },
        {
          label: 'Failed This Week',
          value: a?.failed_this_week ?? 0,
          testId: 'stat-auth-failed',
          trend: a && a.failed_this_week > 0 ? 'down' : undefined,
        },
        { label: 'Rate Limited', value: a?.rate_limited_users ?? 0, testId: 'stat-rate-limited' },
        { label: 'New Signups 30d', value: a?.signups_this_month ?? 0, testId: 'stat-signups', trend: 'up' },
      ],
      trend: trends?.logins_daily ?? [],
      trendTitle: `Logins ${windowLabel}`,
      colorToken: 'info',
    },
    {
      domain: 'users',
      title: 'Users',
      href: '/admin/users',
      attention: scoreUsers(),
      cards: [
        { label: 'Total Users', value: u?.total_users ?? 0, testId: 'stat-total-users' },
        { label: 'Active This Week', value: u?.active_this_week ?? 0, testId: 'stat-active-week' },
        { label: 'Pending Connections', value: u?.pending_connections ?? 0, testId: 'stat-pending-connections' },
        { label: 'Total Connections', value: u?.total_connections ?? 0, testId: 'stat-total-connections' },
      ],
      trend: trends?.signups_daily ?? [],
      trendTitle: `Signups ${windowLabel}`,
      colorToken: 'secondary',
    },
    {
      domain: 'messaging',
      title: 'Messaging',
      href: '/admin/messaging',
      attention: m ? scoreMessaging(m) : { level: 'ok', reasons: [] },
      cards: [
        { label: 'Conversations', value: m?.total_conversations ?? 0, testId: 'stat-conversations' },
        { label: 'Messages This Week', value: m?.messages_this_week ?? 0, testId: 'stat-messages-week' },
        { label: 'Group Chats', value: m?.group_conversations ?? 0, testId: 'stat-group-chats' },
        { label: 'Active Connections', value: m?.active_connections ?? 0, testId: 'stat-active-connections' },
      ],
      trend: trends?.messages_daily ?? [],
      trendTitle: `Messages ${windowLabel}`,
      colorToken: 'primary',
    },
  ];

  // Stable sort: alert > warn > ok, canonical order within a tier. Array.sort
  // is stable in every engine we target, so the canonical build order above is
  // the tiebreak for free.
  const sorted = [...sections].sort(
    (x, y) => LEVEL_RANK[y.attention.level] - LEVEL_RANK[x.attention.level]
  );

  // Banner content: every reason from every non-ok section, grouped by domain
  // title. Uses sorted order so the banner's top line matches the top section.
  const attentionItems = sorted.filter((s) => s.attention.level !== 'ok');

  return (
    <div
      className={`space-y-8${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      {dateRange && onDateRangeChange && (
        <DateRangePicker
          value={dateRange}
          onChange={onDateRangeChange}
          testId="overview-range"
        />
      )}

      {attentionItems.length > 0 && (
        <div
          className="alert alert-warning items-start"
          role="status"
          data-testid="attention-banner"
        >
          <div>
            <h3 className="font-semibold">Needs attention</h3>
            <ul className="mt-1 list-inside list-disc text-sm">
              {attentionItems.flatMap((s) =>
                s.attention.reasons.map((r, i) => (
                  <li key={`${s.domain}-${i}`}>
                    <span className="font-medium">{s.title}:</span> {r}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {sorted.map((s) => {
        const badgeClass = LEVEL_BADGE[s.attention.level];
        return (
          <section
            key={s.domain}
            aria-labelledby={`${s.domain}-heading`}
            data-domain={s.domain}
            data-attention={s.attention.level}
          >
            <div className="mb-4 flex items-center gap-3">
              <h2 id={`${s.domain}-heading`} className="text-xl font-semibold">
                {s.title}
              </h2>
              {badgeClass && (
                <span className={`badge ${badgeClass}`}>
                  {LEVEL_LABEL[s.attention.level]}
                </span>
              )}
              <a
                href={s.href}
                className="link link-hover ml-auto text-sm"
                data-testid={`link-${s.domain}`}
              >
                View details →
              </a>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="grid grid-cols-2 gap-4 lg:col-span-2">
                {s.cards.map((c, i) => (
                  <AdminStatCard
                    key={c.testId}
                    label={c.label}
                    value={c.value}
                    trend={c.trend}
                    href={i === 0 ? s.href : undefined}
                    testId={c.testId}
                  />
                ))}
              </div>
              <AdminTrendChart
                data={s.trend.map((pt) => ({
                  label: formatDayLabel(pt.day),
                  value: pt.count,
                }))}
                title={s.trendTitle}
                colorToken={s.colorToken}
                testId={`trend-${s.domain}`}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default AdminDashboardOverview;
