// Live OSM buildings for the atlas, joined to the bake's measured heights.
//
// WHY (#292). The baked box was composed for the tilt-shift DIORAMA: a 1.46 km
// wide north–south corridor framed for the Ross's Landing → Choo Choo tour.
// Measured against the design project's Phase 0 viewer:
//
//   Phase 0 demo bbox   5.66 x 5.33 km = 30.1 km2   6,099 OSM buildings
//   baked chatt box     1.46 x 5.79 km =  8.5 km2   1,547 OSM buildings
//
// 3.6x the area, 3.9x the buildings. The atlas rendering only the bake is
// rendering a diorama-shaped slice of downtown.
//
// THE JOIN. `Building.id` in buildings.json IS the OSM way id, so pairing the
// two sources is free:
//
//   inside the baked box  -> the bake's height + rule (lidar for 1328 of them,
//                            a real measurement of that exact roof)
//   outside it            -> resolveHeight() on the live tags — the SAME ladder
//                            the bake runs, via src/lib/height.ts
//
// So we get the demo's coverage with strictly better heights than the demo,
// which is OSM-tag-only everywhere. And the provenance colouring makes the seam
// legible rather than hidden: you can SEE where the measurements stop.
//
// It also restores the civic loop the Build Plan is built on — "Fix the map →
// fix the twin. Tag it on openstreetmap.org and it appears in the twin on next
// load" — which an all-baked atlas structurally cannot do.
//
// This is a runtime third-party call, which the diorama's "zero runtime
// third-party calls" rule forbids. Deliberate and scoped: it is additive, and
// the baked floor still renders when Overpass is unreachable.

import { resolveHeight } from '@/lib/height';
import type { Building, Manifest } from '@/lib/manifest';

export interface OverpassBox {
  s: number;
  w: number;
  n: number;
  e: number;
}

/**
 * The atlas's civic extent, per slug.
 *
 * chatt's is the Phase 0 viewer's own BBOX verbatim — "downtown + North Shore +
 * Southside", a deliberate editorial choice by the design project, not a number
 * I picked. Absent => fall back to the baked box (correct for any site without
 * an atlas extent yet).
 *
 * BELONGS IN THE SITE CONFIG + MANIFEST, like vectorOffsetM/geoidOffsetM. It is
 * here because adding it to the bake means a rebake, and the value is editorial
 * rather than derived. Tracked on #292.
 */
const ATLAS_BBOX: Record<string, OverpassBox> = {
  chatt: { s: 35.028, w: -85.345, n: 35.076, e: -85.283 },
};

/**
 * The atlas extent: the UNION of the editorial civic box and the baked box.
 *
 * Union, not replacement. Caught live: the demo's bbox starts at lat 35.028
 * while the bake starts at 35.0078, so taking the demo's box verbatim widened
 * east–west but silently CHOPPED THE SOUTHERN CORRIDOR — dropping measured
 * lidar buildings from 1328 to 1043 and cutting off the Choo Choo (35.0093),
 * which is a tour landmark. The atlas must never render less of the bake than
 * the bake has.
 */
export function atlasBoxFor(slug: string, manifest: Manifest): OverpassBox {
  const { swLat, swLon, neLat, neLon } = manifest.box;
  const baked = { s: swLat, w: swLon, n: neLat, e: neLon };
  const civic = ATLAS_BBOX[slug];
  if (!civic) return baked;
  return {
    s: Math.min(civic.s, baked.s),
    w: Math.min(civic.w, baked.w),
    n: Math.max(civic.n, baked.n),
    e: Math.max(civic.e, baked.e),
  };
}

/** Fallback height config for buildings OUTSIDE the bake, where we have no
 *  per-site override list. The clamp is generous: it only binds rule-6 guesses,
 *  and this box reaches beyond the downtown towers. */
const OUTSIDE_HEIGHTS = { overrides: {}, fallbackClampM: 91.44 };

export interface LiveBuilding {
  /** OSM way/relation id. */
  id: number;
  /** Flat [lon, lat, ...] straight from OSM — no ENU round-trip, so no
   *  projection error and no vectorOffsetM to unwind. */
  lonLat: number[];
  heightM: number;
  rule: string;
  /** True when the height came from the bake rather than the live tags. */
  baked: boolean;
  tags: Record<string, string>;
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

/** Shoelace area of a lon/lat ring, in m2 — resolveHeight's rule-6 prior needs
 *  a footprint area. Local flat-earth scaling is plenty at this size. */
function ringAreaM2(lonLat: number[], cosLat: number): number {
  let a = 0;
  const n = lonLat.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += lonLat[i * 2] * lonLat[j * 2 + 1] - lonLat[j * 2] * lonLat[i * 2 + 1];
  }
  // deg2 -> m2 at this latitude
  return Math.abs(a / 2) * 111320 * 111320 * cosLat;
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Fetch every building in the atlas box and resolve its height, preferring the
 * bake. Throws if every mirror fails — the caller keeps the baked layer.
 */
export async function fetchLiveBuildings(
  slug: string,
  manifest: Manifest,
  baked: Building[],
  signal?: AbortSignal
): Promise<LiveBuilding[]> {
  const box = atlasBoxFor(slug, manifest);
  const q =
    `[out:json][timeout:90];(` +
    `way["building"](${box.s},${box.w},${box.n},${box.e});` +
    `relation["building"](${box.s},${box.w},${box.n},${box.e});` +
    `);out tags geom;`;

  let data: { elements?: OverpassElement[] } | null = null;
  let lastErr: unknown;
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      data = await r.json();
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!data) throw new Error(`Overpass unreachable: ${String(lastErr)}`);

  // The join key IS the OSM id.
  const bakedById = new Map(baked.map((b) => [b.id, b]));
  const cosLat = manifest.cosLat;
  const out: LiveBuilding[] = [];

  for (const el of data.elements ?? []) {
    const geom = el.geometry;
    if (!geom || geom.length < 4) continue;
    const lonLat: number[] = [];
    for (const g of geom) lonLat.push(g.lon, g.lat);

    const hit = bakedById.get(el.id);
    if (hit) {
      // The bake already ran the full ladder on this footprint, including the
      // lidar measurement. Nothing live can beat it.
      out.push({
        id: el.id,
        lonLat,
        heightM: hit.height,
        rule: hit.rule,
        baked: true,
        tags: el.tags ?? {},
      });
      continue;
    }
    const tags = el.tags ?? {};
    const { meters, rule } = resolveHeight(
      tags,
      ringAreaM2(lonLat, cosLat),
      OUTSIDE_HEIGHTS
    );
    out.push({ id: el.id, lonLat, heightM: meters, rule, baked: false, tags });
  }
  return out;
}
