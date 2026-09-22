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
 *   a path that 404s     briefly at most  — a cached miss outlives the deploy that
 *                                           publishes the file (#1199)
 *
 * The third line was added after production was measured serving a 404 with
 * `max-age=14400` on an asset path and `max-age=31536000` — a year — on one under
 * `/_next/static/`, where the #635 Cache Rule's own override applies to errors as well
 * as to files that exist. Every non-200 used to be recorded here as "expected 200",
 * so this class was invisible to the only gate that reads live production headers.
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

/**
 * NO DEFAULT SITE, deliberately (#970).
 *
 * This used to fall back to `https://scripthammer.com`, and `smoke.yml` passed
 * `"${SITE:-https://scripthammer.com}"` on top of that. A fork whose
 * `NEXT_PUBLIC_DEPLOY_URL` variable was unset therefore ran a green post-deploy check
 * against THIS project's site — reporting, accurately, that somebody else's cache
 * headers were fine. A gate that measures the wrong host is worse than no gate: it
 * reads as coverage.
 */
import { ASSET_MAX_AGE } from './cloudflare-intent.mjs';

const BASE = (process.argv[2] || process.env.BASE || '').replace(/\/$/, '');

if (!BASE) {
  console.error(
    '✗ No site to check. Pass a base URL as the first argument or set BASE.\n' +
      '  In CI this comes from `vars.NEXT_PUBLIC_DEPLOY_URL`; if that is unset, set it\n' +
      '  to your own deployed URL rather than letting this measure another site.'
  );
  process.exit(1);
}

/**
 * Documents to check. More than one because the Cloudflare expression matches on
 * `ends_with(path, "/")` — a rule that somehow applied only to the site root would
 * still leave every real page stale, and checking `/` alone could not tell.
 */
const DOC_PATHS = (process.env.CHECK_PATHS ?? '/,/blog/')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

/**
 * Cloudflare Browser TTL for hashed assets, per the #635 Cache Rule.
 *
 * IMPORTED, not repeated. `cloudflare-intent.mjs` exists so one value can drive both
 * the check and the change; this was a second literal `31536000` sitting in the module
 * that declaration was supposed to make unnecessary, so a tightening applied in one
 * place and asserted in the other could disagree indefinitely.
 */
const ASSET_MIN_MAX_AGE = Number(
  process.env.ASSET_MIN_MAX_AGE ?? ASSET_MAX_AGE
);

/**
 * Require proof that Cloudflare answered. The entire contract depends on the edge
 * being in front of GitHub Pages; if `cf-ray` disappears, the origin's own
 * `max-age=600` is what visitors get, and every other assertion here becomes a
 * statement about a machine that is no longer serving the site.
 *
 * OPT-IN, and the default flipped in #970. It used to default ON, which made this
 * check unpassable in any fork: `cf-ray` exists here only because Cloudflare fronts
 * this zone, and no fork inherits that. A fork still gets the useful half — documents
 * revalidate, hashed assets are cached for a year — without being told its correct
 * deployment is broken.
 *
 * Flipping a default weakens a gate by omission, so `smoke.yml` passes REQUIRE_EDGE
 * explicitly and `scripts/__tests__/check-cache-headers.test.js` fails if that line
 * ever goes away. Losing the edge silently is the #635 regression this exists to catch.
 */
const REQUIRE_EDGE = process.env.REQUIRE_EDGE === 'true';

/**
 * How long a path that does NOT exist may claim to be reusable for (#1199).
 *
 * WHY THERE IS A CEILING RATHER THAN A BAN. Caching an error briefly is useful — it is
 * what stops a crawler hammering the origin with the same missing URL. The defect is
 * duration, not caching: measured on production 2026-09-22, an invented `.bin` path
 * came back `max-age=14400` and one under `/_next/static/` came back `max-age=31536000`,
 * both `cf-cache-status: MISS` then `HIT`. A file published by a deploy could not reach
 * anyone holding that answer for four hours, or a year.
 *
 * 300s is comfortably longer than any legitimate crawl burst and far shorter than a
 * deploy cycle, so it separates the two without being a tripwire on normal behaviour.
 */
const ERROR_MAX_MAX_AGE = Number(process.env.ERROR_MAX_MAX_AGE ?? 300);

const failures = [];
const notes = [];
/**
 * Probes that could not reach a conclusion. Kept apart from `notes` on purpose: a
 * check that could not fail must not print the success word (#396), and the summary
 * line below withholds its error-cache clause unless every probe was measured.
 */
const unverified = [];

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

/**
 * How many seconds this response may be reused for, or `null` when it does not say.
 *
 * Deliberately NOT `revalidates()`, which is a boolean. The #1199 question is "for how
 * long", and the answer `null` — no header, or a header stating no lifetime — is a
 * third outcome that must not be read as either pass or fail: a bare GitHub Pages
 * origin answers a 404 exactly that way.
 */
function reuseWindow(cacheControl) {
  if (cacheControl == null) return null;
  if (revalidates(cacheControl)) return 0;
  return maxAgeOf(cacheControl);
}

/** Seconds as something a reader can weigh against a deploy cycle. */
function humanSeconds(n) {
  if (n < 3600) return `${n}s`;
  if (n < 86400) return `${(n / 3600).toFixed(1)}h`;
  return `${Math.round(n / 86400)} days`;
}

async function head(url) {
  // GET, not HEAD: some edges answer HEAD from a different path than the real
  // request, and the header under test is the one a browser actually receives.
  const res = await fetch(url, { redirect: 'follow' });
  return {
    status: res.status,
    cacheControl: res.headers.get('cache-control'),
    cfRay: res.headers.get('cf-ray'),
    // Evidence for the #1199 phase: MISS then HIT on the same invented path is how
    // you tell "the edge stored this error" from "the header merely says it may".
    cfCacheStatus: res.headers.get('cf-cache-status'),
    body: res,
  };
}

// ── documents must revalidate ────────────────────────────────────────────────
let html = '';
let htmlUrl = '';
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

  if (path === DOC_PATHS[0]) {
    html = await res.body.text();
    // Keep the URL the HTML came from: the asset hrefs below are relative to THIS
    // document, not to BASE, and on a project-Pages deployment the two differ.
    htmlUrl = url;
  }

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
      html.matchAll(
        /["'(]([^"'()\s]*\/_next\/static\/[^"'()\s]+?\.(?:js|css))/g
      ),
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
  // RESOLVE, DON'T CONCATENATE (#970). `rel` is scraped from the page's own HTML, so
  // on a project-Pages deployment it already carries the basePath:
  // `/widget/_next/static/…`. Joining that onto a BASE that also carries it produced
  // `https://owner.github.io/widget/widget/_next/…`, and the gate reported 404 for an
  // asset that was being served correctly. The URL resolver handles all three shapes
  // the regex can yield — absolute path, relative path, full URL — and resolving
  // against the document is what a `<link href>` actually means.
  const url = new URL(rel, htmlUrl || BASE).href;
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
        failures.push(
          `${url} carries no \`cf-ray\`; Cloudflare did not serve it.`
        );
      }
    }
  } catch (err) {
    failures.push(`${url} could not be fetched: ${err.message}`);
  }
}

// ── a path that does not exist must not be cached for hours ──────────────────
/**
 * A FRESH path every run, and that is load-bearing twice over. A constant path would
 * be answered from the cache this check exists to measure — run N reading run N-1's
 * stored 404 — and it would accumulate a long-lived cached error on a path somebody
 * might later publish, which is the very failure #1199 describes.
 */
const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Two probes because the two shapes fail for DIFFERENT reasons and one fix does not
 * imply the other. Extensions matter: Cloudflare applies its Browser Cache TTL only to
 * extensions in its default static list, so `.json` and `.glb` come back with no
 * cache-control at all and would pass vacuously. `.bin` and `.js` are in the list.
 */
const errorProbes = [
  {
    shape: 'asset',
    rel: `cache-probe-${nonce}.bin`,
    cause:
      'The #635 Response Header Transform Rule matches document paths only, and the ' +
      'Cache Rule matches /_next/static/ only, so an ordinary asset path matches ' +
      "neither and Cloudflare's zone Browser Cache TTL is what reaches the browser.",
  },
  {
    shape: 'hashed asset',
    rel: `_next/static/chunks/cache-probe-${nonce}.js`,
    cause:
      'The #635 Cache Rule sets browser_ttl and edge_ttl defaults on /_next/static/ ' +
      'with no status_code_ttl, so its one-year override applies to error responses ' +
      'too. Note status_code_ttl caps the EDGE copy only; the browser half needs a ' +
      'response-header rule.',
  },
];

let measuredProbes = 0;
for (const probe of errorProbes) {
  // RESOLVE, DON'T CONCATENATE, for the same reason as the asset above (#970): on a
  // project-Pages deployment the basePath lives in the document URL, not in BASE.
  const url = new URL(probe.rel, htmlUrl || BASE).href;
  let res;
  try {
    res = await head(url);
  } catch (err) {
    failures.push(`${url} could not be fetched: ${err.message}`);
    continue;
  }

  if (res.status === 200) {
    unverified.push(
      `${url} was invented to be missing and returned 200, so this run could not ` +
        `measure how long a missing path stays cached. A catch-all route is a ` +
        `routing choice, not a cache defect — but nothing here says the #1199 ` +
        `window is bounded.`
    );
    continue;
  }

  const reuse = reuseWindow(res.cacheControl);
  if (reuse === null) {
    unverified.push(
      `${url} returned ${res.status} with no cache lifetime stated ` +
        `(\`cache-control: ${res.cacheControl ?? '<absent>'}\`). A bare GitHub Pages ` +
        `origin answers exactly this way, so it is not evidence that anything is ` +
        `capped — it is the absence of evidence either way.`
    );
    continue;
  }

  measuredProbes += 1;

  if (reuse > ERROR_MAX_MAX_AGE) {
    failures.push(
      `${url} returned ${res.status} with \`cache-control: ${res.cacheControl}\`` +
        (res.cfCacheStatus ? ` (cf-cache-status: ${res.cfCacheStatus})` : '') +
        ` — a missing ${probe.shape} may be reused for ${reuse}s ` +
        `(${humanSeconds(reuse)}), expected max-age <= ${ERROR_MAX_MAX_AGE}. Until ` +
        `that expires, publishing this path cannot reach anyone who already asked ` +
        `for it, so a deploy that did happen looks like one that did not (#1199). ` +
        probe.cause
    );
  } else {
    notes.push(`${probe.rel} → ${res.status} ${res.cacheControl}`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────
for (const n of notes) console.log(`  ok  ${n}`);
for (const u of unverified) console.log(`  UNVERIFIED  ${u}`);

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
    `for >= ${ASSET_MIN_MAX_AGE}s` +
    // Only claim the #1199 half when EVERY probe reached a conclusion. A mixed run
    // where only the ordinary path was measurable must not say "missing paths are not
    // cached": the /_next/static/ case is the worse of the two and is precisely the
    // one that goes unmeasured on a site that answers it with a 200.
    (measuredProbes === errorProbes.length
      ? `, missing paths are not cached past ${ERROR_MAX_MAX_AGE}s`
      : '') +
    // Was unconditional, and therefore false on every run that did not require the
    // edge — the same shape of overclaim as the clause above.
    (REQUIRE_EDGE ? ', edge confirmed' : '') +
    `.`
);

if (measuredProbes !== errorProbes.length) {
  console.log(
    `  NOT ASSERTED — ${errorProbes.length - measuredProbes} of ` +
      `${errorProbes.length} invented paths produced no error response with a stated ` +
      `cache lifetime, so the #1199 window was not measured on this run. Nothing ` +
      `above says missing paths are cached briefly.`
  );
}
