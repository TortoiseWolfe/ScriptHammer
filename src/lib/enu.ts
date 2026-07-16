// Local ENU projection — pure factory, no site state. Every stage receives a
// Projection built from the site's box; nothing is derived at module load, so
// one process can bake any city (#232).
//
// THE SINGLE IMPLEMENTATION. It lives under src/ so the bake pipeline and the
// runtime share ONE lon/lat<->ENU transform: the bake projects OSM into ENU
// metres, and the Cesium atlas layer projects those baked metres back to WGS84.
// Two hand-maintained copies of an invertible transform is how a sign error
// ships. Pipeline code imports from scripts/bake/enu.ts (a re-export); app code
// imports from '@/lib/enu'. Same pattern as src/lib/placement.ts (#259).

const DEG = Math.PI / 180;

export interface GeoBox {
  swLat: number;
  swLon: number;
  neLat: number;
  neLon: number;
}

// WGS-84 arc lengths per degree, evaluated at a given latitude (standard
// truncated series). The pre-#229 constants were the spherical/equator values
// (110574 m/deg lat is the EQUATOR figure; at 35°N the true meridian degree is
// ~110941 m) — a systematic 0.33% N-S compression. Every layer shared the
// constants, so registration was unaffected, but the whole model was measurably
// smaller than real life (#229).
export function metersPerDegree(latDeg: number): {
  mPerDegLat: number;
  mPerDegLon: number;
} {
  const phi = latDeg * DEG;
  const mPerDegLat =
    111132.92 -
    559.82 * Math.cos(2 * phi) +
    1.175 * Math.cos(4 * phi) -
    0.0023 * Math.cos(6 * phi);
  const mPerDegLon =
    111412.84 * Math.cos(phi) -
    93.5 * Math.cos(3 * phi) +
    0.118 * Math.cos(5 * phi);
  return { mPerDegLat, mPerDegLon };
}

export interface Projection {
  readonly box: GeoBox;
  readonly centerLat: number;
  readonly centerLon: number;
  readonly mPerDegLat: number;
  readonly mPerDegLon: number;
  /** The vector correction baked into lonLatToEnu (metres; zero when unset). */
  readonly offsetM: { x: number; z: number };
  /** lon/lat -> local ENU metres. Origin = box center. North = -Z, East = +X. */
  lonLatToEnu(lon: number, lat: number): [number, number];
  /**
   * local ENU metres -> lon/lat. The exact inverse of lonLatToEnu, INCLUDING
   * offsetM: feed it a baked ring coordinate and you get back the true OSM
   * lon/lat the bake started from.
   *
   * That offset round-trip is the subtle part. Baked geometry has offsetM
   * already added (see the note on createProjection), so recovering real-world
   * coordinates means subtracting it again. A consumer that wants the vectors
   * registered against THIS SITE'S DRAPE wants the offset left in; a consumer
   * plotting on independently-georeferenced imagery (Esri, Google) wants the
   * true OSM position — build that Projection with the same offsetM the bake
   * used and this returns it.
   */
  enuToLonLat(x: number, z: number): [number, number];
  /** True ground extent of the box in metres. */
  groundSize(): { widthM: number; depthM: number };
}

/**
 * `offsetM` is the site config's measured `vectorOffsetM` (#233): OSM vectors
 * and the ortho imagery each carry their own absolute georeferencing error,
 * and the registration report measures their relative offset. Applying it
 * HERE — the single lon/lat→world chokepoint — shifts every vector layer
 * (buildings, streets, heroes, house anchors) together relative to the fixed
 * aerial+terrain, so no consumer can be missed. The drape/terrain mappings
 * (groundWm/Hm fractions) are deliberately untouched.
 */
export function createProjection(
  box: GeoBox,
  offsetM: { x: number; z: number } = { x: 0, z: 0 }
): Projection {
  const centerLat = (box.swLat + box.neLat) / 2;
  const centerLon = (box.swLon + box.neLon) / 2;
  const { mPerDegLat, mPerDegLon } = metersPerDegree(centerLat);
  return {
    box,
    centerLat,
    centerLon,
    mPerDegLat,
    mPerDegLon,
    offsetM,
    lonLatToEnu(lon: number, lat: number): [number, number] {
      return [
        (lon - centerLon) * mPerDegLon + offsetM.x,
        -(lat - centerLat) * mPerDegLat + offsetM.z,
      ];
    },
    enuToLonLat(x: number, z: number): [number, number] {
      return [
        (x - offsetM.x) / mPerDegLon + centerLon,
        -(z - offsetM.z) / mPerDegLat + centerLat,
      ];
    },
    groundSize() {
      return {
        widthM: (box.neLon - box.swLon) * mPerDegLon,
        depthM: (box.neLat - box.swLat) * mPerDegLat,
      };
    },
  };
}

/**
 * Derive a box from a centre point + metric extents (issue #232 step 2):
 * WGS-84 arc lengths at the centre latitude, half-extent each side.
 */
export function boxFromCenter(
  centerLat: number,
  centerLon: number,
  widthM: number,
  heightM: number
): GeoBox {
  const { mPerDegLat, mPerDegLon } = metersPerDegree(centerLat);
  const halfLat = heightM / 2 / mPerDegLat;
  const halfLon = widthM / 2 / mPerDegLon;
  return {
    swLat: centerLat - halfLat,
    swLon: centerLon - halfLon,
    neLat: centerLat + halfLat,
    neLon: centerLon + halfLon,
  };
}
