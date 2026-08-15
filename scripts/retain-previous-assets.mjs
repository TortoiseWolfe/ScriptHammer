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

import { mkdir, writeFile, access, readdir } from 'node:fs/promises';
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
const CHUNK_RE =
  /["'`]([^"'`]*\/_next\/static\/(?:chunks|css)\/[^"'`]+\.(?:js|css))["'`]/g;

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
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    // DERIVE THE LIVE PREFIX; DO NOT ASSUME IT.
    //
    // The deployed sitemap advertises `https://tortoisewolfe.github.io/ScriptHammer/…`
    // while the site is served at `scripthammer.com` with NO basePath. So a loc
    // pathname carries a `/ScriptHammer` prefix that does not exist on the host
    // being crawled — measured in production: 1 of 84 pages read, after the same
    // symptom had already been fixed once for a different reason.
    //
    // The home page is the shortest loc, and its pathname IS whatever prefix the
    // sitemap was generated with. Strip that, then join to BASE, which carries
    // whatever prefix the crawl target actually uses. Correct for custom domain
    // and github.io in either direction.
    let livePrefix = '/';
    try {
      livePrefix = locs
        .map((l) => new URL(l).pathname)
        .reduce((a, b) => (b.length < a.length ? b : a), '/'.padEnd(9999, 'x'));
      if (!livePrefix.endsWith('/')) livePrefix += '/';
    } catch {
      livePrefix = '/';
    }
    console.log(`live sitemap prefix: ${livePrefix}`);

    for (const loc of locs) {
      // REBASE EVERY SITEMAP URL ONTO `BASE`.
      //
      // `<loc>` entries are absolute and point at the CANONICAL domain. Fetching
      // them verbatim hits a different origin than the one being crawled, every
      // request fails, and `get()` swallows it — measured: 84 sitemap pages
      // yielded 14 references because only the single seed page was ever read.
      try {
        const path = new URL(loc).pathname;
        const rel = path.startsWith(livePrefix)
          ? '/' + path.slice(livePrefix.length)
          : path;
        pages.add(`${BASE.replace(/\/$/, '')}${rel}`);
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

/** Generations-since-introduced for files this run retained. Filled in below. */
const ages = new Map();

/** First-seen timestamp (epoch ms) for files this run retained. Filled in below. */
const firstSeen = new Map();

/**
 * HOW LONG an asset is carried, and the only rule that decides what is dropped (#751).
 *
 * THIS USED TO COUNT DEPLOYS AND THAT WAS THE BUG, TWICE. The exposure being
 * protected is how long a visitor may hold a document — a duration. Deploy count is
 * a different quantity, and converting between them requires knowing the merge rate,
 * which nobody measured either time:
 *
 *   - 5 was sized against "deploys per 10 minutes", the HTML cache-control window.
 *     #650 correctly identified that as measuring the wrong thing.
 *   - 30 replaced it, justified as "a normal working week even at an unusually high
 *     merge rate" — and then 40 deploys landed in the next 6 days, 19 of them in one
 *     day. 30 generations was ~3.5 days. Production went unstyled for the 8th time.
 *
 * So the cap is now stated in the unit the risk is actually in. Two weeks covers a
 * holiday-length absence, and no assumption about merge rate can invalidate it.
 */
const RETAIN_DAYS = Number(process.env.RETAIN_DAYS ?? 14);

/**
 * Hard backstop on how many previous-build files are carried, independent of age.
 *
 * Time alone does not bound the chain: a burst of deploys inside the window grows
 * `_next/static` without limit. When more candidates survive the age rule than this,
 * the NEWEST are kept — the oldest are the ones fewest visitors can still be holding.
 *
 * Measured cost for scale: 17 files bought 5 generations, ~100 bought 30. 800 is far
 * above the ~300-500 expected at 14 days, so it is a runaway guard rather than a
 * second cap doing routine work. When it engages it says so loudly, because that
 * means the age window is no longer the thing deciding coverage.
 */
const RETAIN_MAX_FILES = Number(process.env.RETAIN_MAX_FILES ?? 800);

const DAY_MS = 86_400_000;
const NOW = Date.now();

/**
 * Publish `ASSET_MANIFEST.txt` + `ASSET_AGES.txt` describing what is on disk.
 *
 * CALLED ON EVERY EXIT PATH, INCLUDING THE FAILURES, AND THAT IS THE POINT.
 *
 * Writing the manifest used to be a separate workflow step that always ran.
 * Folding it into this script (so it could describe what was retained, #548)
 * quietly put it behind four `process.exit(1)`s. A transient network problem
 * would then ship a build with NO manifest — and because the step is
 * `continue-on-error`, the deploy still succeeds. The NEXT deploy would find
 * nothing to read and fall back to crawling HTML, which finds 33 of 106 static
 * files. One bad network moment, two degraded deploys.
 *
 * The build's own output is always knowable, so there is never a reason to
 * publish nothing. A partial manifest is strictly better than none.
 */
async function publishManifest() {
  const staticRoot = join(outDir, '_next/static');
  const published = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (
        e.name !== 'ASSET_MANIFEST.txt' &&
        e.name !== 'ASSET_AGES.txt'
      ) {
        published.push(p.slice(outDir.length + 1));
      }
    }
  }
  try {
    await walk(staticRoot);
  } catch (err) {
    console.log(`::warning::could not enumerate ${staticRoot}: ${err.message}`);
    return;
  }
  published.sort();

  await writeFile(
    join(staticRoot, 'ASSET_MANIFEST.txt'),
    published.join('\n') + '\n'
  );
  await writeFile(
    join(staticRoot, 'ASSET_AGES.txt'),
    // `<generations> <first-seen ISO> <path>`. The timestamp is what decides
    // retention (#751); the generation count is kept as a diagnostic, because it is
    // what makes a runaway merge rate legible in the logs.
    //
    // Anything not carried in by the retain loop is this build's own output: age 0,
    // first seen now.
    published
      .map(
        (rel) =>
          `${ages.get(rel) ?? 0} ${new Date(firstSeen.get(rel) ?? NOW).toISOString()} ${rel}`
      )
      .join('\n') + '\n'
  );
  const oldest = [...firstSeen.values()].reduce((a, b) => Math.min(a, b), NOW);
  console.log(
    `manifest lists ${published.length} file(s) — this build's output plus ` +
      `${ages.size} retained, carried up to ${RETAIN_DAYS} day(s); oldest retained ` +
      `asset is ${((NOW - oldest) / DAY_MS).toFixed(1)} day(s) old`
  );
}

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
  console.log(
    `manifest from the live build: ${wanted.size} file(s) — complete list`
  );
}

const pages = manifest ? [] : await livePages();
if (!manifest)
  console.log(
    'no manifest on the live build — falling back to crawling its HTML'
  );
if (pages === null) {
  // Non-zero so this is visibly a failure. The workflow step uses
  // `continue-on-error`, so the deploy still ships — but the step is marked
  // failed in the UI instead of printing a warning inside a green check.
  // Still publish: this build's own files are knowable even when the live
  // site is unreachable, and an empty manifest would degrade the NEXT deploy
  // too.
  await publishManifest();
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
  console.log(
    '::error::listed pages but read none of them — retention is a NO-OP'
  );
  await publishManifest();
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
  const res = await get(
    u.startsWith('http') ? u : `${new URL(BASE).origin}${u}`
  );
  if (!res) continue;
  const js = await res.text();
  for (const m of js.matchAll(CHUNK_RE)) wanted.add(m[1]);
}
console.log(`after one transitive pass: ${wanted.size} reference(s)`);

/**
 * THE AGE LEDGER (#548, retimed in #751).
 *
 * `ASSET_AGES.txt` on the live build records, for each published file, when it was
 * first seen and how many deploys ago that was. Retaining a file carries its
 * ORIGINAL timestamp forward unchanged — that is what makes the window a duration
 * rather than a deploy count, and it is the whole fix. The generation number rides
 * along as a diagnostic only; nothing is dropped because of it.
 *
 * Absent on the currently-live build, every retained file starts dated now — the
 * ramp is one deploy, same as #476's. The same applies per-entry to the old
 * two-field lines, which is why the parser below still reads them.
 */
const liveAges = new Map();
const liveFirstSeen = new Map();
let undated = 0;
const agesRes = await get(`${BASE}/_next/static/ASSET_AGES.txt`);
if (agesRes) {
  for (const line of (await agesRes.text()).split('\n')) {
    // New format `<age> <ISO> <path>`, and the OLD `<age> <path>` it replaces.
    // Both are parsed for exactly one deploy — the currently-live ledger predates
    // the timestamp, and refusing to read it would reset retention to zero on the
    // very deploy that introduces the fix.
    const dated = line.trim().match(/^(\d+)\s+(\S+T\S+Z)\s+(.+)$/);
    if (dated) {
      liveAges.set(dated[3], Number(dated[1]));
      const t = Date.parse(dated[2]);
      if (Number.isFinite(t)) liveFirstSeen.set(dated[3], t);
      continue;
    }
    const legacy = line.trim().match(/^(\d+)\s+(.+)$/);
    if (legacy) {
      liveAges.set(legacy[2], Number(legacy[1]));
      undated++;
    }
  }
  console.log(
    `live age table: ${liveAges.size} entry(ies)` +
      (undated
        ? `, ${undated} without a timestamp — stamped now (one-deploy ramp)`
        : '')
  );
} else {
  console.log(
    'no age table on the live build — retained files start at age 1, dated now'
  );
}

let retained = 0;
let alreadyPresent = 0;
let failed = 0;
let tooOld = 0;
let overflowed = 0;

/**
 * SELECT BEFORE DOWNLOADING (#751).
 *
 * The age rule and the file-count backstop both decide what NOT to fetch, so both
 * have to run before any request — an expired asset should cost nothing. The count
 * backstop additionally needs to compare candidates against each other, which a
 * single streaming loop cannot do.
 */
const candidates = [];
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

  // Unknown to the live ledger means first sighting: it is dated now, so it gets a
  // full window rather than being dropped for having no history.
  const born = liveFirstSeen.get(rel) ?? NOW;
  const ageDays = (NOW - born) / DAY_MS;
  if (ageDays > RETAIN_DAYS) {
    tooOld++;
    continue;
  }
  candidates.push({ rel, dest, born, age: (liveAges.get(rel) ?? 0) + 1 });
}

// Newest first, so the backstop drops the assets fewest visitors can still be holding.
candidates.sort((a, b) => b.born - a.born);
if (candidates.length > RETAIN_MAX_FILES) {
  overflowed = candidates.length - RETAIN_MAX_FILES;
  candidates.length = RETAIN_MAX_FILES;
  console.log(
    `::warning::${overflowed} asset(s) dropped by the ${RETAIN_MAX_FILES}-file backstop ` +
      `rather than by age. Coverage is no longer ${RETAIN_DAYS} days — raise ` +
      'RETAIN_MAX_FILES or slow the merge rate.'
  );
}

for (const { rel, dest, born, age } of candidates) {
  // Fetch against BASE, not the origin. `path` carries whatever prefix the LIVE
  // HTML uses, and `rel` is prefix-free — so joining `rel` to BASE is the only
  // combination correct in both directions. Using the origin plus the live path
  // made all 33 references unreachable when the live sitemap advertised
  // `/ScriptHammer/` and the crawl target served at root.
  const res = await get(`${BASE.replace(/\/$/, '')}/${rel}`);
  if (!res) {
    failed++;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  ages.set(rel, age);
  firstSeen.set(rel, born);
  retained++;
}

console.log(
  `\nretained ${retained} previous-build asset(s); ${alreadyPresent} already in the new build; ` +
    `${failed} unreachable; ${tooOld} past ${RETAIN_DAYS} day(s)` +
    (overflowed
      ? `; ${overflowed} past the ${RETAIN_MAX_FILES}-file backstop`
      : '')
);
if (wanted.size === 0) {
  console.log(
    '::error::read the live site but found 0 asset references. The HTML shape ' +
      'this script matches on has probably changed — retention is a NO-OP.'
  );
  await publishManifest();
  process.exit(1);
}
if (retained === 0 && alreadyPresent === 0) {
  console.log(
    `::error::found ${wanted.size} reference(s) but could download none of them ` +
      `(${failed} unreachable) — retention is a NO-OP. The asset URLs being ` +
      'requested do not exist on the live host.'
  );
  await publishManifest();
  process.exit(1);
}
if (retained === 0) {
  console.log(
    `::notice::retained 0 assets, and that is correct here: all ${alreadyPresent} ` +
      'live references already exist in this build, so no hashes changed.'
  );
}

await publishManifest();
