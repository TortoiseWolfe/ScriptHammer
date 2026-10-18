/**
 * The buyer's return page finds the order a RETRY paid for (#1308).
 *
 * create-order's retry branch inserts a child intent and no order row, so a page that looked up
 * the order by the paid intent alone told everyone who paid on a retry "still being confirmed",
 * forever. `findOrderThroughRetries` follows the retry chain to the purchase, the same walk the
 * webhook does in `supabase/functions/_shared/advance-order.ts`.
 */

import { describe, it, expect } from 'vitest';
import { findOrderThroughRetries, isFaithfulRetry } from '../retry-chain';

type Row = Record<string, unknown>;

/** A PostgREST-shaped stub answering orders by intent_id and payment_intents by id. */
function stub({
  orders = {} as Record<string, Row>,
  intents = {} as Record<string, Row>,
  error = null as unknown,
} = {}) {
  const reads: string[] = [];
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (col: string, val: unknown) => {
      filters[col] = val;
      return chain;
    };
    chain.maybeSingle = async () => {
      reads.push(table);
      if (error) return { data: null, error };
      if (table === 'orders')
        return { data: orders[String(filters.intent_id)] ?? null, error: null };
      return { data: intents[String(filters.id)] ?? null, error: null };
    };
    return chain;
  };
  return { client: { from } as never, reads };
}

const ROOT = {
  id: 'int-1',
  parent_intent_id: null,
  amount: 3900,
  currency: 'usd',
  template_user_id: 'user-1',
};
const RETRY = { ...ROOT, id: 'int-2', parent_intent_id: 'int-1' };
const ORDER = {
  id: 'ord-1',
  buyer_email: 'buyer@example.com',
  product_id: 'p1',
};

describe('findOrderThroughRetries', () => {
  it("returns the intent's own order without walking", async () => {
    const { client, reads } = stub({ orders: { 'int-1': ORDER } });
    expect(await findOrderThroughRetries(client, 'int-1', 'id')).toEqual(ORDER);
    expect(reads).toEqual(['orders']);
  });

  it('finds the order a retry paid for (#1308)', async () => {
    const { client } = stub({
      orders: { 'int-1': ORDER },
      intents: { 'int-1': ROOT, 'int-2': RETRY },
    });
    expect(await findOrderThroughRetries(client, 'int-2', 'id')).toEqual(ORDER);
  });

  it('refuses a link whose price, currency or buyer differs', async () => {
    const { client } = stub({
      orders: { 'int-1': ORDER },
      intents: { 'int-1': ROOT, 'int-2': { ...RETRY, amount: 100 } },
    });
    expect(await findOrderThroughRetries(client, 'int-2', 'id')).toBeNull();
  });

  it('stops on a cycle', async () => {
    const { client } = stub({
      intents: {
        'int-a': { ...ROOT, id: 'int-a', parent_intent_id: 'int-b' },
        'int-b': { ...ROOT, id: 'int-b', parent_intent_id: 'int-a' },
      },
    });
    expect(await findOrderThroughRetries(client, 'int-a', 'id')).toBeNull();
  });

  it('degrades to null on a read error, so the page says "still confirming" rather than crash', async () => {
    const { client } = stub({ error: { code: '08006' } });
    expect(await findOrderThroughRetries(client, 'int-2', 'id')).toBeNull();
  });

  it('isFaithfulRetry compares price, currency and buyer', () => {
    expect(isFaithfulRetry(RETRY, ROOT)).toBe(true);
    expect(isFaithfulRetry({ ...RETRY, currency: 'eur' }, ROOT)).toBe(false);
    expect(isFaithfulRetry({ ...RETRY, template_user_id: 'x' }, ROOT)).toBe(
      false
    );
  });
});
