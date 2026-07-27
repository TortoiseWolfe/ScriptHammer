/**
 * Unit tests for sweepOrphanedE2EUsers (#354).
 *
 * This function HARD-DELETES real auth users, so the tests here are weighted
 * toward what must never happen rather than the happy path. Its three safety
 * properties — prefix scoping, the named-fixture allowlist, and the age guard —
 * each get a test that fails loudly if the guard is removed.
 *
 * @module tests/unit/e2e-orphan-sweep.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sweepOrphanedE2EUsers } from '../rls/__setup__/cleanup-stale-impl';

const NOW = Date.parse('2026-07-26T00:00:00Z');
const HOURS = 60 * 60 * 1000;

let deletedUserIds: string[];

type U = { id: string; email: string; created_at?: string };

function makeMockClient(pages: U[][]) {
  return {
    auth: {
      admin: {
        listUsers: vi.fn(
          async ({ page }: { page: number; perPage: number }) => ({
            data: { users: pages[page - 1] ?? [] },
            error: null,
          })
        ),
        deleteUser: vi.fn(async (id: string) => {
          deletedUserIds.push(id);
          return { data: {}, error: null };
        }),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: [], error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: null, error: null })),
        in: vi.fn(async () => ({ data: null, error: null })),
      })),
    })),
  } as unknown as Parameters<typeof sweepOrphanedE2EUsers>[0];
}

const old = (id: string, email: string): U => ({
  id,
  email,
  created_at: new Date(NOW - 48 * HOURS).toISOString(),
});

const env = {
  TEST_USER_PRIMARY_EMAIL: 'scripthammer.e2e+test-primary@gmail.com',
  TEST_USER_SECONDARY_EMAIL: 'scripthammer.e2e+test-secondary@gmail.com',
  TEST_USER_TERTIARY_EMAIL: 'scripthammer.e2e+test-tertiary@gmail.com',
};

const run = (users: U[][], opts = {}) =>
  sweepOrphanedE2EUsers(makeMockClient(users), { env, now: NOW, ...opts });

describe('sweepOrphanedE2EUsers (#354)', () => {
  beforeEach(() => {
    deletedUserIds = [];
    vi.clearAllMocks();
  });

  it('deletes orphaned isolates older than the age guard', async () => {
    const s = await run([
      [
        old('u1', 'scripthammer.e2e+iso-pay-123@gmail.com'),
        old('u2', 'scripthammer.e2e+scroll-fixture-456@gmail.com'),
      ],
    ]);

    expect(deletedUserIds).toEqual(['u1', 'u2']);
    expect(s.candidates).toBe(2);
    expect(s.usersRemoved).toBe(2);
  });

  // SAFETY 1 — prefix scoping. Owner accounts and genuine sign-ups share the
  // table; a matcher that broadened to "any test-looking address" would delete
  // real users irreversibly.
  it('never touches accounts outside the scripthammer.e2e+ prefix', async () => {
    const s = await run([
      [
        old('owner', 'jonpohlner@gmail.com'),
        old('real', 'someone@justinjoneslaw.net'),
        old('vitest', 'provider-contract-a@scripthammer.test'),
        old('admin', 'admin@scripthammer.com'),
      ],
    ]);

    expect(deletedUserIds).toEqual([]);
    expect(s.candidates).toBe(0);
  });

  // SAFETY 2 — the named fixtures share the prefix, so only the allowlist
  // saves them. Deleting these breaks every suite in the repo.
  it('never deletes the three named fixtures', async () => {
    const s = await run([
      [
        old('p', 'scripthammer.e2e+test-primary@gmail.com'),
        old('s', 'scripthammer.e2e+test-secondary@gmail.com'),
        old('t', 'scripthammer.e2e+test-tertiary@gmail.com'),
        old('orphan', 'scripthammer.e2e+iso-999@gmail.com'),
      ],
    ]);

    expect(deletedUserIds).toEqual(['orphan']);
    expect(s.allowlisted).toBe(3);
  });

  it('protects the named fixtures even when env vars are unset', async () => {
    const s = await sweepOrphanedE2EUsers(
      makeMockClient([[old('p', 'scripthammer.e2e+test-primary@gmail.com')]]),
      { env: {}, now: NOW }
    );

    expect(deletedUserIds).toEqual([]);
    expect(s.allowlisted).toBe(1);
  });

  // SAFETY 3 — the age guard is what makes this safe to run at the start of a
  // suite: every in-flight user is younger than the guard.
  it('skips users younger than the age guard', async () => {
    const s = await run([
      [
        {
          id: 'fresh',
          email: 'scripthammer.e2e+iso-live@gmail.com',
          created_at: new Date(NOW - 5 * 60 * 1000).toISOString(),
        },
        old('stale', 'scripthammer.e2e+iso-old@gmail.com'),
      ],
    ]);

    expect(deletedUserIds).toEqual(['stale']);
    expect(s.tooRecent).toBe(1);
  });

  // A hard delete must fail CLOSED when it cannot establish age.
  it('treats an unparseable or missing created_at as too recent', async () => {
    const s = await run([
      [
        {
          id: 'bad',
          email: 'scripthammer.e2e+iso-a@gmail.com',
          created_at: 'nonsense',
        },
        { id: 'none', email: 'scripthammer.e2e+iso-b@gmail.com' },
      ],
    ]);

    expect(deletedUserIds).toEqual([]);
    expect(s.tooRecent).toBe(2);
  });

  // #197: a single listUsers call silently caps, which would leave orphans
  // behind AND under-report — the failure looking like success.
  it('paginates until a short page', async () => {
    const full = Array.from({ length: 200 }, (_, i) =>
      old(`a${i}`, `scripthammer.e2e+iso-a${i}@gmail.com`)
    );
    const s = await run([
      full,
      [old('last', 'scripthammer.e2e+iso-last@gmail.com')],
    ]);

    expect(s.candidates).toBe(201);
    expect(deletedUserIds).toContain('last');
  });

  it('dryRun reports candidates without deleting', async () => {
    const s = await run([[old('u1', 'scripthammer.e2e+iso-1@gmail.com')]], {
      dryRun: true,
    });

    expect(s.candidates).toBe(1);
    expect(s.usersRemoved).toBe(0);
    expect(deletedUserIds).toEqual([]);
    expect(s.dryRun).toBe(true);
  });
});

/**
 * #360 — concurrent sweeps racing each other.
 *
 * `globalSetup` runs once per Playwright invocation and the E2E workflow
 * invokes Playwright ~15 times, so two sweeps routinely overlap and both try to
 * delete the same backlog. The loser's deletes come back "not found".
 *
 * Nothing was ever broken by that, but a green run printing ~49 red-flag
 * warnings teaches people to stop reading warnings — and that habit is what
 * lets a real failure through. The fix must therefore do BOTH: stop crying wolf
 * on the benign race, AND keep a genuine delete failure loud. A change that
 * only silenced warnings would trade one blind spot for a worse one.
 */
describe('sweepOrphanedE2EUsers — concurrent sweeps (#360)', () => {
  type DeleteResult = { data: object; error: unknown };

  function clientWithDeleteResult(users: U[], result: () => DeleteResult) {
    return {
      auth: {
        admin: {
          listUsers: vi.fn(
            async ({ page }: { page: number; perPage: number }) => ({
              data: { users: page === 1 ? users : [] },
              error: null,
            })
          ),
          deleteUser: vi.fn(async () => result()),
        },
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
          in: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    } as unknown as Parameters<typeof sweepOrphanedE2EUsers>[0];
  }

  const orphans = [
    old('u1', 'scripthammer.e2e+iso-a@gmail.com'),
    old('u2', 'scripthammer.e2e+iso-b@gmail.com'),
  ];

  it('counts users a concurrent sweep already removed, without warning', async () => {
    const warn = vi.fn();
    const summary = await sweepOrphanedE2EUsers(
      clientWithDeleteResult(orphans, () => ({
        data: {},
        error: { message: 'User not found', status: 404 },
      })),
      { env, now: NOW, logger: { info: vi.fn(), warn } }
    );

    expect(summary.usersAlreadyGone).toBe(2);
    expect(summary.errorsLogged).toBe(0);
    expect(summary.usersRemoved).toBe(0);
    // The whole point: no red-flag warnings for a benign race.
    expect(warn).not.toHaveBeenCalled();
  });

  it('still warns loudly on a genuine delete failure', async () => {
    const warn = vi.fn();
    const summary = await sweepOrphanedE2EUsers(
      clientWithDeleteResult(orphans, () => ({
        data: {},
        error: { message: 'permission denied for table users', status: 403 },
      })),
      { env, now: NOW, logger: { info: vi.fn(), warn } }
    );

    expect(summary.errorsLogged).toBe(2);
    expect(summary.usersAlreadyGone).toBe(0);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('reports errors and alreadyGone in the logged summary', async () => {
    // The observability gap that made this race invisible: the summary line
    // omitted errorsLogged entirely, so a run emitting warnings still looked
    // clean and the cause had to be dug out of raw log lines.
    const info = vi.fn();
    await sweepOrphanedE2EUsers(
      clientWithDeleteResult(orphans, () => ({
        data: {},
        error: { message: 'User not found', status: 404 },
      })),
      { env, now: NOW, logger: { info, warn: vi.fn() } }
    );

    expect(info).toHaveBeenCalledWith(
      'Sweep: orphaned E2E users',
      expect.objectContaining({ alreadyGone: 2, errors: 0 })
    );
  });
});
