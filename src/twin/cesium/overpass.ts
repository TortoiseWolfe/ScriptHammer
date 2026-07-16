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
//
// #292: the atlas is about to become the DEFAULT renderer, not opt-in — an
// unthrottled 43 km2 Overpass query on every page load is not tolerable
// against a free community API. scripts/bake/build-wide-buildings.ts runs
// this SAME join once at bake time and ships the result as
// buildings-wide.json; the default path here just fetches that file. The
// live Overpass query below still runs behind ?live, e.g. to pick up a fix
// made on openstreetmap.org since the last bake.

import { getAssetUrl } from '@/config/project.config';
import { resolveHeight } from '@/lib/height';
import { OUTSIDE_HEIGHTS, ringAreaM2 } from '@/lib/live-building-heights';
import type { Building, Manifest } from '@/lib/manifest';

export interface OverpassBox {
  s: number;
  w: number;
  n: number;
  e: number;
}

/**
 * The atlas extent, from the manifest.
 *
 * `manifest.atlasBox` is emitted by the bake ALREADY UNIONED with `box`
 * (scripts/bake/site-config.ts atlasBoxFor) — the union is a data invariant, not
 * viewer logic, because the same extent must drive the live-OSM fetch AND the
 * wide DEM. Terrain that stops short of the buildings is a cliff; buildings that
 * stop short of the terrain is a bald patch.
 *
 * This used to be a per-slug ATLAS_BBOX constant here, with the union redone
 * locally. Absent (pre-2026-07 bakes) => the baked box.
 */
export function atlasBoxFor(_slug: string, manifest: Manifest): OverpassBox {
  const b = manifest.atlasBox ?? manifest.box;
  return { s: b.swLat, w: b.swLon, n: b.neLat, e: b.neLon };
}

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

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Fetch every building in the atlas box and resolve its height, preferring the
 * bake. Two distinct paths, picked by whether `?live` is on the URL:
 *
 *   default — fetches the bake-time join shipped as buildings-wide.json (a
 *     same-origin static asset; no Overpass call, no mirrors, nothing to be
 *     "unreachable"). Throws if that fetch fails, which the caller
 *     (AtlasViewer.client.tsx) treats as "this site never baked one" rather
 *     than a real failure — buildings-wide.json is OPTIONAL, exactly like
 *     terrain-wide.json.
 *   ?live — queries the Overpass mirrors directly, for picking up a fix made
 *     on openstreetmap.org since the last bake. Throws if every mirror
 *     fails — the caller keeps the baked layer and reports it 'offline'.
 */
export async function fetchLiveBuildings(
  slug: string,
  manifest: Manifest,
  baked: Building[],
  signal?: AbortSignal
): Promise<LiveBuilding[]> {
  // window.location.search, NOT useSearchParams — same convention as
  // TwinCanvasHost's ?atlas and TwinCanvas's ?house/?ortho; useSearchParams
  // forces a Suspense bailout under output:'export'.
  const isLive = new URLSearchParams(window.location.search).has('live');
  if (!isLive) {
    const url = getAssetUrl(`/twins/${slug}/buildings-wide.json`);
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error(`buildings-wide.json -> HTTP ${r.status}`);
    return (await r.json()) as LiveBuilding[];
  }

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
