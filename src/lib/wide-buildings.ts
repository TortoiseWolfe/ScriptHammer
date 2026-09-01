/**
 * Projecting `buildings-wide.json` into the scene's ENU frame (#708).
 *
 * WHY THIS IS A MODULE AND NOT A `.map()` INSIDE `WideCity`. It was one, and that is precisely
 * how the defect this fixes survived: the projection dropped OSM tags, and nothing could see
 * it. A test could assert the JSON carries tags and a test could assert the lookup finds them,
 * and both passed while the one step between them threw the tags away.
 *
 * A test that re-implements the projection to check it is not a test of the projection — it is
 * a test of the copy. So the real transform lives here, `WideCity` calls it, and the test calls
 * the same function. Delete the tag pass-through and the suite goes red, which is the only
 * property that makes the rest of the coverage mean anything.
 */
import type { Building } from './manifest';

/** A raw entry as it appears in `buildings-wide.json`. */
export interface WideLiveBuilding {
  id: number;
  /** FLAT `[lon, lat, lon, lat, …]` ring. */
  lonLat: number[];
  heightM: number;
  rule: string;
  /** OSM tags. Present on every entry in the shipped chatt artifact. */
  tags?: Record<string, string>;
}

/** Just the part of the projection this needs, so tests need no Three.js. */
export type LonLatToEnu = (
  lon: number,
  lat: number
) => readonly [number, number];

/**
 * Project raw WGS84 footprints into local ENU, preserving everything else about them.
 *
 * `hide` carries OSM ids the embedded scan replaces — global ids, so the exhibit's
 * `hideBuildingIds` match here without translation.
 */
export function projectWideBuildings(
  wide: readonly WideLiveBuilding[],
  lonLatToEnu: LonLatToEnu,
  hide: ReadonlySet<number> = new Set()
): Building[] {
  const out: Building[] = [];
  for (const b of wide) {
    if (hide.has(b.id)) continue;
    const ring: number[] = [];
    for (let i = 0; i + 1 < b.lonLat.length; i += 2) {
      const [x, z] = lonLatToEnu(b.lonLat[i], b.lonLat[i + 1]);
      ring.push(x, z);
    }
    out.push({ id: b.id, ring, height: b.heightM, rule: b.rule, tags: b.tags });
  }
  return out;
}
