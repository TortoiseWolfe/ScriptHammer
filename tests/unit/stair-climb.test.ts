import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { EmbodiedController } from '@/lib/cod/player/EmbodiedController';
import type { EmbodiedInput } from '@/lib/cod/player/EmbodiedController';

/**
 * Can the body climb the staircases the game actually ships? (#705)
 *
 * TWO THINGS MADE THE EARLIER ANSWERS WORTHLESS, AND THIS FILE FIXES BOTH.
 *
 * 1. THE GEOMETRY WAS INVENTED. `walk-ramp-physics.test.ts` builds stairs out of
 *    `BoxGeometry` with 0.55–0.6 m treads. Real SketchUp landmarks are not that, and a
 *    fixture that cannot express the asset's properties cannot falsify a bug in handling
 *    it — the same mistake that let the #704 collision-scale bug ship. These fixtures are
 *    extracted from the shipped GLBs by `scripts/extract-stair-fixtures.mjs`: real
 *    triangles, real risers (0.13–0.19 m), walls and railings included.
 *
 * 2. THE MEASUREMENT WAS NOT REPRODUCIBLE. Measuring live in the browser gave 16/24 on one
 *    run and 12/24 on the next for the SAME configuration, because state leaked between
 *    trials — mounted bike, residual velocity, the climb-rate peak. Small deltas were
 *    being read out of an instrument whose own noise was larger. Here EVERY trial builds a
 *    fresh `StaticWorld` and a fresh `EmbodiedController`, steps a fixed dt, and shares
 *    nothing. Same input, same number, every run.
 *
 * The ascent direction is derived from the geometry (bottom centroid → top centroid), not
 * guessed from a ring of approach angles — another source of the old variance.
 */

const DIR = join(process.cwd(), 'tests', 'fixtures', 'stairs');

interface Fixture {
  slug: string;
  source: string;
  stair: {
    kind?: 'stairs' | 'ramp';
    deg?: number;
    steps: number;
    riser: number;
    rise: number;
    run: number;
    baseY: number;
    topY: number;
    base: [number, number];
    ascend: [number, number];
  };
  triangleCount: number;
  positions: number[];
}

const files = readdirSync(DIR).filter(
  (f) => f.endsWith('.json') && f !== 'index.json'
);
const fixtures: Fixture[] = files.map(
  (f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Fixture
);

const STILL: EmbodiedInput = {
  forward: 0,
  right: 0,
  jump: false,
  sprint: false,
  crouch: false,
  prone: false,
  mount: false,
  yaw: 0,
};

/**
 * One trial = one fresh world + one fresh controller. Returns the height gained.
 *
 * `offsetDeg` nudges the approach so a flight is not judged on a single pixel-perfect
 * line — a staircase you can only climb from exactly one heading is still broken.
 */
interface Trial {
  /** Height gained from the settled start position. */
  gain: number;
  /** Was the body actually standing when the run began? */
  startedGrounded: boolean;
}

function climb(
  fx: Fixture,
  { riding, offsetDeg = 0 }: { riding: boolean; offsetDeg?: number }
): Trial {
  // Build a real Mesh and hand it to the real factory, so the trial runs through the same
  // `bakeMesh` path the game uses rather than a shortcut around it.
  const geo = new BufferGeometry();
  geo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(fx.positions), 3)
  );
  const mesh = new Mesh(geo, new MeshBasicMaterial());
  mesh.updateMatrixWorld(true);

  // THE FIXTURE IS A 10 m PATCH OF A BUILDING, NOT A WORLD. It contains the flight, its
  // walls and its railings — but no terrain, so without a floor the body spawns at the
  // foot of the stairs and falls forever. The first run of this harness reported exactly
  // 0.00 m on all four flights for that reason, which reads as "cannot climb" and is
  // really "never stood up". In the game there is terrain here.
  const floorTop = fx.stair.baseY - fx.stair.riser;
  const floor = new Mesh(new BoxGeometry(120, 2, 120), new MeshBasicMaterial());
  floor.position.set(fx.stair.base[0], floorTop - 1, fx.stair.base[1]);
  floor.updateMatrixWorld(true);

  const [ax, az] = fx.stair.ascend;
  const rad = (offsetDeg * Math.PI) / 180;
  const dx = ax * Math.cos(rad) - az * Math.sin(rad);
  const dz = ax * Math.sin(rad) + az * Math.cos(rad);

  // Start a little before the bottom step, on the flight's own axis.
  const START_BACK = 3;
  const sx = fx.stair.base[0] - dx * START_BACK;
  const sz = fx.stair.base[1] - dz * START_BACK;

  const ctrl = EmbodiedController.fromMeshes(
    [
      { mesh, surface: 'concrete' },
      { mesh: floor, surface: 'dirt' },
    ],
    { spawn: { x: sx, y: floorTop + 1.5, z: sz } }
  );

  try {
    // Forward basis is (-sin yaw, 0, -cos yaw), so this yaw walks along (dx, dz).
    const yaw = Math.atan2(-dx, -dz);
    const dt = 1 / 60;
    for (let i = 0; i < 45; i++) {
      ctrl.setInput({ ...STILL, yaw });
      ctrl.step(dt);
    }
    if (riding) {
      const p = ctrl.position;
      ctrl.parkBike(p.x, p.y, p.z);
      ctrl.setInput({ ...STILL, yaw, mount: true });
      ctrl.step(dt);
      ctrl.setInput({ ...STILL, yaw });
      ctrl.step(dt);
    }
    const startedGrounded = ctrl.grounded;
    const y0 = ctrl.position.y;
    let peak = y0;
    for (let i = 0; i < 300; i++) {
      ctrl.setInput({ ...STILL, forward: 1, yaw });
      ctrl.step(dt);
      peak = Math.max(peak, ctrl.position.y);
    }
    return { gain: peak - y0, startedGrounded };
  } finally {
    ctrl.dispose();
    geo.dispose();
  }
}

/**
 * Centre of the ramp's own largest sloped face.
 *
 * The fixture's `base` is the lowest VERTEX of that triangle — a corner. Starting there
 * puts the body at the very edge of a ~1 m wide slope, where missing it entirely is easy;
 * the first version of this test did exactly that and reported 0.00 m, which reads as
 * "cannot climb a 35 degree slope" and was really "stood next to it".
 */
function rampCentre(fx: Fixture): { x: number; y: number; z: number } {
  let best = { area: 0, x: 0, y: 0, z: 0 };
  const p = fx.positions;
  for (let i = 0; i < p.length; i += 9) {
    const e1x = p[i + 3] - p[i],
      e1y = p[i + 4] - p[i + 1],
      e1z = p[i + 5] - p[i + 2];
    const e2x = p[i + 6] - p[i],
      e2y = p[i + 7] - p[i + 1],
      e2z = p[i + 8] - p[i + 2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const L = Math.hypot(nx, ny, nz);
    if (L < 1e-9) continue;
    const up = ny / L;
    if (up < 0.2 || up > 0.98) continue; // sloped, not flat, not a wall
    const area = L / 2;
    if (area <= best.area) continue;
    best = {
      area,
      x: (p[i] + p[i + 3] + p[i + 6]) / 3,
      y: (p[i + 1] + p[i + 4] + p[i + 7]) / 3,
      z: (p[i + 2] + p[i + 5] + p[i + 8]) / 3,
    };
  }
  return { x: best.x, y: best.y, z: best.z };
}

/** Drive from an explicit start point — used to begin ON a ramp rather than approach it. */
function climbFrom(
  fx: Fixture,
  start: { x: number; y: number; z: number }
): number {
  const geo = new BufferGeometry();
  geo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(fx.positions), 3)
  );
  const mesh = new Mesh(geo, new MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  // A floor well below, so "fell off the slope" is distinguishable from "never moved":
  // without it a miss falls forever and reports exactly 0.00 m, same as being blocked.
  const floor = new Mesh(new BoxGeometry(200, 2, 200), new MeshBasicMaterial());
  floor.position.set(start.x, fx.stair.baseY - 6, start.z);
  floor.updateMatrixWorld(true);
  const ctrl = EmbodiedController.fromMeshes(
    [
      { mesh, surface: 'concrete' },
      { mesh: floor, surface: 'dirt' },
    ],
    { spawn: start }
  );
  try {
    const [dx, dz] = fx.stair.ascend;
    const yaw = Math.atan2(-dx, -dz);
    const dt = 1 / 60;
    for (let i = 0; i < 30; i++) {
      ctrl.setInput({ ...STILL, yaw });
      ctrl.step(dt);
    }
    const y0 = ctrl.position.y;
    let peak = y0;
    for (let i = 0; i < 300; i++) {
      ctrl.setInput({ ...STILL, forward: 1, yaw });
      ctrl.step(dt);
      peak = Math.max(peak, ctrl.position.y);
    }
    return peak - y0;
  } finally {
    ctrl.dispose();
    geo.dispose();
  }
}

describe('climbing the staircases the game actually ships (#705)', () => {
  it('the fixtures exist and contain real geometry', () => {
    // Without this, every assertion below could pass against an empty world. The
    // extractor already refuses to emit an empty fixture; this refuses to trust it.
    expect(
      fixtures.length,
      `no fixtures in ${DIR} — run extract-stair-fixtures.mjs`
    ).toBeGreaterThan(0);
    for (const fx of fixtures) {
      expect(fx.triangleCount, `${fx.slug} has no triangles`).toBeGreaterThan(
        50
      );
      expect(fx.positions.length).toBe(fx.triangleCount * 9);
      if (fx.stair.kind === 'ramp') {
        // Most "stairs" in this city are ramps: the abstraction pass flattens flights into
        // a single sloped face, which is why the level-scan finds only two real staircases
        // across 129 landmarks.
        expect(fx.stair.deg).toBeGreaterThan(5);
        expect(
          fx.stair.deg,
          `${fx.slug} is ${fx.stair.deg} deg — past the 50 deg walk limit, so being ` +
            `unable to climb it would be correct behaviour, not a bug`
        ).toBeLessThan(50);
      } else {
        expect(fx.stair.riser).toBeGreaterThan(0.05);
        expect(
          fx.stair.riser,
          `${fx.slug} riser ${fx.stair.riser} exceeds the 0.4 m step height — it is not a ` +
            `staircase and the fixture is mis-detected`
        ).toBeLessThan(0.4);
      }
    }
  });

  it('the harness is deterministic — the same trial twice gives the same number', () => {
    // This is the property the live browser measurement lacked, and the reason its
    // 16-vs-12 readings could not support any conclusion. Assert it, do not assume it.
    const fx = fixtures[0];
    const a = climb(fx, { riding: false });
    const b = climb(fx, { riding: false });
    expect(b.gain).toBe(a.gain);
  });

  // The ramp the owner actually reported, captured by name (#706): "I can't even approach
  // them, it's like an invisible glass wall."
  //
  // TWO SEPARATE QUESTIONS, and conflating them is how this stayed unexplained. (1) Can the
  // body walk a 35 deg slope at all? (2) Can it REACH that slope? Measured from outside,
  // the body climbs 0.00-0.42 m of a 3.10 m ramp — but a ray fired along the approach stops
  // 0.15 m short of the ramp foot against a front-facing wall roughly 1.2 m tall, which is
  // three times the 0.4 m step height. If the wall is real then being stopped is CORRECT
  // and only its invisibility is the bug, so this must not assert "the ramp must be
  // climbable from outside" — that would encode an expectation I have not established.
  const ramp = fixtures.find((f) => f.stair.kind === 'ramp');
  if (ramp) {
    it(`${ramp.slug} — the ${ramp.stair.deg} deg ramp is walkable once you are ON it`, () => {
      // Start the body ON the slope, past whatever guards the foot. This isolates the
      // physics question from the geometry question: if this passes, slope handling is
      // fine and the problem is purely that the ramp cannot be reached.
      const c = rampCentre(ramp);
      const gain = climbFrom(ramp, { x: c.x, y: c.y + 0.6, z: c.z });
      expect(
        gain,
        `standing on a ${ramp.stair.deg} deg slope (limit is 50 deg) the body climbed ` +
          `${gain.toFixed(2)} m of ${ramp.stair.rise.toFixed(2)} m`
      ).toBeGreaterThan(ramp.stair.rise * 0.5);
    });

    it(`${ramp.slug} — approaching from outside is blocked (the reported symptom)`, () => {
      // A characterisation test, not a wish: it records the measured fact so a change in
      // either the geometry or the physics shows up here instead of silently.
      const trials = [-15, 0, 15].map((d) =>
        climb(ramp, { riding: false, offsetDeg: d })
      );
      const best = Math.max(...trials.map((t) => t.gain));
      expect(
        best,
        `the approach now reaches ${best.toFixed(2)} m of the ${ramp.stair.rise.toFixed(2)} m ` +
          `ramp. If this went UP, the blocker moved or was removed — re-read the finding in ` +
          `#713 before changing this number`
      ).toBeLessThan(ramp.stair.rise * 0.5);
    });
  }

  for (const fx of fixtures.filter((f) => f.stair.kind !== 'ramp')) {
    const target = fx.stair.rise * 0.7;
    it(`${fx.slug} — ${fx.stair.steps} steps, ${fx.stair.riser.toFixed(3)} m risers, on foot`, () => {
      const trials = [-12, 0, 12].map((d) =>
        climb(fx, { riding: false, offsetDeg: d })
      );
      // A body that never stood up cannot be said to have failed to climb. Without this
      // the missing-floor bug read as "cannot climb" on all four flights.
      expect(
        trials.some((t) => t.startedGrounded),
        'the body never reached the ground before walking — the trial is invalid'
      ).toBe(true);
      const gains = trials.map((t) => t.gain);
      const best = Math.max(...gains);
      expect(
        best,
        `climbed ${best.toFixed(2)} m of a ${fx.stair.rise.toFixed(2)} m flight ` +
          `(${fx.source}); per-approach: ${gains.map((g) => g.toFixed(2)).join(', ')}`
      ).toBeGreaterThan(target);
    });
  }
});
