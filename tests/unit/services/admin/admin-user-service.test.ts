/**
 * AdminUserService.listUsers unit tests
 *
 * Same DI mock pattern as payment/audit services. These verify RPC param
 * marshalling; the JOIN to auth.users and activity CASE live in the contract test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AdminUserService,
  type AdminUserListResult,
} from '@/services/admin/admin-user-service';

function mockClient(rpcImpl: ReturnType<typeof vi.fn>) {
  return { rpc: rpcImpl } as unknown as SupabaseClient;
}

const sampleResult: AdminUserListResult = {
  total: 234,
  users: [
    {
      id: 'u1',
      username: 'alice_wonder',
      display_name: 'Alice Wonderland',
      created_at: '2025-01-15T10:00:00+00:00',
      welcome_message_sent: true,
      last_sign_in_at: '2026-03-04T14:22:00+00:00',
      activity: 'active',
    },
    {
      id: 'u2',
      username: 'bob_builder',
      display_name: 'Bob Builder',
      created_at: '2025-03-20T14:30:00+00:00',
      welcome_message_sent: true,
      last_sign_in_at: '2026-02-10T09:00:00+00:00',
      activity: 'idle',
    },
    {
      id: 'u3',
      username: 'carol_ghost',
      display_name: null,
      created_at: '2025-06-01T09:00:00+00:00',
      welcome_message_sent: false,
      last_sign_in_at: null,
      activity: 'dormant',
    },
  ],
};

describe('AdminUserService.listUsers', () => {
  let rpc: ReturnType<typeof vi.fn>;
  let service: AdminUserService;

  beforeEach(() => {
    rpc = vi.fn().mockResolvedValue({ data: sampleResult, error: null });
    service = new AdminUserService(mockClient(rpc));
  });

  it('throws when not initialized', async () => {
    await expect(service.listUsers()).rejects.toThrow('not initialized');
  });

  it('calls admin_list_users with no args by default', async () => {
    await service.initialize('admin-user-id');
    const result = await service.listUsers();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('admin_list_users', {});
    expect(result).toEqual(sampleResult);
  });

  it('passes p_search when search string given', async () => {
    await service.initialize('admin-user-id');
    await service.listUsers({ search: 'alice' });

    expect(rpc).toHaveBeenCalledWith('admin_list_users', { p_search: 'alice' });
  });

  it('trims search and omits when empty', async () => {
    await service.initialize('admin-user-id');
    await service.listUsers({ search: '   ' });

    // Whitespace-only search shouldn't hit Postgres with p_search='%   %'
    // which would match everything — omit the param instead.
    expect(rpc).toHaveBeenCalledWith('admin_list_users', {});
  });

  it('passes p_limit and p_offset for pagination', async () => {
    await service.initialize('admin-user-id');
    await service.listUsers({ limit: 25, offset: 50 });

    expect(rpc).toHaveBeenCalledWith('admin_list_users', {
      p_limit: 25,
      p_offset: 50,
    });
  });

  it('passes all params together', async () => {
    await service.initialize('admin-user-id');
    await service.listUsers({ search: 'bob', limit: 10, offset: 0 });

    expect(rpc).toHaveBeenCalledWith('admin_list_users', {
      p_search: 'bob',
      p_limit: 10,
      p_offset: 0,
    });
  });

  it('throws when RPC returns an error', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    await service.initialize('admin-user-id');

    await expect(service.listUsers()).rejects.toThrow('permission denied');
  });

  it('surfaces total separate from users.length', async () => {
    await service.initialize('admin-user-id');
    const result = await service.listUsers();

    // The whole point of {total, users[]}: "showing 3 of 234"
    expect(result.total).toBe(234);
    expect(result.users).toHaveLength(3);
  });

  it('preserves activity tier and null last_sign_in_at', async () => {
    await service.initialize('admin-user-id');
    const result = await service.listUsers();

    expect(result.users[0].activity).toBe('active');
    expect(result.users[2].activity).toBe('dormant');
    expect(result.users[2].last_sign_in_at).toBeNull();
  });
});
