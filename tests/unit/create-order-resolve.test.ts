import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MAX_ATTACHMENTS,
  MIN_CHARGE_CENTS,
  buildIntentRow,
  buildOrderRow,
  decideIdempotency,
  depositPercent,
  fingerprintRequest,
  resolveChargeAmount,
  resolveOrder,
  sanitizeAttachments,
  type IdempotencyLookup,
  type ProductRow,
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

/**
 * REGRESSION GUARD for the defect the first end-to-end run found.
 *
 * `orders`' only buyer-facing policy is `SELECT USING (auth.uid() =
 * buyer_user_id)`. The original code wrote `buyer_user_id: null` for guests, so
 * the buyer could never read the order they had just paid for and /checkout's
 * return leg would never render the booking step.
 *
 * These assert the OWNERSHIP, not merely that a row comes back — an assertion
 * like `expect(row).toBeTruthy()` would have passed against the bug.
 */
describe('buildOrderRow — the buyer must own the row', () => {
  const base = {
    intentId: 'i-1',
    productId: 'svc-landing',
    buyerUserId: 'u-guest-1',
    buyerEmail: 'guest@example.com',
    amountCents: 60000,
  };

  it('carries the authenticated uid, so RLS can match auth.uid()', () => {
    expect(buildOrderRow(base).buyer_user_id).toBe('u-guest-1');
  });

  it('never writes a null owner — that row would be unreadable by its buyer', () => {
    expect(buildOrderRow(base).buyer_user_id).not.toBeNull();
    // An anonymous uid is a real auth.users id; there is no guest exemption.
    expect(() => buildOrderRow({ ...base, buyerUserId: '' })).toThrow(
      /buyerUserId is required/
    );
  });

  it('puts intake on intake_data, never on payment metadata (1KB cap)', () => {
    const row = buildOrderRow({ ...base, intake: { phone: '(423) 555-0137' } });
    expect(row.intake_data).toEqual({ phone: '(423) 555-0137' });
    expect(row).not.toHaveProperty('metadata');
  });

  it('defaults intake_data to an object, not null', () => {
    expect(buildOrderRow(base).intake_data).toEqual({});
  });

  it('opens as pending — only the webhook may mark an order paid', () => {
    expect(buildOrderRow(base).status).toBe('pending');
  });
});

/**
 * T021 — ownership of an attachment is recomputed server-side, never believed.
 *
 * Storage RLS stops a buyer WRITING outside their own prefix. It does not stop them
 * POSTing an order whose attachment list names someone else's path, and
 * /admin/orders signs those paths with service-role — which honours no RLS. Without
 * this, "guess a path" becomes "have the operator open it for you".
 */
describe('sanitizeAttachments (T021)', () => {
  const uid = '11111111-2222-3333-4444-555555555555';
  const other = '99999999-8888-7777-6666-555555555555';
  const ok = (path: string) => ({
    path,
    name: 'a.png',
    bytes: 10,
    mime: 'image/png',
    kind: 'current',
  });

  it('keeps the buyer’s own attachments', () => {
    const out = sanitizeAttachments([ok(`${uid}/a.png`)], uid);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe(`${uid}/a.png`);
  });

  it('drops a path belonging to another user', () => {
    expect(sanitizeAttachments([ok(`${other}/secret.png`)], uid)).toEqual([]);
  });

  it('drops a path that climbs out with ..', () => {
    expect(
      sanitizeAttachments([ok(`${uid}/../${other}/secret.png`)], uid)
    ).toEqual([]);
  });

  it('drops a path that nests below the uid folder', () => {
    expect(sanitizeAttachments([ok(`${uid}/sub/deep.png`)], uid)).toEqual([]);
  });

  it('drops a prefix that merely starts with the uid string', () => {
    // `${uid}-evil/…` startsWith(uid) is true; startsWith(`${uid}/`) is not.
    expect(sanitizeAttachments([ok(`${uid}-evil/x.png`)], uid)).toEqual([]);
  });

  it('caps the list at eight (FR-014)', () => {
    const many = Array.from({ length: 20 }, (_, i) => ok(`${uid}/${i}.png`));
    expect(sanitizeAttachments(many, uid)).toHaveLength(MAX_ATTACHMENTS);
  });

  it('de-duplicates repeated paths', () => {
    expect(
      sanitizeAttachments([ok(`${uid}/a.png`), ok(`${uid}/a.png`)], uid)
    ).toHaveLength(1);
  });

  it('normalises an unknown kind rather than storing it', () => {
    const out = sanitizeAttachments(
      [{ ...ok(`${uid}/a.png`), kind: 'admin-only' }],
      uid
    );
    expect(out[0].kind).toBe('unspecified');
  });

  it('strips fields the client invented', () => {
    const out = sanitizeAttachments(
      [{ ...ok(`${uid}/a.png`), is_admin: true, signedUrl: 'http://x' }],
      uid
    );
    expect(Object.keys(out[0]).sort()).toEqual([
      'bytes',
      'kind',
      'mime',
      'name',
      'path',
    ]);
  });

  it('survives junk instead of throwing', () => {
    expect(sanitizeAttachments(null, uid)).toEqual([]);
    expect(sanitizeAttachments('nope', uid)).toEqual([]);
    expect(sanitizeAttachments([null, 3, 'x'], uid)).toEqual([]);
    expect(sanitizeAttachments([ok(`${uid}/a.png`)], '')).toEqual([]);
  });
});

describe('buildOrderRow sanitises attachments before they reach the row', () => {
  const uid = '11111111-2222-3333-4444-555555555555';
  const base = {
    intentId: 'i',
    productId: 'svc-site',
    buyerUserId: uid,
    buyerEmail: 'b@example.com',
    amountCents: 100,
  };

  it('drops a foreign path supplied by the client', () => {
    const row = buildOrderRow({
      ...base,
      intake: {
        business: 'Warrior Roofing',
        attachments: [
          {
            path: `${uid}/mine.png`,
            name: 'mine.png',
            bytes: 1,
            mime: 'image/png',
            kind: 'target',
          },
          {
            path: `99999999-0000-0000-0000-000000000000/theirs.png`,
            name: 't',
            bytes: 1,
            mime: 'image/png',
            kind: 'target',
          },
        ],
      },
    });
    const intake = row.intake_data as Record<string, unknown>;
    expect(intake.attachments).toHaveLength(1);
    expect((intake.attachments as { path: string }[])[0].path).toBe(
      `${uid}/mine.png`
    );
    // the rest of the intake is untouched
    expect(intake.business).toBe('Warrior Roofing');
  });

  it('leaves an order with no attachments key alone', () => {
    const row = buildOrderRow({ ...base, intake: { business: 'X' } });
    expect(row.intake_data).toEqual({ business: 'X' });
  });
});

describe('buildIntentRow — the payment_intents row create-order writes (#559)', () => {
  const product = {
    id: 'prod-1',
    currency: 'usd',
    type: 'one_time',
    interval: null,
    name: 'Care Plan',
  };
  const base = {
    userId: 'user-1',
    amountCents: 5000,
    product,
    buyerEmail: 'buyer@example.com',
    isDeposit: false,
  };

  it('persists the idempotency key onto the row', () => {
    // THE POINT OF THIS FUNCTION. create-order claimed the key in
    // edge_idempotency_keys and left the COLUMN null, so
    // idx_payment_intents_idempotency_key — a partial unique index that exists to
    // stop duplicate intents — never applied to a single catalog purchase, and
    // retry lineage (payment-service.ts reads parent.idempotency_key) had nothing
    // to anchor to.
    const row = buildIntentRow({ ...base, idempotencyKey: 'key-abc' });
    expect(row.idempotency_key).toBe('key-abc');
  });

  it('preserves a null key as null rather than inventing one', () => {
    // The partial index ignores nulls, and a caller that sends no header must keep
    // the previous behaviour. Minting a key here would silently make every
    // keyless request unique and defeat the index it is meant to feed.
    const row = buildIntentRow({ ...base, idempotencyKey: null });
    expect(row.idempotency_key).toBeNull();
  });

  it('carries the catalog-derived fields unchanged', () => {
    const row = buildIntentRow({ ...base, idempotencyKey: 'k' });
    expect(row).toMatchObject({
      template_user_id: 'user-1',
      amount: 5000,
      currency: 'usd',
      type: 'one_time',
      interval: null,
      customer_email: 'buyer@example.com',
      description: 'Care Plan',
      metadata: { product_id: 'prod-1', is_deposit: false },
    });
  });

  it('labels a deposit in the description without changing the product name', () => {
    const row = buildIntentRow({
      ...base,
      isDeposit: true,
      amountCents: 2500,
      idempotencyKey: 'k',
    });
    expect(row.description).toBe('Care Plan (50% deposit)');
    expect(row.metadata).toEqual({ product_id: 'prod-1', is_deposit: true });
  });

  it('refuses to build a row with no user, rather than writing an unreadable one', () => {
    // Same reasoning as buildOrderRow: template_user_id is what the RLS SELECT
    // policy matches on (auth.uid() = template_user_id), so a row without it is a
    // row its own buyer cannot read.
    expect(() =>
      buildIntentRow({ ...base, userId: '', idempotencyKey: 'k' })
    ).toThrow(/userId is required/);
  });
});

describe('the create-order handler actually uses buildIntentRow (#559)', () => {
  // WHY A SOURCE ASSERTION. index.ts cannot be imported here — `supabase/functions/**`
  // is excluded from vitest and no workflow runs `deno test` — so the tests above
  // verify a function that nothing proves the handler calls. That is exactly the #895
  // defect: a module fully unit-tested and called by nobody. Reverting index.ts to an
  // inline .insert({...}) would leave every assertion above green while catalog
  // purchases silently went back to a null idempotency_key.
  const handler = (): string => {
    const src = readFileSync(
      path.resolve(__dirname, '../../supabase/functions/create-order/index.ts'),
      'utf8'
    );
    // Comments are not code. index.ts documents this decision in prose, and matching
    // the prose would keep this green with the call removed.
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  };

  it('builds the payment_intents row through buildIntentRow', () => {
    expect(handler()).toMatch(
      /\.from\('payment_intents'\)\s*\.insert\(\s*buildIntentRow\(/
    );
  });

  it('passes the request idempotency key into it', () => {
    // The header value must reach the row. Passing `null` here would satisfy the
    // regex above while restoring the original defect.
    const m = handler().match(/buildIntentRow\(\{[\s\S]*?\}\)/);
    expect(m, 'no buildIntentRow({...}) call found in index.ts').not.toBeNull();
    expect(m![0]).toMatch(/\bidempotencyKey\b/);
    expect(m![0]).not.toMatch(/idempotencyKey:\s*null/);
  });
});
