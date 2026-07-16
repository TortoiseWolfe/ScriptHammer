// Pipeline-side re-export of the shared height ladder (#229).
//
// The single implementation lives in src/lib/height.ts so the bake and the
// runtime atlas resolve heights the SAME way. The atlas fetches OSM live for a
// wider area than the bake covers (#292) and must fall back to the identical
// rules for buildings outside the baked box — a second hand-maintained ladder
// is how the two silently diverge and the seam becomes visible.
//
// Pipeline scripts import from here; app code imports from '@/lib/height'.
// Same pattern as scripts/bake/enu.ts -> src/lib/enu.ts.

export { resolveHeight, type HeightsConfig } from '../../src/lib/height';
