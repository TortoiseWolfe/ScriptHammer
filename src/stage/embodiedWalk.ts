// Bridges the twin Rig's Walk mode to a CoD `EmbodiedController`: maps the Rig's
// key/yaw state (`e.code` convention) to the controller's normalized input, steps
// the physics body, folds head-bob + landing-punch into the returned eye
// position, and fires footstep audio + dust. R3F/hook wiring stays in the
// composition root — this is the pure glue installed as `rig.walkMove`.

import type { EmbodiedController, Vec3Like } from '@/lib/cod';
import type { Rig } from './Rig';

/** Camera view while riding the bike. */
export type BikeView = 'first' | 'third';

/**
 * Unit "backward" direction for the third-person chase cam: the negation of the
 * camera's forward vector for a YXZ (pitch-about-X, yaw-about-Y) rotation. Placing
 * the camera at `eye + back · chaseBackDir` puts the player exactly on the view
 * axis, so the body/bike stays centred in frame whatever the aim — the fix for the
 * chase cam losing the rider. Always unit length (cos²+sin² = 1), as the world
 * raycast (`cameraDistance`) requires. Pure + exported for a regression test.
 */
export function chaseBackDir(
  yaw: number,
  pitch: number
): { x: number; y: number; z: number } {
  const cp = Math.cos(pitch);
  return { x: Math.sin(yaw) * cp, y: -Math.sin(pitch), z: Math.cos(yaw) * cp };
}

export interface WalkFeelDeps {
  /** Shared first/third-person toggle (flipped by V while riding). */
  viewRef: { current: BikeView };
  /** Footstep cadence + audio; returns true on a step (→ dust puff). */
  stepAudio: (
    dist: number,
    grounded: boolean,
    surface: string,
    gait: string
  ) => boolean;
  emitDust: (
    x: number,
    y: number,
    z: number,
    surface: string,
    intensity: number
  ) => void;
  tickDust: (dt: number) => void;
  /** Adds head-bob + landing dip onto `camera.position` in place. */
  applyCameraFeel: (
    camera: { position: Vec3Like },
    cc: { grounded: boolean; landingSpeed: number },
    moved: number,
    dt: number,
    yaw: number,
    bobScale?: number
  ) => void;
}

/**
 * Build the `Rig.walkMove` delegate for an `EmbodiedController`. The Rig owns
 * look (yaw/pitch); this owns the feet + stance and returns the eye position for
 * the Rig to place the camera.
 */
export function makeWalkMove(
  ctrl: EmbodiedController,
  deps: WalkFeelDeps
): (dt: number, rig: Rig) => Vec3Like {
  // Persistent scratch — no per-frame allocation.
  const eye = { position: { x: 0, y: 0, z: 0 } };
  let prevV = false;
  let prevFacing: number | null = null; // last bike heading, for the steer→view delta
  return (dt, rig) => {
    ctrl.setInput({
      forward: (rig.down('KeyW') ? 1 : 0) - (rig.down('KeyS') ? 1 : 0),
      right: (rig.down('KeyD') ? 1 : 0) - (rig.down('KeyA') ? 1 : 0),
      jump: rig.down('Space'),
      sprint: rig.down('ShiftLeft') || rig.down('ShiftRight'),
      crouch: rig.down('KeyC'),
      prone: rig.down('KeyX'),
      mount: rig.down('KeyB'), // B toggles the bike
      yaw: rig.yaw,
    });
    ctrl.step(dt);

    // V toggles first/third-person — on foot AND on the bike — so you can watch
    // your character walk, crouch and lie down, not just ride.
    const vDown = rig.down('KeyV');
    if (vDown && !prevV) {
      deps.viewRef.current = deps.viewRef.current === 'first' ? 'third' : 'first';
    }
    prevV = vDown;

    // While riding, steering nudges the view by the SAME delta the bike heading
    // turns — added to the Rig's yaw, not replacing it — so A/D turns what you see
    // AND the mouse can still swivel your head freely on top. (Hard-setting
    // yaw = heading is what locked the head in place.) On foot, look is entirely
    // the Rig's own mouse yaw — untouched.
    if (ctrl.riding) {
      if (prevFacing === null) prevFacing = ctrl.facingYaw;
      rig.yaw += ctrl.facingYaw - prevFacing;
      prevFacing = ctrl.facingYaw;
    } else {
      prevFacing = null;
    }

    ctrl.eyePosition(eye.position);
    if (deps.viewRef.current === 'third') {
      // Chase cam: sit `back` metres behind the player ALONG THE CURRENT VIEW
      // DIRECTION (the Rig's pitch+yaw, which is what actually orients the
      // camera). Placing the camera at −forward·back puts the player exactly on
      // the view axis, so the body/bike stays CENTRED no matter where you aim —
      // the old fixed rear+up offset let it fall out of frame (bug: "3rd person
      // has no view of the bike"). Raycast the pull-back so the camera tucks in
      // against a wall/building behind you instead of clipping through it.
      const back = 6;
      const ex = eye.position.x;
      const ey = eye.position.y;
      const ez = eye.position.z;
      const b = chaseBackDir(rig.yaw, rig.pitch);
      const allowed = ctrl.cameraDistance(ex, ey, ez, b.x, b.y, b.z, back, 0.35);
      eye.position.x = ex + b.x * allowed;
      eye.position.y = ey + b.y * allowed;
      eye.position.z = ez + b.z * allowed;
    } else {
      // First-person / on-foot: fold head-bob + landing punch into the eye.
      deps.applyCameraFeel(eye, ctrl, ctrl.movedThisFrame, dt, rig.yaw, ctrl.bobScale);
    }
    // No footfalls while rolling on the bike.
    if (!ctrl.riding) {
      const stepped = deps.stepAudio(
        ctrl.movedThisFrame,
        ctrl.grounded,
        ctrl.groundSurfaceName,
        ctrl.gait
      );
      if (stepped) {
        const p = ctrl.position;
        deps.emitDust(p.x, p.y, p.z, ctrl.groundSurfaceName, ctrl.dustScale);
      }
    }
    deps.tickDust(dt);
    return eye.position;
  };
}
