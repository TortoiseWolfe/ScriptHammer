/**
 * AdminPaymentService unit tests
 *
 * The service accepts SupabaseClient via constructor (DI) — no module mocking.
 * These tests verify the service marshals RPC calls correctly and shapes results.
 * The SQL itself is covered by the contract test against live Supabase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AdminPaymentService,
  type AdminPaymentTrends,
} from '@/services/admin/admin-payment-service';

function mockClient(rpcImpl: ReturnType<typeof vi.fn>) {
  return { rpc: rpcImpl } as unknown as SupabaseClient;
}

const sampleTrends: AdminPaymentTrends = {
  range: {
    start: '2026-02-26T00:00:00+00:00',
    end: '2026-03-05T00:00:00+00:00',
  },
  totals: { succeeded: 42, failed: 3, refunded: 2, revenue_cents: 125_000 },
  refund_rate: 0.0476,
  provider_breakdown: [
    {
      provider: 'stripe',
      succeeded: 35,
      failed: 2,
      refunded: 1,
      revenue_cents: 100_000,
    },
    {
      provider: 'paypal',
      succeeded: 7,
      failed: 1,
      refunded: 1,
      revenue_cents: 25_000,
    },
  ],
  daily_series: [
    { day: '2026-02-26', succeeded: 6, failed: 0, revenue_cents: 18_000 },
    { day: '2026-02-27', succeeded: 5, failed: 1, revenue_cents: 15_000 },
  ],
};

describe('AdminPaymentService.getTrends', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let service: AdminPaymentService;

  beforeEach(() => {
    rpc = vi.fn().mockResolvedValue({ data: sampleTrends, error: null });
    service = new AdminPaymentService(mockClient(rpc));
  });

  it('throws when not initialized', async () => {
    await expect(service.getTrends()).rejects.toThrow('not initialized');
  });

  it('calls admin_payment_trends with no args when no range given', async () => {
    await service.initialize('admin-user-id');
    const result = await service.getTrends();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('admin_payment_trends', {});
    expect(result).toEqual(sampleTrends);
  });

  it('passes p_start and p_end as ISO strings when Dates are given', async () => {
    await service.initialize('admin-user-id');
    const start = new Date('2026-02-01T00:00:00Z');
    const end = new Date('2026-03-01T00:00:00Z');

    await service.getTrends(start, end);

    expect(rpc).toHaveBeenCalledWith('admin_payment_trends', {
      p_start: '2026-02-01T00:00:00.000Z',
      p_end: '2026-03-01T00:00:00.000Z',
    });
  });

  it('passes only p_start when only start is given', async () => {
    await service.initialize('admin-user-id');
    const start = new Date('2026-02-01T00:00:00Z');

    await service.getTrends(start);

    // p_end omitted → SQL default (now()) applies
    expect(rpc).toHaveBeenCalledWith('admin_payment_trends', {
      p_start: '2026-02-01T00:00:00.000Z',
    });
  });

  it('throws when RPC returns an error', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    await service.initialize('admin-user-id');

    await expect(service.getTrends()).rejects.toThrow('permission denied');
  });

  it('casts refund_rate to number (JSON numeric may arrive as string)', async () => {
    // json_build_object can serialize round(numeric, 4) as a JSON number,
    // but supabase-js types it as unknown. Service should coerce.
    rpc.mockResolvedValueOnce({
      data: { ...sampleTrends, refund_rate: '0.0476' },
      error: null,
    });
    await service.initialize('admin-user-id');

    const result = await service.getTrends();
    expect(typeof result.refund_rate).toBe('number');
    expect(result.refund_rate).toBeCloseTo(0.0476, 4);
  });
});
