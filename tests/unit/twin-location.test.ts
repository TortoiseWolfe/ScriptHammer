import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProjection } from '@/lib/enu';
import {
  formatLatLon,
  markerBlock,
  nearestLandmark,
  osmUrl,
  parseAtParam,
} from '@/lib/twin-location';

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
