import { describe, it, expect } from 'vitest';
import {
  ALREADY_PAID_MESSAGE,
  MAX_CHAIN_HOPS,
  chainAlreadyPaid,
  gateOnChainPaid,
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

describe('the chain bound agrees with the other two walkers', () => {
  it('is RETRY_LIMIT + 1, the same as the webhooks walk', () => {
    expect(MAX_CHAIN_HOPS).toBe(RETRY_LIMIT + 1);
    expect(MAX_CHAIN_HOPS).toBe(MAX_RETRY_HOPS);
  });
});
