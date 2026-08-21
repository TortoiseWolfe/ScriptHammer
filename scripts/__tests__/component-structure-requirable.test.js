/**
 * `Component Structure Validation` must stay REQUIRABLE — i.e. it must always report
 * (#870, pattern established for Conformance in #869).
 *
 * WHAT WENT WRONG. The workflow carried a trigger `paths:` filter, so it reported nothing
 * on an unrelated PR. A required check that never reports is **pending forever**, not
 * skipped — which is why CLAUDE.md lists this check, alongside `Build`, as one that
 * cannot be required as written. #572 catalogued the pattern: only two of thirteen
 * workflows could actually block a merge.
 *
 * WHAT THIS PINS. The three properties that together make the workflow requirable:
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
  'component-structure.yml'
);
const DECIDER = path.join(
  ROOT,
  'scripts',
  'ci',
  'component-structure-changes.mjs'
);

function workflow() {
  return fs.readFileSync(WORKFLOW, 'utf8');
}

/** The `on:` block only — a `paths:` deeper in the file is a job input, not a trigger. */
function triggerBlock(src) {
  const start = src.search(/^on:$/m);
  assert.ok(start !== -1, 'no `on:` block found in component-structure.yml');
  const rest = src.slice(start + 3);
  const end = rest.search(/^\S/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('Component Structure can be a required check (#870)', () => {
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
      'component-structure.yml has a trigger `paths:` filter again. That makes it report ' +
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
      /needs:\s*\[changes,\s*validate\]/,
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
    const { needsStructureCheck, STRUCTURE_PATHS } = await import(
      `file://${DECIDER}`
    );

    assert.ok(
      needsStructureCheck(['src/components/atomic/Button/Button.tsx']),
      'a component change must require structure validation'
    );
    assert.ok(
      needsStructureCheck(['scripts/validate-structure.js']),
      'a change to the validator itself must require it'
    );
    assert.ok(
      !needsStructureCheck(['README.md', 'docs/anything.md']),
      'a docs-only change must NOT require structure validation'
    );
    assert.ok(STRUCTURE_PATHS.length > 5, 'the path list looks truncated');
  });

  it('covers the paths the old trigger filter missed', async () => {
    const { needsStructureCheck } = await import(`file://${DECIDER}`);
    // The verdict depends on the RULES and the SCAFFOLD, not just the components. A
    // template change can make every newly generated component non-compliant without
    // touching a single file under src/components, and the audit script carries the
    // allowlist that decides what counts as compliant at all.
    for (const f of [
      'plopfile.js',
      'tools/templates/component.tsx.hbs',
      'scripts/audit-components.js',
    ]) {
      assert.ok(
        needsStructureCheck([f]),
        `${f} must require structure validation`
      );
    }
  });
});
