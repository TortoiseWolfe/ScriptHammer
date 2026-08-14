#!/usr/bin/env node
/**
 * Decide whether a change needs the local E2E lane to run (#575 Phase 3).
 *
 * WHY THIS IS NOT A `paths-ignore:` ON THE TRIGGER. `e2e-local.yml` is about to run on every
 * PR, and Phase 5 makes its aggregate a REQUIRED check. A required check that never reports
 * is **pending forever**, not skipped — which is exactly why `Build` and
 * `Validate Component Structure` are deliberately absent from this repo's required set. A
 * `paths-ignore` would therefore make every docs-only PR permanently unmergeable.
 *
 * So the trigger stays unfiltered, this decides inside the workflow, and the aggregate job
 * reports SUCCESS when the matrix was skipped.
 *
 * THE IGNORE LIST IS READ FROM `e2e.yml`, NOT DUPLICATED. Two lanes with two hand-maintained
 * lists drift, and the drift is silent in the worst direction: a change that skips E2E on one
 * lane but runs it on the other, or a docs-only PR that hangs. Deriving means they cannot
 * disagree. `scripts/__tests__/e2e-paths-ignore.test.js` separately guards that list against
 * ever covering the build chain.
 *
 * USAGE
 *   node scripts/ci/e2e-local-changes.mjs <base-sha> <head-sha>   # writes run=… to GITHUB_OUTPUT
 *   node scripts/ci/e2e-local-changes.mjs --files a.md b.ts       # decide over an explicit list
 *   node scripts/ci/e2e-local-changes.mjs --selftest              # prove it can say both
 */

import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const E2E_WORKFLOW = resolve(ROOT, '.github', 'workflows', 'e2e.yml');

/**
 * Pull every `paths-ignore:` block out of a workflow. Strict on purpose: callers assert on
 * the count, so a parser that silently finds nothing fails loudly rather than returning [].
 */
export function readPathsIgnoreBlocks(yamlText) {
  const blocks = [];
  let current = null;
  let indent = 0;
  for (const line of yamlText.split('\n')) {
    const open = /^(\s*)paths-ignore:\s*$/.exec(line);
    if (open) {
      current = [];
      blocks.push(current);
      indent = open[1].length;
      continue;
    }
    if (!current) continue;
    const item = /^(\s*)-\s*(.+?)\s*$/.exec(line);
    if (item && item[1].length > indent) {
      current.push(item[2].replace(/^['"]|['"]$/g, ''));
    } else if (line.trim() !== '') {
      current = null;
    }
  }
  return blocks;
}

/**
 * GitHub's path-filter glob semantics. Hand-rolled because the naive
 * `split('**').join('.*')` gets `**\/*.md` wrong — it must also match a file at the root.
 */
export function matchesPattern(filePath, pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; ) {
    if (pattern.startsWith('**/', i)) {
      out += '(?:.*/)?'; // `**/` may match nothing at all
      i += 3;
    } else if (pattern.startsWith('**', i)) {
      out += '.*';
      i += 2;
    } else if (pattern[i] === '*') {
      out += '[^/]*';
      i += 1;
    } else {
      out += pattern[i].replace(/[.+^${}()|[\]\\]/, '\\$&');
      i += 1;
    }
  }
  return new RegExp('^' + out + '$').test(filePath);
}

/** True when at least one changed file is NOT covered by the ignore patterns. */
export function shouldRun(files, patterns) {
  return files.some((f) => !patterns.some((p) => matchesPattern(f, p)));
}

export function ignorePatterns(yamlText = readFileSync(E2E_WORKFLOW, 'utf8')) {
  const blocks = readPathsIgnoreBlocks(yamlText);
  if (!blocks.length) {
    throw new Error(
      'no paths-ignore block found in e2e.yml — the parser is stale, and silently ' +
        'returning an empty list would make every change look significant'
    );
  }
  // The blocks are asserted identical by scripts/__tests__/e2e-paths-ignore.test.js; take
  // the union anyway so a future divergence fails safe (runs) rather than skipping.
  return [...new Set(blocks.flat())];
}

function selftest() {
  const P = ['**/*.md', 'docs/**', '.gitignore'];
  const cases = [
    [['README.md'], false, 'root markdown is ignored'],
    [['docs/a/b.md'], false, 'nested docs are ignored'],
    [['docs/img.png'], false, 'anything under docs/ is ignored'],
    [['src/app/page.tsx'], true, 'source must run'],
    [['README.md', 'src/app/page.tsx'], true, 'a mixed change must run'],
    [['.gitignore'], false, 'exact match is ignored'],
    [['src/.gitignore'], true, 'an exact pattern must NOT match a nested path'],
    [[], false, 'no files means nothing to run'],
  ];
  let bad = 0;
  for (const [files, want, why] of cases) {
    const got = shouldRun(files, P);
    if (got !== want) {
      console.error(
        `  FAIL ${why}: ${JSON.stringify(files)} -> ${got}, want ${want}`
      );
      bad++;
    }
  }
  // And the real list must parse.
  const real = ignorePatterns();
  if (real.length < 3) {
    console.error(`  FAIL parsed only ${real.length} pattern(s) from e2e.yml`);
    bad++;
  }
  console.log(
    bad === 0
      ? `  selftest OK (${cases.length} cases, ${real.length} live patterns)`
      : `  selftest FAILED (${bad})`
  );
  process.exit(bad === 0 ? 0 : 1);
}

function main(argv) {
  if (argv[0] === '--selftest') selftest();

  let files;
  if (argv[0] === '--files') {
    files = argv.slice(1);
  } else {
    const [base, head] = argv;
    if (!base || !head) {
      console.error(
        'usage: e2e-local-changes.mjs <base-sha> <head-sha> | --files <paths…> | --selftest'
      );
      process.exit(2);
    }
    files = execFileSync('git', ['diff', '--name-only', `${base}`, `${head}`], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const patterns = ignorePatterns();
  const run = shouldRun(files, patterns);

  console.log(`  changed files: ${files.length}`);
  for (const f of files.slice(0, 25)) {
    console.log(
      `    ${patterns.some((p) => matchesPattern(f, p)) ? 'ignore' : 'RUN   '} ${f}`
    );
  }
  if (files.length > 25) console.log(`    … and ${files.length - 25} more`);
  console.log(`  decision: run=${run}`);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
  }
}

// ONLY WHEN RUN DIRECTLY. Without this guard, importing the module for its exports executes
// the CLI — which, with no argv, prints usage and calls process.exit(2), killing the
// importing process. That is exactly how the guard test first failed: the whole file aborted
// with no individual results rather than reporting an assertion.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  main(process.argv.slice(2));
}
