import { describe, it, expect, beforeEach } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Rig, dragArmed } from '../Rig';

function makeRig() {
  const cam = new PerspectiveCamera(34, 1.6, 1, 2400);
  // dom stub: only addEventListener/removeEventListener/requestPointerLock are touched, and only in bind()
  const dom = {
    addEventListener() {},
    removeEventListener() {},
    requestPointerLock() {},
  } as unknown as HTMLElement;
  return new Rig(cam, dom);
}

describe('Rig', () => {
  let rig: ReturnType<typeof makeRig>;
  beforeEach(() => {
    rig = makeRig();
  });

  it('starts in tour mode', () => {
    expect(rig.mode).toBe('tour');
  });

  it('switches modes and fires onModeInternal', () => {
    let seen = '';
    rig.onModeInternal = (m) => {
      seen = m;
    };
    rig.setMode('walk');
    expect(rig.mode).toBe('walk');
    expect(seen).toBe('walk');
  });

  it('tour is interruptible: a WASD press breaks tour into orbit', () => {
    rig.setWaypoints([
      { pos: [0, 10, 0], look: [0, 0, 0], dwell: 4, name: 'A', blurb: '' },
    ]);
    expect(rig.mode).toBe('tour');
    // simulate the keydown handler path the bound listener would call
    rig.handleKey('KeyW', true);
    expect(rig.mode).toBe('orbit');
  });

  it('board stores a follow target and unboard clears it', () => {
    const trolley = { position: { x: 1, y: 0, z: 2 }, heading: 0 };
    rig.board(trolley);
    expect(rig.followObj).toBe(trolley);
    rig.unboard();
    expect(rig.followObj).toBeNull();
  });

  it('follow mode CHASES a boarded moving object (#Ride — the twin wires the trolley here)', () => {
    const trolley = { position: { x: 0, y: 0, z: 0 }, heading: 0 };
    rig.setMode('follow');
    rig.board(trolley);
    // settle behind the stationary target first
    for (let i = 0; i < 120; i++) rig.update(0.05);
    const d0 = Math.hypot(
      rig.cam.position.x - trolley.position.x,
      rig.cam.position.z - trolley.position.z
    );
    // drive the target away; the camera must give chase (stay within a
    // bounded trail distance rather than being left behind)
    for (let i = 0; i < 240; i++) {
      trolley.position.x += 12 * 0.05; // 12 m/s east
      rig.update(0.05);
    }
    const d1 = Math.hypot(
      rig.cam.position.x - trolley.position.x,
      rig.cam.position.z - trolley.position.z
    );
    expect(d1).toBeLessThan(d0 + 25); // chased, not parked at the origin
    expect(Math.abs(rig.cam.position.x)).toBeGreaterThan(30); // actually moved east
  });

  it('update(dt) advances without throwing in each mode', () => {
    for (const m of ['orbit', 'follow', 'walk'] as const) {
      rig.setMode(m);
      expect(() => rig.update(0.016)).not.toThrow();
    }
  });

  it('WASD pans the orbit focus across the ground (#216)', () => {
    // #216 — orbit used to have a fixed pivot, so you couldn't reach the far end.
    rig.setMode('orbit');
    rig.focus.set(0, 0, 0);
    const z0 = rig.focus.z;
    rig.handleKey('KeyW', true); // hold "forward"
    // several frames of pan
    for (let i = 0; i < 30; i++) rig.update(0.05);
    // the pivot must have translated in the ground plane (not stayed fixed)
    const moved = Math.abs(rig.focus.z - z0) > 1 || Math.abs(rig.focus.x) > 1;
    expect(moved).toBe(true);
  });

  // #259 iter 6 — drag dead-zone so a stationary click stays pickable (R3F
  // drops a mesh onClick when the camera orbits between pointerdown and click).
  describe('drag dead-zone', () => {
    it('dragArmed only past the threshold', () => {
      expect(dragArmed(100, 100, 102, 101)).toBe(false); // ~2px
      expect(dragArmed(100, 100, 100, 104)).toBe(false); // 4px, under 5
      expect(dragArmed(100, 100, 110, 100)).toBe(true); // 10px
      expect(dragArmed(100, 100, 100, 100, 0)).toBe(false); // zero travel
    });

    it('a stationary click applies NO camera rotation', () => {
      rig.setMode('orbit');
      const theta0 = rig.tTheta;
      const phi0 = rig.tPhi;
      rig._down({ clientX: 400, clientY: 300 } as MouseEvent);
      // jitter within the dead-zone
      rig._move({ clientX: 402, clientY: 301 } as MouseEvent);
      rig._move({ clientX: 401, clientY: 302 } as MouseEvent);
      expect(rig.tTheta).toBe(theta0);
      expect(rig.tPhi).toBe(phi0);
      expect(rig._dragArmed).toBe(false);
    });

    it('a supra-threshold drag DOES orbit and arms', () => {
      rig.setMode('orbit');
      const theta0 = rig.tTheta;
      rig._down({ clientX: 400, clientY: 300 } as MouseEvent);
      rig._move({ clientX: 440, clientY: 300 } as MouseEvent); // 40px → arms
      rig._move({ clientX: 480, clientY: 300 } as MouseEvent); // keeps dragging
      expect(rig._dragArmed).toBe(true);
      expect(rig.tTheta).not.toBe(theta0);
    });

    it('mouseup disarms so the next click is clean', () => {
      rig.bind(); // _mu is assigned in bind()
      rig.setMode('orbit');
      rig._down({ clientX: 0, clientY: 0 } as MouseEvent);
      rig._move({ clientX: 50, clientY: 0 } as MouseEvent); // arm
      expect(rig._dragArmed).toBe(true);
      rig._mu!();
      expect(rig._dragArmed).toBe(false);
      expect(rig.dragging).toBe(false);
    });
  });
});
