/**
 * AdminOverviewService unit tests
 *
 * The composite shape re-uses the four *Stats types. If someone changes
 * AdminPaymentStats (say, drops total_payments), this fixture stops
 * compiling — the type system is the regression test for "composite stays
 * in sync with individual stats contracts."
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AdminOverviewService,
  type AdminOverview,
} from '@/services/admin/admin-overview-service';

function mockClient(rpcImpl: ReturnType<typeof vi.fn>) {
  return { rpc: rpcImpl } as unknown as SupabaseClient;
}

const sample: AdminOverview = {
  range: {
    start: '2026-02-28T00:00:00+00:00',
    end: '2026-03-06T00:00:00+00:00',
  },
  payments: {
    total_payments: 1203,
    successful_payments: 1150,
    failed_payments: 40,
    pending_payments: 13,
    total_revenue_cents: 4_820_000,
    active_subscriptions: 87,
    failed_this_week: 3,
    revenue_by_provider: { stripe: 3_200_000, paypal: 1_620_000 },
  },
  auth: {
    logins_today: 42,
    failed_this_week: 18,
    signups_this_month: 29,
    rate_limited_users: 1,
    top_failed_logins: [],
  },
  users: {
    total_users: 200,
    active_this_week: 85,
    pending_connections: 7,
    total_connections: 120,
  },
  messaging: {
    total_conversations: 60,
    group_conversations: 15,
    direct_conversations: 45,
    messages_this_week: 847,
    active_connections: 90,
    blocked_connections: 3,
    connection_distribution: { accepted: 90, pending: 12, blocked: 3 },
  },
  sparks: {
    payments: [12, 15, 9, 18, 14, 20, 17],
    logins: [40, 38, 45, 42, 50, 48, 42],
    signups: [2, 0, 1, 3, 0, 0, 1],
    messages: [110, 98, 134, 122, 101, 140, 142],
  },
  trends: {
    payments_daily: [
      { day: '2026-02-28', count: 12 },
      { day: '2026-03-01', count: 15 },
      { day: '2026-03-02', count: 9 },
      { day: '2026-03-03', count: 18 },
      { day: '2026-03-04', count: 14 },
      { day: '2026-03-05', count: 20 },
      { day: '2026-03-06', count: 17 },
    ],
    logins_daily: [
      { day: '2026-02-28', count: 40 },
      { day: '2026-03-01', count: 38 },
      { day: '2026-03-02', count: 45 },
      { day: '2026-03-03', count: 42 },
      { day: '2026-03-04', count: 50 },
      { day: '2026-03-05', count: 48 },
      { day: '2026-03-06', count: 42 },
    ],
    signups_daily: [
      { day: '2026-02-28', count: 2 },
      { day: '2026-03-01', count: 0 },
      { day: '2026-03-02', count: 1 },
      { day: '2026-03-03', count: 3 },
      { day: '2026-03-04', count: 0 },
      { day: '2026-03-05', count: 0 },
      { day: '2026-03-06', count: 1 },
    ],
    messages_daily: [
      { day: '2026-02-28', count: 110 },
      { day: '2026-03-01', count: 98 },
      { day: '2026-03-02', count: 134 },
      { day: '2026-03-03', count: 122 },
      { day: '2026-03-04', count: 101 },
      { day: '2026-03-05', count: 140 },
      { day: '2026-03-06', count: 142 },
    ],
  },
};

describe('AdminOverviewService.getOverview', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let service: AdminOverviewService;

  beforeEach(() => {
    rpc = vi.fn().mockResolvedValue({ data: sample, error: null });
    service = new AdminOverviewService(mockClient(rpc));
  });

  it('throws when not initialized', async () => {
    await expect(service.getOverview()).rejects.toThrow('not initialized');
  });

  it('calls admin_overview once; empty params lets SQL pick the 7-day default', async () => {
    await service.initialize('admin-user-id');
    const result = await service.getOverview();

    // No dates passed → empty params object. PostgREST matches on
    // the p_start/p_end DEFAULT NULL signature. The SQL COALESCEs
    // back to its original [today-6, today] 7-tick window.
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('admin_overview', {});
    expect(result).toEqual(sample);
  });

  it('forwards explicit bounds as p_start/p_end ISO strings', async () => {
    await service.initialize('admin-user-id');
    const start = new Date('2026-02-01T00:00:00Z');
    const end = new Date('2026-03-01T00:00:00Z');

    await service.getOverview(start, end);

    // Same p_start/p_end keying as admin_audit_trends and the other
    // ranged RPCs. The SQL date_trunc's both so sub-day precision is
    // ignored — one tick per whole day in the range.
    expect(rpc).toHaveBeenCalledWith('admin_overview', {
      p_start: '2026-02-01T00:00:00.000Z',
      p_end: '2026-03-01T00:00:00.000Z',
    });
  });

  it('omits the key entirely when one bound is undefined', async () => {
    // Mixed case: end given, start left to the SQL default. Sending
    // p_start: undefined would serialize as null and override the
    // DEFAULT — omission is the correct "use your default" signal.
    await service.initialize('admin-user-id');
    await service.getOverview(undefined, new Date('2026-03-06T00:00:00Z'));

    const call = rpc.mock.calls[0][1];
    expect(call).toEqual({ p_end: '2026-03-06T00:00:00.000Z' });
    expect('p_start' in call).toBe(false);
  });

  it('throws when RPC returns an error', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    await service.initialize('admin-user-id');

    await expect(service.getOverview()).rejects.toThrow('permission denied');
  });

  it('surfaces all four stat domains intact', async () => {
    await service.initialize('admin-user-id');
    const result = await service.getOverview();

    expect(result.payments.total_payments).toBe(1203);
    expect(result.auth.logins_today).toBe(42);
    expect(result.users.total_users).toBe(200);
    expect(result.messaging.total_conversations).toBe(60);
  });

  it('spark arrays are number[], ready to index-map', async () => {
    await service.initialize('admin-user-id');
    const result = await service.getOverview();

    // Each spark is a plain array. No {day, value} wrapping — the Sparkline
    // component index-maps x, it doesn't need dates.
    expect(result.sparks.payments).toEqual([12, 15, 9, 18, 14, 20, 17]);
    expect(result.sparks.messages).toHaveLength(7);
    for (const k of ['payments', 'logins', 'signups', 'messages'] as const) {
      expect(result.sparks[k].every((v) => typeof v === 'number')).toBe(true);
    }
  });
});
