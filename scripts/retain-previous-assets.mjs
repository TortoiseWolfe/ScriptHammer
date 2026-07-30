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

/** Routes to read. The live sitemap is authoritative; `/` is the fallback. */
async function livePages() {
  const pages = new Set([`${BASE}/`]);
  const sm = await get(`${BASE}/sitemap.xml`);
  if (sm) {
    const xml = await sm.text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) pages.add(m[1]);
    console.log(`sitemap: ${pages.size} page(s)`);
  } else {
    console.log('no sitemap on the live site — falling back to / only');
  }
  return [...pages];
}

const wanted = new Set();

for (const page of await livePages()) {
  const res = await get(page);
  if (!res) continue;
  const html = await res.text();
  for (const m of html.matchAll(ASSET_RE)) wanted.add(m[1]);
}
console.log(`collected ${wanted.size} asset reference(s) from live HTML`);

// One transitive pass: the entry chunks name the lazy ones.
const seed = [...wanted].filter((u) => u.endsWith('.js'));
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
if (retained === 0) {
  console.log(
    '::warning::retained 0 previous-build assets. Either the hashes did not change ' +
      '(no asset churn in this deploy, which is fine) or the live site was unreachable. ' +
      'A silent zero here is how the stale-CSS bug returns.'
  );
}
