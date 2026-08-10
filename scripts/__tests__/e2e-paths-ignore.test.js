/**
 * e2e.yml's `paths-ignore` decides which changes SKIP the E2E suite.
 *
 * Widening it is a silent failure mode: nothing goes red, the suite just quietly
 * stops running on changes that should trigger it. That is the exact shape of
 * #348 (CSS shipped as <script>) and #548 (prod served with no CSS) — both were
 * produced by the build chain, and both would have been invisible if a change to
 * that chain had skipped E2E.
 *
 * So this test does not check a hardcoded list. It reads the ACTUAL build chain
 * out of package.json (`prebuild` + `build`) and asserts that no script the build
 * depends on can ever be matched by an ignore pattern. Add a script to prebuild
 * and this test starts protecting it automatically.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'e2e.yml');
const PKG = path.join(REPO_ROOT, 'package.json');

/**
 * Pull every `paths-ignore:` block out of the workflow.
 * Deliberately strict: callers assert on the count, so a parser that silently
 * finds nothing fails the suite instead of passing it.
 */
function readPathsIgnoreBlocks(yamlText) {
  const lines = yamlText.split('\n');
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (/^\s*paths-ignore:\s*$/.test(line)) {
      current = [];
      blocks.push(current);
      continue;
    }
    if (current === null) continue;

    const entry = line.match(/^\s*-\s*'([^']+)'\s*$/);
    if (entry) {
      current.push(entry[1]);
      continue;
    }
    // A comment inside the list is fine; anything else ends the block.
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    current = null;
  }
  return blocks;
}

/** Every `scripts/...` path the prebuild+build chain actually invokes. */
function buildChainScripts() {
  const { scripts } = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  const chain = [scripts.prebuild, scripts.build, scripts.postbuild]
    .filter(Boolean)
    .join(' && ');
  const found = chain.match(/scripts\/[\w./-]+/g) || [];
  return [...new Set(found)];
}

/**
 * Approximate GitHub's glob semantics closely enough to catch a widened rule.
 *
 * The subtlety that matters: in GitHub's implementation `**` matches the EMPTY
 * string, so `'**\/*.md'` matches root-level `README.md`, not just
 * `docs/thing.md`. Verified against PR #554, which changed only root-level
 * README.md and produced zero E2E runs.
 *
 * A naive `split('**').join('.*')` gets this wrong — it compiles to `.*\/...`,
 * which requires a slash and therefore reports root-level markdown as
 * TRIGGERING E2E when it does not. That direction is the dangerous one: it makes
 * the ignore list look narrower than it is, so a genuinely over-wide pattern
 * could slip past the assertions below.
 */
function matches(filePath, pattern) {
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

describe('e2e.yml paths-ignore', () => {
  const yamlText = fs.readFileSync(WORKFLOW, 'utf8');
  const blocks = readPathsIgnoreBlocks(yamlText);

  it('finds exactly two paths-ignore blocks (push and pull_request)', () => {
    // If this fails the parser is broken, and every assertion below would have
    // passed vacuously. That is the failure mode this test exists to avoid.
    assert.strictEqual(
      blocks.length,
      2,
      `expected 2 paths-ignore blocks, found ${blocks.length}`
    );
  });

  it('keeps the two blocks in sync', () => {
    assert.deepStrictEqual(
      blocks[0],
      blocks[1],
      'push and pull_request paths-ignore have drifted apart — a change that ' +
        'skips E2E on a PR but runs it on main (or vice versa) is a trap'
    );
  });

  it('never ignores a script the build chain depends on', () => {
    const patterns = blocks[0];
    const critical = buildChainScripts();

    assert.ok(
      critical.length > 0,
      'parsed zero scripts out of prebuild/build — the extractor is broken'
    );

    const swallowed = critical.filter((f) =>
      patterns.some((p) => matches(f, p))
    );

    assert.deepStrictEqual(
      swallowed,
      [],
      `paths-ignore would skip E2E for build-chain scripts: ${swallowed.join(', ')}. ` +
        'These run in prebuild/build and can break the browser output (#348, #548). ' +
        'Name individual files instead of globbing a directory.'
    );
  });

  it('detects a widened pattern — the control must be able to fail', () => {
    // Guards the guard. If `scripts/**` stopped registering as dangerous, the
    // assertion above would be decorative.
    const critical = buildChainScripts();
    const swallowed = critical.filter((f) => matches(f, 'scripts/**'));
    assert.ok(
      swallowed.length > 0,
      'a blanket scripts/** should swallow build-chain scripts; if it no longer ' +
        'does, this matcher is broken and the real assertion proves nothing'
    );
  });

  it('matches GitHub semantics for `**/` at the start of a pattern', () => {
    // Regression guard. `**` matches the empty string in GitHub's globber, so
    // `**/*.md` covers root-level files. Confirmed empirically: PR #554 changed
    // only README.md and produced ZERO E2E runs.
    //
    // Getting this wrong understates what the ignore list already covers, which
    // would let an over-wide pattern pass the build-chain assertion above.
    assert.ok(
      matches('README.md', '**/*.md'),
      '**/*.md must match root-level md'
    );
    assert.ok(
      matches('CONTRIBUTING.md', '**/*.md'),
      'ditto for CONTRIBUTING.md'
    );
    assert.ok(matches('docs/thing.md', '**/*.md'), 'and nested md');
    assert.ok(!matches('src/app/page.tsx', '**/*.md'), 'but not non-md');
  });

  it('still ignores the repo tooling E2E cannot reach', () => {
    const patterns = blocks[0];
    for (const f of [
      'scripts/audit-components.js',
      'scripts/validate-structure.js',
      'scripts/rebrand.sh',
      'scripts/supabase/set-edge-function-secrets.ts',
      'scripts/__tests__/foo.test.js',
      'tests/rebrand/test-rebrand.sh',
    ]) {
      assert.ok(
        patterns.some((p) => matches(f, p)),
        `${f} should be ignored — no Playwright spec references it and it is not in the build chain`
      );
    }
  });
});
