/**
 * `e2e-local.yml` runs on every PR (#575 Phase 3), and its aggregate becomes a REQUIRED
 * check in Phase 5. Three properties make that safe, and every one of them fails silently.
 *
 * 1. NO `paths`/`paths-ignore` ON THE TRIGGERS. A required check that never reports is
 *    **pending forever**, not skipped — which is exactly why `Build` and
 *    `Validate Component Structure` are deliberately absent from this repo's required set.
 *    Adding a path filter here would make every docs-only PR permanently unmergeable, and
 *    nothing would go red to say so: the PR would simply sit there.
 *
 * 2. THE AGGREGATE MUST RUN AND PASS WHEN THE MATRIX IS SKIPPED. Branch protection is not
 *    satisfied by a `skipped` job, so the job cannot be gated — only its STEPS can. Miss one
 *    step and the job fails on artifacts no matrix produced, blocking docs-only PRs for
 *    having changed documentation.
 *
 * 3. THE IGNORE LIST IS DERIVED FROM `e2e.yml`, NOT COPIED. Two lanes with two lists drift
 *    in the worst direction — a change that skips E2E on one lane and runs it on the other.
 *
 * Modelled on `e2e-paths-ignore.test.js`: assert the parser found something before asserting
 * about contents, and carry a control proving the comparator can fail.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LOCAL_WF = path.join(REPO_ROOT, '.github', 'workflows', 'e2e-local.yml');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'ci', 'e2e-local-changes.mjs');
const GATE = "needs.changes.outputs.run == 'true'";

const yaml = fs.readFileSync(LOCAL_WF, 'utf8');

/** The `on:` block only — trigger-level path filters are the dangerous ones. */
function triggerBlock(text) {
  const start = text.search(/^on:\s*$/m);
  if (start === -1) return '';
  const rest = text.slice(start);
  const end = rest.search(/^jobs:\s*$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('e2e-local.yml runs on every PR without trapping docs-only ones (#575)', () => {
  it('the parser found the workflow it is asserting about', () => {
    // Without this every assertion below could pass vacuously on an empty read.
    assert.ok(
      yaml.length > 2000,
      'e2e-local.yml is suspiciously small — stale path?'
    );
    assert.ok(
      /^jobs:\s*$/m.test(yaml),
      'no jobs: block found — the parser is stale and nothing below means anything'
    );
    assert.ok(triggerBlock(yaml).length > 0, 'no on: block found');
  });

  it('no path filter on any trigger — that is the pending-forever trap', () => {
    const on = triggerBlock(yaml);
    const filters = [...on.matchAll(/^\s*(paths|paths-ignore):/gm)].map(
      (m) => m[1]
    );
    assert.deepStrictEqual(
      filters,
      [],
      'e2e-local.yml gained a trigger path filter. Once its aggregate is a required ' +
        'check, a filtered-out PR never reports and sits PENDING FOREVER rather than ' +
        'passing. Filter inside the `changes` job instead.'
    );
  });

  it('the matrix is gated on the changes job, so docs-only PRs cost nothing', () => {
    assert.ok(
      /e2e-local:[\s\S]*?needs:\s*changes/.test(yaml),
      'the matrix no longer depends on `changes` — every docs typo would run 24 jobs'
    );
    assert.ok(
      yaml.includes(`if: ${GATE}`),
      `the matrix is not gated on \`${GATE}\``
    );
  });

  it('EVERY step of the aggregate is gated, so it passes when nothing ran', () => {
    // The job itself must NOT be gated: branch protection is not satisfied by a `skipped`
    // job. It has to run and pass, which means each step carries the condition.
    const start = yaml.indexOf('  parity:');
    assert.ok(start > 0, 'aggregate job `parity:` not found');
    const block = yaml.slice(start);
    const steps = [...block.matchAll(/^      - (?:name:|uses:)/gm)];
    assert.ok(
      steps.length >= 3,
      `expected the aggregate to have steps, found ${steps.length}`
    );

    const gated = (
      block.match(
        new RegExp(`if: ${GATE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
      ) ?? []
    ).length;
    const negGated = (
      block.match(/if: needs\.changes\.outputs\.run != 'true'/g) ?? []
    ).length;
    assert.strictEqual(
      gated + negGated,
      steps.length,
      `aggregate has ${steps.length} steps but only ${gated + negGated} are gated. An ` +
        'ungated step runs when the matrix was skipped, fails on missing artifacts, and ' +
        'blocks every docs-only PR.'
    );
    assert.ok(
      negGated >= 1,
      'no step reports the "nothing to run" case — the job would pass silently, with no ' +
        'log saying why it did nothing'
    );
  });

  it('the decision script is wired in, and derives the list from e2e.yml', () => {
    assert.ok(
      fs.existsSync(SCRIPT),
      'scripts/ci/e2e-local-changes.mjs is missing'
    );
    assert.ok(
      yaml.includes('scripts/ci/e2e-local-changes.mjs'),
      'the changes job does not call the decision script'
    );
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.ok(
      src.includes("'e2e.yml'") || src.includes('e2e.yml'),
      'the script no longer reads e2e.yml — the two lanes can now drift apart'
    );
  });

  it('the decision script agrees with the real ignore list', async () => {
    const mod = await import(`file://${SCRIPT}`);
    const patterns = mod.ignorePatterns();
    assert.ok(
      patterns.length >= 3,
      `parsed only ${patterns.length} ignore pattern(s) from e2e.yml — parser is stale`
    );
    assert.ok(
      patterns.includes('**/*.md'),
      'markdown missing from the parsed ignore list'
    );

    // Docs-only skips; anything touching code runs.
    assert.strictEqual(
      mod.shouldRun(['README.md', 'docs/x.md'], patterns),
      false
    );
    assert.strictEqual(mod.shouldRun(['src/app/page.tsx'], patterns), true);
    assert.strictEqual(
      mod.shouldRun(['README.md', 'src/app/page.tsx'], patterns),
      true,
      'a mixed change must run — one code file is enough'
    );
  });

  it('the control can fail — the matcher discriminates', async () => {
    // Guards the guard. If `matchesPattern` stopped discriminating, every assertion above
    // would be decorative.
    const mod = await import(`file://${SCRIPT}`);
    assert.strictEqual(mod.matchesPattern('docs/a/b.md', '**/*.md'), true);
    assert.strictEqual(
      mod.matchesPattern('src/app/page.tsx', '**/*.md'),
      false
    );
    // The classic bug this repo already documented: `**/x` must also match x at the root.
    assert.strictEqual(mod.matchesPattern('README.md', '**/*.md'), true);
    // …and an exact pattern must NOT match a nested path.
    assert.strictEqual(
      mod.matchesPattern('src/.gitignore', '.gitignore'),
      false
    );
  });
});
