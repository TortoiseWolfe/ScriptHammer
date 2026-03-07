/**
 * AdminMessagingService.getTrends unit tests
 *
 * Marshalling layer only. The E2E-encryption boundary (no encrypted_content,
 * no conversation_id in output) is enforced at the SQL level — the contract
 * test in admin-access.contract.test.ts serializes the live response and
 * asserts those keys are absent. Here we check the service doesn't mangle
 * the shape in transit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AdminMessagingService,
  type AdminMessagingTrends,
} from '@/services/admin/admin-messaging-service';

function mockClient(rpcImpl: ReturnType<typeof vi.fn>) {
  return { rpc: rpcImpl } as unknown as SupabaseClient;
}

const sampleTrends: AdminMessagingTrends = {
  range: {
    start: '2026-02-26T00:00:00+00:00',
    end: '2026-03-05T00:00:00+00:00',
  },
  totals: { messages: 847, conversations_created: 12, active_senders: 23 },
  daily_series: [
    { day: '2026-02-26', messages: 110, conversations_created: 2 },
    { day: '2026-02-27', messages: 98, conversations_created: 0 },
  ],
  top_senders: [
    {
      user_id: 'u-alice',
      username: 'alice_wonder',
      display_name: 'Alice Wonderland',
      messages: 142,
    },
    {
      user_id: 'u-bob',
      username: 'bob_builder',
      display_name: null,
      messages: 88,
    },
  ],
};

describe('AdminMessagingService.getTrends', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let service: AdminMessagingService;

  beforeEach(() => {
    rpc = vi.fn().mockResolvedValue({ data: sampleTrends, error: null });
    service = new AdminMessagingService(mockClient(rpc));
  });

  it('throws when not initialized', async () => {
    await expect(service.getTrends()).rejects.toThrow('not initialized');
  });

  it('calls admin_messaging_trends with no args when no range given', async () => {
    await service.initialize('admin-user-id');
    const result = await service.getTrends();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('admin_messaging_trends', {});
    expect(result).toEqual(sampleTrends);
  });

  it('passes p_start and p_end as ISO strings when Dates are given', async () => {
    await service.initialize('admin-user-id');
    const start = new Date('2026-02-01T00:00:00Z');
    const end = new Date('2026-03-01T00:00:00Z');

    await service.getTrends(start, end);

    expect(rpc).toHaveBeenCalledWith('admin_messaging_trends', {
      p_start: '2026-02-01T00:00:00.000Z',
      p_end: '2026-03-01T00:00:00.000Z',
    });
  });

  it('passes only p_start when only start is given', async () => {
    await service.initialize('admin-user-id');

    await service.getTrends(new Date('2026-02-01T00:00:00Z'));

    // p_end omitted → SQL default (now()) applies
    expect(rpc).toHaveBeenCalledWith('admin_messaging_trends', {
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

  it('surfaces top_senders without adding recipient/conversation fields', async () => {
    await service.initialize('admin-user-id');
    const result = await service.getTrends();

    // Structural check: the TopSender type has exactly four keys. If someone
    // widens the type to include conversation_id the fixture above won't
    // compile, but this belt-and-suspenders check catches runtime drift too.
    for (const s of result.top_senders) {
      expect(Object.keys(s).sort()).toEqual([
        'display_name',
        'messages',
        'user_id',
        'username',
      ]);
    }
    expect(result.top_senders[0].messages).toBe(142);
    expect(result.top_senders[1].display_name).toBeNull();
  });

  it('handles zero-traffic range (empty top_senders, dense series)', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        ...sampleTrends,
        totals: { messages: 0, conversations_created: 0, active_senders: 0 },
        top_senders: [],
        daily_series: [
          { day: '2026-02-26', messages: 0, conversations_created: 0 },
          { day: '2026-02-27', messages: 0, conversations_created: 0 },
        ],
      },
      error: null,
    });
    await service.initialize('admin-user-id');

    const result = await service.getTrends();
    expect(result.top_senders).toEqual([]);
    // Dense series means zero-traffic days still appear — UI draws a flat line,
    // not a gap.
    expect(result.daily_series).toHaveLength(2);
    expect(result.daily_series[0].messages).toBe(0);
  });
});
