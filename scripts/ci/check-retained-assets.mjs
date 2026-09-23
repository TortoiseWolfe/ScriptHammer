#!/usr/bin/env node
/**
 * Assert that LIVE production still serves every asset it promised to retain.
 *
 * WHY THIS EXISTS. Production has gone unstyled seven times — #438, #467, #476,
 * #548, #650 and twice since. Every single time the detector was a human opening
 * a browser and seeing a white page with a giant logo. That is not monitoring.
 *
 * The failure is invisible to everything already in place:
 *
 *   - The post-deploy @smoke suite fetches the CURRENT HTML, whose CSS is always
 *     fresh by construction. It cannot see the problem.
 *   - `check-stale-html.mjs` proves retention works, but against a SIMULATED
 *     deploy in CI. It never touches the real site.
 *   - `retain-previous-assets.mjs` reports "retained 40 asset(s)" and is believed.
 *     Nothing verifies those 40 are actually reachable afterwards.
 *
 * So the promise ("a visitor holding older HTML still resolves its stylesheets")
 * has never once been checked against reality.
 *
 * WHAT THIS CHECKS. `_next/static/ASSET_MANIFEST.txt` is written by the deploy and
 * lists every file that build published PLUS everything carried forward. If an
 * entry in it 404s, then someone holding the HTML that references it is looking at
 * an unstyled page right now. That is the exact user-visible condition, stated as
 * a falsifiable assertion.
 *
 * CSS is reported separately and treated as fatal, because a missing chunk
 * degrades a feature while a missing stylesheet destroys the entire page.
 *
 * Usage:
 *   node scripts/ci/check-retained-assets.mjs <base-url>
 *   BASE=https://example.com node scripts/ci/check-retained-assets.mjs
 *
 * With no base it SKIPS (exit 0) rather than probing a hardcoded site (#1054).
 *
 * Exits 1 if any retained asset is gone.
 */

/**
 * WHOSE SITE (#1054). This used to fall back to `https://scripthammer.com`, and so did the
 * `${SITE:-…}` in `smoke.yml` that calls it — TWO stacked literals, so removing either alone
 * changed nothing. A fork with `NEXT_PUBLIC_DEPLOY_URL` unset therefore probed THIS repo and
 * reported `MISSING 0 … OK — every asset the deploy promised to retain is still served`.
 *
 * That is the worst possible shape for this particular check. Its whole job is to be the
 * unstyled-production detector, so a fork's detector was permanently green while measuring a
 * different host entirely. CLAUDE.md already documented the sibling case for
 * `retain-previous-assets.mjs`; this is the verification half of the same pair.
 *
 * There is no literal any more. An empty base means there is nothing to check, and that is a
 * SKIP — see below for why skip rather than refuse.
 */
const BASE = (process.argv[2] || process.env.BASE || '')
  .trim()
  .replace(/\/$/, '');

if (!BASE) {
  /**
   * SKIP, not refuse — the opposite of the choice `check-cache-headers.mjs` makes (#970), and
   * deliberately so.
   *
   * Refusing would be defensible: unlike a Cloudflare rule or a DMARC record, every fork that
   * runs `deploy.yml` really does publish a ledger, so an empty base here is pure
   * misconfiguration rather than a thing a fork legitimately lacks.
   *
   * What decides it is that a fork would then be red in BOTH configurations. `RETIMED_AT`
   * below is a hardcoded absolute date from THIS repo's history, so a fork that configures the
   * variable CORRECTLY still exits 1 with "retention covers only 0.0 day(s)" for roughly its
   * first two weeks (tracked separately). Handing a fork a red check whether or not it follows
   * the instructions teaches it to ignore the check.
   *
   * Operationally refusal buys nothing here either: `smoke.yml` has no `pull_request` trigger,
   * so exit 1 gates no merge — it only reds an Actions tab. The harm #1054 names is a false
   * MEASUREMENT of someone else's host, and a printed skip cannot be mistaken for coverage the
   * way `MISSING 0` against scripthammer.com can.
   */
  console.log(
    '[retained-assets] skipped — no site to check. Set NEXT_PUBLIC_DEPLOY_URL (Settings → ' +
      'Secrets and variables → Actions → Variables) to the site you deploy.'
  );
  process.exit(0);
}
/**
 * WHERE THE LEDGER LIVES (#1061). It moved out of `/_next/static/`, because that
 * prefix is pinned `max-age=31536000` by a Cloudflare cache rule written for
 * content-hashed assets — and these two files are mutable and at fixed names.
 * This checker was reading whatever cached generation its runner's edge node
 * happened to hold: 269, 479, 229 and 212 entries were measured after ONE deploy.
 * That made this gate's verdict a lottery in both directions.
 *
 * The legacy path is still tried, so this keeps working against a site whose last
 * deploy predates the move.
 */
const LEDGER_PATHS = ['asset-ledger', '_next/static'];

/** Cache-busting fetch — the whole point of the move is defeated by a cached read. */
async function fetchLedger(name) {
  for (const dir of LEDGER_PATHS) {
    const url = `${BASE}/${dir}/${name}?fresh=${Date.now()}`;
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
      });
      if (res.ok) return { res, url };
    } catch {
      // try the next location
    }
  }
  return { res: null, url: `${BASE}/${LEDGER_PATHS[0]}/${name}` };
}
const CONCURRENCY = 12;

/**
 * WHICH QUESTION TO ANSWER (#1061).
 *
 * This file asks two INDEPENDENT things, and they used to share one exit code:
 *
 *   reachability — is every asset the deploy promised still served? This is the
 *                  unstyled-production detector proper.
 *   window       — does the ledger span RETAIN_DAYS? This is the #751 assertion,
 *                  added because all 13 stylesheets were reachable on the night
 *                  production went unstyled for the eighth time.
 *
 * Sharing a verdict meant a short window hid a healthy reachability result and
 * vice versa — the same masking that hid seven detectors behind this one step.
 * Splitting them lets "nothing is stranded, but coverage is still rebuilding"
 * read as what it is, instead of collapsing to a single red.
 *
 * Unset means BOTH, so every existing caller keeps its current behaviour.
 */
const CHECK = (process.env.RETAINED_CHECK ?? 'both').trim();
if (!['both', 'reachability', 'window'].includes(CHECK)) {
  console.error(
    `::error::RETAINED_CHECK must be 'both', 'reachability' or 'window' — got '${CHECK}'.`
  );
  process.exit(2);
}
const doReach = CHECK !== 'window';
const doWindow = CHECK !== 'reachability';

/** Must match `RETAIN_DAYS` in .github/workflows/deploy.yml (#751). */
const RETAIN_DAYS = Number(process.env.RETAIN_DAYS ?? 14);

/** Set when the ledger has stopped being written, so the run must not claim a verdict. */
let windowUnverified = false;

/**
 * When the day-based ledger shipped (#751).
 *
 * A freshly-retimed ledger spans zero days and widens by about a day per day, so a
 * short span means "ramping" for the first RETAIN_DAYS and "collapsed" ever after.
 * Nothing IN the ledger can tell those apart — both look like recent timestamps —
 * so the window floor stays dormant until enough wall-clock time has passed for a
 * healthy ledger to have filled. Failing during the ramp would train people to
 * ignore this check in the two weeks before it can first mean anything.
 *
 * Overridable ONLY so the floor can be exercised before the ramp elapses — a check
 * nobody has seen go red is not yet a check, and this one is dormant by design for
 * its first two weeks. Nothing in CI sets it.
 */
const RETIMED_AT = Date.parse(
  process.env.RETENTION_RETIMED_AT ?? '2026-08-15T00:00:00Z'
);

/**
 * WHY A NON-200 IS NOT ONE THING (#1239).
 *
 * This check used to treat every non-2xx as deletion and say so: `!r.ok` filtered into
 * a bucket named `missing`, reported as "N retained asset(s) are gone". `Production
 * Smoke` run 35803250426 failed that way on a 503 for a chunk that was serving 200 at
 * 22,582 bytes minutes later, with green runs either side.
 *
 * The false red was the cheap half. The expensive half is the stylesheet branch below,
 * which announces that visitors are looking at an unstyled page right now — the
 * #548/#635 incident that has been reported from production eight times. Printing that
 * sentence because an edge wobbled is how a gate stops being believed.
 *
 * So: 404/410 is GONE (the failure this check exists for), 5xx or a dead socket is
 * UNAVAILABLE, anything else is UNEXPECTED. All three still fail — production serving
 * 503 for a retained asset is a real problem — but only GONE may claim deletion, and
 * only GONE may claim an unstyled page.
 */
function classify(code) {
  if (code === 404 || code === 410) return 'gone';
  if (typeof code !== 'number' || code >= 500) return 'unavailable';
  return 'unexpected';
}

/** Attempts per asset. A deleted file answers 404 every time; edge weather does not. */
const RETRY_ATTEMPTS = 3;

/**
 * Pause between attempts. Overridable ONLY so the tests can exercise the retry without
 * sleeping — the same reason `RETENTION_RETIMED_AT` is overridable. Nothing in CI sets it.
 */
const RETRY_DELAY_MS = Number(process.env.RETAINED_RETRY_DELAY_MS ?? 750);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * HEAD, falling back to a ranged GET whenever HEAD cannot prove the asset is
 * served. Some CDNs reject HEAD while serving GET, and a valid ranged response
 * is commonly 206 rather than 200.
 */
async function probeOnce(url) {
  let head;
  try {
    head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (head.ok) return { ok: true, code: head.status };
  } catch {
    // Try GET below: a CDN can reject or close a HEAD request while serving the
    // exact same asset normally.
  }

  try {
    const get = await fetch(url, {
      headers: { range: 'bytes=0-0' },
      redirect: 'follow',
    });
    return { ok: get.ok, code: get.status };
  } catch (err) {
    return {
      ok: false,
      code: head ? head.status : `ERR ${err.message}`,
    };
  }
}

/** `probeOnce`, retried only while the answer looks like the edge rather than the file. */
async function status(url) {
  let last;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    last = await probeOnce(url);
    if (last.ok) return { ...last, attempts: attempt };
    // Retrying a 404 just spends time confirming it. Only ask again when the answer
    // is one the edge could give for a file that exists.
    if (classify(last.code) !== 'unavailable')
      return { ...last, attempts: attempt };
    if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
  return { ...last, attempts: RETRY_ATTEMPTS };
}

async function pool(items, worker, size) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await worker(items[idx]);
      }
    })
  );
  return out;
}

if (doReach) {
  const { res, url: MANIFEST } = await fetchLedger('ASSET_MANIFEST.txt');
  if (!res || !res.ok) {
    // A missing manifest is itself the bug: retention has no memory, so the NEXT
    // deploy carries nothing forward and the failure recurs.
    console.error(
      `::error::${MANIFEST} returned ${res ? res.status : 'no response'}. The retention ledger is not ` +
        `published, so nothing is being carried forward and the next deploy will ` +
        `strand every visitor holding current HTML.`
    );
    process.exit(1);
  }

  const entries = (await res.text())
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // A manifest that parsed to nothing would make every assertion below vacuous —
  // the shape this repo keeps getting bitten by (#396).
  if (entries.length < 20) {
    console.error(
      `::error::manifest parsed to only ${entries.length} entries. Expected the ` +
        `full published set; a near-empty manifest makes this check meaningless.`
    );
    process.exit(1);
  }

  const results = await pool(
    entries,
    async (rel) => {
      const url = `${BASE}/${rel.replace(/^\/+/, '')}`;
      return { rel, url, ...(await status(url)) };
    },
    CONCURRENCY
  );

  const missing = results.filter((r) => !r.ok);
  const gone = missing.filter((r) => classify(r.code) === 'gone');
  const unavailable = missing.filter((r) => classify(r.code) === 'unavailable');
  const unexpected = missing.filter((r) => classify(r.code) === 'unexpected');
  // Only a file that is GONE can leave anyone unstyled. A stylesheet behind a 503 is
  // still published, and saying otherwise is the #1239 false alarm.
  const goneCss = gone.filter((r) => r.rel.endsWith('.css'));

  console.log(`  base      ${BASE}`);
  console.log(`  manifest  ${entries.length} entries`);
  console.log(`  reachable ${results.length - missing.length}`);
  console.log(`  MISSING   ${missing.length}`);
  if (gone.length)
    console.log(
      `  GONE        ${gone.length}  (404/410 — not published; of which CSS: ${goneCss.length})`
    );
  if (unavailable.length)
    console.log(
      `  UNAVAILABLE ${unavailable.length}  (5xx or no response after ${RETRY_ATTEMPTS} attempts)`
    );
  if (unexpected.length) console.log(`  UNEXPECTED  ${unexpected.length}`);

  if (missing.length) {
    console.log('');
    for (const m of missing.slice(0, 40))
      console.log(
        `   ${m.code}  ${m.rel}${m.attempts > 1 ? `  (${m.attempts} attempts)` : ''}`
      );
    if (missing.length > 40)
      console.log(`   … and ${missing.length - 40} more`);

    if (gone.length) {
      console.error(
        `\n::error::${gone.length} retained asset(s) are gone from ${BASE}` +
          (goneCss.length
            ? ` — ${goneCss.length} of them STYLESHEETS. Anyone holding HTML that ` +
              `references them is seeing an unstyled page right now.`
            : '.')
      );
    }
    if (unavailable.length) {
      console.error(
        `::error::${unavailable.length} retained asset(s) could not be served by ${BASE} ` +
          `after ${RETRY_ATTEMPTS} attempts (5xx or no response). These files are still ` +
          `published — this is the edge failing to serve them, not a deletion. If it ` +
          `persists, visitors are being denied assets the deploy promised to retain.`
      );
    }
    if (unexpected.length) {
      console.error(
        `::error::${unexpected.length} retained asset(s) answered with an unexpected status ` +
          `from ${BASE}. Neither served nor deleted — read the codes above.`
      );
    }
    process.exit(1);
  }
}

/**
 * IS THE PROMISE WIDE ENOUGH? (#751)
 *
 * Everything above asks whether the retained files are reachable. All 13 stylesheets
 * were, on the night production went unstyled for the eighth time — the check was
 * green and correct, and the window it was vouching for had quietly shrunk to about
 * three and a half days because the cap counted deploys instead of days.
 *
 * So this asks the other question, the one nothing asked: does the ledger actually
 * span the coverage we intend to sell? A window that has collapsed passes every
 * reachability assertion ever written, which is precisely why it needs its own.
 *
 * Ramp: a freshly-retimed ledger legitimately spans zero days, and grows by roughly a
 * day per day. Failing during that would be crying wolf on a correct deploy, so the
 * floor only applies once the ledger is old enough to have reached full width.
 */
if (doWindow) {
  const { res: agesRes, url: AGES } = await fetchLedger('ASSET_AGES.txt');
  if (!agesRes || !agesRes.ok) {
    console.error(
      `::error::${AGES} returned ${agesRes ? agesRes.status : 'no response'}. Without the age ledger the next ` +
        `deploy cannot date what it carries, so retention silently restarts.`
    );
    process.exit(1);
  }

  const dated = [];
  for (const line of (await agesRes.text()).split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(\S+T\S+Z)\s+(.+)$/);
    if (m) {
      const t = Date.parse(m[2]);
      if (Number.isFinite(t)) dated.push(t);
    }
  }

  if (!dated.length) {
    console.log(
      `\n  age ledger carries no timestamps yet — pre-#751 format, still ramping. ` +
        `Window unverifiable until the next deploy.`
    );
  } else {
    const now = Date.now();
    const spanDays = (now - Math.min(...dated)) / 86_400_000;
    const newestAgeDays = (now - Math.max(...dated)) / 86_400_000;
    const rampDaysElapsed = (now - RETIMED_AT) / 86_400_000;
    console.log(
      `\n  window    ${spanDays.toFixed(1)} day(s) of coverage, target ${RETAIN_DAYS}`
    );
    console.log(
      `  newest    ${newestAgeDays.toFixed(1)} day(s) old — is the ledger still being written?`
    );

    /*
     * A FROZEN LEDGER MAKES THIS CHECK INCAPABLE OF FAILING (#1139).
     *
     * `spanDays` is `now - oldest`, and that is the right question — it measures how far back
     * a returning visitor is still protected, which is why #1061 is emphatic that it must not
     * be rewritten as `newest - oldest`. But it has one blind spot, and it is arithmetic
     * rather than opinion:
     *
     *     once  newestAge > RETAIN_DAYS,  then  spanDays >= newestAge > RETAIN_DAYS
     *
     * so the `spanDays + 1 >= RETAIN_DAYS` branch below passes UNCONDITIONALLY. Past that
     * point the assertion is a tautology: it reports "window is at full width" for any ledger
     * whatsoever, including one that stopped being written months ago. `now` keeps advancing
     * on one side of a subtraction whose other side has stopped.
     *
     * THIS IS NOT HYPOTHETICAL. It is what #1061 was: the ledger was served from a
     * year-long cache, froze, and this check reported "window is at full width. OK." while
     * real retention collapsed from 346 carried files to 52.
     *
     * WHAT IT IS NOT. The earlier framing — that protection "decays to nothing" on an
     * abandoned site — is wrong, and worth correcting rather than repeating: eviction happens
     * only inside `retain-previous-assets.mjs`, which runs at DEPLOY time. A site that stops
     * deploying evicts nothing and keeps serving its last deploy's assets indefinitely. The
     * defect is that the NUMBER stops meaning anything, not that the site breaks.
     *
     * SO THE VERDICT DEPENDS ON WHY WE ARE RUNNING, and the two answers are opposite:
     *
     *   - post-deploy (`workflow_run`): a deploy just finished and did not write the ledger.
     *     That is a real fault and the #1061 class exactly. FAIL.
     *   - the daily cron, a dispatch, or a fork: nobody has deployed lately. Normal, and not
     *     this check's business. Say so, and — the load-bearing half — do NOT let the run
     *     claim a verified window it cannot have verified.
     */
    const postDeploy = process.env.GITHUB_EVENT_NAME === 'workflow_run';
    if (newestAgeDays > RETAIN_DAYS) {
      const detail =
        `the age ledger's NEWEST entry is ${newestAgeDays.toFixed(1)} day(s) old, older than ` +
        `RETAIN_DAYS (${RETAIN_DAYS}). Every entry therefore predates the window, so the ` +
        `${spanDays.toFixed(1)}-day "coverage" figure above is arithmetic about a chain that ` +
        `has stopped moving, not a measurement of protection (#1139).`;
      if (postDeploy) {
        console.error(
          `\n::error::${detail} A deploy has just completed, so the ledger should have been ` +
            `rewritten seconds ago. It was not — which is how #1061 stayed green while ` +
            `retention collapsed from 346 carried files to 52.`
        );
        process.exit(1);
      }
      console.log(
        `::warning::${detail} Not failing: this run was not triggered by a deploy, so a quiet ` +
          `period is the ordinary explanation. The window is UNVERIFIED, not verified.`
      );
      windowUnverified = true;
    } else if (spanDays + 1 >= RETAIN_DAYS) {
      // A day of slack: the oldest asset ages out mid-window, so a healthy ledger
      // oscillates just under the target rather than sitting exactly on it.
      console.log(`  window is at full width.`);
    } else if (rampDaysElapsed < RETAIN_DAYS) {
      console.log(
        `  still ramping (day ${rampDaysElapsed.toFixed(1)} of ${RETAIN_DAYS} since ` +
          `the ledger was retimed) — the floor is not asserted yet.`
      );
    } else {
      console.error(
        `\n::error::retention covers only ${spanDays.toFixed(1)} day(s), but ` +
          `RETAIN_DAYS is ${RETAIN_DAYS}. A visitor returning after ` +
          `${spanDays.toFixed(1)} days gets an unstyled page. This is the failure ` +
          `mode of #635 and the exact shortfall that shipped it an 8th time.`
      );
      process.exit(1);
    }
  }
}

if (windowUnverified) {
  // NOT "OK". A check that cannot fail must not report success — that is the whole defect
  // this branch exists for, and printing the usual line here would restore it verbatim.
  console.log(
    '\n  UNVERIFIED — the age ledger has stopped being written, so the window could not be ' +
      'checked. Nothing here says the site is broken; it says this gate learned nothing.'
  );
  process.exit(0);
}

console.log(
  '\n  OK — ' +
    (CHECK === 'window'
      ? `the ledger spans at least ${RETAIN_DAYS - 1} day(s). The target is ` +
        `${RETAIN_DAYS}; the check allows one day of slack because the oldest asset ` +
        `ages out mid-window, so this line must not claim the target was met.`
      : CHECK === 'reachability'
        ? 'every asset the deploy promised to retain is still served.'
        : 'every asset the deploy promised to retain is still served, and the window is wide enough.')
);
