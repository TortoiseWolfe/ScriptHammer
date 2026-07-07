import { describe, it, expect, beforeEach } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Rig } from '../Rig';

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

  it('update(dt) advances without throwing in each mode', () => {
    for (const m of ['orbit', 'follow', 'walk'] as const) {
      rig.setMode(m);
      expect(() => rig.update(0.016)).not.toThrow();
    }
  });
});
