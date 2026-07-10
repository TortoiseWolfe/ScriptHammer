#!/usr/bin/env node
/**
 * Fetch the curated Warehouse models' PUBLIC glb binaries (issue #259).
 *
 * Reads the curation list (sites/_warehouse/curated.json — array of Warehouse
 * entity ids, optionally with per-model slug overrides), looks each id up in
 * the local inventory dump (sites/_warehouse/inventory.json — regenerate with
 * scripts/warehouse/inventory.mjs), and downloads the render-server GLB from
 * its public contentUrl into sites/_warehouse/models/<slug>/raw.glb with a
 * source.json provenance record beside it.
 *
 * Everything under sites/_warehouse/ is gitignored (local-only per the
 * 2026-07-10 distribution decision). ≤1 download per 1.5 s, contact UA,
 * resumable: models with an existing raw.glb of the expected size are skipped.
 *
 * Run:  docker compose exec scripthammer node scripts/warehouse/fetch-glbs.mjs
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const USER_AGENT = 'scripthammer-twin-inventory/0.1 (jonpohlner@gmail.com)';
const ROOT = path.resolve('sites/_warehouse');
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

const inventory = JSON.parse(await readFile(path.join(ROOT, 'inventory.json'), 'utf8'));
// The curated list is COMMITTED (Warehouse entity ids only — no model data):
// the repeatability crank is "edit this file, run fetch → abstract → emit".
// Shape: { neighborhoods: [{ key, label, ids: [] }] } (iteration 2).
const curatedFile = JSON.parse(
  await readFile(path.resolve('scripts/warehouse/curated-chatt.json'), 'utf8')
);
const curated = curatedFile.neighborhoods.flatMap((n) => n.ids);
const byId = new Map(inventory.models.map((m) => [m.id, m]));
const slugById = assignSlugs(curated, byId);

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
  const dir = path.join(ROOT, 'models', slug);
  await mkdir(dir, { recursive: true });
  const glbPath = path.join(dir, 'raw.glb');

  const existing = await stat(glbPath).catch(() => null);
  if (existing && m.glbBytes && existing.size === m.glbBytes) {
    console.log(`[fetch] ${slug}: already present (${(existing.size / 1e6).toFixed(1)} MB) — skip`);
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
  await writeFile(
    path.join(dir, 'source.json'),
    JSON.stringify(
      {
        warehouseId: m.id,
        title: m.title,
        creator: m.creator,
        creatorId: m.creatorId,
        url: `https://3dwarehouse.sketchup.com/model/${m.id}`,
        license: '3D Warehouse General Model License',
        location: m.location,
        createTime: m.createTime,
        fetchedAt: new Date().toISOString(),
        rawBytes: buf.length,
      },
      null,
      2
    )
  );
  console.log(`[fetch] ${slug}: ${(buf.length / 1e6).toFixed(1)} MB ✓`);
  ok++;
  await sleep(DELAY_MS);
}
console.log(`\n[fetch] done — ${ok} downloaded, ${skipped} already present, ${curated.length - ok - skipped} failed/missing`);
