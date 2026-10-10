import { describe, it, expect } from 'vitest';
import {
  COOLING_PERIOD_MS,
  RETRY_LIMIT,
  buildRetryIntentRow,
  childIdempotencyKey,
  chainAlreadyPaid,
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

/* ---------------------------------------------------------------------------------------------
 * #1338: a retry of an intent that has already been PAID is refused.
 *
 * decideRetry checked ownership, the limit, expiry and the cooling period, never whether the
 * purchase had already gone through. A buyer whose first attempt succeeded late, or whose page
 * showed a failure that was not one, could press Retry and be charged twice.
 * ------------------------------------------------------------------------------------------- */

describe('decideRetry — an already-paid purchase (#1338)', () => {
  it('refuses with retry_already_paid when the chain has a succeeded payment', () => {
    const d = decideRetry(makeParent(), OWNER, NOW, { alreadyPaid: true });
    expect(d).toMatchObject({
      kind: 'refuse',
      status: 409,
      code: 'retry_already_paid',
    });
  });

  it('checks ownership FIRST, so a stranger cannot learn whether someone paid', () => {
    const d = decideRetry(makeParent(), 'someone-else', NOW, {
      alreadyPaid: true,
    });
    expect(d).toMatchObject({ kind: 'refuse', code: 'retry_not_found' });
  });

  it('proceeds as before when nothing has been paid', () => {
    expect(
      decideRetry(makeParent(), OWNER, NOW, { alreadyPaid: false }).kind
    ).toBe('proceed');
    expect(decideRetry(makeParent(), OWNER, NOW).kind).toBe('proceed');
  });
});

describe('chainAlreadyPaid', () => {
  type Row = Record<string, unknown>;
  /**
   * payment_intents by id (maybeSingle) and by a set of parents (.in); payment_results filtered
   * by the intent set AND by status, so deleting the status filter fails a test.
   */
  function stub({
    intents = {} as Record<string, Row>,
    results = [] as { intent_id: string; status: string }[],
    /** Fails the ANCESTOR read only; childError and paidError fail the other two. */
    error = null as unknown,
    childError = null as unknown,
    paidError = null as unknown,
  } = {}) {
    const from = (table: string) => {
      const f: { eq: Record<string, unknown>; in: Record<string, unknown[]> } =
        {
          eq: {},
          in: {},
        };
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (c: string, v: unknown) => {
        f.eq[c] = v;
        return chain;
      };
      chain.in = (c: string, v: unknown[]) => {
        f.in[c] = v;
        return chain;
      };
      chain.limit = () => chain;
      chain.maybeSingle = async () => {
        if (error) return { data: null, error };
        return { data: intents[String(f.eq.id)] ?? null, error: null };
      };
      chain.then = (res: (v: unknown) => unknown) => {
        if (table === 'payment_intents') {
          if (childError)
            return Promise.resolve({ data: null, error: childError }).then(res);
          const parents = f.in.parent_intent_id ?? [];
          const kids = Object.values(intents).filter((r) =>
            parents.includes(r.parent_intent_id)
          );
          return Promise.resolve({ data: kids, error: null }).then(res);
        }
        if (paidError)
          return Promise.resolve({ data: null, error: paidError }).then(res);
        const ids = f.in.intent_id ?? [];
        const hits = results
          .filter(
            (r) =>
              ids.includes(r.intent_id) &&
              (f.eq.status === undefined || r.status === f.eq.status)
          )
          .map((r) => ({ id: `pr-${r.intent_id}` }));
        return Promise.resolve({ data: hits, error: null }).then(res);
      };
      return chain;
    };
    return { from };
  }

  const P = { id: 'int-1', parent_intent_id: null };
  const C1 = { id: 'int-2', parent_intent_id: 'int-1' };
  const C2 = { id: 'int-3', parent_intent_id: 'int-2' };
  const chain = { 'int-1': P, 'int-2': C1, 'int-3': C2 };
  const paid = (intent_id: string) => [{ intent_id, status: 'succeeded' }];

  it('is false when nothing in the chain succeeded', async () => {
    expect(await chainAlreadyPaid(stub({ intents: chain }), 'int-2')).toBe(
      false
    );
  });

  it('counts only SUCCEEDED: a failed or pending attempt is what a retry follows', async () => {
    // Without the status filter every legitimate retry would be refused for good.
    for (const status of ['failed', 'pending']) {
      const sb = stub({
        intents: chain,
        results: [{ intent_id: 'int-1', status }],
      });
      expect(await chainAlreadyPaid(sb, 'int-1')).toBe(false);
    }
  });

  it('sees a succeeded payment on an ancestor', async () => {
    expect(
      await chainAlreadyPaid(
        stub({ intents: chain, results: paid('int-1') }),
        'int-3'
      )
    ).toBe(true);
  });

  it('sees a succeeded payment on a direct child', async () => {
    expect(
      await chainAlreadyPaid(
        stub({ intents: chain, results: paid('int-2') }),
        'int-1'
      )
    ).toBe(true);
  });

  it('sees a succeeded GRANDCHILD when the purchase is retried (blind review, #1338)', async () => {
    // P -> C1 -> C2, C2 paid, buyer presses Retry on P in an old tab. The insert would dedupe to
    // C1 and hand it back for checkout, so C1 could be charged a second time.
    expect(
      await chainAlreadyPaid(
        stub({ intents: chain, results: paid('int-3') }),
        'int-1'
      )
    ).toBe(true);
  });

  it('sees a paid sibling branch reached through the purchase', async () => {
    // Retrying C1 when C2 (its child) was paid: found by walking up to P and back down.
    expect(
      await chainAlreadyPaid(
        stub({ intents: chain, results: paid('int-3') }),
        'int-2'
      )
    ).toBe(true);
  });

  it('throws on a read error, so the retry fails closed rather than risking a second charge', async () => {
    // Each of the three reads separately: the ancestor walk, the descendants, and the payments.
    for (const sb of [
      stub({ error: { code: '08006' } }),
      stub({ intents: chain, childError: { code: '08006' } }),
      stub({ intents: chain, paidError: { code: '08006' } }),
    ]) {
      await expect(chainAlreadyPaid(sb, 'int-1')).rejects.toMatchObject({
        code: '08006',
      });
    }
  });
});

describe('the liveness double-charge query covers every chain create-order builds', () => {
  it('walks deeper than RETRY_LIMIT', async () => {
    const { DOUBLE_CHARGE_SQL } = await import(
      '../../scripts/ci/check-webhook-liveness.mjs'
    );
    const depth = Number(/c\.depth < (\d+)/.exec(DOUBLE_CHARGE_SQL)?.[1]);
    expect(depth).toBeGreaterThan(RETRY_LIMIT);
  });
});
