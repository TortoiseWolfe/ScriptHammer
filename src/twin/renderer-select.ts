// Which renderer does this URL want? (#292)
//
// The atlas is the default: it is the better view of the city, and the one the
// nav points at. The diorama's own features are its opt-in — ?ortho, ?house,
// ?edit, ?select and ?nofx are diorama-only, so they imply it rather than
// needing ?diorama too. ?atlas remains a no-op alias: links shared before the
// flip must keep working.
export type Renderer = 'atlas' | 'diorama';

// StageCore's ?nofx, TwinCanvas's ?house/?ortho, useWarehouseEditor's
// ?edit/?select — every diorama-only param TwinCanvasHost.tsx's own comment
// enumerates. A slug missing here silently opens the atlas instead of erroring
// (#292 review I1): ?select=<slug> (not gated on ?edit) landed on a renderer
// with no warehouse models, and ?nofx became a no-op selecting the renderer it
// doesn't apply to.
const DIORAMA_ONLY = [
  'diorama',
  'ortho',
  'house',
  'edit',
  'select',
  'nofx',
  // Walk is a diorama mode — Cesium has no first-person camera. Without these two, a bare
  // `/chatt?walk` opens the ATLAS and TwinCanvas never mounts, so the deep link dies before
  // it can even reach the walk gate. `?at` is its companion: `markerBlock` emits
  // `?diorama&walk&at=`, but a hand-shared or hand-edited `?at=` must not silently land on
  // the renderer that cannot use a spawn coordinate.
  'walk',
  'at',
] as const;

export function selectRenderer(params: URLSearchParams): Renderer {
  return DIORAMA_ONLY.some((p) => params.has(p)) ? 'diorama' : 'atlas';
}

/**
 * Combines the query-string choice above with the build-time fact of whether
 * this slug's baked manifest has an atlasBox (#292 B1a). A site with no
 * atlasBox is a single-exhibit twin — the atlas has nothing to add ("Cesium is
 * the atlas, Three.js is the exhibit") — so it always renders the diorama, no
 * matter what the URL asks for, including ?atlas. selectRenderer() itself
 * stays pure over URLSearchParams alone; hasAtlas is a fact it has no way to
 * know (no manifest access), so it arrives as a separate argument here rather
 * than being folded into the URL-only function.
 */
export function selectRendererFor(
  params: URLSearchParams,
  hasAtlas: boolean
): Renderer {
  if (!hasAtlas) return 'diorama';
  return selectRenderer(params);
}
