/**
 * AdminAuthService.checkIsAdmin regression tests (#240).
 *
 * Root-cause fix: admin status has ONE authority — user_profiles.is_admin,
 * read through the SECURITY DEFINER is_admin() RPC. The UI gate must call that
 * SAME RPC the server RLS/RPCs gate on, so the UI and the data can never
 * disagree ("hollow admin"), and a revoked column takes effect immediately
 * ("lingering admin"). These tests pin that the client calls the RPC — NOT a
 * direct user_profiles column read (the old, divergent path).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdminAuthService } from '../admin-auth-service';

function makeClient(rpcImpl: (fn: string, args: unknown) => unknown) {
  const rpc = vi.fn(rpcImpl);
  const from = vi.fn(() => {
    throw new Error(
      'checkIsAdmin must NOT read a table directly — it must call the is_admin() RPC (#240)'
    );
  });
  return {
    client: { rpc, from } as unknown as SupabaseClient,
    rpc,
    from,
  };
}

describe('AdminAuthService.checkIsAdmin (#240 single source of truth)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the is_admin RPC with the user id — not a user_profiles column read', async () => {
    const { client, rpc, from } = makeClient(() => ({
      data: true,
      error: null,
    }));
    const svc = new AdminAuthService(client);

    const result = await svc.checkIsAdmin('user-123');

    expect(result).toBe(true);
    expect(rpc).toHaveBeenCalledWith('is_admin', { check_user_id: 'user-123' });
    // The old divergent path read the column directly; that must be gone.
    expect(from).not.toHaveBeenCalled();
  });

  it('returns false immediately when the column has been revoked (RPC returns false)', async () => {
    // is_admin() reads the column LIVE, so a revoked column returns false on the
    // very next call even if the caller still holds a stale admin JWT.
    const { client } = makeClient(() => ({ data: false, error: null }));
    const svc = new AdminAuthService(client);

    expect(await svc.checkIsAdmin('user-123')).toBe(false);
  });

  it('returns false on RPC error (fail closed, never grants admin on error)', async () => {
    const { client } = makeClient(() => ({
      data: null,
      error: { message: 'boom' },
    }));
    const svc = new AdminAuthService(client);

    expect(await svc.checkIsAdmin('user-123')).toBe(false);
  });

  it('treats a non-true RPC result as not-admin', async () => {
    const { client } = makeClient(() => ({ data: null, error: null }));
    const svc = new AdminAuthService(client);

    expect(await svc.checkIsAdmin('user-123')).toBe(false);
  });
});
