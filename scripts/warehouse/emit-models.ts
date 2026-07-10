// Emit the twin's models.json descriptor (issue #259).
//
// Stage 3 of the crank (see docs/twins/warehouse-flow.md): the served GLBs
// were already written by abstract-glb.mjs — this stage ONLY projects each
// curated model's Warehouse geolocation through the SAME lon/lat→ENU
// chokepoint the bake uses (createProjection + the site's measured
// vectorOffsetM, so imported buildings shift with every other vector layer),
// merges hand-tuned placement overrides (overrides-<site>.json — the durable
// output of the in-viewer Edit mode), carries provenance + ratings, and
// writes public/twins/<site>/models/models.json.
//
// public/twins/*/models/ is gitignored by DEFAULT; publishing is a per-site
// decision recorded in .gitignore (chatt is published, 2026-07-10). The
// runtime treats models.json as an optional asset — absent file ⇒ layer off.
//
// Run:  docker compose exec scripthammer pnpm exec tsx scripts/warehouse/emit-models.ts [--site chatt]

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createProjection } from '../bake/enu';
import { applyOverrides, assignSlugs, type PlacementOverride } from './lib';

const { values: args } = parseArgs({
  options: { site: { type: 'string', default: 'chatt' } },
});
const site = args.site as string;

const siteConfig = JSON.parse(readFileSync(`sites/${site}.json`, 'utf8'));
const proj = createProjection(
  siteConfig.box,
  siteConfig.vectorOffsetM ?? { x: 0, z: 0 }
);

const WAREHOUSE = path.resolve('sites/_warehouse');
const curatedFile: {
  neighborhoods: { key: string; label: string; ids: string[] }[];
} = JSON.parse(
  readFileSync(path.resolve('scripts/warehouse/curated-chatt.json'), 'utf8')
);
const overrides: Record<string, PlacementOverride> = JSON.parse(
  readFileSync(path.resolve(`scripts/warehouse/overrides-${site}.json`), 'utf8')
);
const inventory = JSON.parse(
  readFileSync(path.join(WAREHOUSE, 'inventory.json'), 'utf8')
);
const byId = new Map<string, any>(inventory.models.map((m: any) => [m.id, m]));

// Post-abstraction dimensions from the local report (#259 iter 5) — feeds
// size-aware fly-to and QC. Report absent (fresh clone) ⇒ warn once and omit;
// the runtime falls back to fixed-radius framing.
interface ReportDims {
  dimensions?: { x: number; y: number; z: number };
  center?: { x: number; y: number; z: number };
}
let dimsBySlug = new Map<string, ReportDims>();
try {
  const rep = JSON.parse(
    readFileSync(path.join(WAREHOUSE, 'report.json'), 'utf8')
  );
  dimsBySlug = new Map(
    (rep.models ?? []).map((m: { slug: string; after?: ReportDims }) => [
      m.slug,
      { dimensions: m.after?.dimensions, center: m.after?.center },
    ])
  );
} catch {
  console.warn(
    '[emit] no sites/_warehouse/report.json — models.json will omit dim/centerOffset (runtime falls back)'
  );
}

const outDir = path.resolve(`public/twins/${site}/models`);
mkdirSync(outDir, { recursive: true });

// --- Massing suppression (#259 iter 4, flicker fix #1) ----------------------
// A sampled building and its extruded massing box co-occupy the same volume
// (probe: 65/134 anchors literally inside a box ring) → coplanar-wall
// z-fighting. Hide the box under every placed model, like the house scan's
// hideBuildingIds. PIP + a near-miss buffer for anchors just outside their
// footprint (geocode jitter).

interface BakedBuilding {
  id: number; // OSM way id — numeric throughout (buildings.json, Building.id)
  ring: number[]; // flat ENU [x,z,...]
}

function pointInRing(x: number, z: number, ring: number[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i];
    const zi = ring[i + 1];
    const xj = ring[j];
    const zj = ring[j + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToRing(x: number, z: number, ring: number[]): number {
  let best = Infinity;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const ax = ring[j];
    const az = ring[j + 1];
    const bx = ring[i];
    const bz = ring[i + 1];
    const abx = bx - ax;
    const abz = bz - az;
    const len2 = abx * abx + abz * abz || 1;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * abx + (z - az) * abz) / len2)
    );
    const px = ax + t * abx;
    const pz = az + t * abz;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
}

const HIDE_BUFFER_M = 10;

function boxesUnder(
  x: number,
  z: number,
  buildings: BakedBuilding[]
): number[] {
  const out: number[] = [];
  for (const b of buildings) {
    if (
      pointInRing(x, z, b.ring) ||
      distToRing(x, z, b.ring) <= HIDE_BUFFER_M
    ) {
      out.push(b.id);
    }
  }
  return out;
}

interface EmittedModel {
  slug: string;
  file: string;
  title: string;
  creator: string;
  warehouseId: string;
  url: string;
  neighborhood: string;
  x: number;
  z: number;
  yawDeg: number;
  scale?: number;
  yOffset?: number;
  lat: number;
  lon: number;
  /** Post-abstraction LOD0 bbox size [x, y, z] metres (#259 iter 5). */
  dim?: [number, number, number];
  /** Bbox-centre XZ offset from the model origin, pre-yaw — fly-to aims at
   *  the building, not the (sometimes campus-corner) anchor. */
  centerOffset?: [number, number];
  /** Warehouse community signals (QC surface — shown in the Directory). */
  rating?: number;
  reviewCount?: number;
  downloads?: number;
}

const allIds = curatedFile.neighborhoods.flatMap((n) => n.ids);
const slugById = assignSlugs(allIds, byId);
const { widthM, depthM } = proj.groundSize();

// Baked massing footprints for the suppression pass (flicker fix).
const bakedBuildings: BakedBuilding[] = JSON.parse(
  readFileSync(path.resolve(`public/twins/${site}/buildings.json`), 'utf8')
);

const SIZE_WARN_BYTES = 1_000_000;

const models: EmittedModel[] = [];
const hideBuildingIds = new Set<number>();
let excluded = 0;
for (const hood of curatedFile.neighborhoods) {
  for (const id of hood.ids) {
    const m = byId.get(id);
    if (!m?.location?.lat) {
      console.error(
        `[emit] ${id}: missing from inventory or not geolocated — skip`
      );
      continue;
    }
    const slug = slugById.get(id)!;
    // The served GLB is written by the abstract stage; emit only verifies.
    if (!existsSync(path.join(outDir, `${slug}.glb`))) {
      console.error(
        `[emit] ${slug}: no served GLB — run abstract-glb.mjs first`
      );
      continue;
    }
    const [x, z] = proj.lonLatToEnu(m.location.lon, m.location.lat);
    if (Math.abs(x) > widthM / 2 || Math.abs(z) > depthM / 2) {
      console.error(`[emit] ${slug}: anchor outside the ${site} ground — skip`);
      continue;
    }
    const d = dimsBySlug.get(slug);
    const entry: EmittedModel = {
      slug,
      file: `${slug}.glb`,
      title: m.title,
      creator: m.creator,
      warehouseId: m.id,
      url: `https://3dwarehouse.sketchup.com/model/${m.id}`,
      neighborhood: hood.key,
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
      yawDeg: 0, // Warehouse GLBs are true-north aligned in principle; overrides tune the rest
      lat: m.location.lat,
      lon: m.location.lon,
      ...(d?.dimensions
        ? { dim: [d.dimensions.x, d.dimensions.y, d.dimensions.z] }
        : {}),
      ...(d?.center ? { centerOffset: [d.center.x, d.center.z] } : {}),
      ...(m.averageRating != null ? { rating: m.averageRating } : {}),
      ...(m.reviewCount ? { reviewCount: m.reviewCount } : {}),
      ...(m.downloads ? { downloads: m.downloads } : {}),
    };
    const tuned = applyOverrides(entry, overrides[slug]);
    if (!tuned) {
      excluded++;
      console.log(`[emit] ${slug}: excluded by override`);
      continue;
    }
    // Budget honesty at the gate that ships (review PR3): a served GLB
    // over the per-building ceiling is loud, not silent.
    const glbBytes = statSync(path.join(outDir, `${slug}.glb`)).size;
    if (glbBytes > SIZE_WARN_BYTES) {
      console.warn(
        `[emit] WARNING ${slug}: served GLB ${(glbBytes / 1e6).toFixed(2)}MB exceeds the ${SIZE_WARN_BYTES / 1e6}MB per-building budget`
      );
    }
    // Suppress the massing box(es) under the TUNED anchor so the sampled
    // building and its extruded twin never z-fight.
    for (const bid of boxesUnder(tuned.x, tuned.z, bakedBuildings)) {
      hideBuildingIds.add(bid);
    }
    models.push(tuned);
  }
  console.log(
    `[emit] ${hood.key}: ${models.filter((e) => e.neighborhood === hood.key).length} placed`
  );
}

// The served dir mirrors models.json exactly: sweep GLBs that are no longer
// listed (excluded models, renamed slugs) — all regenerable from raw/.
const listed = new Set(models.map((m) => m.file));
for (const f of readdirSync(outDir)) {
  if (f.endsWith('.glb') && !listed.has(f)) {
    rmSync(path.join(outDir, f));
    console.log(`[emit] swept unlisted ${f}`);
  }
}

writeFileSync(
  path.join(outDir, 'models.json'),
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      site,
      neighborhoods: curatedFile.neighborhoods.map(({ key, label }) => ({
        key,
        label,
      })),
      // Massing boxes to hide while this layer renders (z-fighting fix).
      hideBuildingIds: [...hideBuildingIds].sort((a, b) => a - b),
      models,
    },
    null,
    2
  )
);
console.log(
  `\n[emit] ${models.length} models (${excluded} excluded), ${hideBuildingIds.size} massing boxes suppressed → public/twins/${site}/models/`
);
