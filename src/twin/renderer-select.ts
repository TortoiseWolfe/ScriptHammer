// Which renderer does this URL want? (#292)
//
// The atlas is the default: it is the better view of the city, and the one the
// nav points at. The diorama's own features are its opt-in — ?ortho, ?house and
// ?edit are diorama-only, so they imply it rather than needing ?diorama too.
// ?atlas remains a no-op alias: links shared before the flip must keep working.
export type Renderer = 'atlas' | 'diorama';

const DIORAMA_ONLY = ['diorama', 'ortho', 'house', 'edit'] as const;

export function selectRenderer(params: URLSearchParams): Renderer {
  return DIORAMA_ONLY.some((p) => params.has(p)) ? 'diorama' : 'atlas';
}
