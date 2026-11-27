/**
 * Pull-request CI must build the site with the house band copied in (#1537).
 *
 * The band lives in a private repository and the deploy copies it over the checkout before the
 * build. Every other workflow builds the public tree without it, so a break that exists only once
 * the band is in place reaches main and fails the deploy. These tests pin the shape of the
 * workflow that closes that gap, because each way it can quietly stop working leaves every check
 * green:
 *
 *   - the trigger becomes `pull_request_target`, which hands the deploy key to a stranger's code;
 *   - the same-repo guard is dropped, so fork pull requests run a job that cannot read the key;
 *   - the overlay step moves below the build, or the build stops being run, so the job proves
 *     nothing about the overlay;
 *   - the job passes without the band because the overlay script exits 0 when it has no key.
 *
 * Comments are stripped before matching, because the workflow's own comments name these things.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(ROOT, '.github', 'workflows', 'band-overlay-build.yml');
const DEPLOY = path.join(ROOT, '.github', 'workflows', 'deploy.yml');

const strip = (text) =>
  text
    .split('\n')
    .map((l) => l.replace(/^(\s*)#.*$/, '$1').replace(/\s+#\s.*$/, ''));

const lines = strip(fs.readFileSync(FILE, 'utf8'));
const text = lines.join('\n');

/** The text of one step, from its `- name:` line to the next step, in a given file's lines. */
function stepIn(allLines, name) {
  const start = allLines.findIndex((l) => l.includes(`- name: ${name}`));
  assert.ok(start >= 0, `no step named "${name}"`);
  let end = allLines.findIndex((l, i) => i > start && /^\s*- name:/.test(l));
  if (end < 0) end = allLines.length;
  return { start, text: allLines.slice(start, end).join('\n') };
}
const step = (name) => stepIn(lines, name);

describe('band-overlay-build.yml', () => {
  it('runs on pull_request, never pull_request_target, and has no paths filter', () => {
    assert.match(text, /^on:\n\s+pull_request:/m);
    assert.doesNotMatch(text, /pull_request_target/);
    assert.doesNotMatch(text, /^\s+paths(-ignore)?:/m);
  });

  it('runs only for pull requests from this repository, and not for Dependabot', () => {
    assert.match(
      text,
      /if: github\.event\.pull_request\.head\.repo\.full_name == github\.repository/
    );
    assert.match(text, /github\.actor != 'dependabot\[bot\]'/);
  });

  it('has a timeout and cancels a superseded run', () => {
    assert.match(text, /timeout-minutes: \d+/);
    assert.match(text, /cancel-in-progress: true/);
  });

  it('fails, rather than passes, when the deploy key is not available', () => {
    const req = step('Require the band deploy key');
    assert.match(req.text, /\[ -z "\$BAND_DEPLOY_KEY" \]/);
    assert.match(req.text, /exit 1/);
    assert.match(
      req.text,
      /BAND_DEPLOY_KEY: \$\{\{ secrets\.BAND_DEPLOY_KEY \}\}/
    );
  });

  it('brings the band in with the deploy script, and confirms the band is there, before the build', () => {
    const overlay = step('Bring in the house band');
    const confirm = step('Confirm the band is in place');
    const build = step('Build Next.js app');
    assert.match(overlay.text, /bash scripts\/ci\/band-overlay\.sh/);
    assert.match(
      overlay.text,
      /BAND_DEPLOY_KEY: \$\{\{ secrets\.BAND_DEPLOY_KEY \}\}/
    );
    assert.match(confirm.text, /test -f src\/app\/band\/page\.tsx/);
    assert.ok(overlay.start < confirm.start && confirm.start < build.start);
  });

  it('runs the same build and the two post-build checks the deploy runs, in the same order', () => {
    const build = step('Build Next.js app');
    const chunks = step('Verify chunks parse in a browser (#294)');
    const budget = step('Verify three.js is off non-3D routes (#291)');
    assert.match(build.text, /run: pnpm run build/);
    assert.match(chunks.text, /node scripts\/check-chunks-parse\.mjs/);
    assert.match(budget.text, /node scripts\/check-first-load-budget\.mjs/);
    assert.ok(build.start < chunks.start && chunks.start < budget.start);

    // The deploy is the thing this job mirrors: if one of these commands changes there, it must
    // change here, or this job stops predicting the deploy.
    const dl = strip(fs.readFileSync(DEPLOY, 'utf8'));
    assert.match(
      stepIn(dl, 'Verify chunks parse in a browser (#294)').text,
      /node scripts\/check-chunks-parse\.mjs/
    );
    assert.match(
      stepIn(dl, 'Verify three.js is off non-3D routes (#291)').text,
      /node scripts\/check-first-load-budget\.mjs/
    );
    assert.match(stepIn(dl, 'Build Next.js app').text, /run: pnpm run build/);
  });

  it('reads no service role key', () => {
    assert.doesNotMatch(text, /SERVICE_ROLE/);
  });
});
