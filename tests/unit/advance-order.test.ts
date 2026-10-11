/**
 * The order transition, tested where CI will actually run it (#1151, #1150).
 *
 * WHY THIS FILE IS HERE AND NOT BESIDE THE FUNCTION. `vitest.config.ts` excludes
 * `supabase/functions/**` and no workflow runs `deno test`, so a test written next to the Edge
 * Function would never execute — the same shape as `send-payment-email` itself, which has a
 * contract test and no caller. `advance-order.ts` imports nothing, so it can be imported here
 * and exercised inside the required `Test` check.
 *
 * WHAT IS WORTH ASSERTING. Not "does it update a row" — that is one line. The behaviours that
 * carry risk, and every one of them is a way to hurt a paying customer:
 *
 *   - a missing order must NOT throw, or the provider retries the event for nothing (an intent
 *     nothing ordered, or a retry chain whose links do not match; a faithful retry now finds its
 *     purchase's order, #1308)
 *   - a second event for the same order must NOT email again — two Stripe events describe one
 *     purchase, and `webhook_events` de-duplication does not cover that
 *   - a failing email must NOT fail the caller, or a Resend outage becomes a retry storm
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  advanceOrderAndNotify,
  isFaithfulRetry,
} from '../../supabase/functions/_shared/advance-order';

/** Minimal PostgREST-shaped stub: records what was asked, returns what the test wants. */
function makeSupabase({
  order = null as Record<string, unknown> | null,
  orderError = null as unknown,
  /** Orders keyed by intent_id. When given, it replaces `order` for the lookup. */
  ordersByIntent = null as Record<string, Record<string, unknown>> | null,
  /** payment_intents rows keyed by id, for the retry walk (#1308). */
  intents = {} as Record<string, Record<string, unknown>>,
  intentError = null as unknown,
  updatedRows = [{ id: 'ord-1' }] as unknown[] | null,
  updateError = null as unknown,
  product = { name: 'Office Hours' } as Record<string, unknown> | null,
} = {}) {
  const calls: {
    table: string;
    op: string;
    filters: Record<string, unknown>;
  }[] = [];
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (col: string, val: unknown) => {
      filters[col] = val;
      return chain;
    };
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.maybeSingle = async () => {
      calls.push({ table, op: 'select', filters });
      if (table === 'orders') {
        const row = ordersByIntent
          ? (ordersByIntent[String(filters.intent_id)] ?? null)
          : order;
        return { data: row, error: orderError };
      }
      if (table === 'payment_intents') {
        if (intentError) return { data: null, error: intentError };
        return { data: intents[String(filters.id)] ?? null, error: null };
      }
      return { data: product, error: null };
    };
    chain.update = (patch: Record<string, unknown>) => {
      calls.push({ table, op: 'update', filters });
      const upd: Record<string, unknown> = {};
      upd.eq = (col: string, val: unknown) => {
        filters[col] = val;
        return upd;
      };
      upd.select = async () => ({ data: updatedRows, error: updateError });
      (upd as { patch?: unknown }).patch = patch;
      calls[calls.length - 1].filters = filters;
      (calls[calls.length - 1] as { patch?: unknown }).patch = patch;
      return upd;
    };
    return chain;
  };
  return { client: { from }, calls };
}

const ORDER = {
  id: 'ord-1',
  buyer_email: 'buyer@example.com',
  product_id: 'prd-office-hours',
  status: 'pending',
};
const INPUT = {
  intentId: 'int-1',
  amount: 3900,
  currency: 'usd',
  provider: 'stripe' as const,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(
    async () => ({ ok: true, status: 200 }) as unknown as Response
  );
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Deno', {
    env: {
      get: (k: string) =>
        k === 'SUPABASE_URL' ? 'https://x.supabase.co' : 'service-role-key',
    },
  });
});

describe('advanceOrderAndNotify (#1151)', () => {
  it('advances a pending order and sends one receipt', async () => {
    const { client } = makeSupabase({ order: ORDER });
    const r = await advanceOrderAndNotify(client, INPUT);
    expect(r.advanced).toBe(true);
    expect(r.emailed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/functions/v1/send-payment-email');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.type).toBe('payment_success');
    expect(body.recipient).toBe('buyer@example.com');
    expect(body.data.order_id).toBe('ord-1');
    // The template falls back to product_id, but a name is what a buyer should read.
    expect(body.data.product_name).toBe('Office Hours');
  });

  it('sends the receipt with the SERVICE-ROLE key, which is why this is server-side', async () => {
    // `send-payment-email` compares the caller against the service-role key in constant time.
    // A browser must never hold it — that is the argument against putting this in the return leg.
    const { client } = makeSupabase({ order: ORDER });
    await advanceOrderAndNotify(client, INPUT);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer service-role-key'
    );
  });

  it('a missing order is not an error — or Stripe retries forever', async () => {
    // An intent nothing ordered (a payment made outside the checkout) reaches here with nothing
    // wrong. A retry no longer does: the walk finds its purchase's order (#1308).
    const { client } = makeSupabase({ order: null });
    const r = await advanceOrderAndNotify(client, INPUT);
    expect(r.advanced).toBe(false);
    expect(r.reason).toBe('no-order');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a FAILED order read throws, rather than passing for "no order" (#1307)', async () => {
    // A read error used to be indistinguishable from a missing order: the webhook marked the
    // event processed and the paid order was never advanced or receipted. Throwing lets the
    // webhook claim retry the event, which is safe because everything here is a CAS.
    const { client } = makeSupabase({
      order: null,
      orderError: { code: '08006', message: 'connection lost' },
    });
    await expect(advanceOrderAndNotify(client, INPUT)).rejects.toMatchObject({
      code: '08006',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a FAILED status write throws, so the payment is retried rather than left unadvanced (#1307)', async () => {
    const { client } = makeSupabase({
      order: ORDER,
      updatedRows: null,
      updateError: { code: '40001', message: 'serialization failure' },
    });
    await expect(advanceOrderAndNotify(client, INPUT)).rejects.toMatchObject({
      code: '40001',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // --- #1308: a payment made on a RETRY advances the order of the purchase it retried ---------

  const ROOT = {
    id: 'int-1',
    parent_intent_id: null,
    amount: 3900,
    currency: 'usd',
    template_user_id: 'user-1',
  };
  const RETRY = { ...ROOT, id: 'int-2', parent_intent_id: 'int-1' };

  it('a paid RETRY advances the order of the intent it retried (#1308)', async () => {
    // create-order's retry branch inserts a child intent and NO order row, so the webhook used
    // to find no order for the child and stop: the buyer was charged and the order stayed
    // pending with no receipt.
    const { client, calls } = makeSupabase({
      ordersByIntent: { 'int-1': ORDER },
      intents: { 'int-1': ROOT, 'int-2': RETRY },
    });
    const r = await advanceOrderAndNotify(client, {
      ...INPUT,
      intentId: 'int-2',
    });
    expect(r).toMatchObject({ advanced: true, orderId: 'ord-1' });
    const update = calls.find(
      (c) => c.table === 'orders' && c.op === 'update'
    )!;
    expect(update.filters).toMatchObject({ id: 'ord-1', status: 'pending' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('walks a chain of retries back to the purchase', async () => {
    const RETRY2 = { ...ROOT, id: 'int-3', parent_intent_id: 'int-2' };
    const { client } = makeSupabase({
      ordersByIntent: { 'int-1': ORDER },
      intents: { 'int-1': ROOT, 'int-2': RETRY, 'int-3': RETRY2 },
    });
    const r = await advanceOrderAndNotify(client, {
      ...INPUT,
      intentId: 'int-3',
    });
    expect(r).toMatchObject({ advanced: true, orderId: 'ord-1' });
  });

  it('does not follow a link whose price, currency or buyer differs', async () => {
    // A legitimate retry copies all three from its parent (buildRetryIntentRow). Anything else
    // would let a cheap payment mark an expensive order paid, so the walk refuses it.
    for (const bad of [
      { amount: 100 },
      { currency: 'eur' },
      { template_user_id: 'someone-else' },
    ]) {
      const { client, calls } = makeSupabase({
        ordersByIntent: { 'int-1': ORDER },
        intents: { 'int-1': ROOT, 'int-2': { ...RETRY, ...bad } },
      });
      const r = await advanceOrderAndNotify(client, {
        ...INPUT,
        intentId: 'int-2',
      });
      expect(r).toMatchObject({ advanced: false, reason: 'no-order' });
      expect(calls.some((c) => c.op === 'update')).toBe(false);
    }
  });

  it('stops after a bounded number of hops, even on a cycle', async () => {
    const { client } = makeSupabase({
      ordersByIntent: {},
      intents: {
        'int-a': { ...ROOT, id: 'int-a', parent_intent_id: 'int-b' },
        'int-b': { ...ROOT, id: 'int-b', parent_intent_id: 'int-a' },
      },
    });
    const r = await advanceOrderAndNotify(client, {
      ...INPUT,
      intentId: 'int-a',
    });
    expect(r).toMatchObject({ advanced: false, reason: 'no-order' });
  });

  it('a FAILED intent read throws rather than passing for "no order"', async () => {
    const { client } = makeSupabase({
      ordersByIntent: {},
      intentError: { code: '08006' },
    });
    await expect(
      advanceOrderAndNotify(client, { ...INPUT, intentId: 'int-2' })
    ).rejects.toMatchObject({ code: '08006' });
  });

  it('isFaithfulRetry compares price, currency and buyer', () => {
    expect(isFaithfulRetry(RETRY, ROOT)).toBe(true);
    expect(isFaithfulRetry({ ...RETRY, amount: 3901 }, ROOT)).toBe(false);
  });

  it('a second event for the same order does NOT email again', async () => {
    // THE CASE `webhook_events` DOES NOT COVER. It de-duplicates one event arriving twice; it
    // says nothing about `payment_intent.succeeded` AND `checkout.session.completed` both
    // describing a single purchase. The compare-and-swap is what stops the second email.
    const { client } = makeSupabase({ order: ORDER, updatedRows: [] });
    const r = await advanceOrderAndNotify(client, INPUT);
    expect(r.advanced).toBe(false);
    expect(r.reason).toBe('already-advanced');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the update is a COMPARE-AND-SWAP on pending, not a blind write', async () => {
    // If this ever became a plain update, the test above would still pass while two events
    // would both "win" and the buyer would get two emails.
    const { client, calls } = makeSupabase({ order: ORDER });
    await advanceOrderAndNotify(client, INPUT);
    const update = calls.find((c) => c.table === 'orders' && c.op === 'update');
    expect(update, 'no update was issued against orders').toBeTruthy();
    expect(
      update!.filters.status,
      'the update does not gate on status=pending'
    ).toBe('pending');
    expect((update as { patch?: { status?: string } }).patch?.status).toBe(
      'paid'
    );
  });

  it('a failing email leaves the order paid and does not throw', async () => {
    // A Resend outage must not propagate: the caller is a webhook, and a thrown error makes
    // Stripe retry the whole event. The order being `paid` is the durable fact.
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as unknown as Response);
    const { client } = makeSupabase({ order: ORDER });
    const r = await advanceOrderAndNotify(client, INPUT);
    expect(r.advanced).toBe(true);
    expect(r.emailed).toBe(false);
  });

  it('a THROWING email is swallowed too', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { client } = makeSupabase({ order: ORDER });
    await expect(advanceOrderAndNotify(client, INPUT)).resolves.toMatchObject({
      advanced: true,
      emailed: false,
    });
  });

  it('an order with no buyer_email advances but sends nothing', async () => {
    const { client } = makeSupabase({ order: { ...ORDER, buyer_email: null } });
    const r = await advanceOrderAndNotify(client, INPUT);
    expect(r.advanced).toBe(true);
    expect(r.reason).toBe('no-recipient');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('joins orders on intent_id — the key the webhook actually holds', async () => {
    const { client, calls } = makeSupabase({ order: ORDER });
    await advanceOrderAndNotify(client, INPUT);
    const sel = calls.find((c) => c.table === 'orders' && c.op === 'select');
    expect(sel!.filters.intent_id).toBe('int-1');
  });
});
