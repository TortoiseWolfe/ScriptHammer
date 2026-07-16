// Bake-time twin of src/twin/cesium/overpass.ts's fetchLiveBuildings (#292).
// Same join, same output type — computed once at bake instead of on every
// page load. The atlas's default path then needs no public API.
//
// NOT a wide buildings.json: that artifact is ENU-projected and clipped to
// site.box (build-scene.ts drops anything whose centroid fails inBox).
// LiveBuilding.lonLat is raw OSM lon/lat on purpose — no ENU round-trip, so
// no projection error and no vectorOffsetM to unwind.
import { metersPerDegree, type GeoBox } from './enu';
import { resolveHeight, type HeightsConfig } from './height';
import type { LiveBuilding } from '../../src/twin/cesium/overpass';

interface OsmElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

interface BakedBuilding {
  id: number;
  height: number;
  rule: string;
}

/** Same fallback config fetchLiveBuildings uses for buildings the bake never
 *  measured: no per-site override list at this remove, and a clamp generous
 *  enough to reach past the downtown towers. */
const OUTSIDE_HEIGHTS: HeightsConfig = {
  overrides: {},
  fallbackClampM: 91.44,
};

/** Shoelace area of a lon/lat ring, in m2 — resolveHeight's rule-6 fallback
 *  needs a footprint area. Ported from src/twin/cesium/overpass.ts's private
 *  ringAreaM2 (not exported there). Local flat-earth scaling is plenty at
 *  this size. */
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

/**
 * Join the wide-atlas OSM buildings against the bake's measured heights —
 * exactly the join fetchLiveBuildings runs live at request time, computed
 * once here instead. Buildings inside the baked box keep their measured
 * height (lidar, for most of the bake's footprints — a real measurement of
 * that exact roof); buildings outside it resolve through the SAME
 * resolveHeight ladder the bake runs, via their live OSM tags.
 */
export function buildWideBuildings(
  osm: { elements: OsmElement[] },
  baked: BakedBuilding[],
  box: GeoBox
): LiveBuilding[] {
  // The same scalar the runtime join uses (manifest.cosLat =
  // proj.mPerDegLon / 111320, from createProjection(site.box)): one
  // flat-earth scale factor for the whole extent, not a per-building
  // recomputation.
  const centerLat = (box.swLat + box.neLat) / 2;
  const cosLat = metersPerDegree(centerLat).mPerDegLon / 111320;

  const bakedById = new Map(baked.map((b) => [b.id, b]));
  const out: LiveBuilding[] = [];

  for (const el of osm.elements) {
    const tags = el.tags ?? {};
    const geom = el.geometry;
    // The wide OSM fetch also carries highways and water (fetch-osm.ts's
    // query is shared with the diorama), so — unlike the runtime's own
    // building-only Overpass query — we must filter on the tag here.
    if (!tags.building || !geom || geom.length < 4) continue;

    const lonLat: number[] = [];
    for (const g of geom) lonLat.push(g.lon, g.lat);

    const hit = bakedById.get(el.id);
    if (hit) {
      // The bake already ran the full ladder on this footprint, including
      // the lidar measurement. Nothing live can beat it.
      out.push({
        id: el.id,
        lonLat,
        heightM: hit.height,
        rule: hit.rule,
        baked: true,
        tags,
      });
      continue;
    }

    const { meters, rule } = resolveHeight(
      tags,
      ringAreaM2(lonLat, cosLat),
      OUTSIDE_HEIGHTS
    );
    out.push({ id: el.id, lonLat, heightM: meters, rule, baked: false, tags });
  }
  return out;
}
