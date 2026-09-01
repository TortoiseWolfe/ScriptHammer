/**
 * Reading OSM tags, in one place (#708).
 *
 * WHY THIS MODULE EXISTS. `addressOf` was written for the Cesium atlas and lived in
 * `src/twin/cesium/BuildingCard.tsx`. The walk path needs exactly the same reading of exactly
 * the same tags, and this repo has a standing rule that two declarations of one intent drift —
 * `e2e-local.yml` derives its ignore list from `e2e.yml` for that reason, and
 * `color-contrast.spec.ts` enumerates routes rather than listing them.
 *
 * Copying five lines would have been the obvious move and the wrong one: the two would answer
 * differently the first time either grew a case (`addr:unit`, a house name, a fallback). So the
 * function moved here and `BuildingCard` re-exports it. There is one definition and both
 * renderers read tags identically.
 *
 * It also breaks a layering problem. `twin-location.ts` is a pure helper module under
 * `src/lib`; importing a function out of a `.tsx` component in `src/twin/cesium/` to get it
 * would drag a React component into the dependency graph of a module whose whole point is that
 * it is plain arithmetic and parsing.
 */

/**
 * A street address from OSM tags, or null.
 *
 * BOTH HALVES ARE REQUIRED, and that is a behaviour change this commit makes deliberately.
 *
 * The original implementation was `[number, street].filter(Boolean).join(' ')`, which returns
 * `"Broad St"` for a building tagged with a street and no number — a whole road presented as
 * one building's address. Measured over the wide Chattanooga extent: the loose form answers for
 * **1,372** buildings, the strict form for **913**. So 459 of those answers named a street
 * where no building claimed a number.
 *
 * This corrects the Cesium inspector's "Address" row too, which had the same behaviour and the
 * same defect. The rough-orientation job those 459 would have done is already covered: the
 * readout carries a separate nearest-landmark line.
 *
 * Caught by a test asserting the documented contract, against an implementation that had been
 * moved here verbatim and did not honour it.
 */
export function addressOf(tags?: Record<string, string>): string | null {
  const number = tags?.['addr:housenumber']?.trim();
  const street = tags?.['addr:street']?.trim();
  if (!number || !street) return null;
  return `${number} ${street}`;
}

/**
 * The best human label for a building: its name, else its address, else null.
 *
 * Deliberately NOT the building type. `building=yes` is 85% of the extent and "Yes" is worse
 * than nothing in a location readout — the type is useful in an inspector, where the user asked
 * about one building, and noise in a readout that updates four times a second.
 */
export function buildingLabelOf(tags?: Record<string, string>): string | null {
  if (!tags) return null;
  return tags.name?.trim() || addressOf(tags);
}
