/**
 * The scheduled orphan sweep must not delete without a deliberate change (#560, T023).
 *
 * The sweep removes files a customer sent and cannot resend, and there is no undo. Its
 * safety rests on one property: the SCHEDULE runs in `report` mode, so a wrong orphan
 * rule produces a wrong list rather than a wrong deletion.
 *
 * That property is one word in a YAML default. Nothing else would notice it changing —
 * flipping `report` to `delete` is a two-character edit that turns a listing job into a
 * destructive one, and every test in the suite would stay green. This is the test that
 * goes red.
 *
 * Flipping to `delete` is the intended end state, once the reports have been read. When
 * that happens this test is what makes it a decision somebody made on purpose, in a diff
 * with a reason, rather than something that drifted.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const WORKFLOW = path.join(
  ROOT,
  '.github',
  'workflows',
  'intake-orphan-sweep.yml'
);
const FUNCTION = path.join(
  ROOT,
  'supabase',
  'functions',
  'sweep-intake-orphans',
  'index.ts'
);

const workflow = () => fs.readFileSync(WORKFLOW, 'utf8');
const fn = () => fs.readFileSync(FUNCTION, 'utf8');

describe('the orphan sweep is report-only by default (#560 T023)', () => {
  it('both files exist and are non-trivial', () => {
    // Non-vacuity: if either path were wrong, every assertion below would pass
    // against an empty string — the #396 shape.
    assert.ok(workflow().length > 500, 'workflow is missing or truncated');
    assert.ok(fn().length > 500, 'edge function is missing or truncated');
  });

  it('the scheduled run asks for report mode', () => {
    const line = workflow()
      .split('\n')
      .find((l) => l.includes('MODE:') && !l.trim().startsWith('#'));

    assert.ok(line, 'no MODE assignment found in the workflow');
    assert.match(
      line,
      /\|\|\s*'report'/,
      `the scheduled sweep does not default to report mode: ${line.trim()}\n` +
        `This job deletes customer uploads with no undo. Running it in 'delete' on a ` +
        `schedule is a deliberate decision that belongs in a diff with a reason.`
    );
  });

  it('the function itself defaults to report when asked for nothing', () => {
    // Defence in depth: the workflow could be bypassed by calling the function
    // directly, so an absent `mode` must not mean "delete everything you found".
    assert.match(
      fn(),
      /searchParams\.get\('mode'\)\s*\?\?\s*'report'/,
      'the edge function does not default to report mode'
    );
  });

  it('the function refuses anything but the service role', () => {
    // It enumerates and removes other people's files. Reachable with a user token,
    // it is a way to delete another buyer's attachments.
    assert.match(
      fn(),
      /presented !== serviceKey/,
      'the sweep does not compare the caller against the service-role key'
    );
    assert.match(fn(), /service role required/, 'no 401 refusal path found');
  });

  it('the detectors can actually fail', () => {
    // Controls. A matcher that accepted anything would never catch the flip.
    const modeOk = /\|\|\s*'report'/;
    assert.equal(modeOk.test("          MODE: ${{ x || 'report' }}"), true);
    assert.equal(modeOk.test("          MODE: ${{ x || 'delete' }}"), false);

    const fnOk = /searchParams\.get\('mode'\)\s*\?\?\s*'report'/;
    assert.equal(fnOk.test("url.searchParams.get('mode') ?? 'report'"), true);
    assert.equal(fnOk.test("url.searchParams.get('mode') ?? 'delete'"), false);
  });
});
