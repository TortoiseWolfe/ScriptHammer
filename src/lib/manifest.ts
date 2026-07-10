// Baked-twin runtime contract (#232). Every site bakes to public/twins/<slug>/
// and its manifest carries a `site` block — the runtime's ONLY per-site data
// source (no sites/*.json read at request time; this is a static export).

import { getAssetUrl } from '@/config/project.config';

export type PaletteKey = 'trueToLife' | 'toy';

export interface TourWaypoint {
  pos: [number, number, number]; // ENU metres, camera position
  look: [number, number, number]; // ENU metres, aim point
  dwell: number; // seconds at the stop
  name: string; // caption headline
  blurb: string; // caption body
}

/** Authored overrides on the derived framing (see src/lib/framing.ts). */
export interface SiteFraming {
  homeFocus?: [number, number, number];
  homeRadius?: number;
  homePhi?: number; // radians from vertical
  homeTheta?: number; // radians around +Y (0 = camera south of focus)
  minR?: number;
  maxR?: number;
  moveSpeed?: number;
  panMargin?: number;
  fogNear?: number;
  fogFar?: number;
  cameraFar?: number;
}

export interface SiteInfo {
  slug: string;
  name: string; // HUD wordmark
  subtitle?: string;
  palette?: PaletteKey; // default 'toy'
  day?: number; // 0..1, default 0.4
  tour?: TourWaypoint[]; // absent/empty => no Tour mode
  trolley?: number[]; // flat ENU [x,z,...]; absent => no trolley agent
  framing?: SiteFraming;
  water?: boolean; // bake result: the carve found water => render the water mesh
}

export interface Manifest {
  box: { swLat: number; swLon: number; neLat: number; neLon: number };
  groundWm: number;
  groundHm: number;
  cosLat: number;
  drape: { path: string; width: number; height: number; mpp: number };
  provenance: string;
  fetchedAt: string;
  ruleHistogram: Record<string, number>;
  /** #233 bake-measured footprint-vs-aerial registration. offsetM is the
   *  RESIDUAL misregistration of this bake's geometry (a bake with a pinned
   *  vectorOffsetM should report ~0). Absent on pre-#233 bakes and on
   *  drapeless/buildingless sites. */
  registration?: {
    offsetM: { x: number; z: number };
    score: number;
    score0: number;
    confidence: number;
    districtSpreadM: number;
    flaggedCount: number;
  };
  site: SiteInfo;
}

export interface Building {
  id: number;
  ring: number[];
  height: number;
  rule: string;
  swap?: string;
}

export interface Street {
  pts: number[];
}

export interface TerrainGrid {
  cols: number;
  rows: number;
  heights: number[];
}

export interface Hero {
  swap: string;
  x: number;
  z: number;
  name: string;
}

export function siteAssetUrl(slug: string, name: string): string {
  return getAssetUrl(`/twins/${slug}/${name}`);
}

export async function loadSiteJson<T>(slug: string, name: string): Promise<T> {
  const res = await fetch(siteAssetUrl(slug, name));
  if (!res.ok) {
    throw new Error(`asset twins/${slug}/${name} -> HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * The enforceable bake↔runtime contract: a mis-baked site fails loudly at
 * load with a named reason, not as a black canvas.
 */
export function validateManifest(m: unknown, slug: string): Manifest {
  const fail = (why: string): never => {
    throw new Error(`manifest for twin "${slug}" invalid: ${why}`);
  };
  if (typeof m !== 'object' || m === null) fail('not an object');
  const man = m as Manifest;
  if (!Number.isFinite(man.groundWm) || man.groundWm <= 0)
    fail('groundWm must be a positive number');
  if (!Number.isFinite(man.groundHm) || man.groundHm <= 0)
    fail('groundHm must be a positive number');
  if (typeof man.drape?.path !== 'string' || man.drape.path.length === 0)
    fail('drape.path missing');
  const site = man.site;
  if (typeof site !== 'object' || site === null)
    fail('site block missing — rebake with `pnpm bake --site <slug>`');
  if (site.slug !== slug)
    fail(`site.slug "${site.slug}" does not match the requested twin`);
  if (typeof site.name !== 'string' || site.name.length === 0)
    fail('site.name (the HUD title) missing');
  const finiteTriple = (v: unknown): v is [number, number, number] =>
    Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n));
  if (site.tour != null) {
    if (!Array.isArray(site.tour)) fail('site.tour must be an array');
    site.tour.forEach((w, i) => {
      if (
        !finiteTriple(w?.pos) ||
        !finiteTriple(w?.look) ||
        typeof w.name !== 'string' ||
        w.name.length === 0 ||
        typeof w.blurb !== 'string' ||
        !(w.dwell > 0)
      )
        fail(
          `site.tour[${i}] malformed (needs finite pos/look triples, dwell > 0, name, blurb)`
        );
    });
  }
  if (site.trolley != null) {
    if (
      !Array.isArray(site.trolley) ||
      site.trolley.length % 2 !== 0 ||
      site.trolley.length < 6 ||
      site.trolley.some((v) => !Number.isFinite(v))
    )
      fail('site.trolley must be flat [x,z,...] pairs with at least 3 points');
  }
  if (site.palette != null && !['trueToLife', 'toy'].includes(site.palette))
    fail(`site.palette "${site.palette}" is not a known palette`);
  if (site.day != null && !(site.day >= 0 && site.day <= 1))
    fail('site.day must be within 0..1');
  if (site.framing != null) {
    if (typeof site.framing !== 'object')
      fail('site.framing must be an object');
    const f = site.framing as Record<string, unknown>;
    if (f.homeFocus != null && !finiteTriple(f.homeFocus))
      fail('site.framing.homeFocus must be a finite [x,y,z] triple');
    for (const k of [
      'homeRadius',
      'homePhi',
      'homeTheta',
      'minR',
      'maxR',
      'moveSpeed',
      'panMargin',
      'fogNear',
      'fogFar',
      'cameraFar',
    ]) {
      if (f[k] != null && !Number.isFinite(f[k]))
        fail(`site.framing.${k} must be a finite number`);
    }
  }
  if (site.water != null && typeof site.water !== 'boolean')
    fail('site.water must be a boolean');
  return man;
}

export async function loadManifest(slug: string): Promise<Manifest> {
  return validateManifest(
    await loadSiteJson<unknown>(slug, 'manifest.json'),
    slug
  );
}

// --- Premium as-built assets (#234) -----------------------------------------
//
// A twin MAY carry a LiDAR as-built capture under twins/<slug>/house/:
//   house/model.glb   — the converted scan (scripts/house/convert-scan.mjs)
//   house/house.json  — placement + property details (schema below)
// Both are OPTIONAL and, like every twin asset, PRIVATE BY DEFAULT (gitignored
// unless the site is explicitly allowlisted). Client-parcel captures must stay
// local-only without written consent — see issue #234's privacy gate.

export interface HouseInfo {
  /** Property label — HUD link text + as-built page heading. */
  label: string;
  /** Scan anchor in ENU metres (origin = box centre, north = -Z). */
  x: number;
  z: number;
  /** Yaw around +Y in degrees (align the scan to the aerial). */
  rotationDeg?: number;
  scale?: number;
  /** Fine-tune seating after auto-grounding on the terrain. */
  yOffset?: number;
  /** Key/value property facts shown on the as-built page. */
  details?: Record<string, string>;
  /** OSM building ids whose massing boxes hide while the scan is shown. */
  hideBuildingIds?: number[];
  /** Multi-fragment captures: per-GLB-group registration transforms, keyed by
   *  the group name convert-scan.mjs assigned (the fragment's file basename).
   *  pos' = T(position)·RotY(−yawDeg)·T(−pivot); pivot is the fragment's
   *  vertex centroid, position its registered location (both metres in the
   *  primary fragment's frame). Measured by the voxel-overlap search. */
  parts?: Record<
    string,
    {
      pivot: [number, number, number];
      yawDeg: number;
      position: [number, number, number];
    }
  >;
}

export function validateHouse(h: unknown, slug: string): HouseInfo {
  const fail = (why: string): never => {
    throw new Error(`house.json for twin "${slug}" invalid: ${why}`);
  };
  if (typeof h !== 'object' || h === null) fail('not an object');
  const house = h as HouseInfo;
  if (typeof house.label !== 'string' || house.label.length === 0)
    fail('label missing');
  if (!Number.isFinite(house.x) || !Number.isFinite(house.z))
    fail('x/z must be finite ENU metres');
  for (const k of ['rotationDeg', 'scale', 'yOffset'] as const) {
    if (house[k] != null && !Number.isFinite(house[k]))
      fail(`${k} must be a finite number`);
  }
  if (
    house.hideBuildingIds != null &&
    (!Array.isArray(house.hideBuildingIds) ||
      house.hideBuildingIds.some((v) => !Number.isInteger(v)))
  )
    fail('hideBuildingIds must be integer OSM ids');
  if (house.parts != null) {
    if (typeof house.parts !== 'object' || Array.isArray(house.parts))
      fail('parts must be an object keyed by GLB group name');
    const finiteTriple = (v: unknown): v is [number, number, number] =>
      Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n));
    for (const [name, part] of Object.entries(house.parts)) {
      if (
        typeof part !== 'object' ||
        part === null ||
        !finiteTriple(part.pivot) ||
        !finiteTriple(part.position) ||
        !Number.isFinite(part.yawDeg)
      )
        fail(
          `parts["${name}"] needs finite pivot/position triples and a yawDeg`
        );
    }
  }
  return house;
}

/** Load a twin's as-built descriptor; null when the twin has none (404).
 *  Throws (loudly) on a malformed descriptor or a descriptor whose model.glb
 *  is missing — a half-installed capture must not degrade silently. */
export async function loadHouse(slug: string): Promise<HouseInfo | null> {
  const res = await fetch(siteAssetUrl(slug, 'house/house.json'));
  if (!res.ok) return null;
  const house = validateHouse(await res.json(), slug);
  // house.json without its GLB would otherwise surface as a mid-render loader
  // rejection (page-level error UI) — probe up front for a named error.
  const model = await fetch(siteAssetUrl(slug, 'house/model.glb'), {
    method: 'HEAD',
  });
  if (!model.ok) {
    throw new Error(
      `house.json for twin "${slug}" present but house/model.glb -> HTTP ${model.status} — run scripts/house/convert-scan.mjs`
    );
  }
  return house;
}

// --- Warehouse-sampled buildings (#259) ---------------------------------------
//
// Abstracted 3D Warehouse landmarks emitted by scripts/warehouse/emit-models.ts
// into public/twins/<slug>/models/ (gitignored — local-only until a per-model
// publish decision). The layer is OPTIONAL by construction: no models.json ⇒
// null ⇒ layer off, so committed twins render identically in CI/live.

export interface WarehouseModelEntry {
  slug: string;
  file: string;
  title: string;
  creator: string;
  warehouseId: string;
  url: string;
  /** Curation grouping key (e.g. "riverfront") — drives the directory panel. */
  neighborhood?: string;
  /** ENU anchor metres (already projected through the site's vectorOffsetM). */
  x: number;
  z: number;
  yawDeg?: number;
  scale?: number;
  yOffset?: number;
  /** Warehouse community signals (QC surface — shown in the Directory). */
  rating?: number;
  reviewCount?: number;
  downloads?: number;
}

export interface WarehouseModelsInfo {
  site: string;
  /** Ordered directory groups; entries reference these by `neighborhood`. */
  neighborhoods?: { key: string; label: string }[];
  models: WarehouseModelEntry[];
}

/** Live placement adjustment from the ?edit editor (localStorage-backed) —
 *  same semantics as scripts/warehouse/overrides-*.json merged at emit time:
 *  dx/dz add to the anchor, yawDeg/scale/yOffset replace, exclude hides. */
export interface TwinPlacementOverride {
  yawDeg?: number;
  scale?: number;
  yOffset?: number;
  dx?: number;
  dz?: number;
  exclude?: boolean;
}

/** Load a twin's sampled-buildings layer; null when the twin has none (404). */
export async function loadWarehouseModels(
  slug: string
): Promise<WarehouseModelsInfo | null> {
  const res = await fetch(siteAssetUrl(slug, 'models/models.json'));
  if (!res.ok) return null;
  const info = (await res.json()) as WarehouseModelsInfo;
  if (!Array.isArray(info.models)) {
    throw new Error(`models.json for twin "${slug}" has no models[] array`);
  }
  for (const m of info.models) {
    if (
      typeof m.file !== 'string' ||
      typeof m.x !== 'number' ||
      typeof m.z !== 'number'
    ) {
      throw new Error(
        `models.json for twin "${slug}": entry "${m.slug ?? '?'}" needs file/x/z`
      );
    }
  }
  return info;
}

// --- Local-only HUD links ----------------------------------------------------
//
// twins/<slug>/links.local.json: [{ "label": "...", "href": "/twins/x/?house" }]
// `*.local.json` is ALWAYS gitignored — this is how a private demo (e.g. the
// flagship's "client house" button) gets wired without the target address ever
// touching git: drop the file locally, delete it when done. hrefs are app
// paths WITHOUT basePath (the HUD consumer prefixes via getInternalUrl).

export interface TwinLink {
  label: string;
  href: string;
}

export async function loadLocalLinks(slug: string): Promise<TwinLink[]> {
  try {
    const res = await fetch(siteAssetUrl(slug, 'links.local.json'));
    if (!res.ok) return [];
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (l): l is TwinLink =>
        typeof l === 'object' &&
        l !== null &&
        typeof (l as TwinLink).label === 'string' &&
        (l as TwinLink).label.length > 0 &&
        typeof (l as TwinLink).href === 'string' &&
        (l as TwinLink).href.startsWith('/') &&
        // '//host' is a protocol-relative EXTERNAL url, not an app path
        !(l as TwinLink).href.startsWith('//')
    );
  } catch {
    // absent, non-JSON (static hosts serve HTML 404 pages), or malformed —
    // local links are best-effort by design
    return [];
  }
}
