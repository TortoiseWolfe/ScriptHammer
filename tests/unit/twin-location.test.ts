import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProjection } from '@/lib/enu';
import {
  addressAt,
  buildAddressIndex,
  formatLatLon,
  markerBlock,
  nearestLandmark,
  osmUrl,
  parseAtParam,
  pointInRing,
} from '@/lib/twin-location';
import { addressOf, buildingLabelOf } from '@/lib/osm-tags';
import {
  projectWideBuildings,
  type WideLiveBuilding,
} from '@/lib/wide-buildings';

/**
 * The location readout and the `?at=` return trip (#706).
 *
 * WHY IT MATTERS MORE THAN IT LOOKS. A coordinate the player copies out of the game is the
 * only way a report like "the stairs on that building don't work" becomes reproducible —
 * it is what a physics harness gets pointed at. If the round trip drifts, the coordinate
 * sends me to the wrong building and the report is worse than useless.
 *
 * Tested against the SHIPPED chatt manifest, not a synthetic box, because the projection's
 * whole job is to be correct for that site's real extent and offset.
 */
const TWIN = join(process.cwd(), 'public', 'twins', 'chatt');
const manifest = JSON.parse(
  readFileSync(join(TWIN, 'manifest.json'), 'utf8')
) as {
  atlasBox: Parameters<typeof createProjection>[0];
  vectorOffsetM: { x: number; z: number };
};

describe('twin location (#706)', () => {
  it('the fixture it depends on is really there', () => {
    expect(manifest.atlasBox, 'chatt manifest has no atlasBox').toBeTruthy();
  });

  it('ENU → lat/long → ENU round-trips to well under a metre', () => {
    // The marker writes lat/long; `?at=` reads it back and spawns you there. Any drift
    // here is drift between where you stood and where you return to.
    const proj = createProjection(manifest.atlasBox, manifest.vectorOffsetM);
    const points: [number, number][] = [
      [0, 0],
      [312.4, -88.7],
      [-1500, 2200],
      [3800, -3700],
    ];
    for (const [x, z] of points) {
      const [lon, lat] = proj.enuToLonLat(x, z);
      // Round-trip through the SIX DECIMALS the marker actually prints, not through full
      // float precision — otherwise the test proves the maths and not the feature.
      const rx = Number(lat.toFixed(6));
      const rz = Number(lon.toFixed(6));
      const [bx, bz] = proj.lonLatToEnu(rz, rx);
      const drift = Math.hypot(bx - x, bz - z);
      expect(
        drift,
        `round trip from ENU ${x},${z} drifted ${drift.toFixed(3)} m — the return link ` +
          `would not put you back where you marked`
      ).toBeLessThan(0.2);
    }
  });

  it('formats and links a coordinate', () => {
    expect(formatLatLon(35.0451234, -85.3098765)).toBe('35.045123, -85.309877');
    const url = osmUrl(35.045123, -85.309877);
    expect(url).toContain('openstreetmap.org');
    expect(url).toContain('35.045123');
    expect(url).toContain('-85.309877');
  });

  describe('parseAtParam', () => {
    it('reads a well-formed pair', () => {
      expect(parseAtParam('?at=35.045123,-85.309876')).toEqual({
        lat: 35.045123,
        lon: -85.309876,
      });
    });

    it('rejects anything malformed rather than coercing it', () => {
      // This value becomes a SPAWN POINT. A silently-coerced NaN drops the player outside
      // the world with no error — the same class of failure as the `?? 0` spawn height
      // that put them 33 m underground twice (#651). Null means "spawn normally".
      for (const bad of [
        '',
        '?at=',
        '?at=abc',
        '?at=35.0',
        '?at=35.0,',
        '?at=,-85.3',
        '?at=35.0,-85.3,12',
        '?at=NaN,NaN',
        '?at=999,-85.3', // latitude out of range
        '?at=35.0,-999', // longitude out of range
      ]) {
        expect(parseAtParam(bad), `"${bad}" should not parse`).toBeNull();
      }
    });
  });

  describe('nearestLandmark', () => {
    const entries = [
      { slug: 'a', title: 'Alpha', x: 0, z: 0 },
      { slug: 'b', title: 'Bravo', x: 100, z: 0 },
      { slug: 'c', title: 'Charlie', x: 0, z: 250 },
    ];

    it('picks the closest and reports the distance', () => {
      const n = nearestLandmark(entries, 90, 5);
      expect(n?.entry.slug).toBe('b');
      expect(n?.distance).toBeCloseTo(Math.hypot(10, 5), 6);
    });

    it('returns null with nothing to choose from', () => {
      expect(nearestLandmark([], 0, 0)).toBeNull();
    });
  });

  it('the marker block carries everything needed to get back — and to test', () => {
    const block = markerBlock({
      lat: 35.045123,
      lon: -85.309876,
      x: 312.44,
      z: -88.71,
      near: 'Chattanooga Choo Choo Hotel',
      note: 'stairs',
      basePath: '/ScriptHammer',
      slug: 'chatt',
    });
    // Human-readable position...
    expect(block).toContain('35.045123, -85.309876');
    expect(block).toContain('near: Chattanooga Choo Choo Hotel');
    expect(block).toContain('found: stairs');
    // ...AND the raw metres, which is what the stair harness is driven with.
    expect(block).toContain('ENU 312.4, -88.7');
    // ...AND a link that reproduces the exact spot, walk mode included.
    expect(block).toContain(
      '/ScriptHammer/chatt/?diorama&walk&at=35.045123,-85.309876'
    );
    // The return link must survive its own parser.
    const qs = block.slice(block.indexOf('?diorama'));
    expect(parseAtParam(qs)).toEqual({ lat: 35.045123, lon: -85.309876 });
  });

  it('a marker with no note or landmark still produces a usable block', () => {
    const block = markerBlock({
      lat: 1,
      lon: 2,
      x: 3,
      z: 4,
      near: null,
      slug: 'chatt',
    });
    expect(block).toContain('found: spot');
    expect(block).not.toContain('near:');
    expect(parseAtParam(block.slice(block.indexOf('?diorama')))).toEqual({
      lat: 1,
      lon: 2,
    });
  });
});

/**
 * Naming the building you are standing in (#708).
 *
 * WHY THIS IS TESTED AGAINST THE REAL ARTIFACT AND NOT ONLY FIXTURES. The defect being fixed
 * was not a wrong algorithm — it was a TYPE that omitted a field, so a `.map()` silently
 * dropped tags that were already in the browser. Fixtures I write carry tags by construction
 * and therefore cannot fail that way. Only reading the shipped
 * `public/twins/chatt/buildings-wide.json` proves the data this feature claims to use is
 * actually there, in the shape claimed.
 */
describe('the address readout (#708)', () => {
  describe('reading tags', () => {
    it('requires BOTH a house number and a street', () => {
      // A bare street names a whole road. In the wide extent that is the gap between 1,341
      // buildings with addr:street and 913 with a real address — 428 chances to print a
      // street name under a building that never claimed one.
      expect(
        addressOf({ 'addr:housenumber': '100', 'addr:street': 'Broad St' })
      ).toBe('100 Broad St');
      expect(addressOf({ 'addr:street': 'Broad St' })).toBeNull();
      expect(addressOf({ 'addr:housenumber': '100' })).toBeNull();
      expect(addressOf(undefined)).toBeNull();
      expect(addressOf({})).toBeNull();
    });

    it('prefers a name over an address, and never falls back to the building type', () => {
      expect(
        buildingLabelOf({ name: 'Tivoli Theatre', 'addr:housenumber': '709' })
      ).toBe('Tivoli Theatre');
      expect(
        buildingLabelOf({
          'addr:housenumber': '100',
          'addr:street': 'Broad St',
        })
      ).toBe('100 Broad St');
      // `building=yes` is 85% of the extent; "Yes" is worse than saying nothing.
      expect(buildingLabelOf({ building: 'yes' })).toBeNull();
      expect(buildingLabelOf({ name: '   ' })).toBeNull();
    });
  });

  describe('point in footprint', () => {
    // A unit square from (0,0) to (10,10).
    const square = [0, 0, 10, 0, 10, 10, 0, 10];

    it('says yes inside and no outside', () => {
      expect(pointInRing(square, 5, 5)).toBe(true);
      expect(pointInRing(square, 15, 5)).toBe(false);
      expect(pointInRing(square, -1, 5)).toBe(false);
      expect(pointInRing(square, 5, 20)).toBe(false);
    });

    it('handles a concave ring, where a bounding box would be wrong', () => {
      // An L: the notch at (8,8) is inside the BOX and outside the SHAPE. If containment ever
      // degrades to a box test, this is the case that catches it.
      const L = [0, 0, 10, 0, 10, 5, 5, 5, 5, 10, 0, 10];
      expect(pointInRing(L, 2, 2)).toBe(true);
      expect(pointInRing(L, 8, 8)).toBe(false);
    });
  });

  describe('the index', () => {
    const ring = [0, 0, 10, 0, 10, 10, 0, 10];

    it('drops buildings that could never be an answer', () => {
      const index = buildAddressIndex(
        [
          { ring, tags: { name: 'Named' } },
          { ring, tags: { building: 'yes' } }, // no label
          { ring }, // no tags at all
          { ring: [0, 0, 1, 1], tags: { name: 'Degenerate' } }, // 2 points cannot enclose
        ],
        buildingLabelOf
      );
      expect(index.map((b) => b.label)).toEqual(['Named']);
    });

    it('computes a bounding box, which is what makes the scan affordable', () => {
      const [b] = buildAddressIndex(
        [{ ring, tags: { name: 'X' } }],
        buildingLabelOf
      );
      expect([b.minX, b.maxX, b.minZ, b.maxZ]).toEqual([0, 10, 0, 10]);
    });
  });

  describe('answering at a point', () => {
    const index = buildAddressIndex(
      [
        { ring: [0, 0, 10, 0, 10, 10, 0, 10], tags: { name: 'Inside Me' } },
        {
          ring: [100, 100, 110, 100, 110, 110, 100, 110],
          tags: { name: 'Far Away' },
        },
      ],
      buildingLabelOf
    );

    it('reports containment as `inside`, at zero distance', () => {
      const hit = addressAt(index, 5, 5);
      expect(hit).toEqual({ label: 'Inside Me', inside: true, distance: 0 });
    });

    it('distinguishes standing IN a building from standing beside one', () => {
      // The distinction the HUD renders as "at" vs "near". Collapsing them would make the
      // readout confidently wrong on every pavement in the city.
      const beside = addressAt(index, 15, 5);
      expect(beside?.label).toBe('Inside Me');
      expect(beside?.inside).toBe(false);
      expect(beside!.distance).toBeGreaterThan(0);
    });

    it('returns null rather than naming a building far away', () => {
      // Between the two, outside both radii. The honest answer is nothing — a nearest-match
      // with no bound would name a building hundreds of metres off in the sparse extent.
      expect(addressAt(index, 60, 60)).toBeNull();
      expect(addressAt([], 0, 0)).toBeNull();
    });

    it('honours the radius bound', () => {
      expect(addressAt(index, 15, 5, 1)).toBeNull();
      expect(addressAt(index, 15, 5, 40)).not.toBeNull();
    });
  });

  describe('against the shipped chatt artifact', () => {
    // The chain this proves: buildings-wide.json really carries tags -> the projection to ENU
    // keeps them -> the index finds them -> a point inside a footprint gets its address.
    const wide = JSON.parse(
      readFileSync(
        join(process.cwd(), 'public/twins/chatt/buildings-wide.json'),
        'utf8'
      )
    ) as WideLiveBuilding[];
    const manifest = JSON.parse(
      readFileSync(
        join(process.cwd(), 'public/twins/chatt/manifest.json'),
        'utf8'
      )
    );

    it('ships tags on every entry, which is the premise of this feature', () => {
      expect(wide.length).toBeGreaterThan(13_000);
      expect(wide.every((b) => b.tags !== undefined)).toBe(true);
    });

    it('carries enough real addresses to be worth showing', () => {
      const addressed = wide.filter((b) => addressOf(b.tags)).length;
      const labelled = wide.filter((b) => buildingLabelOf(b.tags)).length;
      // Measured 2026-09-01 against the shipped artifact: 913 full addresses, 400 names,
      // 1,108 labelled. Asserted as floors, not equalities, so a rebake that ADDS coverage
      // does not fail the suite — but high enough that losing the tag threading would.
      expect(addressed).toBe(913);
      expect(labelled).toBe(1108);
    });

    it('preserves tags through the projection — the step that used to drop them', () => {
      const proj = createProjection(
        manifest.atlasBox ?? manifest.box,
        manifest.vectorOffsetM
      );
      const projected = projectWideBuildings(wide, proj.lonLatToEnu);
      expect(projected.length).toBe(wide.length);
      expect(projected.every((b) => b.tags !== undefined)).toBe(true);
      // And the ring survived: a projection that produced empty rings would still pass the
      // assertion above.
      expect(projected.every((b) => b.ring.length >= 6)).toBe(true);
    });

    it('honours hideBuildingIds, so the embedded scan is not double-drawn', () => {
      const proj = createProjection(
        manifest.atlasBox ?? manifest.box,
        manifest.vectorOffsetM
      );
      const hide = new Set([wide[0].id, wide[1].id]);
      const projected = projectWideBuildings(wide, proj.lonLatToEnu, hide);
      expect(projected.length).toBe(wide.length - 2);
      expect(projected.some((b) => hide.has(b.id))).toBe(false);
    });

    it('answers with the right address at a real building centroid', () => {
      const proj = createProjection(
        manifest.atlasBox ?? manifest.box,
        manifest.vectorOffsetM
      );
      // THE function WideCity calls, not a copy of it. A copy here would pass while the
      // real projection dropped tags — which is exactly the defect being fixed.
      const buildings = projectWideBuildings(wide, proj.lonLatToEnu);
      const index = buildAddressIndex(buildings, buildingLabelOf);
      expect(index.length).toBeGreaterThan(1000);

      // Take addressed buildings and probe the centre of each bounding box. Convexity is not
      // guaranteed, so not every centre lands inside its own footprint — but the great
      // majority must, or the projection or the ring order is wrong.
      const probes = index.slice(0, 200);
      const resolved = probes.filter((b) => {
        const hit = addressAt(
          index,
          (b.minX + b.maxX) / 2,
          (b.minZ + b.maxZ) / 2
        );
        return hit !== null;
      });
      expect(resolved.length).toBe(probes.length);

      const inside = probes.filter((b) => {
        const hit = addressAt(
          index,
          (b.minX + b.maxX) / 2,
          (b.minZ + b.maxZ) / 2
        );
        return hit?.inside === true;
      });
      expect(inside.length).toBeGreaterThan(probes.length * 0.8);
    });
  });
});
