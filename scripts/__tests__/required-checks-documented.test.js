/**
 * CLAUDE.md's account of which checks block a merge must stay true (#782).
 *
 * WHAT WENT WRONG. `E2E (local) result` became a required context on 2026-08-15
 * when #739 closed. CLAUDE.md went on saying "Required checks are `Test (20.x)`
 * and `accessibility` only" and, a few hundred lines earlier, that the local lane
 * was "ADVISORY, not required" — contradicting both reality and itself.
 *
 * That is not a cosmetic drift. A `gh pr merge` refused with "the base branch
 * policy prohibits the merge" while both DOCUMENTED checks were green, which reads
 * as a broken protection rule or a `gh` bug rather than a third check still
 * running. It also makes docs-only PRs look cheaper than they are — they now wait
 * on a full E2E lane, which matters directly to the merge-pacing rules around #548.
 *
 * WHAT THIS CANNOT CHECK, said plainly so a green run is not over-read: whether
 * the list matches LIVE branch protection. `GET /branches/{b}/protection` needs
 * admin scope, which CI's default `GITHUB_TOKEN` does not have. Asserting it here
 * would mean a network call and a privileged token inside the unit suite.
 *
 * So this asserts what IS decidable offline and is where the bug actually lived:
 * that CLAUDE.md agrees with itself, and that every check it calls required comes
 * from a workflow which can legitimately BE required. Verify against live
 * protection with:
 *
 *   gh api repos/OWNER/REPO/branches/main/protection --jq '.required_status_checks.contexts'
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const CLAUDE_MD = path.join(ROOT, 'CLAUDE.md');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

/**
 * The workflow that produces each required check context.
 *
 * A check may only be required if its workflow has NO trigger `paths:` filter —
 * a required check that never reports is PENDING FOREVER, not skipped, which is
 * why `Build` and `Validate Component Structure` are deliberately excluded.
 */
const CHECK_SOURCE = {
  'Test (20.x)': 'ci.yml',
  accessibility: 'accessibility.yml',
  'E2E (local) result': 'e2e-local.yml',
};

function claudeMd() {
  return fs.readFileSync(CLAUDE_MD, 'utf8');
}

/** The names in CLAUDE.md's "Required checks are …" sentence. */
function documentedRequiredChecks(src) {
  const sentence = src.match(/Required checks are \*\*(.+?)\*\*/s);
  if (!sentence) return null;
  return [...sentence[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

/** Does a workflow restrict its triggers with `paths:` / `paths-ignore:`? */
function hasTriggerPathsFilter(file) {
  const src = fs.readFileSync(path.join(WORKFLOWS, file), 'utf8');
  const beforeJobs = src.split(/^jobs:/m)[0] ?? '';
  return /^\s+paths(-ignore)?:/m.test(beforeJobs);
}

test('CLAUDE.md still states a required-checks list at all', () => {
  // Without this, every assertion below passes vacuously the moment someone
  // rewords the sentence — the #396 shape.
  const checks = documentedRequiredChecks(claudeMd());

  assert.ok(
    checks && checks.length > 0,
    'could not find a "Required checks are **…**" sentence in CLAUDE.md; the ' +
      'wording changed, so this guard is no longer reading anything'
  );
});

test('the documented required checks are exactly the ones with a known source', () => {
  const documented = documentedRequiredChecks(claudeMd());

  assert.deepEqual(
    [...documented].sort(),
    Object.keys(CHECK_SOURCE).sort(),
    'CLAUDE.md lists required checks that do not match CHECK_SOURCE. If branch ' +
      'protection genuinely changed, update BOTH — and confirm against ' +
      '`gh api repos/OWNER/REPO/branches/main/protection`.'
  );
});

test('every required check comes from a workflow with NO trigger paths filter', () => {
  for (const [check, file] of Object.entries(CHECK_SOURCE)) {
    assert.ok(
      fs.existsSync(path.join(WORKFLOWS, file)),
      `${check} is documented as required but ${file} does not exist`
    );
    assert.equal(
      hasTriggerPathsFilter(file),
      false,
      `${check} is required but ${file} filters its triggers with paths:. A ` +
        `required check that never reports is PENDING FOREVER, not skipped, so ` +
        `every docs-only PR would become permanently unmergeable.`
    );
  }
});

test('CLAUDE.md does not call a required lane advisory', () => {
  // The precise self-contradiction that shipped: one passage listing the lane as
  // required while another, hundreds of lines away, called it advisory. Whichever
  // a reader hits first becomes what they believe.
  const src = claudeMd();
  const documented = documentedRequiredChecks(src) ?? [];

  if (documented.includes('E2E (local) result')) {
    assert.doesNotMatch(
      src,
      /lane is (still )?ADVISORY, not required/i,
      'CLAUDE.md lists `E2E (local) result` as required AND calls the local lane ' +
        'advisory. Both cannot be true; the second is what made a legitimate ' +
        'merge refusal look like a broken protection rule (#782).'
    );
  }
});
