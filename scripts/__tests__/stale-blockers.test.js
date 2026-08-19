/**
 * The stale-blocker scan must find the real thing and stay quiet otherwise (#828).
 *
 * WHAT IT IS FOR. Closing an issue does not notify the issues that named it, so a
 * blocker claim outlives its blocker with nothing checking. A scan on 2026-08-19 found
 * 10 open issues making a blocker claim and 8 naming something closed. The worked
 * example is why it matters: **#559 is a p1 security ticket** that sat in the backlog
 * described as blocked while both its blockers had been closed for a day.
 *
 * THE TWO WAYS THIS CHECKER COULD BE USELESS, both pinned below:
 *   - too greedy: treating every `#123` in a body as a blocker buries the signal. The
 *     first draft did exactly that — "depends on #100. See #999 for context" reported
 *     #999 as a blocker.
 *   - too noisy: re-reporting issues a person has already cleared. Six of the eight had
 *     been cleared with a banner, and a checker that keeps flagging them is one nobody
 *     reads.
 *
 * WHAT THIS CANNOT CHECK: whether "blocked by #N" ALSO means the underlying condition
 * still holds. It cannot, which is why the tool reports and never edits.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const MOD = path.join(__dirname, '..', 'ci', 'check-stale-blockers.mjs');
const load = () => import(`file://${MOD}`);

describe('stale blocker scan (#828)', () => {
  it('reads blocker phrasings this repo actually uses', async () => {
    const { findBlockerClaims } = await load();
    assert.deepEqual(findBlockerClaims('Blocked by #556, #558.'), [556, 558]);
    assert.deepEqual(findBlockerClaims('gated by #42'), [42]);
    assert.deepEqual(findBlockerClaims('Depends on #7 and #8'), [7, 8]);
    assert.deepEqual(findBlockerClaims('Blockers: #1, #2 & #3'), [1, 2, 3]);

    // BOTH prepositions. Reading "gated by" but not "gated on" made the live scan
    // report #374 as fully unblocked while its actual gate — an owner decision on
    // #442 — was written "gated on #442". A missed phrasing does not make a checker
    // quieter, it makes it wrong in the confident direction.
    assert.deepEqual(
      findBlockerClaims('Item 1 is also gated on **#442**, an owner decision.'),
      [442],
      '"gated on" is a phrasing this repo uses and must be read'
    );
    assert.deepEqual(findBlockerClaims('blocked on #99'), [99]);
  });

  it('does not treat every citation as a blocker', async () => {
    // The greedy failure. A body that merely mentions an issue is not making a claim,
    // and reporting it would make the output unreadable.
    const { findBlockerClaims } = await load();
    assert.deepEqual(
      findBlockerClaims('See #999 for context. Related: #1000.'),
      [],
      'a bare mention must not read as a blocker claim'
    );
    assert.deepEqual(
      findBlockerClaims('depends on #100. See #999 for context.'),
      [100],
      'the claim must stop at its own sentence — #999 belongs to the next one'
    );
    assert.deepEqual(findBlockerClaims(''), []);
    assert.deepEqual(findBlockerClaims(null), []);
  });

  it('separates what needs action from what is already handled', async () => {
    const { staleClaims } = await load();
    const states = new Map([
      [556, 'CLOSED'],
      [558, 'CLOSED'],
      [561, 'OPEN'],
    ]);
    const open = [
      {
        number: 1,
        title: 'all blockers closed, nobody said so',
        body: 'Blocked by #556, #558.',
      },
      {
        number: 2,
        title: 'all blockers closed, already cleared',
        body: '## UNBLOCKED 2026-08-19 — the blocker named below is closed\n\nBlocked by #556.',
      },
      {
        number: 3,
        title: 'still genuinely gated',
        body: 'Blocked by #556, #561.',
      },
      {
        number: 4,
        title: 'no claim at all',
        body: 'Mentions #556 in passing.',
      },
    ];

    const found = staleClaims(open, states);
    const byNumber = Object.fromEntries(found.map((f) => [f.number, f]));

    assert.equal(
      byNumber[1].actionable,
      true,
      'an uncleared, fully-unblocked issue is the signal'
    );
    assert.equal(
      byNumber[2].actionable,
      false,
      'an acknowledged issue must not be re-reported'
    );
    assert.equal(byNumber[2].acknowledged, true);
    assert.equal(
      byNumber[3].actionable,
      false,
      'an issue still gated by an OPEN issue is correctly parked'
    );
    assert.equal(byNumber[3].fully, false);
    assert.equal(
      byNumber[4],
      undefined,
      'a passing mention produces no finding'
    );

    // Non-vacuity: if the parser broke, every assertion above would pass against an
    // empty result set except the ones asserting undefined.
    assert.equal(found.length, 3, `expected 3 findings, got ${found.length}`);
  });

  it('recognises the banner in the shapes the repo writes it', async () => {
    const { isAcknowledged } = await load();
    assert.equal(
      isAcknowledged('## UNBLOCKED 2026-08-19 — blocker closed'),
      true
    );
    assert.equal(
      isAcknowledged('> ## UNBLOCKED 2026-08-19'),
      true,
      'blockquoted banners count'
    );
    assert.equal(isAcknowledged('### UNBLOCKED'), true);
    assert.equal(
      isAcknowledged('This is unblocked now, honest'),
      false,
      'prose is not a banner'
    );
    assert.equal(isAcknowledged(''), false);
  });
});
