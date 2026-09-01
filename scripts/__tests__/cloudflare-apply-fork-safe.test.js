/**
 * The Cloudflare writer must never carry an identifier, and must never write by accident
 * (#393, #822).
 *
 * WHY IT EXISTS. `cloudflare-apply.mjs` can change live DNS and a live security header. Two
 * properties make that safe, and both are invisible in a passing run:
 *
 *   1. It stores no zone id, ruleset id or rule id. All three are KNOWN for this repo, so
 *      hardcoding them would work perfectly here and break in every fork — the #1014 / #987
 *      shape, where a template default quietly points a fork's tooling at the template's
 *      infrastructure. It would also break silently for this repo if the zone ever moved.
 *   2. It is dry-run by default. A script that writes unless told not to is one careless
 *      invocation away from flipping production's CSP.
 *
 * Neither property can be observed from a green dry run, which is why they are asserted here.
 *
 * It also RUNS the two `--selftest` suites. Before this file, nothing in CI invoked either of
 * them: `check-mail-policy.mjs --selftest` had existed since #822 and had never once executed
 * outside a developer's terminal. A selftest nothing runs is #396 in its purest form.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const APPLY = path.join(ROOT, 'scripts', 'ci', 'cloudflare-apply.mjs');
const MAIL = path.join(ROOT, 'scripts', 'ci', 'check-mail-policy.mjs');
const INTENT = path.join(ROOT, 'scripts', 'ci', 'cloudflare-intent.mjs');

/** Source with comments removed, so a guard cannot match its own prose. */
function code(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('the Cloudflare writer is fork-safe (#393, #822)', () => {
  it('stores no zone, ruleset or rule identifier', () => {
    // Cloudflare ids are 32 hex characters. The real ones for this repo are known — the CSP
    // rule is 7d78d2f747454b32ad4c7a084bcb2ee9 — so this is a live temptation, not a
    // hypothetical one.
    for (const f of [APPLY, INTENT]) {
      const ids = code(f).match(/\b[0-9a-f]{32}\b/g) ?? [];
      assert.deepStrictEqual(
        ids,
        [],
        `${path.basename(f)} hardcodes ${ids.join(', ')} — discover by name or content instead`
      );
    }
  });

  it('names no domain of this repo', () => {
    for (const f of [APPLY, INTENT]) {
      assert.doesNotMatch(
        code(f),
        /scripthammer\.com/i,
        `${path.basename(f)} must take its domain from the environment`
      );
    }
  });

  it('discovers the CSP rule by header content, in either mode', async () => {
    // Finding it only under the report-only name would make the flip one-way: after
    // enforcing, the script could no longer see its own rule to revert it.
    const { planCsp } = await import(`file://${APPLY}`);
    const enforcing = [
      {
        id: 'r1',
        action_parameters: {
          headers: {
            'Content-Security-Policy': { operation: 'set', value: 'x' },
          },
        },
      },
    ];
    assert.equal(
      planCsp(enforcing, 'report-only').id,
      'r1',
      'must still find the rule after a flip'
    );
    assert.equal(planCsp(enforcing, 'enforcing').action, 'none');
  });

  it('preserves DMARC tags it was not asked to change', async () => {
    // Rebuilding the record from known tags would drop sp/adkim/aspf/fo — loosening the
    // policy while appearing to tighten it.
    const { rewriteDmarc } = await import(`file://${APPLY}`);
    const out = rewriteDmarc(
      'v=DMARC1; p=none; sp=quarantine; adkim=s; aspf=s; rua=mailto:a@b.c; ruf=mailto:f@b.c',
      { policy: 'reject', pct: 10 }
    );
    for (const tag of [
      'sp=quarantine',
      'adkim=s',
      'aspf=s',
      'rua=mailto:a@b.c',
      'ruf=mailto:f@b.c',
    ]) {
      assert.ok(out.includes(tag), `${tag} was dropped by the rewrite: ${out}`);
    }
    assert.ok(out.includes('p=reject') && out.includes('pct=10'));
  });

  it('refuses to act on an ambiguous zone rather than guessing', async () => {
    // Two DMARC records means receivers honour NEITHER; editing one leaves the zone broken
    // and looking fixed. Two CSP rules means two policies racing.
    const { planDmarc, planCsp } = await import(`file://${APPLY}`);
    const intent = { domain: 'x.test', dmarcPolicy: 'reject', dmarcPct: null };
    assert.equal(
      planDmarc(
        [
          { id: '1', content: 'v=DMARC1; p=none' },
          { id: '2', content: 'v=DMARC1; p=reject' },
        ],
        intent
      ).action,
      'skip'
    );
    assert.equal(
      planCsp(
        [
          {
            id: 'a',
            action_parameters: {
              headers: { 'Content-Security-Policy': { value: 'x' } },
            },
          },
          {
            id: 'b',
            action_parameters: {
              headers: {
                'Content-Security-Policy-Report-Only': { value: 'y' },
              },
            },
          },
        ],
        'enforcing'
      ).action,
      'skip'
    );
  });

  it('writes nothing without --apply', () => {
    const src = code(APPLY);
    // The only mutating calls must be reachable only past the --apply gate. Assert the gate
    // exists and that the dry-run path returns before them.
    assert.match(
      src,
      /const apply = argv\.includes\('--apply'\)/,
      'the --apply gate is gone'
    );
    assert.match(
      src,
      /if \(!apply\) \{[\s\S]*?return;/,
      'the dry-run early return is gone — the script would write by default'
    );
    const gate = src.indexOf('if (!apply)');
    const firstWrite = src.indexOf("method: 'PATCH'");
    assert.ok(
      gate > 0 && firstWrite > gate,
      'a PATCH is reachable before the --apply gate'
    );
  });

  it('waits for propagation before verifying', async () => {
    // Probing immediately reads the PREVIOUS rule — three wrong root causes came from that
    // on #635, and it is written into CLAUDE.md for exactly this reason.
    const { PROPAGATION_MS } = await import(`file://${APPLY}`);
    assert.ok(
      PROPAGATION_MS >= 45_000,
      `propagation wait is ${PROPAGATION_MS}ms; Cloudflare needs ~45s`
    );
  });

  it('skips, rather than fails, with no token', () => {
    const env = { ...process.env };
    delete env.CLOUDFLARE_API_TOKEN;
    const out = execFileSync('node', [APPLY], { env, encoding: 'utf8' });
    assert.match(out, /skipped/, 'a missing token must skip');
    assert.doesNotMatch(out, /error/i);
  });
});

describe('the checker selftests actually run', () => {
  // Before this, neither had ever executed in CI.
  for (const [label, file] of [
    ['mail policy', MAIL],
    ['cloudflare writer', APPLY],
  ]) {
    it(`${label} --selftest passes`, () => {
      const out = execFileSync('node', [file, '--selftest'], {
        encoding: 'utf8',
      });
      assert.match(out, /selftest ok/, out);
    });
  }
});
