import { describe, it, expect } from 'vitest';
import {
  resolvePayPalSubscription,
  type PayPalSubscriptionProductRow,
} from '../../supabase/functions/create-paypal-subscription/resolve';

/**
 * The PayPal plan is resolved from the CATALOG, never from the request (#774,
 * and the PayPal half of #559).
 *
 * WHAT THESE HAVE TO CATCH, and why the obvious test does not:
 *
 *   A test that asserts "a plan id came back" passes on the original bug. The bug
 *   was that the SAME plan came back for every tier — one global
 *   `NEXT_PUBLIC_PAYPAL_PLAN_ID`, so $49/$99/$249 plans would all bill one
 *   amount. So the load-bearing assertion is that two DIFFERENT SKUs resolve to
 *   two DIFFERENT plans.
 *
 * The second half is #559: the server passed `body.plan_id` into
 * `POST /v1/billing/subscriptions` unvalidated, so a tampered request could name
 * any plan in the PayPal account — including a $1 test plan.
 *
 * Mirrors tests/unit/create-subscription-resolve.test.ts, which covers the same
 * rule for the Stripe lane.
 */

/**
 * Plan ids are INVENTED, unlike the Stripe twin's fixtures.
 *
 * Every `products.paypal_plan_id` in the live catalog is NULL today — no PayPal
 * plans have been created yet, which is exactly why #774 asks for this fix to
 * land BEFORE they are. So there are no real values to pin, and the shape
 * (`P-` + 24 chars) is what PayPal issues. `refuses every SKU in today's live
 * catalog` below covers the real current state.
 */
const CARE: PayPalSubscriptionProductRow = {
  id: 'svc-care',
  name: 'Care Plan',
  type: 'recurring',
  interval: 'month',
  active: true,
  paypal_plan_id: 'P-5ML4271244454362WXNWU5NQ',
  currency: 'usd',
  amount: 9900,
};

const CARE_PRO: PayPalSubscriptionProductRow = {
  ...CARE,
  id: 'svc-care-pro',
  name: 'Care Plan Pro',
  paypal_plan_id: 'P-1RX000000M4494601MGXXXXX',
  amount: 24900,
};

/**
 * A one-time SKU valid in EVERY other respect — active, and carrying a plan id.
 *
 * `paypal_plan_id` is deliberately NOT null. The Stripe twin records why: with
 * null, deleting the `type === 'recurring'` rule left the row refused by the
 * NEXT check instead, both returning 400, and the suite stayed green on the
 * mutation. The fixture has to make the type rule the only thing that can refuse
 * it, or the test measures nothing.
 */
const ONE_TIME: PayPalSubscriptionProductRow = {
  id: 'svc-site',
  name: 'Business Site',
  type: 'one_time',
  interval: null,
  active: true,
  paypal_plan_id: 'P-ONETIMESHOULDNEVERBEUSED',
  currency: 'usd',
  amount: 350000,
};

describe('resolvePayPalSubscription — the catalog is the allowlist (#774/#559)', () => {
  it('resolves an active recurring SKU to its own plan', () => {
    const d = resolvePayPalSubscription({ product: CARE });
    expect(d.kind).toBe('proceed');
    if (d.kind !== 'proceed') return;
    expect(d.planId).toBe('P-5ML4271244454362WXNWU5NQ');
  });

  it('THE #774 CASE: two tiers resolve to two DIFFERENT plans', () => {
    // The assertion the bug would fail. Asserting merely that each call returns
    // *a* plan id passes on the global-env-var version, because that returned a
    // valid plan id too — just the same one every time.
    const a = resolvePayPalSubscription({ product: CARE });
    const b = resolvePayPalSubscription({ product: CARE_PRO });
    expect(a.kind).toBe('proceed');
    expect(b.kind).toBe('proceed');
    if (a.kind !== 'proceed' || b.kind !== 'proceed') return;

    expect(a.planId).not.toBe(b.planId);
    // And each is the plan belonging to THAT product, not merely distinct.
    expect(a.planId).toBe(CARE.paypal_plan_id);
    expect(b.planId).toBe(CARE_PRO.paypal_plan_id);
  });

  it('THE #559 CASE: a request naming its own plan_id is refused, not ignored', () => {
    // Refused rather than silently dropped: ignoring it would leave callers and
    // future readers believing the field still works, and any later branch that
    // honours it reopens the hole.
    const d = resolvePayPalSubscription({
      product: CARE,
      sentPlanId: 'P-ATTACKERCHOSEONEDOLLARPLAN',
    });
    expect(d.kind).toBe('refuse');
    if (d.kind !== 'refuse') return;
    expect(d.status).toBe(400);
    expect(d.error).toMatch(/plan_id is not accepted/);
  });

  it('refuses a sent plan_id even when it matches the catalog', () => {
    // The rule is "the client does not name plans", not "the client must guess
    // right". A version that only rejected MISMATCHES would still accept the
    // field, and the next reader would treat it as supported.
    const d = resolvePayPalSubscription({
      product: CARE,
      sentPlanId: CARE.paypal_plan_id,
    });
    expect(d.kind).toBe('refuse');
  });

  it('refuses an unknown SKU and an inactive one identically', () => {
    // Same message on purpose — distinguishing them tells an enumerator which
    // unreleased SKUs exist.
    const missing = resolvePayPalSubscription({ product: null });
    const inactive = resolvePayPalSubscription({
      product: { ...CARE, active: false },
    });
    expect(missing.kind).toBe('refuse');
    expect(inactive.kind).toBe('refuse');
    if (missing.kind !== 'refuse' || inactive.kind !== 'refuse') return;
    expect(missing.status).toBe(404);
    expect(inactive.status).toBe(404);
    expect(missing.error).toBe(inactive.error);
  });

  it('refuses a one-time SKU', () => {
    const d = resolvePayPalSubscription({ product: ONE_TIME });
    expect(d.kind).toBe('refuse');
    if (d.kind !== 'refuse') return;
    expect(d.status).toBe(400);
    expect(d.error).toMatch(/not a subscription/);
  });

  it("refuses every SKU in today's live catalog, because paypal_plan_id is NULL", () => {
    // The real current state, and the reason this fix is not urgent yet: there
    // is no PayPal plan to bill or to tamper with. Creating plans removes that
    // accident — which is why the fix lands first this time (#774).
    const d = resolvePayPalSubscription({
      product: { ...CARE, paypal_plan_id: null },
    });
    expect(d.kind).toBe('refuse');
    if (d.kind !== 'refuse') return;
    expect(d.status).toBe(400);
    expect(d.error).toMatch(/not available for PayPal/);
  });

  it('checks the sent-plan rule before anything else', () => {
    // A tampered plan_id on an unknown product must still report the tampering,
    // otherwise probing for valid product ids is free.
    const d = resolvePayPalSubscription({
      product: null,
      sentPlanId: 'P-ANYTHING',
    });
    expect(d.kind).toBe('refuse');
    if (d.kind !== 'refuse') return;
    expect(d.error).toMatch(/plan_id is not accepted/);
  });
});
