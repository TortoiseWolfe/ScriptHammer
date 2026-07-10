// Shared placement logic for the Warehouse sampling system (#259).
//
// ONE implementation, three consumers: the runtime layer
// (src/world/WarehouseModels.tsx merges live editor overrides), the emit
// stage (scripts/warehouse/emit-models.ts merges the committed overrides
// file), and the fetch stage (slug assignment — the JOIN KEY between the
// raw cache, the served GLB, and models.json). The iteration-3 review found
// these hand-duplicated with already-divergent rounding; this module is the
// fix. scripts/warehouse/lib.ts re-exports for pipeline imports.

/** Hand-tuned placement adjustments, keyed by model slug — the durable
 *  record of the in-viewer Edit mode's output (overrides-<site>.json) and
 *  the live localStorage shape. */
export interface PlacementOverride {
  /** Yaw around +Y, degrees. Replaces the emitted value. */
  yawDeg?: number;
  /** Uniform scale. Replaces the emitted value. */
  scale?: number;
  /** Vertical fine-tune, metres. Replaces the emitted value. */
  yOffset?: number;
  /** ENU nudge east(+)/west(−), metres. ADDS to the projected anchor. */
  dx?: number;
  /** ENU nudge south(+)/north(−), metres. ADDS to the projected anchor. */
  dz?: number;
  /** Drop this model entirely. */
  exclude?: boolean;
}

// Structural minimum only — no index signature, so exact-typed consumers
// (WarehouseModelEntry etc.) satisfy the generic bound; extra fields ride
// through applyOverrides untouched via T.
export interface PlacedEntry {
  slug: string;
  x: number;
  z: number;
  yawDeg?: number;
  scale?: number;
  yOffset?: number;
}

/**
 * Merge a hand-tuned override onto a placed entry. Returns null when the
 * override excludes the model. dx/dz are additive nudges (the projected
 * anchor stays the source of truth); yaw/scale/yOffset replace outright.
 * x/z round to 2 decimals so the live preview and the emitted artifact are
 * bit-identical.
 */
export function applyOverrides<T extends PlacedEntry>(
  entry: T,
  ov: PlacementOverride | undefined
): T | null {
  if (!ov) return entry;
  if (ov.exclude) return null;
  const out = { ...entry };
  if (ov.dx !== undefined) out.x = Number((out.x + ov.dx).toFixed(2));
  if (ov.dz !== undefined) out.z = Number((out.z + ov.dz).toFixed(2));
  if (ov.yawDeg !== undefined) out.yawDeg = ov.yawDeg;
  if (ov.scale !== undefined) out.scale = ov.scale;
  if (ov.yOffset !== undefined) out.yOffset = ov.yOffset;
  return out;
}

/** The warehouse pipeline's slug alphabet (distinct from the bake's
 *  geocode slugify — that one NFKD-normalizes addresses). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Deterministic slug per Warehouse id. Distinct buildings can share a
 * generic title ("Building in Chattanooga, TN, USA" ×15) — the Warehouse id
 * is suffixed ONLY on title collision so unique slugs stay stable across
 * curation edits. Fetch and emit MUST use this same map (the slug is the
 * join key); the guard test runs it over the real curated ids.
 */
export function assignSlugs(
  ids: string[],
  lookup: Map<string, { title: string }>
): Map<string, string> {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const m = lookup.get(id);
    if (!m) continue;
    const base = slugify(m.title);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  const slugs = new Map<string, string>();
  for (const id of ids) {
    const m = lookup.get(id);
    if (!m) continue;
    const base = slugify(m.title);
    slugs.set(
      id,
      (counts.get(base) ?? 0) > 1 ? `${base}-${id.slice(0, 8)}` : base
    );
  }
  return slugs;
}
