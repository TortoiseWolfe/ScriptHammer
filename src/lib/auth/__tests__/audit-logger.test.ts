/**
 * logAuthEvent regression tests (#241).
 *
 * Root-cause fix: the auth audit log was empty for real sign-ins and failed
 * logins because the client-side `.from('auth_audit_logs').insert()` ran as the
 * authenticated/anon role, and the ONLY INSERT policy on that table is
 * service_role — so RLS silently rejected every write. The fix routes writes
 * through the SECURITY DEFINER `log_auth_event` RPC (which bypasses RLS while
 * enforcing that a caller can only log for itself or anonymously).
 *
 * These tests pin that logAuthEvent calls the RPC — NOT a direct table insert —
 * and maps its fields to the RPC's p_* parameters.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above imports, so the mock fns must be created via
// vi.hoisted() to be referenceable inside the factory.
const { rpc, insert } = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(() => {
    throw new Error(
      'logAuthEvent must NOT insert into auth_audit_logs directly (RLS rejects it) — it must call log_auth_event RPC (#241)'
    );
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc,
    from: vi.fn(() => ({ insert })),
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

import { logAuthEvent } from '../audit-logger';

describe('logAuthEvent (#241 audit log write path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ error: null });
  });

  it('writes via the log_auth_event RPC, never a direct table insert', async () => {
    await logAuthEvent({
      user_id: 'user-1',
      event_type: 'sign_in_success',
      event_data: { email: 'a@b.com', provider: 'email' },
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('log_auth_event');
    expect(args).toMatchObject({
      p_event_type: 'sign_in_success',
      p_user_id: 'user-1',
      p_event_data: { email: 'a@b.com', provider: 'email' },
      p_success: true,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('records a failed sign-in as sign_in_failed with user_id null and success false', async () => {
    // This is the exact shape SignInForm sends on a bad password: anonymous
    // (no session yet), event_type the failed-attempt detector reads.
    await logAuthEvent({
      event_type: 'sign_in_failed',
      event_data: { email: 'a@b.com', provider: 'email' },
      success: false,
      error_message: 'Invalid login credentials',
    });

    const [, args] = rpc.mock.calls[0];
    expect(args).toMatchObject({
      p_event_type: 'sign_in_failed',
      p_success: false,
      p_error_message: 'Invalid login credentials',
    });
    // Anonymous failed login: user_id omitted (RPC uses its NULL default).
    expect(args.p_user_id).toBeUndefined();
  });

  it('defaults p_success to true when success is not provided', async () => {
    await logAuthEvent({ user_id: 'u', event_type: 'sign_in_success' });
    const [, args] = rpc.mock.calls[0];
    expect(args.p_success).toBe(true);
  });

  it('never throws when the RPC returns an error (audit is non-critical)', async () => {
    rpc.mockResolvedValue({ error: { message: 'nope' } });
    await expect(
      logAuthEvent({ event_type: 'sign_in_failed', success: false })
    ).resolves.toBeUndefined();
  });
});
