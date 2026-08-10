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

const BASE = (process.argv[2] || process.env.BASE || 'https://scripthammer.com').replace(/\/$/, '');
const MANIFEST = `${BASE}/_next/static/ASSET_MANIFEST.txt`;
const CONCURRENCY = 12;

/** HEAD, falling back to a ranged GET — some CDNs answer HEAD differently. */
async function status(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (r.status === 405 || r.status === 501) {
      const g = await fetch(url, { headers: { range: 'bytes=0-0' }, redirect: 'follow' });
      return g.status;
    }
    return r.status;
  } catch (err) {
    return `ERR ${err.message}`;
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
    return { rel, url, code: await status(url) };
  },
  CONCURRENCY
);

const missing = results.filter((r) => r.code !== 200);
const missingCss = missing.filter((r) => r.rel.endsWith('.css'));

console.log(`  base      ${BASE}`);
console.log(`  manifest  ${entries.length} entries`);
console.log(`  reachable ${results.length - missing.length}`);
console.log(`  MISSING   ${missing.length}  (of which CSS: ${missingCss.length})`);

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

console.log('\n  OK — every asset the deploy promised to retain is still served.');
