// Tour stops for the atlas: the authored landmarks, and the four box corners.
//
// Pure — no Cesium import, no DOM. The datum conversion below is the kind of
// thing that fails silently (a camera 163 m underground renders black, not an
// error), so it lives where it can be tested without WebGL. Same reason
// buildings.ts and enu.ts are pure; that pattern is what caught the ENU inverse
// to 4 cm and the heightmap row-order flip to 2 cm.

import { createProjection, type GeoBox } from '@/lib/enu';
import type { Manifest, TerrainGrid, TourWaypoint } from '@/lib/manifest';
import { minElevation } from '@/world/terrainSample';
import type { AtlasBuilding } from './buildings';

export interface TourStop {
  name: string;
  blurb: string;
  /** Seconds to dwell once arrived. */
  dwell: number;
  lon: number;
  lat: number;
  /** Camera height, metres above the WGS84 ELLIPSOID. */
  heightM: number;
  headingRad: number;
  pitchRad: number;
  /** Where the camera aims — kept so a probe can assert it clears terrain too.
   *  A stop whose aim point is inside a hill is a stop looking at dirt. */
  lookAt: { lon: number; lat: number; heightM: number };
  /** What you are actually looking at. A tour that says "Ross's Landing" and
   *  nothing else tells you where the camera is, not what is on screen or
   *  whether to trust it — which is the whole point of an atlas whose colours
   *  encode provenance. Filled by describeTargets(). */
  target?: {
    id: number;
    name?: string;
    heightM: number;
    /** Height provenance: lidar / height / levels / ms / fallback. */
    rule: string;
    /** Buildings within TARGET_RADIUS_M of the aim point, and how many of those
     *  are lidar-MEASURED — the stop's data quality at a glance. */
    nearby: number;
    nearbyMeasured: number;
  };
}

/** Radius counted around a stop's aim point. ~1 downtown block. */
const TARGET_RADIUS_M = 150;

/**
 * THE DATUM CONVERSION. Diorama ENU y -> ellipsoidal metres.
 *
 * The tour waypoints were authored in the R3F diorama's frame, where
 * src/world/Water.tsx:11 states the convention: "Y=0 (Terrain/Buildings/Streets
 * all subtract the same minElevation)". So ENU y=0 is the terrain MINIMUM in
 * ORTHOMETRIC metres (193.0 m for chatt), while the atlas works in ellipsoidal
 * metres.
 *
 *   ellipsoidal = enuY + minElevation(fineGrid) + geoidOffsetM
 *               = enuY + 193.0 + (-29.657)   = enuY + 163.343
 *
 * Sanity: Ross's Landing pos.y = 240 -> 403 m ellipsoidal over ~176 m ground, a
 * 227 m flythrough. Omit either term and every camera starts ~163 m
 * UNDERGROUND — which renders as black, not as an error. Third appearance of the
 * Build Plan's "#1 gotcha" in this layer (terrain, buildings, now the camera).
 */
export function enuYToEllipsoidalM(
  manifest: Manifest,
  fine: TerrainGrid,
  enuY: number
): number {
  return enuY + minElevation(fine) + (manifest.geoidOffsetM ?? 0);
}

/** Heading/pitch that aims a camera at `from` toward `to`, both ENU metres.
 *  ENU here is x=east, y=up, z=SOUTH (north = -z), matching lonLatToEnu. */
function aim(
  from: [number, number, number],
  to: [number, number, number]
): { headingRad: number; pitchRad: number } {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const dy = to[1] - from[1];
  // Cesium heading: 0 = north, clockwise. North is -z, east is +x.
  const headingRad = Math.atan2(dx, -dz);
  const ground = Math.hypot(dx, dz);
  // Negative pitch = looking down, which is what a tour does.
  const pitchRad = Math.atan2(dy, ground);
  return { headingRad, pitchRad };
}

function stopFromWaypoint(
  manifest: Manifest,
  fine: TerrainGrid,
  w: TourWaypoint
): TourStop {
  const proj = createProjection(
    manifest.box as GeoBox,
    manifest.vectorOffsetM ?? { x: 0, z: 0 }
  );
  const [lon, lat] = proj.enuToLonLat(w.pos[0], w.pos[2]);
  const [lookLon, lookLat] = proj.enuToLonLat(w.look[0], w.look[2]);
  const { headingRad, pitchRad } = aim(w.pos, w.look);
  return {
    name: w.name,
    blurb: w.blurb,
    dwell: w.dwell,
    lon,
    lat,
    heightM: enuYToEllipsoidalM(manifest, fine, w.pos[1]),
    headingRad,
    pitchRad,
    lookAt: {
      lon: lookLon,
      lat: lookLat,
      heightM: enuYToEllipsoidalM(manifest, fine, w.look[1]),
    },
  };
}

/** The authored landmarks. Empty when the site has no tour — a site without
 *  waypoints must not grow a button that flies nowhere. */
export function landmarkStops(
  manifest: Manifest,
  fine: TerrainGrid
): TourStop[] {
  return (manifest.site.tour ?? []).map((w) =>
    stopFromWaypoint(manifest, fine, w)
  );
}

function centroid(b: AtlasBuilding): { lon: number; lat: number } {
  let lon = 0;
  let lat = 0;
  const n = b.lonLat.length / 2;
  for (let i = 0; i < b.lonLat.length; i += 2) {
    lon += b.lonLat[i];
    lat += b.lonLat[i + 1];
  }
  return { lon: lon / n, lat: lat / n };
}

/** What each corner actually exercises — the reason this exists. */
const CORNER_LABELS: Record<string, string> = {
  SW: 'SW corner — fine/wide DEM seam, drape edge, lidar coverage ends here',
  SE: 'SE corner — fine/wide DEM seam, drape edge, lidar coverage ends here',
  NW: 'NW corner — fine/wide DEM seam, drape edge, lidar coverage ends here',
  NE: 'NE corner — fine/wide DEM seam, drape edge, lidar coverage ends here',
};

/**
 * A stop at the building nearest each corner of the BAKED box.
 *
 * Baked box, not atlasBox, deliberately: the baked box edge is where the fine
 * (~9 m) DEM hands off to the wide (~30 m) one, where the TDOT drape stops,
 * where the #233 registration was measured, and where lidar coverage ends. Every
 * seam in the pipeline lands on that rectangle.
 *
 * It is a QC sweep wearing a feature's clothes. Every rendering bug this layer
 * shipped survived because it was checked from a convenient angle — the 176 m
 * plateau is invisible from overhead, floating and buried buildings each hid
 * behind whichever symptom a screenshot happened to show. Corners are the angles
 * nobody chooses on purpose.
 */
export function cornerStops(
  manifest: Manifest,
  fine: TerrainGrid,
  buildings: AtlasBuilding[]
): TourStop[] {
  const { swLat, swLon, neLat, neLon } = manifest.box;
  const corners: [string, number, number][] = [
    ['SW', swLon, swLat],
    ['SE', neLon, swLat],
    ['NW', swLon, neLat],
    ['NE', neLon, neLat],
  ];
  const stops: TourStop[] = [];
  const taken = new Set<number>();

  for (const [key, cLon, cLat] of corners) {
    let best: AtlasBuilding | null = null;
    let bestD = Infinity;
    for (const b of buildings) {
      if (taken.has(b.id)) continue; // 4 distinct stops, even if two corners are close
      const c = centroid(b);
      const d = Math.hypot(c.lon - cLon, c.lat - cLat);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!best) continue;
    taken.add(best.id);
    const c = centroid(best);
    // Look AT the building from a short way off, low enough that terrain
    // interpenetration would be obvious — the whole point is to see the seam.
    const groundY = 0; // ENU-frame irrelevant here; we work in ellipsoidal below.
    void groundY;
    stops.push({
      name: `${key} corner · ${best.tags?.name ?? `way ${best.id}`}`,
      blurb: CORNER_LABELS[key],
      dwell: 4,
      lon: c.lon,
      lat: c.lat - 0.0016, // ~180 m south of it
      heightM: 0, // resolved by the caller against live terrain (see resolveGround)
      headingRad: 0, // due north, at the building
      pitchRad: (-12 * Math.PI) / 180,
      lookAt: { lon: c.lon, lat: c.lat, heightM: 0 },
    });
  }
  return stops;
}

/**
 * Corner stops are placed relative to LIVE terrain, not the authored ENU frame,
 * so their heights resolve here against the same ground definition the terrain
 * provider renders (terrain.ts sampleEllipsoidalM). Keeping this separate from
 * cornerStops keeps that function pure and testable.
 */
export function resolveGround(
  stops: TourStop[],
  sampleEllipsoidal: (lon: number, lat: number) => number,
  eyeAboveGroundM = 90
): TourStop[] {
  return stops.map((s) =>
    s.heightM !== 0
      ? s
      : {
          ...s,
          heightM: sampleEllipsoidal(s.lon, s.lat) + eyeAboveGroundM,
          lookAt: {
            ...s.lookAt,
            heightM: sampleEllipsoidal(s.lookAt.lon, s.lookAt.lat) + 10,
          },
        }
  );
}

/**
 * Annotate each stop with what it is pointed AT: the nearest building to the aim
 * point, plus how many buildings sit within a block of it and how many of those
 * are lidar-measured.
 *
 * Separate from stop construction so both stay pure and testable, and so it can
 * re-run when the live set lands without recomputing camera poses.
 */
export function describeTargets(
  stops: TourStop[],
  buildings: AtlasBuilding[],
  cosLat: number
): TourStop[] {
  // deg -> m, locally flat. Plenty at a 150 m radius.
  const M_PER_DEG_LAT = 110941;
  const mPerDegLon = 111320 * cosLat;
  const distM = (aLon: number, aLat: number, bLon: number, bLat: number) =>
    Math.hypot((aLon - bLon) * mPerDegLon, (aLat - bLat) * M_PER_DEG_LAT);

  return stops.map((s) => {
    let best: AtlasBuilding | null = null;
    let bestD = Infinity;
    let nearby = 0;
    let nearbyMeasured = 0;
    for (const b of buildings) {
      const c = centroid(b);
      const d = distM(c.lon, c.lat, s.lookAt.lon, s.lookAt.lat);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
      if (d <= TARGET_RADIUS_M) {
        nearby++;
        if (b.rule === 'lidar') nearbyMeasured++;
      }
    }
    if (!best) return s;
    const c = centroid(best);
    return {
      ...s,
      // Re-aim at the TARGET, not the authored aim point. A stop that names a
      // building and then centres something else is worse than no name: the
      // caption says one thing and the screen shows another.
      lookAt: { ...s.lookAt, lon: c.lon, lat: c.lat },
      target: {
        id: best.id,
        name: best.tags?.name,
        heightM: best.heightM,
        rule: best.rule,
        nearby,
        nearbyMeasured,
      },
    };
  });
}

/**
 * Should the tour play itself on arrival? (#292)
 *
 * Reduced motion is the hard no: auto-flying a camera is exactly the vestibular
 * trigger WCAG 2.3.3 exists for. A user who CLICKS play still gets the normal
 * flight — they asked for it, and the flight is the button's whole function.
 */
export function shouldAutoStart(o: {
  hasStops: boolean;
  notour: boolean;
  reducedMotion: boolean;
}): boolean {
  return o.hasStops && !o.notour && !o.reducedMotion;
}
