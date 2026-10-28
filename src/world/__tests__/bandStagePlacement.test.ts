/**
 * The band stage's placement (#1413): the data file checks out, and the stage lands where
 * the twin's own projection puts Ross's Landing, facing the city.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseStageSpot,
  placeStage,
  isNearStage,
  hasStage,
  audienceYaw,
  NEAR_STAGE_M,
  type StageSpot,
} from '../bandStage/placement';

const ROOT = join(__dirname, '..', '..', '..');
const readJson = (rel: string) =>
  JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as unknown;

const chattStage = () =>
  parseStageSpot(readJson('public/twins/chatt/stage.json'));
const chattManifest = () =>
  readJson('public/twins/chatt/manifest.json') as {
    box: { swLat: number; swLon: number; neLat: number; neLon: number };
    atlasBox?: { swLat: number; swLon: number; neLat: number; neLon: number };
    vectorOffsetM?: { x: number; z: number };
  };

/** Which way the deck's front points after rotation: +Z turned by t about Y. */
const frontOf = (t: number) => [Math.sin(t), Math.cos(t)];

describe('stage.json for chatt', () => {
  it('parses, and sits inside the twin the city renders', () => {
    const spot = chattStage();
    const m = chattManifest();
    const b = m.atlasBox ?? m.box;
    expect(spot.name).toBe("Ross's Landing");
    expect(spot.lat).toBeGreaterThan(b.swLat);
    expect(spot.lat).toBeLessThan(b.neLat);
    expect(spot.lon).toBeGreaterThan(b.swLon);
    expect(spot.lon).toBeLessThan(b.neLon);
  });

  it('faces south toward the city, with the audience in front of it', () => {
    const spot = chattStage();
    const p = placeStage(spot, chattManifest());
    const [fx, fz] = frontOf(p.rotationY);
    expect(fx).toBeCloseTo(0, 10);
    expect(fz).toBeCloseTo(1, 10); // south = +Z
    // The audience spot is in front of the deck, a short walk away.
    const dx = p.audience.x - p.x;
    const dz = p.audience.z - p.z;
    expect(dx * fx + dz * fz).toBeGreaterThan(10);
    expect(Math.hypot(dx, dz)).toBeLessThan(30);
  });

  it('only twins on the list ask for a stage file', () => {
    expect(hasStage('chatt')).toBe(true);
    expect(hasStage('east-main-street')).toBe(false);
  });
});

describe('placeStage', () => {
  const box = { swLat: 35, swLon: -85.4, neLat: 35.1, neLon: -85.2 };
  const base: StageSpot = {
    name: 'Test',
    lat: 35.05,
    lon: -85.3,
    facingDeg: 0,
    audience: { lat: 35.0502, lon: -85.3 },
    source: 'test',
  };

  it('puts the box centre at the origin and north at -Z', () => {
    const p = placeStage(base, { box });
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(0, 6);
    expect(p.audience.z).toBeLessThan(0); // the audience is north of the stage
  });

  it('turns the front to each compass bearing', () => {
    const cases: [number, number, number][] = [
      [0, 0, -1],
      [90, 1, 0],
      [180, 0, 1],
      [270, -1, 0],
    ];
    for (const [deg, ex, ez] of cases) {
      const [fx, fz] = frontOf(
        placeStage({ ...base, facingDeg: deg }, { box }).rotationY
      );
      expect(fx, `bearing ${deg}`).toBeCloseTo(ex, 10);
      expect(fz, `bearing ${deg}`).toBeCloseTo(ez, 10);
    }
  });

  it('prefers the atlas box and applies the vector offset', () => {
    const atlasBox = {
      swLat: 35.04,
      swLon: -85.31,
      neLat: 35.06,
      neLon: -85.29,
    };
    const p = placeStage(base, {
      box,
      atlasBox,
      vectorOffsetM: { x: 3, z: -2 },
    });
    expect(p.x).toBeCloseTo(3, 6);
    expect(p.z).toBeCloseTo(-2, 6);
  });
});

describe('parseStageSpot', () => {
  const good = {
    name: 'Stage',
    lat: 35,
    lon: -85,
    facingDeg: 540,
    audience: { lat: 35, lon: -85 },
    source: 'drape',
  };

  it('normalises the facing', () => {
    expect(parseStageSpot(good).facingDeg).toBe(180);
  });

  it('rejects a file that would place the stage from a bad number', () => {
    const bad: unknown[] = [
      null,
      'stage',
      { ...good, name: '' },
      { ...good, lat: 91 },
      { ...good, lon: 'x' },
      { ...good, facingDeg: Number.NaN },
      { ...good, audience: undefined },
      { ...good, audience: { lat: 35 } },
      { ...good, source: '' },
    ];
    for (const b of bad) {
      expect(() => parseStageSpot(b), JSON.stringify(b)).toThrow();
    }
  });
});

describe('isNearStage', () => {
  it('is true inside the radius and false outside it', () => {
    const p = { x: 10, z: 20 };
    expect(isNearStage(p, 10, 20)).toBe(true);
    expect(isNearStage(p, 10 + NEAR_STAGE_M, 20)).toBe(true);
    expect(isNearStage(p, 10 + NEAR_STAGE_M + 1, 20)).toBe(false);
  });
});

describe('audienceYaw', () => {
  /** Which way the VR viewer looks after rotation: -Z turned by t about Y. */
  const lookOf = (t: number) => [-Math.sin(t), -Math.cos(t)];

  it('faces the chatt audience back at the stage', () => {
    const p = placeStage(chattStage(), chattManifest());
    const [lx, lz] = lookOf(audienceYaw(chattStage().facingDeg));
    const dx = p.x - p.audience.x;
    const dz = p.z - p.audience.z;
    const len = Math.hypot(dx, dz);
    // The look direction points at the stage, within a degree or so.
    expect(lx * (dx / len) + lz * (dz / len)).toBeGreaterThan(0.999);
  });

  it('looks the opposite way the stage faces, for every compass quarter', () => {
    for (const facing of [0, 90, 180, 270, -90, 450]) {
      const [lx, lz] = lookOf(audienceYaw(facing));
      const b = ((facing + 180) * Math.PI) / 180;
      expect(lx).toBeCloseTo(Math.sin(b), 9);
      expect(lz).toBeCloseTo(-Math.cos(b), 9);
    }
  });
});
