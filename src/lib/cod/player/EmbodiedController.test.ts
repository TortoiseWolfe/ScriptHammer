import { describe, it, expect } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { EmbodiedController, type EmbodiedInput } from './EmbodiedController';

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number
): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial());
  m.position.set(x, y, z);
  m.updateWorldMatrix(true, false);
  return m;
}

// Floor whose top face sits at y = 0 (40×2×40 centred at y = −1), matching the
// controller's Y=0 ground convention.
const floor = () => box(40, 2, 40, 0, -1, 0);

const input = (o: Partial<EmbodiedInput> = {}): EmbodiedInput => ({
  forward: 0,
  right: 0,
  jump: false,
  sprint: false,
  crouch: false,
  prone: false,
  mount: false,
  yaw: 0,
  ...o,
});

const DT = 1 / 60;
const stepN = (c: EmbodiedController, n: number) => {
  for (let i = 0; i < n; i++) c.step(DT);
};

describe('EmbodiedController', () => {
  it('bakes the supplied meshes into a non-empty BVH', () => {
    const c = EmbodiedController.fromMeshes([{ mesh: floor(), surface: 'dirt' }]);
    expect(c.triCount).toBeGreaterThan(0);
    c.dispose();
  });

  it('gravity settles the body onto the floor', () => {
    const c = EmbodiedController.fromMeshes([{ mesh: floor(), surface: 'dirt' }], {
      spawn: { x: 0, y: 2, z: 0 }, // dropped from 2 m
    });
    c.setInput(input());
    stepN(c, 90); // ~1.5 s
    expect(c.position.y).toBeLessThan(0.15);
    expect(c.position.y).toBeGreaterThan(-0.15);
    expect(c.grounded).toBe(true);
    c.dispose();
  });

  it('jump raises the body, then it falls back to the floor', () => {
    const c = EmbodiedController.fromMeshes([{ mesh: floor(), surface: 'dirt' }]);
    c.teleport(0, 0, 0); // settle grounded
    c.setInput(input());
    c.step(DT);
    expect(c.grounded).toBe(true);

    // Hold jump briefly to launch, capturing the apex.
    c.setInput(input({ jump: true }));
    let peak = 0;
    for (let i = 0; i < 6; i++) {
      c.step(DT);
      peak = Math.max(peak, c.position.y);
    }
    expect(peak).toBeGreaterThan(0.3); // clearly airborne

    // Release and let gravity bring it home.
    c.setInput(input());
    stepN(c, 120); // ~2 s
    expect(c.position.y).toBeLessThan(0.15);
    expect(c.grounded).toBe(true);
    c.dispose();
  });

  it('crouches (lower eye) and a low ceiling blocks standing back up', () => {
    // Ceiling slab underside at y ≈ 1.1 over the origin.
    const c = EmbodiedController.fromMeshes(
      [
        { mesh: floor(), surface: 'dirt' },
        { mesh: box(4, 0.3, 4, 0, 1.25, 0), surface: 'concrete' },
      ],
      { spawn: { x: 5, y: 0, z: 0 } } // spawn in the OPEN (no ceiling) as stand
    );

    // Crouch in the open, then move under the ceiling (crouched fits: crown 1.0 < 1.1).
    c.setInput(input({ crouch: true }));
    stepN(c, 8);
    expect(c.stance).toBe('crouch');
    expect(c.eyeHeight).toBeLessThan(1.3); // eye glided down from 1.6 toward 1.0
    c.teleport(0, 0, 0); // now under the ceiling, still crouched

    // Attempt to stand (release → press): blocked by the ceiling, stays crouched.
    c.setInput(input({ crouch: false }));
    c.step(DT);
    c.setInput(input({ crouch: true }));
    stepN(c, 4);
    expect(c.stance).toBe('crouch');
    c.dispose();
  });

  it('a wall blocks forward movement (collide-and-slide)', () => {
    // Wall slab at x ∈ [2.75, 3.25].
    const c = EmbodiedController.fromMeshes([
      { mesh: floor(), surface: 'dirt' },
      { mesh: box(0.5, 3, 12, 3, 1.5, 0), surface: 'concrete' },
    ]);
    c.teleport(0, 0, 0);
    // yaw = −π/2 makes "forward" point +x (toward the wall).
    c.setInput(input({ forward: 1, yaw: -Math.PI / 2 }));
    stepN(c, 180); // ~3 s of walking into the wall
    expect(c.position.x).toBeGreaterThan(1); // it did travel toward the wall
    expect(c.position.x).toBeLessThan(2.5); // but was stopped short of x = 2.75
    c.dispose();
  });

  it('mounting the bike toggles riding and covers more ground than walking', () => {
    const c = EmbodiedController.fromMeshes([{ mesh: floor(), surface: 'dirt' }]);
    // Walk forward (yaw = −π/2 → +x) for 3 s.
    c.teleport(0, 0, 0);
    c.setInput(input({ forward: 1, yaw: -Math.PI / 2 }));
    stepN(c, 180);
    const walkX = c.position.x;

    // Mount (edge on B), then ride forward for the same 3 s.
    c.teleport(0, 0, 0);
    c.setInput(input({ mount: true }));
    c.step(DT);
    expect(c.riding).toBe(true);
    c.setInput(input({ forward: 1, yaw: -Math.PI / 2 }));
    stepN(c, 180);
    const bikeX = c.position.x;

    expect(bikeX).toBeGreaterThan(walkX * 1.4); // clearly faster on wheels

    // Dismount toggles back to on-foot.
    c.setInput(input({ mount: true }));
    c.step(DT);
    expect(c.riding).toBe(false);
    c.dispose();
  });

  it('only mounts the bike when standing next to it (no conjuring)', () => {
    const c = EmbodiedController.fromMeshes([{ mesh: floor(), surface: 'dirt' }]);
    // Bike is parked at spawn (0,0,0). Stand far away and press B → no mount.
    c.teleport(20, 0, 20);
    expect(c.nearBike).toBe(false);
    c.setInput(input({ mount: true }));
    c.step(DT);
    expect(c.riding).toBe(false);

    // Return to the parked bike; now B mounts.
    c.setInput(input({ mount: false }));
    c.step(DT);
    c.teleport(0, 0, 1); // within mountRadius of the bike at the origin
    expect(c.nearBike).toBe(true);
    c.setInput(input({ mount: true }));
    c.step(DT);
    expect(c.riding).toBe(true);

    // Dismount parks the bike where you got off.
    c.setInput(input({ mount: false }));
    c.step(DT);
    c.teleport(7, 0, 3);
    c.setInput(input({ mount: true }));
    c.step(DT);
    expect(c.riding).toBe(false);
    expect(c.bikePosition.x).toBeCloseTo(7, 1);
    expect(c.bikePosition.z).toBeCloseTo(3, 1);
    c.dispose();
  });

  it('collide() ejects a feet position poking through a façade', () => {
    // A building footprint x,z ∈ [−3, 3].
    const c = EmbodiedController.fromMeshes([
      { mesh: box(6, 20, 6, 0, 10, 0), surface: 'concrete' },
    ]);
    const pos = { x: 3.1, y: 0, z: 0 }; // capsule pokes through the +x wall
    c.collide(pos, 0.4);
    expect(pos.x).toBeGreaterThan(3.1); // shoved back out
    expect(pos.y).toBe(0); // y left for the caller's ground snap
    c.dispose();
  });
});
