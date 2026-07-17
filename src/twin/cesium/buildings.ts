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

/**
 * What the atlas colours by before anyone touches a chip.
 *
 * `type`, because it is the only mode that describes the CITY. `provenance`
 * describes our own pipeline — lidar vs OSM tag vs estimate — which is honest
 * and useful, but it is metadata about how we know a height, not about the
 * place. `height` re-states what the 3D geometry already shows: tall buildings
 * are visibly tall. Only `type` tells a visitor where Chattanooga lives, works
 * and makes things.
 *
 * 72% of buildings come back `untyped in OSM (building=yes)`, and that argues
 * FOR this default rather than against it — see the note above: "the untyped
 * bucket is the ask, rendered". Grey is the contribution loop made legible.
 *
 * Lives here, next to the type it instantiates, rather than in the viewer:
 * AtlasViewer holds the default in BOTH a useState and a useRef (the ref lets
 * the main effect read the live mode without depending on `colorBy` and tearing
 * the viewer down on every toggle). Two literals there would disagree only on
 * first paint — the hardest place to notice. One constant, imported twice, makes
 * that impossible. Pinned by __tests__/buildings.test.ts.
 */
export const DEFAULT_COLOR_BY: ColorBy = 'type';

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
 * The vertical span a building's massing box occupies: ellipsoidal metres from
 * `baseM` (below every vertex) to `topM` (clear of every vertex by heightM).
 *
 * TWO FAILURE MODES, and the naive fixes each pick one:
 *
 *   centroid base, +height   -> FLOATS. One height for a footprint spanning
 *                               metres of elevation hangs the downhill half in
 *                               the air. Measured: 7966 of 8031 buildings.
 *   min base, +height        -> BURIES. On ground that climbs more than the
 *                               building is tall — Tennessee bluffs, and chatt
 *                               reaches 649.5 m — the whole box vanishes under
 *                               the hill. Reported live: a 11.9 m government
 *                               building (way 66419703) swallowed by a bluff.
 *
 * Both were mine, in that order. The answer is not to choose:
 *
 *   base = MIN ground under the ring   -> nothing can float
 *   top  = MAX ground under the ring + heightM  -> nothing can bury; the height
 *                                                  visible above the UPHILL
 *                                                  grade is exactly heightM
 *
 * The rendered box is therefore (maxGround − minGround) + heightM tall, the
 * extra being a below-grade skirt on the downhill side. That is what buildings
 * on slopes actually look like, and what 3D city renderers do.
 *
 * This does NOT inflate the measurement. I previously rejected this approach
 * reasoning that extruding past heightM would "silently inflate the 1328 lidar
 * measurements" — conflating two different things. The card reports heightM, the
 * measured roof-above-ground. The geometry additionally accounts for the ground
 * varying under the footprint. Reporting and rendering are not the same number,
 * and forcing them to be identical is what buried the buildings.
 *
 * One base per building keeps each box level: OSM footprints are flat-bottomed
 * by construction and following terrain per-vertex would shear them.
 *
 * `sampleEllipsoidal` is the same definition of ground the terrain provider
 * renders (cesium/terrain.ts) — they must agree or this is cosmetic.
 */
export function groundSpanM(
  b: AtlasBuilding,
  sampleEllipsoidal: (lon: number, lat: number) => number
): { baseM: number; topM: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < b.lonLat.length; i += 2) {
    const g = sampleEllipsoidal(b.lonLat[i], b.lonLat[i + 1]);
    if (g < min) min = g;
    if (g > max) max = g;
  }
  // Degenerate ring (no vertices): sit on the ellipsoid rather than extruding
  // from Infinity and vanishing the building.
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { baseM: 0, topM: b.heightM };
  }
  return { baseM: min, topM: max + b.heightM };
}
