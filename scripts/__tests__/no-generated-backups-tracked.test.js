/**
 * The test suite must not leave artifacts in the repository (#924).
 *
 * WHAT HAPPENED. `migrate-components.test.js` planted its fixtures in `__dirname`, and
 * `createBackup()` (scripts/migrate-components.js:250-256) writes to `path.dirname(target)` —
 * the PARENT of what it is given. So a fixture at `scripts/__tests__/test-backup` produced a
 * backup at `scripts/__tests__/.component-backup-<timestamp>`, a SIBLING of the fixture. Every
 * `afterEach` removed the fixture and left the backup.
 *
 * Measured before the fix: 5 new directories per run of that one file, 826 accumulated on
 * disk (3,850 files), 745 of them from the preceding three weeks. Every CI run added five too.
 *
 * AND 66 WERE COMMITTED. They landed in `abc485fd` — the same commit that added
 * `.gitignore:161 .component-backup-*`. A gitignore rule cannot reach a path already in the
 * index, so `git check-ignore` reported "not ignored" and only `--no-index` revealed the rule
 * existed. That is the trap CLAUDE.md documents for `public/manifest.json`, which sat that way
 * for months — here it was in the directory holding the repo's own guards.
 *
 * THE SUITE GUARDED THE REPO AGAINST THIS CLASS AND DID NOT GUARD ITSELF. That is what this
 * file is for.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

/** Patterns that are generated output and must never be committed. */
const GENERATED = [
  { name: '.component-backup-*', match: /\.component-backup-/ },
];

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

describe('generated test artifacts stay out of the index (#924)', () => {
  it('the file list was actually read', () => {
    // Anti-vacuity: if `git ls-files` returned nothing — wrong cwd, no git — every
    // assertion below would pass by inspecting an empty set, which is the failure this
    // repo catalogues under #396.
    const files = trackedFiles();
    assert.ok(
      files.length > 500,
      `only ${files.length} tracked files seen — the scan is not looking at this repo`
    );
  });

  for (const { name, match } of GENERATED) {
    it(`no ${name} path is tracked`, () => {
      const offenders = trackedFiles().filter((f) => match.test(f));
      assert.deepStrictEqual(
        offenders.slice(0, 10),
        [],
        `${offenders.length} generated ${name} path(s) are committed. A .gitignore rule ` +
          'cannot untrack them — it does not apply to paths already in the index, and ' +
          '`git check-ignore` will call them "not ignored" while `--no-index` shows the ' +
          'rule matching. Use `git rm -r --cached`, and fix whatever wrote them into the ' +
          'tree rather than only deleting the output.'
      );
    });
  }

  it('migrate-components.test.js keeps its fixtures outside the repository', () => {
    // The wiring assertion, and the one that catches the CLASS. Asserting nothing is
    // tracked only catches the aftermath — by then the files exist and someone has to
    // notice. This fails the moment a fixture root moves back inside the tree, which is
    // what made the backups land here in the first place.
    const fs = require('node:fs');
    const src = fs.readFileSync(
      path.join(__dirname, 'migrate-components.test.js'),
      'utf8'
    );
    const code = src
      .split('\n')
      .filter((l) => !/^\s*\*|^\s*\/\*|^\s*\/\//.test(l))
      .join('\n');

    assert.match(
      code,
      /mkdtempSync\(\s*path\.join\(\s*os\.tmpdir\(\)/,
      'migrate-components.test.js no longer creates a scratch root under os.tmpdir()'
    );
    assert.doesNotMatch(
      code,
      /path\.join\(__dirname,\s*'test-/,
      'a fixture root moved back inside the repo. createBackup() writes to the PARENT of ' +
        'its target, so an in-repo fixture puts .component-backup-* into scripts/__tests__/ ' +
        'where no afterEach in that file removes it.'
    );
  });
});
