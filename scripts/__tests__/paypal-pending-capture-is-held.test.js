/**
 * A PayPal capture PayPal answered PENDING is held, not failed (#1349).
 *
 * WHY A SOURCE-LEVEL GUARD. Nothing in CI executes an Edge Function. isHeldCapture,
 * recordedCaptureStatus and the payment_processing gate are covered behaviourally in
 * tests/unit/payment-chain.test.ts; where capture-paypal-order and paypal-webhook USE them, which
 * is the whole fix, has no other route to a test:
 *
 *   capture  ->  row already held? answer PENDING  ->  paid/processing gate  ->  capture
 *            ->  record via recordedCaptureStatus (PENDING stays pending)
 *   webhook  ->  PAYMENT.CAPTURE.DENIED settles a still-pending row to failed, nothing else
 *
 * Before the fix PENDING was recorded 'failed', so the buyer saw a failure, paid again, and was
 * charged twice when the first capture cleared.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FN = path.resolve(__dirname, '..', '..', 'supabase', 'functions');
const CAPTURE = path.join(FN, 'capture-paypal-order', 'index.ts');
const WEBHOOK = path.join(FN, 'paypal-webhook', 'index.ts');

/** Block and full-line `//` comments removed, so this cannot match its own rationale. */
function code(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function at(src, re, what) {
  const i = src.search(re);
  assert.ok(i > 0, `${what} not found`);
  return i;
}

describe('capture-paypal-order records a PENDING capture as pending (#1349)', () => {
  it('records through recordedCaptureStatus, never a bare COMPLETED-or-failed ternary', () => {
    const src = code(CAPTURE);
    assert.match(src, /status:\s*recordedCaptureStatus\(status\)/);
    assert.doesNotMatch(
      src,
      /status === 'COMPLETED' \? 'succeeded' : 'failed'/,
      'a PENDING answer must not be recorded failed'
    );
  });

  it('reads verification_method and updated_at, which is what marks a row held', () => {
    const src = code(CAPTURE);
    assert.match(
      src,
      /\.select\(\s*'[^']*\bverification_method\b[^']*\bupdated_at\b/
    );
  });

  it('answers PENDING for an already-held row BEFORE the paid gate and the capture', () => {
    const src = code(CAPTURE);
    const held = at(
      src,
      /isHeldCapture\(result\)/,
      'the held-row early return'
    );
    const gate = at(src, /gateOnChainPaid\(/, 'the paid gate');
    const capture = at(
      src,
      /\/v2\/checkout\/orders\/\$\{orderId\}\/capture/,
      'the capture call'
    );
    assert.ok(held < gate, 'the held check must come before the gate');
    assert.ok(held < capture, 'the held check must come before the capture');
    assert.match(
      src.slice(held, gate),
      /status:\s*'PENDING',\s*already_captured:\s*true/
    );
  });
});

describe('paypal-webhook settles a denied capture (#1349)', () => {
  it('routes DENIED and DECLINED to handleCaptureDenied', () => {
    const src = code(WEBHOOK);
    assert.match(
      src,
      /case 'PAYMENT\.CAPTURE\.DENIED':\s*case 'PAYMENT\.CAPTURE\.DECLINED':\s*processResult = await handleCaptureDenied\(/
    );
  });

  it('only turns a row that is still pending into failed, for this order', () => {
    const src = code(WEBHOOK);
    const start = at(
      src,
      /async function handleCaptureDenied\(/,
      'handleCaptureDenied'
    );
    const body = src.slice(start, src.indexOf('async function', start + 10));
    assert.match(body, /status:\s*'failed'/);
    assert.match(body, /\.eq\('status',\s*'pending'\)/);
    assert.match(body, /\.eq\('transaction_id',\s*orderId\)/);
    assert.match(body, /\.eq\('intent_id',\s*intentId\)/);
    assert.match(body, /if \(!orderId\) return/);
  });
});
