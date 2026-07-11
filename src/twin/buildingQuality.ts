// Quality signal for a sampled Warehouse building (#259 iter 7).
//
// The user asked for "an indication when/where junk shows up." The honest
// signal is FOOTPRINT EXTENT, not the Warehouse rating: every rated chatt
// model is exactly 5.0 (and 47/129 are unrated), so rating carries no quality
// information. What DOES predict a rough-looking model is leftover site
// context inflating its footprint — the same thing the QC extent badge flags
// (scripts/warehouse/qc-sheet.mjs). We mirror its thresholds here so the
// in-view card and the offline QC sheet agree.

export const EXTENT_WARN_M = 150; // a city building is ~20–100m
export const EXTENT_RED_M = 300;

/** 0 = fine · 1 = may look rough (oversized) · 2 = likely rough (very oversized). */
export type QualityLevel = 0 | 1 | 2;

/**
 * Classify a building's footprint from its emitted `dim` ([x, y, z] metres).
 * Uses the larger XZ span (max(x, z)), matching the QC badge. Strictly
 * greater-than at each threshold, so a bang-on-150m model is still "fine".
 */
export function buildingQuality(dim: [number, number, number] | undefined): {
  level: QualityLevel;
  spanM: number | null;
} {
  if (!dim) return { level: 0, spanM: null };
  const span = Math.max(dim[0], dim[2]);
  const level: QualityLevel =
    span > EXTENT_RED_M ? 2 : span > EXTENT_WARN_M ? 1 : 0;
  return { level, spanM: span };
}
