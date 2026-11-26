import { describe, it, expect } from 'vitest';
import {
  ALREADY_PAID_MESSAGE,
  MAX_CHAIN_HOPS,
  PAYMENT_PROCESSING_MESSAGE,
  PENDING_CAPTURE_WINDOW_MS,
  chainAlreadyPaid,
  chainIntentIds,
  chainPaymentProcessing,
  gateOnChainPaid,
  isHeldCapture,
  recordedCaptureStatus,
} from '../../supabase/functions/_shared/payment-chain';
import { RETRY_LIMIT } from '../../supabase/functions/create-order/resolve';
import { MAX_RETRY_HOPS } from '../../supabase/functions/_shared/advance-order';

/**
 * Whether a payment's retry chain is already paid, and the gate every money-moving Edge Function
 * runs before it moves money (#1342).
 *
 * chainAlreadyPaid was create-order's (#1338), where it stops a retry of a paid purchase. But a
 * retry is not the only way to pay one purchase twice: nothing stopped a second Stripe session or
 * PayPal order being opened for an intent already paid, and nothing stopped a PayPal order being
 * captured after another attempt in its chain succeeded. So it now lives in _shared, and
 * create-stripe-checkout, create-paypal-order and capture-paypal-order all ask it first.
 */
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

  it('chainIntentIds returns the WHOLE chain from any member (#1345)', async () => {
    // create-stripe-checkout expires every open session in the chain, so it needs the same set
    // the paid check walks: up to the purchase, then every descendant.
    for (const from of ['int-1', 'int-2', 'int-3']) {
      expect(
        (await chainIntentIds(stub({ intents: chain }), from)).sort()
      ).toEqual(['int-1', 'int-2', 'int-3']);
    }
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

describe('gateOnChainPaid: what each money-moving function does with the answer', () => {
  /** The smallest stub chainAlreadyPaid accepts: one intent, optionally paid, optionally failing. */
  function oneIntent({
    paid = false,
    fail = false,
  }: { paid?: boolean; fail?: boolean } = {}) {
    const from = (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'limit']) chain[m] = () => chain;
      chain.maybeSingle = async () =>
        fail
          ? { data: null, error: { code: '08006' } }
          : { data: { id: 'int-1', parent_intent_id: null }, error: null };
      chain.then = (res: (v: unknown) => unknown) =>
        Promise.resolve(
          table === 'payment_intents'
            ? { data: [], error: null }
            : { data: paid ? [{ id: 'pr-1' }] : [], error: null }
        ).then(res);
      return chain;
    };
    return { from };
  }

  it('proceeds when nothing in the chain is paid', async () => {
    expect(await gateOnChainPaid(oneIntent(), 'int-1')).toEqual({
      kind: 'proceed',
    });
  });

  it('refuses with 409 and the same sentence create-order uses, when the chain is paid', async () => {
    const gate = await gateOnChainPaid(oneIntent({ paid: true }), 'int-1');
    expect(gate).toEqual({
      kind: 'refuse',
      status: 409,
      code: 'already_paid',
      error: ALREADY_PAID_MESSAGE,
    });
    // One wording for one fact, whichever door the buyer came through.
    expect(ALREADY_PAID_MESSAGE).toBe(
      'This payment has already gone through, so it has not been charged again.'
    );
  });

  it('refuses with 500 when the check cannot be read: no money moves on a guess', async () => {
    expect(await gateOnChainPaid(oneIntent({ fail: true }), 'int-1')).toEqual({
      kind: 'refuse',
      status: 500,
      code: 'paid_check_failed',
      error:
        'Could not confirm this payment is not already paid. Please try again.',
    });
  });
});

/**
 * A PayPal capture PayPal answered PENDING is a payment in flight, not a failure (#1349). It used to
 * be recorded failed, so the buyer saw "payment failed", paid again, and was charged twice when the
 * first one cleared. The marker is the pair status 'pending' + verification_method 'redirect':
 * create-paypal-order writes pending with no method, only capture-paypal-order writes 'redirect'.
 */
describe('a held PayPal capture (#1349)', () => {
  const NOW = Date.parse('2026-11-06T12:00:00Z');
  const fresh = '2026-11-05T12:00:00Z';
  const held = {
    status: 'pending',
    verification_method: 'redirect',
    updated_at: fresh,
  };

  describe('isHeldCapture', () => {
    it('is true for a pending row the capture function touched', () => {
      expect(isHeldCapture(held, NOW)).toBe(true);
    });

    it('is false for a pending row create-paypal-order wrote: an abandoned approval is what a retry follows', () => {
      expect(isHeldCapture({ ...held, verification_method: null }, NOW)).toBe(
        false
      );
    });

    it('is false for any status but pending', () => {
      for (const status of ['succeeded', 'failed']) {
        expect(isHeldCapture({ ...held, status }, NOW)).toBe(false);
      }
    });

    it('stops holding after the window, so a row no webhook settled cannot lock the buyer out for good', () => {
      const edge = new Date(
        NOW - PENDING_CAPTURE_WINDOW_MS + 1000
      ).toISOString();
      const past = new Date(
        NOW - PENDING_CAPTURE_WINDOW_MS - 1000
      ).toISOString();
      expect(isHeldCapture({ ...held, updated_at: edge }, NOW)).toBe(true);
      expect(isHeldCapture({ ...held, updated_at: past }, NOW)).toBe(false);
    });

    it('counts an unreadable stamp as held: the failure to avoid is a second charge', () => {
      expect(isHeldCapture({ ...held, updated_at: 'nonsense' }, NOW)).toBe(
        true
      );
      expect(isHeldCapture({ ...held, updated_at: null }, NOW)).toBe(true);
    });
  });

  describe('recordedCaptureStatus', () => {
    it('records COMPLETED as succeeded, PENDING as pending, anything else as failed', () => {
      expect(recordedCaptureStatus('COMPLETED')).toBe('succeeded');
      expect(recordedCaptureStatus('PENDING')).toBe('pending');
      for (const other of ['DECLINED', 'FAILED', 'VOIDED', '']) {
        expect(recordedCaptureStatus(other)).toBe('failed');
      }
    });
  });

  /**
   * One intent with payment_results rows. Filters on status AND verification_method AND provider,
   * so dropping any of those from the query fails a test. A succeeded row is returned only when
   * the query asks for status 'succeeded' (the paid check).
   */
  type Result = {
    id: string;
    provider: string;
    status: string;
    verification_method: string | null;
    updated_at: string | null;
  };
  function withResults(rows: Result[], { fail = false } = {}) {
    const from = (table: string) => {
      const f: Record<string, unknown> = {};
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (c: string, v: unknown) => {
        f[c] = v;
        return chain;
      };
      chain.in = () => chain;
      chain.limit = () => chain;
      chain.maybeSingle = async () => ({
        data: { id: 'int-1', parent_intent_id: null },
        error: null,
      });
      chain.then = (res: (v: unknown) => unknown) => {
        if (table === 'payment_intents')
          return Promise.resolve({ data: [], error: null }).then(res);
        if (fail)
          return Promise.resolve({
            data: null,
            error: { code: '08006' },
          }).then(res);
        const hits = rows.filter(
          (r) =>
            (f.status === undefined || r.status === f.status) &&
            (f.provider === undefined || r.provider === f.provider) &&
            (f.verification_method === undefined ||
              r.verification_method === f.verification_method)
        );
        return Promise.resolve({ data: hits, error: null }).then(res);
      };
      return chain;
    };
    return { from };
  }
  const row = (over: Partial<Result> = {}): Result => ({
    id: 'pr-1',
    provider: 'paypal',
    status: 'pending',
    verification_method: 'redirect',
    updated_at: new Date().toISOString(),
    ...over,
  });

  it('chainPaymentProcessing is true only for a fresh pending redirect row', async () => {
    expect(await chainPaymentProcessing(withResults([row()]), 'int-1')).toBe(
      true
    );
    expect(await chainPaymentProcessing(withResults([]), 'int-1')).toBe(false);
    expect(
      await chainPaymentProcessing(
        withResults([row({ verification_method: null })]),
        'int-1'
      )
    ).toBe(false);
    expect(
      await chainPaymentProcessing(
        withResults([
          row({
            updated_at: new Date(
              Date.now() - PENDING_CAPTURE_WINDOW_MS - 60_000
            ).toISOString(),
          }),
        ]),
        'int-1'
      )
    ).toBe(false);
  });

  it('chainPaymentProcessing throws on a read error so the gate fails closed', async () => {
    await expect(
      chainPaymentProcessing(withResults([], { fail: true }), 'int-1')
    ).rejects.toMatchObject({ code: '08006' });
  });

  it('the gate refuses 409 payment_processing while a capture is held', async () => {
    expect(await gateOnChainPaid(withResults([row()]), 'int-1')).toEqual({
      kind: 'refuse',
      status: 409,
      code: 'payment_processing',
      error: PAYMENT_PROCESSING_MESSAGE,
    });
    expect(PAYMENT_PROCESSING_MESSAGE).toBe(
      'Your PayPal payment is still processing. Please wait for it to finish before paying another way.'
    );
  });

  it('a paid chain still answers already_paid, not processing', async () => {
    const gate = await gateOnChainPaid(
      withResults([row(), row({ id: 'pr-2', status: 'succeeded' })]),
      'int-1'
    );
    expect(gate).toMatchObject({ kind: 'refuse', code: 'already_paid' });
  });

  it('the gate proceeds when the only pending row is an abandoned approval', async () => {
    expect(
      await gateOnChainPaid(
        withResults([row({ verification_method: null })]),
        'int-1'
      )
    ).toEqual({ kind: 'proceed' });
  });

  it('the gate refuses 500 when the held check cannot be read', async () => {
    expect(
      await gateOnChainPaid(withResults([], { fail: true }), 'int-1')
    ).toMatchObject({ kind: 'refuse', status: 500, code: 'paid_check_failed' });
  });
});

describe('the chain bound agrees with the other two walkers', () => {
  it('is RETRY_LIMIT + 1, the same as the webhooks walk', () => {
    expect(MAX_CHAIN_HOPS).toBe(RETRY_LIMIT + 1);
    expect(MAX_CHAIN_HOPS).toBe(MAX_RETRY_HOPS);
  });
});
