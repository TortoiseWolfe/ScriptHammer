/**
 * Every ONE-OFF payment function asks whether the purchase is already paid FIRST (#1342).
 *
 * WHY A SOURCE-LEVEL GUARD. Nothing in CI executes an Edge Function (`vitest.config.ts` excludes
 * `supabase/functions/**` and no workflow runs `deno test`). The gate itself is covered
 * behaviourally in `tests/unit/payment-chain.test.ts`; the WIRING has no such route. Delete a
 * call, or move it below the provider call, and every other check stays green while a buyer can
 * be charged twice for one purchase.
 *
 * What it closes: nothing stopped a second Stripe session or PayPal order being opened for an
 * intent already paid, or a PayPal order being captured after another attempt in its retry chain
 * had succeeded. A retry that dedupes hands back the same child intent, so re-opening the
 * provider-switch panel, or pressing Retry twice, was enough to reach it.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FN = path.resolve(__dirname, '..', '..', 'supabase', 'functions');
const GATE = path.join(FN, '_shared', 'payment-chain.ts');

/** Block and full-line `//` comments removed, so this cannot match its own rationale. */
function code(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** [function, the call that moves money or commits the buyer to paying]. */
const MONEY = [
  ['create-stripe-checkout', /stripe\.checkout\.sessions\.create\(/],
  ['create-paypal-order', /\/v2\/checkout\/orders`/],
  ['capture-paypal-order', /\/v2\/checkout\/orders\/\$\{orderId\}\/capture/],
];

const index = (name) => path.join(FN, name, 'index.ts');

describe('the money-moving Edge Functions refuse a paid purchase first (#1342)', () => {
  it('the gate exists and is what the unit tests cover', () => {
    // Anti-vacuity: a moved file would make every assertion below pass by inspecting nothing.
    assert.ok(fs.existsSync(GATE), '_shared/payment-chain.ts is gone');
    const src = code(GATE);
    assert.match(src, /export async function gateOnChainPaid/);
    assert.match(src, /export async function chainAlreadyPaid/);
  });

  for (const [name, money] of MONEY) {
    it(`${name} asks the gate before it moves money, and returns its refusal`, () => {
      const src = code(index(name));
      assert.match(
        src,
        /import \{[^}]*\bgateOnChainPaid\b[^}]*\} from '\.\.\/_shared\/payment-chain\.ts'/,
        `${name} does not import the gate`
      );
      const moneyAt = src.search(money);
      assert.ok(
        moneyAt > 0,
        `${name}: the money-moving call was not found, so nothing was checked`
      );
      const gateAt = src.search(/await gateOnChainPaid\(/);
      assert.ok(gateAt > 0, `${name} never calls the gate`);
      assert.ok(
        gateAt < moneyAt,
        `${name} asks whether the purchase is paid only AFTER moving money, which is too late`
      );
      const between = src.slice(gateAt, moneyAt);
      assert.match(
        between,
        /if \(\w+\.kind === 'refuse'\)\s*\{?\s*return jsonResponse\(/,
        `${name} calls the gate but does not return its refusal before moving money`
      );
      // AFTER ownership (blind review). The gate answers "paid" or "not paid" about whatever
      // intent it is given; asked before the 403, it would tell a stranger whether someone
      // else's purchase went through.
      const ownershipAt = src.search(/\b403\b/);
      assert.ok(
        ownershipAt > 0,
        `${name}: the ownership refusal (403) was not found`
      );
      assert.ok(
        ownershipAt < gateAt,
        `${name} asks whether the purchase is paid BEFORE checking the caller owns it`
      );
    });
  }

  it('capture-paypal-order treats its OWN order already captured as done, before the gate', () => {
    // A double-clicked approval used to reach PayPal twice; the second capture fails there. With
    // the gate alone it would be refused as "already paid" — true, but the buyer did just pay. The
    // order's own row, read first, answers COMPLETED without calling PayPal again.
    const src = code(index('capture-paypal-order'));
    const ownRow = src.search(/result\.status === 'succeeded'/);
    const gateAt = src.search(/await gateOnChainPaid\(/);
    assert.ok(
      ownRow > 0,
      "capture-paypal-order no longer checks its own row's status"
    );
    assert.ok(
      ownRow < gateAt,
      'the own-row check must come before the chain gate'
    );
    // And after ownership: "this order was already captured" is about someone's payment too.
    assert.ok(
      src.search(/\b403\b/) < ownRow,
      'the own-row shortcut answers before the caller is shown to own the order'
    );
  });

  it('capture-paypal-order reads the result of recording the capture', () => {
    // `await supabase.from('payment_results').update(...)` with nothing assigned is how a second
    // capture of a paid intent was captured at PayPal and left 'pending' here with no error.
    const src = code(index('capture-paypal-order'));
    assert.doesNotMatch(
      src,
      /^\s*await supabase\s*\.from\('payment_results'\)\s*\.update\(/m,
      'the capture writes its result and ignores whether the write worked'
    );
    // Not just the old shape: assigning the error and never looking at it is the same bug.
    assert.match(
      src,
      /if \(recordError\)/,
      'the capture no longer checks the result of recording the capture'
    );
    assert.match(src, /recorded: false/, 'a failed record no longer says so');
  });

  it('create-order uses the shared gate code, not a second copy of it', () => {
    // Two copies of the chain walk would drift; the one the retry branch uses must be this one.
    const resolve = code(path.join(FN, 'create-order', 'resolve.ts'));
    assert.doesNotMatch(resolve, /export async function chainAlreadyPaid/);
    assert.match(
      code(index('create-order')),
      /from '\.\.\/_shared\/payment-chain\.ts'/
    );
  });
});
