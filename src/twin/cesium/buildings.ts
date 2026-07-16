// Baked buildings -> WGS84, for the Cesium atlas layer.
//
// Pure: no Cesium import, no DOM. The projection is the load-bearing part of
// the atlas (get it wrong and 1510 buildings land in the wrong city, silently),
// so it lives apart from the viewer where it can be tested without WebGL.

import { createProjection, type GeoBox } from '@/lib/enu';
import { LEVEL_PRIORS } from '@/lib/height';
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
  /** Live OSM tags. Absent on baked-only buildings: buildings.json carries
   *  geometry + height and deliberately no tags — the live layer is the tag
   *  source (#292). */
  tags?: Record<string, string>;
}

// ── What a building IS ───────────────────────────────────────────────────────
//
// MEASURED IN THE BAKED BOX (_raw/osm.json, ~1547 buildings):
//   1316  building=yes   <- 85%. "A building exists here", nothing more.
//     37  house    31 retail   27 apartments   22 detached   17 office
//     13  parking  10 church    9 garage  ... 26 distinct values, long tail of 1-8
//   148 have a name | 229 have an address | 128 have building:levels
//
// So "everything is labelled building" is mostly TRUE OF OSM, not a rendering
// bug: 85% of downtown genuinely has no structure type recorded. That is why
// `type` is NOT the default colour mode — it would paint 85% of the city one
// colour and read as more broken, not less.
//
// It is still worth having, because it shows exactly how much of the city is
// unmapped — which is the Build Plan's contribution loop ("Missing building name
// or height? Tag it on openstreetmap.org and it appears in the twin on next
// load"). The untyped bucket is the ask, rendered.

export type ColorBy = 'provenance' | 'type' | 'height';

/** Coarse buckets over OSM's `building=*`. Keys are checked against LEVEL_PRIORS
 *  by test: a value the height ladder reasons about must land in a bucket, or
 *  the legend and the ladder are describing different cities. */
const TYPE_BUCKETS: Record<string, string> = {
  house: 'residential',
  detached: 'residential',
  terrace: 'residential',
  residential: 'residential',
  apartments: 'residential',
  dormitory: 'residential',
  hotel: 'residential',
  retail: 'commercial',
  commercial: 'commercial',
  office: 'commercial',
  industrial: 'industrial',
  warehouse: 'industrial',
  greenhouse: 'industrial',
  garage: 'ancillary',
  shed: 'ancillary',
  hut: 'ancillary',
  parking: 'ancillary',
  roof: 'ancillary',
  pavilion: 'ancillary',
  church: 'civic',
  school: 'civic',
  university: 'civic',
  government: 'civic',
  public: 'civic',
  hospital: 'civic',
  civic: 'civic',
  grandstand: 'civic',
};

export const TYPE_COLORS: Record<string, string> = {
  residential: '#4bc470',
  commercial: '#56b8e6',
  civic: '#b48ae8',
  industrial: '#e8a04f',
  ancillary: '#8a8ab0',
  untyped: '#3f3f5e', // building=yes / no tag — deliberately drab: it is a gap
};
export const TYPE_LABELS: Record<string, string> = {
  residential: 'residential',
  commercial: 'commercial',
  civic: 'civic / institutional',
  industrial: 'industrial',
  ancillary: 'garage / parking / shed',
  untyped: 'untyped in OSM (building=yes)',
};

export function typeBucket(tags?: Record<string, string>): string {
  const b = tags?.building;
  if (!b || b === 'yes') return 'untyped';
  return TYPE_BUCKETS[b] ?? 'untyped';
}

/** Every type the height ladder has a prior for must be bucketed. */
export function unbucketedLadderTypes(): string[] {
  return Object.keys(LEVEL_PRIORS).filter(
    (k) => k !== 'yes' && !TYPE_BUCKETS[k]
  );
}

export const HEIGHT_BANDS: { max: number; key: string; color: string }[] = [
  { max: 8, key: '0-8 m', color: '#383a5e' },
  { max: 18, key: '8-18 m', color: '#464a7d' },
  { max: 35, key: '18-35 m', color: '#54609c' },
  { max: 60, key: '35-60 m', color: '#4f86c0' },
  { max: Infinity, key: '60 m+', color: '#56b8e6' },
];
export function heightBand(m: number): { key: string; color: string } {
  return (
    HEIGHT_BANDS.find((b) => m < b.max) ?? HEIGHT_BANDS[HEIGHT_BANDS.length - 1]
  );
}

/** The one place a colour mode turns a building into a legend key + colour. */
export function classify(
  b: AtlasBuilding,
  mode: ColorBy
): { key: string; color: string; label: string } {
  if (mode === 'type') {
    const k = typeBucket(b.tags);
    return { key: k, color: TYPE_COLORS[k], label: TYPE_LABELS[k] };
  }
  if (mode === 'height') {
    const band = heightBand(b.heightM);
    return { key: band.key, color: band.color, label: band.key };
  }
  return {
    key: b.rule,
    color: RULE_COLORS[b.rule] ?? RULE_COLORS.fallback,
    label: RULE_LABELS[b.rule] ?? b.rule,
  };
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
    out.push({ id: b.id, lonLat, heightM: b.height, rule: b.rule });
  }
  return out;
}

/**
 * The ellipsoidal height a building's massing box extrudes FROM: the MINIMUM
 * ground under its own footprint.
 *
 * One base per building, so the box stays level — OSM footprints are
 * flat-bottomed by construction and following terrain per-vertex would shear
 * them. But the base must be the ring's MIN, not its centroid.
 *
 * This sampled the CENTROID and defended it in a comment. Half of that was
 * right (level) and half was wrong (height): on a slope, one height for a
 * footprint spanning metres of elevation floats the downhill half and buries the
 * uphill half. chatt's baked box holds 55.5 m of relief and the wide DEM reaches
 * 649.5 m, so the moment real hillsides entered the view buildings visibly hung
 * in the air (reported: way 174322222, 10.7 m, rule=lidar, on a hillside INSIDE
 * the baked box — not a wide-grid resolution artifact).
 *
 * Min is the right trade, not a compromise: the worst case becomes a building
 * cut into its uphill slope, which is what real buildings on hills do and what
 * every 3D city renderer does. Floating reads as broken; buried reads as a
 * building on a hill.
 *
 * NOTE the caller adds `heightM` to this — the building's own height, NOT
 * stretched to the max ground. Stretching to close the visual gap would silently
 * inflate the 1328 lidar MEASUREMENTS this layer exists to show.
 *
 * `sampleEllipsoidal` returns ellipsoidal metres (orthometric + geoid), and is
 * the same definition of ground the terrain provider renders — see
 * cesium/terrain.ts. They must agree or the fix is cosmetic.
 */
export function groundEllipsoidHeightM(
  b: AtlasBuilding,
  sampleEllipsoidal: (lon: number, lat: number) => number
): number {
  let min = Infinity;
  for (let i = 0; i < b.lonLat.length; i += 2) {
    const g = sampleEllipsoidal(b.lonLat[i], b.lonLat[i + 1]);
    if (g < min) min = g;
  }
  // Degenerate ring (no vertices) — fall back to the ellipsoid rather than
  // extruding from Infinity and vanishing the building.
  return Number.isFinite(min) ? min : 0;
}
