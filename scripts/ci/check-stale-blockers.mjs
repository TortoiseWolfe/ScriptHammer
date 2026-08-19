#!/usr/bin/env node
/**
 * Report open issues whose stated blocker is already closed (#828).
 *
 * WHY. Closing an issue has no mechanism to notify the issues that named it, so a
 * blocker claim outlives its blocker silently. A scan on 2026-08-19 found 10 open
 * issues making a blocker claim and 8 of them naming something closed — six fully
 * unblocked and still reading as gated, so triage skipped them.
 *
 * The worked example is the reason this is not cosmetic: **#559 is a p1 security
 * issue** — the client could still write `payment_intents` directly — and it sat in the
 * backlog described as blocked while both its blockers had been closed for a day. It
 * was caught only because a person happened to re-read the body.
 *
 * IT REPORTS, IT DOES NOT EDIT — deliberately, at the request of #828. "Blocked by #N"
 * sometimes also means "and the thing #N was about is still true", which a regex cannot
 * judge. Clearing the claim stays a human decision; finding it does not.
 *
 * Usage:
 *   node scripts/ci/check-stale-blockers.mjs              # scan the current repo
 *   node scripts/ci/check-stale-blockers.mjs --json       # machine-readable
 *   node scripts/ci/check-stale-blockers.mjs --fixture f  # scan a JSON file instead
 *
 * Exit 0 when nothing is stale, 1 when something is — so it can gate a triage step if
 * someone wants it to, without being wired into anything by default.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Blocker claims in an issue body, as issue numbers.
 *
 * The phrasings are the ones this repo actually uses. Deliberately NOT matching a bare
 * "#123" — almost every body cites issues for context, and treating those as blockers
 * would bury the real signal in noise, which is how a checker stops being read.
 */
export function findBlockerClaims(body) {
  if (!body) return [];
  const found = new Set();

  // BOTH prepositions, for each phrase. Knowing only "gated by" and not "gated on"
  // made this report #374 as fully unblocked when its live gate — an OWNER DECISION on
  // #442 — was written "gated on #442". A missed phrasing does not make a checker
  // quieter, it makes it wrong in the confident direction.
  //
  // A claim is a phrase, its first issue number, and any numbers joined to it by a
  // comma / "and" / "&" — nothing else. An arbitrary look-ahead window instead of this
  // list swallowed the next unrelated citation: "depends on #100. See #999 for context"
  // reported #999 as a blocker, which is exactly the noise that makes a checker unread.
  const re =
    /(?:blocked\s+(?:by|on)|depends\s+on|gated\s+(?:by|on)|blocker[s]?\s*[:\-\u2014])[^.\n#]*#(\d+)((?:\s*(?:,|and|&|\+)\s*#\d+)*)/gi;

  for (const m of body.matchAll(re)) {
    found.add(Number(m[1]));
    for (const n of (m[2] || '').matchAll(/#(\d+)/g)) found.add(Number(n[1]));
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * Has a person already acknowledged that the blocker is gone?
 *
 * Without this the checker re-reports every issue somebody has already cleared, and a
 * checker that cries wolf is one nobody reads — the failure mode this file exists to
 * prevent. A banner is how this repo clears them, because deleting the original claim
 * would delete the history of why the work was parked.
 */
export function isAcknowledged(body) {
  return /^\s*>?\s*#{1,3}\s*UNBLOCKED\b/im.test(body || '');
}

/**
 * Claims naming an already-closed issue.
 *
 * `actionable` is the signal worth acting on: every named blocker is closed AND nobody
 * has said so in the body. An issue still gated by something open is reported too, but
 * only as context — it is correctly parked, and treating it as a finding would bury the
 * one that matters. #559 is why the distinction is drawn rather than reporting
 * everything equally: it was a p1 security ticket lost among routine entries.
 */
export function staleClaims(openIssues, stateByNumber) {
  const out = [];
  for (const issue of openIssues) {
    const claimed = findBlockerClaims(issue.body);
    if (!claimed.length) continue;
    const closed = claimed.filter((n) => stateByNumber.get(n) === 'CLOSED');
    if (!closed.length) continue;
    const fully = closed.length === claimed.length;
    const acknowledged = isAcknowledged(issue.body);
    out.push({
      number: issue.number,
      title: issue.title,
      claimed,
      closed,
      fully,
      acknowledged,
      actionable: fully && !acknowledged,
    });
  }
  return out;
}

function gh(args) {
  return JSON.parse(
    execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32e6 })
  );
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const fixtureAt = argv.indexOf('--fixture');

  let open, stateByNumber;
  if (fixtureAt !== -1) {
    const data = JSON.parse(readFileSync(argv[fixtureAt + 1], 'utf8'));
    open = data.open;
    stateByNumber = new Map(data.states.map((s) => [s.number, s.state]));
  } else {
    open = gh([
      'issue',
      'list',
      '--state',
      'open',
      '--limit',
      '200',
      '--json',
      'number,title,body',
    ]);
    const referenced = new Set(open.flatMap((i) => findBlockerClaims(i.body)));
    stateByNumber = new Map();
    for (const n of referenced) {
      // One call per referenced issue. `gh issue list` paginates silently and would
      // report a real issue as absent, which is worse than being slow here.
      try {
        const one = gh(['issue', 'view', String(n), '--json', 'number,state']);
        stateByNumber.set(one.number, one.state);
      } catch {
        // A number that is a PR, or from another repo, is not a blocker signal.
      }
    }
  }

  const stale = staleClaims(open, stateByNumber);

  if (asJson) {
    console.log(JSON.stringify({ scanned: open.length, stale }, null, 2));
  } else {
    const actionable = stale.filter((s) => s.actionable);
    const context = stale.filter((s) => !s.actionable);

    console.log(`scanned ${open.length} open issues`);
    if (!actionable.length) {
      console.log('no unacknowledged stale blocker claims');
    } else {
      console.log(
        `\n${actionable.length} issue(s) are FULLY UNBLOCKED and still read as gated:\n`
      );
      for (const s of actionable) {
        console.log(`  #${s.number}  ${s.title}`);
        console.log(
          `      claims: ${s.claimed.map((n) => '#' + n).join(', ')} — all closed\n`
        );
      }
      console.log(
        'Bodies are NOT edited: "blocked by #N" can also mean the underlying'
      );
      console.log(
        'condition still holds, which only a person can judge (#828).\n'
      );
    }
    if (context.length) {
      console.log(
        `for context, ${context.length} more name a closed blocker but are not actionable:`
      );
      for (const s of context) {
        const why = s.acknowledged
          ? 'already acknowledged in the body'
          : 'still gated by something open';
        console.log(`  #${s.number} — ${why}`);
      }
    }
  }
  process.exitCode = stale.some((s) => s.actionable) ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
