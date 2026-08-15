#!/usr/bin/env node
/**
 * THE GUARD THAT DID NOT EXIST (#476): does a returning visitor get styled HTML
 * across a deploy?
 *
 * This symptom has now been reported from live production three times — a white
 * page, no nav, the logo painting at its natural size, DOM perfectly correct.
 * It was "fixed" twice (#438, #467) and came back both times, because every
 * check in this repo opens a FRESH BROWSER CONTEXT. A fresh context has an
 * empty HTTP cache, so it always reaches the network and always gets HTML and
 * CSS from the same build. The bug lives in a WARM cache, and nothing looked
 * there.
 *
 * THE MECHANISM
 *
 *   1. GitHub Pages serves everything with `cache-control: max-age=600` —
 *      measured on prod, including index.html and every content-hashed asset.
 *   2. The service worker's navigation handler calls a bare `fetch(request)`.
 *      A bare fetch may be satisfied by the browser's own HTTP cache.
 *   3. So for up to TEN MINUTES after a deploy, a navigation is answered with
 *      the PREVIOUS build's HTML — without touching the network.
 *   4. That HTML references hashed CSS which the deploy DELETED. GitHub Pages
 *      serves only the current build. Every `<link rel=stylesheet>` 404s.
 *
 * #467 added a retry with `cache: 'reload'`, but put it in the `.catch` branch.
 * Nothing here fails, so that branch never runs. The defect is on the SUCCESS
 * path.
 *
 * WHAT THIS SCRIPT DOES
 *
 * Serves a real build (A) over HTTP with production's `max-age=600`, loads it in
 * a persistent context so the HTTP cache and the service worker are both warm,
 * then swaps the document root to a second build (B) whose CSS is renamed — a
 * deploy, exactly as GitHub Pages performs one — and navigates again in the SAME
 * context.
 *
 * A styled page means the visitor is safe. An unstyled one is the bug.
 *
 * Usage:  node scripts/check-stale-html.mjs
 * Needs:  a production build in ./out  (docker compose run --rm builder pnpm build)
 */

import { createServer } from 'node:http';
import {
  readFile,
  cp,
  rm,
  readdir,
  rename,
  writeFile,
  mkdir,
  copyFile as cpFile,
} from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { chromium } from '@playwright/test';

const OUT = resolve('out');
const WORK = resolve('.stale-check');
const DIR_A = join(WORK, 'a');
const DIR_B = join(WORK, 'b');
// A THIRD generation, because two deploys is where this actually broke (#548).
// `b_pristine` is build B as the compiler emitted it, BEFORE retention copied
// anything in — that snapshot is what lets us model the difference between a
// manifest written before the retain step and one written after.
const DIR_B_PRISTINE = join(WORK, 'b_pristine');
const DIR_C = join(WORK, 'c');
const PORT = Number(process.env.STALE_PORT ?? 4599);

if (!existsSync(join(OUT, 'index.html'))) {
  console.error(
    'no production build at ./out — run: docker compose run --rm builder pnpm build'
  );
  process.exit(2);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Produce the next generation: `to` is `from` with every stylesheet renamed and
 * all references updated — one GitHub Pages deploy.
 *
 * This used to be `makeBuildB()`, hardcoded to A→B. It is parameterised because
 * ONE deploy step was never the failing case: retention covers one generation,
 * so a single deploy is always survivable. #548 broke on the SECOND deploy
 * inside the HTTP-cache window, which a two-build harness cannot express.
 */
async function makeBuild(from, to, tag) {
  await cp(from, to, { recursive: true });

  const cssDir = join(to, '_next/static/css');
  const files = (await readdir(cssDir)).filter((f) => f.endsWith('.css'));
  if (!files.length) throw new Error('build has no CSS to rename');

  const renames = [];
  for (const f of files) {
    // A deterministic but different hash, so B cannot accidentally serve A's
    // filenames — which is precisely what GitHub Pages does on deploy.
    const next = f.replace(/^[a-f0-9]+/, (h) =>
      h
        .split('')
        .reverse()
        .join('')
        .replace(/[a-f]/g, (c) => (c === 'f' ? 'a' : 'f'))
    );
    if (next === f) throw new Error(`rename produced the same name for ${f}`);
    await rename(join(cssDir, f), join(cssDir, next));
    renames.push([f, next]);
  }

  // Rewrite every reference in B's HTML/JS/JSON so build B is self-consistent.
  let rewritten = 0;
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (/\.(html|js|json|txt)$/.test(e.name)) {
        let s = await readFile(p, 'utf8');
        let changed = false;
        for (const [from, to] of renames) {
          if (s.includes(from)) {
            s = s.split(from).join(to);
            changed = true;
          }
        }
        if (changed) {
          await writeFile(p, s);
          rewritten++;
        }
      }
    }
  }
  await walk(to);

  // Each generation must also ship a DIFFERENT service worker, as a real deploy
  // does — the worker stamps CACHE_VERSION with the commit SHA.
  const swPath = join(to, 'sw.js');
  if (existsSync(swPath)) {
    const sw = await readFile(swPath, 'utf8');
    const bumped = sw.replace(
      /const CACHE_VERSION = '([^']+)'/,
      (_m, v) => `const CACHE_VERSION = '${v}-${tag}'`
    );
    if (bumped === sw)
      throw new Error(`could not bump CACHE_VERSION in ${tag}`);
    await writeFile(swPath, bumped);
  }

  // Assert the simulation is faithful: the previous generation's stylesheet
  // names must NOT exist in this one.
  for (const [from] of renames) {
    if (existsSync(join(cssDir, from)))
      throw new Error(`${tag} still contains ${from} — deploy not simulated`);
  }
  console.log(
    `${tag}: renamed ${renames.length} stylesheet(s), rewrote ${rewritten} file(s), bumped the worker`
  );
  return renames;
}

/**
 * What the deploy's retain step does: copy every `_next/static` file present in
 * the LIVE build that the new build does not have.
 *
 * The chaining is the whole point, and it is decided by ONE thing — whether the
 * live build's manifest was written before or after its own retain step:
 *
 *   manifest written BEFORE  -> it lists only that build's own files, so each
 *                               deploy retains exactly one generation and the
 *                               one before it is deleted. This is #548.
 *   manifest written AFTER   -> it lists what the build actually publishes,
 *                               including what IT retained, so generations
 *                               chain forward.
 *
 * Passing `from = <the live directory as published>` models the second;
 * passing the pristine pre-retention snapshot models the first. That is exactly
 * how the two cases below are told apart.
 */
async function retainInto(from, to) {
  let copied = 0;
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const rel = p.slice(from.length + 1);
      if (e.isDirectory()) {
        await walk(p);
      } else if (rel.startsWith('_next/static') && !existsSync(join(to, rel))) {
        await mkdir(dirname(join(to, rel)), { recursive: true });
        await cpFile(p, join(to, rel));
        copied++;
      }
    }
  }
  await walk(join(from, '_next/static'));
  return copied;
}

let ROOT = DIR_A;
let SERVE_STALE_HTML = false;
const missing = [];

// The build carries a basePath. Serving it at `/` makes every asset 404 and
// build A comes up unstyled for a reason that has nothing to do with this bug —
// my first run did exactly that and reported the harness's own misconfiguration
// as four failures. Read the prefix off the build instead of assuming it.
const BASE_PATH = (() => {
  const html = readFileSync(join(OUT, 'index.html'), 'utf8');
  const m = html.match(/href="((?:\/[^/"]+)?)\/_next\/static\//);
  return m ? m[1] : '';
})();
console.log(`build basePath: ${BASE_PATH || '(root)'}`);

const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // Strip the basePath, since the build's own links include it.
  const rel =
    BASE_PATH && url.startsWith(BASE_PATH)
      ? url.slice(BASE_PATH.length) || '/'
      : url;
  const isDoc = url.endsWith('/') || rel === '/';
  // Documents come from the STALE build when the flag is set; everything else
  // always comes from the live root, which is the asymmetry that breaks pages.
  let file = join(isDoc && SERVE_STALE_HTML ? DIR_A : ROOT, rel);
  if (isDoc) file = join(file, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      // EXACTLY what GitHub Pages sends. This is the whole point: with
      // `no-store` here the bug is unreproducible, which is why it never
      // showed up locally.
      'Cache-Control': 'max-age=600',
    });
    res.end(body);
  } catch {
    if (/\.(css|js)$/.test(url)) missing.push(url);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
});

async function styled(page) {
  return page.evaluate(() => {
    let rules = 0;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        rules += sheet.cssRules.length;
      } catch {
        /* cross-origin sheet, not ours */
      }
    }
    const header = document.querySelector('header, nav');
    return {
      rules,
      headerH: header ? Math.round(header.getBoundingClientRect().height) : 0,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      sw: !!navigator.serviceWorker?.controller,
    };
  });
}

await rm(WORK, { recursive: true, force: true });
await cp(OUT, DIR_A, { recursive: true });
const renames = await makeBuild(DIR_A, DIR_B, 'build B');
// Snapshot B exactly as emitted, before any retention touches it. This is the
// "manifest written BEFORE the retain step" view, and the burst case below
// needs it to reproduce #548 faithfully.
await cp(DIR_B, DIR_B_PRISTINE, { recursive: true });

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const base = `http://127.0.0.1:${PORT}`;

// BROWSER RESOLUTION. Locally the container has Playwright's own chromium. On a
// CI runner it does not — `accessibility.yml` gets its browser from Pa11y's
// puppeteer, and adding `playwright install` would put a 60s download on a
// REQUIRED check. Every GitHub runner ships Chrome, so fall back to the system
// channel rather than making the guard expensive enough to be removed later.
async function launch() {
  try {
    return await chromium.launch();
  } catch (err) {
    console.log(
      `bundled chromium unavailable (${String(err).slice(0, 80)}) — trying system chrome`
    );
    return chromium.launch({ channel: 'chrome' });
  }
}
const browser = await launch();
// ONE context for the whole run. A new context per visit is what made this
// invisible: it resets the HTTP cache and the service worker registration.
const ctx = await browser.newContext();
const page = await ctx.newPage();

const failures = [];

console.log('\n--- build A, first visit (warms the HTTP cache and the worker)');
await page.goto(`${base}${BASE_PATH}/`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
// Give the worker a chance to install and take control.
await page
  .waitForFunction(() => !!navigator.serviceWorker?.controller, {
    timeout: 8000,
  })
  .catch(() => {});
const a = await styled(page);
console.log(
  `    rules=${a.rules} headerH=${a.headerH} bg=${a.bodyBg} swControlled=${a.sw}`
);
if (a.rules < 100)
  failures.push(
    `build A was not styled to begin with (${a.rules} rules) — the harness is wrong, not the app`
  );

console.log(
  "\n--- DEPLOY: document root swaps to build B, A's stylesheets are gone"
);
ROOT = DIR_B;
missing.length = 0;

// INJECT THE CONDITION DIRECTLY.
//
// Relying on a browser cache to misbehave is not a test — Chromium revalidated
// the navigation and the first version of this script PASSED, which told me
// nothing. The real-world state is simply OLD HTML + NEW ASSETS, however it
// arose (HTTP cache, an intermediary, session restore, a worker from three
// deploys ago). So serve exactly that: build A's document, build B's directory.
//
// This is the state a visitor was in when the site rendered with no CSS. If the
// app cannot recover from it, that is the defect, and it does not matter which
// cache produced it.
SERVE_STALE_HTML = true;

console.log('--- returning visitor: build A HTML against build B assets');
await page.goto(`${base}${BASE_PATH}/`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
const b = await styled(page);
console.log(
  `    rules=${b.rules} headerH=${b.headerH} bg=${b.bodyBg} swControlled=${b.sw}`
);
if (missing.length)
  console.log(
    `    404s for build A assets: ${[...new Set(missing)].join(', ')}`
  );

if (b.rules < 100)
  failures.push(
    `WARM-CACHE VISITOR GOT AN UNSTYLED PAGE: ${b.rules} CSS rules (build A had ${a.rules})`
  );

// THE CASE THAT ACTUALLY BREAKS, and it took three attempts to isolate.
//
// A visitor holding BOTH stale HTML and its stylesheets renders fine — the
// stylesheets come from their own HTTP cache. The break needs stale HTML with a
// COLD asset cache: a route they had not visited before, an evicted entry, or
// HTML restored from a session while the CSS entry had already expired. Then the
// stylesheet request reaches the server, the deploy has deleted that hash, and
// the page paints with nothing.
console.log(
  '\n--- stale HTML, COLD asset cache (a route the visitor had not loaded)'
);
const cold = await browser.newContext();
const coldPage = await cold.newPage();
missing.length = 0;
await coldPage.goto(`${base}${BASE_PATH}/`, { waitUntil: 'load' });
await coldPage.waitForTimeout(2500);
const c = await styled(coldPage);
console.log(
  `    rules=${c.rules} headerH=${c.headerH} bg=${c.bodyBg} swControlled=${c.sw}`
);
if (missing.length)
  console.log(`    404s: ${[...new Set(missing)].slice(0, 4).join(', ')}`);
await cold.close();

const brokeWithoutRetention = c.rules < 100;
if (brokeWithoutRetention)
  console.log(
    `    ^ this is the reported production symptom, reproduced: ${new Set(missing).size} stylesheet(s) 404`
  );

// NOW WITH RETENTION. `scripts/retain-previous-assets.mjs` copies the previous
// build's hashed assets into the new output, which is what the deploy does. The
// same stale HTML must now render, because its own stylesheets still exist.
console.log('\n--- same stale HTML, but the deploy RETAINED the old assets');
for (const [from] of renames) {
  await cpFile(
    join(DIR_A, '_next/static/css', from),
    join(DIR_B, '_next/static/css', from)
  );
}
const kept = await browser.newContext();
const keptPage = await kept.newPage();
missing.length = 0;
await keptPage.goto(`${base}${BASE_PATH}/`, { waitUntil: 'load' });
await keptPage.waitForTimeout(2500);
const k = await styled(keptPage);
console.log(
  `    rules=${k.rules} headerH=${k.headerH} bg=${k.bodyBg} swControlled=${k.sw}`
);
if (missing.length)
  console.log(`    404s: ${[...new Set(missing)].slice(0, 3).join(', ')}`);
await kept.close();

if (k.rules < 100)
  failures.push(
    `RETENTION DID NOT HELP: still ${k.rules} CSS rules with the old assets present`
  );
if (k.headerH > 200)
  failures.push(`still unstyled with retention: header ${k.headerH}px`);
if (!brokeWithoutRetention)
  failures.push(
    'the cold-cache case did NOT break without retention — this check can no longer ' +
      'prove anything, so treat it as broken rather than passing'
  );
if (b.headerH < 40 || b.headerH > 200)
  failures.push(`header is ${b.headerH}px tall — expected roughly 40-200`);
if (missing.length)
  failures.push(
    `the page requested ${missing.length} asset(s) that the deploy deleted: ${[...new Set(missing)].slice(0, 4).join(', ')}`
  );

// ===========================================================================
// SECOND DEPLOY — the case that actually shipped the outage (#548)
// ===========================================================================
//
// Everything above proves ONE deploy is survivable. It always was: retention
// covers one generation, so build A's assets live on inside build B.
//
// Production broke anyway, because six PRs merged in 35 minutes — two of them 57
// seconds apart. GitHub Pages serves HTML with `max-age=600`, so a visitor can
// hold build A's HTML for TEN MINUTES. By the time build C shipped, retention
// had moved on to covering B, and A's stylesheets were gone from the origin.
//
// The distinction that decides it is one line in deploy.yml: whether a build's
// ASSET_MANIFEST.txt is written before or after its own retain step. Written
// before, it lists only that build's files and each deploy forgets its
// grandparent. Written after, generations chain.
//
// Both are modelled below from the same snapshot, so this cannot pass by
// accident in either direction.
console.log(
  '\n=== SECOND DEPLOY (#548): does a visitor still holding build A survive it? ==='
);

await makeBuild(DIR_B_PRISTINE, DIR_C, 'build C');

// (1) One-generation retention — today's behaviour. C retains from B AS EMITTED,
//     which never contained A's stylesheets.
const oneGen = await retainInto(DIR_B_PRISTINE, DIR_C);
console.log(
  `\n--- one-generation retention: C kept ${oneGen} file(s) from B-as-emitted`
);
ROOT = DIR_C;
const burstCold = await browser.newContext();
const burstPage = await burstCold.newPage();
missing.length = 0;
await burstPage.goto(`${base}${BASE_PATH}/`, { waitUntil: 'load' });
await burstPage.waitForTimeout(2500);
const g1 = await styled(burstPage);
console.log(`    rules=${g1.rules} headerH=${g1.headerH} bg=${g1.bodyBg}`);
if (missing.length)
  console.log(`    404s: ${[...new Set(missing)].slice(0, 4).join(', ')}`);
await burstCold.close();

const burstBroke = g1.rules < 100;
if (burstBroke)
  console.log(
    `    ^ #548 reproduced: ${new Set(missing).size} stylesheet(s) 404 after two deploys`
  );

// (2) Chained retention — the fix. C retains from B AS PUBLISHED, which by then
//     already held A's stylesheets, so they survive a second generation.
console.log(
  '\n--- chained retention: C keeps what B PUBLISHED (its own files + what B retained)'
);
const chained = await retainInto(DIR_B, DIR_C);
console.log(`    copied ${chained} additional file(s) into C`);
const burstKept = await browser.newContext();
const burstKeptPage = await burstKept.newPage();
missing.length = 0;
await burstKeptPage.goto(`${base}${BASE_PATH}/`, { waitUntil: 'load' });
await burstKeptPage.waitForTimeout(2500);
const g2 = await styled(burstKeptPage);
console.log(`    rules=${g2.rules} headerH=${g2.headerH} bg=${g2.bodyBg}`);
if (missing.length)
  console.log(`    404s: ${[...new Set(missing)].slice(0, 3).join(', ')}`);
await burstKept.close();

if (g2.rules < 100)
  failures.push(
    `TWO DEPLOYS STILL BREAK A RETURNING VISITOR: ${g2.rules} CSS rules with chained ` +
      `retention (build A had ${a.rules}) — this is #548, unfixed`
  );
if (g2.headerH > 200)
  failures.push(`still unstyled after two deploys: header ${g2.headerH}px`);
if (missing.length)
  failures.push(
    `after two deploys the page requested ${missing.length} deleted asset(s): ` +
      `${[...new Set(missing)].slice(0, 4).join(', ')}`
  );

// THE NEGATIVE CONTROL FOR THE BURST, and it matters more than the positive one.
// If one-generation retention ever stops breaking here, this harness has quietly
// stopped modelling a deploy — the same way a fresh browser context stopped
// modelling a returning visitor, which is what hid this bug for three rounds.
if (!burstBroke)
  failures.push(
    'the two-deploy case did NOT break under one-generation retention — the burst ' +
      'is no longer being simulated, so treat this check as broken rather than passing'
  );

// ── PAST THE RETENTION CAP, THE CLIENT MUST RECOVER ITSELF (#650) ───────────
//
// Everything above proves retention survives a burst. It cannot survive FOREVER:
// `RETAIN_DAYS` bounds it, and a visitor away longer than that is outside it.
//
// The bound used to be counted in DEPLOYS, which is a different quantity from the
// exposure it protects — how long a visitor's tab has been open. That mismatch put
// production unstyled a sixth time on 2026-08-09 and an eighth on 2026-08-15, both
// with retention working exactly as designed (#751). Stating the window as a
// duration removes the conversion, but not the bound.
//
// So src/components/StylesheetGuard.tsx recovers the page when every same-origin
// stylesheet came back empty. This asserts that guard fires on the real
// condition and stays inert otherwise. It reads the SHIPPED string out of the
// component so the test cannot drift away from what is deployed.
//
// Two earlier detectors passed the healthy case and could never fire on the
// broken one — a CSS custom property that does not exist in the bundle, then a
// link-vs-styleSheets comparison (a 404'd sheet IS listed, with its href, and
// zero rules). The negative control below is the only reason either was caught.
const guardSrc = await readFile(
  'src/components/subatomic/StylesheetGuard/StylesheetGuard.tsx',
  'utf8'
);
const guardMatch = guardSrc.match(/const stylesheetGuard = `([\s\S]*?)`;/);
if (!guardMatch) {
  failures.push(
    'could not extract the guard from StylesheetGuard.tsx - the template literal ' +
      'was renamed or reshaped, so this check is no longer testing what ships'
  );
} else {
  const guard = guardMatch[1];
  console.log(
    '\n=== STYLESHEET GUARD (#650): past the retention cap, does the client recover? ==='
  );
  const guardPage = (statuses) => {
    const links = statuses
      .map((_, i) => `<link rel="stylesheet" href="/g${i}.css">`)
      .join('');
    return `<!doctype html><html><head>${links}<script>${guard}</script></head><body><h1>x</h1></body></html>`;
  };

  const runGuard = async (statuses) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    statuses.forEach((st, i) =>
      page.route(`**/g${i}.css`, (r) =>
        st === 200
          ? r.fulfill({
              status: 200,
              contentType: 'text/css',
              body: `.g${i}{color:red}`,
            })
          : r.fulfill({ status: 404, body: '' })
      )
    );
    await page.route('**/guard.html*', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'text/html',
        body: guardPage(statuses),
      })
    );
    await page.goto('http://guard.test/guard.html', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const recovered = /_r=/.test(page.url());
    await ctx.close();
    return recovered;
  };

  // THE NEGATIVE CONTROL FIRST. A guard that cannot stay quiet would reload every
  // healthy page, which is far worse than the bug.
  const healthy = await runGuard([200, 200, 200]);
  console.log(
    `  healthy page          -> ${healthy ? 'RELOADED (wrong)' : 'inert (correct)'}`
  );
  if (healthy)
    failures.push(
      'the stylesheet guard reloaded a HEALTHY page — it must be inert'
    );

  // The reported failure: every sheet dead.
  const allDead = await runGuard([404, 404, 404]);
  console.log(
    `  every stylesheet 404  -> ${allDead ? 'recovered (correct)' : 'NOT recovered (wrong)'}`
  );
  if (!allDead)
    failures.push(
      'the stylesheet guard did NOT recover a page whose stylesheets all 404d — ' +
        'this is the exact production symptom, so treat the guard as broken'
    );

  // Deliberately conservative: one dead sheet is not a full outage, and a reload
  // is not obviously the fix. Documented in the component.
  const mixed = await runGuard([200, 404, 200]);
  console.log(
    `  one dead of three     -> ${mixed ? 'RELOADED (too eager)' : 'inert (correct)'}`
  );
  if (mixed)
    failures.push(
      'the stylesheet guard reloaded on a single dead sheet — too eager'
    );

  // RE-ARMING (#752). The cases above each use a fresh context, so they say
  // nothing about the rule that actually decides a SECOND recovery. That rule was
  // "never" — once per tab, forever — which stranded exactly the visitors this
  // guard exists for: a tab open long enough for its assets to expire is a tab
  // likely to have recovered once already.
  //
  // Both directions are asserted, because the change is only correct if it moved
  // one of them and left the other alone. One context, two loads: sessionStorage
  // is per-tab, so reusing it is the whole point.
  const runGuardTwice = async ({ ageOutMs }) => {
    const statuses = [404, 404];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    statuses.forEach((_, i) =>
      page.route(`**/g${i}.css`, (r) => r.fulfill({ status: 404, body: '' }))
    );
    await page.route('**/guard.html*', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'text/html',
        body: guardPage(statuses),
      })
    );

    await page.goto('http://guard.test/guard.html', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const first = /_r=/.test(page.url());

    // Backdate the stored recovery so the next load sees an OLD one. Faking the
    // clock rather than waiting an hour, and the only thing being faked is the
    // passage of time.
    if (ageOutMs) {
      await page.evaluate((ms) => {
        sessionStorage.setItem(
          'sh-stylesheet-recovered',
          String(Date.now() - ms)
        );
      }, ageOutMs);
    }

    // A URL the guard has not already rewritten, so `_r=` can only appear if it
    // recovered a second time.
    await page.goto('http://guard.test/guard.html?second=1', {
      waitUntil: 'load',
    });
    await page.waitForTimeout(1200);
    const second = /_r=/.test(page.url());
    await ctx.close();
    return { first, second };
  };

  // Positive control: this harness must be able to reach success at all. Without
  // it, an anti-loop assertion passes just as well when the guard never fires.
  const reArmed = await runGuardTwice({ ageOutMs: 2 * 3600000 });
  console.log(
    `  broke again an hour on -> ${reArmed.second ? 'recovered again (correct)' : 'STILL DISARMED (wrong)'}`
  );
  if (!reArmed.first)
    failures.push(
      're-arm harness never recovered on its FIRST load, so its second-load result ' +
        'proves nothing — fix the harness before reading the assertion below'
    );
  if (reArmed.first && !reArmed.second)
    failures.push(
      'the stylesheet guard did not re-arm after an hour — a tab that recovered ' +
        'once stays unstyled forever, which is #752'
    );

  // And the reason the limit exists at all: a genuine loop retries in seconds.
  const looped = await runGuardTwice({ ageOutMs: 0 });
  console.log(
    `  broke again immediately-> ${looped.second ? 'RELOADED AGAIN (loop risk)' : 'blocked (correct)'}`
  );
  if (looped.second)
    failures.push(
      'the stylesheet guard recovered twice in a row with no delay — that is a ' +
        'reload loop, which is strictly worse than an unstyled page'
    );
}

await browser.close();
server.close();
await rm(WORK, { recursive: true, force: true });

if (failures.length) {
  console.error('\nSTALE-HTML CHECK FAILED');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  '\nSTALE-HTML CHECK PASSED — a returning visitor is styled across a deploy, and across two.'
);
