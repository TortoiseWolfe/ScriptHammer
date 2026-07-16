// Baked buildings -> WGS84, for the Cesium atlas layer.
//
// Pure: no Cesium import, no DOM. The projection is the load-bearing part of
// the atlas (get it wrong and 1510 buildings land in the wrong city, silently),
// so it lives apart from the viewer where it can be tested without WebGL.

import { createProjection, type GeoBox } from '@/lib/enu';
import type { Building, Manifest } from '@/lib/manifest';

/** Height-provenance palette. The atlas can show WHERE a height came from —
 *  something neither Cesium OSM Buildings nor Google's photoreal mesh can do,
 *  because one has only OSM tags and the other has no per-building attributes
 *  at all. `lidar` is the measured majority; `fallback` is the honest "we
 *  guessed" bucket and reads as such. */
export const RULE_COLORS: Record<string, string> = {
  lidar: '#56b8e6', // measured — 3DEP p90 − DTM
  height: '#4bc470', // human-asserted metres in OSM
  override: '#7aa3f0', // our researched per-site value
  levels: '#ecd24f', // derived: levels × 3.2
  ms: '#e8a04f', // ML estimate
  fallback: '#ef8f8f', // prior — no data at all
};
export const RULE_LABELS: Record<string, string> = {
  lidar: 'measured (USGS 3DEP lidar)',
  height: 'tagged in OpenStreetMap',
  override: 'researched override',
  levels: 'derived from floor count',
  ms: 'ML estimate (Microsoft)',
  fallback: 'estimated from type + footprint',
};

export interface AtlasBuilding {
  id: number;
  /** Flat [lon, lat, lon, lat, ...] — Cesium.Cartesian3.fromDegreesArray shape. */
  lonLat: number[];
  heightM: number;
  rule: string;
  cssColor: string;
}

/**
 * The bake's `vectorOffsetM` (#233) is baked into every ring, and the manifest
 * does NOT record it — `registration.offsetM` is the RESIDUAL of the bake, not
 * the correction that was applied. Until the manifest carries it, the atlas
 * cannot know it from the artifact alone.
 *
 * That matters here specifically because the atlas draws on Esri/Google imagery
 * rather than the site's own drape. vectorOffsetM exists to align vectors to
 * THAT DRAPE; on independently-georeferenced imagery we want the true OSM
 * position, so the correction must come back out.
 *
 * chatt's is {x: 0.5, z: 0} — half a metre, well under the 1–5 m the imagery
 * itself carries, so omitting it is not visible. It is still wrong, and wrong
 * quietly, which is worse. Passing it explicitly keeps the gap honest until the
 * bake records it.
 */
export function buildingsToWgs84(
  manifest: Manifest,
  buildings: Building[],
  vectorOffsetM: { x: number; z: number } = { x: 0, z: 0 }
): AtlasBuilding[] {
  const proj = createProjection(manifest.box as GeoBox, vectorOffsetM);
  const out: AtlasBuilding[] = [];

  for (const b of buildings) {
    // ring is flat [x, z, x, z, ...] in ENU metres.
    if (!Array.isArray(b.ring) || b.ring.length < 8) continue; // <4 vertices: not a polygon
    const lonLat: number[] = new Array(b.ring.length);
    let ok = true;
    for (let i = 0; i < b.ring.length; i += 2) {
      const [lon, lat] = proj.enuToLonLat(b.ring[i], b.ring[i + 1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        ok = false;
        break;
      }
      lonLat[i] = lon;
      lonLat[i + 1] = lat;
    }
    if (!ok) continue;
    out.push({
      id: b.id,
      lonLat,
      heightM: b.height,
      rule: b.rule,
      cssColor: RULE_COLORS[b.rule] ?? RULE_COLORS.fallback,
    });
  }
  return out;
}

/**
 * Ground elevation, in metres above the WGS84 ELLIPSOID, that a building's
 * footprint should extrude from.
 *
 * This is the Build Plan's own "#1 gotcha", and its Phase 0 viewer walks
 * straight into it: that viewer extrudes every building at `height: 0` in a
 * Cesium.Primitive, then loads Cesium World Terrain as soon as a token is
 * pasted. Ground in Chattanooga is ~175 m above the ellipsoid, so the buildings
 * sink underground the moment the terrain arrives. (Its author half-knew — the
 * traffic layer hardcodes `hasTerrain ? 210 : 3` to dodge exactly this.)
 *
 * With NO terrain provider the globe surface IS the ellipsoid, so 0 is correct
 * and this is a no-op. When the baked 3DEP terrain lands, this becomes
 * `terrainElevation(lon, lat) + geoidOffsetM` — 3DEP heights are NAVD88
 * ORTHOMETRIC (see scripts/bake/fetch-lidar-heights.ts, which re-measures the
 * delta every bake as a datum tripwire) and Cesium wants ellipsoidal, so the
 * geoid separation (N ≈ −30.5 m here) has to be applied. Routing every base
 * height through one function now means that becomes a single change, not a
 * hunt for the places that assumed zero.
 */
export function groundEllipsoidHeightM(): number {
  return 0;
}
