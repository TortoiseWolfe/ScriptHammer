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
import { readFile, cp, rm, readdir, rename, writeFile, copyFile as cpFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const OUT = resolve('out');
const WORK = resolve('.stale-check');
const DIR_A = join(WORK, 'a');
const DIR_B = join(WORK, 'b');
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

/** Build B = build A with every stylesheet renamed and all references updated. */
async function makeBuildB() {
  await rm(WORK, { recursive: true, force: true });
  await cp(OUT, DIR_A, { recursive: true });
  await cp(OUT, DIR_B, { recursive: true });

  const cssDir = join(DIR_B, '_next/static/css');
  const files = (await readdir(cssDir)).filter((f) => f.endsWith('.css'));
  if (!files.length) throw new Error('build has no CSS to rename');

  const renames = [];
  for (const f of files) {
    // A deterministic but different hash, so B cannot accidentally serve A's
    // filenames — which is precisely what GitHub Pages does on deploy.
    const next = f.replace(/^[a-f0-9]+/, (h) =>
      h.split('').reverse().join('').replace(/[a-f]/g, (c) => (c === 'f' ? 'a' : 'f'))
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
  await walk(DIR_B);

  // B must also ship a DIFFERENT service worker, as a real deploy does — the
  // worker stamps CACHE_VERSION with the commit SHA.
  const swPath = join(DIR_B, 'sw.js');
  if (existsSync(swPath)) {
    const sw = await readFile(swPath, 'utf8');
    const bumped = sw.replace(
      /const CACHE_VERSION = '([^']+)'/,
      (_m, v) => `const CACHE_VERSION = '${v}-buildB'`
    );
    if (bumped === sw) throw new Error('could not bump CACHE_VERSION in build B');
    await writeFile(swPath, bumped);
  }

  // Assert the simulation is faithful: A's stylesheet names must NOT exist in B.
  for (const [from] of renames) {
    if (existsSync(join(cssDir, from)))
      throw new Error(`build B still contains ${from} — deploy not simulated`);
  }
  console.log(
    `build B: renamed ${renames.length} stylesheet(s), rewrote ${rewritten} file(s), bumped the worker`
  );
  return renames;
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
  const rel = BASE_PATH && url.startsWith(BASE_PATH) ? url.slice(BASE_PATH.length) || '/' : url;
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

const renames = await makeBuildB();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const base = `http://127.0.0.1:${PORT}`;

const browser = await chromium.launch();
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
  .waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 8000 })
  .catch(() => {});
const a = await styled(page);
console.log(`    rules=${a.rules} headerH=${a.headerH} bg=${a.bodyBg} swControlled=${a.sw}`);
if (a.rules < 100)
  failures.push(`build A was not styled to begin with (${a.rules} rules) — the harness is wrong, not the app`);

console.log('\n--- DEPLOY: document root swaps to build B, A\'s stylesheets are gone');
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
console.log(`    rules=${b.rules} headerH=${b.headerH} bg=${b.bodyBg} swControlled=${b.sw}`);
if (missing.length)
  console.log(`    404s for build A assets: ${[...new Set(missing)].join(', ')}`);

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
console.log('\n--- stale HTML, COLD asset cache (a route the visitor had not loaded)');
const cold = await browser.newContext();
const coldPage = await cold.newPage();
missing.length = 0;
await coldPage.goto(`${base}${BASE_PATH}/`, { waitUntil: 'load' });
await coldPage.waitForTimeout(2500);
const c = await styled(coldPage);
console.log(`    rules=${c.rules} headerH=${c.headerH} bg=${c.bodyBg} swControlled=${c.sw}`);
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
  await cpFile(join(DIR_A, '_next/static/css', from), join(DIR_B, '_next/static/css', from));
}
const kept = await browser.newContext();
const keptPage = await kept.newPage();
missing.length = 0;
await keptPage.goto(`${base}${BASE_PATH}/`, { waitUntil: 'load' });
await keptPage.waitForTimeout(2500);
const k = await styled(keptPage);
console.log(`    rules=${k.rules} headerH=${k.headerH} bg=${k.bodyBg} swControlled=${k.sw}`);
if (missing.length) console.log(`    404s: ${[...new Set(missing)].slice(0, 3).join(', ')}`);
await kept.close();

if (k.rules < 100)
  failures.push(
    `RETENTION DID NOT HELP: still ${k.rules} CSS rules with the old assets present`
  );
if (k.headerH > 200) failures.push(`still unstyled with retention: header ${k.headerH}px`);
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

await browser.close();
server.close();
await rm(WORK, { recursive: true, force: true });

if (failures.length) {
  console.error('\nSTALE-HTML CHECK FAILED');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nSTALE-HTML CHECK PASSED — a returning visitor is styled across a deploy.');
