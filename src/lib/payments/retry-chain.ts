/**
 * The order an intent paid for, following retries back to the purchase (#1308).
 *
 * create-order's retry branch inserts a CHILD intent and deliberately no order row, so the order
 * belongs to the root of the chain. The return page looked the order up by the paid intent alone,
 * and told everyone who paid on a retry "still being confirmed", forever.
 *
 * This is the buyer's half. The webhook's half, which advances the order and sends the receipt, is
 * `findOrderThroughRetries` in `supabase/functions/_shared/advance-order.ts`: the same walk, the
 * same link check and the same bound. They are separate copies because an Edge Function cannot
 * import app code; `tests/unit/retry-chain-parity.test.ts` fails if the two drift apart.
 *
 * One difference, deliberately: here a read error degrades to null. This runs in a page, where the
 * honest answer to "could not read" is "still confirming, refresh", not an exception. The webhook
 * throws instead, because there a retry can fix it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** create-order's RETRY_LIMIT (3) plus one; also bounds a cycle no real chain contains. */
export const MAX_RETRY_HOPS = 4;

interface IntentLink {
  id: string;
  parent_intent_id: string | null;
  amount: number;
  currency: string;
  template_user_id: string;
}

/**
 * Whether `parent` is the purchase `child` retried: the same price, currency and buyer. A retry
 * copies all three (buildRetryIntentRow), so a link that differs is not one to follow.
 */
export function isFaithfulRetry(
  child: IntentLink,
  parent: IntentLink
): boolean {
  return (
    child.amount === parent.amount &&
    child.currency === parent.currency &&
    child.template_user_id === parent.template_user_id
  );
}

type Client = Pick<SupabaseClient, 'from'>;

async function read<T>(
  query: PromiseLike<{ data: T | null; error: unknown }>
): Promise<T | null> {
  const { data, error } = await query;
  return error ? null : data;
}

export async function findOrderThroughRetries<T>(
  supabase: Client,
  intentId: string,
  columns: string
): Promise<T | null> {
  const orderFor = (id: string) =>
    read<T>(
      supabase
        .from('orders')
        .select(columns)
        .eq('intent_id', id)
        .maybeSingle() as unknown as PromiseLike<{
        data: T | null;
        error: unknown;
      }>
    );
  const linkFor = (id: string) =>
    read<IntentLink>(
      supabase
        .from('payment_intents')
        .select('id, parent_intent_id, amount, currency, template_user_id')
        .eq('id', id)
        .maybeSingle() as unknown as PromiseLike<{
        data: IntentLink | null;
        error: unknown;
      }>
    );

  const own = await orderFor(intentId);
  if (own) return own;

  let child = await linkFor(intentId);
  for (let hop = 0; hop < MAX_RETRY_HOPS && child?.parent_intent_id; hop++) {
    const parent = await linkFor(child.parent_intent_id);
    if (!parent || !isFaithfulRetry(child, parent)) return null;
    const order = await orderFor(parent.id);
    if (order) return order;
    child = parent;
  }
  return null;
}
