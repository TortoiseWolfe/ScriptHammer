/**
 * The zero-assertion gate must stay ARMED on the required lane (#861).
 *
 * WHY THIS FILE EXISTS. The gate is three cooperating pieces, and any one of them can be
 * removed without breaking a single test:
 *
 *   1. `e2e-local.yml` sets `ZERO_ASSERTION_GATE_MODE: block`. Drop it and the reporter
 *      silently reverts to annotate — it prints the offenders and passes, which is what it
 *      did for the months that let nine of them reach `main`.
 *   2. `playwright-in-container.sh` forwards that variable into the test container. The
 *      env filter is an explicit allowlist, so a variable that is set but not listed is
 *      simply absent where it matters, with no error anywhere.
 *   3. A step actually runs `check-zero-assertions.mjs`. The shard runs Playwright under
 *      `|| true`, so a failed status returned by the reporter is swallowed; without this
 *      step nothing reads the verdict.
 *
 * Each omission leaves a green pipeline that enforces nothing — the exact shape catalogued
 * in #396. So each is pinned here.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'e2e-local.yml');
const RUNNER = path.join(ROOT, 'scripts', 'ci', 'playwright-in-container.sh');
const CHECKER = path.join(ROOT, 'scripts', 'ci', 'check-zero-assertions.mjs');
const REPORTER = path.join(
  ROOT,
  'tests',
  'e2e',
  'reporters',
  'assertion-count-reporter.ts'
);

const read = (p) => fs.readFileSync(p, 'utf8');

describe('the zero-assertion gate is armed (#861)', () => {
  it('reads the files it is about', () => {
    // Non-vacuity. Every assertion below is over this text; if a path breaks they would
    // all pass against nothing, which is the failure this suite exists to prevent.
    for (const [label, p] of [
      ['workflow', WORKFLOW],
      ['runner', RUNNER],
      ['checker', CHECKER],
      ['reporter', REPORTER],
    ]) {
      assert.ok(fs.existsSync(p), `${label} missing at ${p}`);
      assert.ok(read(p).length > 200, `${label} is suspiciously short`);
    }
  });

  it('the required lane sets the mode to block', () => {
    assert.match(
      read(WORKFLOW),
      /ZERO_ASSERTION_GATE_MODE:\s*block/,
      'e2e-local.yml no longer sets ZERO_ASSERTION_GATE_MODE: block. Without it the ' +
        'reporter falls back to annotate and the required lane enforces nothing.'
    );
  });

  it('the variable is forwarded into the test container', () => {
    // Set-but-not-forwarded is the silent version of not set at all: the reporter runs
    // inside a container whose env comes from an explicit allowlist.
    assert.match(
      read(RUNNER),
      /ZERO_ASSERTION_GATE_MODE/,
      'playwright-in-container.sh does not forward ZERO_ASSERTION_GATE_MODE, so the ' +
        'reporter inside the container never sees it'
    );
  });

  it('a step actually reads the verdict', () => {
    assert.match(
      read(WORKFLOW),
      /run:\s*node scripts\/ci\/check-zero-assertions\.mjs/,
      'nothing runs check-zero-assertions.mjs. The shard runs Playwright under ' +
        '`|| true`, so the reporter cannot fail the job by itself.'
    );
  });

  it('the reporter can still return a failing status', () => {
    const src = read(REPORTER);
    assert.match(
      src,
      /status:\s*'failed'/,
      'the reporter no longer signals failure — block mode would be inert for anyone ' +
        'running playwright directly'
    );
    assert.match(
      src,
      /ZERO_ASSERTION_GATE_MODE/,
      'the reporter no longer consults the mode variable'
    );
  });

  it('the checker reaches both verdicts', async () => {
    // Exercised through the real module rather than a reimplementation of its rule.
    const { decide } = await import(`file://${CHECKER}`);

    assert.ok(
      decide({ mode: 'block', observed: 3, silent: [] }).ok,
      'clean must pass'
    );
    assert.ok(
      !decide({ mode: 'block', observed: 3, silent: ['a:1 › x'] }).ok,
      'an offender must block'
    );
    assert.ok(
      decide({ mode: 'annotate', observed: 3, silent: ['a:1 › x'] }).ok,
      'annotate must only warn'
    );
    // Both directions of "the gate saw nothing" fail, because a gate that passes when
    // its own input is missing is the thing this repo keeps paying for.
    assert.ok(!decide(null).ok, 'a missing verdict must fail');
    assert.ok(
      !decide({ mode: 'block', observed: 0, silent: [] }).ok,
      'observing zero tests must fail'
    );
  });
});
