// Emit the abstracted Warehouse models into the chatt twin (issue #259).
//
// Reads the local-only pipeline outputs (sites/_warehouse/), projects each
// curated model's Warehouse geolocation through the SAME lon/lat→ENU
// chokepoint the bake uses (createProjection + the site's measured
// vectorOffsetM, so imported buildings shift with every other vector layer),
// and writes public/twins/<slug>/models/{<slug>.glb, models.json}.
//
// public/twins/*/models/ is gitignored (2026-07-10 distribution decision:
// local-only until a per-model publish call is made). The runtime treats
// models.json as an optional asset — absent file ⇒ layer off.
//
// Run:  docker compose exec scripthammer pnpm exec tsx scripts/warehouse/emit-models.ts [--site chatt]

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createProjection } from '../bake/enu';

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
const curated: string[] = JSON.parse(
  readFileSync(path.resolve('scripts/warehouse/curated-chatt.json'), 'utf8')
);
const inventory = JSON.parse(
  readFileSync(path.join(WAREHOUSE, 'inventory.json'), 'utf8')
);
const byId = new Map<string, any>(inventory.models.map((m: any) => [m.id, m]));

const outDir = path.resolve(`public/twins/${site}/models`);
mkdirSync(outDir, { recursive: true });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/["'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

interface EmittedModel {
  slug: string;
  file: string;
  title: string;
  creator: string;
  warehouseId: string;
  url: string;
  x: number;
  z: number;
  yawDeg: number;
  lat: number;
  lon: number;
}

const models: EmittedModel[] = [];
for (const id of curated) {
  const m = byId.get(id);
  if (!m?.location?.lat) {
    console.error(
      `[emit] ${id}: missing from inventory or not geolocated — skip`
    );
    continue;
  }
  const slug = slugify(m.title);
  const abstractPath = path.join(WAREHOUSE, 'models', slug, 'abstract.glb');
  if (!existsSync(abstractPath)) {
    console.error(
      `[emit] ${slug}: no abstract.glb — run abstract-glb.mjs first`
    );
    continue;
  }
  const [x, z] = proj.lonLatToEnu(m.location.lon, m.location.lat);
  const { widthM, depthM } = proj.groundSize();
  if (Math.abs(x) > widthM / 2 || Math.abs(z) > depthM / 2) {
    console.error(`[emit] ${slug}: anchor outside the ${site} ground — skip`);
    continue;
  }
  copyFileSync(abstractPath, path.join(outDir, `${slug}.glb`));
  models.push({
    slug,
    file: `${slug}.glb`,
    title: m.title,
    creator: m.creator,
    warehouseId: m.id,
    url: `https://3dwarehouse.sketchup.com/model/${m.id}`,
    x: Number(x.toFixed(2)),
    z: Number(z.toFixed(2)),
    yawDeg: 0, // Warehouse GLBs are true-north aligned in principle; tune per model if not
    lat: m.location.lat,
    lon: m.location.lon,
  });
  console.log(`[emit] ${slug}: ENU (${x.toFixed(1)}, ${z.toFixed(1)})`);
}

writeFileSync(
  path.join(outDir, 'models.json'),
  JSON.stringify({ generated: new Date().toISOString(), site, models }, null, 2)
);
console.log(
  `\n[emit] ${models.length} models → public/twins/${site}/models/ (local-only)`
);
