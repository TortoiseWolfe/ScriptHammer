/**
 * Guards scripts/ci/check-webhook-liveness.mjs (#1183).
 *
 * The check itself runs on a schedule against production, where nobody watches it fail. So the
 * VERDICT function is driven here, under the required `Test (20.x)` check, in both directions —
 * including the real pre-fix #1180 state, so the gate is pinned to the incident it exists for.
 *
 * Two of these tests assert that a signal does NOT fail the run. That is deliberate and is the
 * easiest thing for a future reader to "fix" into a false alarm: this endpoint sees roughly one
 * live event a month, so row age cannot distinguish quiet from dead. If you make staleness fail,
 * these tests go red and the comment above them tells you why.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluate,
  WINDOW_HOURS,
  STALE_INFO_DAYS,
} from '../ci/check-webhook-liveness.mjs';

/** A project in good health: traffic recently, nothing rejected, nothing thrown. */
const healthy = {
  signatureFailures: 0,
  serverErrors: 0,
  permanentlyFailed: 0,
  unprocessed: 0,
  newestEventAgeDays: 0,
  staleSignatures: 0,
};

const withFacts = (o) => ({ ...healthy, ...o });

describe('webhook liveness verdict (#1183)', () => {
  it('passes when nothing is wrong', () => {
    const r = evaluate(healthy);
    assert.equal(r.verdict, 'PASS');
    assert.deepEqual(r.failures, []);
  });

  it('CONTROL: the verdict function can reach FAIL at all', () => {
    // Without this, every other passing assertion here is compatible with an evaluate()
    // that returns PASS unconditionally.
    const r = evaluate(withFacts({ signatureFailures: 1 }));
    assert.equal(r.verdict, 'FAIL');
    assert.ok(
      r.failures.length > 0,
      'a FAIL verdict must carry at least one reason'
    );
  });

  it('fails on the real #1180 state: deliveries being refused for a bad signature', () => {
    // What production actually looked like between 2026-08-17 and 2026-09-17: every live
    // delivery rejected, nothing thrown, and — crucially — webhook_events NOT growing, which
    // is why the row-age signal was useless and the log signal was not.
    const r = evaluate(
      withFacts({ signatureFailures: 3, newestEventAgeDays: 31 })
    );
    assert.equal(r.verdict, 'FAIL');
    assert.match(r.failures.join('\n'), /signature rejection/i);
    assert.match(r.failures.join('\n'), /#1180/);
  });

  it('fails on a 5xx, because Stripe retries those for three days', () => {
    const r = evaluate(withFacts({ serverErrors: 2 }));
    assert.equal(r.verdict, 'FAIL');
    assert.match(r.failures.join('\n'), /server error/i);
  });

  it('fails when the retry ledger has given up on a delivery', () => {
    const r = evaluate(withFacts({ permanentlyFailed: 1 }));
    assert.equal(r.verdict, 'FAIL');
    assert.match(r.failures.join('\n'), /permanently_failed/);
  });

  it('reports every simultaneous failure, not just the first', () => {
    const r = evaluate(
      withFacts({ signatureFailures: 1, serverErrors: 1, permanentlyFailed: 1 })
    );
    assert.equal(r.verdict, 'FAIL');
    assert.equal(r.failures.length, 3);
  });

  it('does NOT fail on a stale-but-VALID signature — that proves the secret is right', () => {
    // Our console.error prefixes both SDK rejections with "Signature verification failed", but
    // "Timestamp outside the tolerance zone" means the HMAC MATCHED. It is what the #1180
    // diagnostic probe deliberately produces; counting it would make that probe trip this gate.
    const r = evaluate(withFacts({ staleSignatures: 4 }));
    assert.equal(r.verdict, 'PASS');
    assert.match(r.notes.join('\n'), /VALID signature/);
    assert.match(r.notes.join('\n'), /secret is correct/);
  });

  // --- the two signals that deliberately do NOT gate -------------------------

  it('does NOT fail on row age alone — quiet is not dead', () => {
    // ~1 live event a month here. A threshold tight enough to have caught #1180 would cry
    // wolf every quiet fortnight; one loose enough to stay quiet would have missed it too.
    const r = evaluate(withFacts({ newestEventAgeDays: STALE_INFO_DAYS + 90 }));
    assert.equal(r.verdict, 'PASS');
    assert.match(r.notes.join('\n'), /Informational only/);
  });

  it('does NOT fail on an empty table — a fresh fork has no traffic yet', () => {
    const r = evaluate(withFacts({ newestEventAgeDays: null }));
    assert.equal(r.verdict, 'PASS');
    assert.match(
      r.notes.join('\n'),
      /no provider traffic has ever been recorded/
    );
  });

  it('does NOT fail on unprocessed rows, but does surface the count', () => {
    // 13 such rows predate #1180 and nobody is going to revisit them; gating on this
    // would make the check permanently red and therefore permanently ignored.
    const r = evaluate(withFacts({ unprocessed: 13 }));
    assert.equal(r.verdict, 'PASS');
    assert.match(r.notes.join('\n'), /13 unprocessed/);
  });

  it('keeps the log window inside Supabase free-tier retention', () => {
    // Widen this past what the platform retains and the query silently returns a short
    // window while the summary still claims the wide one.
    assert.ok(
      WINDOW_HOURS > 0 && WINDOW_HOURS <= 24,
      `WINDOW_HOURS must stay within ~24h of retention, got ${WINDOW_HOURS}`
    );
  });
});
