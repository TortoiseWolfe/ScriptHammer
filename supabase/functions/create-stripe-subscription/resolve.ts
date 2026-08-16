/**
 * Server-authoritative resolution of WHICH Stripe Price a subscription uses.
 *
 * THE HOLE THIS CLOSES (#772 + #559 T024). Two halves of one defect:
 *
 *   - The client resolved the price from a single global env var
 *     (`NEXT_PUBLIC_STRIPE_PRICE_ID`), not per-SKU — so every tier billed the
 *     same amount. Care Plan Pro ($249) would have charged whatever that one
 *     variable pointed at.
 *   - The server passed `body.price_id` straight into Checkout with NO
 *     validation, so a tampered request could name any Price in the account.
 *
 * Fixing only the first still lets a request name its own price. Fixing only the
 * second still bills every tier the same. So the client stopped naming prices
 * at all: it sends `product_id`, and the price comes from the catalog here.
 * **There is no allowlist because the catalog IS the allowlist** — and a wrong
 * price cannot be sent by a client that has no price to send.
 *
 * Until 2026-08-16 this was unreachable rather than fixed: the live Stripe
 * account had zero Prices, so a tampered id had nothing to point at. Creating
 * the three real Prices removed that accident. `products_recurring_provider_check`
 * had also been holding the line, and it is satisfied now, so the constraint is
 * no longer a guard either.
 *
 * Pure on purpose — same reason as `create-order/resolve.ts`: the rules are
 * unit-testable without Deno, network, or a database.
 *
 * @module supabase/functions/create-stripe-subscription/resolve
 */

/** Structural shape — deliberately not tied to the generated Supabase types. */
export interface SubscriptionProductRow {
  id: string;
  name: string;
  type: 'one_time' | 'recurring';
  interval: string | null;
  active: boolean;
  stripe_price_id: string | null;
  currency: string;
  amount: number;
}

export type SubscriptionDecision =
  | { kind: 'proceed'; priceId: string; product: SubscriptionProductRow }
  | { kind: 'refuse'; status: number; error: string };

export interface ResolveSubscriptionInput {
  /** null when no row matched the requested product_id. */
  product: SubscriptionProductRow | null;
  /**
   * Whatever the caller sent as `price_id`, typed `unknown` because the whole
   * point is that we do not trust it. Any value here is a refusal.
   */
  sentPriceId?: unknown;
}

/**
 * Same message for "no such SKU" and "inactive SKU".
 *
 * Copied deliberately from `create-order/resolve.ts` — distinguishing them tells
 * an enumerator which unreleased SKUs exist. Active catalog rows are public on
 * /pricing, so nothing is hidden that isn't already published.
 */
const NOT_FOUND = 'product not found';

export function resolveSubscription(
  input: ResolveSubscriptionInput
): SubscriptionDecision {
  // A request that names a price is refused OUTRIGHT rather than having the
  // price ignored. Accepting-but-ignoring would leave callers (and the next
  // reader) believing the field still works, and any future branch that honours
  // it silently reopens #559. Refusing is the only version that stays closed.
  if (input.sentPriceId !== undefined && input.sentPriceId !== null) {
    return {
      kind: 'refuse',
      status: 400,
      error:
        'price_id is not accepted; send product_id and the price is resolved from the catalog',
    };
  }

  if (!input.product) {
    return { kind: 'refuse', status: 404, error: NOT_FOUND };
  }
  if (!input.product.active) {
    return { kind: 'refuse', status: 404, error: NOT_FOUND };
  }

  // A one-time SKU is public on /pricing, so naming the mismatch leaks nothing
  // and saves the caller a guess.
  if (input.product.type !== 'recurring') {
    return {
      kind: 'refuse',
      status: 400,
      error: 'product is not a subscription',
    };
  }

  // REACHABLE, not a misconfiguration. `products_recurring_provider_check`
  // permits an active recurring SKU that carries only `paypal_plan_id` — so a
  // Stripe subscription request for a PayPal-only plan lands here legitimately.
  if (!input.product.stripe_price_id) {
    return {
      kind: 'refuse',
      status: 400,
      error: 'product is not available for card subscription',
    };
  }

  return {
    kind: 'proceed',
    priceId: input.product.stripe_price_id,
    product: input.product,
  };
}
