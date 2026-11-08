/**
 * The local E2E lane copies every `TEST_USER_*` line from the tracked `.env.local-supabase`
 * into `$GITHUB_ENV`, and later steps print their env block in the public run log. GitHub
 * only hides values that are stored repository secrets, so the three test passwords came
 * out in clear text (45 copies in one saved log on 7 Nov). `::add-mask::` before the copy
 * hides them. The same reasoning applies to the signup-mailer password, which used to be
 * a literal in the workflow and now comes from a repository secret.
 *
 * Both checks read the workflow text and print names only, never a password value.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOWS = path.resolve(__dirname, '..', '..', '.github', 'workflows');
const read = (name) => fs.readFileSync(path.join(WORKFLOWS, name), 'utf8');

/** Every step that appends TEST_USER_ lines to $GITHUB_ENV, as the text of its run block. */
function copyingSteps(text) {
  return text
    .split(/^\s*- name: /m)
    .filter((step) => /TEST_USER_\)' \.env\.local-supabase >> "\$GITHUB_ENV"/.test(step));
}

describe('e2e-local.yml masks the test passwords', () => {
  const steps = copyingSteps(read('e2e-local.yml'));

  it('finds the steps that copy TEST_USER_ lines (parser control)', () => {
    assert.ok(steps.length >= 2, `expected the build and run jobs, found ${steps.length}`);
  });

  it('adds a mask before every copy into $GITHUB_ENV', () => {
    for (const step of steps) {
      const mask = step.indexOf('::add-mask::');
      const copy = step.indexOf('>> "$GITHUB_ENV"');
      assert.ok(mask !== -1, 'a step copies TEST_USER_ lines with no ::add-mask::');
      assert.ok(mask < copy, 'the mask must come before the copy into $GITHUB_ENV');
    }
  });

  it('control: a step without the mask is caught', () => {
    const bare = `grep -E '^(TEST_USER_)' .env.local-supabase >> "$GITHUB_ENV"`;
    assert.strictEqual(bare.indexOf('::add-mask::'), -1);
  });
});

describe('signup-mailer.yml keeps no password literal', () => {
  it('reads the primary test password from a repository secret', () => {
    const lines = read('signup-mailer.yml')
      .split('\n')
      .filter((l) => /^\s*TEST_USER_[A-Z_]*PASSWORD:/.test(l));
    assert.ok(lines.length >= 1, 'parser control: no TEST_USER_*PASSWORD line found');
    for (const line of lines) {
      assert.match(line, /\$\{\{\s*secrets\.TEST_USER_[A-Z_]*PASSWORD\s*\}\}/);
    }
  });
});
