import { describe, it, expect } from 'vitest';
import { chaseBackDir } from '../embodiedWalk';

// The camera's forward vector for cam.rotation.set(pitch, yaw, 0, 'YXZ')
// (see Rig._walk) — the reference the chase cam must sit OPPOSITE to.
function cameraForward(yaw: number, pitch: number) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}

describe('chaseBackDir — third-person chase-cam placement', () => {
  const cases: Array<[number, number]> = [
    [0, 0],
    [Math.PI / 2, 0],
    [Math.PI, 0],
    [-Math.PI / 3, 0],
    [0, -0.15], // default gaze (slightly down)
    [1.2, -0.4],
    [-2.0, 0.5],
  ];

  it('is always a unit vector (cameraDistance raycast needs a unit dir)', () => {
    for (const [yaw, pitch] of cases) {
      const b = chaseBackDir(yaw, pitch);
      expect(Math.hypot(b.x, b.y, b.z)).toBeCloseTo(1, 6);
    }
  });

  it('is exactly the negation of the camera forward → player stays centred', () => {
    // camera = eye + back·chaseBackDir sits behind the player; the player then
    // lies at distance `back` straight along the camera forward = screen centre.
    for (const [yaw, pitch] of cases) {
      const f = cameraForward(yaw, pitch);
      const b = chaseBackDir(yaw, pitch);
      expect(b.x).toBeCloseTo(-f.x, 6);
      expect(b.y).toBeCloseTo(-f.y, 6);
      expect(b.z).toBeCloseTo(-f.z, 6);
    }
  });

  it('at level gaze sits directly behind at eye height (0,0,1 for yaw 0)', () => {
    const b = chaseBackDir(0, 0);
    expect(b.x).toBeCloseTo(0, 6);
    expect(b.y).toBeCloseTo(0, 6);
    expect(b.z).toBeCloseTo(1, 6);
  });

  it('looking DOWN lifts the camera (positive y) so it looks down at the body', () => {
    const b = chaseBackDir(0, -0.5); // pitch negative = looking down
    expect(b.y).toBeGreaterThan(0);
  });
});
