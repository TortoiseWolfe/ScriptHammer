/**
 * Nothing may call `gh pr edit`, and the REST workaround must stay documented (#397).
 *
 * `gh pr edit` fails on EVERY invocation against this repo. It pre-fetches the pull
 * request through GraphQL, and that query asks for `repository.pullRequest.projectCards`
 * — a Projects (classic) field GitHub has sunset — so the server rejects the whole query
 * before any edit is attempted:
 *
 *     GraphQL: Projects (classic) is being deprecated in favor of the new Projects
 *     experience... (repository.pullRequest.projectCards)
 *
 * Re-verified 2026-08-18 on `gh 2.46.0`, probed with a deliberately invalid label so
 * nothing could mutate: exit 1, same error. `gh issue edit`, `gh pr merge` and `gh api`
 * are unaffected.
 *
 * WHY A TEST AND NOT JUST THE NOTE IN CLAUDE.md. The failure is quiet in the way that
 * matters: the exit code is non-zero, but the message reads like a deprecation *notice*
 * rather than an error, and it goes to stderr. Wrapped as
 * `cmd >/dev/null 2>&1 && echo ok || echo FAILED`, it reports FAILED with no visible
 * reason — which is exactly how it was found, one line in a batch of five that looked
 * like an unrelated permissions problem. A script that adopts `gh pr edit` would keep
 * working right up until it silently stopped.
 *
 * WHAT THIS CANNOT FIX. The bug is in the CLI, not in this repository — 2.46.0 is from
 * January 2025. The real fix is a `gh` upgrade, which is an environment change, not a
 * code change. This only stops the repo from depending on the broken path and stops the
 * workaround being edited out of the docs by someone tidying.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const CLAUDE_MD = path.join(ROOT, 'CLAUDE.md');

/** Directories worth scanning for a call site. */
const SCAN = ['scripts', '.github', '.husky', 'docs'];
const EXTENSIONS = new Set([
  '.sh',
  '.mjs',
  '.js',
  '.cjs',
  '.ts',
  '.yml',
  '.yaml',
  '.md',
]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, out);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Call sites for `gh pr edit`.
 *
 * A line that merely *names* the command while explaining that it is broken is not a
 * call site — CLAUDE.md and this file both have to be able to say `gh pr edit` out loud.
 * The signal for prose is a backtick immediately around it, or a line that also carries
 * the issue number.
 */
function callSites() {
  const hits = [];
  for (const dir of SCAN) {
    for (const file of walk(path.join(ROOT, dir))) {
      const rel = path.relative(ROOT, file);
      if (rel === path.relative(ROOT, __filename)) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/gh pr edit/.test(line)) return;
        if (/`gh pr edit`/.test(line)) return; // prose, in backticks
        if (/#397/.test(line)) return; // prose, citing the ticket
        hits.push(`${rel}:${i + 1}`);
      });
    }
  }
  return hits.sort();
}

describe('the repo does not depend on `gh pr edit` (#397)', () => {
  it('scans a meaningful number of files', () => {
    // Non-vacuity: a broken walk would report the repo as clean — the #396 shape.
    const count = SCAN.reduce((n, d) => n + walk(path.join(ROOT, d)).length, 0);

    assert.ok(
      count > 50,
      `only ${count} files scanned across ${SCAN.join(', ')}; the walk is broken`
    );
  });

  it('has no `gh pr edit` call site', () => {
    assert.deepEqual(
      callSites(),
      [],
      '`gh pr edit` fails on every invocation against this repo — its GraphQL ' +
        'pre-fetch asks for the sunset `projectCards` field (#397). The error reads ' +
        'like a deprecation notice on stderr, so in a script it looks like an ' +
        'unrelated failure. Use REST: ' +
        '`gh api -X PATCH repos/OWNER/REPO/pulls/N -F body=@body.md`'
    );
  });

  it('CLAUDE.md still carries the workaround', () => {
    // The note is the only thing standing between the next person and an hour of
    // debugging a "permissions problem". A docs tidy must not silently drop it.
    const md = fs.readFileSync(CLAUDE_MD, 'utf8');

    assert.match(
      md,
      /`gh pr edit` is broken in this repo \(#397\)/,
      'CLAUDE.md no longer warns that `gh pr edit` is broken'
    );
    assert.match(
      md,
      /gh api -X PATCH repos\/OWNER\/REPO\/pulls\/N -F body=@body\.md/,
      'CLAUDE.md no longer shows the REST workaround, so the warning is not actionable'
    );
  });

  it('the detector separates prose from a call site', () => {
    // The control. Both directions, because a detector that flagged the docs would be
    // deleted by the first person it annoyed, and one that flagged nothing is decoration.
    const isCall = (line) =>
      /gh pr edit/.test(line) &&
      !/`gh pr edit`/.test(line) &&
      !/#397/.test(line);

    assert.equal(isCall('  gh pr edit 123 --body-file body.md'), true);
    assert.equal(
      isCall('- **`gh pr edit` is broken in this repo (#397).**'),
      false
    );
    assert.equal(isCall('# gh pr edit fails here, see #397'), false);
    assert.equal(isCall('echo "hello"'), false);
  });
});
