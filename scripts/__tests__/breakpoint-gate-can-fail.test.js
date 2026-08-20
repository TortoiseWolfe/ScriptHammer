/**
 * `validate:breakpoints` must be able to FAIL on lost coverage (#396).
 *
 * WHAT WENT WRONG. #396 catalogues "gates that could not fail" and listed this script
 * as instance 4 — "a gate that exists and is never invoked". It is invoked now
 * (`ci.yml:65`, inside the required `Test (20.x)` lane, plus `validate-ci.sh:89`), but
 * fixing the invocation turned it into a different member of the same family: it ran
 * and could not fail.
 *
 * Measured before this change, by pointing `CRITICAL_MOBILE_WIDTHS` at an uncovered
 * 999px:
 *
 *     ✅ Critical widths coverage validated      <- printed anyway
 *     ❌ 0 error(s) found
 *     ⚠️  1 warning(s) found
 *       1. Critical mobile width 999px is not covered by test viewports
 *     exit 0
 *
 * Two defects in four lines. The exit code keys off `errorCount > 0` and the check
 * pushed `severity: 'warning'`, so a lost coverage floor could never redden CI. And the
 * success line printed unconditionally, so the log showed a green tick on the exact
 * check that had just recorded a problem — the "printed its success line
 * unconditionally" trap CLAUDE.md names by hand.
 *
 * WHY 'error' IS RIGHT HERE and warning is right next door: an uncovered critical width
 * means every mobile gate silently measures less than it claims to (the #411 lesson —
 * never lower a floor to make a run pass). The neighbouring check, a viewport whose
 * declared category disagrees with its breakpoint, is a naming inconsistency: the width
 * is still tested. That one stays a warning on purpose.
 *
 * WHAT THIS CANNOT CHECK: the runtime behaviour against a mutated config — that would
 * mean writing to a tracked source file from a unit test. It asserts the two structural
 * properties that were wrong, plus that the script still runs clean on this tree. The
 * runtime proof is in the PR: exit 1 with the mutant, exit 0 without.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'validate-breakpoints.ts');

const source = () => fs.readFileSync(SCRIPT, 'utf8');

/** The body of a named function in the script. */
function fnBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) return null;
  const next = src.indexOf('\nfunction ', start + 1);
  return src.slice(start, next === -1 ? src.length : next);
}

describe('the breakpoint gate can fail (#396)', () => {
  it('finds the script and both checks', () => {
    // Non-vacuity: every assertion below reads a function body, so a rename would
    // make them all pass against null.
    const src = source();
    assert.ok(
      fnBody(src, 'validateCriticalWidthsCoverage'),
      'coverage check not found'
    );
    assert.ok(fnBody(src, 'validateTestViewports'), 'viewport check not found');
    assert.match(
      src,
      /errorCount > 0 \? 1 : 0/,
      'the exit code no longer keys off errorCount — re-check what severity means here'
    );
  });

  it('a missing critical width is an ERROR, so it reddens CI', () => {
    const body = fnBody(source(), 'validateCriticalWidthsCoverage');
    assert.match(
      body,
      /severity: 'error'/,
      'the critical-width coverage check pushes a non-error severity. The exit code ' +
        'keys off errorCount, so as a warning this gate runs in CI and cannot fail — ' +
        'which is the #396 pattern it was supposed to escape.'
    );
    assert.doesNotMatch(
      body,
      /severity: 'warning'/,
      'a lost coverage floor must not be reported as a warning (#396, #411)'
    );
  });

  it('neither check claims success when it just recorded a problem', () => {
    // The success line must be gated on the error list not having grown.
    for (const name of [
      'validateCriticalWidthsCoverage',
      'validateTestViewports',
    ]) {
      const body = fnBody(source(), name);
      if (!/console\.log\('✅/.test(body)) continue;
      assert.match(
        body,
        /if \(errors\.length === \w+\)\s*\{[\s\S]*console\.log\('✅/,
        `${name} prints its ✅ unconditionally, so a run that just recorded a ` +
          'problem still shows a green tick on that check in the log.'
      );
    }
  });

  it('the script still runs clean on this tree', () => {
    // Regression floor, and proof the script is runnable at all — a structural test
    // against a file that no longer executes would be worth nothing.
    // Through `tsx`, the way package.json invokes it — the script's imports use
    // `.js` specifiers that node's own type-stripping will not resolve.
    const out = execFileSync('pnpm', ['exec', 'tsx', SCRIPT], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.match(out, /All breakpoint validations passed/);
  });
});
