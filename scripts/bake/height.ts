const FT = 0.3048;
export const REPUBLIC_CENTRE_M = 300 * FT; // 91.44

// Safety net BEHIND explicit OSM height/levels tags (rules 1-2 win, correctly —
// most of these towers carry an OSM `height` today, so the table rarely fires).
// Keys must match the OSM `name` tag EXACTLY: the original list used colloquial
// names ("First Horizon Bank Building", "The Maclellan", "Sheraton Read House")
// that matched NOTHING in the extract, so the table was 100% dead code
// (ruleHistogram override: 0) — verified against _raw/osm.json and corrected to
// the real names (#229). "Chattanooga Bank Building" and "Patten Towers" have no
// named way in the current extract; kept in case OSM tagging catches up.
export const HEIGHT_OVERRIDES: Record<string, number> = {
  'Republic Centre': 300 * FT,
  'First Tennessee Bank Building': 204 * FT,
  'James Building': 187 * FT,
  'Volunteer Life Building': 165 * FT,
  'Maclellan Building': 158 * FT,
  'Medical Arts Building': 146 * FT,
  'Chattanooga Bank Building': 132 * FT,
  'Patten Towers': 130 * FT,
  'The Read House Historic Inn And Suites': 130 * FT,
};

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
// so the Republic Centre clamp is reachable for large downtown footprints.
function areaBonusLevels(footprintAreaM2: number): number {
  if (footprintAreaM2 >= 3000) return 6;
  if (footprintAreaM2 >= 1500) return 4;
  if (footprintAreaM2 >= 800) return 2;
  if (footprintAreaM2 >= 300) return 1;
  return 0;
}

export function resolveHeight(
  tags: Record<string, string>,
  footprintAreaM2: number
): { meters: number; rule: 'height' | 'levels' | 'override' | 'fallback' } {
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
  if (tags.name && HEIGHT_OVERRIDES[tags.name] != null) {
    return { meters: HEIGHT_OVERRIDES[tags.name], rule: 'override' };
  }
  // Rule 4: fallback — bucket by building tag, nudge by footprint area, clamp.
  const kind = tags.building || 'yes';
  const priorLevels = LEVEL_PRIORS[kind] ?? 3;
  const bonusLevels = areaBonusLevels(footprintAreaM2); // big footprints tend taller downtown
  const meters = Math.min(
    REPUBLIC_CENTRE_M,
    (priorLevels + bonusLevels) * LEVEL_M
  );
  return { meters, rule: 'fallback' };
}
