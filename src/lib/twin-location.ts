/**
 * Where am I, and how do I get back? (#706)
 *
 * Pure helpers behind the twin's location readout. They exist as plain functions — not
 * inside the React component — because the thing worth testing is the arithmetic and the
 * parsing, and a component test would only prove that a div rendered.
 *
 * The motivating problem is not navigation, it is REPRODUCIBILITY: "I can't walk up the
 * stairs of the more detailed GLB imports" is not actionable without knowing which
 * building. A coordinate the player can copy out of the game turns a report into something
 * a test harness can be pointed at.
 */

/** Minimal shape needed to name a nearby landmark; matches `WarehouseModelEntry`. */
export interface NearbyEntry {
  slug: string;
  title: string;
  x: number;
  z: number;
}

export interface Nearest {
  entry: NearbyEntry;
  /** Horizontal distance, metres. */
  distance: number;
}

/**
 * Closest landmark to an ENU point, or null when there are none.
 *
 * Plain linear scan: `chatt` places 129 models and this runs a few times a second at most.
 * A spatial index here would be complexity with no measurable payoff.
 */
export function nearestLandmark(
  entries: readonly NearbyEntry[],
  x: number,
  z: number
): Nearest | null {
  let best: Nearest | null = null;
  for (const entry of entries) {
    const dx = entry.x - x;
    const dz = entry.z - z;
    const distance = Math.hypot(dx, dz);
    if (!best || distance < best.distance) best = { entry, distance };
  }
  return best;
}

/** Six decimal places ≈ 0.11 m — finer than the player can stand, and stable to read. */
export function formatLatLon(lat: number, lon: number): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/** Deep link to the exact point on OpenStreetMap, where the source data lives. */
export function osmUrl(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=19/${lat.toFixed(6)}/${lon.toFixed(6)}`;
}

/**
 * Parse `?at=lat,lon`, returning null for anything malformed.
 *
 * STRICT ON PURPOSE. This value becomes a spawn point. A silently-coerced `NaN` would put
 * the player outside the world with no error — the same class of failure as the `?? 0`
 * spawn height that shipped the player 33 m underground twice (#651). Null means "ignore
 * the parameter and spawn normally", which is always recoverable.
 */
export function parseAtParam(
  search: string
): { lat: number; lon: number } | null {
  const raw = new URLSearchParams(search).get('at');
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  // `Number('')` is 0, not NaN, so an empty half ("35.0,") would silently become longitude
  // zero — a spawn point in the Gulf of Guinea. Reject blanks before converting.
  if (parts.some((p) => p.trim() === '')) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export interface MarkerInput {
  lat: number;
  lon: number;
  /** ENU metres, for driving a controller straight at the spot. */
  x: number;
  z: number;
  near?: string | null;
  note?: string;
  /** Path prefix of the running app, e.g. `/ScriptHammer`. */
  basePath?: string;
  /** Site slug, e.g. `chatt`. */
  slug: string;
}

/**
 * The paste-ready block a marker produces.
 *
 * Deliberately plain text rather than JSON: it is written to be pasted into a chat message
 * and read by a person, and it carries BOTH the lat/long (which a human and a map
 * understand) and the raw ENU metres (which the physics harness consumes directly).
 */
export function markerBlock({
  lat,
  lon,
  x,
  z,
  near,
  note,
  basePath = '',
  slug,
}: MarkerInput): string {
  const lines = [
    `found: ${note?.trim() || 'spot'}`,
    formatLatLon(lat, lon),
    `ENU ${x.toFixed(1)}, ${z.toFixed(1)}`,
  ];
  if (near) lines.push(`near: ${near}`);
  lines.push(
    `return: ${basePath}/${slug}/?diorama&walk&at=${lat.toFixed(6)},${lon.toFixed(6)}`
  );
  return lines.join('\n');
}
