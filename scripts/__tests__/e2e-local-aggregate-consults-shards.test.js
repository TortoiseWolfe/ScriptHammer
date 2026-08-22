/**
 * The required aggregate must consult the shard matrix's own verdict (#934).
 *
 * WHAT HAPPENED. `E2E (local) result` concluded `success` on run 32560171118, whose shard
 * matrix concluded `failure` — `chromium/firefox/webkit gen 2/6` had each executed zero
 * tests. Branch protection reads the named context, not the run, so PR #928 merged with
 * three shards red.
 *
 * The aggregate reconstructed a verdict from uploaded artifacts and never asked the shards.
 * Every condition it did check passed: `Upload results` is `if: always()`, so a failing
 * shard still uploads a valid results.json describing nothing; a shard with no tests has no
 * failing tests; and Playwright redistributed the work, so the total went UP and cleared
 * the floor.
 *
 * WHY A TEST AND NOT JUST THE FIX. The fix is one `if:` and one `exit 1`. Deleting it turns
 * the required check back into one that cannot fail, and nothing goes red to say so — the
 * defect's entire signature is that everything looks green. That is #396, and it is exactly
 * the class this repo keeps re-deriving.
 *
 * COMMENTS ARE STRIPPED BEFORE MATCHING. The workflow now carries a long comment block
 * explaining this defect, and that prose names the very symbols asserted below. A guard that
 * matched raw text would pass with the guarded code deleted — which has happened here four
 * times, twice to guards written to catch this class.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WF = path.resolve(
  __dirname,
  '..',
  '..',
  '.github',
  'workflows',
  'e2e-local.yml'
);
const RAW = fs.readFileSync(WF, 'utf8');

/** Whole-line YAML comments removed. Trailing `#` inside a value is not one. */
function stripComments(text) {
  return text
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
}

/** The `parity:` job block, comments removed. */
function parityBlock(text = RAW) {
  const start = text.indexOf('\n  parity:');
  if (start === -1) return '';
  return stripComments(text.slice(start));
}

/** Does this text consult the shard matrix's conclusion? Both dot and bracket forms. */
function consultsShards(text) {
  return (
    /needs\.e2e-local\.result/.test(text) ||
    /needs\[\s*['"]e2e-local['"]\s*\]\.result/.test(text)
  );
}

describe('the required aggregate consults its shards (#934)', () => {
  it('the parser found the job it is asserting about', () => {
    // Anti-vacuity, first. A renamed job or a moved file makes every assertion below
    // pass by inspecting an empty string — the same shape as the defect itself.
    assert.ok(RAW.length > 2000, `${WF} is suspiciously small — stale path?`);
    const block = parityBlock();
    assert.ok(block.length > 500, 'parity: job not found, or it is empty');
    assert.match(
      block,
      /name: E2E \(local\) result/,
      'the required context name is gone from the parity job — if it was renamed, branch ' +
        'protection now waits on a context nobody reports'
    );
  });

  it('comment stripping actually removes comments', () => {
    // The control for the control. If stripComments() silently stopped working, the
    // assertion below would go back to matching the prose that explains the fix.
    const stripped = stripComments(RAW);
    assert.ok(
      stripped.length < RAW.length - 2000,
      'stripComments removed almost nothing — this file is heavily commented, so the ' +
        'stripper is broken and the assertions below may be matching prose'
    );
    assert.doesNotMatch(
      stripped,
      /WHY THIS EXISTS/,
      'a known comment survived stripping'
    );
  });

  it('the aggregate reads the shard matrix result, in CODE not prose', () => {
    assert.ok(
      consultsShards(parityBlock()),
      'the parity job no longer reads `needs.e2e-local.result`. It is then judging the ' +
        'run purely by uploaded artifacts, which cannot see a shard that failed AFTER ' +
        'writing a valid report — a zero-test shard, a zero-assertion verdict (#861), or ' +
        'any post-upload step. That is how #928 merged with three shards red.'
    );
  });

  it('and can actually fail on it', () => {
    // Reading the value and printing it would satisfy the assertion above while gating
    // nothing. The job must exit non-zero.
    const block = parityBlock();
    const start = block.search(/needs\.e2e-local\.result|needs\[/);
    const region = block.slice(start, start + 1200);
    assert.match(
      region,
      /exit 1/,
      'the shard result is read but nothing exits non-zero on it — the check reports the ' +
        'failure and passes anyway'
    );
    assert.match(
      region,
      /!=\s*["']?success/,
      'the comparison is not against `success`. Any other conclusion — failure, ' +
        'cancelled, timed_out — must fail this check.'
    );
  });

  it('the step is gated on `changes`, so a docs-only PR still passes', () => {
    // The counterweight. When the matrix is skipped its result is `skipped`, which is
    // correct there. An ungated assertion would block every docs-only PR — and a required
    // check that fails on documentation is how this lane loses its unfiltered trigger.
    const block = parityBlock();
    const stepStart = block.indexOf(
      '- name: The shards themselves must have passed'
    );
    assert.notStrictEqual(
      stepStart,
      -1,
      'the shard-verdict step was renamed; update this test deliberately, not reflexively'
    );
    const step = block.slice(stepStart, stepStart + 400);
    assert.match(
      step,
      /if:\s*needs\.changes\.outputs\.run == 'true'/,
      'the shard-verdict step is not gated on the changes job'
    );
  });

  it('the job itself is still ungated and still `if: always()`', () => {
    // Branch protection is never satisfied by a `skipped` job. Moving the gate from the
    // steps up to the job would make the required check go PENDING FOREVER on docs-only
    // PRs — passing locally, blocking merges, with nothing red to explain it.
    const block = parityBlock();
    const head = block.slice(0, block.indexOf('steps:'));
    assert.match(
      head,
      /if:\s*always\(\)/,
      'parity is no longer `if: always()`'
    );
    assert.match(
      head,
      /needs:\s*\[changes,\s*e2e-local\]/,
      'parity no longer depends on both `changes` and `e2e-local` — it cannot read a ' +
        'result it does not depend on'
    );
  });

  it('CONTROL: the matcher reports absence when the call is removed', () => {
    // Without this, an always-true matcher would satisfy every assertion above. This is
    // the mutation the reviewer cannot perform by reading.
    const mutated = parityBlock().replace(
      /\$\{\{\s*needs\.e2e-local\.result\s*\}\}/g,
      "'success'"
    );
    assert.ok(
      !consultsShards(mutated),
      'the matcher still reports the call present after it was removed — it is matching ' +
        'something other than the code it claims to check'
    );
  });
});
