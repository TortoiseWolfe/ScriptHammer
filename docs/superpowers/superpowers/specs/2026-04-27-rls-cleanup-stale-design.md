# RLS Test Suite: Cleanup-Stale Hook

**Date**: 2026-04-27 · **Tracks**: [#50](https://github.com/TortoiseWolfe/ScriptHammer/issues/50) (Family D1 in [`docs/STABILITY-TRACKING.md`](../../STABILITY-TRACKING.md))

## Context

`pnpm test:rls` against cloud Supabase fails on `beforeAll` if a prior run died mid-test and left orphan rows that block deletion of the canonical `*@scripthammer.test` users. The fixture's `afterAll` cleanup is correct for _successful_ runs; what's missing is recovery from killed runs.

This was observed concretely during #44 verification on 2026-04-26: cloud had two stale `*@scripthammer.test` users from a 2026-04-16 run with one orphaned `payment_intents` row referencing `userA`. The user delete failed with `payment_intents_template_user_id_fkey` (FK constraint), wedging every test file that called `createTestUser('test-user-a@scripthammer.test', …)` in its `beforeAll`. The fixture's existing recovery path (`tests/fixtures/test-users.ts:171-201`) tries delete-then-recreate, but the `deleteUser` call hits the same FK and gives up.

Today's behaviour: the next operator who runs `pnpm test:rls` against a stale-cloud-state has to manually grep for orphan FKs, delete dependent rows in the right order, then delete the user. (I did this yesterday — it works, but it's wrong to require it.)

The intended outcome: a Vitest `globalSetup` hook scrubs `*@scripthammer.test` orphan FKs before any RLS test file collects. Killed runs become recoverable on the next invocation; the operator never has to know the chain.

## Scope clarification (vs. yesterday's framing)

In a comment on #50 yesterday I proposed expanding scope to cover the E2E messaging shards too, on the hypothesis that they shared test users with the RLS suite. **That hypothesis was wrong.** The E2E suite uses env-configured users (`TEST_USER_PRIMARY_EMAIL`, typically `test@example.com`); the RLS suite uses hardcoded `*@scripthammer.test` users. Two different user pools, two different lifecycles, two different surfaces. The chromium-msg failure pattern tracked in #57 is something else (likely Supabase Realtime, Stripe rate-limit, or storageState corruption — TBD).

This spec narrows back to the original #50 scope: **RLS fixture cleanup-stale hook only**. #57 stays open as its own investigation.

## Architecture

One file, one pure function, one config wire-up. Each unit has one responsibility:

1. **Pure cleanup function** — `tests/rls/__setup__/cleanup-stale-impl.ts`. Takes a Supabase service client, deletes the FK chain for every `*@scripthammer.test` auth user, then deletes the users. Returns a count summary. No I/O beyond Supabase calls. Unit-testable in isolation.

2. **globalSetup wrapper** — `tests/rls/__setup__/cleanup-stale.ts`. Constructs a service client from env, calls the impl, logs the summary. Skips silently when `SUPABASE_SERVICE_ROLE_KEY` is absent (matches `hasRlsTestEnvironment()` semantics — no env, no cleanup, just like the tests themselves skip).

3. **Vitest config** — `vitest.rls.config.ts` gains `globalSetup: ['./tests/rls/__setup__/cleanup-stale.ts']`.

### The DELETE chain

Per the FK constraints in `supabase/migrations/20251006_complete_monolithic_setup.sql`:

- `payment_results.intent_id` → `payment_intents.id` (line 59 of migration; `ON DELETE CASCADE`)
- `payment_intents.template_user_id` → `auth.users.id` (line 37; no cascade — direct FK pressure)
- `subscriptions.template_user_id` → `auth.users.id` (line 84; no cascade — direct FK pressure)
- `user_profiles.id` → `auth.users.id` (1:1, no cascade — direct FK pressure)

Order:

1. `DELETE FROM payment_intents WHERE template_user_id = <userId>` (cascade-deletes `payment_results`)
2. `DELETE FROM subscriptions WHERE template_user_id = <userId>` (no cascade needed; subs is leaf)
3. `DELETE FROM user_profiles WHERE id = <userId>` (no cascade needed; profile is leaf)
4. `auth.admin.deleteUser(userId, shouldSoftDelete=false)` (hard delete to release email uniqueness immediately)

Steps 1–3 use service-role REST (PostgREST) for bulk efficiency. Step 4 uses the auth admin API.

### What's not deleted

- `auth_audit_logs` rows — schema has no FK back; they age out via the existing `cleanup_old_audit_logs()` function (90-day retention). Deleting them on every test run would distort metrics if/when #49 lands.
- `rate_limit_attempts` — same shape (no FK).
- `webhook_events`, `payment_provider_config` — no `template_user_id`, no relevant ownership.

### Best-effort semantics

If any individual DELETE fails (network blip, transient Supabase error), log it and continue. The fixture's `createTestUser` retry path is the second line of defense; we just want to give it a head start. The cleanup is _not_ a hard prerequisite for tests passing — it's an opportunistic hygiene step.

## Tests

`tests/unit/rls-cleanup.test.ts` (new, runs under main `vitest.config.ts`):

1. **Cleanup deletes in correct FK order**: mock service client, call `cleanupStaleScripthammerUsers(client)` against a 2-user fixture (no real auth), assert the call sequence is `payment_intents → subscriptions → user_profiles → auth.admin.deleteUser` per user.
2. **Cleanup ignores non-matching emails**: include a `prod@example.com` user in `listUsers` mock, assert it's never touched.
3. **Cleanup is best-effort**: simulate a `payment_intents` DELETE error, assert the function continues to subscriptions/user_profiles/deleteUser and returns the partial-cleanup summary.
4. **Cleanup is a no-op when no `*@scripthammer.test` users exist**: empty user list, assert no DELETE calls fired.

`vitest.rls.config.ts`'s globalSetup invocation is verified empirically — running `pnpm test:rls` against a cloud instance with deliberately-injected orphan rows should clean them and let the suite proceed. (We won't unit-test the wiring itself; the cost-to-benefit is wrong.)

## Verification

End-to-end pass criteria:

1. `pnpm vitest run tests/unit/rls-cleanup.test.ts` — 4/4 green.
2. `pnpm test:rls` against cloud — still 55/55 (no behavior regression on a clean cloud state).
3. Manual stress test: insert an orphan `payment_intents` referencing `test-user-a@scripthammer.test` via SQL, run `pnpm test:rls`. The globalSetup logs `[rls cleanup-stale] removed 1 user(s); 0 error(s) logged`, the suite passes. (Manual because it requires deliberate state perturbation; not worth automating.)

### Note on summary count semantics

The `CleanupSummary` shape settled on during implementation differs from an earlier draft of this spec. PostgREST DELETE returns success regardless of whether any rows actually matched, so per-table "removed" counts (`intentsRemoved`, `subscriptionsRemoved`, etc.) would have been misleading — the operator would see "1 intent removed" for a stale user that had no intents. Replaced with two honest fields:

- `usersRemoved`: count from `auth.admin.deleteUser` successes (the one DELETE whose success/failure carries real signal — the user either existed or didn't)
- `errorsLogged`: count of per-table errors logged (non-fatal; cleanup continues)

The unit tests assert against this shape.

## Critical files

| File                                        | Action                                         |
| ------------------------------------------- | ---------------------------------------------- |
| `tests/rls/__setup__/cleanup-stale.ts`      | Create — Vitest globalSetup wrapper, ~15 lines |
| `tests/rls/__setup__/cleanup-stale-impl.ts` | Create — pure cleanup function, ~80 lines      |
| `tests/unit/rls-cleanup.test.ts`            | Create — unit tests for the impl, ~80 lines    |
| `vitest.rls.config.ts`                      | Modify — add `globalSetup` array, +1 line      |

## Reused, not reinvented

- `createServiceClient()` from `tests/fixtures/test-users.ts:95-106` — same pattern, same env contract
- `hasRlsTestEnvironment()` from `tests/fixtures/test-users.ts:34-38` — used to gate cleanup just like tests gate
- The `Database` type from `@/lib/supabase/types` — same client typing as the fixtures use

## Out of scope (explicit)

- E2E messaging cross-shard issue (#57) — different user pool, different problem
- Per-shard test-user namespace — withdrawn (no evidence it's needed at the RLS layer; `fileParallelism: false`)
- Backfill cleanup of `auth_audit_logs` for stale users — different concern
- Changes to `tests/fixtures/test-users.ts` — `createTestUser`'s retry path stays exactly as-is; this hook just prevents the FK-block that defeats it
- A unified Edge Function for "scrub-test-users" — not needed; service-role REST + admin API are what's there
