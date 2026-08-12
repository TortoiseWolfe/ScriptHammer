import { describe, it, expect } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { EmbodiedController } from '@/lib/cod/player/EmbodiedController';
import type { EmbodiedInput } from '@/lib/cod/player/EmbodiedController';

/**
 * Landmark GLBs and bridges must be solid in Walk mode (#702).
 *
 * WHAT WAS WRONG. `EmbodiedController.fromMeshes` was handed exactly two meshes —
 * the merged terrain and the merged massing boxes. Every `models.json` landmark and
 * every bridge is a separate GLB rendered by `WarehouseModels`, and none of them
 * was ever baked into the static world. They drew, so they looked solid; nothing
 * ever tested them, so you walked straight through.
 *
 * WHY THE TEST IS PHYSICAL. Asserting "addMesh was called 129 times" would pass with
 * the geometry in the wrong frame, the wrong scale, or never built into the BVH.
 * The only claim worth pinning is the one the owner reported: walk at a wall and
 * stop. So this drives the real controller into a real box and reads the position.
 *
 * IT ALSO PINS THE BATCHING. `addCollider` deliberately does NOT build the BVH —
 * `chatt` registers 129 models in a burst, and building per model is 129 rebuilds
 * over a growing triangle set (~261k triangles across all nodes) at exactly the
 * moment the city pops in. The "not solid until committed" case below is what keeps
 * that split honest: if someone re-adds a build to `addCollider` for convenience,
 * that test goes green-in-the-wrong-way and the pair of them reads as contradictory
 * — which is the point. Delete neither.
 */

/** A big flat slab at y≈0 so the controller has a floor to stand on. */
function ground(): Mesh {
  const m = new Mesh(new BoxGeometry(200, 1, 200), new MeshBasicMaterial());
  m.position.set(0, -0.5, 0);
  m.updateMatrixWorld(true);
  return m;
}

/** A GLB stand-in: a Group wrapping a wall mesh, exactly how WarehouseModels
 *  hands its loaded model over (a Group, never a bare Mesh). */
function wallGroup(x: number): Group {
  const g = new Group();
  const wall = new Mesh(new BoxGeometry(1, 8, 40), new MeshBasicMaterial());
  wall.position.set(x, 4, 0);
  g.add(wall);
  g.updateMatrixWorld(true);
  return g;
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
  // yaw = -PI/2 faces +X in this basis; drive forward, not strafe, so the run
  // uses the same path the player does.
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

  it('a committed GLB group stops you — the reported bug', () => {
    const ctrl = fresh();
    const ids = ctrl.addCollider(wallGroup(6), 'concrete');
    expect(ids.length, 'no mesh was found inside the Group').toBe(1);
    ctrl.commitColliders();

    const x = walkEast(ctrl, 4);
    // Wall face is at x=5.5 (centre 6, 1m thick); the capsule radius is 0.4, so
    // stopping means "did not reach the wall", not "did not reach x=6".
    expect(
      x,
      `walked to x=${x.toFixed(2)} — the wall at x=5.5 was not solid, which is ` +
        `exactly the reported "I can walk through the bridges"`
    ).toBeLessThan(5.5);
    ctrl.dispose();
  });

  it('addCollider alone does NOT build — the batching contract', () => {
    // 129 models registering in a burst must cost ONE BVH build, not 129. The
    // split is only safe because every caller commits; this pins the split so a
    // "helpful" build inside addCollider cannot creep back in unnoticed.
    const ctrl = fresh();
    ctrl.addCollider(wallGroup(6), 'concrete'); // deliberately NOT committed
    const x = walkEast(ctrl, 4);
    expect(
      x,
      'uncommitted geometry already collides — addCollider is building internally, ' +
        'which reintroduces the 129-rebuild stall'
    ).toBeGreaterThan(5.5);
    ctrl.dispose();
  });

  it('removing a collider makes the space walkable again', () => {
    // An unmounted model must not leave an invisible wall behind.
    const ctrl = fresh();
    const ids = ctrl.addCollider(wallGroup(6), 'concrete');
    ctrl.commitColliders();
    expect(walkEast(ctrl, 4)).toBeLessThan(5.5);

    ctrl.teleport(0, 1, 0);
    ctrl.removeColliders(ids);
    expect(
      walkEast(ctrl, 4),
      'the model was removed but its collision stayed — an invisible wall'
    ).toBeGreaterThan(5.5);
    ctrl.dispose();
  });
});
