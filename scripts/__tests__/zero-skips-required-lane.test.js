/**
 * The required E2E lane reports ZERO skipped tests (#1464, register #188).
 *
 * A skipped test is not a passing test, and a required check that quietly carries
 * skips reads as green. The contract is spread over four files, and each way of
 * drifting is silent:
 *
 *   1. `.github/workflows/e2e-local.yml` — the aggregate step turns a skipped test in
 *      chromium mode (the PR and merge lane) into a failure. Full mode (nightly) keeps
 *      its registered firefox/webkit skips, so the check must be mode-scoped.
 *   2. `playwright.config.ts` — `LIVE_PROVIDER_GLOBS` EXCLUDES the live-Stripe spec from
 *      every project unless `LIVE_PROVIDER_TESTS` is set. Excluded, not skipped, and not
 *      tag + grep: `e2e.yml` must stay grep-free (see hosted-tag-lanes.test.js).
 *   3. `scripts/e2e-live-acceptance.sh` — sets `LIVE_PROVIDER_TESTS=1`, otherwise the live
 *      spec could not be run by anyone.
 *   4. `tests/e2e/payment/*` — no empty `test.skip(...)` stub bodies come back.
 *
 * Dropping the gate or the exclusion puts a skip on the required check again with
 * nothing red to say so. Modelled on hosted-tag-lanes.test.js: the parser must find
 * what it asserts about, and a control proves the comparator can fail.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');

const LIVE_SPEC_GLOB = '**/payment/08-subscription-lifecycle.spec.ts';

/** Drop whole-line `#` comments from YAML/Python so prose cannot satisfy a match. */
function stripHashComments(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/** Drop `//` line comments so a commented-out spread cannot satisfy a match. */
function stripSlashComments(text) {
  return text.replace(/\/\/.*$/gm, '');
}

/** True when the aggregate fails a chromium-mode run that has skipped tests. */
function gatesChromiumSkips(workflowText) {
  const src = stripHashComments(workflowText);
  return /if\s+browser_mode\s*==\s*"chromium"\s+and\s+tot\["skipped"\]\s*:\s*\n\s*problems\.append/.test(
    src
  );
}

describe('zero skipped tests on the required E2E lane (#1464)', () => {
  const workflow = read('.github', 'workflows', 'e2e-local.yml');
  const config = stripSlashComments(read('playwright.config.ts'));
  const liveScript = read('scripts', 'e2e-live-acceptance.sh');

  it('the parser found the aggregate step it is asserting about', () => {
    const src = stripHashComments(workflow);
    assert.ok(
      /tot\s*=\s*\{"passed": 0, "skipped": 0/.test(src) &&
        /if tot\["failed"\]:/.test(src),
      'the aggregate step moved or was renamed — this guard is anchored to a stale shape'
    );
  });

  it('a skipped test fails the aggregate in chromium mode', () => {
    assert.ok(
      gatesChromiumSkips(workflow),
      'e2e-local.yml no longer fails a chromium-mode run that skipped a test. The ' +
        'required check can now be green with skips in it.'
    );
  });

  it('the gate is scoped to chromium mode, so the nightly keeps its registered skips', () => {
    const src = stripHashComments(workflow);
    assert.ok(
      !/if\s+tot\["skipped"\]\s*:/.test(src),
      'the skipped check lost its browser_mode scope — the nightly full run carries ' +
        'registered firefox/webkit skips and would go red every night'
    );
  });

  it('the live Stripe spec is excluded from every lane unless LIVE_PROVIDER_TESTS is set', () => {
    assert.ok(
      /const LIVE_PROVIDER_GLOBS\s*=\s*process\.env\.LIVE_PROVIDER_TESTS\s*\?\s*\[\]\s*:\s*\[\s*'\*\*\/payment\/08-subscription-lifecycle\.spec\.ts'\s*\]/.test(
        config
      ),
      `LIVE_PROVIDER_GLOBS is gone or no longer excludes ${LIVE_SPEC_GLOB}`
    );
    // Project-level testIgnore REPLACES any top-level one, so every project that
    // runs payment specs must spread it: 3 browsers + mobile + tablet.
    const spreads = (config.match(/\.\.\.LIVE_PROVIDER_GLOBS/g) || []).length;
    assert.strictEqual(
      spreads,
      5,
      `expected LIVE_PROVIDER_GLOBS spread into 5 testIgnore lists (chromium-gen, ` +
        `firefox-gen, webkit-gen, mobile, tablet), found ${spreads}. A project missing ` +
        'it runs the live spec and skips it.'
    );
  });

  it('the live-acceptance script lifts the exclusion', () => {
    const exec = liveScript
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');
    assert.ok(
      /-e LIVE_PROVIDER_TESTS=1/.test(exec),
      'scripts/e2e-live-acceptance.sh does not set LIVE_PROVIDER_TESTS=1, so the live ' +
        'Stripe spec can never be run'
    );
  });

  it('e2e.yml stays grep-free (the exclusion is by config, not by tag)', () => {
    const hosted = stripHashComments(read('.github', 'workflows', 'e2e.yml'));
    assert.ok(
      !/--grep(-invert)?=/.test(hosted),
      'e2e.yml gained a --grep; Playwright hides "No tests found" under --shard'
    );
  });

  it('no empty skipped stub is left in the payment specs', () => {
    const dir = path.join(REPO_ROOT, 'tests', 'e2e', 'payment');
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.spec.ts'))
      .filter((f) =>
        /\btest\.skip\(\s*['"`][^'"`]+['"`]\s*,\s*async/.test(
          fs.readFileSync(path.join(dir, f), 'utf8')
        )
      );
    assert.deepStrictEqual(
      offenders,
      [],
      'a `test.skip(title, ...)` stub is back in the payment specs. It covers nothing ' +
        'and shows as skipped on the required check (#1369, #1464).'
    );
  });

  it('the control can fail — a workflow without the gate is rejected', () => {
    const withoutGate = [
      'tot = {"passed": 0, "skipped": 0, "flaky": 0, "failed": 0}',
      'if tot["failed"]:',
      '    problems.append("failed")',
      '# if browser_mode == "chromium" and tot["skipped"]:',
      '#     problems.append("skipped")',
    ].join('\n');
    assert.strictEqual(
      gatesChromiumSkips(withoutGate),
      false,
      'a commented-out gate counted as present — the comparator cannot fail'
    );
    assert.strictEqual(
      gatesChromiumSkips(
        'if browser_mode == "chromium" and tot["skipped"]:\n    problems.append("x")'
      ),
      true,
      'the comparator cannot see a real gate'
    );
  });
});
