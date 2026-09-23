/**
 * The live webhook verifies with ONE secret, and checks the mode before it touches a row
 * (#1186, guarding #1229).
 *
 * WHAT THIS REPLACES, AND WHY IT WAS WORSE THAN NO TEST. `tests/contract/stripe-webhook.test.ts`
 * was the only thing claiming to cover signature verification. It was excluded from Vitest
 * since two days after it was written, 11 of its 16 assertions were literally
 * `expect(true).toBe(false)`, and the rest `fetch()`ed a deployed URL.
 *
 * The decisive fact is not that it was switched off. It is that **switching it on would not
 * have helped**: every assertion in it asserts REJECTION — 400 on an invalid signature, 400 on
 * a missing header — and it never once sends a correctly-signed payload. #1180 was the
 * opposite failure: the live secret was filed under a name nothing read, so VALID deliveries
 * 400'd for 31 days. That test would have been GREEN for every one of those days. A test that
 * only asserts rejection cannot detect "everything is rejected".
 *
 * So the coverage that matters now is: does the SHAPE that #1229 established still hold?
 * Behavioural coverage of the decision itself lives in
 * `tests/unit/stripe-webhook-resolve.test.ts` (11 cases against a dependency-free
 * `resolve.ts`). This file guards the wiring in `index.ts`, which nothing can execute —
 * `tsconfig` excludes `supabase/`, Vitest excludes `supabase/functions/**`, and
 * `edge-functions.yml` is deliberately not required (#1153).
 *
 * Modelled on `webhooks-advance-the-order.test.js`, including its comment-stripping, because a
 * source-grep guard that matches its own rationale passes with the code deleted — which has
 * happened repeatedly in this repo.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const FN = path.resolve(
  __dirname,
  '..',
  '..',
  'supabase',
  'functions',
  'stripe-webhook',
  'index.ts'
);

/** Source with comments stripped, so no assertion can be satisfied by prose. */
function code() {
  assert.ok(
    fs.existsSync(FN),
    `${FN} is gone. That is not a pass — re-point this guard (#1186).`
  );
  return fs
    .readFileSync(FN, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('stripe-webhook verifies with one secret (#1186, #1229)', () => {
  it('the guard is reading real code, not an empty string', () => {
    // Anti-vacuity: every assertion below is a substring match, and they would all pass
    // trivially against nothing.
    const src = code();
    assert.ok(
      src.length > 2000,
      `comment-stripped source is only ${src.length} chars — the strip is eating the file`
    );
    assert.match(
      src,
      /serve\(/,
      'this does not look like the function entrypoint'
    );
  });

  it('takes its signing secret from the shared resolver, not inline env reads', () => {
    assert.match(
      code(),
      /import\s*\{[^}]*resolveSigningSecret[^}]*\}\s*from\s*'\.\/resolve\.ts'/,
      'index.ts must import resolveSigningSecret from ./resolve.ts, so the rule is the one ' +
        'tests/unit/stripe-webhook-resolve.test.ts actually covers (#1229).'
    );
  });

  it('verifies with EXACTLY ONE secret — never a list tried in turn', () => {
    const src = code();
    // POSITIVE assertion on what the call receives. Asserting only the ABSENCE of the two
    // old idioms (`WEBHOOK_SECRETS`, `for (const secret of`) let a mutation to any OTHER
    // list shape pass — measured, not supposed: swapping the argument for `[a,b]` left
    // this green until this line existed.
    assert.match(
      src,
      /constructEventAsync\(\s*body\s*,\s*signature\s*,\s*SIGNING\.choice\.secret\s*\)/,
      'verification must receive THE one secret the resolver chose. Anything else — a list, ' +
        'a re-read of the env — reopens #1229, where a test-mode signature verified against ' +
        'the live deployment.'
    );
    assert.match(
      src,
      /constructEventAsync\(/,
      "verification must use the ASYNC variant: Deno's SubtleCryptoProvider refuses the " +
        'synchronous form, so constructEvent() throws on EVERY delivery.'
    );
    // Exactly one verification call, so a second cannot be added beside the first.
    assert.strictEqual(
      (src.match(/constructEventAsync\(/g) || []).length,
      1,
      'there must be exactly one signature verification call (#1229)'
    );
    assert.doesNotMatch(
      src,
      /for\s*\(\s*const\s+secret\s+of/,
      'THE #1229 DEFECT: iterating candidate secrets makes a test-mode signature verify ' +
        'against the live deployment.'
    );
  });

  it('asserts the event mode BEFORE any database client exists', () => {
    const src = code();
    // THE CALL, not the import. `indexOf('livemodeMismatch')` matches the import on line 17,
    // which is always before createClient — so this assertion passed while the check sat
    // BELOW the client. Caught by mutation; the same first-match trap as String.replace.
    const check = src.search(/livemodeMismatch\s*\(/);
    const client = src.search(/createClient\s*\(/);
    assert.ok(check > -1, 'the livemode assertion CALL is gone (#1229)');
    assert.ok(client > -1, 'createClient is gone — re-point this guard');
    assert.ok(
      check < client,
      'the livemode check must run BEFORE createClient, so a mismatched event cannot reach ' +
        `a row even in principle (#1229). check@${check} client@${client}`
    );
  });

  it('an unconfigured secret is a 500, never a 400', () => {
    // The distinction #1180 paid for: "we are misconfigured" must not look like "Stripe sent
    // us something bad", or the next outage is diagnosed as a provider problem for a month.
    assert.match(
      code(),
      /!SIGNING\.ok[\s\S]{0,400}?status:\s*500/,
      'an absent signing secret must return 500 (our fault), not 400 (their fault).'
    );
  });

  it('still rejects the `no-secret-provided` literal by name (#562)', () => {
    // It lives in resolve.ts, but assert from here too: this is the file a reader opens.
    const resolve = fs.readFileSync(
      path.join(path.dirname(FN), 'resolve.ts'),
      'utf8'
    );
    assert.match(
      resolve
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1'),
      /'no-secret-provided'/,
      'a webhook configured WITHOUT a secret still sends the header, valued exactly ' +
        '`no-secret-provided`, so treating it as usable accepts unsigned traffic (#562).'
    );
  });
});
