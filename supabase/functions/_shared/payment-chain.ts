/**
 * Whether a purchase is already paid, across its whole retry chain, and the gate the ONE-OFF
 * payment functions ask before moving money (#1342): create-stripe-checkout, create-paypal-order
 * and capture-paypal-order. The subscription functions are not gated; a subscription has no
 * retry chain.
 *
 * Dependency-free on purpose: it takes the Supabase client as a parameter, so vitest can drive it
 * with a stub (`tests/unit/payment-chain.test.ts`). Nothing in CI executes an Edge Function, so a
 * decision made inline in an index.ts is made where no test can see it.
 *
 * chainAlreadyPaid began in create-order (#1338), where it stops a retry of a paid purchase. A
 * retry is not the only way to pay one purchase twice, though: nothing stopped a second Stripe
 * session or PayPal order being opened for an intent already paid, or a PayPal order being
 * captured after another attempt in its chain succeeded. A retry that dedupes hands back the same
 * child intent, so re-opening the provider-switch panel, or pressing Retry twice, reached it.
 */

/**
 * How far either walk goes: create-order's RETRY_LIMIT (3) plus one, which also bounds a cycle.
 * The same number as _shared/advance-order.ts's MAX_RETRY_HOPS; tests/unit/payment-chain.test.ts
 * fails if the three drift apart.
 */
export const MAX_CHAIN_HOPS = 4;

/** One sentence for one fact, whichever door the buyer came through (create-order uses it too). */
export const ALREADY_PAID_MESSAGE =
  'This payment has already gone through, so it has not been charged again.';

/**
 * Whether any intent in a retry chain already has a SUCCEEDED payment (#1338). Throws on a read
 * error, so the retry fails closed instead of risking a second charge.
 *
 * THE WHOLE CHAIN, not just the neighbours. Retry keys are fixed per parent
 * (`rty:<parent>:<n>`), so a chain is a line P -> C1 -> C2 -> C3. If C2 was paid and the buyer
 * presses Retry on P in an old tab, the insert dedupes to C1 and hands C1 back for checkout, so
 * checking only {P, C1} would let C1 be charged a second time (caught by the blind review). So:
 * walk up to the purchase, then collect every descendant of it, level by level, within the same
 * bound.
 *
 * Only `succeeded` counts. `pending` (an unpaid session, an abandoned PayPal approval) and
 * `failed` are what a legitimate retry follows, so counting them would refuse every retry.
 */
export async function chainAlreadyPaid(
  supabase: any,
  intentId: string
): Promise<boolean> {
  const ids = await chainIntentIds(supabase, intentId);
  const { data: paid, error: paidError } = await supabase
    .from('payment_results')
    .select('id')
    .in('intent_id', ids)
    .eq('status', 'succeeded')
    .limit(1);
  if (paidError) throw paidError;
  return (paid ?? []).length > 0;
}

/**
 * Every intent in `intentId`'s retry chain: up to the purchase, then every descendant of it, level
 * by level, within MAX_CHAIN_HOPS. Throws on a read error. The walk chainAlreadyPaid answers over,
 * and the set whose Stripe sessions create-stripe-checkout and capture-paypal-order retire (#1345,
 * #1347): an abandoned session on the purchase stays open while its retry child is given a new one.
 */
export async function chainIntentIds(
  supabase: any,
  intentId: string
): Promise<string[]> {
  // 1. Up to the purchase.
  let root = intentId;
  let current: string | null = intentId;
  for (let hop = 0; hop < MAX_CHAIN_HOPS && current; hop++) {
    const {
      data,
      error,
    }: { data: { parent_intent_id: string | null } | null; error: unknown } =
      await supabase
        .from('payment_intents')
        .select('id, parent_intent_id')
        .eq('id', current)
        .maybeSingle();
    if (error) throw error;
    current = data?.parent_intent_id ?? null;
    if (current) root = current;
  }

  // 2. Every descendant of the purchase, one level per query.
  // Seeded with the purchase ONLY. Seeding it with intentId too marked that intent visited before
  // the walk reached it, so its own descendants were never explored (a test caught it).
  const ids = new Set<string>([root]);
  let frontier = [root];
  for (let level = 0; level < MAX_CHAIN_HOPS && frontier.length; level++) {
    const {
      data: children,
      error: childError,
    }: { data: { id: string }[] | null; error: unknown } = await supabase
      .from('payment_intents')
      .select('id')
      .in('parent_intent_id', frontier);
    if (childError) throw childError;
    frontier = (children ?? []).map((c) => c.id).filter((id) => !ids.has(id));
    for (const id of frontier) ids.add(id);
  }
  // In case the upward walk hit its bound before the purchase, the intent itself still counts.
  ids.add(intentId);
  return [...ids];
}

export type PaidGate =
  | { kind: 'proceed' }
  | {
      kind: 'refuse';
      status: 409 | 500;
      code: 'already_paid' | 'paid_check_failed';
      error: string;
    };

/**
 * What a money-moving function does with chainAlreadyPaid's answer. Paid: 409, in the same words
 * create-order's retry refusal uses. Unreadable: 500, because the alternative to "could not
 * confirm it is unpaid" is charging on a guess. Called BEFORE the provider is asked to move or
 * reserve money; scripts/__tests__/providers-refuse-a-paid-chain.test.js pins that order.
 */
export async function gateOnChainPaid(
  supabase: any,
  intentId: string
): Promise<PaidGate> {
  let paid: boolean;
  try {
    paid = await chainAlreadyPaid(supabase, intentId);
  } catch (err) {
    console.error(
      `payment-chain: could not check whether ${intentId} is paid`,
      err
    );
    return {
      kind: 'refuse',
      status: 500,
      code: 'paid_check_failed',
      error:
        'Could not confirm this payment is not already paid. Please try again.',
    };
  }
  return paid
    ? {
        kind: 'refuse',
        status: 409,
        code: 'already_paid',
        error: ALREADY_PAID_MESSAGE,
      }
    : { kind: 'proceed' };
}
