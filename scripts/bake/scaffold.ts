// Scaffold a new sites/<slug>.json from a geocoded centre + metric extents
// (#232 two-phase flow). Geocoding happens exactly once, here; the written
// config carries explicit numbers so every rebake is deterministic.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { boxFromCenter } from './enu';
import {
  defaultTerrainGrid,
  SiteConfigSchema,
  SITES_DIR,
  type SiteConfig,
} from './site-config';

export interface ScaffoldOpts {
  slug: string;
  name: string;
  centerLat: number;
  centerLon: number;
  widthM: number;
  heightM: number;
  force?: boolean;
  root?: string;
}

/** Build (and validate) the would-be config without touching disk. */
export function buildSiteConfig(
  opts: Omit<ScaffoldOpts, 'force' | 'root'>
): SiteConfig {
  const box = boxFromCenter(
    opts.centerLat,
    opts.centerLon,
    opts.widthM,
    opts.heightM
  );
  return SiteConfigSchema.parse({
    slug: opts.slug,
    name: opts.name,
    box,
    mpp: 2,
    terrain: { ...defaultTerrainGrid(box), dataset: 'ned10m' },
    carveWater: true,
    heroes: [],
    heights: { overrides: {}, fallbackClampM: 100 },
    drapeSource: 'naip',
  });
}

export function scaffoldSite(opts: ScaffoldOpts): {
  path: string;
  config: SiteConfig;
} {
  const root = opts.root ?? process.cwd();
  const path = join(root, SITES_DIR, `${opts.slug}.json`);
  if (existsSync(path) && !opts.force) {
    throw new Error(
      `${SITES_DIR}/${opts.slug}.json already exists — bake it with --site ${opts.slug}, ` +
        `scaffold under a different name with --slug <new-slug>, ` +
        `or pass --force to OVERWRITE it (destroys any hand-edits: heroes, tour, overrides)`
    );
  }
  const config = buildSiteConfig(opts);
  mkdirSync(join(root, SITES_DIR), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
  return { path, config };
}
