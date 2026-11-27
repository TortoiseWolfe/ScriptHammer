/**
 * `Auth Config Drift` must stay REQUIRABLE and must actually RUN on every same-repo pull
 * request (#870, pattern established for Conformance in #869; the path decision was then
 * removed so the check reports a real pass rather than a skip).
 *
 * WHAT WENT WRONG, TWICE.
 *   1. The workflow carried a trigger `paths:` filter, so it reported nothing on an
 *      unrelated PR. A required check that never reports is **pending forever**, not
 *      skipped (#572 catalogued the pattern: only two of thirteen workflows could
 *      actually block a merge).
 *   2. The fix moved the decision into a `changes` job that skipped the drift check on an
 *      unrelated PR. That made the check requirable, but most PRs then showed it as
 *      SKIPPED: a job that did not run, next to a green tick that says nothing about the
 *      change. The call is one read-only Management API request per run, so nothing
 *      stops it running every time.
 *
 * THE TWO SKIPS THAT REMAIN, which make this workflow different from the other three.
 *   - `preflight` finds no Supabase project (a fork): nothing to compare against.
 *   - the `drift` job skips itself on fork PRs, because secrets are withheld there and it
 *     cannot authenticate.
 * The aggregate must treat both as green — otherwise requiring this context makes every
 * fork PR permanently unmergeable, the same trap the paths filter created, arriving from
 * the other direction. A same-repo PR in a configured repo can never skip.
 *
 * WHAT THIS PINS.
 *   1. no trigger `paths:` filter;
 *   2. no `changes` job and no path decision in the workflow;
 *   3. the `drift` job's `if:` names only the two unavoidable skips;
 *   4. an aggregate job that runs `if: always()` and needs the preflight and the drift job;
 *   5. a failed preflight (half-configured project) is not laundered into green;
 *   6. a success passes, a cancelled run fails, and the two named skips pass.
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

/** The text of one top-level job, from its key to the next job. */
function job(src, name) {
  const start = src.search(new RegExp(`^ {2}${name}:`, 'm'));
  assert.ok(start !== -1, `no \`${name}:\` job found`);
  const rest = src.slice(start + 1);
  const end = rest.search(/^ {2}[a-z][a-z-]*:/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('Auth Config Drift runs on every PR and can be a required check (#870)', () => {
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
        'PENDING FOREVER — so the check cannot be required (#572).'
    );
  });

  it('has no path-deciding job, so an unrelated PR is not skipped', () => {
    const src = workflow();
    assert.ok(
      !/^ {2}changes:/m.test(src),
      'a `changes` job is back. It decides whether the drift check runs, and a check that ' +
        'does not run shows as SKIPPED. Run on every PR.'
    );
    assert.ok(
      !/auth-config-drift-changes/.test(src),
      'the workflow references the retired path decider'
    );
    assert.ok(
      !/outputs\.run\b/.test(src),
      'something still reads a `run` output, which only a path decision produces'
    );
  });

  it('skips the drift job only for an unconfigured project or a fork PR', () => {
    const drift = job(workflow(), 'drift');
    const cond = drift.match(/^ {4}if:\s*(.+)$/m);
    assert.ok(cond, 'the `drift` job has no `if:` guard for fork PRs');
    assert.match(cond[1], /needs\.preflight\.outputs\.configured == 'true'/);
    assert.match(cond[1], /github\.event\.pull_request\.head\.repo\.full_name/);
    // Anything else in the condition is a skip nobody has justified.
    const stripped = cond[1]
      .replace(/needs\.preflight\.outputs\.configured == 'true'/g, '')
      .replace(/github\.event_name != 'pull_request'/g, '')
      .replace(
        /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/g,
        ''
      )
      .replace(/[\s$(){}&|]+/g, '');
    assert.strictEqual(
      stripped,
      '',
      `the \`drift\` job's \`if:\` carries a condition beyond the two unavoidable skips: ${cond[1]}`
    );
  });

  it('has an aggregate job that reports even when the check did not finish', () => {
    const result = job(workflow(), 'result');
    assert.match(
      result,
      /if:\s*always\(\)/,
      'the `result` job is not `if: always()`, so it is skipped when the suite is ' +
        'cancelled — and a skipped required check is pending forever'
    );
    assert.match(
      result,
      /needs:\s*\[preflight,\s*drift\]/,
      'the `result` job must depend on the preflight and the drift job'
    );
  });

  it('does not launder a failed preflight into green', () => {
    const result = job(workflow(), 'result');
    // A half-configured project makes the preflight exit 1. The skip branches below that
    // check would otherwise report green, retiring the daily gate silently.
    const guard = result.indexOf('needs.preflight.result');
    const firstGreenSkip = result.search(/CONFIGURED" != "true"/);
    assert.ok(
      guard !== -1,
      'the aggregate never looks at the preflight result'
    );
    assert.ok(
      guard < firstGreenSkip,
      'the preflight-result check must come BEFORE the configured=false green branch'
    );
  });

  it('passes on success, fails on anything else, and names both green skips', () => {
    const result = job(workflow(), 'result');
    // The whole family of defects here is a signal that reports success without
    // observing its subject. A cancelled run observed nothing.
    assert.ok(
      /success\)\s*echo[^\n]*exit 0/.test(result) &&
        /\*\)\s*echo[^\n]*exit 1/.test(result),
      'the `result` job must pass on success and fail on cancelled or failed. A ' +
        'cancelled run observed nothing, and calling that green is the #396 shape.'
    );
    // Green skip 1: no Supabase project to compare against.
    assert.match(
      result,
      /"\$CONFIGURED" != "true"\ \]; then[\s\S]{0,300}?exit 0/,
      'an unconfigured project must report green: there is nothing to compare against'
    );
    // Green skip 2: a fork PR. Without this the workflow trades one un-mergeable state
    // for another, since secrets are withheld from fork PRs and `drift` skips itself.
    assert.match(
      result,
      /RESULT.*=.*"skipped".*\n[\s\S]{0,200}?exit 0/,
      'the aggregate must exit 0 when the drift job was skipped — a fork PR cannot ' +
        'authenticate, and failing there makes every fork PR unmergeable once this ' +
        'context is required'
    );
  });
});
