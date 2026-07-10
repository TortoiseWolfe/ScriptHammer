import { describe, it, expect } from 'vitest';
import { deriveFraming } from '../framing';
import type { Manifest } from '../manifest';

// The flagship's baked dimensions. The derivation formulas were calibrated so
// a site of this size reproduces the hand-tuned pre-#232 framing within ~4%
// (old values in comments) — this suite locks that calibration so a refactor
// can't silently reframe the flagship.
function chattManifest(overrides?: Partial<Manifest['site']>): Manifest {
  return {
    box: { swLat: 35.0078, swLon: -85.316, neLat: 35.06, neLon: -85.3 },
    groundWm: 1460,
    groundHm: 5791.1,
    cosLat: 0.82,
    drape: { path: 'drape.jpg', width: 730, height: 2382, mpp: 2 },
    provenance: 'x',
    fetchedAt: 'x',
    ruleHistogram: {},
    site: {
      slug: 'chatt',
      name: 'Chattanooga Mini',
      tour: [
        {
          pos: [-40, 240, -1980],
          look: [-220, 20, -2340],
          dwell: 5,
          name: 'A',
          blurb: 'b',
        },
      ],
      framing: { homeFocus: [-100, 0, -2000] },
      ...overrides,
    },
  };
}

const L = 5791.1;

describe('deriveFraming — formulas at chatt dimensions', () => {
  const f = deriveFraming(chattManifest());

  it('orbit ranges (old hand-tuned: minR 200, maxR 5000)', () => {
    expect(f.minR).toBeCloseTo(Math.max(50, L / 30), 6); // ≈193
    expect(f.maxR).toBeCloseTo(0.85 * L, 6); // ≈4922
  });
  it('WASD speed (old: 900)', () => {
    expect(f.moveSpeed).toBeCloseTo(0.155 * L, 6); // ≈898
  });
  it('pan clamps from half-extents + margin (old: ±1000 / ±3100)', () => {
    const margin = Math.max(150, 0.05 * L); // ≈290
    expect(f.panMaxX).toBeCloseTo(1460 / 2 + margin, 6); // ≈1020
    expect(f.panMinX).toBeCloseTo(-(1460 / 2 + margin), 6);
    expect(f.panMaxZ).toBeCloseTo(L / 2 + margin, 6); // ≈3186
    expect(f.panMinZ).toBeCloseTo(-(L / 2 + margin), 6);
  });
  it('fog range (old: 1500 / 9000)', () => {
    expect(f.fogNear).toBeCloseTo(0.26 * L, 6); // ≈1506
    expect(f.fogFar).toBeCloseTo(1.55 * L, 6); // ≈8976
  });
  it('camera planes (near 5 for depth precision — #259 iter 4, far ≈8000)', () => {
    // near:1 over an ~8km far plane starved 24-bit depth downtown (z-fight
    // aggravator). Closest legitimate approach is the property view's
    // minR=8, so 5 never clips.
    expect(f.cameraNear).toBe(5);
    expect(f.cameraFar).toBeCloseTo(1.4 * L, 6); // ≈8108
  });
  it('home orbit (old: radius 2600, phi 0.62, theta 0) + authored focus', () => {
    expect(f.homeRadius).toBeCloseTo(0.45 * L, 6); // ≈2606
    expect(f.homePhi).toBe(0.62);
    expect(f.homeTheta).toBe(0);
    expect(f.homeFocus).toEqual([-100, 0, -2000]); // authored override
  });
  it('ortho frame IS the drape extent: box-centred half-extents, north-up (#233)', () => {
    expect(f.ortho.center).toEqual([0, 0]); // world origin = box centre, NOT homeFocus
    expect(f.ortho.halfW).toBeCloseTo(1460 / 2, 6);
    expect(f.ortho.halfH).toBeCloseTo(L / 2, 6);
    // hover height: fov-62 fit of the long extent, +5% (site-scaled, always
    // clears the content). Was shared with the retired ?topdown diagnostic.
    const expected = (1.05 * (L / 2)) / Math.tan((31 * Math.PI) / 180);
    expect(f.ortho.height).toBeCloseTo(expected, 6); // ≈5060
  });
  it('initial camera = first tour shot when a tour exists', () => {
    expect(f.initialCameraPos).toEqual([-40, 240, -1980]);
  });
});

describe('deriveFraming — defaults and overrides', () => {
  it('defaults homeFocus to the origin (box centre)', () => {
    const f = deriveFraming(chattManifest({ framing: undefined }));
    expect(f.homeFocus).toEqual([0, 0, 0]);
    expect(f.ortho.center).toEqual([0, 0]);
  });
  it('starts at the home orbit position for a tour-less site', () => {
    const f = deriveFraming(
      chattManifest({ tour: undefined, framing: undefined })
    );
    const r = f.homeRadius;
    expect(f.initialCameraPos[0]).toBeCloseTo(0 + r * Math.sin(0.62) * 0, 6);
    expect(f.initialCameraPos[1]).toBeCloseTo(r * Math.cos(0.62), 6);
    expect(f.initialCameraPos[2]).toBeCloseTo(r * Math.sin(0.62), 6);
  });
  it('authored framing overrides win field-by-field', () => {
    const f = deriveFraming(
      chattManifest({
        framing: {
          homeFocus: [1, 2, 3],
          homeRadius: 1234,
          minR: 9,
          maxR: 99,
          moveSpeed: 42,
          panMargin: 0,
          fogNear: 10,
          fogFar: 20,
          cameraFar: 30,
        },
      })
    );
    expect(f.homeFocus).toEqual([1, 2, 3]);
    expect(f.homeRadius).toBe(1234);
    expect(f.minR).toBe(9);
    expect(f.maxR).toBe(99);
    expect(f.moveSpeed).toBe(42);
    expect(f.panMaxX).toBeCloseTo(730, 6); // margin 0 → exactly half-extent
    expect(f.fogNear).toBe(10);
    expect(f.fogFar).toBe(20);
    expect(f.cameraFar).toBe(30);
  });
  it('camera far never collapses below 2000 for a tiny site', () => {
    const m = chattManifest({ framing: undefined });
    m.groundWm = 300;
    m.groundHm = 400;
    const f = deriveFraming(m);
    expect(f.cameraFar).toBe(2000);
    expect(f.minR).toBe(50);
  });
  it('homePhi/homeTheta overrides steer the home orbit position (#234 street-side camera)', () => {
    // synthetic anchor — never a real parcel's coordinates
    const f = deriveFraming(
      chattManifest({
        tour: undefined,
        framing: {
          homeFocus: [12.5, 27, -30.25],
          homeRadius: 40,
          homePhi: 1.1,
          homeTheta: Math.PI,
        },
      })
    );
    expect(f.homePhi).toBe(1.1);
    expect(f.homeTheta).toBe(Math.PI);
    // camera = focus + r·(sinφ·sinθ, cosφ, sinφ·cosθ); θ=π → offset -Z (north)
    expect(f.initialCameraPos[0]).toBeCloseTo(12.5, 6);
    expect(f.initialCameraPos[1]).toBeCloseTo(27 + 40 * Math.cos(1.1), 6);
    expect(f.initialCameraPos[2]).toBeCloseTo(-30.25 - 40 * Math.sin(1.1), 6);
  });
  it('uses the LONG extent for a landscape site (L = max(W, H), not groundHm)', () => {
    const m = chattManifest({ tour: undefined, framing: undefined });
    m.groundWm = 6000; // wider than deep
    m.groundHm = 2000;
    const f = deriveFraming(m);
    expect(f.maxR).toBeCloseTo(0.85 * 6000, 6);
    expect(f.fogFar).toBeCloseTo(1.55 * 6000, 6);
    expect(f.homeRadius).toBeCloseTo(0.45 * 6000, 6);
    // pan clamps still follow each axis's own extent
    expect(f.panMaxX).toBeCloseTo(3000 + 300, 6); // margin = 0.05 * 6000
    expect(f.panMaxZ).toBeCloseTo(1000 + 300, 6);
  });
});
