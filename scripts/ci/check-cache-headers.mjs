#!/usr/bin/env node
/**
 * Assert that LIVE production still serves the cache contract a content-hashed
 * build requires (#635).
 *
 * WHY THIS EXISTS. Production has rendered unstyled for returning visitors eight
 * times (#438, #467, #476, #548, #650 and three more). The cause was never a code
 * defect: GitHub Pages serves `max-age=600` for EVERYTHING, so a visitor could hold
 * build A's HTML for ten minutes while the server had only build B's hashed assets.
 *
 * The fix is a cache contract that GitHub Pages cannot express and Cloudflare now
 * applies at the edge:
 *
 *   HTML                 must revalidate  — it is the index of which assets to load
 *   /_next/static/*      one year         — the content hash IS the version
 *
 * THE PROBLEM THIS SCRIPT SOLVES. That contract lives in Cloudflare's dashboard, not
 * in this repository. Nothing in CI would notice if a rule were deleted, a token
 * rotated, or the zone moved — the bug would simply come back, and the next detector
 * would be a human opening a browser and seeing a white page. That is the exact
 * history #635 documents, and it is not monitoring.
 *
 * WHAT IT DOES NOT COVER, so nobody mistakes a green run for more than it is:
 *
 *   - `check-stale-html.mjs` runs against 127.0.0.1 with its own `createServer` and
 *     hardcodes `Cache-Control: max-age=600`. It proves RETENTION works against a
 *     simulated deploy. It never touches the live site and cannot see Cloudflare at
 *     all, so it is NOT a canary for these rules. (#635's body claimed otherwise.)
 *   - `check-retained-assets.mjs` proves retained assets are still reachable. That is
 *     the mitigation; this is the cure. Both matter until HTML already sitting in
 *     visitors' caches has aged out.
 *
 * `immutable` is deliberately NOT asserted on assets: Cloudflare's Browser TTL emits
 * only `max-age`, so requiring it would fail forever on a correct configuration.
 *
 * Usage:
 *   node scripts/ci/check-cache-headers.mjs [base-url]
 *   BASE=https://scripthammer.com node scripts/ci/check-cache-headers.mjs
 *
 * Exits 1 if the contract is not being served.
 */

const BASE = (
  process.argv[2] ||
  process.env.BASE ||
  'https://scripthammer.com'
).replace(/\/$/, '');

/**
 * Documents to check. More than one because the Cloudflare expression matches on
 * `ends_with(path, "/")` — a rule that somehow applied only to the site root would
 * still leave every real page stale, and checking `/` alone could not tell.
 */
const DOC_PATHS = (process.env.CHECK_PATHS ?? '/,/blog/')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

/** Cloudflare Browser TTL for hashed assets, per the #635 Cache Rule. */
const ASSET_MIN_MAX_AGE = Number(process.env.ASSET_MIN_MAX_AGE ?? 31536000);

/**
 * Require proof that Cloudflare answered. The entire contract depends on the edge
 * being in front of GitHub Pages; if `cf-ray` disappears, the origin's own
 * `max-age=600` is what visitors get, and every other assertion here becomes a
 * statement about a machine that is no longer serving the site.
 *
 * Off only for the unit test's local fixture server, never in CI.
 */
const REQUIRE_EDGE = process.env.REQUIRE_EDGE !== 'false';

const failures = [];
const notes = [];

function maxAgeOf(cacheControl) {
  const m = /(?:^|[\s,])max-age\s*=\s*(\d+)/i.exec(cacheControl ?? '');
  return m ? Number(m[1]) : null;
}

/** Does this header force the browser to revalidate before reusing the body? */
function revalidates(cacheControl) {
  const cc = (cacheControl ?? '').toLowerCase();
  if (/\bno-store\b/.test(cc)) return true;
  if (/\bno-cache\b/.test(cc)) return true;
  const age = maxAgeOf(cc);
  return age === 0;
}

async function head(url) {
  // GET, not HEAD: some edges answer HEAD from a different path than the real
  // request, and the header under test is the one a browser actually receives.
  const res = await fetch(url, { redirect: 'follow' });
  return {
    status: res.status,
    cacheControl: res.headers.get('cache-control'),
    cfRay: res.headers.get('cf-ray'),
    body: res,
  };
}

// ── documents must revalidate ────────────────────────────────────────────────
let html = '';
for (const path of DOC_PATHS) {
  const url = `${BASE}${path}`;
  let res;
  try {
    res = await head(url);
  } catch (err) {
    failures.push(`${url} could not be fetched: ${err.message}`);
    continue;
  }

  if (res.status !== 200) {
    failures.push(`${url} returned ${res.status}, expected 200`);
    continue;
  }

  if (path === DOC_PATHS[0]) html = await res.body.text();

  if (!revalidates(res.cacheControl)) {
    const age = maxAgeOf(res.cacheControl);
    failures.push(
      `${url} serves \`cache-control: ${res.cacheControl}\` — the document does ` +
        `not revalidate` +
        (age !== null ? `, so a visitor may reuse it for ${age}s` : '') +
        `. A visitor holding this HTML across a deploy renders unstyled (#635). ` +
        `Expected no-cache. If this reads exactly \`max-age=600\`, the Cloudflare ` +
        `Response Header Transform Rule is missing and GitHub Pages' own header is ` +
        `reaching browsers.`
    );
  } else {
    notes.push(`${path} → ${res.cacheControl}`);
  }

  if (REQUIRE_EDGE && !res.cfRay) {
    failures.push(
      `${url} carries no \`cf-ray\` header, so Cloudflare did not serve it. The ` +
        `cache contract is applied at the edge; without the edge, the origin's ` +
        `max-age=600 is what visitors get.`
    );
  }
}

// ── hashed assets must be immutable-in-practice ──────────────────────────────
const assets = [
  ...new Set(
    Array.from(
      html.matchAll(/["'(]([^"'()\s]*\/_next\/static\/[^"'()\s]+?\.(?:js|css))/g),
      (m) => m[1]
    )
  ),
];

// A page that yielded no assets makes every assertion below vacuous — the shape
// this repo keeps getting bitten by (#396). Say so instead of passing silently.
if (assets.length === 0) {
  failures.push(
    `no /_next/static/ asset URLs were found in ${BASE}${DOC_PATHS[0]}, so the ` +
      `asset half of this check could not run. Either the page failed to render ` +
      `or the asset path convention changed; both need a human.`
  );
} else {
  const rel = assets[0];
  const url = rel.startsWith('http')
    ? rel
    : `${BASE}/${rel.replace(/^\/+/, '')}`;
  try {
    const res = await head(url);
    if (res.status !== 200) {
      failures.push(`${url} returned ${res.status}, expected 200`);
    } else {
      const age = maxAgeOf(res.cacheControl);
      if (age === null || age < ASSET_MIN_MAX_AGE) {
        failures.push(
          `${url} serves \`cache-control: ${res.cacheControl}\` — expected ` +
            `max-age >= ${ASSET_MIN_MAX_AGE}. The filename carries the content ` +
            `hash, so re-downloading it every ${age ?? '?'}s is waste the #635 ` +
            `Cache Rule exists to remove.`
        );
      } else {
        notes.push(`${rel} → ${res.cacheControl}`);
      }
      if (REQUIRE_EDGE && !res.cfRay) {
        failures.push(`${url} carries no \`cf-ray\`; Cloudflare did not serve it.`);
      }
    }
  } catch (err) {
    failures.push(`${url} could not be fetched: ${err.message}`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────
for (const n of notes) console.log(`  ok  ${n}`);

if (failures.length > 0) {
  for (const f of failures) console.error(`::error::${f}`);
  console.error(
    `\n${failures.length} cache-contract failure(s) against ${BASE}. ` +
      `See #635 — production has served unstyled pages eight times from exactly this.`
  );
  process.exit(1);
}

console.log(
  `\ncache contract holds at ${BASE}: documents revalidate, hashed assets cached ` +
    `for >= ${ASSET_MIN_MAX_AGE}s, edge confirmed.`
);
