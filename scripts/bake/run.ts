// Bake orchestrator + CLI (#232).
//
//   pnpm bake                                       # flagship (sites/chatt.json)
//   pnpm bake --site <slug>                         # bake an existing site config
//   pnpm bake --address "1 Broad St, Chattanooga TN" --radius 800
//   pnpm bake --center 35.0563,-85.3111 --box 1600x1600 --slug broad-st
//
// --address/--center scaffold a fully-explicit sites/<slug>.json (geocoding
// happens once, here), then bake it — the config file is the reproducibility
// contract. --dry-run prints the would-be config without writing or baking.

import { parseArgs } from 'node:util';
import { mkdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { fetchOsm } from './fetch-osm';
import { fetchMsHeights } from './fetch-ms-heights';
import { fetchTerrain } from './fetch-terrain';
import { fetchLidarHeights } from './fetch-lidar-heights';
import { fetchDrape } from './fetch-drape';
import { buildScene } from './build-scene';
import { createProjection } from './enu';
import {
  defaultTerrainGrid,
  atlasBoxFor as atlasBoxForSite,
  wideTerrainGridFor,
  loadSiteConfig,
  sitePaths,
  type SiteConfig,
} from './site-config';
import { geocode, slugFromGeocode, slugify } from './geocode';
import { buildSiteConfig, scaffoldSite } from './scaffold';

export const bakeOrder = [
  'fetch-osm',
  'fetch-ms-heights',
  'fetch-terrain',
  'fetch-lidar-heights', // needs osm.json (footprints) + terrain.json (DTM)
  'fetch-drape',
  'build-scene',
] as const;

export type CliPlan =
  | { kind: 'site'; slug: string }
  | {
      kind: 'scaffold';
      source: 'address' | 'center';
      address?: string;
      centerLat?: number;
      centerLon?: number;
      widthM: number;
      heightM: number;
      slug?: string;
      name?: string;
      force: boolean;
      dryRun: boolean;
    };

export function parseCliArgs(argv: string[]): CliPlan {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      site: { type: 'string' },
      address: { type: 'string' },
      center: { type: 'string' },
      radius: { type: 'string' },
      box: { type: 'string' },
      slug: { type: 'string' },
      name: { type: 'string' },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  const newSite = values.address != null || values.center != null;
  if (values.address != null && values.center != null) {
    throw new Error('--address and --center are mutually exclusive');
  }
  if (newSite && values.site != null) {
    throw new Error('--site cannot be combined with --address/--center');
  }

  if (!newSite) {
    for (const flag of ['radius', 'box', 'slug', 'name'] as const) {
      if (values[flag] != null)
        throw new Error(`--${flag} only applies with --address/--center`);
    }
    // Booleans default to false, so test truthiness — an existing-site bake has
    // no scaffold step, and a "--dry-run" that silently performed a full live
    // bake would overwrite committed artifacts the user asked to preview.
    if (values.force)
      throw new Error('--force only applies with --address/--center');
    if (values['dry-run'])
      throw new Error(
        '--dry-run only applies with --address/--center (an existing site bakes from its sites/<slug>.json verbatim)'
      );
    return { kind: 'site', slug: values.site ?? 'chatt' };
  }

  if ((values.radius != null) === (values.box != null)) {
    throw new Error(
      'a new site needs exactly one of --radius <metres> | --box <WxH metres>'
    );
  }
  let widthM: number;
  let heightM: number;
  if (values.radius != null) {
    const r = Number(values.radius);
    if (!Number.isFinite(r) || r <= 0)
      throw new Error(`bad --radius "${values.radius}" (metres)`);
    widthM = heightM = 2 * r;
  } else {
    const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(values.box!);
    if (!m) throw new Error(`bad --box "${values.box}" (expected WxH metres)`);
    widthM = Number(m[1]);
    heightM = Number(m[2]);
    if (widthM <= 0 || heightM <= 0)
      throw new Error(`bad --box "${values.box}" (extents must be positive)`);
  }

  const plan: CliPlan = {
    kind: 'scaffold',
    source: values.address != null ? 'address' : 'center',
    address: values.address,
    slug: values.slug,
    name: values.name,
    widthM,
    heightM,
    force: values.force!,
    dryRun: values['dry-run']!,
  };
  if (values.center != null) {
    const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(values.center);
    if (!m)
      throw new Error(`bad --center "${values.center}" (expected lat,lon)`);
    plan.centerLat = Number(m[1]);
    plan.centerLon = Number(m[2]);
    if (values.slug == null)
      throw new Error(
        '--center requires --slug (no address to derive it from)'
      );
  }
  return plan;
}

export async function bake(site: SiteConfig) {
  const proj = createProjection(site.box, site.vectorOffsetM);
  const paths = sitePaths(site);
  mkdirSync(paths.raw, { recursive: true });
  console.log(`[bake] site=${site.slug} → ${paths.out}`);
  console.log('[bake] fetch-osm...');
  console.log(await fetchOsm(paths.raw, site.box));
  if (site.msHeights) {
    console.log('[bake] fetch-ms-heights...');
    console.log(await fetchMsHeights(paths.raw, site.box));
  }
  console.log('[bake] fetch-terrain...');
  const grid = site.terrain ?? {
    ...defaultTerrainGrid(site.box),
    dataset: 'ned10m' as const,
  };
  await fetchTerrain(paths.raw, site.box, grid);

  // Wide coarse DEM over the atlas extent (#292). The fine grid covers only
  // `box` — 20% of the atlas view — and everything outside it rendered as bare
  // ellipsoid, i.e. a 176 m plateau edge right through the default camera.
  // 3DEP's raster export server-resamples in ONE request; the point-query
  // datasets would need ~475 throttled batches for the same grid.
  const atlasBox = atlasBoxForSite(site);
  const wide = wideTerrainGridFor(atlasBox);
  if (atlasBox !== site.box) {
    console.log(
      `[bake] fetch-terrain (wide atlas DEM ${wide.cols}x${wide.rows})...`
    );
    await fetchTerrain(paths.raw, atlasBox, {
      ...wide,
      dataset: '3dep1m',
      filename: 'terrain-wide.json',
    });
  }
  // Wide OSM for the atlas (#292). Guard is reference identity — atlasBoxFor
  // returns site.box itself when the site has no atlasBox.
  if (atlasBox !== site.box) {
    console.log('[bake] fetch-osm (wide atlas extent)...');
    await fetchOsm(paths.raw, atlasBox, { filename: 'osm-wide.json' });
  }
  if (site.lidar) {
    console.log('[bake] fetch-lidar-heights...');
    console.log(
      await fetchLidarHeights(
        paths.raw,
        site.box,
        site.lidar,
        site.vectorOffsetM
      )
    );
  }
  console.log('[bake] fetch-drape...');
  const drape = await fetchDrape(paths.raw, proj, site.mpp, site.drapeSource);
  console.log(drape);
  // Wide aerial drape over the atlas extent — the Three.js diorama renders the
  // full atlasBox and needs aligned imagery under it (a bare wide terrain reads
  // as an olive slab). Baked over the SAME offset projection as the wide
  // buildings so footprints register on the imagery, at a coarser 1.5 m/px
  // (~22 MP) since the wide camera is pulled back.
  if (atlasBox !== site.box) {
    console.log('[bake] fetch-drape (wide atlas extent)...');
    const wideProj = createProjection(atlasBox, site.vectorOffsetM);
    const wideDrape = await fetchDrape(
      paths.raw,
      wideProj,
      1.5,
      site.drapeSource,
      'drape-wide.jpg'
    );
    console.log(wideDrape);
  }
  console.log('[bake] build-scene -> temp...');
  if (existsSync(paths.tmp))
    rmSync(paths.tmp, { recursive: true, force: true });
  const manifest = await buildScene(
    paths.raw,
    paths.tmp,
    site,
    proj,
    drape.source
  );
  // Atomic swap: build-scene writes into TMP (never touching OUT), so if any
  // fetch or build step above throws, OUT still holds the last-known-good
  // derived files untouched. Only once TMP is fully populated do we copy the
  // finished files into OUT, so the dev watcher never observes a partial set.
  for (const f of [
    'buildings.json',
    'streets.json',
    'heroes.json',
    'terrain.json',
    // Wide atlas DEM (#292). Optional — sites without an atlasBox have none.
    'terrain-wide.json',
    // Wide atlas buildings (#292). Optional — sites without an atlasBox have none.
    'buildings-wide.json',
    'manifest.json',
    'drape.jpg',
    // Wide atlas aerial drape. Optional — sites without an atlasBox have none.
    // A file missing from this list is silently dropped, so keep it listed.
    'drape-wide.jpg',
  ]) {
    if (existsSync(`${paths.tmp}/${f}`)) {
      cpSync(`${paths.tmp}/${f}`, `${paths.out}/${f}`);
    }
  }
  rmSync(paths.tmp, { recursive: true, force: true });
  console.log('[bake] done. rules:', JSON.stringify(manifest.ruleHistogram));
  return manifest;
}

export async function run(argv: string[]) {
  const plan = parseCliArgs(argv);
  if (plan.kind === 'site') {
    await bake(loadSiteConfig(plan.slug));
    return;
  }

  let centerLat: number;
  let centerLon: number;
  let slug: string;
  let name: string;
  if (plan.source === 'address') {
    const g = await geocode(plan.address!);
    console.log(
      `[geocode] "${plan.address}" → ${g.lat.toFixed(6)},${g.lon.toFixed(6)} (${g.displayName})`
    );
    centerLat = g.lat;
    centerLon = g.lon;
    slug = plan.slug ? slugify(plan.slug) : slugFromGeocode(g);
    name = plan.name ?? g.displayName.split(',').slice(0, 2).join(',').trim();
  } else {
    centerLat = plan.centerLat!;
    centerLon = plan.centerLon!;
    slug = slugify(plan.slug!);
    name = plan.name ?? plan.slug!;
  }
  console.log(`[scaffold] slug=${slug} name="${name}"`);

  if (plan.dryRun) {
    const config = buildSiteConfig({
      slug,
      name,
      centerLat,
      centerLon,
      widthM: plan.widthM,
      heightM: plan.heightM,
    });
    console.log(JSON.stringify(config, null, 2));
    console.log('[dry-run] nothing written');
    return;
  }

  const { path, config } = scaffoldSite({
    slug,
    name,
    centerLat,
    centerLon,
    widthM: plan.widthM,
    heightM: plan.heightM,
    force: plan.force,
  });
  console.log(`[scaffold] wrote ${path}`);
  await bake(config);
}

if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  run(process.argv.slice(2)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
