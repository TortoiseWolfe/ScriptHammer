#!/usr/bin/env node
/**
 * No route may tell search engines to index a DIFFERENT route (#668).
 *
 * THE FAILURE THIS ENDS. `alternates.canonical` set on the root layout is inherited
 * by every route that does not override it. The root correctly claimed `/`, so **83
 * of 100 routes shipped `<link rel="canonical" href="https://scripthammer.com/">`** —
 * each one asking Google to drop it in favour of the front page. `/pricing`, `/docs`,
 * `/blog` and 80 others were requesting their own removal, and `og:url` came with it,
 * so sharing `/pricing` unfurled as the homepage.
 *
 * WHY IT CHECKS THE BUILD, NOT THE SOURCE. A source scan would have to model Next's
 * metadata inheritance to say anything true, and that inheritance IS the bug. The
 * emitted HTML is the only artifact where the question "what does this page actually
 * claim" has an answer.
 *
 * ABSENCE IS FINE, AND THAT IS THE POINT. A page with no canonical is self-canonical
 * by default — search engines use the URL they fetched. A page pointing elsewhere is
 * an instruction. So this fails on WRONG, never on MISSING, and reports the missing
 * count so the coverage is visible rather than assumed (#396).
 *
 * Usage: node scripts/ci/check-canonicals.mjs [outDir]
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const OUT = process.argv[2] || 'out';

/**
 * Cross-canonicals that are deliberate. Each needs a reason, because the whole
 * failure mode here is a canonical nobody chose.
 */
const ALLOWED_CROSS = new Map([
  [
    '/chatt/',
    {
      to: '/twins/chatt/',
      why: '/chatt/ is the shareable alias; /twins/chatt/ is the canonical viewer route (src/app/chatt/page.tsx)',
    },
  ],
]);

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

/** `out/pricing/index.html` -> `/pricing/` */
const routeOf = (file) => {
  const rel = relative(OUT, file).split(sep).join('/');
  const noIndex = rel.replace(/index\.html$/, '').replace(/\.html$/, '/');
  return '/' + noIndex.replace(/^\/+/, '');
};

/**
 * THE PREFIX A CANONICAL CARRIES IS NOT THE basePath (#964).
 *
 * `routeOf()` above is relative to out/, so it never carries a prefix. A canonical
 * href carries `new URL(projectConfig.deployUrl).pathname`, which on a GitHub Pages
 * PROJECT site is `/<repo>`. Compared raw, the two can only ever be equal when that
 * prefix is empty — so this gate passed here and failed EVERY route of EVERY fork.
 * Measured on a real one: 85 then 102 "cross-canonicals", none of them real.
 *
 * WHY NOT JUST READ basePath. Because they are different quantities, and this repo is
 * the counter-example: basePath is `/ScriptHammer` while its canonicals read
 * `https://scripthammer.com/` — non-empty basePath, zero prefix. Subtracting basePath
 * would break the deployment this gate exists to protect.
 *
 * So derive the prefix from the export's own root canonical, which IS that quantity by
 * construction and needs no repo context — it works against a tmpdir fixture. The
 * fallbacks are only for an export whose root claims nothing; resolve project-detected
 * from this file, never from cwd, or the fallback silently misses under a fixture.
 */
async function derivePrefix(outDir) {
  try {
    const root = await readFile(join(outDir, 'index.html'), 'utf8');
    const m = root.match(CANONICAL_RE);
    if (m) {
      return {
        prefix: new URL(m[1]).pathname.replace(/\/+$/, ''),
        source: 'the export root canonical',
      };
    }
  } catch {
    /* fall through to the config */
  }
  try {
    const cfg = JSON.parse(
      await readFile(
        new URL('../../src/config/project-detected.json', import.meta.url),
        'utf8'
      )
    );
    return {
      prefix: (cfg.basePath || '').replace(/\/+$/, ''),
      source: 'src/config/project-detected.json',
    };
  } catch {
    /* fall through to the env */
  }
  return {
    prefix: (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, ''),
    source: 'NEXT_PUBLIC_BASE_PATH',
  };
}

const CANONICAL_RE = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i;

let checked = 0;
let selfCanonical = 0;
let missing = 0;
let allowed = 0;
const wrong = [];

const { prefix: BASE, source: BASE_SOURCE } = await derivePrefix(OUT);

for await (const file of htmlFiles(OUT)) {
  const route = routeOf(file);
  // 404 has no canonical URL of its own to claim.
  if (route === '/404/' || route === '/404.html') continue;

  const html = await readFile(file, 'utf8');
  const m = CANONICAL_RE.exec(html);
  checked++;

  if (!m) {
    missing++;
    continue;
  }

  let declared;
  try {
    declared = new URL(m[1]).pathname;
  } catch {
    wrong.push({ route, declared: m[1], note: 'not a URL' });
    continue;
  }

  // Only where it actually leads: an off-prefix or off-site canonical shares no
  // prefix, nothing is stripped, and it still fails. Subtracting unconditionally
  // would turn this gate off rather than fix it.
  if (BASE && declared.startsWith(BASE + '/'))
    declared = declared.slice(BASE.length);

  if (declared === route) {
    selfCanonical++;
    continue;
  }

  const exception = ALLOWED_CROSS.get(route);
  if (exception && exception.to === declared) {
    allowed++;
    continue;
  }

  wrong.push({ route, declared });
}

console.log(`  checked          ${checked} route(s) in ${OUT}/`);
if (BASE)
  console.log(
    `  prefix           ${BASE}  (from ${BASE_SOURCE}; subtracted before comparing)`
  );
console.log(`  self-canonical   ${selfCanonical}`);
console.log(
  `  no canonical     ${missing}  (fine — a page with none is self-canonical)`
);
console.log(`  allowed cross    ${allowed}`);
console.log(`  WRONG            ${wrong.length}`);

// A run that inspected nothing must not pass. This suite's own history is full of
// gates that were green because they were looking at an empty list (#396, #411).
if (checked < 20) {
  console.error(
    `::error::only ${checked} HTML file(s) found under ${OUT}/ — expected the full ` +
      `static export. This check is not looking at the site.`
  );
  process.exit(1);
}

if (wrong.length) {
  console.log('');
  for (const w of wrong.slice(0, 40)) {
    console.log(
      `   ${w.route}  ->  ${w.declared}${w.note ? `  (${w.note})` : ''}`
    );
  }
  if (wrong.length > 40) console.log(`   … and ${wrong.length - 40} more`);
  console.error(
    `\n::error::${wrong.length} route(s) declare a canonical pointing at a different ` +
      `URL. Each one asks a search engine to index that other page INSTEAD of itself. ` +
      `If a cross-canonical is deliberate, add it to ALLOWED_CROSS with a reason.`
  );
  process.exit(1);
}

console.log('\n  OK — every route claims itself, or claims nothing.');
