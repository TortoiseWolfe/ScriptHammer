# Offline Queue: Watchdog Reclaim + Idempotency

**Date**: 2026-04-27 · **Tracks**: [#52](https://github.com/TortoiseWolfe/ScriptHammer/issues/52) (Family A2 in [`docs/STABILITY-TRACKING.md`](../../STABILITY-TRACKING.md))

## Context

`src/lib/offline-queue/base-queue.ts:214-247` atomically claims a queue item via Dexie's implicit transaction (`where().and(pending).modify({status:'processing'})`), but the subsequent `await this.processItem(item)` and the completion update span tabs without a single transaction.

Two failure modes follow from this:

1. **Stuck `processing` rows.** A tab that crashes after claiming an item but before the completion update leaves the item in `processing` forever. The claim guard requires `status === 'pending'`, so no other tab will ever re-claim it. The user's payment-intent or message is in limbo.

2. **Double-charge if we naively retry.** If a watchdog blindly resets stuck `processing` rows to `pending` to fix #1, a tab might retry an INSERT whose previous attempt actually succeeded server-side — producing a duplicate `payment_intents` row. The user gets charged twice.

Today, neither watchdog nor idempotency exist, so the failure mode is "in limbo" rather than "double charge." The honest fix has to address both: introduce reclaim **and** introduce idempotency on the receiving end. Doing only one is worse than doing neither.

The intended outcome is: **at-least-once delivery + idempotent receiver = exactly-once observable outcome.** No "exactly-once" myth in the queue itself.

## Scope

In:

- `payment_intents` INSERT path (the only `processItem` implementation that creates server-side rows currently)
- `base-queue.ts` watchdog + completed/conflicted accounting
- Schema change to monolithic migration (`payment_intents.idempotency_key`)

Out:

- Messaging offline queue — separate service, separate concerns (encryption, FIFO). Filed separately if/when the same shape bites.
- `subscription_update` operation in `payment-adapter` — UPDATE has implicit idempotency by primary key. No change needed.
- Backfill of historical `payment_intents` rows — they expire at 24h per the existing `expires_at DEFAULT NOW() + INTERVAL '24 hours'`.
- DRYing `BaseOfflineQueue` against the messaging service. Premature.

## Architecture

Four changes across three concerns (schema, queue base, payment adapter); each isolated, but they must land together because shipping reclaim without idempotency creates double-charges.

### Change 1: Schema — add idempotency key to `payment_intents`

In `supabase/migrations/20251006_complete_monolithic_setup.sql`, in the `payment_intents` section (after the table definition, before the COMMENT at line 54):

```sql
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_idempotency_key
  ON payment_intents(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**Partial unique index** (the `WHERE` clause): only enforces uniqueness when `idempotency_key` is set. Pre-existing rows and any future direct-server INSERT (admin tooling, edge functions) that don't supply a key remain valid. Only client-queued INSERTs participate in dedupe.

**No NOT NULL + DEFAULT.** Pre-existing rows would need backfill; admin tooling would need a contract change; both for zero benefit since only the offline-queue path uses dedupe.

**Client-generated UUID, not server-side default.** The whole point is the **same** key reused across retries. A server default would generate a fresh key on every attempt, defeating dedupe.

Applied locally via `docker compose exec supabase-db psql`; applied to cloud via Supabase Management API per CLAUDE.md.

### Change 2: Watchdog reclaim in `base-queue.ts`

Add `processingTimeoutMs?: number` (default `60_000`) to `QueueConfig` in `types.ts`. At the top of `sync()`, before the existing `for (const item of pending)` loop, sweep stale `processing` rows:

```ts
const now = Date.now();
const reclaimedCount = await this.items
  .where('status')
  .equals('processing')
  .and(
    (row) =>
      !!row.lastAttempt &&
      now - row.lastAttempt > this.config.processingTimeoutMs
  )
  .modify({ status: 'pending' as QueueStatus });
if (reclaimedCount > 0) {
  this.logger.warn('Reclaimed stuck processing items', {
    count: reclaimedCount,
  });
}
```

Then re-fetch `pending` so reclaimed items participate in this sync. The reclaim is itself an atomic Dexie modify, safe across tabs.

The default 60s is generous enough that most successful operations complete first time and don't get reclaimed during legitimate slow networks. It's also short enough that a true crash recovers within a normal user session.

### Change 3: Conflict-aware accounting

Change `processItem`'s contract so it can return `{ status: 'completed' | 'conflicted' } | void`:

- `void` (existing) → treated as `{ status: 'completed' }` for backwards compatibility
- `{ status: 'completed' }` → fresh work succeeded
- `{ status: 'conflicted' }` → ON CONFLICT triggered server-side; a prior attempt already inserted the row; we read the existing id back. Queue row marked `completed`; metrics distinguish conflicts.

In `base-queue.ts`, change the `try` block:

```ts
const result = await this.processItem(item);
const completionStatus = result?.status ?? 'completed';

await this.items.update(item.id!, { status: 'completed' } as any);

if (completionStatus === 'conflicted') {
  this.logger.info('Item completed via dedupe (server already had this work)', {
    id: item.id,
  });
  conflicted++;
} else {
  success++;
}
```

`SyncResult` gains `conflicted: number` field.

### Change 4: payment-adapter.ts — generate key, ON CONFLICT INSERT

Two changes in `executePaymentIntent`:

1. The `idempotency_key` flows through `data` (the queue item's payload). Callers (the `queuePaymentIntent` method or any future intake) should generate via `crypto.randomUUID()` at queue-time. If absent, generate one inside `executePaymentIntent` itself before the INSERT — defensive but logs a warning since this means a retry would generate a fresh key (no dedupe).

2. The INSERT becomes an upsert with `ignoreDuplicates`:

```ts
const { data: inserted, error } = await supabase
  .from('payment_intents')
  .upsert(
    {
      amount: data.amount as number,
      currency: data.currency as string,
      type: data.type as string,
      interval: (data.interval as string) || null,
      customer_email: data.customer_email as string,
      description: (data.description as string) || null,
      metadata: (data.metadata || {}) as Json,
      template_user_id: userId,
      idempotency_key: idempotencyKey,
    },
    { onConflict: 'idempotency_key', ignoreDuplicates: true }
  )
  .select('id')
  .maybeSingle();

if (error) throw new Error(`Failed to create payment intent: ${error.message}`);

if (!inserted) {
  // ON CONFLICT DO NOTHING fired — a prior attempt already created this row.
  return { status: 'conflicted' as const };
}

return { status: 'completed' as const };
```

Why upsert with ignoreDuplicates and not a direct `.insert()` with `prefer: 'return=representation'` and a manual conflict check: the upsert maps to `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING` server-side, which is exactly the contract we want. Doing it as two queries (insert, then on error select) creates a TOCTOU window.

## Tests

Add to `src/lib/offline-queue/__tests__/base-queue.test.ts` (existing file):

1. **Watchdog reclaims stuck processing**: queue item; manually set `status: processing` + `lastAttempt: 70_000ms ago` via direct Dexie write; call `sync()`; assert item ends `completed` and the watchdog-warn log was emitted.

2. **Watchdog leaves fresh processing alone**: queue item; set `processing` + `lastAttempt: 30_000ms ago`; call `sync()`; assert item stayed `processing`. Tab-collision invariant: another tab calling `sync()` simultaneously does not double-process.

3. **Conflicted return is treated as completed**: mock `processItem` to return `{ status: 'conflicted' }`; sync; assert queue row is `completed` and `SyncResult.conflicted === 1` and `SyncResult.success === 0`.

Add to `src/lib/offline-queue/__tests__/payment-adapter.test.ts` (create if missing):

4. **Queueing same idempotency_key twice produces one DB row**: queue → sync → directly mark queue row `pending` again (simulating a watchdog reclaim) → sync → query mocked Supabase: only one upsert call landed; both queue entries end `completed`.

5. **Missing idempotency_key generates one and warns**: queue an item with no `idempotency_key` in data; sync; assert a key was generated, warn was logged, INSERT proceeded.

## Verification

End-to-end pass criteria:

1. `pnpm vitest run src/lib/offline-queue/__tests__/` — all green, including the 5 new cases.
2. `docker compose exec supabase-db psql -U postgres -d postgres -c "\d payment_intents"` shows `idempotency_key TEXT` column and `idx_payment_intents_idempotency_key` partial unique index.
3. `pnpm test:rls` — still 55/55 (RLS policies unaffected by column addition).
4. `pnpm run type-check` + `pnpm exec eslint src/lib/offline-queue/` — clean.
5. The migration file is still a single monolithic source — no separate migration file created.

## Critical files

| File                                                         | Action                                                                                                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `supabase/migrations/20251006_complete_monolithic_setup.sql` | Add `idempotency_key` column + partial unique index in `payment_intents` section                                                                               |
| `src/lib/offline-queue/types.ts`                             | Add `processingTimeoutMs?` to `QueueConfig`, default 60_000 in `DEFAULT_QUEUE_CONFIG`. Add `conflicted: number` to `SyncResult`.                               |
| `src/lib/offline-queue/base-queue.ts`                        | Watchdog reclaim at top of `sync()`; conflict-aware accounting in the try-block; new abstract type for `processItem` return value (backwards compat with void) |
| `src/lib/offline-queue/payment-adapter.ts`                   | Generate `idempotency_key` at queue-time; upsert with `ignoreDuplicates`; return `{status: completed                                                           | conflicted}` |
| `src/lib/offline-queue/__tests__/base-queue.test.ts`         | 3 new test cases (watchdog reclaim, leave fresh alone, conflicted handling)                                                                                    |
| `src/lib/offline-queue/__tests__/payment-adapter.test.ts`    | 2 new test cases (dedupe across retries, missing-key fallback) — create file if missing                                                                        |

## Reused, not reinvented

- `crypto.randomUUID()` (already used elsewhere in the project)
- Dexie's atomic `where().and().modify()` pattern (used at `base-queue.ts:221-228`)
- Supabase JS upsert with `onConflict` + `ignoreDuplicates` (matches the `webhook_events` table's existing `UNIQUE INDEX (provider, provider_event_id)` precedent at line 150 of the migration)
- `BaseOfflineQueue` test fixtures in `__tests__/`

## Out of scope (explicit)

- Messaging offline queue (`src/services/messaging/offline-queue-service.ts`) — different design surface
- Backfill of pre-existing `payment_intents` rows — they expire at 24h
- Generic `useAuthGate`-style refactor across queue subclasses
- A unified Edge Function for "create-payment-intent-with-idempotency" — not needed; the table-level constraint suffices

If the regression test cases reveal that Dexie's atomic modify isn't actually atomic across tabs in practice (browser-implementation differences), the follow-up is a leader-election lock using `navigator.locks.request()`, but that's a separate scope and only justified by empirical failure.
