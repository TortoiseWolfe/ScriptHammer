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
// It also catches a subtler leak: a STATIC `import ... from 'three'` reachable
// from a non-3D route (e.g. a color util used by the blog's Disqus embed) drags
// the whole three chunk onto that route even WITH the cacheGroup. A homepage-
// only check would miss it; this checks every non-3D route.
//
// Method: find which emitted chunks contain three (a minification-SURVIVING
// string — a mangled symbol would give a false pass, #291 gotcha #2), then
// assert no non-3D route's HTML references one of them.
//
// Usage: node scripts/check-first-load-budget.mjs [outDir]   (default: out)

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = process.argv[2] || 'out';
const CHUNKS = join(OUT, '_next', 'static', 'chunks');

// Strings that survive terser minification (class names kept as property keys /
// in error messages). `BufferGeometry` and `WebGLRenderer` both survived in the
// #291 investigation; a mangled internal symbol did NOT — do not use one.
const THREE_MARKER = /WebGLRenderer|BufferGeometry/;

// Routes ALLOWED to load three (the only ones that render R3F/three). Paths are
// relative to OUT, forward-slashed. Everything else must be three-free.
const THREE_OK = [/^chatt\//, /^twins\//, /^game\/3d\//];

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
    else if (test(name, p)) out.push(p);
  }
  return out;
}

const chunkFiles = walk(CHUNKS, (n) => n.endsWith('.js'));
if (chunkFiles.length === 0) {
  console.error(
    `check-first-load-budget: no .js chunks under ${CHUNKS} — did the build/export run first?`
  );
  process.exit(1);
}

// 1. Which chunk refs contain three? Key = "_next/static/chunks/<relpath>.js"
//    (prefix-agnostic; the HTML may carry an assetPrefix/basePath in front).
const threeChunkRefs = new Set();
for (const f of chunkFiles) {
  if (THREE_MARKER.test(readFileSync(f, 'utf8'))) {
    threeChunkRefs.add(
      '_next/static/chunks/' + relative(CHUNKS, f).split(sep).join('/')
    );
  }
}
if (threeChunkRefs.size === 0) {
  console.error(
    'check-first-load-budget: no chunk matched the three marker — the marker may be stale (three upgraded?) or the build is empty. Refusing to pass blind.'
  );
  process.exit(1);
}

// 2. Every non-3D route's HTML must reference none of them.
const htmlFiles = walk(OUT, (n) => n === 'index.html');
const violations = [];
for (const html of htmlFiles) {
  const rel = relative(OUT, html).split(sep).join('/');
  if (THREE_OK.some((re) => re.test(rel))) continue; // 3D route — three allowed
  const src = readFileSync(html, 'utf8');
  const refs = [...src.matchAll(/(_next\/static\/chunks\/[^"']+?\.js)/g)].map(
    (m) => m[1]
  );
  const bad = refs.filter((r) => threeChunkRefs.has(r));
  if (bad.length) violations.push({ rel, bad: [...new Set(bad)] });
}

if (violations.length) {
  console.error(
    `\n❌ three.js ships in the initial payload of ${violations.length} non-3D route(s) (#291):`
  );
  for (const v of violations) {
    console.error(`   /${v.rel}`);
    for (const b of v.bad) console.error(`     → ${b}`);
  }
  console.error(
    '\nAdd/extend the `three` cacheGroup in next.config.ts, or remove the static ' +
      '`three` import that a non-3D route reaches. See scripts/check-first-load-budget.mjs.'
  );
  process.exit(1);
}

console.log(
  `✅ first-load budget: three.js (${threeChunkRefs.size} chunk(s)) is absent from all ${htmlFiles.length - htmlFiles.filter((h) => THREE_OK.some((re) => re.test(relative(OUT, h).split(sep).join('/')))).length} non-3D route(s)`
);
