// Pipeline-side re-export of the shared outside-the-bake join helpers (#292).
//
// The single implementation lives in src/lib/live-building-heights.ts so the
// bake (scripts/bake/build-wide-buildings.ts) and the runtime atlas layer
// (src/twin/cesium/overpass.ts) resolve heights for un-baked buildings the
// SAME way — same fallback config, same footprint-area math.
//
// Pipeline scripts import from here; app code imports from
// '@/lib/live-building-heights'. Same pattern as scripts/bake/height.ts and
// scripts/bake/enu.ts.

export {
  OUTSIDE_HEIGHTS,
  ringAreaM2,
} from '../../src/lib/live-building-heights';
