import { describe, it, expect } from 'vitest';
import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { StaticWorld } from '@/lib/cod/bvh';
import { EmbodiedController } from '@/lib/cod/player/EmbodiedController';
import type { EmbodiedInput } from '@/lib/cod/player/EmbodiedController';

/**
 * Landmark GLBs and bridges must be solid in Walk mode (#702).
 *
 * WHAT WAS WRONG, TWICE.
 *
 * (1) `EmbodiedController.fromMeshes` was handed exactly two meshes — the merged terrain
 *     and the merged massing boxes. Every `models.json` landmark and every bridge is a
 *     separate GLB rendered by `WarehouseModels`, and none was ever baked into the static
 *     world. They drew, so they looked solid; nothing tested them, so you walked through.
 *
 * (2) The first fix for (1) baked them at the WRONG SCALE, which is worse than not baking
 *     them at all. The shipped GLBs are `KHR_mesh_quantization` + `EXT_meshopt_compression`:
 *     POSITION is Int16 with `normalized: true`, so the true value is `raw / 32767` and the
 *     glTF node scale is calibrated for that -1..1 range. `bakeMesh` read the raw array, so
 *     every collision shell landed 32767x too large and far outside the city — no collision
 *     where the buildings are, and the full triangle cost paid anyway.
 *
 * WHY THE FIRST VERSION OF THIS TEST MISSED (2). It built its wall from `BoxGeometry`:
 * Float32, un-normalized, tightly packed — the one geometry format that cannot reproduce
 * the bug. It was mutation-checked and still proved nothing about the real assets. So the
 * wall fixtures below now come in all three flavours the app can hand the baker, and the
 * quantized one mirrors the shipped accessors exactly.
 *
 * WHY THE TESTS ARE PHYSICAL. Asserting "addMesh was called 129 times" would pass with the
 * geometry in the wrong frame, the wrong scale, or never built into the BVH — which is
 * precisely how (2) shipped. These drive the real controller into a real wall and read the
 * position back.
 */

const WALL_X = 6;
/** Wall centre 6, 1 m thick -> face at 5.5. Capsule radius 0.4 keeps you short of it. */
const WALL_FACE = 5.5;

/** A big flat slab at y≈0 so the controller has a floor to stand on. */
function ground(): Mesh {
  const m = new Mesh(new BoxGeometry(200, 1, 200), new MeshBasicMaterial());
  m.position.set(0, -0.5, 0);
  m.updateMatrixWorld(true);
  return m;
}

function wrap(wall: Mesh): Group {
  // A Group, exactly how WarehouseModels hands its loaded model over (never a bare Mesh).
  const g = new Group();
  g.add(wall);
  g.updateMatrixWorld(true);
  return g;
}

/** Plain Float32, tightly packed — a hand-made or unquantized GLB. */
function floatWall(): Group {
  const wall = new Mesh(new BoxGeometry(1, 8, 40), new MeshBasicMaterial());
  wall.position.set(WALL_X, 4, 0);
  return wrap(wall);
}

/**
 * The shape the app actually ships: Int16 positions with `normalized: true`, and the
 * dequantization scale folded into the node transform — exactly what gltfpack emits and
 * what the sampled `chatt` landmarks carry (measured: `componentType: short`,
 * `normalized: true`, `min/max` at ±32767, node scale 134.109…).
 */
function quantizedWall(): Group {
  const src = new BoxGeometry(1, 8, 40);
  const p = src.getAttribute('position').array as Float32Array;
  let m = 0;
  for (const v of p) m = Math.max(m, Math.abs(v));

  const raw = new Int16Array(p.length);
  for (let i = 0; i < p.length; i++) raw[i] = Math.round((p[i] / m) * 32767);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(raw, 3, true)); // normalized
  if (src.index) geo.setIndex(src.index);

  const wall = new Mesh(geo, new MeshBasicMaterial());
  wall.position.set(WALL_X, 4, 0);
  wall.scale.setScalar(m); // the node scale that undoes the quantization
  return wrap(wall);
}

/** Meshopt decoding produces interleaved buffers; `itemSize` is not the stride there. */
function interleavedWall(): Group {
  const src = new BoxGeometry(1, 8, 40);
  const p = src.getAttribute('position').array as Float32Array;
  let m = 0;
  for (const v of p) m = Math.max(m, Math.abs(v));

  const count = p.length / 3;
  const STRIDE = 4; // xyz + one padding element, as a packed vertex layout would have
  const inter = new Int16Array(count * STRIDE);
  for (let i = 0; i < count; i++) {
    inter[i * STRIDE] = Math.round((p[i * 3] / m) * 32767);
    inter[i * STRIDE + 1] = Math.round((p[i * 3 + 1] / m) * 32767);
    inter[i * STRIDE + 2] = Math.round((p[i * 3 + 2] / m) * 32767);
    inter[i * STRIDE + 3] = 0;
  }

  const geo = new BufferGeometry();
  geo.setAttribute(
    'position',
    new InterleavedBufferAttribute(
      new InterleavedBuffer(inter, STRIDE),
      3,
      0,
      true
    )
  );
  if (src.index) geo.setIndex(src.index);

  const wall = new Mesh(geo, new MeshBasicMaterial());
  wall.position.set(WALL_X, 4, 0);
  wall.scale.setScalar(m);
  return wrap(wall);
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

/** Walk due +X for `seconds`, then report where we ended up. */
function walkEast(ctrl: EmbodiedController, seconds: number): number {
  // yaw = -PI/2 faces +X in this basis; drive forward, not strafe, so the run uses the
  // same path the player does.
  ctrl.setInput({ ...STILL, forward: 1, yaw: -Math.PI / 2 });
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) ctrl.step(dt);
  ctrl.setInput(STILL);
  return ctrl.position.x;
}

function fresh(): EmbodiedController {
  const ctrl = EmbodiedController.fromMeshes(
    [{ mesh: ground(), surface: 'concrete' }],
    { spawn: { x: 0, y: 1, z: 0 } }
  );
  ctrl.teleport(0, 1, 0);
  return ctrl;
}

describe('landmark/bridge GLB collision (#702)', () => {
  it('an open floor lets you walk east — the control', () => {
    // Without this, "you stopped" below proves nothing: you might never have moved.
    const ctrl = fresh();
    const x = walkEast(ctrl, 4);
    expect(
      x,
      'the harness itself is broken — the player did not move on an empty floor'
    ).toBeGreaterThan(5);
    ctrl.dispose();
  });

  // Every geometry format the baker can be handed. The quantized and interleaved rows are
  // the ones that matter: they are what `chatt` actually ships, and the Float32 row alone
  // is what let the scale bug through review.
  for (const [label, make] of [
    ['float32', floatWall],
    ['quantized Int16 (the shipped format)', quantizedWall],
    ['interleaved quantized (meshopt output)', interleavedWall],
  ] as const) {
    it(`a committed ${label} GLB group stops you`, () => {
      const ctrl = fresh();
      const ids = ctrl.addCollider(make(), 'concrete');
      expect(ids.length, 'no mesh was found inside the Group').toBe(1);
      ctrl.commitColliders();

      const x = walkEast(ctrl, 4);
      expect(
        x,
        `walked to x=${x.toFixed(2)} — the wall at x=${WALL_FACE} was not solid, which is ` +
          `exactly the reported "I can ride straight through the buildings"`
      ).toBeLessThan(WALL_FACE);
      ctrl.dispose();
    });

    it(`a ${label} collider is baked where THREE draws it`, () => {
      // The scale bug did not make collision ABSENT, it made it land somewhere else — so
      // "did the world grow?" proves nothing. Bake the wall into a world of its own (no
      // floor to widen the bounds) and compare against the box THREE computes for the
      // same object. A scale error of any magnitude fails here, in either direction.
      const world = new StaticWorld();
      const group = make();
      group.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) world.addMesh(m, 'concrete');
      });
      world.build();

      const expected = new Box3().setFromObject(group);
      const a = world.aabb;
      for (const [axis, got, want] of [
        ['x', a.minx, expected.min.x],
        ['y', a.miny, expected.min.y],
        ['z', a.minz, expected.min.z],
        ['x', a.maxx, expected.max.x],
        ['y', a.maxy, expected.max.y],
        ['z', a.maxz, expected.max.z],
      ] as const) {
        expect(
          got,
          `collision bounds ${axis}=${got.toFixed(2)} m but THREE draws the wall at ` +
            `${axis}=${want.toFixed(2)} m — the collider is baked at the wrong scale ` +
            `(ratio ${(got / (want || 1)).toFixed(1)}x)`
        ).toBeCloseTo(want, 1);
      }
      world.dispose();
    });
  }

  it('addCollider alone does NOT build — the batching contract', () => {
    // 129 models registering in a burst must cost ONE BVH build, not 129. The split is
    // only safe because every caller commits; this pins the split so a "helpful" build
    // inside addCollider cannot creep back in unnoticed.
    const ctrl = fresh();
    ctrl.addCollider(quantizedWall(), 'concrete'); // deliberately NOT committed
    const x = walkEast(ctrl, 4);
    expect(
      x,
      'uncommitted geometry already collides — addCollider is building internally, ' +
        'which reintroduces the 129-rebuild stall'
    ).toBeGreaterThan(WALL_FACE);
    ctrl.dispose();
  });

  it('N registrations cost exactly ONE build', () => {
    // The frame-drag regression in one assertion. `StaticWorld.version` increments once
    // per build(), so this counts rebuilds directly rather than trusting the schedule.
    const ctrl = fresh();
    const before = ctrl.world.version;
    for (let i = 0; i < 20; i++) ctrl.addCollider(quantizedWall(), 'concrete');
    expect(
      ctrl.world.version - before,
      '20 registrations triggered rebuilds before any commit'
    ).toBe(0);
    ctrl.commitColliders();
    expect(
      ctrl.world.version - before,
      'the batch cost more than one build'
    ).toBe(1);
    ctrl.dispose();
  });

  it('removing a collider makes the space walkable again', () => {
    // An unmounted model must not leave an invisible wall behind.
    const ctrl = fresh();
    const ids = ctrl.addCollider(quantizedWall(), 'concrete');
    ctrl.commitColliders();
    expect(walkEast(ctrl, 4)).toBeLessThan(WALL_FACE);

    ctrl.teleport(0, 1, 0);
    ctrl.removeColliders(ids);
    ctrl.commitColliders(); // removal batches like addition; the caller commits
    expect(
      walkEast(ctrl, 4),
      'the model was removed but its collision stayed — an invisible wall'
    ).toBeGreaterThan(WALL_FACE);
    ctrl.dispose();
  });
});
