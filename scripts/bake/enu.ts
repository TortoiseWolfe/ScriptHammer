import { BOX } from './box';

const DEG = Math.PI / 180;
// WGS-84 arc lengths per degree, evaluated AT THE BOX'S LATITUDE (standard
// truncated series). The previous constants were the spherical/equator values
// (110574 m/deg lat is the EQUATOR figure; at 35°N the true meridian degree is
// ~110941 m) — a systematic 0.33% N-S compression (~19 m over the 5.77 km
// corridor) and ~0.11% E-W. Every layer shared the constants, so registration
// was unaffected, but the whole model was measurably smaller than real life
// (#229).
const PHI = BOX.centerLat * DEG;
export const M_PER_DEG_LAT =
  111132.92 -
  559.82 * Math.cos(2 * PHI) +
  1.175 * Math.cos(4 * PHI) -
  0.0023 * Math.cos(6 * PHI);
export const M_PER_DEG_LON =
  111412.84 * Math.cos(PHI) -
  93.5 * Math.cos(3 * PHI) +
  0.118 * Math.cos(5 * PHI);

/** lon/lat -> local ENU metres. Origin = box center. North = -Z, East = +X. */
export function lonLatToEnu(lon: number, lat: number): [number, number] {
  const x = (lon - BOX.centerLon) * M_PER_DEG_LON;
  const z = -(lat - BOX.centerLat) * M_PER_DEG_LAT;
  return [x, z];
}

/** True ground extent of the box in metres. */
export function enuGroundSize(): { widthM: number; depthM: number } {
  return {
    widthM: (BOX.neLon - BOX.swLon) * M_PER_DEG_LON,
    depthM: (BOX.neLat - BOX.swLat) * M_PER_DEG_LAT,
  };
}

export { BOX };
