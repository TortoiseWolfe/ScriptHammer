// Building-height resolution. Site-specific data (named-tower overrides, the
// fallback clamp) lives in sites/<slug>.json (#232); only the generic urban
// priors stay here.

export interface HeightsConfig {
  /** OSM `name` tag (character-exact) -> metres. A researched per-site value:
   * it outranks every DERIVED height (lidar/levels/ms/fallback) but yields to
   * an explicit OSM `height` tag, which is a human assertion about the same
   * building made closer to the source. Keys must match the OSM `name` tag
   * EXACTLY — a colloquial name matches nothing and is silently dead.
   *
   * chatt reality check (2026-07-15): 7 of its 9 keys DO match real OSM names;
   * all 7 also carry a `height` tag, so this rule resolves 0 buildings. That is
   * the safety net working — OSM already has them — NOT the name-matching
   * failure the pre-#229 comment here used to claim. */
  overrides: Record<string, number>;
  /** Cap for the last-resort fallback (typically the site's tallest tower). */
  fallbackClampM: number;
}

// Fallback level priors by building tag value (the COMMON path — ~74% of buildings).
//
// Exported so the atlas legend buckets `building=*` with the SAME vocabulary the
// ladder reasons about. A type the ladder knows but the legend does not (or the
// reverse) means the two describe the city differently — see
// src/twin/cesium/buildings.ts.
export const LEVEL_PRIORS: Record<string, number> = {
  house: 1,
  detached: 1,
  garage: 1,
  shed: 1,
  hut: 1,
  residential: 2,
  apartments: 4,
  retail: 2,
  commercial: 5,
  office: 8,
  industrial: 2,
  warehouse: 2,
  hotel: 6,
  civic: 3,
  yes: 3,
};
const LEVEL_M = 3.2;

// Tiered footprint-area bonus (in added levels) — gives the fallback real range
// so the tallest-tower clamp is reachable for large downtown footprints.
function areaBonusLevels(footprintAreaM2: number): number {
  if (footprintAreaM2 >= 3000) return 6;
  if (footprintAreaM2 >= 1500) return 4;
  if (footprintAreaM2 >= 800) return 2;
  if (footprintAreaM2 >= 300) return 1;
  return 0;
}

export function resolveHeight(
  tags: Record<string, string>,
  footprintAreaM2: number,
  cfg: HeightsConfig,
  msHeightM?: number,
  lidarHeightM?: number
): {
  meters: number;
  rule: 'height' | 'levels' | 'override' | 'lidar' | 'ms' | 'fallback';
} {
  // Rule 1: explicit height tag (may carry a unit suffix). Fall through on bad
  // values. A human asserted this about this building; it also cross-validates
  // against the lidar below — median |lidar − height| = 0.1 m across the 92
  // chatt buildings carrying both, which is why this outranks the measurement.
  if (tags.height) {
    const m = parseFloat(tags.height);
    if (!Number.isNaN(m) && m > 0) return { meters: m, rule: 'height' };
  }
  // Rule 2: named override — our researched per-site value. It must beat every
  // DERIVED height below, or it is not an override.
  if (tags.name && cfg.overrides[tags.name] != null) {
    return { meters: cfg.overrides[tags.name], rule: 'override' };
  }
  // Rule 3: lidar-measured height (#229 PR-B) — a direct per-footprint
  // measurement (first-return p90 − DTM).
  //
  // ORDERING (fixed 2026-07-15): this used to sit BELOW `levels`, so a
  // floor-count guess outranked a real measurement of the same roof. It was
  // inserted after the pre-existing rules purely to avoid disturbing them —
  // the sibling comment in fetch-lidar-heights.ts only ever reasoned about
  // lidar-vs-ms — and no test pinned the order. Measured on chatt: 112 of the
  // 116 `levels` buildings HAD a lidar height available, and `levels × 3.2`
  // ran a median 2.9 m short of it (~one floor, on 7–16 m buildings). A
  // measurement beats a derivation.
  if (lidarHeightM != null && lidarHeightM > 0) {
    return { meters: lidarHeightM, rule: 'lidar' };
  }
  // Rule 4: building:levels — a derivation, not a measurement. Only reached
  // when lidar has no return for this footprint. Fall through on bad values.
  if (tags['building:levels']) {
    const lv = parseFloat(tags['building:levels']);
    if (!Number.isNaN(lv) && lv > 0)
      return { meters: lv * LEVEL_M, rule: 'levels' };
  }
  // Rule 5: Microsoft ML-measured height — an estimate; real data displaces
  // only the guessy fallback. Everything above still wins.
  if (msHeightM != null && msHeightM > 0) {
    return { meters: msHeightM, rule: 'ms' };
  }
  // Rule 6: fallback — bucket by building tag, nudge by footprint area, clamp.
  const kind = tags.building || 'yes';
  const priorLevels = LEVEL_PRIORS[kind] ?? 3;
  const bonusLevels = areaBonusLevels(footprintAreaM2); // big footprints tend taller downtown
  const meters = Math.min(
    cfg.fallbackClampM,
    (priorLevels + bonusLevels) * LEVEL_M
  );
  return { meters, rule: 'fallback' };
}
