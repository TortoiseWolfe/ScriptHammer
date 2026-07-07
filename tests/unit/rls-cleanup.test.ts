/**
 * Unit tests for cleanupStaleScripthammerUsers (#50).
 *
 * Pins the FK-aware DELETE chain that runs before pnpm test:rls so that
 * a prior killed run's orphan rows can't wedge createTestUser.
 *
 * @module tests/unit/rls-cleanup.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanupStaleScripthammerUsers } from '../rls/__setup__/cleanup-stale-impl';

// Mock service client. Each table accessor returns a chain; the .delete()
// path returns a Promise of { error } so the impl can await it. We
// instrument the .from() calls to record table+filter for ordering checks.
type DeleteCall = { table: string; column: string; value: string };
let deleteCalls: DeleteCall[];
let deleteUserCalls: string[];

function makeMockClient(opts: {
  users: Array<{ id: string; email: string }>;
  failOn?: { table: string }; // simulate a transient error on this table's delete
}) {
  return {
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({
          data: { users: opts.users },
          error: null,
        })),
        deleteUser: vi.fn(async (id: string) => {
          deleteUserCalls.push(id);
          return { data: {}, error: null };
        }),
      },
    },
    from: vi.fn((table: string) => ({
      delete: vi.fn(() => ({
        eq: vi.fn(async (column: string, value: string) => {
          deleteCalls.push({ table, column, value });
          if (opts.failOn?.table === table) {
            return { data: null, error: { message: 'Simulated failure' } };
          }
          return { data: null, error: null };
        }),
      })),
    })),
  } as unknown as Parameters<typeof cleanupStaleScripthammerUsers>[0];
}

describe('cleanupStaleScripthammerUsers (#50)', () => {
  beforeEach(() => {
    deleteCalls = [];
    deleteUserCalls = [];
  });

  it('deletes the FK chain in correct order per matching user', async () => {
    const client = makeMockClient({
      users: [
        { id: 'user-a-id', email: 'test-user-a@scripthammer.test' },
        { id: 'user-b-id', email: 'test-user-b@scripthammer.test' },
      ],
    });

    const summary = await cleanupStaleScripthammerUsers(client);

    // For user-a: payment_intents → subscriptions → user_profiles, then auth deleteUser
    // For user-b: same chain
    // Total: 6 DELETE rows + 2 deleteUser
    expect(deleteCalls).toHaveLength(6);
    expect(deleteUserCalls).toEqual(['user-a-id', 'user-b-id']);

    // Ordering invariant: for each user, payment_intents must come before
    // subscriptions which must come before user_profiles. The auth
    // deleteUser comes last (after that user's row deletes).
    const userA = deleteCalls.filter((c) => c.value === 'user-a-id');
    expect(userA.map((c) => c.table)).toEqual([
      'payment_intents',
      'subscriptions',
      'user_profiles',
    ]);

    expect(summary.usersRemoved).toBe(2);
    expect(summary.errorsLogged).toBe(0);
  });

  it('ignores users whose email does not match @scripthammer.test', async () => {
    const client = makeMockClient({
      users: [
        { id: 'prod-id', email: 'real-user@example.com' },
        { id: 'admin-id', email: 'admin@scripthammer.com' }, // .com, not .test
        { id: 'sh-id', email: 'test-user-a@scripthammer.test' },
      ],
    });

    await cleanupStaleScripthammerUsers(client);

    // Only the .test user got cleaned.
    expect(deleteUserCalls).toEqual(['sh-id']);
    // No DELETE call ever targeted the production user IDs.
    expect(deleteCalls.every((c) => c.value === 'sh-id')).toBe(true);
  });

  it('continues to subsequent steps when a DELETE fails (best-effort)', async () => {
    const client = makeMockClient({
      users: [{ id: 'user-x', email: 'test-user-a@scripthammer.test' }],
      failOn: { table: 'payment_intents' },
    });

    const summary = await cleanupStaleScripthammerUsers(client);

    // payment_intents failed, but subscriptions + user_profiles + auth
    // deleteUser still ran for the same user.
    const tablesAttempted = deleteCalls.map((c) => c.table);
    expect(tablesAttempted).toEqual([
      'payment_intents',
      'subscriptions',
      'user_profiles',
    ]);
    expect(deleteUserCalls).toEqual(['user-x']);
    // Summary records partial cleanup: 1 user successfully removed, 1
    // error logged (the payment_intents failure).
    expect(summary.usersRemoved).toBe(1);
    expect(summary.errorsLogged).toBe(1);
  });

  it('is a no-op when no @scripthammer.test users exist', async () => {
    const client = makeMockClient({
      users: [{ id: 'prod-id', email: 'real@example.com' }],
    });

    const summary = await cleanupStaleScripthammerUsers(client);

    expect(deleteCalls).toHaveLength(0);
    expect(deleteUserCalls).toHaveLength(0);
    expect(summary).toEqual({
      usersRemoved: 0,
      errorsLogged: 0,
    });
  });
});
