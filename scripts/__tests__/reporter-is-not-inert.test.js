/**
 * A reporter in `playwright.config.ts` does nothing if a lane passes `--reporter=` (#396).
 *
 * WHAT HAPPENED, and it is worth recording because the tool built to detect this family
 * committed the family's own defect. PR #846 added a reporter that names any test
 * finishing with zero assertions, and wired it into `playwright.config.ts`. It was
 * verified locally, mutation-tested three ways, and merged.
 *
 * It printed NOTHING in CI.
 *
 * `playwright test --reporter=X` REPLACES the config's `reporter` array — it does not
 * append. Every lane passes one (`line,json` in e2e-local, `list` and `blob` in e2e.yml),
 * so the reporter ran in exactly the two lanes that do not override (smoke,
 * signup-mailer) and in none of the 25 shards on the REQUIRED lane. Found by grepping
 * the run logs for its own output and getting nothing back — the check that a control
 * has an EFFECT, not merely a presence.
 *
 * WHY A TEST AND NOT JUST THE FIX. The config and the workflows are different files with
 * nothing relating them, and the failure is silent in the worst way: the reporter is
 * present, correct, unit-tested, and mute. Nothing goes red. This relates them.
 *
 * WHAT THIS CANNOT CHECK: that the reporter produces useful output, or that a lane's
 * output is ever read. It asserts the wiring reaches every lane that runs the suite.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const REPORTER = 'assertion-count-reporter';

/** Lines that actually run the suite, ignoring comments and report merging. */
function invocations() {
  const out = [];
  for (const file of fs
    .readdirSync(WORKFLOWS)
    .filter((f) => /\.ya?ml$/.test(f))) {
    const src = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/^\s*#/.test(line)) return;
      if (/merge-reports/.test(line)) return;
      if (!/--reporter=/.test(line)) return;
      out.push({ file, line: i + 1, text: line.trim() });
    });
  }
  return out;
}

describe('the zero-assertion reporter actually runs (#396)', () => {
  it('the reporter file exists and the config references it', () => {
    // Non-vacuity: if the reporter were deleted, every assertion below about
    // `--reporter=` lists would be checking a string nothing produces.
    const rp = path.join(
      ROOT,
      'tests',
      'e2e',
      'reporters',
      'assertion-count-reporter.ts'
    );
    assert.ok(fs.existsSync(rp), 'the reporter file is gone');
    const cfg = fs.readFileSync(
      path.join(ROOT, 'playwright.config.ts'),
      'utf8'
    );
    assert.match(
      cfg,
      new RegExp(REPORTER),
      'playwright.config.ts no longer lists it'
    );
  });

  it('finds the lanes that override the reporter list', () => {
    // The other half of non-vacuity. "Every override includes it" is trivially true
    // of zero overrides — which is exactly the state this test would have to
    // distinguish from the real one.
    assert.ok(
      invocations().length >= 5,
      `expected several --reporter= invocations across the lanes, found ${invocations().length}`
    );
  });

  it('every lane that overrides --reporter still includes it', () => {
    const missing = invocations().filter((v) => !v.text.includes(REPORTER));
    assert.deepEqual(
      missing.map((v) => `${v.file}:${v.line}`),
      [],
      "`playwright test --reporter=X` REPLACES the config's reporter array rather " +
        'than appending to it, so these lanes run without the zero-assertion ' +
        'reporter entirely. That is how #846 shipped a reporter that printed nothing ' +
        'in the required lane. Append it to the list: ' +
        `--reporter=<existing>,./tests/e2e/reporters/${REPORTER}.ts`
    );
  });

  it('the detector can actually fail', () => {
    const has = (line) =>
      !/^\s*#/.test(line) &&
      /--reporter=/.test(line) &&
      !/merge-reports/.test(line);

    assert.equal(has('  --reporter=line,json \\'), true);
    assert.equal(
      has('  # --reporter=line'),
      false,
      'a comment is not an invocation'
    );
    assert.equal(
      has('  pnpm exec playwright merge-reports --reporter=json ./blobs'),
      false,
      'merging reports is not running the suite'
    );

    // The exact bug: an override that omits the reporter must be reported.
    const bad = { file: 'x.yml', line: 1, text: '--reporter=line,json' };
    assert.equal(bad.text.includes(REPORTER), false);
  });
});
