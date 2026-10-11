/**
 * Both payment webhooks tell a SECOND CHARGE on one intent from the duplicate event of one
 * charge, and give up on it at once (#1342 stage 2).
 *
 * WHY A SOURCE-LEVEL GUARD. Nothing in CI executes an Edge Function. assertSameCharge is covered
 * behaviourally in tests/unit/second-charge.test.ts; whether each webhook CALLS it, on every
 * unique-violation path, before it advances the order, has no other route to a test.
 *
 * What it closes:
 *   - stripe-webhook met the one-succeeded-per-intent index in two situations that mean opposite
 *     things (the other event of the same charge, or a different charge for the same intent) and
 *     acknowledged both as "already recorded". A buyer who paid twice left no trace.
 *   - paypal-webhook reconciled every capture onto the intent's OLDEST PayPal row, whichever
 *     order was captured, so a second order's capture was folded into the first row.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FN = path.resolve(__dirname, '..', '..', 'supabase', 'functions');
const HELPER = path.join(FN, '_shared', 'second-charge.ts');
const STRIPE = path.join(FN, 'stripe-webhook', 'index.ts');
const PAYPAL = path.join(FN, 'paypal-webhook', 'index.ts');

/** Block and full-line `//` comments removed, so this cannot match its own rationale. */
function code(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The text after each match of `re`, up to the next match or the end of the file. */
function segmentsAfter(src, re) {
  const at = [...src.matchAll(new RegExp(re.source, 'g'))].map((m) => m.index);
  return at.map((start, i) => src.slice(start, at[i + 1] ?? src.length));
}

const IMPORTS =
  /import \{[^}]*\bassertSameCharge\b[^}]*\} from '\.\.\/_shared\/second-charge\.ts'/;

describe('the payment webhooks detect a second charge on one intent (#1342)', () => {
  it('the helper exists and is what the unit tests cover', () => {
    // Anti-vacuity: a moved file would make every assertion below pass by inspecting nothing.
    assert.ok(fs.existsSync(HELPER), '_shared/second-charge.ts is gone');
    const src = code(HELPER);
    for (const name of ['assertSameCharge', 'retryable']) {
      assert.match(
        src,
        new RegExp(`export (async )?function ${name}\\(`),
        name
      );
    }
    assert.match(src, /export class SecondChargeError/);
  });

  for (const [name, file, provider] of [
    ['stripe-webhook', STRIPE, 'stripe'],
    ['paypal-webhook', PAYPAL, 'paypal'],
  ]) {
    it(`${name} gives up on a second charge at once instead of retrying it`, () => {
      const src = code(file);
      assert.match(src, IMPORTS, `${name} does not import assertSameCharge`);
      // The catch hands failWebhookEvent the event's replay-safety AND the error's kind; a second
      // charge retried five times would only delay the alarm by days.
      assert.match(
        src,
        new RegExp(
          `retryable\\(\\s*replaySafe\\('${provider}',[^)]*\\),\\s*handlerError\\s*\\)`
        ),
        `${name}'s catch no longer refuses to retry a second charge`
      );
    });
  }

  it('stripe-webhook checks the transaction on EVERY payment unique violation, before advancing', () => {
    const src = code(STRIPE);
    const sites = segmentsAfter(src, /error\?\.code === PG_UNIQUE_VIOLATION/);
    assert.ok(
      sites.length >= 2,
      `found ${sites.length} payment unique-violation path(s); both payment handlers have one`
    );
    for (const [i, seg] of sites.entries()) {
      const check = seg.search(/await assertSameCharge\(/);
      const advance = seg.search(/advanceOrderAndNotify\(/);
      assert.ok(
        check > 0,
        `unique-violation path ${i + 1} never asks whether it is the same charge`
      );
      assert.ok(
        advance < 0 || check < advance,
        `unique-violation path ${i + 1} advances the order before checking it is the same charge`
      );
    }
  });

  it("paypal-webhook reconciles onto the CAPTURED order's row, not the intent's oldest", () => {
    const src = code(PAYPAL);
    assert.match(
      src,
      /supplementary_data\?\.related_ids\?\.order_id/,
      'paypal-webhook no longer reads which order the capture belongs to'
    );
    assert.match(
      src,
      /\.eq\('transaction_id', orderId\)/,
      'paypal-webhook no longer looks the row up by the captured order'
    );
  });

  it('paypal-webhook classifies an UPDATE collision only when it knows the captured order', () => {
    // Without an order id the update targets the intent's oldest row, which may be an abandoned
    // order, and the capture id can never match the paid order's row: classifying there would call
    // the buyer's only payment a second charge (blind review).
    assert.match(
      code(PAYPAL),
      /updateError\?\.code === PG_UNIQUE_VIOLATION && orderId\b/,
      'paypal-webhook runs the second-charge check on an update collision with no order id, where the row is only the oldest guess'
    );
  });

  it('paypal-webhook checks the transaction on its unique violations, before advancing', () => {
    const src = code(PAYPAL);
    const sites = segmentsAfter(src, /\.code === PG_UNIQUE_VIOLATION/);
    assert.ok(
      sites.length >= 2,
      `found ${sites.length} unique-violation path(s); the update and the insert both have one`
    );
    for (const [i, seg] of sites.entries()) {
      const check = seg.search(/await assertSameCharge\(/);
      const advance = seg.search(/advanceOrderAndNotify\(/);
      assert.ok(
        check > 0,
        `paypal unique-violation path ${i + 1} never asks whether it is the same charge`
      );
      assert.ok(
        advance < 0 || check < advance,
        `paypal unique-violation path ${i + 1} advances the order before checking`
      );
    }
  });
});
