/**
 * Regression test for the RLS fixtures' deleteTestUser FK-safe cleanup order.
 *
 * `tests/fixtures/test-users.ts` has its OWN deleteTestUser (separate from the
 * E2E factory's). Before #341 it only called admin.deleteUser, so a preset test
 * user that had accumulated a subscription-with-a-webhook would make the delete
 * FAIL on the payment_intents / subscriptions / webhook_events NO-ACTION FKs.
 * This pins the same safe contract the factory uses (#338):
 *   1. clear the only non-cascading blockers (webhook_events → subscriptions →
 *      payment_intents),
 *   2. then admin.deleteUser (which cascades profile/keys/messages/...),
 *   3. NEVER delete user_profiles ourselves.
 * Unlike the factory (returns a boolean), this variant THROWS on a real
 * admin.deleteUser error — that contract is asserted here too.
 *
 * @module tests/unit/test-users-fixtures-cleanup.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the vi.mock factory can close over it. ALSO sets the Supabase env
// BEFORE the module import: tests/fixtures/test-users.ts reads SUPABASE_URL /
// keys into module-top-level consts, so a beforeEach/beforeAll would be too
// late. createClient is fully mocked, so the values only need to be truthy.
const h = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://mock.local';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
  return {
    ops: [] as Array<{
      table: string;
      op: 'select' | 'delete';
      column: string;
    }>,
    deleteUserCalls: [] as string[],
    cfg: {
      subsData: [] as Array<{ id: string }>,
      deleteUserError: null as null | { message: string },
    },
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          h.deleteUserCalls.push(id);
          return { error: h.cfg.deleteUserError };
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

import { deleteTestUser } from '../fixtures/test-users';

describe('fixtures deleteTestUser — FK-safe cleanup order', () => {
  beforeEach(() => {
    h.ops = [];
    h.deleteUserCalls = [];
    h.cfg = { subsData: [{ id: 'sub-1' }], deleteUserError: null };
  });

  it('clears payment blockers then deletes the auth user, and NEVER touches the profile', async () => {
    await deleteTestUser('user-1');

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

  it('throws (after clearing blockers, without touching the profile) when admin.deleteUser fails', async () => {
    h.cfg.deleteUserError = { message: 'boom' };
    await expect(deleteTestUser('user-3')).rejects.toThrow('boom');
    // Even on failure, the profile was never deleted → the user stays intact.
    expect(h.ops.map((o) => o.table)).not.toContain('user_profiles');
    expect(h.deleteUserCalls).toEqual(['user-3']);
  });

  it('does NOT throw when admin.deleteUser reports the user is already gone', async () => {
    h.cfg.deleteUserError = { message: 'User not found' };
    await expect(deleteTestUser('user-4')).resolves.toBeUndefined();
    expect(h.deleteUserCalls).toEqual(['user-4']);
  });
});
