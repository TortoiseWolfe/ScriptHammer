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
if (!outDir) {
  console.error(
    'usage: node scripts/retain-previous-assets.mjs <output-dir> <live-base-url>'
  );
  process.exit(2);
}

/**
 * An ABSENT base is handled further down, not here (#1054).
 *
 * `deploy.yml` used to pass `"${SITE_URL:-https://scripthammer.com}"`, so a fork with
 * `NEXT_PUBLIC_SITE_URL` unset crawled THIS repo's live site and copied its hashed assets into
 * the fork's own deploy — not merely a green check about someone else's host, but foreign files
 * shipped in the artifact. CLAUDE.md names this one directly: "falls back to crawling
 * scripthammer.com rather than your own site — printing 'retained N asset(s)' as though it
 * worked."
 *
 * Refusing here would be wrong for a reason specific to this script: the skip must still
 * publish a manifest, and `publishManifest()` closes over `ages`, `firstSeen` and `NOW`, none of
 * which exist yet at this point in the file. Exiting here — as the old `!liveBase` branch did —
 * ships a manifest-less build, which is exactly the two-degraded-deploys failure the function's
 * own header describes. So the check lives below those declarations.
 */
const BASE = (liveBase ?? '').trim().replace(/\/$/, '');
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
 * WHERE THE LEDGER LIVES, AND WHY IT MOVED (#1061).
 *
 * `ASSET_MANIFEST.txt` and `ASSET_AGES.txt` used to be written into
 * `_next/static/`. Every other file under that prefix is content-hashed, so
 * Cloudflare's cache rule pins the whole prefix at `max-age=31536000` — correct
 * for hashed assets and catastrophic for the two MUTABLE files at FIXED names
 * that happened to share it.
 *
 * The consequence was not theoretical. Every deploy fetched the ledger, got some
 * arbitrarily old cached generation, and trusted it as the complete list. Reads
 * of 269, 479, 229 and 212 entries were measured from four vantage points after a
 * SINGLE deploy, and across 29 sampled deploys the value read never once equalled
 * the value the immediately preceding deploy had written. The 14-day rule then
 * executed correctly against frozen birth dates: on 2026-08-29 the entire 08-15
 * cohort inside one frozen snapshot turned 14 days old at once and 220 files were
 * evicted in a single step, with nothing to replace them. Retention fell from 346
 * carried files to 52 in three days.
 *
 * So the ledger now lives OUTSIDE that prefix, where no cache rule matches it. The
 * legacy path is still written and still read for one transition, because the
 * ledger currently live is at the old location and refusing to read it would reset
 * retention to zero on the very deploy that fixes it.
 */
const LEDGER_DIR = 'asset-ledger';
const LEGACY_LEDGER_DIR = '_next/static';

/**
 * A cache-busting read. The query string is not part of the cache key for the
 * `/_next/static/` prefix — measured, `?cb=` still returned `cf-cache-status: HIT`
 * — so this only bites at the new location. That is fine: at the new location it
 * is the whole point, and at the old one the fallback is a transition measure.
 */
async function getFresh(url) {
  const bust = `${url.includes('?') ? '&' : '?'}fresh=${Date.now()}`;
  try {
    const res = await fetch(url + bust, {
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
    });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

/**
 * New location first; the legacy one only until the next deploy has published.
 *
 * A 200 IS NOT ENOUGH, and assuming it was is a bug this very change introduced
 * before its own tests caught it. A host that answers an unknown path with a
 * SPA fallback — or any 200-for-everything rule — hands back a page, and treating
 * that as the age table restamps every asset to `now`, silently resetting
 * retention to zero. So the BODY has to look like the ledger it claims to be.
 */
async function getLedgerText(name, looksRight) {
  for (const dir of [LEDGER_DIR, LEGACY_LEDGER_DIR]) {
    const res = await getFresh(`${BASE}/${dir}/${name}`);
    if (!res) continue;
    const text = await res.text();
    if (looksRight(text)) return text;
  }
  return null;
}

/** A manifest lists published asset paths, one per line. */
const looksLikeManifest = (t) =>
  t.split('\n').some((l) => l.trim().startsWith('_next/static/'));

/**
 * An age table is `<generations> <ISO timestamp> <path>` — or the pre-#751
 * `<generations> <path>`, which this script still reads for one transition. Both
 * shapes are accepted; an HTML fallback page matches neither.
 */
const looksLikeAges = (t) =>
  t
    .split('\n')
    .some((l) => /^\s*\d+\s+(\S+T\S+Z\s+\S|_next\/static\/\S)/.test(l));

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

if (!BASE) {
  // Nothing to retain FROM, which is not the same as nothing to publish. The build's own
  // output is always knowable, so the ledger is still written — a fork's first deploy then has
  // a valid, empty-of-carried-assets manifest instead of none at all.
  console.log(
    '[retain] no live site to retain from — set NEXT_PUBLIC_SITE_URL (Settings → Secrets and ' +
      "variables → Actions → Variables) to the site you deploy. Publishing this build's own " +
      'manifest and continuing.'
  );
  await publishManifest();
  process.exit(0);
}

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

  // ONE writer, one location (#1061). The ledger is written only to the new path,
  // outside the prefix Cloudflare pins immutable.
  //
  // It is deliberately NOT also written to the legacy path. Two copies of one
  // ledger is the same failure in miniature: anything that updates one and not the
  // other makes the answer depend on which a reader happens to prefer. Readers
  // instead FALL BACK to the legacy path, which covers the only case that needs
  // it — a site whose currently-live deploy predates this change.
  const ledgerRoot = join(outDir, LEDGER_DIR);
  await mkdir(ledgerRoot, { recursive: true });
  const manifestBody = published.join('\n') + '\n';
  await writeFile(join(ledgerRoot, 'ASSET_MANIFEST.txt'), manifestBody);
  // `<generations> <first-seen ISO> <path>`. The timestamp is what decides
  // retention (#751); the generation count is kept as a diagnostic, because it is
  // what makes a runaway merge rate legible in the logs.
  //
  // Anything not carried in by the retain loop is this build's own output: age 0,
  // first seen now.
  //
  // Written from the SAME `published` array as the manifest, which is what makes
  // the entry counts equal by construction — and therefore makes a mismatch on the
  // read side proof that the two came from different generations (#1061).
  const agesBody =
    published
      .map(
        (rel) =>
          `${ages.get(rel) ?? 0} ${new Date(firstSeen.get(rel) ?? NOW).toISOString()} ${rel}`
      )
      .join('\n') + '\n';
  await writeFile(join(ledgerRoot, 'ASSET_AGES.txt'), agesBody);
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
const manifestText = await getLedgerText(
  'ASSET_MANIFEST.txt',
  looksLikeManifest
);
const ledgerAgesText = await getLedgerText('ASSET_AGES.txt', looksLikeAges);

/**
 * COHERENCE: the two ledger files are written from the same `published` array, so
 * a healthy pair has the same number of entries. A mismatch proves they came from
 * different generations — i.e. at least one is a stale cached copy — and that is
 * exactly the condition that silently destroyed retention (#1061). Reads of
 * 479 manifest entries against 481 ages entries were observed in production.
 *
 * The response is to DISTRUST the pair and fall back to crawling the live HTML,
 * which is the independent source of truth. Trusting a stale manifest is worse
 * than having none: `pages` below is skipped whenever a manifest is present, so a
 * stale 200 silences the only thing that could contradict it.
 */
const manifestCount = manifestText
  ? manifestText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('_next/static/')).length
  : 0;
const agesCount = ledgerAgesText
  ? ledgerAgesText.split('\n').filter((l) => l.trim()).length
  : 0;
let ledgerIncoherent = false;
if (manifestText && ledgerAgesText && manifestCount !== agesCount) {
  ledgerIncoherent = true;
  console.log(
    `::warning::ledger is incoherent — manifest has ${manifestCount} entries but the ` +
      `age table has ${agesCount}. A current pair is written from one array, so this ` +
      `is either a stale cached copy or a pre-#751 partial ledger. Crawling the live ` +
      `site IN ADDITION to the manifest so nothing is lost either way (#1061).`
  );
}

const manifest = manifestText;
if (manifest) {
  const lines = manifestText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('_next/static/'));
  for (const l of lines) wanted.add(`/${l}`);
  console.log(
    `manifest from the live build: ${wanted.size} file(s) — complete list`
  );
}

// An incoherent ledger is still USED — a partial age table is a legitimate
// pre-#751 state — but it stops being trusted as the complete list, so the live
// crawl runs alongside it and the two are unioned.
const pages = manifest && !ledgerIncoherent ? [] : await livePages();
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
const usableAges = ledgerAgesText;
if (usableAges) {
  for (const line of usableAges.split('\n')) {
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
