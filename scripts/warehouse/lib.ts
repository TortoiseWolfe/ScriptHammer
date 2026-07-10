// Pipeline-side re-export of the shared placement logic (#259).
//
// The single implementation lives in src/lib/placement.ts so the runtime
// (WarehouseModels), the emit stage, and the fetch stage all share ONE
// override-merge and ONE slug assignment — the iteration-3 review found the
// hand-maintained duplicates already drifting. Pipeline scripts import from
// here; app code imports from '@/lib/placement'.

export {
  applyOverrides,
  assignSlugs,
  slugify,
  type PlacementOverride,
  type PlacedEntry,
} from '../../src/lib/placement';
