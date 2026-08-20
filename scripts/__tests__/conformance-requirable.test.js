/**
 * `Conformance` must stay REQUIRABLE — i.e. it must always report (#572 item 6).
 *
 * WHAT WENT WRONG. `conformance.yml` carried a trigger `paths:` filter, so it reported
 * nothing on an unrelated PR. A required check that never reports is **pending forever**,
 * not skipped, so it could not be required — and on 2026-08-18 it was red on every push
 * from `e0add554` to `007a60de`, six merges, while all three required checks stayed green,
 * because none of them runs `pnpm test:rls`.
 *
 * Nothing routed that anywhere a person looks. It was found only because the owner
 * happened to ask about a failure notification.
 *
 * WHAT THIS PINS. The three properties that together make the workflow requirable:
 *   1. no trigger `paths:` filter, so it always reports;
 *   2. an aggregate job that runs `if: always()`, so it reports even when the suite is
 *      skipped or cancelled;
 *   3. the aggregate does not treat a cancelled suite as a pass.
 *
 * WHAT IT CANNOT CHECK: that branch protection actually requires the context. That lives
 * in a GitHub setting, not this repo — `required-checks-documented.test.js` is the check
 * that reconciles the documented set against the live one.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'conformance.yml');
const DECIDER = path.join(ROOT, 'scripts', 'ci', 'conformance-changes.mjs');

function workflow() {
  return fs.readFileSync(WORKFLOW, 'utf8');
}

/** The `on:` block only — a `paths:` deeper in the file is a job input, not a trigger. */
function triggerBlock(src) {
  const start = src.search(/^on:$/m);
  assert.ok(start !== -1, 'no `on:` block found in conformance.yml');
  const rest = src.slice(start + 3);
  const end = rest.search(/^\S/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('Conformance can be a required check (#572)', () => {
  it('reads the workflow and finds a real trigger block', () => {
    // Non-vacuity. Every assertion below is over this text; if the parse breaks they all
    // pass against nothing, which is the shape this file exists to prevent.
    const on = triggerBlock(workflow());
    assert.match(on, /pull_request:/, 'trigger block has no pull_request');
    assert.match(on, /push:/, 'trigger block has no push');
  });

  it('has NO trigger paths filter', () => {
    const on = triggerBlock(workflow());
    assert.ok(
      !/^\s+paths:/m.test(on),
      'conformance.yml has a trigger `paths:` filter again. That makes it report ' +
        'NOTHING on an unrelated PR, and a required check that never reports is ' +
        'PENDING FOREVER — so the check cannot be required, which is how Conformance ' +
        'stayed red across six merges (#572). Filter inside the `changes` job instead.'
    );
  });

  it('has an aggregate job that reports even when the suite does not run', () => {
    const src = workflow();
    assert.match(
      src,
      /^\s{2}result:/m,
      'no `result:` aggregate job — without one there is no context that always reports'
    );
    const result = src.slice(src.search(/^\s{2}result:/m));
    assert.match(
      result,
      /if:\s*always\(\)/,
      'the `result` job is not `if: always()`, so it is skipped when the suite is ' +
        'skipped — and a skipped required check is pending forever'
    );
    assert.match(
      result,
      /needs:\s*\[changes,\s*rls-conformance\]/,
      'the `result` job must depend on both the decider and the suite'
    );
  });

  it('does NOT treat a cancelled suite as a pass', () => {
    const src = workflow();
    const result = src.slice(src.search(/^\s{2}result:/m));
    // The whole family of defects here is a signal that reports success without
    // observing its subject. A cancelled run observed nothing.
    assert.ok(
      /success\)\s*echo[^\n]*exit 0/.test(result) &&
        /\*\)\s*echo[^\n]*exit 1/.test(result),
      'the `result` job must pass ONLY on success and fail on anything else. A ' +
        'cancelled run observed nothing, and calling that green is the #396 shape.'
    );
  });

  it('the decider can say both yes and no', async () => {
    // A gate that can only reach one answer is not a gate. Exercised through the real
    // module rather than a reimplementation of its rule.
    const { needsConformance, CONFORMANCE_PATHS } = await import(
      `file://${DECIDER}`
    );

    assert.ok(
      needsConformance([
        'supabase/migrations/20251006_complete_monolithic_setup.sql',
      ]),
      'a migration change must require conformance'
    );
    assert.ok(
      needsConformance(['tests/rls/whatever.test.ts']),
      'an RLS test change must require conformance'
    );
    assert.ok(
      !needsConformance(['README.md', 'docs/anything.md']),
      'a docs-only change must NOT require conformance'
    );
    assert.ok(CONFORMANCE_PATHS.length > 5, 'the path list looks truncated');
  });

  it('covers the paths the six-merge outage came through', async () => {
    const { needsConformance } = await import(`file://${DECIDER}`);
    // #565 changed a GRANT, which moved a refusal from RLS to the privilege layer. The
    // old trigger filter did not list `scripts/supabase/` or `supabase/functions/`, so a
    // change of that shape could skip the only suite that would notice.
    for (const f of [
      'scripts/supabase/set-auth-config.ts',
      'supabase/functions/delete-account/index.ts',
      'pnpm-lock.yaml',
    ]) {
      assert.ok(needsConformance([f]), `${f} must require conformance`);
    }
  });
});
