/**
 * create-stripe-checkout leaves no second OPEN session for one purchase (#1345).
 *
 * WHY A SOURCE-LEVEL GUARD. Nothing in CI executes an Edge Function. retirePriorSessions is
 * covered behaviourally in tests/unit/checkout-sessions.test.ts; the ORDER of the steps in the
 * function, which is the whole fix, has no other route to a test:
 *
 *   paid gate  ->  retire the chain's earlier sessions  ->  create  ->  record
 *
 * Retire after creating and the new session is the one expired; create without recording and
 * the next call cannot find it, which is the bug again. A session that cannot be recorded is
 * never handed out, and is expired as a best-effort safety net.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FN = path.resolve(__dirname, '..', '..', 'supabase', 'functions');
const INDEX = path.join(FN, 'create-stripe-checkout', 'index.ts');
const HELPER = path.join(FN, '_shared', 'checkout-sessions.ts');

/** Block and full-line `//` comments removed, so this cannot match its own rationale. */
function code(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Position of `re` in `src`, failing loudly when it is absent so nothing passes by not looking. */
function at(src, re, what) {
  const i = src.search(re);
  assert.ok(i > 0, `create-stripe-checkout: ${what} not found`);
  return i;
}

describe('create-stripe-checkout retires earlier sessions before it opens one (#1345)', () => {
  it('the helper exists and is what the unit tests cover', () => {
    assert.ok(fs.existsSync(HELPER), '_shared/checkout-sessions.ts is gone');
    assert.match(code(HELPER), /export async function retirePriorSessions\(/);
  });

  it('runs gate, retire, create, record, in that order', () => {
    const src = code(INDEX);
    const gate = at(src, /await gateOnChainPaid\(/, 'the paid gate');
    const retire = at(
      src,
      /await retirePriorSessions\(/,
      'retiring earlier sessions'
    );
    const create = at(
      src,
      /stripe\.checkout\.sessions\.create\(/,
      'creating the session'
    );
    const record = at(
      src,
      /\.from\('stripe_checkout_sessions'\)\s*\.insert\(/,
      'recording the new session'
    );
    assert.ok(
      gate < retire,
      'earlier sessions are retired before the paid gate'
    );
    assert.ok(
      retire < create,
      'the new session is created BEFORE the earlier ones are retired'
    );
    assert.ok(create < record, 'the session is recorded before it exists');
  });

  it('returns the refusal from retiring before creating anything', () => {
    const src = code(INDEX);
    const between = src.slice(
      at(src, /await retirePriorSessions\(/, 'retiring earlier sessions'),
      at(src, /stripe\.checkout\.sessions\.create\(/, 'creating the session')
    );
    assert.match(
      between,
      /if \(\w+\.kind === 'refuse'\)\s*\{?\s*return jsonResponse\(/,
      'retirePriorSessions is called but its refusal is not returned before the new session'
    );
  });

  it('retires the sessions of the WHOLE chain, not just this intent', () => {
    // An abandoned session on the purchase stays open for 24 hours while its retry child gets a
    // new one; looking only at this intent would leave the purchase's session payable.
    const src = code(INDEX);
    // The chain's ids must be what retirePriorSessions is GIVEN (blind review): walking the chain
    // and then passing [intent.id] passed every check that only asked whether the walk happened.
    const walked = /(\w+) = await chainIntentIds\(/.exec(src);
    assert.ok(walked, 'the chain is not walked');
    const name = walked[1];
    assert.match(
      src,
      new RegExp(
        `await retirePriorSessions\\([\\s\\S]*?\\},\\s*${name}\\s*\\)`
      ),
      `retirePriorSessions is not given the walked chain (${name})`
    );
    assert.match(
      src,
      /\.from\('stripe_checkout_sessions'\)\s*\.select\('session_id'\)\s*\.in\('intent_id',/,
      'the recorded sessions are not looked up for the chain'
    );
  });

  it('finds a complete session of ANY age, so a long webhook outage cannot hand a paid buyer a new one', () => {
    // A 25-hour bound was tried (blind review): it hid a session that was paid at Stripe but never
    // recorded by an outage longer than a day (#1180 lasted 31), and the buyer pressing Retry got
    // a fresh, payable session. A chain's sessions are few, and they are retrieved in parallel.
    assert.doesNotMatch(
      code(INDEX),
      /\.from\('stripe_checkout_sessions'\)[\s\S]{0,300}?(\.(gte|gt|lte|lt|filter|or)\(\s*'?created_at|created_at\.(gte|gt|lt|lte))/,
      'the recorded-session lookup is bounded in time again, and will miss an old paid session'
    );
  });

  it('skips only "no such session", through the tested helper', () => {
    // The classification lives in retrieveOrNull, where tests/unit/checkout-sessions.test.ts can
    // see it; inline in the function, widening its catch would turn an outage into a skip.
    const src = code(INDEX);
    assert.match(
      src,
      /retrieve: retrieveOrNull\(/,
      'retrieve does not go through retrieveOrNull'
    );
    assert.doesNotMatch(
      src,
      /resource_missing/,
      'the function classifies Stripe errors itself again'
    );
    // Nor may the raw retrieve it wraps catch anything: a catch there that answered "expired" would
    // get round the helper with no test noticing (blind review).
    const inner = /retrieve: retrieveOrNull\(([\s\S]*?)\n\s{8}\}\),/.exec(src);
    assert.ok(
      inner,
      'could not find the raw retrieve passed to retrieveOrNull'
    );
    assert.doesNotMatch(
      inner[1],
      /\bcatch\b/,
      'the raw retrieve catches errors itself, around the helper'
    );
  });

  it('opens card-only sessions, which refusing on "complete" depends on', () => {
    // A card session completes paid. A delayed method completes unpaid and may later fail, and
    // retiring would then refuse the chain for good.
    assert.match(
      code(INDEX),
      /payment_method_types: \['card'\]/,
      'sessions are no longer card-only, so a complete session may not be a paid one'
    );
  });

  it('a session that cannot be recorded is expired at once, not left open', () => {
    const src = code(INDEX);
    const after = src.slice(
      at(
        src,
        /\.from\('stripe_checkout_sessions'\)\s*\.insert\(/,
        'recording the new session'
      )
    );
    assert.match(
      after,
      /if \(recordError\)\s*\{[\s\S]*?stripe\.checkout\.sessions\s*\.expire\(session\.id\)/,
      'an unrecorded session is left open, where the next call cannot find it'
    );
  });
});
