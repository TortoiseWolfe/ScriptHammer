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
 *   node scripts/ci/check-retained-assets.mjs [base-url]
 *   BASE=https://scripthammer.com node scripts/ci/check-retained-assets.mjs
 *
 * Exits 1 if any retained asset is gone.
 */

const BASE = (
  process.argv[2] ||
  process.env.BASE ||
  'https://scripthammer.com'
).replace(/\/$/, '');
const MANIFEST = `${BASE}/_next/static/ASSET_MANIFEST.txt`;
const AGES = `${BASE}/_next/static/ASSET_AGES.txt`;
const CONCURRENCY = 12;

/** Must match `RETAIN_DAYS` in .github/workflows/deploy.yml (#751). */
const RETAIN_DAYS = Number(process.env.RETAIN_DAYS ?? 14);

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
 * HEAD, falling back to a ranged GET whenever HEAD cannot prove the asset is
 * served. Some CDNs reject HEAD while serving GET, and a valid ranged response
 * is commonly 206 rather than 200.
 */
async function status(url) {
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

const res = await fetch(MANIFEST, { redirect: 'follow' });
if (!res.ok) {
  // A missing manifest is itself the bug: retention has no memory, so the NEXT
  // deploy carries nothing forward and the failure recurs.
  console.error(
    `::error::${MANIFEST} returned ${res.status}. The retention ledger is not ` +
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
const missingCss = missing.filter((r) => r.rel.endsWith('.css'));

console.log(`  base      ${BASE}`);
console.log(`  manifest  ${entries.length} entries`);
console.log(`  reachable ${results.length - missing.length}`);
console.log(
  `  MISSING   ${missing.length}  (of which CSS: ${missingCss.length})`
);

if (missing.length) {
  console.log('');
  for (const m of missing.slice(0, 40)) console.log(`   ${m.code}  ${m.rel}`);
  if (missing.length > 40) console.log(`   … and ${missing.length - 40} more`);
  console.error(
    `\n::error::${missing.length} retained asset(s) are gone from ${BASE}` +
      (missingCss.length
        ? ` — ${missingCss.length} of them STYLESHEETS. Anyone holding HTML that ` +
          `references them is seeing an unstyled page right now.`
        : '.')
  );
  process.exit(1);
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
const agesRes = await fetch(AGES, { redirect: 'follow' });
if (!agesRes.ok) {
  console.error(
    `::error::${AGES} returned ${agesRes.status}. Without the age ledger the next ` +
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
  const rampDaysElapsed = (now - RETIMED_AT) / 86_400_000;
  console.log(
    `\n  window    ${spanDays.toFixed(1)} day(s) of coverage, target ${RETAIN_DAYS}`
  );

  // A day of slack: the oldest asset ages out mid-window, so a healthy ledger
  // oscillates just under the target rather than sitting exactly on it.
  if (spanDays + 1 >= RETAIN_DAYS) {
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

console.log(
  '\n  OK — every asset the deploy promised to retain is still served.'
);
