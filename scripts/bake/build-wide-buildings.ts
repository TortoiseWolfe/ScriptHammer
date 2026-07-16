// Bake-time twin of src/twin/cesium/overpass.ts's fetchLiveBuildings (#292).
// Same join, same output type — computed once at bake instead of on every
// page load. The atlas's default path then needs no Overpass call — but it
// is NOT API-free: AtlasViewer.client.tsx still hits
// services.arcgisonline.com for base imagery on every load, unthrottled and
// token-free. That dependency was never Overpass's and this bake step does
// nothing to remove it.
//
// NOT a wide buildings.json: that artifact is ENU-projected and clipped to
// site.box (build-scene.ts drops anything whose centroid fails inBox).
// LiveBuilding.lonLat is raw OSM lon/lat on purpose — no ENU round-trip, so
// no projection error and no vectorOffsetM to unwind.
import { resolveHeight } from './height';
import { OUTSIDE_HEIGHTS, ringAreaM2 } from './live-building-heights';
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

/**
 * Join the wide-atlas OSM buildings against the bake's measured heights —
 * exactly the join fetchLiveBuildings runs live at request time, computed
 * once here instead. Buildings inside the baked box keep their measured
 * height (lidar, for most of the bake's footprints — a real measurement of
 * that exact roof); buildings outside it resolve through the SAME
 * resolveHeight ladder the bake runs, via their live OSM tags.
 *
 * `cosLat` MUST be the exact scalar the runtime join uses: manifest.cosLat
 * (`proj.mPerDegLon / 111320`, from `createProjection(site.box)` — the
 * NARROW baked box, not the wide atlasBox this function's OSM data spans).
 * Callers should pass that same computation, not derive their own from the
 * wide box — a second, box-dependent cosLat here is exactly how this and the
 * live path would silently compute different rule-6 area-bonus tiers for the
 * same un-baked building.
 */
export function buildWideBuildings(
  osm: { elements: OsmElement[] },
  baked: BakedBuilding[],
  cosLat: number
): LiveBuilding[] {
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
