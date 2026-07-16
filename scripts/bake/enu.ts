// Pipeline-side re-export of the shared ENU projection (#232).
//
// The single implementation lives in src/lib/enu.ts so the bake (lon/lat → ENU
// metres) and the runtime atlas layer (ENU metres → WGS84 for Cesium) share ONE
// transform and ONE inverse. A hand-maintained second copy of an invertible
// projection is how a sign error or a stale metersPerDegree series ships —
// every building lands in the wrong place and nothing fails loudly.
//
// Pipeline scripts import from here; app code imports from '@/lib/enu'.
// Same pattern as scripts/warehouse/lib.ts → src/lib/placement.ts (#259).

export {
  metersPerDegree,
  createProjection,
  boxFromCenter,
  type GeoBox,
  type Projection,
} from '../../src/lib/enu';
