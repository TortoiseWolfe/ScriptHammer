# RLS Cleanup-Stale Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vitest `globalSetup` hook to `pnpm test:rls` that scrubs orphan `*@scripthammer.test` users + their FK-blocking dependent rows before tests collect, so killed prior runs don't wedge the suite.

**Architecture:** One pure cleanup function that takes a Supabase service client and walks the FK chain (`payment_intents` → `subscriptions` → `user_profiles` → `auth.admin.deleteUser`) per matching user. A thin `globalSetup` wrapper constructs the client, calls the function, logs the summary. A unit test mocks the client and pins the call ordering. Cleanup is best-effort — errors are logged and the function continues.

**Tech Stack:** Vitest globalSetup contract, Supabase JS service client, PostgREST DELETE, `auth.admin.deleteUser` admin API, TypeScript strict.

**Spec:** [`docs/superpowers/specs/2026-04-27-rls-cleanup-stale-design.md`](../specs/2026-04-27-rls-cleanup-stale-design.md)

**Tracks:** [#50](https://github.com/TortoiseWolfe/ScriptHammer/issues/50) (Family D1 in `docs/STABILITY-TRACKING.md`)

---

## File map

| File                                        | Action | Purpose                                                                                       |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `tests/rls/__setup__/cleanup-stale-impl.ts` | Create | Pure async function `cleanupStaleScripthammerUsers(client)` — walks FK chain, returns summary |
| `tests/rls/__setup__/cleanup-stale.ts`      | Create | Vitest globalSetup wrapper — constructs service client, calls impl, logs                      |
| `tests/unit/rls-cleanup.test.ts`            | Create | Unit tests for the impl with a mocked client                                                  |
| `vitest.rls.config.ts`                      | Modify | Wire `globalSetup: ['./tests/rls/__setup__/cleanup-stale.ts']`                                |

---

## Task 1: Branch off main

**Files:**

- (none)

- [ ] **Step 1: Confirm clean tree on main**

```bash
git status --short
git rev-parse --abbrev-ref HEAD
```

Expected: only `?? .claude/scheduled_tasks.lock` (local clutter), branch `main`.

- [ ] **Step 2: Sync local main with origin**

```bash
git fetch --prune origin
git merge --ff-only origin/main
```

Expected: "Already up to date." or fast-forward to current origin tip.

- [ ] **Step 3: Create branch from inside container**

```bash
docker compose exec scripthammer git checkout -b 050/rls-cleanup-stale
```

Expected: "Switched to a new branch '050/rls-cleanup-stale'"

---

## Task 2: TDD — unit tests for the cleanup function (write failing first)

**Files:**

- Create: `tests/unit/rls-cleanup.test.ts`

- [ ] **Step 1: Create the test file with all 4 cases**

```ts
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
    expect(summary.intentsRemoved).toBe(2);
    expect(summary.subscriptionsRemoved).toBe(2);
    expect(summary.profilesRemoved).toBe(2);
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
    // Summary records the partial cleanup: intents NOT counted, others are.
    expect(summary.intentsRemoved).toBe(0);
    expect(summary.subscriptionsRemoved).toBe(1);
    expect(summary.profilesRemoved).toBe(1);
    expect(summary.usersRemoved).toBe(1);
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
      intentsRemoved: 0,
      subscriptionsRemoved: 0,
      profilesRemoved: 0,
    });
  });
});
```

- [ ] **Step 2: Run the tests, expect failure**

```bash
docker compose exec scripthammer pnpm vitest run tests/unit/rls-cleanup.test.ts
```

Expected: ALL FAIL — `cleanupStaleScripthammerUsers` doesn't exist yet (`Cannot find module` or similar).

---

## Task 3: Implement the pure cleanup function

**Files:**

- Create: `tests/rls/__setup__/cleanup-stale-impl.ts`

- [ ] **Step 1: Create the impl file**

```ts
/**
 * Pure cleanup function for stale `*@scripthammer.test` users (#50).
 *
 * Walks the FK chain (payment_intents → subscriptions → user_profiles
 * → auth deleteUser) for every test-suite user that matches the
 * scripthammer.test domain. Best-effort: errors are logged via the
 * provided logger and the cleanup continues. Returns a summary count.
 *
 * Used by tests/rls/__setup__/cleanup-stale.ts as a Vitest globalSetup.
 *
 * @module tests/rls/__setup__/cleanup-stale-impl
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const SCRIPTHAMMER_TEST_DOMAIN = '@scripthammer.test';

export interface CleanupSummary {
  usersRemoved: number;
  intentsRemoved: number;
  subscriptionsRemoved: number;
  profilesRemoved: number;
}

type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
};

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
};

export async function cleanupStaleScripthammerUsers(
  client: SupabaseClient,
  logger: Logger = noopLogger
): Promise<CleanupSummary> {
  const summary: CleanupSummary = {
    usersRemoved: 0,
    intentsRemoved: 0,
    subscriptionsRemoved: 0,
    profilesRemoved: 0,
  };

  // 1. List all auth users; filter to the scripthammer.test domain.
  const { data: listData, error: listError } =
    await client.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    logger.warn('Cleanup-stale: listUsers failed', {
      error: listError.message,
    });
    return summary;
  }
  const users = (listData?.users ?? []).filter(
    (u: { id: string; email?: string }) =>
      typeof u.email === 'string' && u.email.endsWith(SCRIPTHAMMER_TEST_DOMAIN)
  );
  if (users.length === 0) return summary;

  // 2. For each user, walk the FK chain. Order matters: leaves of the FK
  //    graph first, then the auth user.
  for (const user of users) {
    const userId = user.id;

    // payment_intents (cascade-deletes payment_results via ON DELETE CASCADE)
    const intentsResult = await client
      .from('payment_intents')
      .delete()
      .eq('template_user_id', userId);
    if (intentsResult.error) {
      logger.warn('Cleanup-stale: payment_intents delete failed', {
        userId,
        error: intentsResult.error.message,
      });
    } else {
      summary.intentsRemoved++;
    }

    // subscriptions (leaf w.r.t. auth.users)
    const subsResult = await client
      .from('subscriptions')
      .delete()
      .eq('template_user_id', userId);
    if (subsResult.error) {
      logger.warn('Cleanup-stale: subscriptions delete failed', {
        userId,
        error: subsResult.error.message,
      });
    } else {
      summary.subscriptionsRemoved++;
    }

    // user_profiles (1:1 with auth.users; FK is profiles.id → auth.users.id)
    const profileResult = await client
      .from('user_profiles')
      .delete()
      .eq('id', userId);
    if (profileResult.error) {
      logger.warn('Cleanup-stale: user_profiles delete failed', {
        userId,
        error: profileResult.error.message,
      });
    } else {
      summary.profilesRemoved++;
    }

    // Hard-delete the auth user. shouldSoftDelete=false releases email
    // uniqueness immediately so createTestUser doesn't trip on it.
    const { error: authError } = await client.auth.admin.deleteUser(
      userId,
      false
    );
    if (authError) {
      logger.warn('Cleanup-stale: auth deleteUser failed', {
        userId,
        error: authError.message,
      });
    } else {
      summary.usersRemoved++;
    }
  }

  return summary;
}
```

- [ ] **Step 2: Run the tests, expect pass**

```bash
docker compose exec scripthammer pnpm vitest run tests/unit/rls-cleanup.test.ts
```

Expected: 4/4 PASS.

- [ ] **Step 3: Type-check**

```bash
docker compose exec scripthammer pnpm run type-check
```

Expected: clean (no output after `> tsc --noEmit`).

- [ ] **Step 4: Commit**

```bash
docker compose exec scripthammer git add tests/unit/rls-cleanup.test.ts tests/rls/__setup__/cleanup-stale-impl.ts
docker compose exec scripthammer git commit -m "feat(rls): cleanup-stale impl + 4 regression cases

Pure async function cleanupStaleScripthammerUsers walks the FK chain
(payment_intents → subscriptions → user_profiles → auth.deleteUser)
for every *@scripthammer.test user. Best-effort: errors are logged
and cleanup continues to the next step. Returns a summary count.

Tests pin the contract:
- Chain runs in correct order per user.
- Non-matching emails are never touched (production safety).
- Best-effort: a transient delete error doesn't halt the rest.
- No-op when no scripthammer.test users exist.

Refs #50.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: globalSetup wrapper

**Files:**

- Create: `tests/rls/__setup__/cleanup-stale.ts`

- [ ] **Step 1: Create the wrapper file**

```ts
/**
 * Vitest globalSetup hook that scrubs stale *@scripthammer.test users +
 * their FK-blocking dependent rows before pnpm test:rls runs (#50).
 *
 * Wired in vitest.rls.config.ts. Skips silently when
 * SUPABASE_SERVICE_ROLE_KEY is absent — same gate as the tests'
 * describe.skipIf(!hasRlsTestEnvironment()) — no env, no cleanup.
 *
 * @module tests/rls/__setup__/cleanup-stale
 */

import { createClient } from '@supabase/supabase-js';
import { cleanupStaleScripthammerUsers } from './cleanup-stale-impl';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function setup() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      '[rls cleanup-stale] Skipping (SUPABASE_URL or service key missing)'
    );
    return;
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const consoleLogger = {
    info: (msg: string, meta?: Record<string, unknown>) =>
      console.log(`[rls cleanup-stale] ${msg}`, meta ?? ''),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      console.warn(`[rls cleanup-stale] ${msg}`, meta ?? ''),
  };

  const summary = await cleanupStaleScripthammerUsers(client, consoleLogger);

  if (
    summary.usersRemoved > 0 ||
    summary.intentsRemoved > 0 ||
    summary.subscriptionsRemoved > 0 ||
    summary.profilesRemoved > 0
  ) {
    console.log(
      `[rls cleanup-stale] removed ${summary.usersRemoved} user(s), ${summary.intentsRemoved} intent(s), ${summary.subscriptionsRemoved} subscription(s), ${summary.profilesRemoved} profile(s)`
    );
  }
}
```

- [ ] **Step 2: Type-check**

```bash
docker compose exec scripthammer pnpm run type-check
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
docker compose exec scripthammer git add tests/rls/__setup__/cleanup-stale.ts
docker compose exec scripthammer git commit -m "feat(rls): globalSetup wrapper for cleanup-stale

Constructs a Supabase service client from env, calls
cleanupStaleScripthammerUsers, logs the summary. Skips silently when
SUPABASE_SERVICE_ROLE_KEY is missing — same gate the tests already
use via hasRlsTestEnvironment(). Wired into vitest.rls.config.ts in
the next commit.

Refs #50.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire into vitest.rls.config.ts

**Files:**

- Modify: `vitest.rls.config.ts:14-23`

- [ ] **Step 1: Add globalSetup to the config**

Find the `test:` block in `vitest.rls.config.ts` and add `globalSetup` before `fileParallelism: false`:

```ts
export default defineConfig({
  test: {
    include: ['tests/rls/**/*.test.ts'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    // Scrub stale *@scripthammer.test users + orphan FK rows before any
    // test file collects. Defends against killed prior runs leaving
    // payment_intents that block createTestUser's deleteUser. (#50)
    globalSetup: ['./tests/rls/__setup__/cleanup-stale.ts'],
    // Sequential execution: test files share test users on the same
    // Supabase instance, so parallel runs cause create/delete races.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 2: Run pnpm test:rls against cloud to verify the hook fires and the suite still passes**

(Local Supabase profile must be down or `.env` must point at cloud; the existing setup yesterday showed cloud as the active config.)

```bash
docker compose exec scripthammer pnpm test:rls 2>&1 | tail -30
```

Expected:

- A console line `[rls cleanup-stale] ...` appears at the start (either "Skipping" if env is missing, or the summary if there were stale users to clean, or silence if there were none — note the wrapper only logs the summary line when something was actually cleaned).
- Suite still passes 55/55. The hook is opportunistic; on a clean cloud state it's a no-op.

- [ ] **Step 3: Commit**

```bash
docker compose exec scripthammer git add vitest.rls.config.ts
docker compose exec scripthammer git commit -m "feat(rls): wire cleanup-stale globalSetup into pnpm test:rls

Killed prior runs that left orphan payment_intents/subscriptions/profiles
referencing *@scripthammer.test auth users would wedge createTestUser
in beforeAll because deleteUser hits the FK constraint. The new
globalSetup walks the FK chain before tests collect, so the next
invocation recovers automatically. (#50)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Manual stress verification (orphan injection)

**Files:**

- (none — operator runs SQL manually then `pnpm test:rls`)

This task is documented for the next operator who needs to verify the cleanup works against real residue. It is NOT run as part of the normal CI/PR cycle.

- [ ] **Step 1: Sign in as supabase_admin to local DB**

```bash
docker compose exec -e PGPASSWORD=your-super-secret-and-long-postgres-password supabase-db psql -h 127.0.0.1 -U supabase_admin -d postgres
```

- [ ] **Step 2: Inject a synthetic orphan**

In the psql session, after pnpm test:rls has been run once to create the test users (or after manually creating one), insert an orphan that the existing fixture's deleteUser path can't clean:

```sql
INSERT INTO auth.users (id, email, encrypted_password)
VALUES ('00000000-0000-4000-8000-000000050050', 'test-user-a@scripthammer.test', 'fake');

INSERT INTO payment_intents (template_user_id, amount, currency, type, customer_email)
VALUES ('00000000-0000-4000-8000-000000050050', 1000, 'usd', 'one_time', 'test-user-a@scripthammer.test');
```

- [ ] **Step 3: Run pnpm test:rls and observe**

```bash
docker compose exec scripthammer pnpm test:rls 2>&1 | head -10
```

Expected: a `[rls cleanup-stale] removed 1 user(s), 1 intent(s) ...` log line at the top, and the suite proceeds to 55/55.

Without the cleanup hook, the same setup would produce a `Failed to recreate test user after cleanup` error on the first describe block.

---

## Task 7: Push, open PR, close #50

**Files:**

- (none)

- [ ] **Step 1: Push branch from host**

```bash
git push -u origin 050/rls-cleanup-stale
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --repo TortoiseWolfe/ScriptHammer \
  --base main \
  --head 050/rls-cleanup-stale \
  --title "fix(rls): cleanup-stale globalSetup so killed prior runs don't wedge pnpm test:rls (#50)" \
  --body "Closes #50.

## Summary

Adds a Vitest \`globalSetup\` to \`pnpm test:rls\` that scrubs orphan \`*@scripthammer.test\` users and their FK-blocking dependent rows (\`payment_intents\`, \`subscriptions\`, \`user_profiles\`) before any RLS test file collects. The fixture's \`createTestUser\` retry path remains as the second line of defense; this hook just prevents the FK-block that defeated it on 2026-04-26 (and required manual psql cleanup).

## What changed

- \`tests/rls/__setup__/cleanup-stale-impl.ts\` (new) — pure async function \`cleanupStaleScripthammerUsers(client)\`
- \`tests/rls/__setup__/cleanup-stale.ts\` (new) — globalSetup wrapper
- \`tests/unit/rls-cleanup.test.ts\` (new) — 4 unit tests pinning the FK chain order, production-safety filter, best-effort error handling, and no-op behavior
- \`vitest.rls.config.ts\` — \`globalSetup: ['./tests/rls/__setup__/cleanup-stale.ts']\`

## Out of scope

- Cross-shard E2E messaging issue (#57). Different user pool (\`TEST_USER_PRIMARY_EMAIL\`, env-driven), different problem.
- Per-shard test-user namespace. Withdrawn — no evidence the RLS suite needs it (\`fileParallelism: false\`).

## Test plan

- [x] \`pnpm vitest run tests/unit/rls-cleanup.test.ts\` — 4/4 pass
- [x] \`pnpm test:rls\` against cloud — still 55/55 (no regression on clean state)
- [x] \`pnpm run type-check\` — clean
- [ ] Manual stress test (Task 6 in plan): inject orphan via SQL, observe cleanup log line + 55/55 pass. Documented for future operators; not gated on this PR.

## Spec + design

\`docs/superpowers/specs/2026-04-27-rls-cleanup-stale-design.md\` (commit in this branch).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Wait for CI; merge if green**

Watch the PR's CI runs (E2E + Accessibility + main CI). If all green, squash-merge with `--delete-branch`. Closing #50 happens automatically via the PR body.

- [ ] **Step 4: Sync local main, prune merged branch**

```bash
docker compose exec scripthammer git checkout main
git fetch --prune origin
git merge --ff-only origin/main
git branch -D 050/rls-cleanup-stale
```

---

## Self-review

**Spec coverage:**

- Pure cleanup function (Spec Architecture #1): Task 3 ✓
- globalSetup wrapper (Spec Architecture #2): Task 4 ✓
- Vitest config wire-up (Spec Architecture #3): Task 5 ✓
- DELETE chain (payment_intents → subscriptions → user_profiles → auth.deleteUser): Task 3 step 1 + Task 2 test 1 ✓
- Production-safety filter (`@scripthammer.test` only): Task 3 step 1 + Task 2 test 2 ✓
- Best-effort semantics: Task 3 step 1 (each step's error is logged, summary tracks partial counts) + Task 2 test 3 ✓
- No-op on empty: Task 3 step 1 (early-return) + Task 2 test 4 ✓
- Verification empirical pass criteria from spec (4 unit tests + cloud no-regression + manual stress): Tasks 2, 5, 6 respectively ✓

**Placeholder scan:** No "TBD", "TODO", "implement later." All code blocks contain complete content. ✓

**Type consistency:**

- `cleanupStaleScripthammerUsers` defined in Task 3, imported in Task 2 (test) and Task 4 (wrapper). Same signature: `(client, logger?) => Promise<CleanupSummary>`. ✓
- `CleanupSummary` shape `{usersRemoved, intentsRemoved, subscriptionsRemoved, profilesRemoved}` consistent across Task 3 (definition) and Task 2 (assertions). ✓
- The mocked client in Task 2 implements only the surface the impl uses (`auth.admin.listUsers`, `auth.admin.deleteUser`, `from(table).delete().eq(col, val)`). Matches Task 3's actual usage. ✓

**Frequent commits:** 4 commits across tasks 3-5 (impl+tests, wrapper, config). Plus the PR-and-close in Task 7. ✓

**TDD:** Tests precede implementation in Tasks 2 → 3. ✓

---

## Execution notes

- The `tests/rls/__setup__/` directory is new. Vitest's `include` pattern is `tests/rls/**/*.test.ts`, so `__setup__/cleanup-stale.ts` and `__setup__/cleanup-stale-impl.ts` won't be collected as test files (no `.test.` suffix). The unit test for the impl lives at `tests/unit/rls-cleanup.test.ts`, which runs under the main `vitest.config.ts` — that's the right home (it doesn't need a live Supabase, only a mocked client).
- Vitest's `globalSetup` runs once per `vitest run` invocation, not per test file. That matches what we want: clean once at the start of the suite.
- The mock client in Task 2 doesn't implement Supabase's full fluent API — only the slice the impl uses. If the impl changes shape (e.g., adds a `.match()` filter instead of `.eq()`), the mock needs an update. Task 2's test 1 should then fail loudly because the chain returns `undefined`.
