import { BOX } from './box';

const DEG = Math.PI / 180;
export const M_PER_DEG_LAT = 110574;
export const M_PER_DEG_LON = 111320 * Math.cos(BOX.centerLat * DEG);

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
