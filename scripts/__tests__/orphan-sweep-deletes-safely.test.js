/**
 * The orphan sweep now deletes, so the things that keep it safe are load-bearing
 * (#560, T023).
 *
 * It shipped in `report` mode (#816) and was flipped on 2026-08-19 — but only after
 * the protective branch was OBSERVED working against production data. That evidence
 * could not have come from waiting: no order had ever referenced an attachment, so
 * every report said `referenced: 0` and the "don't delete a referenced file" path had
 * never executed. Reading more reports would have returned the same empty answer every
 * week. It was manufactured instead: a file was attached to an order, the report
 * re-run, and it showed `referenced 1` with that file absent from `orphans` while the
 * other was still found (run 32248897998).
 *
 * WHAT THIS FILE GUARDS. Three properties, each of which turns the sweep from a
 * cleanup job into a data-loss event if it goes:
 *
 *   1. the grace window is never zero — otherwise a buyer's upload is deleted while
 *      they are still filling in the form;
 *   2. a caller who names no mode gets `report`, so the endpoint cannot be made to
 *      delete by omission;
 *   3. only the service role can reach it, since it enumerates and removes other
 *      people's files.
 *
 * This replaces `orphan-sweep-is-report-only.test.js`, whose whole purpose was to make
 * this flip deliberate rather than accidental. It did its job; the name would now be a
 * lie, and a stale name outlives the thing it described.
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

/** The `MODE:` the scheduled run resolves to (comments ignored). */
function scheduledMode(yaml) {
  const line = yaml
    .split('\n')
    .find((l) => l.includes('MODE:') && !l.trim().startsWith('#'));
  const m = line && /\|\|\s*'([a-z]+)'/.exec(line);
  return m ? m[1] : null;
}

/** The default a human gets from the Run-workflow button. */
function dispatchDefault(yaml) {
  const block = /mode:\n(?:.*\n)*?\s*default:\s*'([a-z]+)'/.exec(yaml);
  return block ? block[1] : null;
}

describe('the orphan sweep deletes, and only safely (#560 T023)', () => {
  it('reads both files, so nothing below passes vacuously', () => {
    assert.ok(workflow().length > 500, 'workflow missing or truncated');
    assert.ok(fn().length > 500, 'edge function missing or truncated');
    assert.ok(scheduledMode(workflow()), 'could not parse the scheduled MODE');
  });

  it('the grace window can never be zero', () => {
    // THE assertion, now that deletion is live. `Number('')` is 0 and
    // `Number('abc')` is NaN; either would delete a file uploaded seconds ago —
    // NaN silently, through comparisons that are false in both directions. A
    // misconfigured secret has to degrade to the safe default, not to zero.
    const src = fn();
    assert.match(
      src,
      /Number\.isFinite\(raw\)\s*&&\s*raw\s*>=\s*1\s*\?\s*raw\s*:\s*7/,
      'INTAKE_ORPHAN_GRACE_DAYS is no longer floored. An empty or malformed value ' +
        'would make the grace window 0 or NaN, and the sweep would delete uploads ' +
        'that are minutes old.'
    );
  });

  it('a caller who names no mode gets report, not delete', () => {
    // Defence in depth: the workflow is not the only way to reach the function.
    assert.match(
      fn(),
      /searchParams\.get\('mode'\)\s*\?\?\s*'report'/,
      'the edge function no longer defaults to report — omitting `mode` would delete'
    );
  });

  it('a human running it by hand gets report', () => {
    // The scheduled job deletes; the Run-workflow button must not, or an operator
    // checking "what would this remove?" removes it.
    assert.equal(
      dispatchDefault(workflow()),
      'report',
      'workflow_dispatch no longer defaults to report'
    );
  });

  it('the scheduled run is the one that deletes', () => {
    // Pins the flip itself, so reverting it is also a deliberate act with a reason.
    assert.equal(
      scheduledMode(workflow()),
      'delete',
      'the schedule no longer deletes — if this is intentional, say why in the workflow'
    );
  });

  it('only the service role can reach it', () => {
    assert.match(
      fn(),
      /presented !== serviceKey/,
      'no service-role comparison'
    );
    assert.match(fn(), /service role required/, 'no 401 refusal path');
  });

  it('the detectors can actually fail', () => {
    // Controls in both directions.
    assert.equal(
      scheduledMode("          MODE: ${{ x || 'delete' }}"),
      'delete'
    );
    assert.equal(
      scheduledMode("          MODE: ${{ x || 'report' }}"),
      'report'
    );
    assert.equal(scheduledMode('# MODE: commented out'), null);
    assert.equal(
      dispatchDefault(
        "      mode:\n        description: x\n        default: 'report'\n"
      ),
      'report'
    );
    assert.equal(
      dispatchDefault(
        "      mode:\n        description: x\n        default: 'delete'\n"
      ),
      'delete'
    );

    const floor =
      /Number\.isFinite\(raw\)\s*&&\s*raw\s*>=\s*1\s*\?\s*raw\s*:\s*7/;
    assert.equal(
      floor.test('Number.isFinite(raw) && raw >= 1 ? raw : 7'),
      true
    );
    assert.equal(floor.test("Number(Deno.env.get('X') ?? '7')"), false);
  });
});
