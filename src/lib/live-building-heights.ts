// Shared join helpers for buildings OUTSIDE the baked footprint (#292).
//
// src/twin/cesium/overpass.ts (the live runtime join) and
// scripts/bake/build-wide-buildings.ts (its bake-time twin) both resolve a
// height for every OSM building the bake never measured, via the SAME
// `resolveHeight` ladder on the SAME fallback config and the SAME footprint
// area. These two pieces — `OUTSIDE_HEIGHTS` and `ringAreaM2` — used to be
// hand-copied between the two files. Per src/lib/height.ts's own doctrine, "a
// second hand-maintained ladder is how the two silently diverge" — which is
// exactly what happened to the cosLat feeding this area (see build-scene.ts's
// call site and manifest.cosLat). One implementation, two importers.

import type { HeightsConfig } from './height';

/** Fallback height config for buildings OUTSIDE the bake, where we have no
 *  per-site override list. The clamp is generous: it only binds rule-6 guesses,
 *  and this box reaches beyond the downtown towers. */
export const OUTSIDE_HEIGHTS: HeightsConfig = {
  overrides: {},
  fallbackClampM: 91.44,
};

/** Shoelace area of a lon/lat ring, in m2 — resolveHeight's rule-6 prior needs
 *  a footprint area. `cosLat` must be the SAME flat-earth scalar the rest of
 *  the call site uses (manifest.cosLat at runtime); a different scalar here
 *  silently perturbs which buildings clear the rule-6 area-bonus thresholds
 *  without either side failing loudly. Local flat-earth scaling is plenty at
 *  this size. */
export function ringAreaM2(lonLat: number[], cosLat: number): number {
  let a = 0;
  const n = lonLat.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += lonLat[i * 2] * lonLat[j * 2 + 1] - lonLat[j * 2] * lonLat[i * 2 + 1];
  }
  // deg2 -> m2 at this latitude
  return Math.abs(a / 2) * 111320 * 111320 * cosLat;
}
