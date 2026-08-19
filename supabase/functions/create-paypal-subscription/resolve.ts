/**
 * Server-authoritative resolution of WHICH PayPal plan a subscription uses.
 *
 * THE HOLE THIS CLOSES (#774, and the PayPal half of #559). Identical in shape to
 * the Stripe defect #772 fixed, one lane over:
 *
 *   - The client resolved the plan from a single global env var
 *     (`NEXT_PUBLIC_PAYPAL_PLAN_ID`), not per-SKU — so all three recurring tiers
 *     would bill whatever that one variable pointed at. Care Plan Pro ($249)
 *     would have charged the Foundry ($49) amount, or worse.
 *   - The server took `body.plan_id` and passed it straight to
 *     `POST /v1/billing/subscriptions` with NO validation, so a tampered request
 *     could name any plan in the PayPal account — including a $1 test plan.
 *
 * Fixing only the first still lets a request name its own plan. Fixing only the
 * second still bills every tier the same. So the client stops naming plans at
 * all: it sends `product_id`, and the plan comes from the catalog here.
 * **There is no allowlist because the catalog IS the allowlist** — a wrong plan
 * cannot be sent by a client that has no plan to send.
 *
 * WHY NOW, WHILE IT IS STILL UNREACHABLE. Today every recurring SKU has
 * `paypal_plan_id = NULL` and `active = false`, so a tampered id has nothing to
 * point at — the same accident that was protecting the Stripe lane until
 * 2026-08-16, when creating three live Prices removed it. Creating PayPal plans
 * would remove this one. #774 asks for the fix to land BEFORE that happens
 * rather than after, and that is the only reason this is not urgent today.
 *
 * Pure on purpose — same reason as the Stripe twin: the rules are unit-testable
 * without Deno, network, or a database.
 *
 * @module supabase/functions/create-paypal-subscription/resolve
 */

/** Structural shape — deliberately not tied to the generated Supabase types. */
export interface PayPalSubscriptionProductRow {
  id: string;
  name: string;
  type: 'one_time' | 'recurring';
  interval: string | null;
  active: boolean;
  paypal_plan_id: string | null;
  currency: string;
  amount: number;
}

export type PayPalSubscriptionDecision =
  | { kind: 'proceed'; planId: string; product: PayPalSubscriptionProductRow }
  | { kind: 'refuse'; status: number; error: string };

export interface ResolvePayPalSubscriptionInput {
  /** null when no row matched the requested product_id. */
  product: PayPalSubscriptionProductRow | null;
  /**
   * Whatever the caller sent as `plan_id`, typed `unknown` because the whole
   * point is that we do not trust it. Any value here is a refusal.
   */
  sentPlanId?: unknown;
}

/**
 * Same message for "no such SKU" and "inactive SKU".
 *
 * Copied deliberately from the Stripe resolver — distinguishing them tells an
 * enumerator which unreleased SKUs exist. Active catalog rows are public on
 * /pricing, so nothing is hidden that isn't already published.
 */
const NOT_FOUND = 'product not found';

export function resolvePayPalSubscription(
  input: ResolvePayPalSubscriptionInput
): PayPalSubscriptionDecision {
  // A request that names a plan is refused OUTRIGHT rather than having the plan
  // ignored. Accepting-but-ignoring would leave callers (and the next reader)
  // believing the field still works, and any future branch that honours it
  // silently reopens the hole. Refusing is the only version that stays closed.
  if (input.sentPlanId !== undefined && input.sentPlanId !== null) {
    return {
      kind: 'refuse',
      status: 400,
      error:
        'plan_id is not accepted; send product_id and the plan is resolved from the catalog',
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

  // REACHABLE, not a misconfiguration — and today it is the case for EVERY
  // recurring SKU, since `paypal_plan_id` is NULL across the catalog.
  // `products_recurring_provider_check` permits an active recurring SKU that
  // carries only `stripe_price_id`, so a PayPal request for a Stripe-only plan
  // lands here legitimately.
  if (!input.product.paypal_plan_id) {
    return {
      kind: 'refuse',
      status: 400,
      error: 'product is not available for PayPal subscription',
    };
  }

  return {
    kind: 'proceed',
    planId: input.product.paypal_plan_id,
    product: input.product,
  };
}
