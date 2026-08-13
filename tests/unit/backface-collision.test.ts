import { describe, it, expect } from 'vitest';
import {
  BoxGeometry,
  Group,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { EmbodiedController } from '@/lib/cod/player/EmbodiedController';
import type { EmbodiedInput } from '@/lib/cod/player/EmbodiedController';

/**
 * Single-sided triangle collision (#713).
 *
 * WHY IT EXISTS. The twin's landmark GLBs have inconsistent winding — 43% of one model's
 * faces point inward. `WarehouseModels` renders `FrontSide`, so those faces are culled and
 * invisible, while `addCollider` bakes them anyway because collision does not care about
 * winding. The result is a wall you can see through and cannot walk through.
 *
 * WHY THIS SHAPE. Not a heuristic of mine: it is what production engines do. PhysX culls
 * back-face hits by default — those "where the triangle's outward-facing normal has a
 * positive dot product with the ray direction" — unless `eDOUBLE_SIDED` is set, and Godot's
 * `ConcavePolygonShape3D` ships `backface_collision = false`. An earlier attempt culled
 * inward-facing triangles at BAKE time using a model-centroid guess; that was the wrong
 * shape, and it would have deleted any ramp sitting below the model's centroid.
 *
 * OFF BY DEFAULT, because it is only correct where walls are consistently wound.
 *
 * THE TEST DERIVES THE WINDING RATHER THAN ASSERTING IT. A first draft hard-coded which
 * vertex order faced the walker and got it backwards, so the run "failed" while the code
 * was right. Here the wall's actual normal is measured first and the expectation follows
 * from it — the test cannot be wrong about the thing it is testing.
 */

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
/** yaw = -PI/2 walks toward +X. */
const EAST = -Math.PI / 2;
const WALL_X = 5;

/** A wall across the path at x=5, built from an explicit vertex order. */
function wallMesh(order: 'abc' | 'acb'): { mesh: Mesh; normalX: number } {
  const a = [WALL_X, 0, -10];
  const b = [WALL_X, 0, 10];
  const c = [WALL_X, 4, 10];
  const d = [WALL_X, 4, -10];
  const t =
    order === 'abc'
      ? [...a, ...b, ...c, ...a, ...c, ...d]
      : [...a, ...c, ...b, ...a, ...d, ...c];
  // Measure the normal the same way the BVH will: (b-a) x (c-a).
  const e1 = [t[3] - t[0], t[4] - t[1], t[5] - t[2]];
  const e2 = [t[6] - t[0], t[7] - t[1], t[8] - t[2]];
  const nx = e1[1] * e2[2] - e1[2] * e2[1];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(t), 3));
  const mesh = new Mesh(g, new MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  return { mesh, normalX: nx };
}

function walkEastInto(order: 'abc' | 'acb', cullBackfaces: boolean): number {
  const floor = new Mesh(new BoxGeometry(200, 1, 200), new MeshBasicMaterial());
  floor.position.set(0, -0.5, 0);
  floor.updateMatrixWorld(true);
  // The floor goes through `fromMeshes` and stays DOUBLE-sided, exactly as the twin's
  // terrain does; the wall goes through `addCollider`, which marks it SINGLE_SIDED, as the
  // landmark GLBs are. That scoping is the safety property: no ground triangle can ever be
  // culled into a hole, however it happens to be wound.
  const ctrl = EmbodiedController.fromMeshes(
    [{ mesh: floor, surface: 'dirt' }],
    { spawn: { x: 0, y: 0.2, z: 0 }, cullBackfaces }
  );
  const wall = new Group();
  wall.add(wallMesh(order).mesh);
  wall.updateMatrixWorld(true);
  ctrl.addCollider(wall, 'concrete');
  ctrl.commitColliders();
  try {
    for (let i = 0; i < 40; i++) {
      ctrl.setInput({ ...STILL, yaw: EAST });
      ctrl.step(1 / 60);
    }
    for (let i = 0; i < 300; i++) {
      ctrl.setInput({ ...STILL, forward: 1, yaw: EAST });
      ctrl.step(1 / 60);
    }
    return ctrl.position.x;
  } finally {
    ctrl.dispose();
  }
}

describe('single-sided collision (#713)', () => {
  // Walking toward +X: the face we MEET is the one whose normal points back at us (-X).
  const facingUs = wallMesh('abc').normalX < 0 ? 'abc' : 'acb';
  const away = facingUs === 'abc' ? 'acb' : 'abc';

  it('a wall facing you always stops you, culling or not', () => {
    expect(walkEastInto(facingUs, false)).toBeLessThan(WALL_X);
    expect(
      walkEastInto(facingUs, true),
      'culling let you through a wall whose front face you were walking into — the ' +
        'rule has the sign backwards and every building just became hollow'
    ).toBeLessThan(WALL_X);
  });

  it('a wall facing away blocks today, and is passed through when culling is on', () => {
    // This is the invisible-glass-wall case: the renderer culls this face, so you never
    // saw it, and collision stopped you anyway.
    expect(
      walkEastInto(away, false),
      'the reversed wall should still block with culling OFF — otherwise this test is ' +
        'not measuring the flag at all'
    ).toBeLessThan(WALL_X);
    expect(
      walkEastInto(away, true),
      'culling is on and a face pointing away from you still blocked you'
    ).toBeGreaterThan(WALL_X);
  });

  it('is off unless asked for', () => {
    // The demo and every existing world must be untouched by this.
    const ctrl = EmbodiedController.fromMeshes([]);
    expect(ctrl.world.cullBackfaces).toBe(false);
    ctrl.dispose();
  });

  it('geometry that is NOT marked single-sided is never culled', () => {
    // The safety property, asserted rather than trusted: a floor registered through
    // `fromMeshes` keeps double-sided collision even with the flag on, so no winding
    // mistake in the terrain can open a hole in the world.
    const floor = new Mesh(
      new BoxGeometry(200, 1, 200),
      new MeshBasicMaterial()
    );
    floor.position.set(0, -0.5, 0);
    floor.updateMatrixWorld(true);
    const ctrl = EmbodiedController.fromMeshes(
      [{ mesh: floor, surface: 'dirt' }],
      {
        spawn: { x: 0, y: 0.2, z: 0 },
        cullBackfaces: true,
      }
    );
    try {
      for (let i = 0; i < 120; i++) {
        ctrl.setInput({ ...STILL, yaw: EAST });
        ctrl.step(1 / 60);
      }
      expect(ctrl.grounded, 'the body fell through an unmarked floor').toBe(
        true
      );
      expect(Math.abs(ctrl.position.y)).toBeLessThan(0.5);
    } finally {
      ctrl.dispose();
    }
  });
});
