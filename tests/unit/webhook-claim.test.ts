/**
 * The webhook claim, tested where CI will actually run it (#1307).
 *
 * `vitest.config.ts` excludes `supabase/functions/**` and nothing runs `deno test`, so the claim
 * lives in a dependency-free `_shared` module and is driven from here, under `Test (20.x)`.
 *
 * WHAT IS WORTH ASSERTING. Each of these is a way to lose or duplicate a payment:
 *
 *   - a retry of an event whose handler failed must be HANDLED again, not answered "already
 *     processed" (the #1307 loss), but only when its handler is replay-safe
 *   - a delivery that loses the claim must get a RETRYABLE status, never a 2xx: a 2xx tells the
 *     provider the event was delivered, so if the winner then failed nothing would retry it
 *   - "could not read the row" must never be mistaken for "no row"
 *   - a success whose bookkeeping write failed must surface, not leave the row unprocessed
 *   - a failure that can never be retried safely must be marked permanently_failed, which the
 *     daily webhook-liveness check fails on, instead of being acknowledged in silence
 */

import { describe, it, expect } from 'vitest';
import {
  CLAIM_LEASE_MS,
  MAX_ATTEMPTS,
  REPLAY_SAFE,
  afterFailure,
  claimWebhookEvent,
  decideExisting,
  failWebhookEvent,
  finishWebhookEvent,
  type EventRow,
} from '../../supabase/functions/_shared/webhook-claim';

const NOW = Date.parse('2026-10-10T17:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const row = (over: Partial<EventRow> = {}): EventRow => ({
  id: 'we-1',
  processed: false,
  permanently_failed: false,
  processing_attempts: 1,
  last_retry_at: null,
  ...over,
});

const SAFE = 'payment_intent.succeeded';
const UNSAFE = 'invoice.payment_failed';

describe('decideExisting: an event we have seen before', () => {
  it('answers 200 for an event already processed', () => {
    expect(
      decideExisting(row({ processed: true }), 'stripe', SAFE, NOW)
    ).toEqual({
      kind: 'done',
      status: 200,
      message: 'Event already processed',
    });
  });

  it('answers 200 for an event already given up on', () => {
    const d = decideExisting(
      row({ permanently_failed: true }),
      'stripe',
      SAFE,
      NOW
    );
    expect(d).toMatchObject({ kind: 'done', status: 200 });
  });

  it('RECLAIMS an unprocessed, replay-safe event: the #1307 retry is handled again', () => {
    expect(
      decideExisting(
        row({ processing_attempts: 2, last_retry_at: null }),
        'stripe',
        SAFE,
        NOW
      )
    ).toEqual({ kind: 'reclaim', attempts: 2 });
  });

  it('reclaims once the previous claim has outlived its lease', () => {
    expect(
      decideExisting(
        row({ last_retry_at: ago(CLAIM_LEASE_MS + 1) }),
        'stripe',
        SAFE,
        NOW
      )
    ).toEqual({ kind: 'reclaim', attempts: 1 });
  });

  it('answers a RETRYABLE 409 while another delivery holds the claim', () => {
    const d = decideExisting(
      row({ last_retry_at: ago(1000) }),
      'stripe',
      SAFE,
      NOW
    );
    expect(d.kind).toBe('busy');
    if (d.kind === 'busy') expect(d.status).toBe(409);
  });

  it('keeps acknowledging an unprocessed event whose handler is NOT replay-safe (stage 2)', () => {
    // invoice.payment_failed increments a counter: re-running it would double-count (#1307).
    const d = decideExisting(row(), 'stripe', UNSAFE, NOW);
    expect(d).toMatchObject({ kind: 'done', status: 200 });
  });

  it('treats a type that differs only by provider as unknown', () => {
    // REPLAY_SAFE is per provider; a Stripe type is not safe under PayPal.
    expect(decideExisting(row(), 'paypal', SAFE, NOW).kind).toBe('done');
  });
});

describe('REPLAY_SAFE: only handlers the 2026-10-10 audit proved idempotent', () => {
  it('lists the payment-completion events and the Cal.com booking', () => {
    expect(REPLAY_SAFE.stripe).toEqual(['payment_intent.succeeded']);
    expect([...REPLAY_SAFE.paypal].sort()).toEqual([
      'PAYMENT.CAPTURE.COMPLETED',
      'PAYMENT.SALE.COMPLETED',
    ]);
    expect(REPLAY_SAFE.calcom).toEqual(['BOOKING_CREATED']);
  });

  it('does NOT list the handlers the audit found unsafe', () => {
    for (const t of [
      'invoice.payment_failed',
      'customer.subscription.updated',
      'customer.subscription.created',
      'checkout.session.completed',
    ]) {
      expect(REPLAY_SAFE.stripe).not.toContain(t);
    }
    expect(REPLAY_SAFE.paypal).not.toContain(
      'BILLING.SUBSCRIPTION.PAYMENT.FAILED'
    );
  });
});

describe('afterFailure', () => {
  it('asks the provider to retry a replay-safe event under the cap', () => {
    expect(afterFailure(1, true)).toEqual({ giveUp: false, status: 500 });
    expect(afterFailure(MAX_ATTEMPTS - 1, true)).toEqual({
      giveUp: false,
      status: 500,
    });
  });

  it('gives up at the cap, answering 200 so the storm stops and the alarm takes over', () => {
    expect(afterFailure(MAX_ATTEMPTS, true)).toEqual({
      giveUp: true,
      status: 200,
    });
  });

  it('gives up at once on an event that cannot be retried safely', () => {
    expect(afterFailure(1, false)).toEqual({ giveUp: true, status: 200 });
  });
});

/* ------------------------------------------------------------- the I/O half */

type Call = {
  op: 'insert' | 'select' | 'update';
  values?: Record<string, unknown>;
  filters: [string, string, unknown][];
};

/**
 * A PostgREST-shaped stub for `webhook_events`. Each operation answers from the queue the test
 * gives it, and every call is recorded with its filters so the compare-and-swap can be checked.
 */
function makeSupabase(answers: {
  insert?: { data: unknown; error: unknown };
  select?: { data: unknown; error: unknown };
  update?: { data: unknown; error: unknown }[];
}) {
  const calls: Call[] = [];
  const updates = [...(answers.update ?? [])];
  const from = (table: string) => {
    expect(table).toBe('webhook_events');
    const call: Call = { op: 'select', filters: [] };
    const chain: Record<string, unknown> = {};
    const filter = (kind: string) => (col: string, val: unknown) => {
      call.filters.push([kind, col, val]);
      return chain;
    };
    chain.eq = filter('eq');
    chain.is = filter('is');
    chain.insert = (values: Record<string, unknown>) => {
      call.op = 'insert';
      call.values = values;
      calls.push(call);
      return chain;
    };
    chain.update = (values: Record<string, unknown>) => {
      call.op = 'update';
      call.values = values;
      calls.push(call);
      return chain;
    };
    chain.select = () => {
      if (call.op === 'select') calls.push(call);
      return chain;
    };
    const settle = async () => {
      if (call.op === 'insert') return answers.insert;
      if (call.op === 'update')
        return updates.shift() ?? { data: [{ id: 'we-1' }], error: null };
      return answers.select;
    };
    chain.single = settle;
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      settle().then(res, rej);
    return chain;
  };
  return { client: { from }, calls };
}

const RECORD = {
  provider_event_id: 'evt_1',
  event_type: SAFE,
  event_data: { id: 'pi_1' },
  signature: 'sig',
};

describe('claimWebhookEvent', () => {
  it('claims a first delivery by inserting it, already counted and leased', async () => {
    const { client, calls } = makeSupabase({
      insert: { data: { id: 'we-new' }, error: null },
    });
    const claim = await claimWebhookEvent(client, 'stripe', RECORD, NOW);
    expect(claim).toEqual({ kind: 'claimed', id: 'we-new', attempt: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].values).toMatchObject({
      provider: 'stripe',
      provider_event_id: 'evt_1',
      processed: false,
      processing_attempts: 1,
      last_retry_at: new Date(NOW).toISOString(),
    });
  });

  it('answers 200 for a redelivery of a processed event, and writes nothing', async () => {
    const { client, calls } = makeSupabase({
      insert: { data: null, error: { code: '23505' } },
      select: { data: row({ processed: true }), error: null },
    });
    const claim = await claimWebhookEvent(client, 'stripe', RECORD, NOW);
    expect(claim).toMatchObject({ kind: 'respond', status: 200 });
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('reclaims a failed replay-safe event by compare-and-swap on the attempt count', async () => {
    const { client, calls } = makeSupabase({
      insert: { data: null, error: { code: '23505' } },
      select: { data: row({ processing_attempts: 2 }), error: null },
      update: [{ data: [{ id: 'we-1' }], error: null }],
    });
    const claim = await claimWebhookEvent(client, 'stripe', RECORD, NOW);
    expect(claim).toEqual({ kind: 'claimed', id: 'we-1', attempt: 3 });
    const cas = calls.find((c) => c.op === 'update')!;
    expect(cas.values).toEqual({
      processing_attempts: 3,
      last_retry_at: new Date(NOW).toISOString(),
    });
    expect(cas.filters).toEqual(
      expect.arrayContaining([
        ['eq', 'id', 'we-1'],
        ['eq', 'processed', false],
        ['eq', 'processing_attempts', 2],
      ])
    );
  });

  it('answers a RETRYABLE 409, never a 2xx, when another delivery wins the swap', async () => {
    const { client } = makeSupabase({
      insert: { data: null, error: { code: '23505' } },
      select: { data: row(), error: null },
      update: [{ data: [], error: null }],
    });
    const claim = await claimWebhookEvent(client, 'stripe', RECORD, NOW);
    expect(claim).toMatchObject({ kind: 'respond', status: 409 });
  });

  it('writes nothing while another delivery holds the lease', async () => {
    const { client, calls } = makeSupabase({
      insert: { data: null, error: { code: '23505' } },
      select: { data: row({ last_retry_at: ago(1000) }), error: null },
    });
    const claim = await claimWebhookEvent(client, 'stripe', RECORD, NOW);
    expect(claim).toMatchObject({ kind: 'respond', status: 409 });
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('throws on an insert error that is not a duplicate', async () => {
    const { client } = makeSupabase({
      insert: { data: null, error: { code: '57014', message: 'timeout' } },
    });
    await expect(
      claimWebhookEvent(client, 'stripe', RECORD, NOW)
    ).rejects.toMatchObject({ code: '57014' });
  });

  it('throws when the existing row cannot be read: "could not read" is not "not there"', async () => {
    const { client } = makeSupabase({
      insert: { data: null, error: { code: '23505' } },
      select: { data: null, error: { code: '08006', message: 'gone' } },
    });
    await expect(
      claimWebhookEvent(client, 'stripe', RECORD, NOW)
    ).rejects.toMatchObject({ code: '08006' });
  });

  it('throws when the swap itself errors', async () => {
    const { client } = makeSupabase({
      insert: { data: null, error: { code: '23505' } },
      select: { data: row(), error: null },
      update: [{ data: null, error: { code: '40001' } }],
    });
    await expect(
      claimWebhookEvent(client, 'stripe', RECORD, NOW)
    ).rejects.toMatchObject({ code: '40001' });
  });
});

describe('finishWebhookEvent', () => {
  it('marks the event processed, guarded by the attempt that holds the claim', async () => {
    const { client, calls } = makeSupabase({});
    await finishWebhookEvent(
      client,
      'we-1',
      3,
      { related_payment_id: 'pr-1' },
      NOW
    );
    expect(calls[0].values).toEqual({
      processed: true,
      processed_at: new Date(NOW).toISOString(),
      processing_error: null,
      related_payment_id: 'pr-1',
    });
    expect(calls[0].filters).toEqual([
      ['eq', 'id', 'we-1'],
      ['eq', 'processing_attempts', 3],
    ]);
  });

  it('throws when the write fails, so the success is retried rather than left unprocessed', async () => {
    const { client } = makeSupabase({
      update: [{ data: null, error: { code: '08006' } }],
    });
    await expect(
      finishWebhookEvent(client, 'we-1', 1, {}, NOW)
    ).rejects.toMatchObject({ code: '08006' });
  });

  it('throws when no row was updated: the row is gone or the claim was taken over', async () => {
    const { client } = makeSupabase({ update: [{ data: [], error: null }] });
    await expect(
      finishWebhookEvent(client, 'we-1', 1, {}, NOW)
    ).rejects.toThrow(/not marked processed/);
  });
});

describe('failWebhookEvent', () => {
  it('records the error and releases the claim, guarded by its attempt', async () => {
    const { client, calls } = makeSupabase({});
    const out = await failWebhookEvent(
      client,
      'we-1',
      2,
      true,
      new Error('db blip')
    );
    expect(out).toEqual({ giveUp: false, status: 500 });
    expect(calls[0].values).toEqual({
      processing_error: 'db blip',
      last_retry_at: null,
    });
    expect(calls[0].filters).toEqual([
      ['eq', 'id', 'we-1'],
      ['eq', 'processing_attempts', 2],
    ]);
  });

  it('marks the event permanently_failed when it gives up', async () => {
    const { client, calls } = makeSupabase({});
    const out = await failWebhookEvent(
      client,
      'we-1',
      1,
      false,
      new Error('boom')
    );
    expect(out).toEqual({ giveUp: true, status: 200 });
    expect(calls[0].values).toMatchObject({
      permanently_failed: true,
      processing_error: 'boom',
    });
  });

  it('keeps the provider retrying if it could not record the give-up', async () => {
    // Answering 200 without the permanently_failed mark would leave a replay-safe event neither
    // processed nor given up, with no retry coming.
    const { client } = makeSupabase({
      update: [{ data: null, error: { code: '08006' } }],
    });
    const out = await failWebhookEvent(
      client,
      'we-1',
      MAX_ATTEMPTS,
      true,
      new Error('boom')
    );
    expect(out).toEqual({ giveUp: false, status: 500 });
  });

  it('does not give up on behalf of a newer holder: a stale claim changes nothing', async () => {
    // The update matched no row, because another delivery reclaimed the event and bumped its
    // attempt count. This request must neither null that holder's lease nor report a give-up.
    const { client } = makeSupabase({ update: [{ data: [], error: null }] });
    const out = await failWebhookEvent(
      client,
      'we-1',
      1,
      false,
      new Error('boom')
    );
    expect(out).toEqual({ giveUp: false, status: 500 });
  });

  it('truncates a long error so one bad payload cannot bloat the row', async () => {
    const { client, calls } = makeSupabase({});
    await failWebhookEvent(
      client,
      'we-1',
      1,
      true,
      new Error('x'.repeat(5000))
    );
    expect(String(calls[0].values?.processing_error).length).toBe(500);
  });
});
