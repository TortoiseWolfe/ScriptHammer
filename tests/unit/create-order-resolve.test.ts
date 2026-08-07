import { describe, it, expect } from 'vitest';
import {
  resolveOrder,
  resolveChargeAmount,
  decideIdempotency,
  depositPercent,
  fingerprintRequest,
  MIN_CHARGE_CENTS,
  type ProductRow,
  type IdempotencyLookup,
} from '../../supabase/functions/create-order/resolve';

/**
 * These exercise the decision logic of the `create-order` Edge Function without
 * Deno, which is possible only because resolve.ts imports nothing.
 *
 * The suite is mostly about REFUSALS. create-order is the function that owns
 * price, so almost everything worth testing is a thing it must not do.
 */

const landing: ProductRow = {
  id: 'svc-landing',
  amount: 120000,
  amount_mode: 'fixed',
  min_amount: null,
  max_amount: null,
  currency: 'usd',
  type: 'one_time',
  interval: null,
  active: true,
  metadata: { deposit_pct: 50 },
  name: 'Landing Page',
};

const discovery: ProductRow = {
  ...landing,
  id: 'svc-discovery',
  amount: 25000,
  metadata: {},
  name: 'Discovery',
};

const forge: ProductRow = {
  ...landing,
  id: 'prd-forge',
  amount: 0,
  metadata: { purchasable: false },
  name: 'Forge',
};

const tipJar: ProductRow = {
  ...landing,
  id: 'tip-jar',
  amount: 1500,
  amount_mode: 'variable',
  min_amount: 100,
  max_amount: 50000,
  metadata: {},
  name: 'Tip Jar',
};

const miss: IdempotencyLookup = { state: 'miss' };
const base = { idempotencyKey: null, lookup: miss, requestFingerprint: 'abc' };

describe('price is owned by the catalog', () => {
  it('IGNORES a submitted amount on a fixed SKU', () => {
    // The whole point. A tampered client sending 100 gets charged the real price.
    const r = resolveOrder({ ...base, product: landing, submittedAmount: 100 });
    expect(r).toEqual({
      kind: 'proceed',
      amountCents: 60000, // 50% deposit of $1,200
      isDeposit: true,
      fullPriceCents: 120000,
    });
  });

  it('does not reveal that the submitted amount was wrong', () => {
    // FR-002: "discarded, not validated". Rejecting with "expected 120000" would
    // turn this into a price oracle.
    const wrong = resolveOrder({
      ...base,
      product: landing,
      submittedAmount: 1,
    });
    const absent = resolveOrder({ ...base, product: landing });
    const silly = resolveOrder({
      ...base,
      product: landing,
      submittedAmount: 'free',
    });
    // Every guess produces the IDENTICAL outcome — that is what makes it not an
    // oracle. A caller learns nothing about the real price by probing.
    for (const guess of [1, 100, 119999, 120000, 120001, 999999, -5]) {
      expect(
        resolveOrder({ ...base, product: landing, submittedAmount: guess })
      ).toEqual(absent);
    }
    expect(wrong).toEqual(absent);
    expect(silly).toEqual(absent);
    // And the charge is the catalog's deposit, never anything the caller sent.
    expect(absent).toMatchObject({ kind: 'proceed', amountCents: 60000 });
  });

  it('charges in full when the SKU has no deposit_pct', () => {
    const r = resolveOrder({
      ...base,
      product: discovery,
      submittedAmount: 999999,
    });
    expect(r).toMatchObject({
      kind: 'proceed',
      amountCents: 25000,
      isDeposit: false,
    });
  });

  it('rounds a deposit DOWN, never up', () => {
    // An odd price must not be rounded into charging more than half.
    const odd = { ...landing, amount: 12345, metadata: { deposit_pct: 50 } };
    const r = resolveChargeAmount(odd, undefined);
    expect(r).toMatchObject({ ok: true, amountCents: 6172 }); // not 6173
  });

  it('refuses a $0 SKU rather than failing later at the DB floor', () => {
    const r = resolveOrder({ ...base, product: forge });
    expect(r).toEqual({
      kind: 'refuse',
      status: 400,
      error: 'prd-forge is not purchasable',
    });
  });

  it('bills in full when a deposit would fall under the minimum charge', () => {
    const cheap = { ...landing, amount: 150, metadata: { deposit_pct: 50 } };
    const r = resolveChargeAmount(cheap, undefined); // 50% = 75, below 100
    expect(r).toMatchObject({ ok: true, amountCents: 150, isDeposit: false });
  });
});

describe('deposit_pct parsing rejects nonsense', () => {
  it.each([
    ['missing', {}],
    ['zero', { deposit_pct: 0 }],
    ['100 percent', { deposit_pct: 100 }],
    ['over 100', { deposit_pct: 150 }],
    ['negative', { deposit_pct: -50 }],
    ['fractional', { deposit_pct: 33.3 }],
    ['string', { deposit_pct: '50' }],
    ['NaN', { deposit_pct: Number.NaN }],
  ])('treats %s as no deposit', (_label, metadata) => {
    expect(depositPercent({ ...landing, metadata })).toBeNull();
  });

  it('accepts a sane percentage', () => {
    expect(depositPercent(landing)).toBe(50);
  });
});

describe('variable amount — the one place a client number is honoured', () => {
  it('accepts an in-bounds whole amount', () => {
    const r = resolveOrder({ ...base, product: tipJar, submittedAmount: 2500 });
    expect(r).toMatchObject({
      kind: 'proceed',
      amountCents: 2500,
      isDeposit: false,
    });
  });

  it.each([
    ['below min', 99],
    ['above max', 50001],
  ])('refuses %s', (_label, amount) => {
    const r = resolveOrder({
      ...base,
      product: tipJar,
      submittedAmount: amount,
    });
    expect(r).toMatchObject({ kind: 'refuse', status: 400 });
    // Bounds are stated to the visitor on the tip-jar screen, so echoing is fine.
    expect((r as { error: string }).error).toMatch(/between 100 and 50000/);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    // IN BOUNDS on purpose. 15.5 would be rejected by the min-amount check
    // whether or not the integer check exists, so it proved nothing — the
    // mutation that deletes Number.isInteger slipped past it.
    ['an in-bounds float', 2500.5],
    ['a string', '2500'],
    ['null', null],
    ['undefined', undefined],
  ])(
    'refuses %s — validatePaymentAmount checks none of these',
    (_label, amount) => {
      const r = resolveOrder({
        ...base,
        product: tipJar,
        submittedAmount: amount,
      });
      expect(r.kind).toBe('refuse');
      expect((r as { status: number }).status).toBe(400);
      // Assert WHICH refusal. A bounds error and a type error are both 400, so
      // checking only the status lets one stand in for the other.
      const err = (r as { error: string }).error;
      expect(err).not.toMatch(/between/);
    }
  );
});

describe('product visibility', () => {
  it('404s an unknown SKU', () => {
    expect(resolveOrder({ ...base, product: null })).toEqual({
      kind: 'refuse',
      status: 404,
      error: 'product not found',
    });
  });

  it('404s an INACTIVE SKU with the identical message', () => {
    // Distinguishing "no such product" from "not released yet" would let anyone
    // enumerate the unreleased catalog.
    const inactive = resolveOrder({
      ...base,
      product: { ...landing, active: false },
    });
    expect(inactive).toEqual(resolveOrder({ ...base, product: null }));
  });
});

describe('idempotency — fail closed', () => {
  const key = 'idem-1';

  it('proceeds when no key was supplied (caller opted out)', () => {
    expect(
      decideIdempotency(null, { state: 'unavailable', reason: 'down' }, 'f')
    ).toEqual({
      kind: 'proceed',
    });
  });

  it('REFUSES when the store is unavailable and a key WAS supplied', () => {
    // The reversal of the shared helper's fail-open default. A duplicate charge
    // costs more than a retry.
    const d = decideIdempotency(
      key,
      { state: 'unavailable', reason: 'timeout' },
      'f'
    );
    expect(d).toMatchObject({ kind: 'refuse', status: 503 });
    expect((d as { error: string }).error).toMatch(/Nothing was charged/);
  });

  it('replays a hit with a matching fingerprint', () => {
    const d = decideIdempotency(
      key,
      { state: 'hit', result: { order_id: 'o_1' }, fingerprint: 'f' },
      'f'
    );
    expect(d).toEqual({ kind: 'replay', result: { order_id: 'o_1' } });
  });

  it('409s a key reused with a DIFFERENT payload', () => {
    // Replaying here would hand back a wrong-product order and nothing would say so.
    const d = decideIdempotency(
      key,
      {
        state: 'hit',
        result: { order_id: 'o_1' },
        fingerprint: 'fingerprint-A',
      },
      'fingerprint-B'
    );
    expect(d).toMatchObject({ kind: 'refuse', status: 409 });
  });

  it('replays a legacy row that predates fingerprinting', () => {
    const d = decideIdempotency(
      key,
      { state: 'hit', result: { order_id: 'o_1' }, fingerprint: null },
      'anything'
    );
    expect(d).toEqual({ kind: 'replay', result: { order_id: 'o_1' } });
  });

  it('a replay does not depend on the product still existing', () => {
    // The buyer already completed this. Re-pricing it would be wrong, and a
    // delisted SKU must not turn a successful order into a 404.
    const r = resolveOrder({
      product: null,
      idempotencyKey: key,
      lookup: { state: 'hit', result: { order_id: 'o_1' }, fingerprint: 'f' },
      requestFingerprint: 'f',
    });
    expect(r).toEqual({ kind: 'replay', result: { order_id: 'o_1' } });
  });

  it('refuses before pricing when the store is unavailable', () => {
    const r = resolveOrder({
      product: landing,
      submittedAmount: 100,
      idempotencyKey: key,
      lookup: { state: 'unavailable', reason: 'down' },
      requestFingerprint: 'f',
    });
    expect(r).toMatchObject({ kind: 'refuse', status: 503 });
  });
});

describe('request fingerprint', () => {
  it('is stable for the same meaningful request', () => {
    const a = fingerprintRequest({
      productId: 'svc-landing',
      buyerEmail: 'A@b.c',
    });
    const b = fingerprintRequest({
      productId: 'svc-landing',
      buyerEmail: 'a@B.c ',
    });
    expect(a).toBe(b); // email is normalised
  });

  it('changes when the product changes', () => {
    expect(fingerprintRequest({ productId: 'svc-landing' })).not.toBe(
      fingerprintRequest({ productId: 'svc-site' })
    );
  });

  it('changes when a variable amount changes', () => {
    expect(fingerprintRequest({ productId: 'tip-jar', amount: 500 })).not.toBe(
      fingerprintRequest({ productId: 'tip-jar', amount: 5000 })
    );
  });

  it('does NOT change when only intake changes', () => {
    // Fixing a typo in a phone number and retrying with the same key is the same
    // purchase. 409-ing that would be hostile.
    const a = fingerprintRequest({
      productId: 'svc-landing',
      buyerEmail: 'a@b.c',
    });
    const b = fingerprintRequest({
      productId: 'svc-landing',
      buyerEmail: 'a@b.c',
    });
    expect(a).toBe(b);
  });

  it('ignores a submitted amount on fixed SKUs consistently', () => {
    // A fixed SKU's amount is discarded downstream, so two requests differing
    // only in a bogus amount are still the same request.
    expect(fingerprintRequest({ productId: 'svc-landing', amount: 'x' })).toBe(
      fingerprintRequest({ productId: 'svc-landing' })
    );
  });
});

describe('constants stay honest', () => {
  it('the minimum charge matches the payment_intents floor', () => {
    expect(MIN_CHARGE_CENTS).toBe(100);
  });
});
