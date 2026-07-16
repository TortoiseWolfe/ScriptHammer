// Building-height resolution. Site-specific data (named-tower overrides, the
// fallback clamp) lives in sites/<slug>.json (#232); only the generic urban
// priors stay here.

export interface HeightsConfig {
  /** OSM `name` tag (character-exact) -> metres. Safety net BEHIND explicit
   * height/levels tags (rules 1-2 win). Keys must match the OSM `name` tag
   * EXACTLY: a colloquial-name list matches NOTHING and becomes dead code
   * (verified against _raw/osm.json, #229). */
  overrides: Record<string, number>;
  /** Cap for rule-4 fallback heights (typically the site's tallest tower). */
  fallbackClampM: number;
}

// Fallback level priors by building tag value (the COMMON path — ~74% of buildings).
const LEVEL_PRIORS: Record<string, number> = {
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
  // Rule 1: explicit height tag (may carry a unit suffix). Fall through on bad values.
  if (tags.height) {
    const m = parseFloat(tags.height);
    if (!Number.isNaN(m) && m > 0) return { meters: m, rule: 'height' };
  }
  // Rule 2: building:levels. Fall through on bad values.
  if (tags['building:levels']) {
    const lv = parseFloat(tags['building:levels']);
    if (!Number.isNaN(lv) && lv > 0)
      return { meters: lv * LEVEL_M, rule: 'levels' };
  }
  // Rule 3: named override
  if (tags.name && cfg.overrides[tags.name] != null) {
    return { meters: cfg.overrides[tags.name], rule: 'override' };
  }
  // Rule 4: lidar-measured height (#229 PR-B) — a direct per-footprint
  // measurement (first-return p90 − DTM) beats the ML estimate below.
  if (lidarHeightM != null && lidarHeightM > 0) {
    return { meters: lidarHeightM, rule: 'lidar' };
  }
  // Rule 5: Microsoft ML-measured height — real data displaces only the
  // guessy fallback; explicit tags and human overrides above still win.
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
