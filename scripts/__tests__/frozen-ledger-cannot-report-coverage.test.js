/**
 * A ledger that has stopped being written must not report a verified window (#1139).
 *
 * THE DEFECT, AS ARITHMETIC RATHER THAN ARGUMENT. `check-retained-assets.mjs` measures
 * `spanDays = now - oldest`, and that is the right question — how far back a returning visitor
 * is still protected. #1061 is emphatic that it must NOT be rewritten as `newest - oldest`.
 * But it has one blind spot that follows from the definition:
 *
 *     once  newestAge > RETAIN_DAYS,  then  spanDays >= newestAge > RETAIN_DAYS
 *
 * so the `spanDays + 1 >= RETAIN_DAYS` branch passes UNCONDITIONALLY. Past that point the
 * assertion is a tautology — "window is at full width" for any ledger at all, including one
 * frozen months ago. `now` keeps advancing on one side of a subtraction whose other side has
 * stopped.
 *
 * NOT HYPOTHETICAL. That is what #1061 was: the ledger was served from a year-long cache,
 * froze, and this check printed "window is at full width. OK." while real retention collapsed
 * from 346 carried files to 52.
 *
 * AND NOT WHAT THE ISSUE ORIGINALLY SAID. #1139 claimed protection "decays to nothing" on an
 * abandoned site. That is wrong and is corrected here rather than repeated: eviction happens
 * only in `retain-previous-assets.mjs`, which runs at DEPLOY time, so a site that stops
 * deploying evicts nothing and keeps serving its last deploy's assets indefinitely. The defect
 * is that the NUMBER stops meaning anything — not that the site breaks.
 *
 * THE TWO VERDICTS ARE OPPOSITE, WHICH IS WHY THE TRIGGER DECIDES:
 *   - post-deploy (`workflow_run`): a deploy just ran and did not write the ledger. Real fault.
 *   - cron / dispatch / a fork: nobody deployed lately. Ordinary — but the run must not then
 *     claim a window it could not verify.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { createServer } = require('node:http');
const { execFile } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'ci', 'check-retained-assets.mjs');
const DAY = 86_400_000;

function listen(server) {
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  );
}

/**
 * Serves an ASSET_AGES.txt whose entries span `oldestDaysAgo` → `newestDaysAgo`.
 *
 * Format is `<age> <ISO> <path>`, matching the parser's own regex. Only the timestamp is read.
 */
function siteWithLedger({ oldestDaysAgo, newestDaysAgo }) {
  const now = Date.now();
  const line = (daysAgo, n) =>
    `${Math.round(daysAgo)} ${new Date(now - daysAgo * DAY).toISOString()} _next/static/chunks/a${n}.js`;
  const body = [line(oldestDaysAgo, 1), line(newestDaysAgo, 2)].join('\n');
  return createServer((req, res) => {
    if (req.url.startsWith('/asset-ledger/ASSET_AGES.txt')) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end('nope');
  });
}

/** MUST be async — the fixture server runs in THIS process, so spawnSync would deadlock. */
function runWindowCheck(base, env = {}) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, base],
      {
        encoding: 'utf8',
        timeout: 20000,
        env: {
          ...process.env,
          RETAINED_CHECK: 'window',
          RETAIN_DAYS: '14',
          GITHUB_EVENT_NAME: '',
          ...env,
        },
      },
      (err, stdout, stderr) =>
        resolve({ code: err?.code ?? 0, out: `${stdout}${stderr}` })
    );
  });
}

async function withSite(ledger, fn) {
  const server = siteWithLedger(ledger);
  const port = await listen(server);
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

describe('a frozen ledger cannot report coverage (#1139)', () => {
  it('CONTROL: a live ledger with a full window still passes', async () => {
    // Without this, every assertion below could be satisfied by a check that always refuses.
    const r = await withSite({ oldestDaysAgo: 20, newestDaysAgo: 0.01 }, (b) =>
      runWindowCheck(b)
    );
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /window is at full width/, r.out);
    assert.match(r.out, /OK —/, r.out);
  });

  it('a frozen ledger does NOT report a verified window', async () => {
    // 80 days of "span", 60 days since anything was written. The old logic reports
    // `spanDays + 1 >= RETAIN_DAYS` — 81 >= 14 — and prints full width. That is the tautology.
    const r = await withSite({ oldestDaysAgo: 80, newestDaysAgo: 60 }, (b) =>
      runWindowCheck(b)
    );
    assert.doesNotMatch(
      r.out,
      /window is at full width/,
      `a ledger last written 60 days ago was reported as a full window:\n${r.out}`
    );
    assert.doesNotMatch(
      r.out,
      /OK —/,
      `the run claimed OK for a window it could not verify:\n${r.out}`
    );
    assert.match(r.out, /UNVERIFIED/, r.out);
  });

  it('and it is NOT failed for it, because a quiet period is ordinary', async () => {
    // The fork case. Nobody deployed lately; that is not this gate's business, and failing
    // it would be the #1054 shape — a check keyed to THIS repo's cadence reddening a fork.
    const r = await withSite({ oldestDaysAgo: 80, newestDaysAgo: 60 }, (b) =>
      runWindowCheck(b)
    );
    assert.strictEqual(r.code, 0, `a quiet site was failed:\n${r.out}`);
  });

  it('but post-deploy it IS a failure — the deploy did not write the ledger', async () => {
    // The #1061 class exactly: a deploy completed seconds ago, so the ledger should have been
    // rewritten. If it was not, the chain is broken and retention is collapsing silently.
    const r = await withSite({ oldestDaysAgo: 80, newestDaysAgo: 60 }, (b) =>
      runWindowCheck(b, { GITHUB_EVENT_NAME: 'workflow_run' })
    );
    assert.notStrictEqual(
      r.code,
      0,
      `a stale ledger passed a post-deploy check:\n${r.out}`
    );
    assert.match(r.out, /#1139/);
    assert.match(
      r.out,
      /346 carried files to 52/,
      'the error does not name the incident'
    );
  });

  it('the threshold is RETAIN_DAYS, and it moves with it', async () => {
    // 20 days stale is fine when the window is 30 — the check is only vacuous once the
    // newest entry is older than the window itself.
    const r = await withSite({ oldestDaysAgo: 40, newestDaysAgo: 20 }, (b) =>
      runWindowCheck(b, { RETAIN_DAYS: '30' })
    );
    assert.doesNotMatch(r.out, /UNVERIFIED/, r.out);
    assert.strictEqual(r.code, 0, r.out);
  });

  it('ANTI-VACUITY: the frozen case really would have passed the old assertion', async () => {
    // The whole defect is that `spanDays` stays large. If the fixture did not actually
    // produce a span above RETAIN_DAYS, the tests above would be proving nothing.
    const r = await withSite({ oldestDaysAgo: 80, newestDaysAgo: 60 }, (b) =>
      runWindowCheck(b)
    );
    const span = /window\s+([\d.]+) day\(s\) of coverage/.exec(r.out);
    assert.ok(span, `no window figure in output:\n${r.out}`);
    assert.ok(
      Number(span[1]) >= 14,
      `span is ${span[1]}, below RETAIN_DAYS — the fixture is not exercising the tautology`
    );
  });
});
