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
 * the next call cannot find it, which is the bug again. And a session that cannot be recorded is
 * expired at once, so no open session ever exists that nothing can find.
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
    assert.match(src, /await chainIntentIds\(/, 'the chain is not walked');
    assert.match(
      src,
      /\.from\('stripe_checkout_sessions'\)\s*\.select\('session_id'\)\s*\.in\('intent_id',/,
      'the recorded sessions are not looked up for the chain'
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
      /if \(recordError\)\s*\{[\s\S]*?stripe\.checkout\.sessions\.expire\(session\.id\)/,
      'an unrecorded session is left open, where the next call cannot find it'
    );
  });
});
