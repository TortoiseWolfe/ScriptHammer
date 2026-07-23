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
  /** Elevation grid; absent -> defaultTerrainGridFor(dataset, box). */
  terrain: z
    .object({
      cols: z.number().int().min(2),
      rows: z.number().int().min(2),
      dataset: z
        .enum(['ned10m', 'srtm30m', 'mapzen', '3dep1m'])
        .default('ned10m'),
    })
    .optional(),
  /** Carve the aerial waterline into the terrain (disable for waterless sites). */
  carveWater: z.boolean().default(true),
  /** Fill missing building heights from Microsoft Global ML Building
   *  Footprints (ML-measured, global). Explicit opt-out for offline rebakes. */
  msHeights: z.boolean().default(true),
  /** Measure per-building heights from a USGS 3DEP lidar EPT dataset (#229
   *  PR-B): first-return p90 − DTM, rule 'lidar' above 'ms'. Opt-in per site;
   *  the EPT URL is pinned here because blocks tile the state and coverage
   *  must be verified per box (blk3 does NOT cover downtown Chattanooga). */
  lidar: z
    .object({
      ept: z.string().url(),
      maxDepth: z.number().int().min(4).max(16).default(11),
    })
    .optional(),
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
  /** Committed HUD nav buttons (e.g. a published portfolio property page).
   *  href is app-internal (basePath applied at runtime). Private demo links
   *  belong in links.local.json instead — never here. */
  links: z
    .array(z.object({ label: z.string().min(1), href: z.string().min(1) }))
    .optional(),
  /** An as-built exhibit (a SEPARATE baked slug) to fold into THIS site's wide
   *  diorama at its true location (#332). `lat`/`lon` anchor the scan in the
   *  wide frame; `label` names the in-diorama fly-to HUD button. Declaring it
   *  here (a) replaces WideCity's hardcoded EMBED_SLUG and (b) retires the
   *  exhibit's standalone /twins route — a slug that is any site's embeddedTwin
   *  is embed-only, so generateStaticParams stops building a page for it. */
  embeddedTwin: z
    .object({
      slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
      lat: z.number().gte(-90).lte(90),
      lon: z.number().gte(-180).lte(180),
      label: z.string().min(1),
    })
    .optional(),
  /** Aerial source. NAIP is US-only; non-US sites need 'esri'; 'tnmap' is
   *  Tennessee's TDOT statewide ortho (0.15 m, engineering-grade georef). */
  drapeSource: z.enum(['naip', 'esri', 'tnmap']).default('naip'),
  /** Measured vector correction (#233): metres to ADD to every vector layer
   *  (+x east, +z south), from the bake's registration report. Applied at the
   *  projection chokepoint (createProjection). Pin the report's measured
   *  offset here, then rebake — the next report should show ~0 residual. */
  vectorOffsetM: z
    .object({
      x: z.number().finite(),
      z: z.number().finite(),
    })
    .refine((v) => Math.hypot(v.x, v.z) <= 15, {
      // The search window is ±8 m coarse +2 m fine; anything beyond ~15 m
      // means the box/imagery is wrong, not the vectors — don't mask that.
      message: 'vectorOffsetM must be within 15 m of zero',
    })
    .optional(),
  /** Geoid separation N at the site centre, metres (h = H + N).
   *
   *  Baked terrain is USGS 3DEP, whose heights are ORTHOMETRIC (NAVD88) —
   *  fetch-lidar-heights.ts re-measures that delta every bake as a datum
   *  tripwire. Anything that wants heights above the WGS84 ELLIPSOID (a globe
   *  renderer; anything georeferenced) must add N. Around Chattanooga N is
   *  ~-29.7 m, so skipping it sinks the whole site ~30 m — the "#1 gotcha" of
   *  the Chattanooga Build Plan, and the bug its own reference viewer ships.
   *
   *  PINNED, never computed at bake time — same discipline as `lidar.ept`.
   *  Resolve once from NGS and paste the number:
   *    https://geodesy.noaa.gov/api/geoid/ght?lat=<lat>&lon=<lon>&model=13
   *  Omitted => 0 => the local-ENU diorama is unaffected (it never leaves the
   *  box, so a constant vertical shift is invisible to it). */
  geoidOffsetM: z.number().finite().gte(-110).lte(90).optional(),
  /** The civic extent the ATLAS layer covers, when it is wider than `box`.
   *
   *  `box` is composed for the DIORAMA — chatt's is a 1.46 km-wide north-south
   *  corridor framed for its tour. The atlas wants the city: the design
   *  project's own editorial extent is "downtown + North Shore + Southside",
   *  3.6x the area and 3.9x the buildings (#292).
   *
   *  Drives two things, and they must agree: which OSM buildings the atlas
   *  fetches live, and how far the wide terrain DEM reaches. Terrain that stops
   *  short of the buildings is the 176 m plateau this exists to fix.
   *
   *  ALWAYS UNIONED WITH `box` at bake time — never replaces it. Taking the
   *  civic extent verbatim once silently cut the southern corridor, dropping
   *  lidar-measured buildings 1328 -> 1043 and losing the Choo Choo.
   *  Omitted => the atlas covers exactly `box`. */
  atlasBox: z
    .object({
      swLat: z.number().finite(),
      swLon: z.number().finite(),
      neLat: z.number().finite(),
      neLon: z.number().finite(),
    })
    .optional(),
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
    ...(site.links != null && { links: site.links }),
    ...(site.embeddedTwin != null && { embeddedTwin: site.embeddedTwin }),
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

/**
 * Grid for the 3DEP raster path: MUST be degree-square —
 * (cols-1)/(rows-1) === degLon/degLat — or the service adjusts the returned
 * extent and every sample lands in the wrong place (terrain registration via
 * groundWm/Hm fractions is not self-correcting). N-S cells are the target
 * spacing; E-W cells come out finer by mPerDegLat/mPerDegLon (~1.22 at 35°N),
 * which the fraction-mapped runtime never notices.
 */
export function terrainGridFor3Dep(
  box: GeoBox,
  targetNsM = 9
): { cols: number; rows: number } {
  const proj = createProjection(box);
  const { depthM } = proj.groundSize();
  const degLon = box.neLon - box.swLon;
  const degLat = box.neLat - box.swLat;
  let spacing = targetNsM;
  for (;;) {
    const rows = Math.max(2, Math.round(depthM / spacing) + 1);
    const cols = Math.max(2, Math.round((rows - 1) * (degLon / degLat)) + 1);
    if (cols * rows <= 180_000) return { cols, rows };
    spacing *= 1.25;
  }
}

/** Grid defaults dispatch by dataset (raster vs point-query budgets differ). */
export function defaultTerrainGridFor(
  dataset: string,
  box: GeoBox
): { cols: number; rows: number } {
  return dataset === '3dep1m'
    ? terrainGridFor3Dep(box)
    : defaultTerrainGrid(box);
}

const PROVENANCE_TERRAIN: Record<string, string> = {
  ned10m: 'USGS 3DEP',
  '3dep1m': 'USGS 3DEP 1m',
  srtm30m: 'NASA SRTM',
  mapzen: 'Mapzen Terrain',
};

const PROVENANCE_DRAPE: Record<string, string> = {
  naip: 'USGS NAIP',
  esri: 'Esri World Imagery',
  tnmap: 'TDOT Aerial Surveys',
};

/** Attribution line shown in the HUD, built from the actual sources baked. */
export function provenanceFor(
  terrainDataset: string,
  drapeSource: 'naip' | 'esri' | 'tnmap',
  msHeights = false,
  lidar = false
): string {
  return [
    '© OpenStreetMap',
    PROVENANCE_TERRAIN[terrainDataset] ?? terrainDataset,
    PROVENANCE_DRAPE[drapeSource],
    ...(msHeights ? ['Microsoft Buildings'] : []),
    ...(lidar ? ['USGS 3DEP Lidar'] : []),
  ].join(' · ');
}

/**
 * The atlas extent: the site's editorial `atlasBox` UNIONED with `box`.
 *
 * The union is a DATA INVARIANT, enforced here rather than in the viewer, so
 * every consumer (live-OSM fetch, wide DEM, manifest) gets the same answer.
 * Taking a civic extent verbatim once cut chatt's southern corridor — lidar
 * 1328 -> 1043 and the Choo Choo gone — because the design project's box starts
 * at lat 35.028 while the bake starts at 35.0078. The atlas must never cover
 * less than the bake.
 */
export function atlasBoxFor(site: { box: GeoBox; atlasBox?: GeoBox }): GeoBox {
  const b = site.box;
  if (!site.atlasBox) return b;
  const a = site.atlasBox;
  return {
    swLat: Math.min(a.swLat, b.swLat),
    swLon: Math.min(a.swLon, b.swLon),
    neLat: Math.max(a.neLat, b.neLat),
    neLon: Math.max(a.neLon, b.neLon),
  };
}

/**
 * Grid for the WIDE atlas DEM. ~30 m posting: it exists to remove a 176 m cliff
 * at the baked box edge, not to add detail — the fine grid already covers the
 * site at ~9 m. Reuses the 3DEP degree-square discipline (pixel centres must
 * land on grid nodes or the terrain mis-registers, and unlike the drape that
 * error is not self-correcting).
 */
export function wideTerrainGridFor(box: GeoBox): {
  cols: number;
  rows: number;
} {
  return terrainGridFor3Dep(box, 30);
}
