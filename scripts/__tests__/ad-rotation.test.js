/**
 * Guards scripts/ci/ad-rotation.mjs.
 *
 * The rotation runs on a schedule against a live paid campaign, where nobody watches it. Two things
 * here are worth more than the rest: that a CONTAMINATED window is excluded rather than averaged in,
 * and that the reporter REFUSES to compare below an impression floor. Both exist because the most
 * likely output of this job is a confident wrong answer -- two CTRs from a few hundred impressions,
 * or a blend of both creatives produced by a rotation that silently did not happen.
 *
 * Every assertion here has a matching control proving it can fail. A guard that cannot go red is
 * the defect this repo keeps re-finding.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  armForWindow,
  windowBounds,
  closedWindows,
  sumBuckets,
  isContaminated,
  summarise,
  ctr,
  isServable,
  campaignsAllowRotation,
  EPOCH_MS,
  CADENCE_HOURS,
  MIN_IMPRESSIONS,
} from '../ci/ad-rotation.mjs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const A = 'ad_aaa';
const B = 'ad_bbb';
const ARMS = [{ id: A }, { id: B }];

describe('the rotation grid', () => {
  it('alternates arms one window at a time', () => {
    assert.equal(armForWindow(EPOCH_MS, 2), 0);
    assert.equal(armForWindow(EPOCH_MS + DAY, 2), 1);
    assert.equal(armForWindow(EPOCH_MS + 2 * DAY, 2), 0);
    assert.equal(armForWindow(EPOCH_MS + 3 * DAY, 2), 1);
  });

  it('holds the same arm for the whole window, and flips exactly at the boundary', () => {
    assert.equal(armForWindow(EPOCH_MS, 2), 0);
    assert.equal(
      armForWindow(EPOCH_MS + DAY - 1, 2),
      0,
      'one ms before the boundary is still arm 0'
    );
    assert.equal(
      armForWindow(EPOCH_MS + DAY, 2),
      1,
      'the boundary itself belongs to arm 1'
    );
  });

  it('never returns a negative index before the epoch', () => {
    // A plain % would give -1 here, which indexes undefined and reads as "no arm".
    for (let d = 1; d <= 5; d++) {
      const i = armForWindow(EPOCH_MS - d * DAY, 2);
      assert.ok(
        i === 0 || i === 1,
        `got ${i} for ${d} day(s) before the epoch`
      );
    }
  });

  it('windowBounds snaps to the grid rather than to the call time', () => {
    const w = windowBounds(EPOCH_MS + DAY + 7 * HOUR + 13);
    assert.equal(w.start, EPOCH_MS + DAY);
    assert.equal(w.end, EPOCH_MS + 2 * DAY);
    assert.equal(w.end - w.start, CADENCE_HOURS * HOUR);
  });

  it('closedWindows excludes the window still in progress', () => {
    // Two full days plus a bit: the third window is open and must not be reported on.
    const ws = closedWindows(EPOCH_MS + 2 * DAY + 5 * HOUR);
    assert.equal(ws.length, 2);
    assert.equal(ws.at(-1).end, EPOCH_MS + 2 * DAY);
    assert.ok(ws.every((w) => w.end <= EPOCH_MS + 2 * DAY + 5 * HOUR));
  });

  it('CONTROL: closedWindows returns nothing before the first window closes', () => {
    assert.equal(closedWindows(EPOCH_MS + DAY - 1).length, 0);
  });
});

describe('bucket arithmetic', () => {
  it('sums both response shapes the API uses', () => {
    assert.deepEqual(
      sumBuckets([
        { impressions: 10, clicks: 1 },
        { metrics: { impressions: 5, clicks: 2 } },
      ]),
      { impressions: 15, clicks: 3 }
    );
  });

  it('treats missing and empty as zero rather than NaN', () => {
    // A NaN here propagates into CTR and prints "NaN%", which reads as a bug in the ads platform.
    assert.deepEqual(sumBuckets(undefined), { impressions: 0, clicks: 0 });
    assert.deepEqual(sumBuckets([{}]), { impressions: 0, clicks: 0 });
  });

  it('ctr is null with no impressions, not zero or Infinity', () => {
    assert.equal(ctr({ impressions: 0, clicks: 0 }), null);
    assert.equal(ctr({ impressions: 1000, clicks: 2 }), 0.2);
  });
});

describe('contamination — the check that makes this a measurement', () => {
  it('flags a window where the arm that should have been paused served', () => {
    assert.equal(
      isContaminated(A, {
        [A]: { impressions: 900, clicks: 2 },
        [B]: { impressions: 120, clicks: 0 },
      }),
      true
    );
  });

  it('does not flag a clean window', () => {
    assert.equal(
      isContaminated(A, {
        [A]: { impressions: 900, clicks: 2 },
        [B]: { impressions: 0, clicks: 0 },
      }),
      false
    );
  });

  it('CONTROL: a single impression on the paused arm is enough', () => {
    // The threshold is >0 deliberately. "A bit of bleed is fine" is how a blended window becomes a
    // published result.
    assert.equal(
      isContaminated(A, {
        [A]: { impressions: 900, clicks: 2 },
        [B]: { impressions: 1, clicks: 0 },
      }),
      true
    );
  });
});

describe('the verdict', () => {
  const clean = (armId, impressions, clicks, index) => ({
    index,
    expectedArmId: armId,
    perArm: {
      [A]: { impressions: 0, clicks: 0 },
      [B]: { impressions: 0, clicks: 0 },
      [armId]: { impressions, clicks },
    },
    contaminated: false,
  });

  it('attributes each window to the arm that owned it', () => {
    const s = summarise(
      [clean(A, 4000, 8, 0), clean(B, 4000, 12, 1)],
      ARMS,
      1000
    );
    assert.equal(s.totals[A].impressions, 4000);
    assert.equal(s.totals[A].clicks, 8);
    assert.equal(s.totals[B].clicks, 12);
    assert.equal(s.totals[A].windows, 1);
    assert.equal(s.verdict, 'COMPARABLE');
  });

  it('EXCLUDES a contaminated window instead of averaging it in', () => {
    const dirty = { ...clean(A, 9999, 99, 2), contaminated: true };
    const s = summarise(
      [clean(A, 4000, 8, 0), clean(B, 4000, 12, 1), dirty],
      ARMS,
      1000
    );
    assert.equal(s.excluded, 1);
    assert.equal(
      s.totals[A].impressions,
      4000,
      'the contaminated 9999 must not be counted'
    );
    assert.equal(s.totals[A].windows, 1);
  });

  it('REFUSES to compare below the impression floor', () => {
    const s = summarise([clean(A, 300, 1, 0), clean(B, 300, 3, 1)], ARMS);
    assert.equal(s.verdict, 'NOT ENOUGH DATA');
    assert.equal(s.totalImpressions, 600);
    assert.ok(s.totalImpressions < MIN_IMPRESSIONS);
  });

  it('CONTROL: the same shape above the floor DOES compare', () => {
    // Without this, "NOT ENOUGH DATA" could be hardcoded and the test above would still pass.
    const s = summarise(
      [clean(A, MIN_IMPRESSIONS, 10, 0), clean(B, MIN_IMPRESSIONS, 20, 1)],
      ARMS
    );
    assert.equal(s.verdict, 'COMPARABLE');
  });

  it('CONTROL: every window contaminated means nothing is counted, not a tie', () => {
    const s = summarise(
      [
        { ...clean(A, 5000, 10, 0), contaminated: true },
        { ...clean(B, 5000, 40, 1), contaminated: true },
      ],
      ARMS
    );
    assert.equal(s.excluded, 2);
    assert.equal(s.totalImpressions, 0);
    assert.equal(s.verdict, 'NOT ENOUGH DATA');
  });
});

describe('review gate — rotating onto an unapproved arm stops delivery', () => {
  it('an approved arm is servable', () => {
    assert.equal(isServable({ id: A, review: 'approved' }), true);
  });

  it('CONTROL: in_review, rejected, missing and undefined are all NOT servable', () => {
    // A new creative lands as in_review. Activating it pauses the one that works and serves
    // nothing -- strictly worse than skipping the rotation for a day.
    for (const review of ['in_review', 'rejected', null, undefined]) {
      assert.equal(isServable({ id: B, review }), false, `review=${review}`);
    }
    assert.equal(isServable(undefined), false);
  });
});

describe('campaign gate — a paused campaign is a decision, not a gap to fill', () => {
  it('allows rotation when a campaign is actually running', () => {
    const g = campaignsAllowRotation([{ id: 'cmpn_1', status: 'active' }]);
    assert.equal(g.ok, true);
    assert.match(g.reason, /1 active campaign/);
  });

  it('refuses when every campaign is paused — the #1201-era billing-dispute state', () => {
    // 2026-09-18: campaign paused and both ads paused during a billing dispute, with "I have
    // paused both ads and the campaign" sent in writing to the provider. Without this gate the
    // scheduled rotation would have activated an arm and made that statement false.
    const g = campaignsAllowRotation([
      { id: 'cmpn_ce3e507e', status: 'paused' },
      { id: 'cmpn_other', status: 'paused' },
    ]);
    assert.equal(g.ok, false);
    assert.match(g.reason, /no active campaign/);
    assert.match(g.reason, /cmpn_ce3e507e=paused/);
    assert.match(g.reason, /cmpn_other=paused/);
  });

  it('FAILS CLOSED on an empty, missing or malformed list', () => {
    // "I could not tell" must never read as "go ahead" for a verb that spends money. Each of
    // these is a plausible API hiccup, and every one of them used to end in an activate call.
    for (const bad of [[], undefined, null, {}, 'nope', 0]) {
      const g = campaignsAllowRotation(bad);
      assert.equal(
        g.ok,
        false,
        `input ${JSON.stringify(bad) ?? String(bad)} must refuse`
      );
      assert.ok(g.reason.length > 0, 'a refusal must carry a reason');
    }
  });

  it('CONTROL: a mixed account with one running campaign still allows rotation', () => {
    // Without this, the test above is satisfied by a function that refuses unconditionally.
    const g = campaignsAllowRotation([
      { id: 'cmpn_a', status: 'paused' },
      { id: 'cmpn_b', status: 'active' },
    ]);
    assert.equal(g.ok, true);
  });

  it('CONTROL: statuses that merely LOOK live are not active', () => {
    // Only the literal 'active' counts. A status the API adds later must fail closed rather
    // than be pattern-matched into permission.
    for (const status of [
      'ACTIVE',
      'activating',
      'in_review',
      'ended',
      'draft',
      undefined,
    ]) {
      assert.equal(
        campaignsAllowRotation([{ id: 'c', status }]).ok,
        false,
        `status=${status}`
      );
    }
  });
});
