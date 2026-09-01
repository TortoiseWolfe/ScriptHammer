import { describe, it, expect } from 'vitest';
import {
  COOLING_PERIOD_MS,
  RETRY_LIMIT,
  buildRetryIntentRow,
  childIdempotencyKey,
  decideRetry,
  type ParentIntentRow,
} from '../../supabase/functions/create-order/resolve';

/**
 * The retry branch of create-order (#559 T025 / #1046).
 *
 * WHY THIS FILE EXISTS AT ALL. Retrying a payment was a client-side upsert whose unit
 * tests stubbed the upsert's return value, so the suite asserted the payload and the
 * branch logic — both correct — against a database that always said yes. Two defects
 * lived underneath that for as long as the code existed:
 *
 *   1. PostgREST emits a bare `ON CONFLICT (idempotency_key)`, which cannot infer the
 *      PARTIAL unique index, so every call returned HTTP 400 / 42P10 and wrote nothing.
 *   2. The child was given the PARENT's key, so it collided with its own parent.
 *
 * `index.ts` is unreachable from vitest (supabase/functions/** is excluded and no
 * workflow runs `deno test`), which is precisely why the decision logic lives in
 * resolve.ts as pure functions. Anything decided inline in the handler is decided
 * where CI cannot see it.
 */

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const OWNER = '22222222-2222-2222-2222-222222222222';
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

function makeParent(over: Partial<ParentIntentRow> = {}): ParentIntentRow {
  return {
    id: PARENT_ID,
    template_user_id: OWNER,
    amount: 2000,
    currency: 'usd',
    type: 'one_time',
    interval: null,
    customer_email: 'buyer@example.test',
    description: 'Demo Payment',
    metadata: { product_id: 'demo-checkout' },
    idempotency_key: 'checkout-abc',
    retry_count: 0,
    created_at: new Date(NOW - COOLING_PERIOD_MS - 1000).toISOString(),
    expires_at: new Date(NOW + 3_600_000).toISOString(),
    ...over,
  };
}

describe('childIdempotencyKey — the #1046 collision', () => {
  it('never equals the parent key, which is what made every retry a no-op', () => {
    const parent = makeParent();
    const key = childIdempotencyKey(parent.id, 1);
    expect(key).not.toBe(parent.idempotency_key);
    // The old code was `parent.idempotency_key ?? randomUUID()`. Pin the actual shape
    // so a refactor back toward the parent's key fails here rather than in production.
    expect(key).toBe(`rty:${PARENT_ID}:1`);
  });

  it('derives from the server-minted id, NOT from the client-influenced key', () => {
    // The original purchase's idempotency_key can come straight from a caller-supplied
    // Idempotency-Key header. Deriving the child from it would let a buyer choose the
    // namespace their retries land in, and let them pre-plant a colliding row.
    const a = childIdempotencyKey(PARENT_ID, 1);
    const b = childIdempotencyKey(PARENT_ID, 1);
    expect(a).toBe(b);
    const withDifferentParentKey = makeParent({
      idempotency_key: 'attacker-chosen',
    });
    expect(childIdempotencyKey(withDifferentParentKey.id, 1)).toBe(a);
  });

  it('is deterministic per attempt, so a double-click dedupes with itself', () => {
    expect(childIdempotencyKey(PARENT_ID, 2)).toBe(
      childIdempotencyKey(PARENT_ID, 2)
    );
    expect(childIdempotencyKey(PARENT_ID, 2)).not.toBe(
      childIdempotencyKey(PARENT_ID, 3)
    );
  });
});

describe('decideRetry — ownership', () => {
  it('refuses a missing parent with 404', () => {
    const d = decideRetry(null, OWNER, NOW);
    expect(d).toMatchObject({
      kind: 'refuse',
      status: 404,
      code: 'retry_not_found',
    });
  });

  it("refuses ANOTHER user's intent with the same 404, not 403", () => {
    // A distinct status would let anyone probe which intent ids exist.
    const d = decideRetry(makeParent(), 'someone-else', NOW);
    expect(d).toMatchObject({
      kind: 'refuse',
      status: 404,
      code: 'retry_not_found',
    });
  });

  it('refuses an orphaned intent whose owner is null', () => {
    const d = decideRetry(makeParent({ template_user_id: null }), OWNER, NOW);
    expect(d).toMatchObject({ kind: 'refuse', status: 404 });
  });
});

describe('decideRetry — the three guards', () => {
  it('allows a retry at the boundary below the cap', () => {
    const d = decideRetry(
      makeParent({ retry_count: RETRY_LIMIT - 1 }),
      OWNER,
      NOW
    );
    expect(d.kind).toBe('proceed');
  });

  it('refuses AT the cap with 429', () => {
    const d = decideRetry(makeParent({ retry_count: RETRY_LIMIT }), OWNER, NOW);
    expect(d).toMatchObject({
      kind: 'refuse',
      status: 429,
      code: 'retry_limit',
    });
  });

  it('refuses an expired intent with 410', () => {
    const d = decideRetry(
      makeParent({ expires_at: new Date(NOW - 1).toISOString() }),
      OWNER,
      NOW
    );
    expect(d).toMatchObject({
      kind: 'refuse',
      status: 410,
      code: 'retry_expired',
    });
  });

  it('refuses inside the cooling period and reports how long to wait', () => {
    const created = new Date(NOW - 10_000).toISOString();
    const d = decideRetry(makeParent({ created_at: created }), OWNER, NOW);
    expect(d).toMatchObject({
      kind: 'refuse',
      status: 429,
      code: 'retry_cooling',
    });
    if (d.kind === 'refuse') expect(d.waitMs).toBe(COOLING_PERIOD_MS - 10_000);
  });

  it('allows a retry exactly AT the cooling boundary', () => {
    const created = new Date(NOW - COOLING_PERIOD_MS).toISOString();
    expect(
      decideRetry(makeParent({ created_at: created }), OWNER, NOW).kind
    ).toBe('proceed');
  });

  it('refuses one millisecond inside the boundary', () => {
    const created = new Date(NOW - COOLING_PERIOD_MS + 1).toISOString();
    expect(
      decideRetry(makeParent({ created_at: created }), OWNER, NOW).kind
    ).toBe('refuse');
  });

  it('checks expiry BEFORE cooling — an expired intent is never "wait and try"', () => {
    const d = decideRetry(
      makeParent({
        expires_at: new Date(NOW - 1).toISOString(),
        created_at: new Date(NOW - 1000).toISOString(),
      }),
      OWNER,
      NOW
    );
    expect(d).toMatchObject({ code: 'retry_expired' });
  });

  it('checks the cap before expiry, so a capped intent says cap', () => {
    const d = decideRetry(
      makeParent({
        retry_count: RETRY_LIMIT,
        expires_at: new Date(NOW - 1).toISOString(),
      }),
      OWNER,
      NOW
    );
    expect(d).toMatchObject({ code: 'retry_limit' });
  });
});

describe('decideRetry — proceeding', () => {
  it('increments retry_count and mints both keys', () => {
    const d = decideRetry(makeParent({ retry_count: 1 }), OWNER, NOW);
    expect(d).toEqual({
      kind: 'proceed',
      retryCount: 2,
      rowKey: `rty:${PARENT_ID}:2`,
    });
  });
});

describe('buildRetryIntentRow', () => {
  it('copies the parent price rather than re-pricing from the catalog', () => {
    // A retry is a second attempt at ONE purchase. Re-resolving would charge today's
    // price for yesterday's agreement.
    const parent = makeParent({ amount: 12345 });
    const row = buildRetryIntentRow(parent, OWNER, 1, 'rty:x:1');
    expect(row.amount).toBe(12345);
    expect(row.currency).toBe('usd');
  });

  it('links lineage and carries the derived key', () => {
    const row = buildRetryIntentRow(
      makeParent(),
      OWNER,
      1,
      `rty:${PARENT_ID}:1`
    );
    expect(row.parent_intent_id).toBe(PARENT_ID);
    expect(row.retry_count).toBe(1);
    expect(row.idempotency_key).toBe(`rty:${PARENT_ID}:1`);
  });

  it('takes the owner from the caller, never from the parent row', () => {
    // The parent is read with a service-role client that bypasses RLS, so its
    // template_user_id is not an authorisation fact on its own.
    const row = buildRetryIntentRow(makeParent(), OWNER, 1, 'k');
    expect(row.template_user_id).toBe(OWNER);
  });

  it('refuses to build a row with no user, rather than writing an unreadable one', () => {
    expect(() => buildRetryIntentRow(makeParent(), '', 1, 'k')).toThrow(
      /userId is required/
    );
  });

  it('normalises null metadata to an object', () => {
    const row = buildRetryIntentRow(
      makeParent({ metadata: null }),
      OWNER,
      1,
      'k'
    );
    expect(row.metadata).toEqual({});
  });
});
