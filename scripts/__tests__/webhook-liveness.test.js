/**
 * Guards scripts/ci/check-webhook-liveness.mjs (#1183).
 *
 * The check itself runs on a schedule against production, where nobody watches it fail. So the
 * VERDICT function is driven here, under the required `Test` check, in both directions —
 * including the real pre-fix #1180 state, so the gate is pinned to the incident it exists for.
 *
 * Two of these tests assert that a signal does NOT fail the run. That is deliberate and is the
 * easiest thing for a future reader to "fix" into a false alarm: this endpoint sees roughly one
 * live event a month, so row age cannot distinguish quiet from dead. If you make staleness fail,
 * these tests go red and the comment above them tells you why.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluate,
  DOUBLE_CHARGE_SQL,
  SECOND_CHARGE_SQL,
  COUNTS_SQL,
  readSources,
  readEdge,
  logsPath,
  QUERIES,
  FUNCTION_SOURCE,
  EDGE_SOURCE,
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

  it('fails on signature rejections, stating both possible causes and how to tell them apart', () => {
    // Since #1229, signature rejections can come from either a real provider with a wrong
    // secret (#1180) OR a forged/test request correctly refused (#1229). The message must
    // name both and explain the discriminator, not assert a single cause.
    const r = evaluate(
      withFacts({ signatureFailures: 3, newestEventAgeDays: 31 })
    );
    assert.equal(r.verdict, 'FAIL');
    const text = r.failures.join('\n');
    assert.match(text, /signature rejection/i);
    assert.match(text, /#1180/);
    assert.match(text, /#1229/);
    assert.match(text, /forged or test-signed request was correctly refused/);
    assert.match(
      text,
      /Stripe Dashboard.*Developers.*Webhooks.*failed deliveries/
    );
    assert.match(text, /Failed deliveries listed there = #1180/);
    assert.match(text, /none listed = the function did its job/);
    assert.doesNotMatch(text, /RIGHT NOW/);
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

/**
 * The log queries (#1330). Supabase removed `logs.all` on 2026-09-23, and this check then failed
 * every day for 17 days without anyone reading why. These tests pin the request and, more
 * importantly, the two guards that stop a schema change from turning into a quiet PASS.
 */
describe('webhook liveness log queries (#1330)', () => {
  it('asks the endpoint that replaced logs.all', () => {
    const path = logsPath('ref123', { sql: 'select 1' });
    assert.match(path, /^\/v1\/projects\/ref123\/analytics\/endpoints\/logs\?/);
    assert.doesNotMatch(path, /logs\.all/);
  });

  it('speaks the new dialect: one `logs` table, no unnest', () => {
    // Checks the query strings themselves, not the source file, whose comments name the old
    // dialect on purpose.
    for (const [name, q] of Object.entries(QUERIES)) {
      assert.match(
        q,
        /\bfrom logs\b/,
        `${name} must read the single logs table`
      );
      assert.doesNotMatch(
        q,
        /unnest\(/,
        `${name} still uses the removed nested dialect`
      );
      assert.doesNotMatch(
        q,
        /\bfrom (function_logs|function_edge_logs)\b/,
        name
      );
    }
  });

  // --- readSources: the census that makes "looked at nothing" visible -------------------

  const census = [
    { source: 'edge_logs', n: '5120' },
    { source: 'postgres_logs', n: 880 },
    { source: FUNCTION_SOURCE, n: '42' },
    { source: EDGE_SOURCE, n: 17 },
  ];

  it('counts the two function sources, accepting ClickHouse 64-bit counts as strings', () => {
    assert.deepEqual(readSources(census), {
      functionLines: 42,
      edgeInvocations: 17,
    });
  });

  it('treats a day with no Edge Function at all as quiet, not broken', () => {
    // No function ran, so none can have refused a delivery. Failing here would cry wolf.
    const quiet = census.filter((r) => !/function/.test(r.source));
    assert.deepEqual(readSources(quiet), {
      functionLines: 0,
      edgeInvocations: 0,
    });
  });

  it('refuses an empty census: the query is broken, not the day quiet', () => {
    assert.throws(() => readSources([]), /no rows for any source/);
    assert.throws(() => readSources(undefined), /no rows for any source/);
  });

  it('refuses a renamed function source rather than counting zero under the old name', () => {
    const renamed = [
      ...census.filter((r) => !/function/.test(r.source)),
      { source: 'edge_function_logs', n: 9 },
    ];
    assert.throws(
      () => readSources(renamed),
      /renamed: saw edge_function_logs/
    );
  });

  // --- readEdge: the 5xx count, only when its attributes exist ----------------------------

  it('returns the 5xx count when the invocations carry url and status', () => {
    assert.equal(readEdge({ n: '30', keyed: '30', server_errors: '2' }), 2);
    assert.equal(readEdge({ n: 30, keyed: 30, server_errors: 0 }), 0);
  });

  it('reads no invocations as zero errors', () => {
    assert.equal(readEdge({ n: 0, keyed: 0, server_errors: 0 }), 0);
    assert.equal(readEdge(undefined), 0);
  });

  it('refuses invocations that carry neither attribute: the names moved', () => {
    assert.throws(
      () => readEdge({ n: 30, keyed: 0, server_errors: 0 }),
      /attribute names have moved/
    );
  });
});

describe('webhook liveness: a second charge for one order (#1338)', () => {
  it('fails on any order charged more than once', () => {
    const r = evaluate(withFacts({ doubleCharged: 1 }));
    assert.equal(r.verdict, 'FAIL');
    assert.match(r.failures.join('\n'), /charged more than once/);
  });

  it('passes with none, and when the fact is absent (older callers)', () => {
    assert.equal(evaluate(withFacts({ doubleCharged: 0 })).verdict, 'PASS');
    assert.equal(evaluate(healthy).verdict, 'PASS');
  });

  it('counts distinct paid intents per order across a depth-bounded chain', () => {
    // The unique index allows one succeeded row per intent, so "more than one intent" is the
    // signal; a bound keeps a corrupt cycle from looping.
    assert.match(DOUBLE_CHARGE_SQL, /with recursive chain/);
    assert.match(DOUBLE_CHARGE_SQL, /count\(distinct pr\.intent_id\) > 1/);
    assert.match(DOUBLE_CHARGE_SQL, /c\.depth < 4/);
    assert.match(DOUBLE_CHARGE_SQL, /status = 'succeeded'/);
  });
});

describe('webhook liveness: a second charge on ONE intent (#1342 stage 2)', () => {
  // The prefix both webhooks write into processing_error when they give up on a second charge.
  // Read from the TypeScript source, because this .mjs cannot import it; the two must agree or
  // the alarm counts nothing.
  const helper = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      'supabase',
      'functions',
      '_shared',
      'second-charge.ts'
    ),
    'utf8'
  );
  const prefix = /export const SECOND_CHARGE_PREFIX = '([^']+)'/.exec(
    helper
  )?.[1];

  it('the webhooks and this check agree on the prefix', () => {
    assert.ok(
      prefix,
      'SECOND_CHARGE_PREFIX not found in _shared/second-charge.ts'
    );
    const exact = `left(coalesce(processing_error, ''), ${prefix.length}) = '${prefix}'`;
    assert.ok(
      COUNTS_SQL.includes(exact),
      'the counts query does not count the exact prefix the webhooks write'
    );
    assert.ok(
      SECOND_CHARGE_SQL.includes(exact),
      'the lookup query does not find the rows the alarm counts'
    );
  });

  it('fails on any second charge, saying it needs a refund and how to find it', () => {
    const r = evaluate(withFacts({ secondCharges: 1 }));
    assert.equal(r.verdict, 'FAIL');
    const text = r.failures.join('\n');
    assert.match(text, /second charge\(s\) on one intent/);
    // Clearing has to reach every event naming the charge: Stripe sends two per charge.
    assert.match(text, /EVERY event naming it/);
    assert.match(text, /refund/i);
    assert.match(text, /SECOND_CHARGE_SQL/);
  });

  it('passes with none, and when the fact is absent (older callers)', () => {
    assert.equal(evaluate(withFacts({ secondCharges: 0 })).verdict, 'PASS');
    assert.equal(evaluate(healthy).verdict, 'PASS');
  });

  it("counts CHARGES, not events: both of Stripe's events for one charge are one alarm (blind review)", () => {
    assert.match(
      COUNTS_SQL,
      /count\(distinct processing_error\) filter \(where permanently_failed and left\(coalesce\(processing_error, ''\), 14\) = 'second_charge:'\) as second_charges/
    );
    assert.match(SECOND_CHARGE_SQL, /group by processing_error/);
  });

  it('keeps second charges OUT of the generic permanently_failed count', () => {
    // One fact, one line: a second charge reported as both "refund this" and "a delivery we gave
    // up on" would read as two problems, and clearing one would leave the other.
    assert.match(
      COUNTS_SQL,
      /count\(\*\) filter \(where permanently_failed and not left\(coalesce\(processing_error, ''\), 14\) = 'second_charge:'\) as permanently_failed/
    );
  });
});
