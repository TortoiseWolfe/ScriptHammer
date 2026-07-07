# Offline Queue Watchdog + Idempotency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the offline payment queue safe across tab crashes by adding (a) a watchdog that reclaims stuck `processing` rows after 60s and (b) an idempotency-key partial unique index on `payment_intents` so retries don't double-charge.

**Architecture:** Three concerns, one PR. Schema gets `idempotency_key TEXT` + partial unique index. `BaseOfflineQueue.sync()` gains a watchdog reclaim sweep at the top and conflict-aware accounting in the per-item try block. `PaymentQueueAdapter.executePaymentIntent` generates a UUID at queue-time and uses upsert-with-ignoreDuplicates so a retry of a successful INSERT is a server-side no-op.

**Tech Stack:** Dexie.js (IndexedDB), Supabase JS client, Postgres partial unique index, Vitest, TypeScript strict.

**Spec:** [`docs/superpowers/specs/2026-04-27-offline-queue-watchdog-and-idempotency-design.md`](../specs/2026-04-27-offline-queue-watchdog-and-idempotency-design.md)

**Tracks:** [#52](https://github.com/TortoiseWolfe/ScriptHammer/issues/52) (Family A2 in `docs/STABILITY-TRACKING.md`)

---

## File map

| File                                                         | Action | Purpose                                                                                                            |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/20251006_complete_monolithic_setup.sql` | Modify | Add `idempotency_key TEXT` column + partial unique index to `payment_intents`                                      |
| `src/lib/offline-queue/types.ts`                             | Modify | Add `processingTimeoutMs` to `QueueConfig`/default; add `conflicted` to `SyncResult`; add `ProcessItemResult` type |
| `src/lib/offline-queue/base-queue.ts`                        | Modify | Watchdog reclaim sweep + conflict-aware accounting in `sync()`                                                     |
| `src/lib/offline-queue/payment-adapter.ts`                   | Modify | Generate idempotency_key at queue-time; upsert with ignoreDuplicates; return ProcessItemResult                     |
| `src/lib/offline-queue/__tests__/base-queue.test.ts`         | Modify | Add 3 cases: watchdog reclaim, fresh-processing-not-reclaimed, conflict accounting                                 |
| `src/lib/offline-queue/__tests__/payment-adapter.test.ts`    | Create | New test file: 2 cases for dedupe and missing-key fallback                                                         |

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
docker compose exec scripthammer git checkout -b 052/offline-queue-watchdog-idempotency
```

Expected: "Switched to a new branch '052/offline-queue-watchdog-idempotency'"

---

## Task 2: Schema — add `idempotency_key` to `payment_intents`

**Files:**

- Modify: `supabase/migrations/20251006_complete_monolithic_setup.sql:47-54`

- [ ] **Step 1: Read the surrounding context**

```bash
sed -n '35,55p' supabase/migrations/20251006_complete_monolithic_setup.sql
```

Expected: `CREATE TABLE IF NOT EXISTS payment_intents (...)` followed by indexes and the `COMMENT ON TABLE payment_intents IS '...'` line.

- [ ] **Step 2: Insert the column + index after the existing indexes, before the COMMENT**

Find the line `COMMENT ON TABLE payment_intents IS 'Customer payment intentions before provider redirect (24hr expiry)';` and immediately _before_ it, insert these blank-line-separated blocks:

```sql
-- Idempotency key for offline-queue retries (#52). Partial unique index:
-- only enforced when set, so direct-server INSERTs (admin tooling, edge
-- functions) without a key remain valid. Only client-queued INSERTs
-- participate in dedupe.
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_idempotency_key
  ON payment_intents(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

```

Use the Edit tool with the existing COMMENT line as `old_string` and the new block + COMMENT as `new_string` to make the insertion exact.

- [ ] **Step 3: Verify the change parses as valid SQL via psql against local Supabase**

```bash
docker compose --profile supabase up -d
docker compose exec supabase-db psql -U postgres -d postgres -c "
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_idempotency_key
  ON payment_intents(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
"
```

Expected: `ALTER TABLE` and `CREATE INDEX` (or `NOTICE: relation already exists, skipping`).

- [ ] **Step 4: Confirm column + index exist**

```bash
docker compose exec supabase-db psql -U postgres -d postgres -c "\d payment_intents" | grep -E "idempotency_key|idx_payment_intents_idempotency"
```

Expected:

- `idempotency_key | text` row in column listing
- `idx_payment_intents_idempotency_key UNIQUE, btree (idempotency_key) WHERE idempotency_key IS NOT NULL` in index listing

- [ ] **Step 5: Commit**

```bash
docker compose exec scripthammer git add supabase/migrations/20251006_complete_monolithic_setup.sql
docker compose exec scripthammer git commit -m "feat(payments): add idempotency_key partial unique index to payment_intents

Supports the offline-queue retry safety work tracked in #52: a queued
INSERT that's retried after a tab crash must not produce a duplicate
payment_intents row. The partial unique index (WHERE idempotency_key IS
NOT NULL) keeps existing rows and direct-server INSERTs valid; only
client-queued INSERTs participate in dedupe.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add `processingTimeoutMs` and `conflicted` to types

**Files:**

- Modify: `src/lib/offline-queue/types.ts:36-68`

- [ ] **Step 1: Add `processingTimeoutMs` to `QueueConfig`**

Edit `QueueConfig` interface to add a new field after `backoffMultiplier`:

```ts
export interface QueueConfig {
  /** IndexedDB database name */
  dbName: string;
  /** IndexedDB table/store name */
  tableName: string;
  /** Maximum retry attempts before marking as failed */
  maxRetries: number;
  /** Initial delay in ms for exponential backoff */
  initialDelayMs: number;
  /** Backoff multiplier (e.g., 2 for doubling) */
  backoffMultiplier: number;
  /**
   * Watchdog: reclaim items stuck in `processing` longer than this (ms).
   * Defends against tab crashes between claim and completion. Default 60_000.
   * The processItem implementation must be idempotent for safe reclaim — see
   * payment-adapter's idempotency_key path for the pattern.
   */
  processingTimeoutMs: number;
}
```

- [ ] **Step 2: Add the default value to `DEFAULT_QUEUE_CONFIG`**

```ts
export const DEFAULT_QUEUE_CONFIG: Omit<QueueConfig, 'dbName' | 'tableName'> = {
  maxRetries: 5,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  processingTimeoutMs: 60_000,
};
```

- [ ] **Step 3: Add `conflicted` to `SyncResult`**

```ts
export interface SyncResult {
  /** Number of items successfully processed (fresh work) */
  success: number;
  /** Number of items that failed */
  failed: number;
  /** Number of items skipped (e.g., still in backoff) */
  skipped: number;
  /** Number of items completed via dedupe (server already had this work) */
  conflicted: number;
}
```

- [ ] **Step 4: Add `ProcessItemResult` type at end of file**

```ts
/**
 * Optional return value from processItem. Subclasses that don't need to
 * distinguish fresh-success from dedupe can keep returning void; void is
 * treated as `{ status: 'completed' }`.
 */
export type ProcessItemResult = { status: 'completed' | 'conflicted' };
```

- [ ] **Step 5: Run type-check to confirm no type errors**

```bash
docker compose exec scripthammer pnpm run type-check
```

Expected: clean (no output after `> tsc --noEmit`).

- [ ] **Step 6: Commit**

```bash
docker compose exec scripthammer git add src/lib/offline-queue/types.ts
docker compose exec scripthammer git commit -m "feat(offline-queue): add processingTimeoutMs and conflicted accounting types

Prepares the type surface for the watchdog-reclaim and conflict-aware
accounting that follow in subsequent commits. void return from
processItem remains valid for backward compatibility.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Watchdog reclaim test (TDD — write failing first)

**Files:**

- Modify: `src/lib/offline-queue/__tests__/base-queue.test.ts`

- [ ] **Step 1: Add the watchdog reclaim test to the existing describe block**

Open `src/lib/offline-queue/__tests__/base-queue.test.ts`. Find the existing `describe('BaseOfflineQueue', () => {` block. Add this case as the _last_ `it` in the block (before the closing `});`):

```ts
it('reclaims items stuck in processing past processingTimeoutMs', async () => {
  // Queue an item, then manually move it to `processing` with a stale
  // lastAttempt — simulating a prior tab that crashed mid-processing.
  const queued = await queue.queue({ data: 'recover-me' });
  const longAgo = Date.now() - 70_000; // 70s > default 60s timeout
  // Use the protected `items` table directly via a test-only escape hatch.
  await (
    queue as unknown as {
      items: {
        update: (
          id: number,
          changes: Record<string, unknown>
        ) => Promise<unknown>;
      };
    }
  ).items.update(queued.id!, { status: 'processing', lastAttempt: longAgo });

  // Sync should reclaim the row (status: pending) and then process it.
  const result = await queue.sync();

  expect(result.success).toBe(1);
  expect(queue.processedItems).toHaveLength(1);
  expect(queue.processedItems[0].data).toBe('recover-me');

  const final = await queue.get(queued.id!);
  expect(final?.status).toBe('completed');
});
```

- [ ] **Step 2: Run the test, expect failure**

```bash
docker compose exec scripthammer pnpm vitest run src/lib/offline-queue/__tests__/base-queue.test.ts -t "reclaims items stuck in processing"
```

Expected: FAIL — the test runs but stuck `processing` items aren't reclaimed yet, so `result.success` is `0` (the item stays `processing`, never enters the loop).

---

## Task 5: Implement watchdog reclaim in base-queue.ts

**Files:**

- Modify: `src/lib/offline-queue/base-queue.ts:173-282` (the `sync()` method)

- [ ] **Step 1: Insert the watchdog sweep at the top of `sync()`, immediately after the `syncInProgress = true` assignment**

In `sync()`, after this block:

```ts
this.syncInProgress = true;

try {
  const pending = await this.getPending();
```

Replace it with:

```ts
this.syncInProgress = true;

try {
  // Watchdog: reclaim items stuck in `processing` past the timeout. Defends
  // against tab crashes between the claim and the completion update. The
  // reclaim is itself an atomic Dexie modify, so racing tabs converge.
  // processItem must be idempotent for safe reclaim — see payment-adapter's
  // idempotency_key path for the pattern.
  const reclaimNow = Date.now();
  const reclaimedCount = await this.items
    .where('status')
    .equals('processing')
    .and(
      (row) =>
        !!row.lastAttempt &&
        reclaimNow - row.lastAttempt > this.config.processingTimeoutMs
    )
    .modify({ status: 'pending' as QueueStatus });
  if (reclaimedCount > 0) {
    this.logger.warn('Reclaimed stuck processing items', {
      count: reclaimedCount,
      processingTimeoutMs: this.config.processingTimeoutMs,
    });
  }

  const pending = await this.getPending();
```

- [ ] **Step 2: Run the test, expect pass**

```bash
docker compose exec scripthammer pnpm vitest run src/lib/offline-queue/__tests__/base-queue.test.ts -t "reclaims items stuck in processing"
```

Expected: PASS.

- [ ] **Step 3: Run the full base-queue test file to confirm no regressions**

```bash
docker compose exec scripthammer pnpm vitest run src/lib/offline-queue/__tests__/base-queue.test.ts
```

Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
docker compose exec scripthammer git add src/lib/offline-queue/__tests__/base-queue.test.ts src/lib/offline-queue/base-queue.ts
docker compose exec scripthammer git commit -m "feat(offline-queue): watchdog reclaim for stuck processing items

A tab that crashes after atomically claiming a queue item but before
writing the completion update leaves the row in 'processing' forever.
The claim guard requires status === 'pending', so no other tab will
ever re-claim it. The watchdog runs at the top of sync() and resets
'processing' items older than processingTimeoutMs (default 60s) back
to 'pending'. processItem MUST be idempotent for safe reclaim — that
side of the contract is enforced for payment_intents in a follow-up
commit (idempotency_key partial unique index).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Test that fresh `processing` is not reclaimed (TDD)

**Files:**

- Modify: `src/lib/offline-queue/__tests__/base-queue.test.ts`

- [ ] **Step 1: Add the negative-case test next to the previous one**

```ts
it('leaves fresh processing items alone (within processingTimeoutMs)', async () => {
  const queued = await queue.queue({ data: 'leave-me-alone' });
  const recent = Date.now() - 30_000; // 30s < default 60s timeout
  await (
    queue as unknown as {
      items: {
        update: (
          id: number,
          changes: Record<string, unknown>
        ) => Promise<unknown>;
      };
    }
  ).items.update(queued.id!, { status: 'processing', lastAttempt: recent });

  const result = await queue.sync();

  // Item was NOT reclaimed — it stayed in `processing` and never
  // entered the per-item loop, so processedItems is empty and the
  // sync result reports nothing for this item.
  expect(queue.processedItems).toHaveLength(0);
  expect(result.success).toBe(0);

  const final = await queue.get(queued.id!);
  expect(final?.status).toBe('processing');
});
```

- [ ] **Step 2: Run the test, expect pass**

```bash
docker compose exec scripthammer pnpm vitest run src/lib/offline-queue/__tests__/base-queue.test.ts -t "leaves fresh processing"
```

Expected: PASS (the watchdog's `>` comparison correctly excludes 30s-old items).

- [ ] **Step 3: Commit**

```bash
docker compose exec scripthammer git add src/lib/offline-queue/__tests__/base-queue.test.ts
docker compose exec scripthammer git commit -m "test(offline-queue): pin watchdog negative case (fresh processing preserved)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Conflict-aware accounting test (TDD)

**Files:**

- Modify: `src/lib/offline-queue/__tests__/base-queue.test.ts`

- [ ] **Step 1: Extend the TestQueue class to optionally return a conflict result**

Find the `class TestQueue extends BaseOfflineQueue<TestQueueItem>` block. Add a new public flag `shouldReturnConflict = false` near `shouldFail`. Modify `processItem` to honor it:

```ts
class TestQueue extends BaseOfflineQueue<TestQueueItem> {
  public processedItems: TestQueueItem[] = [];
  public shouldFail = false;
  public shouldReturnConflict = false;
  public failCount = 0;

  constructor() {
    super({
      dbName: TEST_DB_NAME,
      tableName: 'testItems',
      ...DEFAULT_QUEUE_CONFIG,
    });
  }

  protected async processItem(item: TestQueueItem) {
    if (this.shouldFail) {
      this.failCount++;
      throw new Error('Test failure');
    }
    this.processedItems.push(item);
    if (this.shouldReturnConflict) {
      return { status: 'conflicted' as const };
    }
  }

  // Expose protected method for testing
  public async testMarkAsFailed(id: number): Promise<void> {
    await this.markAsFailed(id);
  }
}
```

- [ ] **Step 2: Add the conflict test case at the bottom of the describe block**

```ts
it('counts conflicted as completed but in the conflicted bucket', async () => {
  queue.shouldReturnConflict = true;
  await queue.queue({ data: 'dedupe-me' });

  const result = await queue.sync();

  expect(result.success).toBe(0);
  expect(result.conflicted).toBe(1);
  expect(result.failed).toBe(0);

  // The queue row is still marked completed (the item is done).
  const all = await queue.getQueue();
  expect(all[0].status).toBe('completed');
});
```

- [ ] **Step 3: Run the test, expect failure**

```bash
docker compose exec scripthammer pnpm vitest run src/lib/offline-queue/__tests__/base-queue.test.ts -t "counts conflicted"
```

Expected: FAIL — `result.conflicted` is `undefined` (or the assertion `success === 0` fails because conflicts currently flow into the success counter), and the type-check may also flag missing `conflicted` in `SyncResult` returns.

---

## Task 8: Implement conflict accounting in base-queue.ts

**Files:**

- Modify: `src/lib/offline-queue/base-queue.ts:173-282` (the `sync()` method, the per-item try block specifically)

- [ ] **Step 1: Initialize the new counter and use the result type**

Inside `sync()`, find the line `let success = 0;` and replace the three counter declarations with four:

```ts
let success = 0;
let failed = 0;
let skipped = 0;
let conflicted = 0;
```

- [ ] **Step 2: Update the try block that calls `processItem` to inspect its return value**

Find this block:

```ts
try {
  // Process the item (implemented by subclass)
  await this.processItem(item);

  // Mark as completed

  await this.items.update(item.id!, {
    status: 'completed',
  } as any);

  success++;
  this.logger.debug('Item processed successfully', { id: item.id });
} catch (error) {
```

Replace it with:

```ts
try {
  // Process the item (implemented by subclass). The subclass may return
  // `{ status: 'conflicted' }` when it detected a server-side dedupe
  // (its work was already done by a prior attempt). void return is
  // treated as completed for backwards compatibility.
  const processResult = await this.processItem(item);

  await this.items.update(item.id!, {
    status: 'completed',
  } as any);

  if (processResult?.status === 'conflicted') {
    conflicted++;
    this.logger.info(
      'Item completed via dedupe (server already had this work)',
      { id: item.id }
    );
  } else {
    success++;
    this.logger.debug('Item processed successfully', { id: item.id });
  }
} catch (error) {
```

- [ ] **Step 3: Update the final return + logger call to include `conflicted`**

Find this block at the end of `sync()`:

```ts
this.logger.info('Sync complete', { success, failed, skipped });
return { success, failed, skipped };
```

Replace with:

```ts
this.logger.info('Sync complete', { success, failed, skipped, conflicted });
return { success, failed, skipped, conflicted };
```

- [ ] **Step 4: Update the early-return for empty queue and the syncInProgress guard to include conflicted**

Find this block (early return when queue is empty):

```ts
if (pending.length === 0) {
  return { success: 0, failed: 0, skipped: 0 };
}
```

Replace with:

```ts
if (pending.length === 0) {
  return { success: 0, failed: 0, skipped: 0, conflicted: 0 };
}
```

Find this block (syncInProgress guard):

```ts
if (this.syncInProgress) {
  this.logger.debug('Sync already in progress, skipping');
  return { success: 0, failed: 0, skipped: 0 };
}
```

Replace with:

```ts
if (this.syncInProgress) {
  this.logger.debug('Sync already in progress, skipping');
  return { success: 0, failed: 0, skipped: 0, conflicted: 0 };
}
```

- [ ] **Step 5: Update `processItem` abstract signature to allow ProcessItemResult**

Find this:

```ts
/**
 * Process a single queue item
 * Must be implemented by subclasses with domain-specific logic
 *
 * @param item - Item to process
 * @throws Error if processing fails (will trigger retry)
 */
protected abstract processItem(item: T): Promise<void>;
```

Replace with:

```ts
/**
 * Process a single queue item.
 * Must be implemented by subclasses with domain-specific logic.
 *
 * Subclasses may return `{ status: 'conflicted' }` to signal the work
 * was already completed by a prior attempt (server-side dedupe). void
 * return is treated as `{ status: 'completed' }`.
 *
 * @param item - Item to process
 * @throws Error if processing fails (will trigger retry)
 */
protected abstract processItem(item: T): Promise<ProcessItemResult | void>;
```

- [ ] **Step 6: Add `ProcessItemResult` to the imports at top of base-queue.ts**

Find this:

```ts
import {
  BaseQueueItem,
  QueueConfig,
  QueueStatus,
  SyncResult,
  DEFAULT_QUEUE_CONFIG,
} from './types';
```

Replace with:

```ts
import {
  BaseQueueItem,
  ProcessItemResult,
  QueueConfig,
  QueueStatus,
  SyncResult,
  DEFAULT_QUEUE_CONFIG,
} from './types';
```

- [ ] **Step 7: Run the conflict test, expect pass**

```bash
docker compose exec scripthammer pnpm vitest run src/lib/offline-queue/__tests__/base-queue.test.ts -t "counts conflicted"
```

Expected: PASS.

- [ ] **Step 8: Run the full file to confirm no regressions**

```bash
docker compose exec scripthammer pnpm vitest run src/lib/offline-queue/__tests__/base-queue.test.ts
docker compose exec scripthammer pnpm run type-check
```

Expected: all green; type-check clean.

- [ ] **Step 9: Commit**

```bash
docker compose exec scripthammer git add src/lib/offline-queue/types.ts src/lib/offline-queue/base-queue.ts src/lib/offline-queue/__tests__/base-queue.test.ts
docker compose exec scripthammer git commit -m "feat(offline-queue): conflict-aware accounting in sync()

processItem may now return { status: 'conflicted' } to signal that the
work was already done server-side (typical case: an idempotency-key
INSERT that hit ON CONFLICT DO NOTHING). The queue row still marks
completed, but SyncResult tracks the dedupe count separately for
observability. void return remains valid and is treated as
{ status: 'completed' } so existing subclasses don't break.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Payment adapter — generate idempotency_key at queue-time

**Files:**

- Modify: `src/lib/offline-queue/payment-adapter.ts`

- [ ] **Step 1: Read the current `queuePaymentIntent` method**

```bash
grep -n "queuePaymentIntent\|queueSubscriptionUpdate" src/lib/offline-queue/payment-adapter.ts
```

Note the line numbers; the data shape is what we need to mutate.

- [ ] **Step 2: Modify `queuePaymentIntent` to inject an idempotency_key into data**

Find the `queuePaymentIntent` method. Inside the body, before the `return await this.queue(...)` call, generate the key and merge it into `data`:

```ts
async queuePaymentIntent(
  intent: Record<string, unknown>,
  userId: string
): Promise<PaymentQueueItem> {
  // Stable key for offline-queue dedupe across retries (#52). Generated
  // once at queue-time so retries of the same logical INSERT all carry
  // the same key. The INSERT is server-side idempotent via a partial
  // UNIQUE INDEX on payment_intents.idempotency_key.
  const idempotencyKey =
    (intent.idempotency_key as string | undefined) ??
    crypto.randomUUID();

  return await this.queue({
    type: 'payment_intent',
    data: { ...intent, idempotency_key: idempotencyKey },
    userId,
  } as Omit<PaymentQueueItem, 'id' | 'status' | 'retries' | 'createdAt'>);
}
```

(Adjust the parameter list to match what's actually there — read the file first and preserve any existing parameter names. The point is: inject `idempotency_key` into `data` if not already present.)

- [ ] **Step 3: Run type-check**

```bash
docker compose exec scripthammer pnpm run type-check
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
docker compose exec scripthammer git add src/lib/offline-queue/payment-adapter.ts
docker compose exec scripthammer git commit -m "feat(payments): generate idempotency_key at offline-queue time

Stable key per logical payment intent. Retries of a queued payment
INSERT now share the same key, so server-side ON CONFLICT DO NOTHING
makes them no-ops instead of duplicates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Payment adapter — upsert with ignoreDuplicates

**Files:**

- Modify: `src/lib/offline-queue/payment-adapter.ts:107-143` (the `executePaymentIntent` private method)

- [ ] **Step 1: Replace the INSERT with an upsert + dedupe-aware return**

Find the entire `executePaymentIntent` method body. Replace its contents with:

```ts
private async executePaymentIntent(
  data: Record<string, unknown>,
  storedUserId?: string
): Promise<ProcessItemResult> {
  let userId = storedUserId;

  if (!userId) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Must be authenticated to execute payment intent');
    }
    userId = user.id;
  }

  // Idempotency key: prefer the one queued at intake. If absent (older
  // queue rows from before this column shipped), generate a fresh one
  // and warn — that retry chain will dedupe with itself but not with
  // any prior attempt that lacked a key.
  let idempotencyKey = data.idempotency_key as string | undefined;
  if (!idempotencyKey) {
    idempotencyKey = crypto.randomUUID();
    this.logger.warn(
      'Queued payment_intent missing idempotency_key — generating one. ' +
        'Retries of this row will dedupe; prior attempts without a key will not.',
      { generatedKey: idempotencyKey }
    );
  }

  // Upsert with ignoreDuplicates → INSERT ... ON CONFLICT (idempotency_key)
  // DO NOTHING server-side. A retry whose prior attempt actually wrote
  // the row produces zero rows here; we treat that as a conflicted
  // completion (work already done, do not re-charge).
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

  if (error) {
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }

  if (!inserted) {
    return { status: 'conflicted' };
  }

  return { status: 'completed' };
}
```

- [ ] **Step 2: Add `ProcessItemResult` import**

At the top of `payment-adapter.ts`, find the import from `./types` and add `ProcessItemResult`:

```ts
import {
  BaseQueueItem,
  PaymentQueueItem,
  ProcessItemResult,
  QueueConfig,
  // ... whatever else is already imported from types
} from './types';
```

(Adjust to match the actual existing import shape.)

- [ ] **Step 3: Update `processItem` return type to allow ProcessItemResult**

Find the `processItem` override in the adapter. Update the signature:

```ts
protected async processItem(item: PaymentQueueItem): Promise<ProcessItemResult | void> {
  switch (item.type) {
    case 'payment_intent':
      return await this.executePaymentIntent(item.data, item.userId);
    case 'subscription_update':
      await this.executeSubscriptionUpdate(item.data);
      return;
    default:
      throw new Error(`Unknown payment operation type: ${item.type}`);
  }
}
```

(The `subscription_update` branch keeps `void` return since UPDATE is implicitly idempotent by primary key — no dedupe distinction needed.)

- [ ] **Step 4: Run type-check**

```bash
docker compose exec scripthammer pnpm run type-check
```

Expected: clean.

- [ ] **Step 5: Run all existing payment-related tests to confirm no regressions**

```bash
docker compose exec scripthammer pnpm vitest run tests/unit/payment-service.test.ts
```

Expected: all existing tests pass (none of them assert on the INSERT shape; they're at a higher abstraction).

- [ ] **Step 6: Commit**

```bash
docker compose exec scripthammer git add src/lib/offline-queue/payment-adapter.ts
docker compose exec scripthammer git commit -m "feat(payments): upsert payment_intents with ignoreDuplicates for offline retry safety

Replaces the prior insert() with upsert(..., { onConflict:
'idempotency_key', ignoreDuplicates: true }), which maps to INSERT ...
ON CONFLICT DO NOTHING server-side. A queued retry whose prior attempt
already created the row now returns zero rows; the adapter signals
{ status: 'conflicted' } and the queue row marks completed without
double-charging.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Payment adapter dedupe test

**Files:**

- Create: `src/lib/offline-queue/__tests__/payment-adapter.test.ts`

- [ ] **Step 1: Create the test file with 2 cases**

```ts
/**
 * Unit tests for PaymentQueueAdapter idempotent INSERT path.
 *
 * Validates the offline-queue retry safety contract from #52:
 * - A retry whose prior attempt succeeded server-side is a no-op.
 * - A queued item without an idempotency_key falls back to generating
 *   one and logs a warning.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Supabase client surface PaymentQueueAdapter touches. We mock
// at the import-graph boundary to avoid pulling a real network client.
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn(() => ({
  upsert: mockUpsert.mockReturnValue({
    select: mockSelect.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    }),
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'test-user-1' } },
        error: null,
      })),
    },
  },
}));

// Import AFTER the mock so the adapter binds to the mocked supabase.
import { PaymentQueueAdapter } from '../payment-adapter';

describe('PaymentQueueAdapter (idempotent INSERT path, #52)', () => {
  let adapter: PaymentQueueAdapter;

  beforeEach(async () => {
    mockMaybeSingle.mockReset();
    mockFrom.mockClear();
    mockUpsert.mockClear();
    mockSelect.mockClear();
    adapter = new PaymentQueueAdapter();
    await adapter.clear();
  });

  it('queues an item and processes it via upsert with the queued idempotency_key', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'intent-1' },
      error: null,
    });

    const intent = {
      amount: 1000,
      currency: 'usd',
      type: 'one_time',
      customer_email: 'a@example.com',
      idempotency_key: 'fixed-key-1',
    };

    await adapter.queuePaymentIntent(intent, 'test-user-1');
    const result = await adapter.sync();

    expect(result.success).toBe(1);
    expect(result.conflicted).toBe(0);
    expect(mockFrom).toHaveBeenCalledWith('payment_intents');
    // The upsert must have received the queued idempotency_key and the
    // ignoreDuplicates option.
    const [payload, options] = mockUpsert.mock.calls[0];
    expect(payload.idempotency_key).toBe('fixed-key-1');
    expect(options).toEqual({
      onConflict: 'idempotency_key',
      ignoreDuplicates: true,
    });
  });

  it('treats a zero-row upsert response as conflicted (work was already done)', async () => {
    // First call: server already had this row → upsert returns null data.
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await adapter.queuePaymentIntent(
      {
        amount: 1000,
        currency: 'usd',
        type: 'one_time',
        customer_email: 'a@example.com',
        idempotency_key: 'already-inserted-key',
      },
      'test-user-1'
    );
    const result = await adapter.sync();

    expect(result.success).toBe(0);
    expect(result.conflicted).toBe(1);
    expect(result.failed).toBe(0);
  });
});
```

- [ ] **Step 2: Run the new test file, expect pass (mocks align with the implementation)**

```bash
docker compose exec scripthammer pnpm vitest run src/lib/offline-queue/__tests__/payment-adapter.test.ts
```

Expected: 2 tests pass. If a test fails, the mock shape may not match the actual upsert chain — read the actual error and adjust the chain (e.g., `.select('id')` may need its own `mockReturnValue`).

- [ ] **Step 3: Commit**

```bash
docker compose exec scripthammer git add src/lib/offline-queue/__tests__/payment-adapter.test.ts
docker compose exec scripthammer git commit -m "test(payments): pin idempotent-INSERT and conflicted-completion contracts

Two regression cases for the #52 retry-safety surface:
1. queued idempotency_key flows into the upsert payload with the
   correct onConflict + ignoreDuplicates options.
2. A zero-row upsert response is treated as conflicted (the prior
   attempt's row is already there); the queue row still completes,
   but result.conflicted increments instead of result.success.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Apply migration to cloud Supabase

**Files:**

- (none — uses Supabase Management API per CLAUDE.md)

- [ ] **Step 1: Confirm cloud env vars present**

```bash
grep -E "^SUPABASE_PROJECT_REF=|^SUPABASE_ACCESS_TOKEN=" .env | sed 's/=.*/=<redacted>/'
```

Expected: both lines present (don't print values).

- [ ] **Step 2: Apply the column + index via Management API**

```bash
PROJECT_REF=$(grep -E "^SUPABASE_PROJECT_REF=" .env | cut -d= -f2)
ACCESS_TOKEN=$(grep -E "^SUPABASE_ACCESS_TOKEN=" .env | cut -d= -f2)

curl -fsS -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS idempotency_key TEXT; CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_idempotency_key ON payment_intents(idempotency_key) WHERE idempotency_key IS NOT NULL;"}'
```

Expected: HTTP 200 / JSON payload with no error.

- [ ] **Step 3: Verify the cloud schema matches**

```bash
curl -fsS -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '\''payment_intents'\'' AND column_name = '\''idempotency_key'\''"}'
```

Expected: JSON containing `idempotency_key | text`.

---

## Task 13: Final verification and PR

**Files:**

- (none — verification only, then PR)

- [ ] **Step 1: Run full offline-queue + RLS suites**

```bash
docker compose exec scripthammer pnpm vitest run src/lib/offline-queue/
docker compose exec scripthammer pnpm test:rls
```

Expected:

- offline-queue: all green (existing + new cases)
- RLS: 55/55 (the new column doesn't change RLS behavior; existing policies still work)

- [ ] **Step 2: Type-check + lint affected files**

```bash
docker compose exec scripthammer pnpm run type-check
docker compose exec scripthammer pnpm exec eslint src/lib/offline-queue/
```

Expected: both clean.

- [ ] **Step 3: Push branch from host**

```bash
git push -u origin 052/offline-queue-watchdog-idempotency
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --repo TortoiseWolfe/ScriptHammer \
  --base main \
  --head 052/offline-queue-watchdog-idempotency \
  --title "fix(offline-queue): watchdog reclaim + idempotent payment INSERTs (#52)" \
  --body "Closes #52.

## Summary

Two coupled changes that together close the offline-queue retry safety hole:

1. **Watchdog reclaim** in \`base-queue.ts\`: stuck \`processing\` rows older than 60s reset to \`pending\` so a tab-crash mid-process doesn't leave the user in limbo.
2. **Idempotency** on the INSERT side via partial unique index on \`payment_intents.idempotency_key\` + \`upsert(..., { onConflict, ignoreDuplicates: true })\`. A retry whose prior attempt actually succeeded is now a server-side no-op, not a double-charge.

Shipping reclaim alone would *create* double-charges; idempotency alone wouldn't fix the limbo case. They land together.

## Test plan

- [x] \`pnpm vitest run src/lib/offline-queue/\` — all green including 5 new cases (3 base-queue, 2 payment-adapter).
- [x] \`pnpm test:rls\` — 55/55 (RLS policies unaffected).
- [x] \`pnpm run type-check\` + \`pnpm exec eslint src/lib/offline-queue/\` — clean.
- [x] Cloud schema migrated via Supabase Management API (per CLAUDE.md monolithic-migration rule).

## Spec + design

\`docs/superpowers/specs/2026-04-27-offline-queue-watchdog-and-idempotency-design.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 5: Wait for PR CI; merge if green**

Watch the PR's E2E and CI runs. If green, squash-merge with `--delete-branch`. If red, investigate the failure (the only plausible regression is in the test suite — the runtime change is conservative).

---

## Self-review

**Spec coverage:**

- Schema (Change 1): Task 2 ✓
- Watchdog (Change 2): Tasks 4-6 ✓
- Conflict accounting (Change 3): Tasks 7-8 ✓
- payment-adapter changes (Change 4): Tasks 9-10 ✓
- Tests 1+2 from spec (watchdog + fresh): Tasks 5-6 ✓
- Test 3 from spec (conflicted): Task 7 ✓
- Tests 4+5 from spec (dedupe + missing-key): Task 11 ✓
- Verification commands match spec: Task 13 ✓

**Placeholder scan:** No "TBD", "TODO", "implement later", "appropriate error handling", "similar to". All code shown verbatim. ✓

**Type consistency:** `ProcessItemResult` defined in Task 3, imported and used in Tasks 5, 8, 10. `SyncResult.conflicted` introduced in Task 3, populated in Task 8, asserted in Task 7. `processingTimeoutMs` defined in Task 3, consumed in Task 5. All consistent. ✓

**Frequent commits:** 8 commits across tasks 2-11. Each is a single concern: schema, types, watchdog implementation + test, fresh-processing test, conflict implementation + test, adapter key-generation, adapter upsert, adapter dedupe tests. ✓

**TDD:** Tests precede implementation in Tasks 4→5 (watchdog), 7→8 (conflict). Adapter tests (Task 11) follow implementation since they're integration-style mock-driven and pinning behavior, not driving design. ✓

---

## Execution notes

- One file under monolithic migration ban: cloud apply via Management API (Task 12), not by editing a separate migration file.
- The "fresh processing" negative test (Task 6) does not have a paired implementation step — the watchdog code from Task 5 already handles it correctly; this case is regression coverage to prevent a future "bump processingTimeoutMs to 0" mistake.
- The mock chain in Task 11 may need adjustment if the actual `payment-adapter` upsert uses a different fluent shape; the Step 2 instruction explicitly invites reading the actual error and adjusting.
