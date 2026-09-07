/**
 * No test may build its fixture tree inside `scripts/` (#1109).
 *
 * WHY. `no-upstream-domain-fallbacks.test.js` walks all of `scripts/` recursively to prove
 * the #1054 sweep is not vacuous, and `node --test` runs files concurrently. A fixture
 * directory created and torn down inside `scripts/` races that walk: `readdirSync` reports a
 * directory, the walk recurses, and the directory is gone — ENOENT, and the whole file fails.
 *
 * WHY IT SURVIVED SO LONG. The failure names the innocent party. Observed twice on
 * 2026-09-07, blaming `no-upstream-domain-fallbacks.test.js` for
 * `fixtures/test-project/src/components/atomic/Card` and then for
 * `test-bare-components/Widget` — neither of which that file has anything to do with. Run
 * alone it passes 7/7; re-run the suite and it passes 882/882. Everything about it says
 * "flake, re-run", which is why it was dismissed rather than fixed.
 *
 * WHY A GUARD AND NOT JUST THE FIX. Ten fixture roots across five files were moved to
 * `os.tmpdir()`. Nothing stopped an eleventh being added, and the next one would present as
 * the same misattributed flake.
 *
 * WHAT THIS DOES NOT CATCH, stated so nobody trusts it further than it goes: a path built
 * through indirection (a helper, a template literal, a variable reassigned later) is invisible
 * to it. It catches the shape every real instance actually used — `const dir =
 * path.join(__dirname, 'name')` followed by `mkdirSync(dir)` — and it is a floor, not a proof.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const TESTS = path.resolve(__dirname);

/** Every test file under scripts/__tests__, including the integration and contract subdirs. */
function testFiles(dir = TESTS, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) testFiles(full, out);
    else if (e.name.endsWith('.test.js')) out.push(full);
  }
  return out;
}

/**
 * Strip comments before matching.
 *
 * Not optional. This repo has burned four guards that matched their own explanatory prose and
 * passed with the code deleted — including one in this very directory. The header above names
 * `mkdirSync` and `__dirname` repeatedly; without this, every file would flag itself.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Directory variables assigned from `path.join(__dirname, …)` that are then handed to a
 * directory-creating call. Returns the variable names, which is what a failure should name.
 */
function offendingRoots(src) {
  const code = stripComments(src);
  const declared = new Map();
  const decl =
    /\b(?:const|let|var)\s+(\w+)\s*=\s*path\.join\(\s*__dirname\s*,([\s\S]{0,120}?)\)\s*;/g;
  let m;
  while ((m = decl.exec(code)) !== null) declared.set(m[1], m[2].trim());

  const offenders = [];
  for (const [name, arg] of declared) {
    const created = new RegExp(
      `\\b(?:mkdirSync|mkdtempSync|cpSync|rmSync)\\(\\s*${name}\\b`
    ).test(code);
    if (!created) continue;
    // A dot-directory cannot race: the walk skips anything starting with '.'
    // (no-upstream-domain-fallbacks.test.js:75, `e.name.startsWith('.')`). This is a true
    // positive by pattern and a false one by consequence, so it is excluded HERE with the
    // reason attached, rather than by loosening the pattern above.
    if (/['"`]\./.test(arg)) continue;
    offenders.push(`${name} = path.join(__dirname, ${arg})`);
  }
  return offenders;
}

describe('test fixtures stay out of scripts/ (#1109)', () => {
  it('finds test files to scan, so the sweep is not vacuous', () => {
    // ANTI-VACUITY. If the walk broke, every assertion below would pass by inspecting nothing
    // — which is the same species of defect this file guards against.
    const files = testFiles();
    assert.ok(
      files.length > 40,
      `only ${files.length} test files scanned — the walk is broken, not the tests`
    );
  });

  it('no test builds a fixture directory under scripts/', () => {
    const bad = [];
    for (const file of testFiles()) {
      // This file carries deliberate specimens of the offending shape, in the counterweight
      // tests below. Scanning itself would make the guard permanently red and invite someone
      // to weaken the pattern to silence it — which is how a guard becomes decoration.
      if (path.basename(file) === path.basename(__filename)) continue;
      const roots = offendingRoots(fs.readFileSync(file, 'utf8'));
      for (const r of roots) bad.push(`${path.relative(TESTS, file)}: ${r}`);
    }

    assert.deepStrictEqual(
      bad,
      [],
      'A test creates its fixture tree inside scripts/, which races the recursive walk in ' +
        'no-upstream-domain-fallbacks.test.js and fails that file with an ENOENT naming a ' +
        'path it has nothing to do with (#1109).\n\n' +
        'Use a scratch root instead, as migrate-components.test.js does:\n' +
        "  const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), '<name>-'));\n\n" +
        `Offenders:\n  ${bad.join('\n  ')}`
    );
  });

  it('the comment stripper works, or this guard reads its own prose', () => {
    // The mutation that matters. This file's own header contains `mkdirSync` and
    // `path.join(__dirname`; if stripping regressed, the guard would flag itself and every
    // other well-documented file, and someone would "fix" it by weakening the pattern.
    const withComment = `
      /* const decoy = path.join(__dirname, 'x'); mkdirSync(decoy); */
      const real = path.join(os.tmpdir(), 'y');
    `;
    assert.deepStrictEqual(offendingRoots(withComment), []);
  });

  it('the pattern actually fires on the shape it targets', () => {
    // Counterweight to the above: proves the matcher is not simply inert.
    const offending = `
      const testDir = path.join(__dirname, 'test-components');
      fs.mkdirSync(testDir, { recursive: true });
    `;
    assert.deepStrictEqual(offendingRoots(offending), [
      "testDir = path.join(__dirname, 'test-components')",
    ]);
  });
});
