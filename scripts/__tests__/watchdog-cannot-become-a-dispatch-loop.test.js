/**
 * The E2E watchdog must never turn into an unbounded dispatch loop (#639, #1136).
 *
 * WHAT IT IS. `e2e-watchdog.yml` answers one question — does `main`'s HEAD have a completed,
 * non-cancelled E2E run? — and re-dispatches `e2e.yml` if not. It holds `actions: write` for
 * exactly that, which makes it the only workflow in this repo that can start the most expensive
 * one. Nothing tested any of it until now.
 *
 * THE FAILURE MODE, WHICH HAS TWO HALVES AND #639 RECORDS BOTH.
 *
 *   1. A run reaching a terminal state is NOT the same as a test running. When the #567 quota
 *      breaker blocks, `build` has `needs: budget`, every E2E job skips, and the run still
 *      completes as `failure` — not cancelled, not skipped. The original coverage test counted
 *      that as covered and reported "E2E executed and reported" when zero tests had run
 *      (observed on 030557fc and 2fe891e7). So coverage must be decided by asking the JOBS
 *      whether a shard got past `skipped`, never by the run's conclusion.
 *
 *   2. Fixing (1) WITHOUT the blocked branch is worse than leaving it broken. A watchdog that
 *      correctly sees "not covered" and dispatches into a tripped breaker produces another
 *      blocked run every cron tick, forever — each one counting against the very budget keeping
 *      the breaker tripped. `BLOCKED` must report and STOP.
 *
 * Neither half is expressible as a green CI run: the loop only appears in production, spread
 * over days, as budget consumption nobody attributes to it. So it is asserted here.
 *
 * CADENCE IS ALSO PINNED (#1136), because it is the multiplier on all of the above. It ran
 * every three hours, sized against a lane that triggered on everything; #1119 narrowed that lane
 * and left the polling untouched.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WF = path.resolve(
  __dirname,
  '..',
  '..',
  '.github',
  'workflows',
  'e2e-watchdog.yml'
);

/**
 * Full-line `#` comments removed.
 *
 * Not optional here. This workflow's comments are unusually long and quote the very strings
 * asserted below — `dispatched`, `BLOCKED`, `skipped`. A guard matching raw text would pass
 * with the logic deleted, which this repo has burned several guards on.
 */
function code() {
  return fs
    .readFileSync(WF, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
}

// How many times a day a 5-field cron fires. Handles step syntax, lists, and a fixed hour.
// A line comment, not a block one: the step syntax it describes contains the characters
// that would close a block comment early.
function firingsPerDay(expr) {
  const [minute, hour] = expr.trim().split(/\s+/);
  const count = (field, max) => {
    if (field === '*') return max;
    const step = /^\*\/(\d+)$/.exec(field);
    if (step) return Math.ceil(max / Number(step[1]));
    return field.split(',').length;
  };
  return count(minute, 60) * count(hour, 24);
}

describe('the E2E watchdog cannot become a dispatch loop (#639, #1136)', () => {
  it('found the workflow it is asserting about', () => {
    // Anti-vacuity first: a moved file makes every assertion below pass on an empty string.
    const src = code();
    assert.ok(src.length > 1500, `${WF} is suspiciously small — stale path?`);
    assert.match(src, /name: E2E Watchdog/);
    assert.match(
      src,
      /gh workflow run e2e\.yml/,
      'it no longer dispatches at all'
    );
  });

  it('decides coverage by asking the JOBS, not the run conclusion (#639)', () => {
    const src = code();
    assert.match(
      src,
      /startswith\("E2E \("\)/,
      'coverage is no longer determined from the E2E shard jobs. A run blocked by the #567 ' +
        'breaker completes as `failure` with every shard skipped — reading the run conclusion ' +
        'reports that as covered when zero tests ran.'
    );
    assert.match(
      src,
      /\.conclusion\s*!=\s*"skipped"/,
      'the shard filter no longer excludes `skipped`, so a fully-blocked run counts as coverage'
    );
  });

  it('BLOCKED reports and STOPS — it must never dispatch', () => {
    const src = code();
    const start = src.indexOf('if [ "$BLOCKED" -gt 0 ]');
    assert.notStrictEqual(start, -1, 'the blocked branch is gone (#639)');
    const branch = src.slice(start, src.indexOf('\n          fi', start));
    assert.doesNotMatch(
      branch,
      /gh workflow run/,
      'the blocked branch dispatches. That is an unbounded loop: every tick adds another ' +
        'blocked run to the count keeping the #567 breaker tripped (#639).'
    );
    assert.match(
      branch,
      /exit 0/,
      'the blocked branch does not exit, so it falls through to the dispatch'
    );
  });

  it('an in-flight run also stops it — that is how loops start', () => {
    const src = code();
    const start = src.indexOf('if [ "$INFLIGHT" -gt 0 ]');
    assert.notStrictEqual(start, -1, 'the in-flight branch is gone');
    const branch = src.slice(start, src.indexOf('\n          fi', start));
    assert.doesNotMatch(branch, /gh workflow run/);
    assert.match(branch, /exit 0/);
    // And it must count all three waiting states, or it dispatches on top of a queued run —
    // which can supersede a pending sibling and cause the very #444 loss it exists to prevent.
    assert.match(src, /queued/);
    assert.match(src, /in_progress/);
    assert.match(src, /pending/);
  });

  it('an unreadable API counts as blocked, never as "dispatch"', () => {
    // "I could not tell" must not become "start the most expensive workflow in the repo".
    const src = code();
    assert.match(
      src,
      /\|\|\s*RAN=""/,
      'the jobs lookup no longer degrades to empty on failure'
    );
  });

  it('polls twice a day, not eight times (#1136)', () => {
    const src = code();
    const crons = [...src.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1]);
    assert.strictEqual(
      crons.length,
      1,
      `expected one cron, found ${crons.length}`
    );
    const perDay = firingsPerDay(crons[0]);
    assert.ok(
      perDay <= 4,
      `the watchdog polls ${perDay}x a day (\`${crons[0]}\`). \`workflow_run\` is the primary ` +
        'detector and the precise one; this cron only covers a trigger that produced no run at ' +
        'all. It was every three hours, sized against a lane that triggered on everything — ' +
        '#1119 narrowed that lane and left the polling untouched (#1136).'
    );
  });

  it('CONTROL: the cron arithmetic is not stuck on a small number', () => {
    // Without this, `firingsPerDay` returning 1 for everything would satisfy the bound above
    // no matter what the schedule said.
    assert.strictEqual(
      firingsPerDay('17 */3 * * *'),
      8,
      'the old cadence must measure as 8'
    );
    assert.strictEqual(firingsPerDay('17 2,14 * * *'), 2);
    assert.strictEqual(firingsPerDay('0 6 * * 1'), 1);
    assert.strictEqual(firingsPerDay('*/30 * * * *'), 48);
  });

  it('keeps workflow_dispatch, so a human can still force a check', () => {
    assert.match(code(), /workflow_dispatch:/);
    assert.match(
      code(),
      /workflows: \['E2E Tests'\]/,
      'the primary detector is gone'
    );
  });
});
