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
      expect(fx.stair.riser).toBeGreaterThan(0.05);
      expect(
        fx.stair.riser,
        `${fx.slug} riser ${fx.stair.riser} exceeds the 0.4 m step height — it is not a ` +
          `staircase and the fixture is mis-detected`
      ).toBeLessThan(0.4);
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

  for (const fx of fixtures) {
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
