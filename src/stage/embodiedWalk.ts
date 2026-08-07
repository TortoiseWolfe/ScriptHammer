// Bridges the twin Rig's Walk mode to a CoD `EmbodiedController`: maps the Rig's
// key/yaw state (`e.code` convention) to the controller's normalized input, steps
// the physics body, folds head-bob + landing-punch into the returned eye
// position, and fires footstep audio + dust. R3F/hook wiring stays in the
// composition root — this is the pure glue installed as `rig.walkMove`.

import type { EmbodiedController, Vec3Like } from '@/lib/cod';
import type { Rig } from './Rig';

/** Camera view while riding the bike. */
export type BikeView = 'first' | 'third';

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

    ctrl.eyePosition(eye.position);
    if (deps.viewRef.current === 'third') {
      // Chase cam: pull the camera back behind the look direction + up a bit, so
      // you see yourself on the bike. The Rig still applies (pitch, yaw), so it
      // looks forward over your shoulder.
      const back = 8;
      const up = 3;
      // Trail the FACING (bike heading while riding, look yaw on foot) so the
      // camera stays behind the bike even when the mouse free-looks around.
      eye.position.x += Math.sin(ctrl.facingYaw) * back;
      eye.position.z += Math.cos(ctrl.facingYaw) * back;
      eye.position.y += up;
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
