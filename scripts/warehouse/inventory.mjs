#!/usr/bin/env node
/**
 * 3D Warehouse inventory for geolocated Chattanooga models (issue #259).
 *
 * Queries the Warehouse's internal REST API (no official public API exists)
 * for (a) everything by the "Chattanooga 3D" account — the 2011-era CVB
 * downtown-modeling program — and (b) the "chattanooga" text search, unions
 * by id, and reports count + condition: geolocation, in-box status, which
 * binaries exist (the render server pre-generates a PUBLIC glb for most
 * models — the pipeline's primary source; skp binaries are restricted).
 *
 * Metadata only — no model binaries are downloaded here. ≤1 req/s with a
 * contact UA, mirroring the Nominatim etiquette in scripts/bake/geocode.ts.
 *
 * Run:  docker compose exec scripthammer node scripts/warehouse/inventory.mjs
 * Out:  sites/_warehouse/inventory.json (gitignored — model titles/descriptions
 *       can legitimately reference streets the #234 privacy gate denylists, so
 *       the raw data stays local; the committed deliverable is the MD report)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://3dwarehouse.sketchup.com/warehouse/v1.0';
const USER_AGENT = 'scripthammer-twin-inventory/0.1 (jonpohlner@gmail.com)';
const CHATT_3D_CREATOR_ID = '1269677630914932972846048';
const PAGE = 50;
const DELAY_MS = 1100; // stay under 1 req/s

// Greater-Chattanooga box (generous: downtown + north shore + ridges)
const CHATT_BOX = { swLat: 34.95, swLon: -85.42, neLat: 35.15, neLon: -85.15 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiGet(pathAndQuery) {
  const res = await fetch(`${API}${pathAndQuery}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${pathAndQuery}`);
  return res.json();
}

async function pagedEntities(baseQuery, label) {
  const entries = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const j = await apiGet(
      `/entities?contentType=3dw&show=public&showAttributes=true&showBinaryMetadata=true&count=${PAGE}&offset=${offset}&${baseQuery}`
    );
    total = j.total;
    entries.push(...(j.entries ?? []));
    offset += PAGE;
    console.log(`[inventory] ${label}: ${Math.min(offset, total)}/${total}`);
    await sleep(DELAY_MS);
  }
  return { total, entries };
}

function condense(e) {
  const loc = e.location ?? null;
  const inBox =
    loc &&
    loc.latitude >= CHATT_BOX.swLat &&
    loc.latitude <= CHATT_BOX.neLat &&
    loc.longitude >= CHATT_BOX.swLon &&
    loc.longitude <= CHATT_BOX.neLon;
  const binaries = e.binaries ?? {};
  const glb = binaries.glb ?? null;
  const skpNames = Object.keys(binaries).filter((n) => /^s\d+$/.test(n));
  return {
    id: e.id,
    title: e.title,
    creator: e.creator?.displayName ?? null,
    creatorId: e.creator?.id ?? null,
    createTime: e.createTime,
    location: loc ? { lat: loc.latitude, lon: loc.longitude } : null,
    inChattBox: Boolean(inBox),
    tags: e.tags ?? [],
    description: (e.description ?? '').slice(0, 200),
    downloads: e.downloads ?? 0,
    views: e.views ?? 0,
    reviewCount: e.reviewCount ?? 0,
    averageRating: null, // filled below for reviewed in-box models
    thumbnailUrl: binaries.bot_st?.contentUrl ?? null, // public render, QC sheet
    glbPublic: Boolean(glb?.contentUrl?.includes('/content/public/')),
    glbBytes: glb?.contentLength ?? glb?.fileSize ?? null,
    glbUrl: glb?.contentUrl ?? null,
    skpVersions: skpNames,
    downloadRestricted:
      e.attributes?.legacy?.isDownloadRestricted?.value ?? false,
  };
}

/** Star ratings live on /entities/{id}/reviews (rating.overall, 1-5). Only
 *  reviewed IN-BOX models get the extra request — politeness over totality. */
async function harvestRatings(models) {
  const reviewed = models.filter((m) => m.inChattBox && m.reviewCount > 0);
  console.log(`[inventory] rating harvest: ${reviewed.length} reviewed in-box models`);
  for (const m of reviewed) {
    try {
      const j = await apiGet(`/entities/${m.id}/reviews`);
      const ratings = (j.entries ?? [])
        .map((r) => Number(r.rating?.overall))
        .filter((n) => Number.isFinite(n));
      if (ratings.length) {
        m.averageRating =
          Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10;
      }
    } catch (err) {
      console.error(`[inventory] reviews for ${m.id}: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }
}

const byCreator = await pagedEntities(
  `fq=creator.id==${CHATT_3D_CREATOR_ID}`,
  'creator "Chattanooga 3D"'
);
const byQuery = await pagedEntities(`q=chattanooga`, 'q=chattanooga');

const union = new Map();
for (const e of [...byCreator.entries, ...byQuery.entries]) {
  if (!union.has(e.id)) union.set(e.id, condense(e));
}
const models = [...union.values()];
await harvestRatings(models);

const geolocated = models.filter((m) => m.location);
const inBox = models.filter((m) => m.inChattBox);
const inBoxGlb = inBox.filter((m) => m.glbPublic && !m.downloadRestricted);
const chatt3d = models.filter((m) => m.creatorId === CHATT_3D_CREATOR_ID);

const report = {
  generated: new Date().toISOString(),
  api: `${API}/entities (internal; no official public API)`,
  queries: {
    'creator.id==Chattanooga 3D': byCreator.total,
    'q=chattanooga': byQuery.total,
  },
  union: models.length,
  geolocated: geolocated.length,
  inChattBox: inBox.length,
  inChattBoxWithPublicGlb: inBoxGlb.length,
  byChatt3dAccount: chatt3d.length,
  box: CHATT_BOX,
  models: models.sort(
    (a, b) => Number(b.inChattBox) - Number(a.inChattBox) || b.downloads - a.downloads
  ),
};

const outPath = path.resolve('sites/_warehouse/inventory.json');
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(report, null, 2));

console.log('\n=== INVENTORY SUMMARY ===');
console.log(`creator "Chattanooga 3D" total : ${byCreator.total}`);
console.log(`q=chattanooga total            : ${byQuery.total}`);
console.log(`union (unique models)          : ${models.length}`);
console.log(`geolocated                     : ${geolocated.length}`);
console.log(`in Chattanooga box             : ${inBox.length}`);
console.log(`  …with public glb, unrestricted: ${inBoxGlb.length}`);
console.log(`\nTop in-box models by downloads:`);
for (const m of report.models.filter((m) => m.inChattBox).slice(0, 15)) {
  console.log(
    `  ${m.title.slice(0, 48).padEnd(48)} glb=${m.glbPublic ? 'Y' : 'n'} dl=${m.downloads} (${m.creator})`
  );
}
console.log(`\nwrote ${outPath}`);
