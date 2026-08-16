/**
 * The pre-commit hook must scan the index it is committing (#747).
 *
 * WHAT WENT WRONG. The host branch ran
 * `docker compose exec -T scripthammer pnpm run gitleaks:staged`, which enters the
 * ALREADY-RUNNING container whose `/app` is the primary checkout. A git worktree has
 * its own index, so committing from one scanned the wrong tree. Demonstrated:
 *
 *   worktree staged:                     leak.tmp.js  (an AWS-shaped key)
 *   what docker compose exec inspected:  /app -> 0 commits scanned, no leaks, exit 0
 *
 * A green tick having measured nothing — worse than no hook, and the same family as
 * #732, #725 and #739.
 *
 * AND THE SECOND DEFECT. Every non-zero exit printed "Secrets detected! Commit
 * blocked." Observed in a worktree with no `.env`: compose failed with `env file …
 * not found` and the hook reported it as a leak, sending the reader hunting one that
 * did not exist. Exit codes cannot separate these — measured: `gitleaks protect`
 * returns 1 for leaks found AND 1 for a bad config — so the hook has to establish
 * that it CAN scan before concluding anything from a failure.
 *
 * These assert the structure that keeps both closed. They are deliberately about
 * ordering and distinct messages, not wording.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HOOK = path.join(__dirname, '..', '..', '.husky', 'pre-commit');
const src = fs.readFileSync(HOOK, 'utf8');

test('the hook is non-trivial, so the assertions below are not vacuous', () => {
  assert.ok(src.length > 500, 'pre-commit is suspiciously short');
  assert.match(src, /gitleaks/, 'pre-commit does not mention gitleaks at all');
});

test('every gitleaks invocation goes through the one fallback chain', () => {
  // TEXT ORDER IS NOT THE INVARIANT, and asserting it was my first mistake here:
  // the ORIGINAL hook also defined `command -v gitleaks` near the top, inside a
  // function its host branch never called, so a position comparison passed on the
  // broken code. What actually matters is that there is a SINGLE entry point, so
  // no branch can reach docker without first trying native and checking worktree.
  const fnStart = src.indexOf('run_gitleaks_staged() {');
  assert.ok(fnStart !== -1, 'run_gitleaks_staged() is gone');

  // The function ends at the first line that is exactly '}' at column 0.
  const after = src.slice(fnStart);
  const fnEnd = fnStart + after.indexOf('\n}\n') + 2;
  const body = src.slice(fnStart, fnEnd);
  const outside = src.slice(0, fnStart) + src.slice(fnEnd);

  assert.match(
    body,
    /command -v gitleaks/,
    'the chain lost its native attempt'
  );

  const strayInvocations = outside
    .split('\n')
    .filter((line) => /gitleaks (protect|:staged)|gitleaks:staged/.test(line))
    .filter((line) => !/^\s*#/.test(line));

  assert.deepStrictEqual(
    strayInvocations.map((l) => l.trim()),
    [],
    'gitleaks is invoked outside run_gitleaks_staged(). That is exactly how the ' +
      'host branch reached docker directly and scanned the primary checkout.'
  );
});

test('docker is refused from a worktree rather than pointed at the wrong tree', () => {
  assert.match(
    src,
    /in_worktree\s*\(\)/,
    'no in_worktree() helper — the hook cannot tell it is in a linked worktree'
  );
  // --git-dir and --git-common-dir disagree only in a linked worktree.
  assert.match(
    src,
    /--git-common-dir/,
    'in_worktree() does not use the reliable check'
  );

  const guarded =
    /if\s+in_worktree;\s*then[\s\S]{0,400}?return \$SCAN_UNAVAILABLE/.test(src);
  assert.ok(
    guarded,
    'a worktree must not fall through to the docker scan — that is the wrong index'
  );
});

test('"could not scan" and "secrets found" are different outcomes', () => {
  // Both block. Only the message differs, because they need different next actions.
  assert.match(src, /SCAN_UNAVAILABLE/, 'no distinct could-not-run state');
  assert.match(src, /Secrets detected/, 'the leak message is gone');
  assert.match(
    src,
    /could NOT RUN|not a leak report/i,
    'a scanner that could not run must not be reported as a leak — that is what sent ' +
      'someone hunting a secret that did not exist'
  );
});

test('lint-staged gets the same worktree treatment as the scanner', () => {
  // Same mechanism: `docker compose exec … lint-staged` from a worktree formats the
  // primary checkout's staged files. The ticket only named this for gitleaks.
  const lintViaDocker = src.search(/docker compose exec[^\n]*lint-staged/);
  if (lintViaDocker === -1) return; // no docker path at all is also fine

  const worktreeCheckBefore = src
    .slice(0, lintViaDocker)
    .lastIndexOf('in_worktree');
  assert.ok(
    worktreeCheckBefore !== -1,
    'lint-staged reaches docker without a worktree check in front of it'
  );
});
