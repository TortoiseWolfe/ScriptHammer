import { describe, it, expect, vi } from 'vitest';
import { chaseBackDir, makeWalkMove } from '../embodiedWalk';
import type { WalkFeelDeps } from '../embodiedWalk';
import type { EmbodiedController } from '@/lib/cod';
import type { Rig } from '../Rig';

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

describe('makeWalkMove — reduced motion (#1449)', () => {
  // Only the members makeWalkMove touches on foot, in first person.
  function fakeCtrl() {
    return {
      riding: false,
      facingYaw: 0,
      movedThisFrame: 0.1,
      grounded: true,
      groundSurfaceName: 'concrete',
      gait: 'walk',
      bobScale: 1,
      dustScale: 1,
      position: { x: 1, y: 0, z: 2 },
      setInput: vi.fn(),
      step: vi.fn(),
      eyePosition: (out: { x: number; y: number; z: number }) => {
        out.x = 1;
        out.y = 1.7;
        out.z = 2;
      },
    } as unknown as EmbodiedController;
  }
  const rig = { down: () => false, yaw: 0, pitch: 0 } as unknown as Rig;

  function deps(reducedMotion?: () => boolean) {
    // A stand-in head-bob that visibly moves the eye, so "applied" is observable.
    const applyCameraFeel = vi.fn((cam: { position: { y: number } }) => {
      cam.position.y += 0.05;
    });
    const d: WalkFeelDeps = {
      viewRef: { current: 'first' },
      stepAudio: vi.fn(() => false),
      emitDust: vi.fn(),
      tickDust: vi.fn(),
      applyCameraFeel,
      reducedMotion,
    };
    return { d, applyCameraFeel };
  }

  it('applies head-bob when the visitor has not asked for reduced motion', () => {
    const { d, applyCameraFeel } = deps(() => false);
    const eye = makeWalkMove(fakeCtrl(), d)(1 / 60, rig);
    expect(applyCameraFeel).toHaveBeenCalledTimes(1);
    expect(eye.y).toBeCloseTo(1.75, 6);
  });

  it('applies head-bob when no preference is supplied (old callers unchanged)', () => {
    const { d, applyCameraFeel } = deps(undefined);
    makeWalkMove(fakeCtrl(), d)(1 / 60, rig);
    expect(applyCameraFeel).toHaveBeenCalledTimes(1);
  });

  it('keeps the eye level and steady when reduced motion is on', () => {
    const { d, applyCameraFeel } = deps(() => true);
    const eye = makeWalkMove(fakeCtrl(), d)(1 / 60, rig);
    expect(applyCameraFeel).not.toHaveBeenCalled();
    expect(eye).toEqual({ x: 1, y: 1.7, z: 2 });
  });

  it('still moves the body and plays footsteps under reduced motion', () => {
    const ctrl = fakeCtrl();
    const { d } = deps(() => true);
    makeWalkMove(ctrl, d)(1 / 60, rig);
    expect(ctrl.step).toHaveBeenCalledTimes(1);
    expect(d.stepAudio).toHaveBeenCalledTimes(1);
  });

  it('reads the preference every frame, so a settings change applies live', () => {
    let reduced = false;
    const { d, applyCameraFeel } = deps(() => reduced);
    const move = makeWalkMove(fakeCtrl(), d);
    move(1 / 60, rig);
    reduced = true;
    move(1 / 60, rig);
    reduced = false;
    move(1 / 60, rig);
    expect(applyCameraFeel).toHaveBeenCalledTimes(2);
  });
});
