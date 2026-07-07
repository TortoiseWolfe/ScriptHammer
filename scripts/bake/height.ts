const FT = 0.3048;
export const REPUBLIC_CENTRE_M = 300 * FT; // 91.44

export const HEIGHT_OVERRIDES: Record<string, number> = {
  'Republic Centre': 300 * FT,
  'First Horizon Bank Building': 204 * FT,
  'James Building': 187 * FT,
  'Volunteer Life': 165 * FT,
  'The Maclellan': 158 * FT,
  'Medical Arts': 146 * FT,
  'Chattanooga Bank': 132 * FT,
  'Patten Towers': 130 * FT,
  'Sheraton Read House': 130 * FT,
};

// Fallback level priors by building tag value (the COMMON path — ~74% of buildings).
const LEVEL_PRIORS: Record<string, number> = {
  house: 1,
  detached: 1,
  garage: 1,
  shed: 1,
  hut: 1,
  residential: 2,
  apartments: 3,
  retail: 2,
  commercial: 3,
  office: 4,
  industrial: 2,
  warehouse: 2,
  hotel: 5,
  civic: 3,
  yes: 2,
};
const LEVEL_M = 3.2;

export function resolveHeight(
  tags: Record<string, string>,
  footprintAreaM2: number
): { meters: number; rule: 'height' | 'levels' | 'override' | 'fallback' } {
  // Rule 1: explicit height tag (may carry a unit suffix)
  if (tags.height) {
    const m = parseFloat(tags.height);
    if (!Number.isNaN(m)) return { meters: m, rule: 'height' };
  }
  // Rule 2: building:levels
  if (tags['building:levels']) {
    const lv = parseFloat(tags['building:levels']);
    if (!Number.isNaN(lv)) return { meters: lv * LEVEL_M, rule: 'levels' };
  }
  // Rule 3: named override
  if (tags.name && HEIGHT_OVERRIDES[tags.name] != null) {
    return { meters: HEIGHT_OVERRIDES[tags.name], rule: 'override' };
  }
  // Rule 4: fallback — bucket by building tag, nudge by footprint area, clamp.
  const kind = tags.building || 'yes';
  const priorLevels = LEVEL_PRIORS[kind] ?? 2;
  const areaBonus = footprintAreaM2 > 800 ? 1 : 0; // big footprints tend taller downtown
  const meters = Math.min(
    REPUBLIC_CENTRE_M,
    (priorLevels + areaBonus) * LEVEL_M
  );
  return { meters, rule: 'fallback' };
}
