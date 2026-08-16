import { describe, it, expect } from 'vitest';
import {
  resolveSubscription,
  type SubscriptionProductRow,
} from '../../supabase/functions/create-stripe-subscription/resolve';

/**
 * The subscription price is resolved from the CATALOG, never from the request
 * (#772 + #559 T024).
 *
 * WHAT THESE HAVE TO CATCH, and why the obvious test does not:
 *
 *   A test that asserts "a price id came back" passes on the original bug. The
 *   bug was that the SAME price came back for every tier — one global
 *   `NEXT_PUBLIC_STRIPE_PRICE_ID`, so $49/$99/$249 plans all billed one amount.
 *   So the load-bearing assertion is that two DIFFERENT SKUs resolve to two
 *   DIFFERENT prices, using the real catalog values.
 *
 * The second half is #559: the server used to pass `body.price_id` into Stripe
 * Checkout unvalidated, so a tampered request could name any Price in the
 * account. Creating three live Prices on 2026-08-16 is what made that
 * exploitable — before, there was nothing valid to point at.
 *
 * Mirrors tests/unit/create-order-resolve.test.ts, which covers the same
 * catalog-authority rule for one-time SKUs.
 */

/** Real values from the live catalog, so the test breaks if the seed changes. */
const CARE: SubscriptionProductRow = {
  id: 'svc-care',
  name: 'Care Plan',
  type: 'recurring',
  interval: 'month',
  active: true,
  stripe_price_id: 'price_1U57xuFyYb9UmgXxL2xtiNLr',
  currency: 'usd',
  amount: 9900,
};

const CARE_PRO: SubscriptionProductRow = {
  id: 'svc-care-pro',
  name: 'Care Plan Pro',
  type: 'recurring',
  interval: 'month',
  active: true,
  stripe_price_id: 'price_1U57xvFyYb9UmgXxSok6lJCV',
  currency: 'usd',
  amount: 24900,
};

/**
 * A one-time SKU that is valid in EVERY other respect — active, and carrying a
 * Stripe price id.
 *
 * `stripe_price_id` is deliberately NOT null here. With null, deleting the
 * `type === 'recurring'` rule left this row refused by the next check instead,
 * both returning 400, and the whole suite stayed green on the mutation. The
 * fixture has to make the type rule the ONLY thing that can refuse it, or the
 * test measures nothing. (Caught by mutation, not by review.)
 */
const ONE_TIME: SubscriptionProductRow = {
  id: 'svc-site',
  name: 'Business Site',
  type: 'one_time',
  interval: null,
  active: true,
  stripe_price_id: 'price_one_time_should_never_be_used',
  currency: 'usd',
  amount: 350000,
};

describe('resolveSubscription — the catalog is the allowlist (#772/#559)', () => {
  it('resolves an active recurring SKU to its own price', () => {
    const d = resolveSubscription({ product: CARE });
    expect(d.kind).toBe('proceed');
    if (d.kind !== 'proceed') return;
    expect(d.priceId).toBe('price_1U57xuFyYb9UmgXxL2xtiNLr');
  });

  it('THE #772 CASE: two tiers resolve to two DIFFERENT prices', () => {
    // This is the assertion the bug would fail. Asserting merely that each call
    // returns *a* price id passes on the global-env-var version, because that
    // returned a valid price id too — just the same one every time.
    const a = resolveSubscription({ product: CARE });
    const b = resolveSubscription({ product: CARE_PRO });
    expect(a.kind).toBe('proceed');
    expect(b.kind).toBe('proceed');
    if (a.kind !== 'proceed' || b.kind !== 'proceed') return;

    expect(a.priceId).not.toBe(b.priceId);
    // And each is the price belonging to THAT product, not merely distinct.
    expect(a.priceId).toBe(CARE.stripe_price_id);
    expect(b.priceId).toBe(CARE_PRO.stripe_price_id);
  });

  it('THE #559 CASE: a request naming its own price_id is refused, not ignored', () => {
    // Refused rather than silently dropped: ignoring it would leave callers and
    // future readers believing the field still works, and any later branch that
    // honours it reopens the hole.
    const d = resolveSubscription({
      product: CARE_PRO,
      sentPriceId: CARE.stripe_price_id, // the $99 price for the $249 plan
    });
    expect(d.kind).toBe('refuse');
    if (d.kind !== 'refuse') return;
    expect(d.status).toBe(400);
    expect(d.status).toBeLessThan(500); // never a 5xx for a caller error
  });

  it('refuses an arbitrary price id even when it is not in the catalog', () => {
    const d = resolveSubscription({
      product: CARE,
      sentPriceId: 'price_attacker_controlled',
    });
    expect(d.kind).toBe('refuse');
  });

  it('an unknown SKU and an INACTIVE SKU are indistinguishable', () => {
    // Same status AND same message — differing text tells an enumerator which
    // unreleased SKUs exist. Convention copied from create-order/resolve.ts.
    const unknown = resolveSubscription({ product: null });
    const inactive = resolveSubscription({
      product: { ...CARE, active: false },
    });
    expect(unknown.kind).toBe('refuse');
    expect(inactive.kind).toBe('refuse');
    if (unknown.kind !== 'refuse' || inactive.kind !== 'refuse') return;
    expect(unknown.status).toBe(404);
    expect(inactive.status).toBe(404);
    expect(unknown.error).toBe(inactive.error);
  });

  it('refuses a one-time SKU even though it has a usable price', () => {
    // ONE_TIME is valid in every other respect, so this can only fail if the
    // type rule is gone — and it must not fall through to the price, which is
    // present and would otherwise be charged as a subscription.
    const d = resolveSubscription({ product: ONE_TIME });
    expect(d.kind).toBe('refuse');
    if (d.kind !== 'refuse') return;
    expect(d.status).toBe(400);
    expect(d.error).toBe('product is not a subscription');
  });

  it('refuses a recurring SKU that has no Stripe price (PayPal-only plan)', () => {
    // Reachable, not a misconfiguration: products_recurring_provider_check is
    // satisfied by EITHER stripe_price_id OR paypal_plan_id, so an active
    // recurring row can legitimately have no Stripe price.
    const d = resolveSubscription({
      product: { ...CARE, stripe_price_id: null },
    });
    expect(d.kind).toBe('refuse');
    if (d.kind !== 'refuse') return;
    expect(d.status).toBe(400);
    expect(d.status).toBeLessThan(500);
  });

  it('never returns a price for any refusal', () => {
    // Belt and braces: a refusal that still carried a priceId would be a
    // caller-side footgun if anyone read the field before checking `kind`.
    const refusals = [
      resolveSubscription({ product: null }),
      resolveSubscription({ product: { ...CARE, active: false } }),
      resolveSubscription({ product: ONE_TIME }),
      resolveSubscription({ product: CARE, sentPriceId: 'price_x' }),
    ];
    for (const d of refusals) {
      expect(d.kind).toBe('refuse');
      expect((d as { priceId?: string }).priceId).toBeUndefined();
    }
  });
});
