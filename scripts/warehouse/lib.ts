// Shared pure helpers for the Warehouse sampling pipeline (#259).

/** Hand-tuned placement adjustments, keyed by model slug — the durable record
 *  of the in-viewer placement editor's output (overrides-chatt.json). */
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
  /** Drop this model from the emitted set entirely. */
  exclude?: boolean;
}

export interface PlacedEntry {
  slug: string;
  x: number;
  z: number;
  yawDeg?: number;
  scale?: number;
  yOffset?: number;
  [key: string]: unknown;
}

/**
 * Merge a hand-tuned override onto an emitted entry. Returns null when the
 * override excludes the model. dx/dz are additive nudges (the projected
 * anchor stays the source of truth); yaw/scale/yOffset replace outright.
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
