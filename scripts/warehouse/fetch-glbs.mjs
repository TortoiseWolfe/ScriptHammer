#!/usr/bin/env node
/**
 * Fetch the curated Warehouse models' PUBLIC glb binaries (issue #259).
 *
 * Stage 1 of the crank (see docs/twins/warehouse-flow.md):
 *   input : scripts/warehouse/curated-chatt.json (committed ids, grouped by
 *           neighborhood) + sites/_warehouse/inventory.json (local metadata)
 *   output: sites/_warehouse/raw/<slug>.glb — the source cache, one file per
 *           model, nothing else. Provenance lives in inventory.json and is
 *           carried into models.json by the emit stage; no per-model
 *           source.json (iteration-3 flow collapse).
 *
 * Everything under sites/_warehouse/ is gitignored (local-only per the
 * 2026-07-10 distribution decision). ≤1 download per 1.5 s, contact UA,
 * resumable: models with an existing raw GLB of the expected size are skipped.
 *
 * Run:  docker compose exec scripthammer pnpm run warehouse:sync   (all stages)
 *       docker compose exec scripthammer node scripts/warehouse/fetch-glbs.mjs
 */

import { readFile, writeFile, mkdir, stat, rename, rm, readdir } from 'node:fs/promises';
import path from 'node:path';

const USER_AGENT = 'scripthammer-twin-inventory/0.1 (jonpohlner@gmail.com)';
const ROOT = path.resolve('sites/_warehouse');
const RAW = path.join(ROOT, 'raw');
const DELAY_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/["'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

// Distinct buildings can share a generic title ("Building in Chattanooga,
// TN, USA" ×15) — suffix the Warehouse id ONLY on collision so unique slugs
// stay stable. MIRRORED in emit-models.ts; the two must agree.
function assignSlugs(ids, lookup) {
  const counts = new Map();
  for (const id of ids) {
    const m = lookup.get(id);
    if (!m) continue;
    const base = slugify(m.title);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  const slugs = new Map();
  for (const id of ids) {
    const m = lookup.get(id);
    if (!m) continue;
    const base = slugify(m.title);
    slugs.set(id, counts.get(base) > 1 ? `${base}-${id.slice(0, 8)}` : base);
  }
  return slugs;
}

/** One-time migration from the iteration-2 layout: models/<slug>/raw.glb
 *  moves to raw/<slug>.glb; the per-model dirs (source.json, superseded
 *  abstract.glb copies) are deleted. Safe to run repeatedly. */
async function migrateLegacyLayout() {
  const legacyRoot = path.join(ROOT, 'models');
  const entries = await readdir(legacyRoot, { withFileTypes: true }).catch(() => []);
  if (!entries.length) return;
  let moved = 0;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const legacyRaw = path.join(legacyRoot, e.name, 'raw.glb');
    const target = path.join(RAW, `${e.name}.glb`);
    const has = await stat(legacyRaw).catch(() => null);
    const already = await stat(target).catch(() => null);
    if (has && !already) {
      await rename(legacyRaw, target);
      moved++;
    }
  }
  await rm(legacyRoot, { recursive: true, force: true });
  console.log(
    `[fetch] migrated legacy layout: ${moved} raw GLBs → raw/, models/ dir removed`
  );
}

const inventory = JSON.parse(await readFile(path.join(ROOT, 'inventory.json'), 'utf8'));
// The curated list is COMMITTED (Warehouse entity ids only — no model data):
// the repeatability crank is "edit this file, run warehouse:sync".
// Shape: { neighborhoods: [{ key, label, ids: [] }] }.
const curatedFile = JSON.parse(
  await readFile(path.resolve('scripts/warehouse/curated-chatt.json'), 'utf8')
);
const curated = curatedFile.neighborhoods.flatMap((n) => n.ids);
const byId = new Map(inventory.models.map((m) => [m.id, m]));
const slugById = assignSlugs(curated, byId);

await mkdir(RAW, { recursive: true });
await migrateLegacyLayout();

let ok = 0;
let skipped = 0;
for (const id of curated) {
  const m = byId.get(id);
  if (!m) {
    console.error(`[fetch] ${id}: not in inventory.json — regenerate the inventory`);
    continue;
  }
  if (!m.glbUrl || !m.glbPublic) {
    console.error(`[fetch] ${m.title}: no public glb — needs the DAE fallback path`);
    continue;
  }
  const slug = slugById.get(id);
  const glbPath = path.join(RAW, `${slug}.glb`);

  const existing = await stat(glbPath).catch(() => null);
  if (existing && m.glbBytes && existing.size === m.glbBytes) {
    skipped++;
    continue;
  }

  const res = await fetch(m.glbUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    console.error(`[fetch] ${slug}: HTTP ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(glbPath, buf);
  console.log(`[fetch] ${slug}: ${(buf.length / 1e6).toFixed(1)} MB ✓`);
  ok++;
  await sleep(DELAY_MS);
}
console.log(
  `\n[fetch] done — ${ok} downloaded, ${skipped} already cached, ${curated.length - ok - skipped} failed/missing → sites/_warehouse/raw/`
);
