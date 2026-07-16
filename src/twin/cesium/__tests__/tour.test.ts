import { describe, it, expect } from 'vitest';
import {
  enuYToEllipsoidalM,
  landmarkStops,
  cornerStops,
  resolveGround,
  shouldAutoStart,
} from '../tour';
import type { AtlasBuilding } from '../buildings';
import type { Manifest, TerrainGrid } from '@/lib/manifest';

// chatt's real numbers — the ones the conversion has to reproduce.
const MIN_ORTHO = 193.0;
const GEOID = -29.657;
const fine: TerrainGrid = {
  cols: 2,
  rows: 2,
  heights: [MIN_ORTHO, 248.5, 200, 210], // min is 193.0
};

const manifest = {
  box: { swLat: 35.0078, swLon: -85.316, neLat: 35.06, neLon: -85.3 },
  vectorOffsetM: { x: 0.5, z: 0 },
  geoidOffsetM: GEOID,
  site: {
    slug: 'chatt',
    name: 'Chattanooga Mini',
    tour: [
      {
        pos: [-40, 240, -1980] as [number, number, number],
        look: [-220, 20, -2340] as [number, number, number],
        dwell: 5,
        name: "Ross's Landing",
        blurb: 'The 1815 riverfront landing where Chattanooga began.',
      },
    ],
  },
} as unknown as Manifest;

const bld = (id: number, lon: number, lat: number): AtlasBuilding => ({
  id,
  heightM: 10,
  rule: 'lidar',
  lonLat: [lon, lat, lon + 1e-4, lat, lon + 1e-4, lat + 1e-4, lon, lat + 1e-4],
});

describe('enuYToEllipsoidalM', () => {
  // The diorama's ENU y=0 is the terrain MINIMUM in ORTHOMETRIC metres
  // (src/world/Water.tsx:11: "Y=0 ... all subtract the same minElevation"), and
  // the atlas is ellipsoidal. Getting this wrong renders BLACK, not an error —
  // the camera is simply underground. Third appearance of the datum gotcha in
  // this layer, after terrain and building extrusion.
  it('adds BOTH minElevation and the geoid offset, exactly once each', () => {
    expect(enuYToEllipsoidalM(manifest, fine, 0)).toBeCloseTo(
      MIN_ORTHO + GEOID,
      6
    ); // 163.343
    expect(enuYToEllipsoidalM(manifest, fine, 240)).toBeCloseTo(403.343, 6);
  });

  it("Ross's Landing flies at ~403 m ellipsoidal, ~227 m over ~176 m ground", () => {
    const h = enuYToEllipsoidalM(manifest, fine, 240);
    expect(h - 176).toBeGreaterThan(200);
    expect(h - 176).toBeLessThan(260);
  });

  it('a missing geoidOffsetM degrades to minElevation only, not to a throw', () => {
    const m = { ...manifest, geoidOffsetM: undefined } as unknown as Manifest;
    expect(enuYToEllipsoidalM(m, fine, 0)).toBe(MIN_ORTHO);
  });
});

describe('landmarkStops', () => {
  it('converts the authored waypoint into a real lon/lat/height', () => {
    const [s] = landmarkStops(manifest, fine);
    expect(s.name).toBe("Ross's Landing");
    expect(s.dwell).toBe(5);
    // Inside the chatt box, and off the origin.
    expect(s.lon).toBeGreaterThan(-85.316);
    expect(s.lon).toBeLessThan(-85.3);
    expect(s.lat).toBeGreaterThan(35.0078);
    expect(s.lat).toBeLessThan(35.06);
    expect(s.heightM).toBeCloseTo(403.343, 3);
  });

  it('THE INVARIANT: the camera is above the ground under it', () => {
    // The datum bug in tour form. Ground here is ~176 m ellipsoidal.
    for (const s of landmarkStops(manifest, fine)) {
      expect(s.heightM).toBeGreaterThan(176 + 2);
    }
  });

  it('the aim point also clears terrain — a tour must not stare into a hill', () => {
    for (const s of landmarkStops(manifest, fine)) {
      // look.y = 20 -> 183.3 m ellipsoidal, above ~176 m ground.
      expect(s.lookAt.heightM).toBeGreaterThan(176);
    }
  });

  it('aims from pos toward look: north-west and downward here', () => {
    const [s] = landmarkStops(manifest, fine);
    // look is west (-x) and north (-z) of pos, and below it.
    expect(s.pitchRad).toBeLessThan(0); // looking down
    const deg = (s.headingRad * 180) / Math.PI;
    expect(deg).toBeGreaterThan(-180);
    expect(deg).toBeLessThan(0); // west of north
  });

  it('a site with no tour yields no stops (no button that flies nowhere)', () => {
    const m = {
      ...manifest,
      site: { ...manifest.site, tour: undefined },
    } as unknown as Manifest;
    expect(landmarkStops(m, fine)).toEqual([]);
  });
});

describe('cornerStops', () => {
  // One building parked near each corner of the box, plus a decoy mid-box.
  const buildings = [
    bld(1, -85.3159, 35.0079), // SW
    bld(2, -85.3001, 35.0079), // SE
    bld(3, -85.3159, 35.0599), // NW
    bld(4, -85.3001, 35.0599), // NE
    bld(9, -85.308, 35.034), // centre — must never be picked
  ];

  it('picks the nearest building to each of the four box corners', () => {
    const stops = cornerStops(manifest, fine, buildings);
    expect(stops).toHaveLength(4);
    expect(stops.map((s) => s.name.slice(0, 2))).toEqual([
      'SW',
      'SE',
      'NW',
      'NE',
    ]);
    // the mid-box decoy is nearest to nothing
    expect(stops.some((s) => s.name.includes('way 9'))).toBe(false);
  });

  it('the four stops are distinct buildings', () => {
    const stops = cornerStops(manifest, fine, buildings);
    const names = stops.map((s) => s.name);
    expect(new Set(names).size).toBe(4);
  });

  it('names each stop for what it TESTS, not just where it is', () => {
    // These stops exist to catch seam regressions; the blurb is the reason.
    for (const s of cornerStops(manifest, fine, buildings)) {
      expect(s.blurb).toMatch(/DEM seam|drape edge|lidar/i);
    }
  });

  it('degrades to nothing when there are no buildings', () => {
    expect(cornerStops(manifest, fine, [])).toEqual([]);
  });
});

describe('resolveGround', () => {
  it('lifts corner stops above LIVE terrain, and only the unresolved ones', () => {
    const buildings = [bld(1, -85.3159, 35.0079)];
    const raw = cornerStops(manifest, fine, buildings);
    expect(raw[0].heightM).toBe(0); // unresolved marker
    const [s] = resolveGround(raw, () => 400, 90);
    expect(s.heightM).toBe(490); // 400 ground + 90 eye
    expect(s.lookAt.heightM).toBe(410);
  });

  it('leaves already-resolved landmark stops untouched', () => {
    const stops = landmarkStops(manifest, fine);
    const out = resolveGround(stops, () => 9999);
    expect(out[0].heightM).toBeCloseTo(403.343, 3);
  });

  it('THE INVARIANT holds after resolution: eye above ground at every stop', () => {
    const buildings = [
      bld(1, -85.3159, 35.0079),
      bld(2, -85.3001, 35.0079),
      bld(3, -85.3159, 35.0599),
      bld(4, -85.3001, 35.0599),
    ];
    const ground = 176;
    const all = resolveGround(
      [
        ...landmarkStops(manifest, fine),
        ...cornerStops(manifest, fine, buildings),
      ],
      () => ground
    );
    expect(all).toHaveLength(5);
    for (const s of all) expect(s.heightM).toBeGreaterThan(ground + 2);
  });
});

describe('shouldAutoStart', () => {
  it('plays on arrival — the tour is the best thing on the page', () => {
    expect(
      shouldAutoStart({ hasStops: true, notour: false, reducedMotion: false })
    ).toBe(true);
  });

  it('?notour suppresses it — you cannot work on the atlas if it flies every reload', () => {
    expect(
      shouldAutoStart({ hasStops: true, notour: true, reducedMotion: false })
    ).toBe(false);
  });

  it('NEVER auto-flies under reduced motion (WCAG 2.3.3) — the button still offers it', () => {
    expect(
      shouldAutoStart({ hasStops: true, notour: false, reducedMotion: true })
    ).toBe(false);
  });

  it('no stops, no autoplay — never a tour that flies nowhere', () => {
    expect(
      shouldAutoStart({ hasStops: false, notour: false, reducedMotion: false })
    ).toBe(false);
  });
});
