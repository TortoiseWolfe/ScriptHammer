/**
 * Regression test for deleteTestUser's FK-safe cleanup order.
 *
 * A partial deleteTestUser (profile deleted BEFORE an admin.deleteUser that then
 * failed on the payment_intents/subscriptions NO ACTION FKs) once orphaned the
 * shared PRIMARY E2E user — auth user alive, profile + cascaded keys gone —
 * red-lining the whole E2E suite. This pins the safe contract:
 *   1. clear the only non-cascading blockers (webhook_events → subscriptions →
 *      payment_intents),
 *   2. then admin.deleteUser (which cascades profile/keys/messages/...),
 *   3. NEVER delete user_profiles ourselves (so a failed auth-delete can't
 *      corrupt the user).
 *
 * @module tests/unit/test-user-factory-cleanup.test
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Shared mutable state the mocked supabase client writes to (hoisted so the
// vi.mock factory can close over it).
const h = vi.hoisted(() => ({
  ops: [] as Array<{ table: string; op: 'select' | 'delete'; column: string }>,
  deleteUserCalls: [] as string[],
  cfg: { subsData: [] as Array<{ id: string }>, failDeleteUser: false },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          h.deleteUserCalls.push(id);
          return { error: h.cfg.failDeleteUser ? { message: 'boom' } : null };
        },
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: async (column: string) => {
          h.ops.push({ table, op: 'select', column });
          return { data: h.cfg.subsData, error: null };
        },
      }),
      delete: () => ({
        eq: async (column: string) => {
          h.ops.push({ table, op: 'delete', column });
          return { error: null };
        },
        in: async (column: string) => {
          h.ops.push({ table, op: 'delete', column });
          return { error: null };
        },
      }),
    }),
  }),
}));

import { deleteTestUser } from '../e2e/utils/test-user-factory';

describe('deleteTestUser — FK-safe cleanup order', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://mock.local';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  });
  beforeEach(() => {
    h.ops = [];
    h.deleteUserCalls = [];
    h.cfg = { subsData: [{ id: 'sub-1' }], failDeleteUser: false };
  });

  it('clears payment blockers then deletes the auth user, and NEVER touches the profile', async () => {
    const ok = await deleteTestUser('user-1');
    expect(ok).toBe(true);

    const deleteTables = h.ops
      .filter((o) => o.op === 'delete')
      .map((o) => o.table);
    // With a subscription present: webhook_events → subscriptions → payment_intents.
    expect(deleteTables).toEqual([
      'webhook_events',
      'subscriptions',
      'payment_intents',
    ]);

    // The corruption vector: profile (and messaging tables) must NEVER be
    // deleted here — admin.deleteUser cascades them.
    const allTables = h.ops.map((o) => o.table);
    for (const forbidden of [
      'user_profiles',
      'messages',
      'conversations',
      'user_connections',
    ]) {
      expect(allTables).not.toContain(forbidden);
    }

    // admin.deleteUser runs, and runs AFTER the blocker cleanup.
    expect(h.deleteUserCalls).toEqual(['user-1']);
  });

  it('skips webhook_events when the user has no subscriptions', async () => {
    h.cfg.subsData = [];
    await deleteTestUser('user-2');
    const deleteTables = h.ops
      .filter((o) => o.op === 'delete')
      .map((o) => o.table);
    expect(deleteTables).toEqual(['subscriptions', 'payment_intents']);
    expect(h.deleteUserCalls).toEqual(['user-2']);
  });

  it('returns false (without pre-deleting the profile) when admin.deleteUser fails', async () => {
    h.cfg.failDeleteUser = true;
    const ok = await deleteTestUser('user-3');
    expect(ok).toBe(false);
    // Even on failure, the profile was never deleted → the user stays intact.
    expect(h.ops.map((o) => o.table)).not.toContain('user_profiles');
    expect(h.deleteUserCalls).toEqual(['user-3']);
  });
});
