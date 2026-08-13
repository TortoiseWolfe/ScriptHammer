import { describe, it, expect } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { EmbodiedController } from '@/lib/cod/player/EmbodiedController';
import type { EmbodiedInput } from '@/lib/cod/player/EmbodiedController';

/**
 * The body must have a trajectory, not just a terrain-follow (#705).
 *
 * REPORTED: "if I do find an impromptu ramp the physics feel quantum — as soon as I clear
 * the end of the surface the bike snaps to nearest surface level, instead of finding a
 * trajectory arc and letting the bike land naturally."
 *
 * That is four defects in one loop, and none of them is in the collision work:
 *
 *  1. `velocity.y` RUNS AWAY while grounded. Gravity is added every fixed step, but the
 *     only thing that clears it is `_clipVelocity`, which runs inside `_slide` when a
 *     plane is hit — and the grounded path takes the step-offset branch, whose `_slide`
 *     is HORIZONTAL ONLY. On open ground nothing is hit, so nothing clips, and there is
 *     no terminal-velocity clamp anywhere. Ride 10 s and you are carrying ~-220 m/s.
 *     Clear a lip and that entire accumulated velocity lands in one step: not a snap, a
 *     shot at the ground.
 *  2. NOTHING EVER GIVES YOU UPWARD VELOCITY. Height on a ramp is gained by the
 *     step-offset geometry (lift, slide, drop), never by `velocity.y`, so at the lip the
 *     vertical velocity is zero. There is no arc to have.
 *  3. THE BIKE BRAKES AGAINST THIN AIR — the accel/brake blend runs regardless of
 *     contact, so releasing the throttle mid-flight decelerates you horizontally.
 *  4. Jump was disabled entirely while riding.
 *
 * These tests read the numbers the mechanism produces — height, airborne frames, apex,
 * landing distance — because "quantum" is a description of a trajectory, and only a
 * trajectory can falsify it.
 */

const MAT = new MeshBasicMaterial();

function slab(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number
): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), MAT);
  m.position.set(x, y, z);
  m.updateMatrixWorld(true);
  return m;
}

/** Flat floor with its top surface at y = 0. */
function ground(size = 400): Mesh {
  return slab(size, 1, size, 0, -0.5, 0);
}

/**
 * An inclined plane whose top surface runs from (startX, 0) to (startX+length, rise).
 * A rotated slab, so the collision surface is a real sloped plane rather than a stack.
 */
function ramp(startX: number, length: number, rise: number, width = 12): Mesh {
  const angle = Math.atan2(rise, length);
  const slopeLen = Math.hypot(rise, length);
  const t = 1; // thickness
  const m = new Mesh(new BoxGeometry(slopeLen, t, width), MAT);
  m.rotation.z = angle; // local +x rises with world +x
  // Offset the centre below the top face, along the slab's own -y.
  m.position.set(
    startX + length / 2 + (t / 2) * Math.sin(angle),
    rise / 2 - (t / 2) * Math.cos(angle),
    0
  );
  m.updateMatrixWorld(true);
  return m;
}

/** A flight of discrete treads — the case a ground-normal scheme cannot launch off. */
function stairs(
  startX: number,
  steps: number,
  riser: number,
  tread: number,
  width = 12
): Mesh[] {
  const out: Mesh[] = [];
  for (let i = 0; i < steps; i++) {
    const top = (i + 1) * riser;
    out.push(
      slab(tread, top, width, startX + i * tread + tread / 2, top / 2, 0)
    );
  }
  return out;
}

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
/** yaw = -PI/2 faces +X in this basis. */
const EAST = -Math.PI / 2;

function build(extra: Mesh[] = []): EmbodiedController {
  return EmbodiedController.fromMeshes(
    [
      { mesh: ground(), surface: 'dirt' },
      ...extra.map((mesh) => ({ mesh, surface: 'concrete' })),
    ],
    { spawn: { x: 0, y: 0.2, z: 0 } }
  );
}

/** Let the body fall the spawn offset and come to rest before measuring anything. */
function settle(ctrl: EmbodiedController): void {
  for (let i = 0; i < 60 && !ctrl.grounded; i++) ctrl.step(1 / 60);
  for (let i = 0; i < 10; i++) ctrl.step(1 / 60);
}

/** Mount the parked bike at the player's feet (edge-triggered, so press then release). */
function mount(ctrl: EmbodiedController): void {
  settle(ctrl); // spawn is 0.2 m above the floor; measuring mid-fall proves nothing
  const p = ctrl.position;
  ctrl.parkBike(p.x, p.y, p.z);
  ctrl.setInput({ ...STILL, mount: true, yaw: EAST });
  ctrl.step(1 / 60);
  ctrl.setInput({ ...STILL, yaw: EAST });
  ctrl.step(1 / 60);
}

interface Flight {
  /** Peak height reached at ANY point, grounded or not — for climbing. */
  maxY: number;
  /** Peak height reached after leaving the launch surface. */
  apexY: number;
  /** Consecutive frames with no ground contact. */
  airborneFrames: number;
  /** Where the body finally came to rest. */
  endX: number;
  endY: number;
  /** X at the moment it first left the ground. */
  takeoffX: number;
  takeoffY: number;
  maxFallSpeed: number;
}

/** Drive east for `seconds`, recording the flight. */
function driveEast(
  ctrl: EmbodiedController,
  seconds: number,
  input: Partial<EmbodiedInput> = {}
): Flight {
  const dt = 1 / 60;
  const f: Flight = {
    maxY: -Infinity,
    apexY: -Infinity,
    airborneFrames: 0,
    endX: 0,
    endY: 0,
    takeoffX: NaN,
    takeoffY: NaN,
    maxFallSpeed: 0,
  };
  let wasGrounded = true;
  let run = 0;
  for (let t = 0; t < seconds; t += dt) {
    ctrl.setInput({ ...STILL, forward: 1, yaw: EAST, ...input });
    ctrl.step(dt);
    if (ctrl.position.y > f.maxY) f.maxY = ctrl.position.y;
    const g = ctrl.grounded;
    if (!g) {
      run++;
      if (wasGrounded) {
        f.takeoffX = ctrl.position.x;
        f.takeoffY = ctrl.position.y;
      }
      if (ctrl.position.y > f.apexY) f.apexY = ctrl.position.y;
      f.maxFallSpeed = Math.max(f.maxFallSpeed, -ctrl.verticalVelocity);
    } else {
      if (run > f.airborneFrames) f.airborneFrames = run;
      run = 0;
    }
    wasGrounded = g;
  }
  if (run > f.airborneFrames) f.airborneFrames = run;
  f.endX = ctrl.position.x;
  f.endY = ctrl.position.y;
  return f;
}

describe('trajectory physics (#705)', () => {
  it('vertical velocity stays bounded while riding flat ground', () => {
    // DEFECT 1, and the cause of the "snap". Nothing clips velocity.y on the grounded
    // step-offset path, so it integrates gravity forever. Whatever has accumulated is
    // applied in full the instant you leave a surface.
    const ctrl = build();
    mount(ctrl);
    driveEast(ctrl, 10);
    const vy = ctrl.verticalVelocity;
    expect(
      Math.abs(vy),
      `after 10 s on FLAT ground the body carries vy=${vy.toFixed(1)} m/s. Anything past ` +
        `a few m/s is stored energy that fires you at the ground the moment you clear a lip`
    ).toBeLessThan(5);
    ctrl.dispose();
  });

  it('a ramp launches the bike into an arc that lands past the lip', () => {
    // DEFECT 2. The headline: ride up a ramp, leave it, and fly.
    const LIP_X = 30;
    const RISE = 3;
    const ctrl = build([ramp(10, LIP_X - 10, RISE)]);
    mount(ctrl);
    const f = driveEast(ctrl, 12);

    expect(
      f.takeoffX,
      'the body never left the ground at all — it walked off the lip and dropped'
    ).toBeGreaterThan(LIP_X - 3);
    expect(
      f.airborneFrames,
      `only ${f.airborneFrames} airborne frames — that is a droop off the edge, not an arc`
    ).toBeGreaterThan(12);
    expect(
      f.apexY,
      `apex ${f.apexY.toFixed(2)} m did not clear the ${RISE} m lip — no upward velocity ` +
        `was carried off the ramp`
    ).toBeGreaterThan(RISE);
    expect(
      f.endX,
      `landed at x=${f.endX.toFixed(1)}, barely past the lip at ${LIP_X}`
    ).toBeGreaterThan(LIP_X + 3);
    // And it must come to rest ON the floor, not through it.
    expect(f.endY).toBeGreaterThan(-0.2);
    expect(f.endY).toBeLessThan(0.6);
    ctrl.dispose();
  });

  it('a flight of stairs works as a ramp', () => {
    // The case a ground-normal projection scheme would silently fail: every tread has
    // ny = 1, so "project velocity onto the ground plane" yields zero launch. The owner
    // asked for exactly this — "jump the bike off of them like a ramp".
    const STEPS = 14;
    const RISER = 0.22;
    const TREAD = 0.55;
    const topX = 10 + STEPS * TREAD;
    const ctrl = build(stairs(10, STEPS, RISER, TREAD));
    mount(ctrl);
    const f = driveEast(ctrl, 12);

    expect(
      f.apexY,
      `apex ${f.apexY.toFixed(2)} m against a ${(STEPS * RISER).toFixed(2)} m flight — ` +
        `the bike never got airborne off the top step`
    ).toBeGreaterThan(STEPS * RISER);
    expect(f.airborneFrames).toBeGreaterThan(8);
    expect(
      f.endX,
      'the bike did not travel past the top of the stairs'
    ).toBeGreaterThan(topX + 1);
    ctrl.dispose();
  });

  it('climbs stairs on foot', () => {
    // Not a ramp — just getting up them at all, which defect 1 also broke: `want` grows
    // with the runaway velocity, so the post-slide drop reaches further and further down
    // and yanks you back off the tread you just climbed.
    const STEPS = 10;
    const RISER = 0.18;
    const ctrl = build(stairs(6, STEPS, RISER, 0.6));
    const f = driveEast(ctrl, 10); // on foot, no bike
    // MAX height, not END height: after topping out the walker keeps going east and
    // steps off the far side back down to the floor, so `endY` is ~0 whether or not it
    // ever climbed. Reading the convenient number would have made this pass vacuously.
    expect(
      f.maxY,
      `never got above y=${f.maxY.toFixed(2)} walking at a ${(STEPS * RISER).toFixed(2)} m ` +
        `flight of ${RISER} m risers — stepHeight is 0.4 m, so these are climbable`
    ).toBeGreaterThan(STEPS * RISER * 0.7);
    ctrl.dispose();
  });

  it('does not brake against thin air', () => {
    // DEFECT 3: the accel/brake blend ran regardless of contact, so releasing the
    // throttle mid-flight decelerated the bike horizontally and collapsed the arc.
    const ctrl = build([ramp(10, 20, 3)]);
    mount(ctrl);
    const dt = 1 / 60;

    // Ride up the ramp only until the wheels leave it — driving a fixed number of
    // seconds first would land the bike 30 m down the road and measure nothing.
    let launched = false;
    for (let i = 0; i < 600 && !launched; i++) {
      ctrl.setInput({ ...STILL, forward: 1, yaw: EAST });
      ctrl.step(dt);
      launched = !ctrl.grounded && ctrl.position.y > 2;
    }
    // Guard against a vacuous pass: before the fix the bike never left the lip at all,
    // so a conditional body simply never ran and the test went green proving nothing.
    expect(
      launched,
      'the bike never got airborne, so nothing was measured'
    ).toBe(true);

    const speedAtLaunch = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);
    let frames = 0;
    let speedInFlight = speedAtLaunch;
    while (!ctrl.grounded && frames < 180) {
      ctrl.setInput({ ...STILL, forward: 0, yaw: EAST }); // throttle released mid-air
      ctrl.step(dt);
      frames++;
      if (!ctrl.grounded)
        speedInFlight = Math.hypot(ctrl.velocity.x, ctrl.velocity.z);
    }
    expect(
      frames,
      'came down again immediately — no flight to measure'
    ).toBeGreaterThan(5);
    expect(
      speedInFlight,
      `horizontal speed fell ${speedAtLaunch.toFixed(2)} -> ${speedInFlight.toFixed(2)} m/s ` +
        `over ${frames} airborne frames — the bike is braking against nothing`
    ).toBeGreaterThan(speedAtLaunch * 0.85);
    ctrl.dispose();
  });

  it('the bike can hop', () => {
    // DEFECT 4: jump was gated on `!riding_`, so there was no way to pop off a stair edge.
    const ctrl = build();
    mount(ctrl);
    const y0 = ctrl.position.y;
    const dt = 1 / 60;
    let apex = y0;
    for (let i = 0; i < 60; i++) {
      ctrl.setInput({ ...STILL, forward: 1, jump: i < 2, yaw: EAST });
      ctrl.step(dt);
      apex = Math.max(apex, ctrl.position.y);
    }
    // Pin the HEIGHT, not merely "it moved". The first version of this test cleared its
    // own bar at 0.37 m — the mechanism fired correctly and was still invisible from a
    // 1.5 m saddle while moving, which is indistinguishable from broken to the person
    // riding it. A hop you cannot see is not a hop, so the number IS the requirement.
    const rise = apex - y0;
    expect(
      rise,
      `hop reached ${rise.toFixed(2)} m; target ~0.6 m (v²/2g at 5.15 m/s, g = 22)`
    ).toBeGreaterThan(0.5);
    expect(
      rise,
      'the hop has grown into a jump — this is a bicycle'
    ).toBeLessThan(0.8);
    ctrl.dispose();
  });

  it('walking on flat ground is unchanged', () => {
    // Regression guard: none of the above may alter ordinary locomotion.
    const ctrl = build();
    const f = driveEast(ctrl, 3);
    // 3.3 m/s walk speed over 3 s, minus spin-up.
    expect(f.endX).toBeGreaterThan(8);
    expect(f.endX).toBeLessThan(11);
    expect(
      Math.abs(f.endY),
      'the walker left the floor on flat ground'
    ).toBeLessThan(0.2);
    ctrl.dispose();
  });
});
