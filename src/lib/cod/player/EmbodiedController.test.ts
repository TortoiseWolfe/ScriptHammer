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

    // Mount (edge on B), seeding the bike heading toward +x (yaw −π/2), then ride
    // forward for the same 3 s. On the bike, forward drives ALONG the heading.
    c.teleport(0, 0, 0);
    c.setInput(input({ mount: true, yaw: -Math.PI / 2 }));
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

  it('bike steering only bites while rolling (no pivot-in-place); on foot facingYaw tracks look', () => {
    const c = EmbodiedController.fromMeshes([{ mesh: floor(), surface: 'dirt' }]);
    c.teleport(0, 0, 0);

    // On foot, the facing IS the look yaw (no steering decoupling).
    c.setInput(input({ yaw: 0.3 }));
    c.step(DT);
    expect(c.facingYaw).toBeCloseTo(0.3, 5);

    // Mount, then hold D (right = +1) = steer RIGHT: heading DECREASES (camera
    // looks −sin h,−cos h, so a smaller heading rotates toward +X = screen-right).
    c.setInput(input({ mount: true, yaw: 0 }));
    c.step(DT);
    expect(c.riding).toBe(true);
    const h0 = c.facingYaw;

    // Steer with NO throttle: standing still, the front wheel can't turn the bike
    // (non-holonomic - no pivot in place).
    c.setInput(input({ right: 1, yaw: 0 }));
    stepN(c, 60);
    expect(c.facingYaw).toBeCloseTo(h0, 3);

    // Roll forward AND steer right (W+D): the heading now turns right (decreases).
    c.setInput(input({ forward: 1, right: 1, yaw: 0 }));
    stepN(c, 60);
    const hRight = c.facingYaw;
    expect(hRight).toBeLessThan(h0 - 0.1);

    // …and holding A (right = −1) = steer LEFT turns it back the other way.
    c.setInput(input({ forward: 1, right: -1, yaw: 0 }));
    stepN(c, 60);
    expect(c.facingYaw).toBeGreaterThan(hRight);
    c.dispose();
  });

  it('the parked bike blocks walk-through once you have stepped clear of it', () => {
    const c = EmbodiedController.fromMeshes([{ mesh: floor(), surface: 'dirt' }]);
    // Bike is parked at the origin (spawn). Walk out +x to arm it as solid…
    c.teleport(0, 0, 0);
    c.setInput(input({ forward: 1, yaw: -Math.PI / 2 })); // forward → +x
    stepN(c, 120);
    expect(c.position.x).toBeGreaterThan(1.2); // clear of the bike core

    // …then walk back −x straight at it: blocked short of the core, not through.
    c.setInput(input({ forward: 1, yaw: Math.PI / 2 })); // forward → −x
    stepN(c, 240);
    expect(c.position.x).toBeGreaterThan(0.6); // stopped ~ (0.5 + 0.4) out
    expect(c.nearBike).toBe(true); // still close enough to mount
    c.dispose();
  });

  it('does not punt you off the bike on the frame you dismount (arm-gated)', () => {
    const c = EmbodiedController.fromMeshes([{ mesh: floor(), surface: 'dirt' }]);
    c.teleport(0, 0, 1);
    c.setInput(input({ mount: true, yaw: 0 }));
    c.step(DT);
    expect(c.riding).toBe(true);
    // Dismount (edge-triggered: release, then press): the bike parks at your
    // feet; you must NOT be shoved away.
    c.setInput(input({ mount: false }));
    c.step(DT);
    c.setInput(input({ mount: true }));
    c.step(DT);
    expect(c.riding).toBe(false);
    const before = { x: c.position.x, z: c.position.z };
    c.setInput(input()); // stand still a moment
    stepN(c, 20);
    expect(Math.hypot(c.position.x - before.x, c.position.z - before.z)).toBeLessThan(0.2);
    c.dispose();
  });

  it('cameraDistance pulls the chase cam in when a wall is behind, else full', () => {
    const c = EmbodiedController.fromMeshes([
      { mesh: floor(), surface: 'dirt' },
      { mesh: box(0.5, 6, 12, 4, 3, 0), surface: 'concrete' }, // wall x∈[3.75,4.25]
    ]);
    // Toward −x: open air → the full requested pull-back.
    expect(c.cameraDistance(0, 1.7, 0, -1, 0, 0, 8, 0.3)).toBeCloseTo(8, 3);
    // Toward +x: the wall at x≈3.75 clips it, so it stops short (minus pad).
    const blocked = c.cameraDistance(0, 1.7, 0, 1, 0, 0, 8, 0.3);
    expect(blocked).toBeGreaterThan(2);
    expect(blocked).toBeLessThan(4);
    c.dispose();
  });

  it('sprint (Shift) covers clearly more ground than a plain walk', () => {
    const walkThenMeasure = (sprint: boolean) => {
      const c = EmbodiedController.fromMeshes([
        { mesh: floor(), surface: 'dirt' },
      ]);
      c.teleport(0, 0, 0);
      c.setInput(input({ forward: 1, sprint, yaw: -Math.PI / 2 })); // +x
      stepN(c, 120);
      const x = c.position.x;
      c.dispose();
      return x;
    };
    const walk = walkThenMeasure(false);
    const sprint = walkThenMeasure(true);
    expect(sprint).toBeGreaterThan(walk * 1.5); // ~2.2× by default; guard the boost
  });

  it('crouch is slower than walking, and prone is slower than crouch', () => {
    const travel = (stance: 'stand' | 'crouch' | 'prone') => {
      const c = EmbodiedController.fromMeshes([
        { mesh: floor(), surface: 'dirt' },
      ]);
      c.teleport(0, 0, 0);
      // Stance is an edge-triggered toggle: press once to enter, then hold + move.
      if (stance !== 'stand') {
        c.setInput(input({ [stance]: true } as Partial<EmbodiedInput>));
        c.step(DT);
        expect(c.stance).toBe(stance);
      }
      c.setInput(
        input({
          forward: 1,
          yaw: -Math.PI / 2,
          crouch: stance === 'crouch',
          prone: stance === 'prone',
        })
      );
      stepN(c, 120);
      const x = c.position.x;
      c.dispose();
      return x;
    };
    const stand = travel('stand');
    const crouch = travel('crouch');
    const prone = travel('prone');
    expect(crouch).toBeLessThan(stand);
    expect(prone).toBeLessThan(crouch);
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
