/**
 * Both payment webhooks must actually CALL the order transition (#1151, #1150).
 *
 * WHY A SOURCE-LEVEL GUARD. `vitest.config.ts` excludes `supabase/functions/**` and no workflow
 * runs `deno test`, so **nothing in CI ever executes an Edge Function**. `advance-order.ts`
 * itself is covered behaviourally in `tests/unit/advance-order.test.ts` (it imports nothing, so
 * it can be pulled into the required `Test (20.x)` check) — but the WIRING has no such route.
 * Delete a call site and every check in this repo stays green while a buyer's order silently
 * stops advancing.
 *
 * That is not hypothetical here: `send-payment-email` shipped deployed, contract-tested, and
 * called by nothing, and survived that way until #1150. A tested unit with no caller is the
 * exact failure this file exists to prevent recurring one level up.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FN = path.resolve(__dirname, '..', '..', 'supabase', 'functions');
const HELPER = path.join(FN, '_shared', 'advance-order.ts');

/** Block and full-line `//` comments removed, so this cannot match its own rationale. */
function code(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const WEBHOOKS = [
  ['stripe-webhook', path.join(FN, 'stripe-webhook', 'index.ts')],
  ['paypal-webhook', path.join(FN, 'paypal-webhook', 'index.ts')],
];

describe('the payment webhooks advance the order (#1151)', () => {
  it('the helper exists and is what the tests cover', () => {
    // Anti-vacuity: a moved file would make the assertions below pass by inspecting nothing.
    assert.ok(fs.existsSync(HELPER), 'advance-order.ts is gone');
    const src = code(HELPER);
    assert.match(src, /export async function advanceOrderAndNotify/);
    assert.ok(src.length > 1000, 'advance-order.ts is suspiciously small');
  });

  for (const [name, file] of WEBHOOKS) {
    it(`${name} imports and calls it`, () => {
      const src = code(file);
      assert.match(
        src,
        /import \{ advanceOrderAndNotify \} from '\.\.\/_shared\/advance-order\.ts'/,
        `${name} no longer imports the transition`
      );
      assert.match(
        src,
        /await advanceOrderAndNotify\(/,
        `${name} imports the transition but never calls it — the order stays 'pending' forever ` +
          'and the buyer gets no receipt, with every check in this repo still green (#1151).'
      );
    });
  }

  it('stripe wires BOTH of its payment paths, including the one production uses', () => {
    // `/checkout` sends buyers to HOSTED Stripe Checkout, so `checkout.session.completed` is the
    // event a real purchase produces. Wiring only `payment_intent.succeeded` — the inline path —
    // would look complete and do nothing for an actual customer. That is the #1126 shape.
    const src = code(WEBHOOKS[0][1]);
    const calls = (src.match(/await advanceOrderAndNotify\(/g) || []).length;
    assert.ok(
      calls >= 2,
      `stripe-webhook calls the transition ${calls} time(s); both handlePaymentIntentSucceeded ` +
        'and handlePaymentCheckout need it, and hosted Checkout is the path production takes.'
    );
  });

  it('the transition never throws out of the helper', () => {
    // A webhook that throws makes the provider retry the event — forever, for a condition that
    // will never change (a retried intent has no order row, #1126). Every exit is a return.
    const src = code(HELPER);
    assert.doesNotMatch(
      src,
      /^\s*throw /m,
      'advance-order.ts throws. A thrown error reaches the webhook handler and turns a ' +
        'permanent condition into an infinite provider retry (#1151).'
    );
  });

  it('the receipt cannot fail the webhook', () => {
    const src = code(HELPER);
    assert.match(src, /catch\s*\(/, 'the receipt send is no longer wrapped');
    assert.match(
      src,
      /return false;/,
      'a failed receipt no longer degrades to a return — a Resend outage would become a ' +
        'provider retry storm, and retries are how one purchase becomes many emails.'
    );
  });

  it('CONTROL: the matcher reports absence when a call is removed', () => {
    // Without this, an always-true matcher would satisfy every assertion above.
    const mutated = code(WEBHOOKS[0][1]).replace(
      /await advanceOrderAndNotify\(/g,
      'noop('
    );
    assert.doesNotMatch(mutated, /await advanceOrderAndNotify\(/);
  });
});
