/**
 * The order transition, tested where CI will actually run it (#1151, #1150).
 *
 * WHY THIS FILE IS HERE AND NOT BESIDE THE FUNCTION. `vitest.config.ts` excludes
 * `supabase/functions/**` and no workflow runs `deno test`, so a test written next to the Edge
 * Function would never execute — the same shape as `send-payment-email` itself, which has a
 * contract test and no caller. `advance-order.ts` imports nothing, so it can be imported here
 * and exercised inside the required `Test (20.x)` check.
 *
 * WHAT IS WORTH ASSERTING. Not "does it update a row" — that is one line. The behaviours that
 * carry risk, and every one of them is a way to hurt a paying customer:
 *
 *   - a missing order must NOT throw, or Stripe retries the event forever (#1126: a retried
 *     intent legitimately has no order row)
 *   - a second event for the same order must NOT email again — two Stripe events describe one
 *     purchase, and `webhook_events` de-duplication does not cover that
 *   - a failing email must NOT fail the caller, or a Resend outage becomes a retry storm
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { advanceOrderAndNotify } from '../../supabase/functions/_shared/advance-order';

/** Minimal PostgREST-shaped stub: records what was asked, returns what the test wants. */
function makeSupabase({
  order = null as Record<string, unknown> | null,
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
      return { data: table === 'orders' ? order : product, error: null };
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
    // #1126: `create-order`'s `op: 'retry'` path deliberately skips the insert, so an intent
    // with no order row is reachable with nothing wrong.
    const { client } = makeSupabase({ order: null });
    const r = await advanceOrderAndNotify(client, INPUT);
    expect(r.advanced).toBe(false);
    expect(r.reason).toBe('no-order');
    expect(fetchMock).not.toHaveBeenCalled();
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
