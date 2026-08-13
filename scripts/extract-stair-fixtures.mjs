#!/usr/bin/env node
/**
 * Extract REAL staircases from the shipped landmark GLBs into test fixtures (#705).
 *
 * WHY THIS EXISTS. The walk/ride physics were twice declared fixed on the strength of
 * tests built from geometry I wrote myself — `BoxGeometry` stairs with 0.6 m treads. The
 * shipped SketchUp landmarks look nothing like that, and a fixture that cannot express the
 * real asset's properties cannot falsify a bug in handling them. This script pulls the
 * actual triangles out of the actual GLBs so the harness runs on what the player walks on.
 *
 * WHY A SCRIPT AND NOT A ONE-OFF DUMP. An earlier attempt measured stair-climbing live in
 * the browser and produced 16/24 on one run and 12/24 on the next for the SAME
 * configuration — state leaking between trials. A measurement that cannot be repeated
 * cannot support a conclusion, and tuning constants against it is how the last two "fixes"
 * happened. Committing the extractor means the fixture is regenerable and the numbers are
 * reproducible by anyone.
 *
 * WHAT IT EMITS. For each selected staircase: every triangle within `RADIUS_M` of it (walls
 * and railings included — they are part of whether you can get up), in metres, plus the
 * ascent direction derived from the geometry itself.
 *
 * Run: docker compose exec scripthammer node scripts/extract-stair-fixtures.mjs
 */
globalThis.self = globalThis; // the meshopt decoder module expects a worker/browser global

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = join(ROOT, 'public', 'twins', 'chatt', 'models');
const OUT = join(ROOT, 'tests', 'fixtures', 'stairs');

/** Level bucket height, m — finer than any real riser, coarse enough to absorb noise. */
const BUCKET = 0.02;
/** A run of levels this far apart vertically is a flight of stairs. */
const MIN_RISER = 0.08;
const MAX_RISER = 0.4;
/** Stair tread (going) bounds, m — a real flight is ~0.25-0.30 m per step. */
const MIN_TREAD = 0.15;
const MAX_TREAD = 0.6;
/** Minimum steps to call it a staircase rather than a ledge. */
const MIN_STEPS = 5;
/** How much of the surrounding model to keep, m. Walls and railings decide climbability. */
const RADIUS_M = 10;
/** How many staircases to commit. Kept small — fixtures are read every test run. */
const KEEP = 4;
/**
 * Landmarks captured by name whatever the detector thinks (#705, #706).
 *
 * The owner walked to `hair-of-the-dog-pub`, pressed E, and named it. Its "staircase" is a
 * single smooth 35.3 deg ramp, so the level-scan above finds nothing there — and a
 * building a human reported cannot be dropped because a heuristic disagrees. Named entries
 * are always emitted, with the ramp geometry the scan misses.
 */
const ALWAYS = ['hair-of-the-dog-pub'];
/** A walkable ramp: sloped, upward, and big enough to stand on. */
const RAMP_MIN_DEG = 15;
const RAMP_MAX_DEG = 50;
const RAMP_MIN_AREA = 2;

function loadGltf(file) {
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((resolve) => {
    loader.parse(ab, '', resolve, () => resolve(null));
  });
}

/** World-space triangles of a subtree, scaled to the placement scale the app uses. */
function triangles(root, scale) {
  root.updateWorldMatrix(true, true);
  const out = [];
  const v = { x: 0, y: 0, z: 0 };
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    const e = o.matrixWorld.elements;
    for (let i = 0; i < n; i++) {
      const vi = idx ? idx.getX(i) : i;
      // getX/Y/Z denormalize quantized attributes — the exact trap that made collision
      // land 32767x too large in #704. Never read `.array` here.
      const px = pos.getX(vi), py = pos.getY(vi), pz = pos.getZ(vi);
      v.x = e[0] * px + e[4] * py + e[8] * pz + e[12];
      v.y = e[1] * px + e[5] * py + e[9] * pz + e[13];
      v.z = e[2] * px + e[6] * py + e[10] * pz + e[14];
      out.push(v.x * scale, v.y * scale, v.z * scale);
    }
  });
  return out;
}

/** Find flights of stairs: runs of evenly spaced, upward-facing horizontal levels. */
function findStairs(tris) {
  const levels = new Map();
  for (let p = 0; p < tris.length; p += 9) {
    const ax = tris[p], ay = tris[p + 1], az = tris[p + 2];
    const e1x = tris[p + 3] - ax, e1y = tris[p + 4] - ay, e1z = tris[p + 5] - az;
    const e2x = tris[p + 6] - ax, e2y = tris[p + 7] - ay, e2z = tris[p + 8] - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9 || ny / l < 0.9) continue; // walkable-flat only
    const key = Math.round(ay / BUCKET) * BUCKET;
    let e = levels.get(key);
    if (!e) levels.set(key, (e = { n: 0, x: 0, z: 0 }));
    e.n++; e.x += ax; e.z += az;
  }
  const ys = [...levels.keys()].sort((a, b) => a - b);
  const runs = [];
  let start = 0;
  for (let i = 1; i <= ys.length; i++) {
    const gap = i < ys.length ? ys[i] - ys[i - 1] : Infinity;
    if (gap >= MIN_RISER && gap <= MAX_RISER) continue;
    const steps = i - start;
    if (steps >= MIN_STEPS) {
      const bot = levels.get(ys[start]);
      const top = levels.get(ys[i - 1]);
      const bx = bot.x / bot.n, bz = bot.z / bot.n;
      const tx = top.x / top.n, tz = top.z / top.n;
      const dx = tx - bx, dz = tz - bz;
      const run = Math.hypot(dx, dz);
      // A flight must actually GO somewhere horizontally AND have stair-sized treads.
      //
      // Without the tread test this picks up tiered plazas and stepped facades: the first
      // run selected a "6-step flight" whose levels were 16.5 m apart and a "17-step
      // flight" spanning 20 m. Driving a body at those produced 0.00 m of climb, which
      // reads as a physics bug and is really a detector bug — the body was walking across
      // open ground toward nothing. Real treads are ~0.25-0.30 m.
      const tread = run / (steps - 1);
      if (run > 0.4 && tread >= MIN_TREAD && tread <= MAX_TREAD) {
        runs.push({
          steps,
          baseY: ys[start],
          topY: ys[i - 1],
          rise: ys[i - 1] - ys[start],
          riser: (ys[i - 1] - ys[start]) / (steps - 1),
          run,
          base: [bx, bz],
          // Unit vector pointing UP the flight, from the geometry itself — no guessing
          // at approach angles, which is what made the live measurement irreproducible.
          ascend: [dx / run, dz / run],
        });
      }
    }
    start = i;
  }
  return runs;
}

/** Largest walkable sloped face, with the direction that goes UP it. */
function findRamp(tris) {
  let best = null;
  for (let p = 0; p < tris.length; p += 9) {
    const ax = tris[p], ay = tris[p + 1], az = tris[p + 2];
    const e1x = tris[p + 3] - ax, e1y = tris[p + 4] - ay, e1z = tris[p + 5] - az;
    const e2x = tris[p + 6] - ax, e2y = tris[p + 7] - ay, e2z = tris[p + 8] - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const L = Math.hypot(nx, ny, nz);
    if (L < 1e-9) continue;
    const up = ny / L;
    if (up < 0.2) continue;
    const deg = (Math.acos(Math.min(1, up)) * 180) / Math.PI;
    if (deg < RAMP_MIN_DEG || deg > RAMP_MAX_DEG) continue;
    const area = L / 2;
    if (area < RAMP_MIN_AREA) continue;
    if (best && area <= best.area) continue;
    // Steepest ascent on the plane, flattened to the horizontal.
    const dx = -nx * ny, dz = -nz * ny;
    const dl = Math.hypot(dx, dz) || 1;
    const ys = [ay, tris[p + 4], tris[p + 7]];
    const lo = ys.indexOf(Math.min(...ys));
    const v = [[ax, ay, az], [tris[p + 3], tris[p + 4], tris[p + 5]], [tris[p + 6], tris[p + 7], tris[p + 8]]];
    best = {
      kind: 'ramp', deg, area,
      baseY: v[lo][1], topY: Math.max(...ys),
      rise: Math.max(...ys) - v[lo][1],
      base: [v[lo][0], v[lo][2]],
      ascend: [dx / dl, dz / dl],
      steps: 1, riser: 0, run: 0,
    };
  }
  return best;
}

const list = JSON.parse(readFileSync(join(MODELS, 'models.json'), 'utf8'));
const entries = list.models ?? list;

const candidates = [];
for (const entry of entries) {
  const file = join(MODELS, entry.file);
  if (!existsSync(file)) continue;
  const gltf = await loadGltf(file);
  if (!gltf) continue;
  // LOD0 is what the app renders and therefore what it bakes into collision.
  const root = gltf.scene.getObjectByName('LOD0') ?? gltf.scene;
  const tris = triangles(root, entry.scale ?? 1);
  if (!tris.length) continue;
  for (const s of findStairs(tris)) {
    candidates.push({ entry, tris, stair: s });
  }
  if (ALWAYS.includes(entry.slug)) {
    const ramp = findRamp(tris);
    if (ramp) candidates.push({ entry, tris, stair: ramp, forced: true });
  }
}

candidates.sort((a, b) => b.stair.steps - a.stair.steps);
mkdirSync(OUT, { recursive: true });

const index = [];
const usedSlugs = new Set();
candidates.sort((a, b) => (b.forced ? 1 : 0) - (a.forced ? 1 : 0));
for (const c of candidates) {
  if (!c.forced && index.length >= KEEP) break;
  if (usedSlugs.has(c.entry.slug)) continue; // one flight per landmark, for variety
  usedSlugs.add(c.entry.slug);
  const { stair, tris } = c;
  const [bx, bz] = stair.base;
  const keep = [];
  for (let p = 0; p < tris.length; p += 9) {
    let near = false;
    for (let v = 0; v < 3 && !near; v++) {
      const dx = tris[p + v * 3] - bx, dz = tris[p + v * 3 + 2] - bz;
      if (dx * dx + dz * dz <= RADIUS_M * RADIUS_M) near = true;
    }
    if (near) for (let k = 0; k < 9; k++) keep.push(Math.round(tris[p + k] * 1000) / 1000);
  }
  // REJECT A FIXTURE THAT CANNOT TEST ANYTHING. A level's centroid is an average, so on a
  // ring-shaped or courtyard building it can land in open space with no geometry within
  // RADIUS_M — the first run of this script emitted one such fixture with ZERO triangles.
  // A harness loading it would report "cannot climb" against an empty world, or pass
  // against nothing at all. Both are lies, so the fixture never gets written.
  const kept = keep.length / 9;
  if (kept < 60) {
    console.log(
      `  SKIP ${c.entry.slug} — only ${kept} triangles within ${RADIUS_M} m of the ` +
        `flight (centroid fell in open space); an empty fixture cannot test anything`
    );
    usedSlugs.delete(c.entry.slug);
    continue;
  }
  let ymin = Infinity, ymax = -Infinity;
  for (let p = 1; p < keep.length; p += 3) {
    if (keep[p] < ymin) ymin = keep[p];
    if (keep[p] > ymax) ymax = keep[p];
  }
  if (ymax - ymin < stair.rise * 0.9) {
    console.log(
      `  SKIP ${c.entry.slug} — kept geometry spans ${(ymax - ymin).toFixed(2)} m but the ` +
        `flight rises ${stair.rise.toFixed(2)} m; the staircase itself is not in the fixture`
    );
    usedSlugs.delete(c.entry.slug);
    continue;
  }

  const fixture = {
    slug: c.entry.slug,
    source: c.entry.file,
    note: 'Generated by scripts/extract-stair-fixtures.mjs — do not hand-edit.',
    stair: {
      kind: stair.kind ?? 'stairs',
      deg: stair.deg != null ? +stair.deg.toFixed(2) : undefined,
      steps: stair.steps,
      riser: +stair.riser.toFixed(4),
      rise: +stair.rise.toFixed(4),
      run: +stair.run.toFixed(4),
      baseY: +stair.baseY.toFixed(4),
      topY: +stair.topY.toFixed(4),
      base: stair.base.map((n) => +n.toFixed(4)),
      ascend: stair.ascend.map((n) => +n.toFixed(6)),
    },
    triangleCount: keep.length / 9,
    positions: keep,
  };
  writeFileSync(join(OUT, `${c.entry.slug}.json`), JSON.stringify(fixture));
  index.push({
    slug: fixture.slug,
    source: fixture.source,
    steps: stair.steps,
    riser: fixture.stair.riser,
    rise: fixture.stair.rise,
    triangles: fixture.triangleCount,
  });
  console.log(
    `  ${fixture.slug.padEnd(34)} steps=${String(stair.steps).padStart(2)} ` +
      `riser=${stair.riser.toFixed(3)}m rise=${stair.rise.toFixed(2)}m ` +
      `tris=${fixture.triangleCount}`
  );
}

writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`\n  ${candidates.length} flights found; ${index.length} written to tests/fixtures/stairs/`);
