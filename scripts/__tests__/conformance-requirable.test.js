/**
 * `Conformance` must stay REQUIRABLE and must actually RUN on every pull request
 * (#572 item 6; the path decision was then removed so the check reports a real pass
 * rather than a skip).
 *
 * WHAT WENT WRONG, TWICE.
 *   1. `conformance.yml` carried a trigger `paths:` filter, so it reported nothing on an
 *      unrelated PR. A required check that never reports is **pending forever**, not
 *      skipped — and on 2026-08-18 it was red on every push from `e0add554` to
 *      `007a60de`, six merges, while all three required checks stayed green, because none
 *      of them runs `pnpm test:rls`.
 *   2. The fix moved the decision into a `changes` job that skipped the suite on an
 *      unrelated PR. That made the check requirable, but most PRs then showed the suite as
 *      SKIPPED: a job that did not run, next to a green tick that says nothing about the
 *      change. The stack is local and ephemeral (public demo keys, no secrets, no real
 *      mail), so nothing stops it running every time.
 *
 * WHAT THIS PINS.
 *   1. no trigger `paths:` filter;
 *   2. no `changes` job and no `if:` on the suite, so it cannot be skipped;
 *   3. an aggregate job that runs `if: always()` and needs the suite;
 *   4. the aggregate passes ONLY on `success`: a skipped or cancelled suite is not a pass.
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

/** The text of one top-level job, from its key to the next job. */
function job(src, name) {
  const start = src.search(new RegExp(`^ {2}${name}:`, 'm'));
  assert.ok(start !== -1, `no \`${name}:\` job found`);
  const rest = src.slice(start + 1);
  const end = rest.search(/^ {2}[a-z][a-z-]*:/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('Conformance runs on every PR and can be a required check (#572)', () => {
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
        'stayed red across six merges (#572).'
    );
  });

  it('has no path-deciding job and no `if:` on the suite, so it cannot be skipped', () => {
    const src = workflow();
    assert.ok(
      !/^ {2}changes:/m.test(src),
      'a `changes` job is back. It decides whether the suite runs, and a suite that ' +
        'does not run shows as SKIPPED — a check that observed nothing. Run on every PR.'
    );
    assert.ok(
      !/conformance-changes/.test(src),
      'the workflow references the retired path decider'
    );
    const suite = job(src, 'rls-conformance');
    assert.ok(
      !/^ {4}if:/m.test(suite),
      'the `rls-conformance` job has a job-level `if:`, which is a skip by another name'
    );
    assert.ok(
      !/^ {4}needs:/m.test(suite),
      'the `rls-conformance` job waits on another job; it should start on its own'
    );
  });

  it('has an aggregate job that reports even when the suite did not finish', () => {
    const result = job(workflow(), 'result');
    assert.match(
      result,
      /if:\s*always\(\)/,
      'the `result` job is not `if: always()`, so it is skipped when the suite is ' +
        'cancelled — and a skipped required check is pending forever'
    );
    assert.match(
      result,
      /needs:\s*\[rls-conformance\]/,
      'the `result` job must depend on the suite'
    );
  });

  it('passes ONLY on success: a skipped or cancelled suite is not a pass', () => {
    const result = job(workflow(), 'result');
    // The whole family of defects here is a signal that reports success without
    // observing its subject. A cancelled or skipped run observed nothing.
    assert.ok(
      /success\)\s*echo[^\n]*exit 0/.test(result) &&
        /\*\)\s*echo[^\n]*exit 1/.test(result),
      'the `result` job must pass ONLY on success and fail on anything else.'
    );
    assert.ok(
      !/skipped\)[^\n]*exit 0/.test(result) &&
        !/= "skipped"[\s\S]{0,80}exit 0/.test(result),
      'the `result` job reports green on a skipped suite'
    );
  });
});
