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
 * Ground elevation in metres above the WGS84 ELLIPSOID for a building's
 * footprint, given a terrain sampler.
 *
 * This is the Build Plan's own "#1 gotcha", and its Phase 0 viewer walks
 * straight into it: that viewer extrudes every building at `height: 0` in a
 * Cesium.Primitive, then loads Cesium World Terrain as soon as a token is
 * pasted. Ground in Chattanooga is ~175 m above the ellipsoid, so its buildings
 * sink underground the moment the terrain arrives. (Its author half-knew — the
 * traffic layer hardcodes `hasTerrain ? 210 : 3` to dodge exactly this.)
 *
 * Sampling the building's own centroid rather than a per-vertex height keeps
 * each massing box level: OSM footprints are flat-bottomed by construction, and
 * following the terrain per-vertex would shear them on a slope. The site has
 * 55.5 m of relief, so a single global constant would not do.
 *
 * `sampleEllipsoidal` returns ellipsoidal metres (orthometric + geoid), so the
 * datum is already resolved by the time it gets here — see cesium/terrain.ts.
 */
export function groundEllipsoidHeightM(
  b: AtlasBuilding,
  sampleEllipsoidal: (lon: number, lat: number) => number
): number {
  let lon = 0;
  let lat = 0;
  const n = b.lonLat.length / 2;
  for (let i = 0; i < b.lonLat.length; i += 2) {
    lon += b.lonLat[i];
    lat += b.lonLat[i + 1];
  }
  return sampleEllipsoidal(lon / n, lat / n);
}
