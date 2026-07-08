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
