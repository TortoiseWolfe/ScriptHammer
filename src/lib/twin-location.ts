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

/**
 * A building the address lookup can answer with: an ENU ring plus a label.
 *
 * `ring` is FLAT `[x, z, x, z, …]`, matching `Building.ring`.
 */
export interface AddressableBuilding {
  ring: number[];
  tags?: Record<string, string>;
}

/** One indexed building: its label, its ring, and a precomputed bounding box. */
export interface IndexedAddress {
  label: string;
  ring: number[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Precompute the address index once, rather than per sample.
 *
 * TWO REDUCTIONS, both load-bearing, because this is scanned four times a second against a
 * 13,877-building extent:
 *
 *   1. **Only buildings that can answer.** A building with no name and no full address can
 *      never be the result, so it is dropped at build time — 13,877 entries become ~1,400.
 *   2. **A bounding box per building.** Point-in-polygon is O(ring); a box rejection is four
 *      comparisons. Nearly every candidate is rejected by the box.
 *
 * Without both, this is ~13,877 polygon tests per sample and the walk loop pays for it. With
 * them it is ~1,400 box tests and a handful of polygon tests. That is the whole reason this is
 * a separate build step instead of a filter inside the lookup.
 */
export function buildAddressIndex(
  buildings: readonly AddressableBuilding[],
  labelOf: (tags?: Record<string, string>) => string | null
): IndexedAddress[] {
  const out: IndexedAddress[] = [];
  for (const b of buildings) {
    const label = labelOf(b.tags);
    if (!label || b.ring.length < 6) continue; // a ring needs 3+ points to enclose anything
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i + 1 < b.ring.length; i += 2) {
      const x = b.ring[i];
      const z = b.ring[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    out.push({ label, ring: b.ring, minX, maxX, minZ, maxZ });
  }
  return out;
}

/**
 * Is (x, z) inside this flat ENU ring? Standard ray-casting crossing count.
 *
 * Exported so the test can drive it directly: a containment bug inside a lookup that also
 * falls back to "nearest" is invisible from the outside, because a wrong answer still looks
 * like a plausible nearby building.
 */
export function pointInRing(ring: number[], x: number, z: number): boolean {
  let inside = false;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i * 2];
    const zi = ring[i * 2 + 1];
    const xj = ring[j * 2];
    const zj = ring[j * 2 + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export interface AddressHit {
  label: string;
  /** True when the point is inside the footprint, rather than merely near it. */
  inside: boolean;
  /** Metres from the point to the footprint's centre; 0 when inside. */
  distance: number;
}

/**
 * The address at an ENU point: the building the player is standing in, else the nearest one
 * within `radius` metres.
 *
 * The `inside` flag is reported rather than hidden because the two answers mean different
 * things — "you are at 100 Broad Street" versus "you are near 100 Broad Street" — and a
 * readout that states the second as the first is confidently wrong on every pavement in the
 * city. Callers decide how to word it; this decides what is true.
 *
 * `radius` defaults to 40 m: past that the nearest addressed building is not usefully "where
 * you are", and in the sparse parts of the extent the nearest one can be hundreds of metres
 * off. Returning null there is the honest answer.
 */
export function addressAt(
  index: readonly IndexedAddress[],
  x: number,
  z: number,
  radius = 40
): AddressHit | null {
  let nearest: AddressHit | null = null;
  for (const b of index) {
    // Box rejection first — this is the step that makes the scan affordable.
    if (
      x >= b.minX - radius &&
      x <= b.maxX + radius &&
      z >= b.minZ - radius &&
      z <= b.maxZ + radius
    ) {
      if (
        x >= b.minX &&
        x <= b.maxX &&
        z >= b.minZ &&
        z <= b.maxZ &&
        pointInRing(b.ring, x, z)
      ) {
        // Containment wins outright: standing inside a footprint is not a distance question.
        return { label: b.label, inside: true, distance: 0 };
      }
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const distance = Math.hypot(cx - x, cz - z);
      if (distance <= radius && (!nearest || distance < nearest.distance)) {
        nearest = { label: b.label, inside: false, distance };
      }
    }
  }
  return nearest;
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
