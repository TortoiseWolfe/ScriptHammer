// Per-site bake configuration (#232). A site config is the reproducibility
// contract: every value the bake needs is explicit in sites/<slug>.json, so a
// rebake is deterministic with no network-dependent derivation. Presentation
// fields (name/tour/trolley/framing/...) pass through into the baked
// manifest's `site` block — the runtime's only per-site data source.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { createProjection, type GeoBox } from './enu';

export const SITES_DIR = 'sites';

export const GeoBoxSchema = z
  .object({
    swLat: z.number().gte(-90).lte(90),
    swLon: z.number().gte(-180).lte(180),
    neLat: z.number().gte(-90).lte(90),
    neLon: z.number().gte(-180).lte(180),
  })
  .refine((b) => b.neLat > b.swLat && b.neLon > b.swLon, {
    message: 'box must have neLat > swLat and neLon > swLon',
  });

export const WaypointSchema = z.object({
  pos: z.tuple([z.number(), z.number(), z.number()]),
  look: z.tuple([z.number(), z.number(), z.number()]),
  dwell: z.number().positive(),
  name: z.string().min(1),
  blurb: z.string().min(1),
});

export const HeroSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9_]+$/),
    /** Exact OSM way id — the hero sits on that way's footprint centroid. */
    wayId: z.number().int().positive().optional(),
    /** Fixed lon/lat anchor for landmarks with no reliably-tagged OSM way. */
    anchor: z.object({ lat: z.number(), lon: z.number() }).optional(),
  })
  .refine((h) => (h.wayId != null) !== (h.anchor != null), {
    message: 'hero needs exactly one of wayId | anchor',
  });

export const HeightsSchema = z.object({
  /** OSM `name` tag (character-exact) -> metres. Safety net behind height/levels tags. */
  overrides: z.record(z.string(), z.number().positive()).default({}),
  /** Cap for rule-4 fallback heights (typically the site's tallest tower). */
  fallbackClampM: z.number().positive().default(100),
});

export const FramingSchema = z.object({
  /** Orbit/miniature pivot in ENU metres; defaults to the box centre. */
  homeFocus: z.tuple([z.number(), z.number(), z.number()]).optional(),
  homeRadius: z.number().positive().optional(),
  minR: z.number().positive().optional(),
  maxR: z.number().positive().optional(),
  moveSpeed: z.number().positive().optional(),
  panMargin: z.number().nonnegative().optional(),
  fogNear: z.number().positive().optional(),
  fogFar: z.number().positive().optional(),
  cameraFar: z.number().positive().optional(),
});

export const SiteConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /** Display name — the HUD wordmark. */
  name: z.string().min(1),
  subtitle: z.string().optional(),
  box: GeoBoxSchema,
  /** Aerial drape metres-per-pixel. */
  mpp: z.number().positive().default(2),
  /** Elevation grid; absent -> defaultTerrainGrid(box) (~30 m isotropic). */
  terrain: z
    .object({
      cols: z.number().int().min(2),
      rows: z.number().int().min(2),
      dataset: z.enum(['ned10m', 'srtm30m', 'mapzen']).default('ned10m'),
    })
    .optional(),
  /** Carve the aerial waterline into the terrain (disable for waterless sites). */
  carveWater: z.boolean().default(true),
  heroes: z
    .array(HeroSchema)
    .default([])
    .refine((hs) => new Set(hs.map((h) => h.slug)).size === hs.length, {
      message: 'hero slugs must be unique',
    })
    .refine(
      (hs) => {
        const ids = hs.filter((h) => h.wayId != null).map((h) => h.wayId);
        return new Set(ids).size === ids.length;
      },
      // build-scene keys way-heroes by wayId — a duplicate would silently drop one
      { message: 'hero wayIds must be unique' }
    ),
  heights: HeightsSchema.default({ overrides: {}, fallbackClampM: 100 }),
  /** Camera tour waypoints in ENU metres (origin = box centre, north = -Z). */
  tour: z.array(WaypointSchema).optional(),
  /** Trolley loop as flat ENU [x,z,...] pairs (>= 3 points). */
  trolley: z
    .array(z.number())
    .refine((a) => a.length % 2 === 0 && a.length >= 6, {
      message: 'trolley must be flat [x,z,...] pairs with at least 3 points',
    })
    .optional(),
  palette: z.enum(['trueToLife', 'toy']).optional(),
  day: z.number().min(0).max(1).optional(),
  framing: FramingSchema.optional(),
  /** Aerial source. NAIP is US-only; non-US sites need 'esri'. */
  drapeSource: z.enum(['naip', 'esri']).default('naip'),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;
export type SiteConfigInput = z.input<typeof SiteConfigSchema>;
export type Waypoint = z.infer<typeof WaypointSchema>;

/** The `site` block the bake emits into manifest.json for the runtime. */
export function siteManifestBlock(site: SiteConfig) {
  return {
    slug: site.slug,
    name: site.name,
    ...(site.subtitle != null && { subtitle: site.subtitle }),
    ...(site.palette != null && { palette: site.palette }),
    ...(site.day != null && { day: site.day }),
    ...(site.tour != null && { tour: site.tour }),
    ...(site.trolley != null && { trolley: site.trolley }),
    ...(site.framing != null && { framing: site.framing }),
  };
}

export function loadSiteConfig(slug: string, root = process.cwd()): SiteConfig {
  const path = join(root, SITES_DIR, `${slug}.json`);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `no site config at ${SITES_DIR}/${slug}.json — scaffold one with: pnpm bake --address "..." --radius <m>`
    );
  }
  const cfg = SiteConfigSchema.parse(JSON.parse(raw));
  if (cfg.slug !== slug) {
    throw new Error(
      `site config ${SITES_DIR}/${slug}.json declares slug "${cfg.slug}" — must match its filename`
    );
  }
  return cfg;
}

/** Bake output locations. Everything lives under public/twins/<slug>/. */
export function sitePaths(site: Pick<SiteConfig, 'slug'>) {
  const publicBase = `twins/${site.slug}`;
  const out = `public/${publicBase}`;
  return {
    publicBase,
    out,
    raw: `${out}/_raw`,
    tmp: `${out}/_tmp`,
  };
}

/**
 * Default elevation grid: ~30 m isotropic spacing (resolves riverbanks — see
 * fetch-terrain.ts history), scaled up uniformly to stay within a ~10k-point
 * OpenTopoData budget for large boxes.
 */
export function defaultTerrainGrid(box: GeoBox): {
  cols: number;
  rows: number;
} {
  const { widthM, depthM } = createProjection(box).groundSize();
  let spacing = 30;
  for (;;) {
    const cols = Math.max(2, Math.round(widthM / spacing) + 1);
    const rows = Math.max(2, Math.round(depthM / spacing) + 1);
    if (cols * rows <= 10_000) return { cols, rows };
    spacing *= 1.25;
  }
}

const PROVENANCE_TERRAIN: Record<string, string> = {
  ned10m: 'USGS 3DEP',
  srtm30m: 'NASA SRTM',
  mapzen: 'Mapzen Terrain',
};

/** Attribution line shown in the HUD, built from the actual sources baked. */
export function provenanceFor(
  terrainDataset: string,
  drapeSource: 'naip' | 'esri'
): string {
  return [
    '© OpenStreetMap',
    PROVENANCE_TERRAIN[terrainDataset] ?? terrainDataset,
    drapeSource === 'naip' ? 'USGS NAIP' : 'Esri World Imagery',
  ].join(' · ');
}
