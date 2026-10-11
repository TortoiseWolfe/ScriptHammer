/**
 * capture-paypal-order leaves no Stripe session payable beside a PayPal capture (#1347).
 *
 * WHY A SOURCE-LEVEL GUARD. Nothing in CI executes an Edge Function. retirePriorSessions and
 * sessionDepsFor are covered behaviourally in tests/unit/checkout-sessions.test.ts; their place in
 * the capture, which is the whole fix, has no other route to a test:
 *
 *   403  ->  own row already captured  ->  paid gate  ->  retire the chain's Stripe sessions
 *        ->  capture  ->  record  ->  sweep again, best effort
 *
 * Retiring BEFORE the capture expires any open Stripe session, so it cannot be paid after this
 * one, and refuses if one is already complete (paid at Stripe, the webhook not yet landed). The
 * sweep AFTER closes a session opened in the seconds between; the payment has gone through by
 * then, so the sweep never changes the answer.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FN = path.resolve(__dirname, '..', '..', 'supabase', 'functions');
const INDEX = path.join(FN, 'capture-paypal-order', 'index.ts');

/** Block and full-line `//` comments removed, so this cannot match its own rationale. */
function code(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every position of `re` in `src`. */
function all(src, re) {
  return [...src.matchAll(new RegExp(re.source, 'g'))].map((m) => m.index);
}

function at(src, re, what) {
  const i = src.search(re);
  assert.ok(i > 0, `capture-paypal-order: ${what} not found`);
  return i;
}

const CAPTURE = /\/v2\/checkout\/orders\/\$\{orderId\}\/capture/;

describe("capture-paypal-order retires the chain's Stripe sessions around the capture (#1347)", () => {
  it('imports the shared retirement, not a copy of it', () => {
    const src = code(INDEX);
    assert.match(
      src,
      /import \{[^}]*\bretirePriorSessions\b[^}]*\bsessionDepsFor\b[^}]*\} from '\.\.\/_shared\/checkout-sessions\.ts'/
    );
    assert.match(src, /\bchainIntentIds\b/);
  });

  it('runs 403, own row, gate, retire, capture, sweep, in that order', () => {
    const src = code(INDEX);
    const owner = at(src, /\b403\b/, 'the ownership refusal');
    const ownRow = at(
      src,
      /result\.status === 'succeeded'/,
      "the own row's check"
    );
    const gate = at(src, /await gateOnChainPaid\(/, 'the paid gate');
    const retires = all(src, /await retirePriorSessions\(/);
    assert.strictEqual(
      retires.length,
      2,
      `expected two retirements (before and after the capture), found ${retires.length}`
    );
    const capture = at(src, CAPTURE, 'the capture');
    assert.ok(
      owner < ownRow && ownRow < gate,
      'ownership, own row and gate are out of order'
    );
    assert.ok(
      gate < retires[0],
      'Stripe sessions are retired before the paid gate'
    );
    assert.ok(
      retires[0] < capture,
      'the capture happens before the Stripe sessions are retired'
    );
    assert.ok(
      capture < retires[1],
      'the sweep runs before the capture it follows'
    );
  });

  it("returns the first retirement's refusal before capturing, and gives it the walked chain", () => {
    const src = code(INDEX);
    const [first] = all(src, /await retirePriorSessions\(/);
    const between = src.slice(first, at(src, CAPTURE, 'the capture'));
    assert.match(
      between,
      /if \(\w+\.kind === 'refuse'\)\s*\{?\s*return jsonResponse\(/,
      'a complete Stripe session does not stop the capture'
    );
    const walked = /(\w+) = await chainIntentIds\(/.exec(src);
    assert.ok(walked, 'the chain is not walked');
    assert.match(
      src.slice(first),
      new RegExp(
        `^await retirePriorSessions\\(\\s*sessionDepsFor\\([^;]*?,\\s*${walked[1]}\\s*\\)`
      ),
      'the first retirement is not given the walked chain'
    );
  });

  it('walks the chain again for the sweep, and a failed walk cannot answer 500', () => {
    // A Retry pressed during the capture is a new intent in the chain; the list read before the
    // capture does not have it (blind review). The walk throws on a read error, and a throw that
    // reached the handler's catch would answer 500 for a payment PayPal has taken.
    const src = code(INDEX);
    const retires = all(src, /await retirePriorSessions\(/);
    const between = src.slice(at(src, CAPTURE, 'the capture'), retires[1]);
    const rewalk =
      /try\s*\{\s*(\w+) = await chainIntentIds\(supabase, result\.intent_id\);\s*\}\s*catch/.exec(
        between
      );
    assert.ok(
      rewalk,
      'the sweep does not walk the chain again, inside a try, after the capture'
    );
    // A catch that rethrew, or returned, would be the 500 this exists to prevent (blind review).
    assert.doesNotMatch(
      between.slice(rewalk.index + rewalk[0].length),
      /\b(throw|return)\b/,
      'the re-walk catch leaves the handler instead of falling back'
    );
    assert.match(
      src.slice(retires[1]),
      new RegExp(
        `^await retirePriorSessions\\(\\s*sessionDepsFor\\([^;]*?,\\s*${rewalk[1]}\\s*\\)`
      ),
      `the sweep is not given the chain walked after the capture (${rewalk[1]})`
    );
  });

  it('reads Stripe sessions only through the shared builder', () => {
    assert.doesNotMatch(
      code(INDEX),
      /\.from\('stripe_checkout_sessions'\)/,
      'capture-paypal-order queries stripe_checkout_sessions itself, beside sessionDepsFor'
    );
  });

  it('never lets the sweep change the answer: the payment has already gone through', () => {
    const src = code(INDEX);
    const sweepVar = /const (\w+) = await retirePriorSessions\(/g;
    const names = [...src.matchAll(sweepVar)].map((m) => m[1]);
    assert.strictEqual(
      names.length,
      2,
      'both retirements should be assigned to a name'
    );
    const sweep = names[1];
    assert.doesNotMatch(
      src,
      new RegExp(`return jsonResponse\\([^;]*\\b${sweep}\\b`),
      `the sweep's result (${sweep}) reaches the response`
    );
  });

  it('builds a Stripe client only when there is something to check', () => {
    // A PayPal-only fork has no Stripe key and no sessions; a module-level client would make every
    // PayPal capture depend on a key it never uses.
    const src = code(INDEX);
    assert.doesNotMatch(
      src,
      /^const \w+ = new Stripe\(/m,
      'a Stripe client is built at load time'
    );
    assert.match(
      src,
      /sessionDepsFor\(supabase, getStripe\)/,
      'the deps are not given the lazy getStripe'
    );
  });
});
