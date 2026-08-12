#!/usr/bin/env node
// First-load budget gate (#291): three.js must not ship in the initial payload
// of any NON-3D route.
//
// The bug this closes: the webpack `vendor` cacheGroup has a fixed name, so it
// merges every node_modules module it claims — including async-only ones like
// three — into ONE initial chunk that loads on EVERY route. A `dynamic(...,
// {ssr:false})` boundary does NOT rescue a library from it; only a dedicated
// priority-20 cacheGroup does (see next.config.ts). three shipped a 2.66MB
// initial chunk on the homepage, blog, docs, etc. This passed lint, type-check,
// unit tests AND `next build` — nothing measured it. This gate does.
//
// ── WHY THIS NO LONGER GREPS BUNDLES (#636, rewritten 2026-08-07) ────────────
//
// The original matched /WebGLRenderer|BufferGeometry/ against emitted JS. On
// 2026-08-06 an application module gained the log line
//
//     console.warn('[materials] no WebGLRenderer available yet — deferring…')
//
// and landed in `common`. This gate then reported "three.js ships in the initial
// payload of 125 non-3D routes" and blocked every deploy for hours. Measured:
// `common` contained 0 BufferGeometry and 1 WebGLRenderer — the log string —
// while the real three chunk held 42 and 37 and was async-only, referenced by no
// HTML at all. The #291 split had never stopped working.
//
// A string match cannot tell a library from a log message. It also cannot see
// first-party code, so it simultaneously MISSED the real regression: src/lib/cod,
// the 3D-only toolkit, is in `common`, which is initial on every route.
//
// The old header worried about the opposite failure — a mangled symbol giving a
// false PASS — and concluded "do not use one". The lesson generalises further
// than it was taken: do not identify code by the strings inside it.
//
// So the build now tells us WHAT IS IN each chunk: `next.config.ts` emits
// `chunk-modules.json`, mapping every emitted chunk to the packages and source
// paths it actually contains. Module identity is immune to minification, to log
// strings, and to a three upgrade renaming a class.
//
// WHICH CHUNKS A ROUTE LOADS still comes from the exported HTML, deliberately.
// `app-build-manifest.json` looked like a cleaner source and is NOT equivalent —
// measured 2026-08-07, it omits `app/layout-*.js`, `app/global-error-*.js` and
// `polyfills-*.js` from every route (5 entries vs the HTML's 8). The root layout
// chunk loads on every page, so trusting the manifest would have created a
// silent false NEGATIVE in the exact place a leak is most likely to hide. The
// HTML is what the browser actually fetches; that is the thing worth asserting.
//
// Usage: node scripts/check-first-load-budget.mjs [outDir] [mapFile]
//        defaults: out .chunk-modules.json
//
// Both defaults are REPO-ROOT paths on purpose. The build runs in the `builder`
// container and the gate runs in the dev container (validate-ci.sh:54); only the
// bind mount crosses between them. A map written into the builder's private
// .next volume is invisible here — see the note in next.config.ts.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = process.argv[2] || 'out';
const MAP = process.argv[3] || '.chunk-modules.json';

/**
 * Packages that must never reach a non-3D route's initial payload.
 * Matched against the package names chunk-modules.json records, so a rename
 * inside three cannot slip past and an app string cannot trigger it.
 */
const THREE_PKGS = [
  'three',
  'three-stdlib',
  'three-mesh-bvh',
  '@react-three/fiber',
  '@react-three/drei',
  'troika-three-text',
  'troika-three-utils',
  'meshline',
  'camera-controls',
  'maath',
  'postprocessing',
];

/**
 * First-party 3D code. Not a library, so the old grep could never have seen it.
 *
 * This is a hard failure. #638 removed the fixed `common` cacheGroup name that
 * had made these modules initial on every route; letting one back into a
 * non-3D route would reintroduce that regression silently.
 */
const FIRST_PARTY_3D = [
  'src/lib/cod/',
  'src/world/',
  'src/stage/',
  'src/twin/',
];

/**
 * `GlobalNav` uses this tiny, pure URL parser on every route to keep the map
 * link's selected state correct. It lives under `src/twin/` for its two canvas
 * callers too, but imports neither a renderer nor a 3D library — its path
 * alone must not make the gate lie. Keep this exception to the exact module;
 * every other module under the prefixes above remains protected.
 */
const FIRST_PARTY_NON_3D = new Set(['src/twin/renderer-select.ts']);
const isFirstParty3D = (module) =>
  !FIRST_PARTY_NON_3D.has(module) &&
  FIRST_PARTY_3D.some((prefix) => module.startsWith(prefix));

/** Routes allowed to load three, matched against the exported route path. */
const THREE_OK = [
  /^\/chatt/,
  /^\/twins/,
  /^\/game\/3d/,
  // Present in the export and genuinely 3D. Its absence was a second latent
  // false positive waiting for someone to visit it.
  /^\/game\/cod-skeleton/,
];

function readJson(p, what) {
  if (!existsSync(p)) {
    console.error(
      `check-first-load-budget: ${what} not found at ${p}. ` +
        `Run a PRODUCTION build first (dev builds deliberately do not write it), ` +
        `or pass the path as the second argument. Refusing to pass blind.`
    );
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (err) {
    console.error(
      `check-first-load-budget: ${p} is not valid JSON: ${err.message}`
    );
    process.exit(1);
  }
}

const chunkModules = readJson(
  MAP,
  'the chunk→module map (emitted by next.config.ts during `next build`)'
);
function walk(dir, test) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p, test));
    else if (test(name)) out.push(p);
  }
  return out;
}

const htmlFiles = walk(OUT, (n) => n === 'index.html');
if (htmlFiles.length === 0) {
  console.error(
    `check-first-load-budget: no index.html under ${OUT} — did the export run? Refusing to pass blind.`
  );
  process.exit(1);
}

/**
 * Chunk keys differ between the two sources in two ways, both of which would
 * otherwise make a lookup miss and read as "no modules, therefore clean":
 *
 *  - prefix — the HTML says `_next/static/chunks/x.js`, the map `static/chunks/x.js`
 *  - ENCODING — dynamic segments are percent-encoded in the HTML but literal on
 *    disk: `chunks/app/blog/%5Bslug%5D/page-<hash>.js` vs `.../[slug]/...`.
 *    Three of the four chunks the guard first rejected were only this.
 */
const tail = (ref) => {
  let t = ref.replace(/^.*?_?next\//, '').replace(/^static\//, '');
  try {
    t = decodeURIComponent(t);
  } catch {
    // Malformed escape — keep the raw form rather than throwing. A miss here
    // surfaces as an unknown chunk below, which fails loudly.
  }
  return t;
};
const byTail = new Map(
  Object.entries(chunkModules).map(([file, mods]) => [tail(file), mods])
);
const modulesIn = (ref) => byTail.get(tail(ref)) ?? null;

// The three library must exist SOMEWHERE, or the map is wrong and every check
// below would pass for the wrong reason. This is the "refuse to pass blind"
// guard from the original, kept because it would also have caught the earlier
// three.<hash>.js vs three-<hash>.js confusion.
const chunksWithThree = Object.entries(chunkModules).filter(([, mods]) =>
  mods.some((m) => THREE_PKGS.includes(m))
);
if (chunksWithThree.length === 0) {
  console.error(
    'check-first-load-budget: no chunk contains three at all. Either the build is ' +
      'empty or chunk-modules.json is stale/wrong. Refusing to pass blind.'
  );
  process.exit(1);
}

const violations = [];
const firstPartyViolations = [];
let checked = 0;

const unknownChunks = new Set();

for (const html of htmlFiles) {
  const route = '/' + relative(OUT, html).split(sep).slice(0, -1).join('/');
  if (THREE_OK.some((re) => re.test(route))) continue;
  checked++;

  const refs = [
    ...new Set(
      [
        ...readFileSync(html, 'utf8').matchAll(
          /_next\/static\/(chunks\/[^"']+?\.js)/g
        ),
      ].map((m) => m[1])
    ),
  ];

  const libs = new Set();
  const firstParty = new Set();
  for (const ref of refs) {
    const mods = modulesIn(ref);
    if (mods === null) {
      // A chunk the HTML loads that the module map does not describe. Never treat
      // that as clean — it is indistinguishable from "contains three" until seen.
      unknownChunks.add(ref);
      continue;
    }
    for (const m of mods) {
      if (THREE_PKGS.includes(m)) libs.add(`${m} (${ref})`);
      else if (isFirstParty3D(m)) firstParty.add(m);
    }
  }
  if (libs.size) violations.push({ route, hits: [...libs] });
  if (firstParty.size)
    firstPartyViolations.push({ route, hits: [...firstParty] });
}

if (unknownChunks.size) {
  console.error(
    `\ncheck-first-load-budget: ${unknownChunks.size} chunk(s) referenced by the export ` +
      `are absent from chunk-modules.json, so their contents are unknown:`
  );
  for (const c of [...unknownChunks].slice(0, 8)) console.error(`   ${c}`);
  console.error(
    'The module map is stale or incomplete. Rebuild; if it persists the emit plugin ' +
      'in next.config.ts is not seeing every chunk. Refusing to pass blind.'
  );
  process.exit(1);
}

if (violations.length || firstPartyViolations.length) {
  if (violations.length) {
    console.error(
      `\n❌ three.js ships in the initial payload of ${violations.length} non-3D route(s) (#291):`
    );
    for (const v of violations) {
      console.error(`   ${v.route}`);
      for (const h of v.hits) console.error(`     → ${h}`);
    }
  }
  if (firstPartyViolations.length) {
    console.error(
      `\n❌ first-party 3D code ships in the initial payload of ${firstPartyViolations.length} non-3D route(s) (#638):`
    );
    for (const v of firstPartyViolations) {
      console.error(`   ${v.route}`);
      for (const h of v.hits) console.error(`     → ${h}`);
    }
  }

  if (violations.length) {
    console.error(
      '\nAdd/extend the `three` cacheGroup in next.config.ts, or remove the static ' +
        '`three` import that a non-3D route reaches. See scripts/check-first-load-budget.mjs.'
    );
  }
  if (firstPartyViolations.length) {
    console.error(
      '\nKeep first-party 3D modules behind their 3D route boundaries. In particular, ' +
        'do not restore a fixed name to the `common` cacheGroup in next.config.ts.'
    );
  }
  process.exit(1);
}

console.log(
  `✅ first-load budget: three (${chunksWithThree.length} chunk(s)) and first-party 3D code are absent from ` +
    `all ${checked} non-3D route(s)`
);
