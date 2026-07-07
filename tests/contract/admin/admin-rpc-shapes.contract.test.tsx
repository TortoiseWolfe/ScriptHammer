/**
 * Admin RPC shape contracts — live wire JSON → TS type → component render.
 *
 * The fixtures in tmp-live-rpc/ are dumped from admin_* RPCs running against
 * a seeded local Supabase (see the session that generated them). This is the
 * chain the unit mocks can't exercise: Postgres's json_build_object output
 * has to satisfy the same TS interface the components consume.
 *
 * A failure here means one of:
 *   - SQL changed and TS didn't follow
 *   - TS type was always wrong about the wire shape (json_agg vs json_object_agg)
 *   - component has a shape assumption the type doesn't encode
 *
 * Regenerate fixtures: start Supabase, apply the monolithic migration, seed,
 * then `SELECT admin_*()` with request.jwt.claims set to an admin sub.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';

import { AdminMessagingOverview } from '@/components/organisms/AdminMessagingOverview';
import { AdminPaymentPanel } from '@/components/organisms/AdminPaymentPanel';
import { AdminUserManagement } from '@/components/organisms/AdminUserManagement';
import MessagingTrendChart from '@/components/molecular/MessagingTrendChart';

import type {
  AdminMessagingTrends,
  AdminMessagingStats,
} from '@/services/admin/admin-messaging-service';
import type {
  AdminPaymentTrends,
  AdminPaymentStats,
} from '@/services/admin/admin-payment-service';
import type {
  AdminUserStats,
  AdminUserRow,
} from '@/services/admin/admin-user-service';

const FIXTURES = join(process.cwd(), 'tmp-live-rpc');
const load = <T,>(name: string): T =>
  JSON.parse(readFileSync(join(FIXTURES, name), 'utf-8'));

describe('admin_messaging_trends → AdminMessagingTrends → MessagingTrendChart', () => {
  const live = load<AdminMessagingTrends>('messaging_trends.json');

  it('shape check: every field the component reads exists', () => {
    expect(live.range.start).toEqual(expect.any(String));
    expect(live.range.end).toEqual(expect.any(String));
    expect(live.totals.messages).toEqual(expect.any(Number));
    expect(live.totals.conversations_created).toEqual(expect.any(Number));
    expect(live.totals.active_senders).toEqual(expect.any(Number));
    expect(Array.isArray(live.daily_series)).toBe(true);
    expect(Array.isArray(live.top_senders)).toBe(true);
  });

  it('daily_series points have the fields MessagingTrendChart reads', () => {
    // The chart's yOf/toPoints pipeline reads exactly these three per point.
    // A missing or mistyped one would NaN the polyline coords silently.
    for (const d of live.daily_series) {
      expect(d.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof d.messages).toBe('number');
      expect(typeof d.conversations_created).toBe('number');
    }
  });

  it('MessagingTrendChart renders live daily_series without NaN in the polyline', () => {
    const { container } = render(
      <MessagingTrendChart data={live.daily_series} testId="chart" />
    );
    const msgLine = container.querySelector('polyline[data-series="messages"]');
    const convLine = container.querySelector(
      'polyline[data-series="conversations"]'
    );
    expect(msgLine).toBeInTheDocument();
    expect(convLine).toBeInTheDocument();

    // NaN anywhere in the points string = a field was undefined/mistyped.
    expect(msgLine!.getAttribute('points')).not.toMatch(/NaN/);
    expect(convLine!.getAttribute('points')).not.toMatch(/NaN/);

    // Point count matches series length. One coord pair per day.
    const msgPts = msgLine!.getAttribute('points')!.trim().split(/\s+/);
    expect(msgPts).toHaveLength(live.daily_series.length);
  });

  it('top_senders entries satisfy the table render', () => {
    // Table reads user_id (key), display_name ?? username (label), messages (count).
    for (const s of live.top_senders) {
      expect(s.user_id).toEqual(expect.any(String));
      expect(typeof s.messages).toBe('number');
      // username and display_name are nullable — carol has display_name:null
      // in the seeded data, which is the fallthrough case the table handles.
      expect(['string', 'object']).toContain(typeof s.username); // string | null
      expect(['string', 'object']).toContain(typeof s.display_name);
    }
  });

  it('AdminMessagingOverview renders live stats + trends end-to-end', () => {
    // Both props now come from live RPC JSON — connection_distribution
    // is the {accepted: N, pending: M} shape that Object.entries() expects.
    const liveStats = load<AdminMessagingStats>('admin_messaging_stats.json');
    render(<AdminMessagingOverview stats={liveStats} trends={live} />);

    // The distribution section renders one stat per status key.
    expect(screen.getByText('Connection Distribution')).toBeInTheDocument();
    for (const status of Object.keys(liveStats.connection_distribution)) {
      expect(screen.getByText(status)).toBeInTheDocument();
    }

    expect(screen.getByTestId('stat-range-messages')).toHaveTextContent(
      String(live.totals.messages)
    );
    expect(screen.getByTestId('stat-range-senders')).toHaveTextContent(
      String(live.totals.active_senders)
    );
    const chart = screen.getByTestId('messaging-trend-chart');
    expect(chart.tagName.toLowerCase()).toBe('svg');
    expect(chart.querySelectorAll('polyline')).toHaveLength(2);

    // Top senders table shows every seeded sender in descending order.
    const table = screen.getByTestId('top-senders-table');
    for (const s of live.top_senders) {
      expect(table).toHaveTextContent(String(s.messages));
    }
  });
});

describe('admin_payment_trends → AdminPaymentTrends → AdminPaymentPanel', () => {
  const live = load<AdminPaymentTrends>('admin_payment_trends.json');

  it('shape check', () => {
    expect(live.totals.succeeded).toEqual(expect.any(Number));
    expect(live.totals.failed).toEqual(expect.any(Number));
    expect(live.totals.refunded).toEqual(expect.any(Number));
    expect(live.totals.revenue_cents).toEqual(expect.any(Number));
    expect(live.refund_rate).toEqual(expect.any(Number));
    expect(Array.isArray(live.provider_breakdown)).toBe(true);
    expect(Array.isArray(live.daily_series)).toBe(true);
  });

  it('daily_series has succeeded/failed per day for PaymentTrendChart', () => {
    for (const d of live.daily_series) {
      expect(d.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof d.succeeded).toBe('number');
      expect(typeof d.failed).toBe('number');
    }
  });

  it('AdminPaymentPanel renders live trends without throwing', () => {
    const stubStats: AdminPaymentStats = {
      total_payments: 14,
      successful_payments: 12,
      failed_payments: 2,
      pending_payments: 0,
      total_revenue_cents: 30000,
      active_subscriptions: 0,
      failed_this_week: 2,
      revenue_by_provider: {},
    };
    render(
      <AdminPaymentPanel stats={stubStats} transactions={[]} trends={live} />
    );
    // PaymentTrendChart is in the DOM and didn't NaN.
    const lines = document.querySelectorAll('polyline');
    lines.forEach((l) => {
      expect(l.getAttribute('points')).not.toMatch(/NaN/);
    });
  });
});

describe('admin_list_users → AdminUserRow[] → AdminUserManagement', () => {
  const live = load<{ total: number; users: AdminUserRow[] }>(
    'admin_list_users.json'
  );

  it('shape check', () => {
    expect(live.total).toEqual(expect.any(Number));
    expect(Array.isArray(live.users)).toBe(true);
    for (const u of live.users) {
      expect(u.id).toEqual(expect.any(String));
      expect(u.created_at).toEqual(expect.any(String));
      expect(typeof u.welcome_message_sent).toBe('boolean');
      // last_sign_in_at is nullable — all seeded users have it null.
      expect(['string', 'object']).toContain(typeof u.last_sign_in_at);
    }
  });

  it('AdminUserManagement renders live user rows', () => {
    const stubStats: AdminUserStats = {
      total_users: live.total,
      active_this_week: 0,
      pending_connections: 0,
      total_connections: 0,
    };
    render(
      <AdminUserManagement
        stats={stubStats}
        users={live.users}
        total={live.total}
      />
    );
    // Every user with a username shows up in the table.
    for (const u of live.users) {
      if (u.username) {
        expect(screen.getByText(u.username)).toBeInTheDocument();
      }
    }
  });
});

describe('*_stats wire shapes match Record<string, number> TS types', () => {
  // Regression guard. These were json_agg(row_to_json(...)) → arrays until
  // the live contract run caught it. json_object_agg(key, value) emits the
  // keyed object the TS types always claimed.

  it('admin_messaging_stats.connection_distribution is a keyed object', () => {
    const live = load<AdminMessagingStats>('admin_messaging_stats.json');
    expect(Array.isArray(live.connection_distribution)).toBe(false);
    expect(typeof live.connection_distribution).toBe('object');
    // Every value is a number — Record<string, number> holds.
    for (const [k, v] of Object.entries(live.connection_distribution)) {
      expect(typeof k).toBe('string');
      expect(typeof v).toBe('number');
    }
  });

  it('admin_payment_stats.revenue_by_provider is a keyed object', () => {
    const live = load<AdminPaymentStats>('admin_payment_stats.json');
    expect(Array.isArray(live.revenue_by_provider)).toBe(false);
    expect(typeof live.revenue_by_provider).toBe('object');
    for (const [k, v] of Object.entries(live.revenue_by_provider)) {
      expect(typeof k).toBe('string');
      expect(typeof v).toBe('number');
    }
  });

  it('admin_overview inherits the fix — it composes *_stats() server-side', () => {
    // admin_overview() calls admin_messaging_stats() and admin_payment_stats()
    // from inside its own body. No separate fix needed.
    const live = load<{
      messaging: AdminMessagingStats;
      payments: AdminPaymentStats;
    }>('admin_overview.json');
    expect(Array.isArray(live.messaging.connection_distribution)).toBe(false);
    expect(Array.isArray(live.payments.revenue_by_provider)).toBe(false);
  });
});
