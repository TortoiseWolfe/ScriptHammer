#!/usr/bin/env node
/**
 * Keep the PREVIOUS build's hashed assets alongside the new one (#476).
 *
 * WHY THIS EXISTS
 *
 * GitHub Pages replaces the entire site on every deploy, so the moment a new
 * build goes live the previous build's content-hashed CSS and JS are DELETED.
 * Any visitor still holding the previous build's HTML — from their HTTP cache
 * (Pages serves `max-age=600`, so ten minutes), a restored session, or an
 * intermediary — asks for a stylesheet that no longer exists, gets a 404, and
 * renders the site with NO CSS: white page, no nav, images at natural size.
 *
 * This has been reported from live production three times. It was "fixed" twice
 * by changing the service worker (#438, #467) and came back both times, because
 * the service worker is not in that path at all — `sw.js` explicitly bypasses
 * `/_next/`, and the failing request is a plain stylesheet fetch to a URL the
 * server no longer has.
 *
 * The first time, the site recovered on its own before the "fix" was even
 * merged. That was the clue: `max-age=600` is a ten-minute window, so the
 * symptom always self-heals and always looks fixed afterwards.
 *
 * Retention is what Vercel and Netlify do automatically and what Pages does not.
 * With the previous build's assets still present, stale HTML loads its own
 * stylesheets and renders correctly. The visitor gets the older page for up to
 * ten minutes, which is the normal, harmless outcome of caching.
 *
 * WHAT IT DOES
 *
 * Reads the CURRENTLY LIVE site, collects every `/_next/static/` URL its pages
 * reference, and downloads any that the new build does not contain into the
 * output directory. Additive only — it never overwrites a file the new build
 * produced.
 *
 * Usage:
 *   node scripts/retain-previous-assets.mjs <output-dir> <live-base-url>
 *
 * Never fails the deploy on a network problem: shipping a new build is strictly
 * better than not shipping. It reports loudly instead, and a zero count is
 * printed as a warning rather than passing silently.
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const [outDir, liveBase] = process.argv.slice(2);
if (!outDir || !liveBase) {
  console.error(
    'usage: node scripts/retain-previous-assets.mjs <output-dir> <live-base-url>'
  );
  process.exit(2);
}

const BASE = liveBase.replace(/\/$/, '');
const ASSET_RE = /(?:href|src)="([^"]*\/_next\/static\/[^"]+)"/g;
/** Chunk paths appear as bare strings inside the runtime, not as attributes. */
const CHUNK_RE = /["'`]([^"'`]*\/_next\/static\/(?:chunks|css)\/[^"'`]+\.(?:js|css))["'`]/g;

async function get(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

/**
 * Routes to read. The live sitemap is authoritative; `/` is the fallback.
 *
 * REACHABILITY IS CHECKED FIRST AND SEPARATELY. The first version of this
 * script reported `no sitemap on the live site` and `collected 0 asset
 * reference(s)` and exited 0 — while the real cause was that the host could not
 * RESOLVE the domain at all. Every fetch returned null, the fail-soft `get()`
 * swallowed it, and the run looked like a benign "nothing to retain".
 *
 * That would have shipped a fix that does nothing, on a bug whose entire history
 * is fixes that did nothing. "Could not read the live site" and "the live site
 * had no new hashes" must never print the same way.
 */
async function livePages() {
  const root = await get(`${BASE}/`);
  if (!root) {
    console.log(
      `::error::cannot read ${BASE}/ — retention is a NO-OP this run. ` +
        'Check DNS/network from the runner. This is not "nothing to retain": ' +
        'nothing was even looked at.'
    );
    return null;
  }

  const pages = new Set([`${BASE}/`]);
  const sm = await get(`${BASE}/sitemap.xml`);
  if (sm) {
    const xml = await sm.text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      // REBASE EVERY SITEMAP URL ONTO `BASE`.
      //
      // `<loc>` entries are absolute and point at the CANONICAL domain. Fetching
      // them verbatim hits a different origin than the one being crawled, every
      // request fails, and `get()` swallows it — measured: 84 sitemap pages
      // yielded 14 references because only the single seed page was ever read.
      try {
        // ORIGIN, not BASE. A `<loc>` pathname ALREADY carries the deployed
        // basePath, and BASE carries it too — joining them produced
        // `/ScriptHammer/ScriptHammer/` and every page 404'd. Measured: 1 of 84
        // pages read. Taking the loc's pathname verbatim against the origin is
        // correct whether the site is on a custom domain (no basePath) or on
        // github.io (basePath present in the loc).
        pages.add(`${new URL(BASE).origin}${new URL(m[1]).pathname}`);
      } catch {
        /* not a URL — skip rather than poison the list */
      }
    }
    console.log(`sitemap: ${pages.size} page(s)`);
  } else {
    console.log(
      'live site is reachable but has no sitemap.xml — reading / only, which ' +
        'covers the shared CSS but not route-specific chunks'
    );
  }
  return [...pages];
}

const wanted = new Set();

/**
 * PREFERRED SOURCE: the previous deploy's own manifest.
 *
 * Crawling HTML finds only what HTML names. Measured on a real build: 33 of 106
 * static files — all the CSS, but 26 of 85 chunks, because route chunks are named
 * from inside JS. That covers the reported symptom (unstyled pages are a CSS
 * problem) and leaves client-side navigation to a changed route uncovered.
 *
 * So each deploy now writes `_next/static/ASSET_MANIFEST.txt` listing every file
 * it published, and the NEXT deploy reads it and retains all of them. Complete,
 * one request, no inference.
 *
 * Ramp, stated plainly: the currently-live build has no manifest, so the first
 * deploy after this lands falls back to crawling and writes the first manifest.
 * The deploy after that gets complete retention.
 */
const manifest = await get(`${BASE}/_next/static/ASSET_MANIFEST.txt`);
if (manifest) {
  const lines = (await manifest.text())
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('_next/static/'));
  for (const l of lines) wanted.add(`/${l}`);
  console.log(`manifest from the live build: ${wanted.size} file(s) — complete list`);
}

const pages = manifest ? [] : await livePages();
if (!manifest) console.log('no manifest on the live build — falling back to crawling its HTML');
if (pages === null) {
  // Non-zero so this is visibly a failure. The workflow step uses
  // `continue-on-error`, so the deploy still ships — but the step is marked
  // failed in the UI instead of printing a warning inside a green check.
  process.exit(1);
}

let read = 0;
for (const page of pages) {
  const res = await get(page);
  if (!res) continue;
  read++;
  const html = await res.text();
  for (const m of html.matchAll(ASSET_RE)) wanted.add(m[1]);
}
if (!manifest)
  console.log(
    `read ${read}/${pages.length} live page(s); collected ${wanted.size} asset reference(s)`
  );
if (!manifest && read === 0) {
  console.log('::error::listed pages but read none of them — retention is a NO-OP');
  process.exit(1);
}
if (!manifest && read < pages.length) {
  console.log(
    `::warning::${pages.length - read} live page(s) could not be read; their ` +
      'route-specific chunks will not be retained'
  );
}

// One transitive pass: the entry chunks name the lazy ones. Pointless when the
// manifest already gave the complete list.
const seed = manifest ? [] : [...wanted].filter((u) => u.endsWith('.js'));
for (const u of seed) {
  const res = await get(u.startsWith('http') ? u : `${new URL(BASE).origin}${u}`);
  if (!res) continue;
  const js = await res.text();
  for (const m of js.matchAll(CHUNK_RE)) wanted.add(m[1]);
}
console.log(`after one transitive pass: ${wanted.size} reference(s)`);

let retained = 0;
let alreadyPresent = 0;
let failed = 0;

for (const ref of wanted) {
  // Strip any basePath so the on-disk location matches the build output.
  const path = ref.startsWith('http') ? new URL(ref).pathname : ref;
  const idx = path.indexOf('/_next/static/');
  if (idx === -1) continue;
  const rel = path.slice(idx + 1); // `_next/static/...`
  const dest = join(outDir, rel);

  try {
    await access(dest);
    alreadyPresent++;
    continue; // The new build produced it. Never overwrite.
  } catch {
    /* not in the new build — that is exactly what we retain */
  }

  const res = await get(`${new URL(BASE).origin}${path}`);
  if (!res) {
    failed++;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  retained++;
}

console.log(
  `\nretained ${retained} previous-build asset(s); ${alreadyPresent} already in the new build; ${failed} unreachable`
);
if (retained === 0 && alreadyPresent === 0) {
  console.log(
    '::error::read the live site but found 0 asset references. The HTML shape ' +
      'this script matches on has probably changed — retention is a NO-OP.'
  );
  process.exit(1);
}
if (retained === 0) {
  console.log(
    `::notice::retained 0 assets, and that is correct here: all ${alreadyPresent} ` +
      'live references already exist in this build, so no hashes changed.'
  );
}
