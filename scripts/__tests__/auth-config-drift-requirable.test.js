/**
 * `Auth Config Drift` must stay REQUIRABLE — i.e. it must always report
 * (#870, pattern established for Conformance in #869).
 *
 * WHAT WENT WRONG. The workflow carried a trigger `paths:` filter, so it reported nothing
 * on an unrelated PR. A required check that never reports is **pending forever**, not
 * skipped — which is why CLAUDE.md lists this check, alongside `Build`, as one that
 * cannot be required as written. #572 catalogued the pattern: only two of thirteen
 * workflows could actually block a merge.
 *
 * THE FORK CASE, which makes this workflow different from the other two. The `drift` job
 * carries its own `if:` that SKIPS on fork PRs, because secrets are withheld there and it
 * cannot authenticate. The aggregate must therefore treat `skipped` as green — otherwise
 * requiring this context makes every fork PR permanently unmergeable, which is the same
 * trap the paths filter created, arriving from the other direction.
 *
 * WHAT THIS PINS. The properties that together make the workflow requirable:
 *   1. no trigger `paths:` filter, so it always reports;
 *   2. an aggregate job that runs `if: always()`, so it reports even when the suite is
 *      skipped or cancelled;
 *   3. the aggregate does not treat a cancelled suite as a pass.
 *
 * WHAT IT CANNOT CHECK: that branch protection actually requires the context. That lives
 * in a GitHub setting, not this repo — `required-checks-documented.test.js` reconciles
 * the documented set against the live one.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(
  ROOT,
  '.github',
  'workflows',
  'auth-config-drift.yml'
);
const DECIDER = path.join(
  ROOT,
  'scripts',
  'ci',
  'auth-config-drift-changes.mjs'
);

function workflow() {
  return fs.readFileSync(WORKFLOW, 'utf8');
}

/** The `on:` block only — a `paths:` deeper in the file is a job input, not a trigger. */
function triggerBlock(src) {
  const start = src.search(/^on:$/m);
  assert.ok(start !== -1, 'no `on:` block found in auth-config-drift.yml');
  const rest = src.slice(start + 3);
  const end = rest.search(/^\S/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('Auth Config Drift can be a required check (#870)', () => {
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
      'auth-config-drift.yml has a trigger `paths:` filter again. That makes it report ' +
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
      /needs:\s*\[changes,\s*drift\]/,
      'the `result` job must depend on both the decider and the drift job'
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
    const { needsDriftCheck, DRIFT_PATHS } = await import(`file://${DECIDER}`);

    assert.ok(
      needsDriftCheck(['scripts/supabase/auth-config.json']),
      'a desired-state change must require the drift check'
    );
    assert.ok(
      needsDriftCheck(['scripts/supabase/set-auth-config.ts']),
      'a change to the applier must require it'
    );
    assert.ok(
      !needsDriftCheck(['README.md', 'src/components/Button.tsx']),
      'an unrelated change must NOT require the drift check'
    );
    assert.ok(DRIFT_PATHS.length > 3, 'the path list looks truncated');
  });

  it('covers the paths the old trigger filter missed', async () => {
    const { needsDriftCheck } = await import(`file://${DECIDER}`);
    // The check compares the LIVE project against the desired state, so anything that
    // changes what "desired" means can change the verdict. #734 documents fork overrides
    // for these values in .env.example, and a fork editing them is exactly who needs it.
    for (const f of [
      '.env.example',
      'tests/unit/auth-config-validity.test.ts',
      'scripts/supabase/anything-else.ts',
    ]) {
      assert.ok(needsDriftCheck([f]), `${f} must require the drift check`);
    }
  });

  it('treats a SKIPPED drift job as green, for fork PRs', () => {
    // Without this the workflow trades one un-mergeable state for another: secrets are
    // withheld from fork PRs, `drift` skips itself, and a required context that failed on
    // `skipped` would block every outside contribution.
    const src = workflow();
    const result = src.slice(src.search(/^\s{2}result:/m));
    assert.match(
      result,
      /RESULT.*=.*"skipped".*\n[\s\S]{0,200}?exit 0/,
      'the aggregate must exit 0 when the drift job was skipped — a fork PR cannot ' +
        'authenticate, and failing there makes every fork PR unmergeable once this ' +
        'context is required'
    );
  });
});
