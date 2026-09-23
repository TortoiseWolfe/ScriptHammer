/**
 * Every Playwright directory is excluded from Vitest (#1209).
 *
 * WHAT HAPPENED. The #1209 probe was placed in `tests/idb/` rather than `tests/e2e/`, on
 * purpose — `playwright-env-forwarding.test.js` walks `tests/e2e/**` and would have
 * required the runner's env filter to be extended for a spec that reads no env at all.
 * `vitest.config.ts` excluded `tests/e2e/**` and nothing else, so Vitest collected a
 * Playwright spec and the REQUIRED `Test (20.x)` check went red with:
 *
 *   Playwright Test did not expect test.beforeEach() to be called here.
 *   Most common reasons include: ... You have two different versions of @playwright/test.
 *
 * That message names neither the runner nor the directory, and its own list of "most
 * common reasons" points at a duplicate install — so the obvious next move is to go
 * hunting through the dependency tree for a problem that does not exist.
 *
 * WHY THIS IS DERIVED AND NOT A LIST. The exclude was a hardcoded `tests/e2e/**` and it
 * was correct on the day it was written. It stopped being correct the moment a second
 * Playwright directory existed, and nothing said so. This reads the test directory out of
 * every root `playwright*.config.ts`, the same way `playwright-env-forwarding.test.js`
 * derives its variable list, so adding a config is enough — remembering is not required.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');

/** `testDir` from every root-level playwright config. */
function playwrightTestDirs() {
  const configs = fs
    .readdirSync(ROOT)
    .filter((f) => /^playwright.*\.config\.ts$/.test(f));
  assert.ok(
    configs.length > 0,
    'found no playwright*.config.ts at the repo root — re-point this guard rather than ' +
      'deleting it; a vacuous pass here is how the original defect shipped'
  );
  const dirs = new Set();
  for (const file of configs) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(/testDir:\s*'([^']+)'/g)) {
      dirs.add(m[1].replace(/^\.\//, '').replace(/\/$/, ''));
    }
  }
  assert.ok(
    dirs.size > 0,
    'parsed no testDir from any playwright config — the shape changed, re-point this guard'
  );
  return [...dirs];
}

describe('Playwright directories are excluded from Vitest (#1209)', () => {
  it('every playwright testDir appears in vitest.config.ts exclude', () => {
    const vitest = fs.readFileSync(path.join(ROOT, 'vitest.config.ts'), 'utf8');

    // LINE-WISE, NOT A BLOCK-COMMENT STRIP. The obvious `/\/\*[\s\S]*?\*\//` pass
    // DESTROYS this file: a glob like 'scripts/**/*.test.js' contains `/*` and
    // '**/.component-backup-*/**' contains `*/`, so the regex treats everything between
    // two unrelated globs as one comment and deletes the entire exclude array. The guard
    // then reported every directory missing — including `tests/e2e/**`, which has been
    // there for months. Dropping whole comment lines is enough: an entry is real when it
    // appears on a line that is not itself a comment.
    // SCOPE TO THE TEST-LEVEL `exclude` ARRAY, not the whole file. `vitest.config.ts`
    // has a SECOND exclude under `coverage`, and that one contains a bare 'tests/**'.
    // Searching the file as a whole made every Playwright directory look covered by it —
    // the guard passed its own mutations, which is how this was caught. Coverage exclusion
    // says nothing about whether Vitest COLLECTS a file.
    const start = vitest.indexOf('exclude: [');
    assert.ok(
      start > -1,
      'vitest.config.ts has no exclude array — re-point this guard'
    );
    const end = vitest.indexOf(']', start);
    assert.ok(end > start, 'could not find the end of the exclude array');
    const excludeBlock = vitest.slice(start, end);

    const realLines = excludeBlock
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));

    for (const dir of playwrightTestDirs()) {
      // A directory is covered by its own entry OR by any ancestor's: `tests/e2e/smoke`
      // is a real testDir (playwright.smoke.config.ts) and is already excluded by
      // `tests/e2e/**`. Demanding an exact entry would force a redundant line and fail
      // on a configuration that is correct.
      const candidates = [];
      const parts = dir.split('/');
      for (let i = parts.length; i > 0; i -= 1) {
        candidates.push(parts.slice(0, i).join('/'));
      }
      assert.ok(
        candidates.some((c) => realLines.some((l) => l.includes(`'${c}/**'`))),
        `vitest.config.ts does not exclude '${dir}/**', so Vitest will collect the ` +
          'Playwright specs there and the REQUIRED Test (20.x) check fails with ' +
          '"did not expect test.beforeEach() to be called here" — a message that blames ' +
          'a duplicate @playwright/test install and never mentions the directory (#1209).'
      );
    }
  });
});
