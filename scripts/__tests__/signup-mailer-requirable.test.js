/**
 * `Signup Mailer E2E` must stay REQUIRABLE — i.e. it must always report
 * (#870, pattern established for Conformance in #869).
 *
 * WHAT WENT WRONG. The workflow carried a trigger `paths:` filter, so it reported nothing
 * on an unrelated PR. A required check that never reports is **pending forever**, not
 * skipped, so it could not be required — the pattern #572 catalogued, in which only two
 * of thirteen workflows could actually block a merge.
 *
 * WHY THIS SUITE PARTICULARLY. It is the only coverage of a REAL form signup against a
 * real mailbox. #288 exists because every suite was green while no human could actually
 * sign up on production — this is the check that would have caught that, and it could not
 * block anything.
 *
 * WHAT THIS PINS. The three properties that together make the workflow requirable:
 *   1. no trigger `paths:` filter, so it always reports;
 *   2. an aggregate job that runs `if: always()`, so it reports even when the suite is
 *      skipped or cancelled;
 *   3. the aggregate does not treat a cancelled suite as a pass.
 *
 * WHAT IT CANNOT CHECK: that branch protection actually requires the context. That lives
 * in a GitHub setting, not this repo — `required-checks-documented.test.js` reconciles
 * the documented set against the live one.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'signup-mailer.yml');
const DECIDER = path.join(ROOT, 'scripts', 'ci', 'signup-mailer-changes.mjs');

function workflow() {
  return fs.readFileSync(WORKFLOW, 'utf8');
}

/** The `on:` block only — a `paths:` deeper in the file is a job input, not a trigger. */
function triggerBlock(src) {
  const start = src.search(/^on:$/m);
  assert.ok(start !== -1, 'no `on:` block found in signup-mailer.yml');
  const rest = src.slice(start + 3);
  const end = rest.search(/^\S/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('Signup Mailer can be a required check (#870)', () => {
  it('reads the workflow and finds a real trigger block', () => {
    // Non-vacuity. Every assertion below is over this text; if the parse breaks they all
    // pass against nothing, which is the shape this file exists to prevent.
    const on = triggerBlock(workflow());
    assert.match(on, /pull_request:/, 'trigger block has no pull_request');
    assert.match(on, /push:/, 'trigger block has no push');
  });

  it('has NO trigger paths filter', () => {
    const on = triggerBlock(workflow());
    assert.ok(
      !/^\s+paths:/m.test(on),
      'signup-mailer.yml has a trigger `paths:` filter again. That makes it report ' +
        'NOTHING on an unrelated PR, and a required check that never reports is ' +
        'PENDING FOREVER — so the check cannot be required, which is how Conformance ' +
        'stayed red across six merges (#572). Filter inside the `changes` job instead.'
    );
  });

  it('has an aggregate job that reports even when the suite does not run', () => {
    const src = workflow();
    assert.match(
      src,
      /^\s{2}result:/m,
      'no `result:` aggregate job — without one there is no context that always reports'
    );
    const result = src.slice(src.search(/^\s{2}result:/m));
    assert.match(
      result,
      /if:\s*always\(\)/,
      'the `result` job is not `if: always()`, so it is skipped when the suite is ' +
        'skipped — and a skipped required check is pending forever'
    );
    assert.match(
      result,
      /needs:\s*\[changes,\s*signup-mailer\]/,
      'the `result` job must depend on both the decider and the suite'
    );
  });

  it('does NOT treat a cancelled suite as a pass', () => {
    const src = workflow();
    const result = src.slice(src.search(/^\s{2}result:/m));
    // The whole family of defects here is a signal that reports success without
    // observing its subject. A cancelled run observed nothing.
    assert.ok(
      /success\)\s*echo[^\n]*exit 0/.test(result) &&
        /\*\)\s*echo[^\n]*exit 1/.test(result),
      'the `result` job must pass ONLY on success and fail on anything else. A ' +
        'cancelled run observed nothing, and calling that green is the #396 shape.'
    );
  });

  it('the decider can say both yes and no', async () => {
    // A gate that can only reach one answer is not a gate. Exercised through the real
    // module rather than a reimplementation of its rule.
    const { needsSignupMailer, SIGNUP_MAILER_PATHS } = await import(
      `file://${DECIDER}`
    );

    assert.ok(
      needsSignupMailer(['src/components/auth/SignUpForm/SignUpForm.tsx']),
      'a signup form change must require the suite'
    );
    assert.ok(
      needsSignupMailer(['tests/e2e/signup-mailer/whatever.spec.ts']),
      'a change to the suite itself must require it'
    );
    assert.ok(
      !needsSignupMailer(['README.md', 'src/components/atomic/Card/Card.tsx']),
      'unrelated UI must NOT require a 25-minute local-stack run'
    );
    assert.ok(SIGNUP_MAILER_PATHS.length > 8, 'the path list looks truncated');
  });

  it('covers the paths the old trigger filter missed', async () => {
    const { needsSignupMailer } = await import(`file://${DECIDER}`);
    // Each of these moves the verdict without touching anything the old filter named.
    for (const [f, why] of [
      [
        'src/config/captcha.config.ts',
        'turning captcha on makes the client demand a token local GoTrue never wanted (#353)',
      ],
      [
        'src/lib/auth/email-validator.ts',
        'decides whether the form submits at all',
      ],
      [
        'src/lib/supabase/client.ts',
        'session storage after the confirmation link (#845)',
      ],
      [
        'scripts/supabase/set-auth-config.ts',
        'the mailer URL paths the confirmation link depends on',
      ],
      [
        'pnpm-lock.yaml',
        'a dependency bump changes client behaviour with no source edit',
      ],
    ]) {
      assert.ok(needsSignupMailer([f]), `${f} must require the suite — ${why}`);
    }
  });
});
