/**
 * AdminAuditService.getTrends unit tests
 *
 * DI mock pattern identical to admin-payment-service.test.ts. These verify
 * RPC marshalling; burst SQL semantics live in the contract test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AdminAuditService,
  type AdminAuditTrends,
} from '@/services/admin/admin-audit-service';

function mockClient(rpcImpl: ReturnType<typeof vi.fn>) {
  return { rpc: rpcImpl } as unknown as SupabaseClient;
}

const sampleTrends: AdminAuditTrends = {
  range: {
    start: '2026-02-26T00:00:00+00:00',
    end: '2026-03-05T00:00:00+00:00',
  },
  totals: { sign_in_failed: 18, sign_in_success: 412, bursts: 2 },
  bursts: [
    {
      ip_address: '203.0.113.42',
      first_seen: '2026-03-03T14:02:11+00:00',
      last_seen: '2026-03-03T14:09:47+00:00',
      attempts: 11,
      distinct_users: 1,
    },
    {
      ip_address: '198.51.100.7',
      first_seen: '2026-03-04T03:15:00+00:00',
      last_seen: '2026-03-04T03:22:30+00:00',
      attempts: 6,
      distinct_users: 4,
    },
  ],
  daily_series: [
    { day: '2026-02-26', failed: 0, succeeded: 55 },
    { day: '2026-02-27', failed: 1, succeeded: 60 },
  ],
};

describe('AdminAuditService.getTrends', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let service: AdminAuditService;

  beforeEach(() => {
    rpc = vi.fn().mockResolvedValue({ data: sampleTrends, error: null });
    service = new AdminAuditService(mockClient(rpc));
  });

  it('throws when not initialized', async () => {
    await expect(service.getTrends()).rejects.toThrow('not initialized');
  });

  it('calls admin_audit_trends with no args when no range given', async () => {
    await service.initialize('admin-user-id');
    const result = await service.getTrends();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('admin_audit_trends', {});
    expect(result).toEqual(sampleTrends);
  });

  it('passes p_start and p_end as ISO strings when Dates are given', async () => {
    await service.initialize('admin-user-id');
    const start = new Date('2026-02-01T00:00:00Z');
    const end = new Date('2026-03-01T00:00:00Z');

    await service.getTrends(start, end);

    expect(rpc).toHaveBeenCalledWith('admin_audit_trends', {
      p_start: '2026-02-01T00:00:00.000Z',
      p_end: '2026-03-01T00:00:00.000Z',
    });
  });

  it('passes only p_start when only start is given', async () => {
    await service.initialize('admin-user-id');
    const start = new Date('2026-02-01T00:00:00Z');

    await service.getTrends(start);

    // p_end omitted → SQL default (now()) applies
    expect(rpc).toHaveBeenCalledWith('admin_audit_trends', {
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

  it('surfaces burst correlation fields intact', async () => {
    await service.initialize('admin-user-id');
    const result = await service.getTrends();

    // The discriminator between "targeted account" and "credential stuffing"
    // is distinct_users. Make sure the service doesn't drop it.
    expect(result.bursts[0].distinct_users).toBe(1);
    expect(result.bursts[1].distinct_users).toBe(4);
    expect(result.bursts[0].attempts).toBe(11);
  });

  it('returns empty bursts array when no bursts', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        ...sampleTrends,
        bursts: [],
        totals: { ...sampleTrends.totals, bursts: 0 },
      },
      error: null,
    });
    await service.initialize('admin-user-id');

    const result = await service.getTrends();
    expect(result.bursts).toEqual([]);
    expect(result.totals.bursts).toBe(0);
  });
});
