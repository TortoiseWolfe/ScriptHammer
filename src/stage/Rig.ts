// Chattanooga Mini — one camera controller, four modes, all critically smoothed.
//   tour   : slow eased arcs between landmark waypoints; drag/WASD breaks off.
//   orbit  : miniature free-orbit, smoothed drag + zoom, gentle idle drift.
//   follow : third-person chase that trails behind travel.
//   walk   : first-person pointer-lock; drives the ground avatar.
// Movement is camera-relative (W = up-screen) with accel/decel + eased turns.
//
// Ported from cm/cm-rig.js (vanilla-three) with exactly three transforms:
//   1. window.THREE -> named ESM imports.
//   2. _bind() body moved into a public, idempotent bind() (not called from
//      the constructor) so React StrictMode double-mount is safe.
//   3. The keydown decision logic extracted into a public handleKey() so the
//      tour-interruption behavior is unit-testable without a DOM event.
// All camera math (_tour, _orbit, _follow, _walk, _driveAvatar, damp,
// angLerp, _lookAt, setMode, _syncOrbitFromCam) is unchanged from the source.

import { Vector3, Quaternion, Euler, Matrix4, PerspectiveCamera } from 'three';

function damp(cur: number, tgt: number, lambda: number, dt: number): number {
  return cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));
}
function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

// Pointer travel (px) a press must exceed before it becomes a camera drag.
// Below this the press stays a "click": the ray never moves, so the object
// under the cursor at pointerdown still matches at click and R3F fires the
// mesh onClick (direct building selection). Without the dead-zone the rig
// orbited on the first sub-pixel move, changing the hit object and making
// R3F silently drop every click (#259 iter 6 — the "can't click a building"
// bug). 5px is below normal click jitter.
const DRAG_DEADZONE_PX = 5;

/** True once a press has traveled far enough to count as a drag. Pure,
 *  exported for unit tests. */
export function dragArmed(
  downX: number,
  downY: number,
  x: number,
  y: number,
  threshold = DRAG_DEADZONE_PX
): boolean {
  return Math.hypot(x - downX, y - downY) > threshold;
}
function angLerp(cur: number, tgt: number, lambda: number, dt: number): number {
  let d = ((tgt - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return cur + d * (1 - Math.exp(-lambda * dt));
}

export type RigMode = 'tour' | 'orbit' | 'follow' | 'walk';

export interface RigAvatar {
  pos: Vector3;
  heading: number;
  vel: Vector3;
  moving: boolean;
  speed: number;
}

export interface RigWaypoint {
  pos: [number, number, number];
  look: [number, number, number];
  dwell: number;
  name: string;
  blurb: string;
}

export interface RigFollowObj {
  position: { x: number; y: number; z: number };
  heading: number;
}

export interface RigOptions {
  eye?: number;
  moveSpeed?: number;
  sprint?: number;
  damping?: number;
  turnRate?: number;
  mouseSens?: number;
  dragSens?: number;
  idleDrift?: number;
  minR?: number;
  maxR?: number;
  // Bounds for WASD focus-panning in orbit mode (ground-plane clamp).
  panMinX?: number;
  panMaxX?: number;
  panMinZ?: number;
  panMaxZ?: number;
}

type RigDom = EventTarget & {
  requestPointerLock?: (...args: any[]) => void;
};

export class Rig {
  cam: PerspectiveCamera;
  dom: RigDom;
  o: Required<RigOptions>;

  mode: RigMode;

  avatar: RigAvatar;

  focus: Vector3;
  /** Pending fly-to glide target for the orbit pivot (null = none). */
  tFocus: Vector3 | null;
  /** While true, idle-drift is suppressed — the camera holds its subject
   *  (set while the editor has a building selected). */
  holdFocus: boolean;
  /** While false, pointer input is ignored — the editor's transform gizmo
   *  sets this during drags so moving a building doesn't orbit the camera. */
  inputEnabled: boolean;
  theta: number;
  phi: number;
  radius: number;
  tTheta: number;
  tPhi: number;
  tRadius: number;
  idle: number;

  yaw: number;
  pitch: number;

  waypoints: RigWaypoint[];
  wp: number;
  dwell: number;
  autoAdvance: boolean;
  interrupted: boolean;
  _fly: unknown;

  keys: Record<string, boolean>;
  vkeys: Record<string, boolean>;
  dragging: boolean;
  locked: boolean;
  followObj: RigFollowObj | null;

  groundHeight: ((x: number, z: number) => number) | null;
  collide: ((pos: Vector3, r: number) => void) | null;
  /** Walk-mode delegate: owns feet + stance, returns the eye position for the
   *  Rig to place the camera (rotation stays the Rig's). null → the legacy
   *  kinematic glide below. Lets an embodied physics controller drive Walk
   *  without CoD ever entering this generic/liftable file. */
  walkMove:
    | ((dt: number, rig: Rig) => { x: number; y: number; z: number } | null)
    | null;
  onCaption:
    | ((
        cap: RigWaypoint | null,
        wp: number,
        total: number,
        mode: RigMode
      ) => void)
    | null;
  onModeInternal: ((m: RigMode) => void) | null;

  _bound: boolean;
  _lx?: number;
  _ly?: number;
  // Drag dead-zone (#259 iter 6): press origin + whether travel has armed a
  // camera drag. A press under DRAG_DEADZONE_PX stays a click so R3F can pick.
  _downX?: number;
  _downY?: number;
  _dragArmed: boolean;

  // bound listener refs (set in bind(), removed in dispose())
  _kd?: (e: KeyboardEvent) => void;
  _ku?: (e: KeyboardEvent) => void;
  _mm?: (e: MouseEvent) => void;
  _md?: (e: MouseEvent) => void;
  _mu?: () => void;
  _wh?: (e: WheelEvent) => void;
  _pl?: () => void;
  _clk?: () => void;

  constructor(camera: PerspectiveCamera, dom: RigDom, opts?: RigOptions) {
    this.cam = camera;
    this.dom = dom;
    this.o = Object.assign(
      {
        eye: 2.4,
        moveSpeed: 12,
        sprint: 2.0,
        damping: 12,
        turnRate: 9,
        mouseSens: 0.0022,
        dragSens: 0.0044,
        idleDrift: 5.5,
        minR: 14,
        maxR: 240,
        // Generous default pan bounds; the composition root overrides these to
        // the actual corridor extent.
        panMinX: -100000,
        panMaxX: 100000,
        panMinZ: -100000,
        panMaxZ: 100000,
      },
      opts || {}
    );

    this.mode = 'tour';
    this.cam.rotation.order = 'YXZ';

    // avatar (ground figure) shared by walk + follow
    this.avatar = {
      pos: new Vector3(0, 0, 20),
      heading: 0,
      vel: new Vector3(),
      moving: false,
      speed: 0,
    };

    // orbit state
    this.focus = new Vector3(0, 0, 0);
    this.tFocus = null;
    this.holdFocus = false;
    this.inputEnabled = true;
    this.theta = 0.7;
    this.phi = 0.62;
    this.radius = 120;
    this.tTheta = 0.7;
    this.tPhi = 0.62;
    this.tRadius = 120;
    this.idle = 0;

    // walk look
    this.yaw = 0;
    this.pitch = -0.15;

    // tour
    this.waypoints = [];
    this.wp = 0;
    this.dwell = 0;
    this.autoAdvance = true;
    this.interrupted = false;
    this._fly = null;

    // input
    this.keys = {};
    this.vkeys = {}; // real + virtual (playtest)
    this.dragging = false;
    this._dragArmed = false;
    this.locked = false;
    this.followObj = null; // {position, heading?} — trolley when boarded

    // callbacks (app supplies)
    this.groundHeight = null; // (x,z) -> y
    this.collide = null; // (pos, r) -> mutate pos
    this.walkMove = null; // walk-mode embodied delegate (EmbodiedController)
    this.onCaption = null;
    this.onModeInternal = null;

    this._bound = false;

    this._syncOrbitFromCam();
  }

  bind(): void {
    if (this._bound) return;
    this._bound = true;
    this._kd = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      this.handleKey(e.code, true);
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'].indexOf(
          e.code
        ) >= 0
      )
        e.preventDefault();
    };
    this._ku = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      this.handleKey(e.code, false);
      // Match cm-rig.js _key(): preventDefault runs for both keydown AND keyup.
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'].indexOf(
          e.code
        ) >= 0
      )
        e.preventDefault();
    };
    this._mm = (e: MouseEvent) => {
      this._move(e);
    };
    this._md = (e: MouseEvent) => {
      this._down(e);
    };
    this._mu = () => {
      this.dragging = false;
      this._dragArmed = false;
    };
    this._wh = (e: WheelEvent) => {
      this._wheel(e);
    };
    this._pl = () => {
      this.locked = document.pointerLockElement === this.dom;
    };
    this._clk = () => {
      if (
        this.mode === 'walk' &&
        !this.locked &&
        'requestPointerLock' in this.dom &&
        this.dom.requestPointerLock
      )
        this.dom.requestPointerLock();
    };
    window.addEventListener('keydown', this._kd as EventListener);
    window.addEventListener('keyup', this._ku as EventListener);
    window.addEventListener('mousemove', this._mm as EventListener);
    window.addEventListener('mouseup', this._mu as EventListener);
    this.dom.addEventListener('mousedown', this._md as EventListener);
    this.dom.addEventListener('wheel', this._wh as EventListener, {
      passive: false,
    });
    this.dom.addEventListener('click', this._clk as EventListener);
    document.addEventListener('pointerlockchange', this._pl as EventListener);
  }

  dispose(): void {
    this._bound = false;
    if (this._kd)
      window.removeEventListener('keydown', this._kd as EventListener);
    if (this._ku)
      window.removeEventListener('keyup', this._ku as EventListener);
    if (this._mm)
      window.removeEventListener('mousemove', this._mm as EventListener);
    if (this._mu)
      window.removeEventListener('mouseup', this._mu as EventListener);
    if (this._md)
      this.dom.removeEventListener('mousedown', this._md as EventListener);
    if (this._wh)
      this.dom.removeEventListener('wheel', this._wh as EventListener);
    if (this._clk)
      this.dom.removeEventListener('click', this._clk as EventListener);
    if (this._pl)
      document.removeEventListener(
        'pointerlockchange',
        this._pl as EventListener
      );
    if (document.pointerLockElement === this.dom && document.exitPointerLock)
      document.exitPointerLock();
  }

  // Extracted from cm-rig.js's _key(e, down): the keydown/keyup decision
  // logic, made unit-testable without a DOM event.
  handleKey(code: string, down: boolean): void {
    this.keys[code] = down;
    this.idle = 0;
    if (
      down &&
      this.mode === 'tour' &&
      ['KeyW', 'KeyA', 'KeyS', 'KeyD'].indexOf(code) >= 0
    )
      this.setMode('orbit');
  }

  _down(e: MouseEvent): void {
    if (!this.inputEnabled) return;
    this.idle = 0;
    this.dragging = true;
    this._dragArmed = false; // stays a click until travel exceeds the dead-zone
    this._downX = this._lx = e.clientX;
    this._downY = this._ly = e.clientY;
    if (this.mode === 'tour') this.setMode('orbit');
  }
  _move(e: MouseEvent): void {
    if (!this.inputEnabled) return;
    this.idle = 0;
    // Pointer-lock look (walk mode) uses relative movementX and has no click
    // semantics — never gate it. The click-drag orbit/walk-drag paths must
    // wait for the dead-zone so a stationary click stays pickable.
    const lockLook = this.mode === 'walk' && this.locked;
    if (this.dragging && !this._dragArmed && !lockLook) {
      if (
        dragArmed(
          this._downX ?? e.clientX,
          this._downY ?? e.clientY,
          e.clientX,
          e.clientY
        )
      ) {
        // Arm now; reseed the last-position so the first armed frame applies
        // only the post-arm delta, not the whole accumulated travel.
        this._dragArmed = true;
        this._lx = e.clientX;
        this._ly = e.clientY;
      } else {
        this._lx = e.clientX;
        this._ly = e.clientY;
        return; // under the dead-zone: no camera movement
      }
    }
    const mx =
      e.movementX != null ? e.movementX : e.clientX - (this._lx || e.clientX);
    const my =
      e.movementY != null ? e.movementY : e.clientY - (this._ly || e.clientY);
    this._lx = e.clientX;
    this._ly = e.clientY;
    if (this.mode === 'walk') {
      // pointer-lock look when available; click-drag look as the iframe fallback
      if (this.locked) {
        this.yaw -= mx * this.o.mouseSens;
        this.pitch = clamp(this.pitch - my * this.o.mouseSens, -1.2, 1.0);
      } else if (this.dragging && this._dragArmed) {
        this.yaw -= mx * this.o.dragSens;
        this.pitch = clamp(this.pitch - my * this.o.dragSens, -1.2, 1.0);
      }
    } else if (
      this.dragging &&
      this._dragArmed &&
      (this.mode === 'orbit' || this.mode === 'follow')
    ) {
      this.tTheta -= mx * this.o.dragSens;
      this.tPhi = clamp(this.tPhi - my * this.o.dragSens, 0.12, 1.45);
    }
  }
  _wheel(e: WheelEvent): void {
    if (!this.inputEnabled) return;
    if (this.mode !== 'orbit' && this.mode !== 'follow') return;
    e.preventDefault();
    this.idle = 0;
    this.tRadius = clamp(
      this.tRadius * (1 + (e.deltaY > 0 ? 0.12 : -0.12)),
      this.o.minR,
      this.o.maxR
    );
  }

  // ---- headless / API helpers --------------------------------------------
  setVKey(code: string, down: boolean): void {
    this.vkeys[code] = down;
    this.idle = 0;
  }
  clearVKeys(): void {
    this.vkeys = {};
  }
  down(code: string): boolean {
    return !!(this.keys[code] || this.vkeys[code]);
  }

  setMode(m: RigMode): void {
    if (m === this.mode) return;
    // preserve view continuity across the switch
    if (m === 'orbit') {
      // A pending fly-to owns focus/radius (flyTo set tFocus/tRadius before
      // the React mode-change effect fires) — sync only the angles then, or
      // the glide's target radius gets clobbered by the camera's distance.
      this._syncOrbitFromCam(this.tFocus !== null);
    }
    if (m === 'walk') {
      this.yaw = this._camYaw();
      this.pitch = clamp(this._camPitch(), -1.0, 0.4);
    }
    if (m === 'follow') {
      if (this.tRadius > 60) {
        this.tRadius = this.radius = 32;
      }
    }
    this.mode = m;
    this.interrupted = false;
    this._fly = null;
    this.dragging = false;
    if (this.onModeInternal) this.onModeInternal(m);
    this._emitCaption();
  }

  _camYaw(): number {
    const e = new Euler().setFromQuaternion(this.cam.quaternion, 'YXZ');
    return e.y;
  }
  _camPitch(): number {
    const e = new Euler().setFromQuaternion(this.cam.quaternion, 'YXZ');
    return e.x;
  }
  _syncOrbitFromCam(anglesOnly = false): void {
    const off = new Vector3().subVectors(this.cam.position, this.focus);
    let r = off.length();
    if (r < 1) r = this.radius;
    if (!anglesOnly)
      this.radius = this.tRadius = clamp(r, this.o.minR, this.o.maxR);
    this.theta = this.tTheta = Math.atan2(off.x, off.z);
    this.phi = this.tPhi = clamp(
      Math.acos(clamp(off.y / r, -1, 1)),
      0.12,
      1.45
    );
  }

  setWaypoints(wps: RigWaypoint[]): void {
    this.waypoints = wps || [];
    this.wp = 0;
    this.dwell = 0;
    this._emitCaption();
  }
  next(): void {
    if (this.waypoints.length) {
      this.wp = (this.wp + 1) % this.waypoints.length;
      this.dwell = 0;
      this._emitCaption();
    }
  }
  prev(): void {
    if (this.waypoints.length) {
      this.wp = (this.wp - 1 + this.waypoints.length) % this.waypoints.length;
      this.dwell = 0;
      this._emitCaption();
    }
  }
  goTo(i: number): void {
    if (this.waypoints.length) {
      this.wp =
        ((i % this.waypoints.length) + this.waypoints.length) %
        this.waypoints.length;
      this.dwell = 0;
      this._emitCaption();
    }
  }
  /** Glide the orbit pivot to ENU (x, z) — #259 directory fly-to. Only
   *  meaningful in orbit mode (the pivot drives nothing elsewhere). */
  flyTo(x: number, z: number, radius?: number): void {
    this.tFocus = new Vector3(
      clamp(x, this.o.panMinX, this.o.panMaxX),
      this.focus.y,
      clamp(z, this.o.panMinZ, this.o.panMaxZ)
    );
    if (radius !== undefined)
      this.tRadius = clamp(radius, this.o.minR, this.o.maxR);
    this.idle = 0;
  }
  _emitCaption(): void {
    let cap: RigWaypoint | null = null;
    if (this.mode === 'tour' && this.waypoints[this.wp])
      cap = this.waypoints[this.wp];
    if (this.onCaption)
      this.onCaption(cap, this.wp, this.waypoints.length, this.mode);
  }

  board(obj: RigFollowObj): void {
    this.followObj = obj;
  }
  unboard(): void {
    this.followObj = null;
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    this.idle += dt;
    if (this.mode === 'tour') this._tour(dt);
    else if (this.mode === 'orbit') this._orbit(dt);
    else if (this.mode === 'follow') this._follow(dt);
    else this._walk(dt);
  }

  // ---- ground avatar (walk + follow share this) --------------------------
  _driveAvatar(dt: number, camRelYaw: number): void {
    const a = this.avatar;
    const f = new Vector3(Math.sin(camRelYaw), 0, Math.cos(camRelYaw)); // forward on ground
    f.multiplyScalar(-1); // camera looks down -Z; "up-screen" = -forward
    const r = new Vector3(f.z, 0, -f.x);
    const wish = new Vector3();
    if (this.down('KeyW')) wish.add(f);
    if (this.down('KeyS')) wish.sub(f);
    if (this.down('KeyD')) wish.add(r);
    if (this.down('KeyA')) wish.sub(r);
    const sp = this.o.moveSpeed * (this.down('ShiftLeft') ? this.o.sprint : 1);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(sp);
    a.vel.x = damp(a.vel.x, wish.x, this.o.damping, dt);
    a.vel.z = damp(a.vel.z, wish.z, this.o.damping, dt);
    a.pos.addScaledVector(a.vel, dt);
    if (this.collide) this.collide(a.pos, 1.4);
    a.pos.y = this.groundHeight ? this.groundHeight(a.pos.x, a.pos.z) : 0;
    a.speed = Math.hypot(a.vel.x, a.vel.z);
    a.moving = a.speed > 0.35;
    if (a.moving)
      a.heading = angLerp(
        a.heading,
        Math.atan2(a.vel.x, a.vel.z),
        this.o.turnRate,
        dt
      );
  }

  _walk(dt: number): void {
    // Embodied delegate (EmbodiedController) owns feet + stance when injected;
    // the Rig still owns look. A null return (meshes still loading) falls back to
    // the legacy kinematic glide so Walk is never dead.
    if (this.walkMove) {
      const eye = this.walkMove(dt, this);
      if (eye) {
        this.cam.position.set(eye.x, eye.y, eye.z);
        this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
        return;
      }
    }
    this._driveAvatar(dt, this.yaw);
    const a = this.avatar;
    const eyeY = a.pos.y + this.o.eye;
    this.cam.position.x = damp(this.cam.position.x, a.pos.x, 16, dt);
    this.cam.position.z = damp(this.cam.position.z, a.pos.z, 16, dt);
    this.cam.position.y = damp(this.cam.position.y, eyeY, 16, dt);
    this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  _follow(dt: number): void {
    const a = this.avatar;
    const target = this.followObj || a;
    // drive the avatar unless we've boarded a self-driving object
    if (!this.followObj) this._driveAvatar(dt, this.tTheta);
    const tp = (target as RigFollowObj).position || a.pos;
    // KNOWN-SCIENCE third-person controls: the movement frame (tTheta) stays
    // STABLE while you move, so camera-relative WASD never veers. You rotate
    // the camera yourself by dragging; on foot it only recenters behind you
    // once you've stopped. A boarded vehicle drives itself, so trail its heading.
    if (this.followObj) {
      this.tTheta = angLerp(this.tTheta, target.heading, 3.0, dt);
    } else if (!this.dragging && !a.moving) {
      this.tTheta = angLerp(this.tTheta, a.heading, 1.6, dt);
    }
    const dist = this.tRadius;
    const h = dist * 0.48;
    const dir = new Vector3(Math.sin(this.tTheta), 0, Math.cos(this.tTheta));
    const want = new Vector3(
      tp.x - dir.x * dist,
      tp.y + h,
      tp.z - dir.z * dist
    );
    this.cam.position.x = damp(this.cam.position.x, want.x, 5.0, dt);
    this.cam.position.y = damp(this.cam.position.y, want.y, 5.0, dt);
    this.cam.position.z = damp(this.cam.position.z, want.z, 5.0, dt);
    this._lookAt(tp.x, tp.y + 4, tp.z, 6, dt);
  }

  _orbit(dt: number): void {
    // WASD pans the pivot across the ground plane (camera-relative), so the user
    // can slide the whole diorama and reach both ends of the corridor — not just
    // orbit a fixed point. Reuses the forward/right basis from _driveAvatar.
    const panF = new Vector3(Math.sin(this.theta), 0, Math.cos(this.theta));
    panF.multiplyScalar(-1); // camera looks down -theta; "up-screen" = -forward
    const panR = new Vector3(panF.z, 0, -panF.x);
    const wish = new Vector3();
    if (this.down('KeyW')) wish.add(panF);
    if (this.down('KeyS')) wish.sub(panF);
    if (this.down('KeyD')) wish.add(panR);
    if (this.down('KeyA')) wish.sub(panR);
    if (wish.lengthSq() > 0) {
      this.tFocus = null; // manual pan cancels a pending fly-to glide
      // Pan speed scales with zoom (radius) so it feels consistent close & far.
      const panSpeed = this.o.moveSpeed * (this.radius / 600);
      wish.normalize().multiplyScalar(panSpeed * dt);
      this.focus.x = clamp(
        this.focus.x + wish.x,
        this.o.panMinX,
        this.o.panMaxX
      );
      this.focus.z = clamp(
        this.focus.z + wish.z,
        this.o.panMinZ,
        this.o.panMaxZ
      );
      this.idle = 0; // suppress idle-drift while the user is actively panning
    }

    // Fly-to glide (#259 directory): damp the pivot toward tFocus, matching
    // the tTheta/tPhi/tRadius pattern below so the camera eases instead of
    // snapping. Cleared on arrival (or by a manual pan above).
    if (this.tFocus) {
      this.focus.x = damp(this.focus.x, this.tFocus.x, 4, dt);
      this.focus.z = damp(this.focus.z, this.tFocus.z, 4, dt);
      this.idle = 0;
      const d =
        Math.abs(this.focus.x - this.tFocus.x) +
        Math.abs(this.focus.z - this.tFocus.z);
      if (d < 0.5) this.tFocus = null;
    }

    // Ambient idle-drift — suppressed while the editor holds a subject
    // (drifting away from a just-selected building undercuts the fly-to).
    if (this.idle > 3.0 && !this.holdFocus)
      this.tTheta += this.o.idleDrift * 0.002 * dt * 60; // gentle drift
    this.theta = damp(this.theta, this.tTheta, 6, dt);
    this.phi = damp(this.phi, this.tPhi, 6, dt);
    this.radius = damp(this.radius, this.tRadius, 5, dt);
    const sp = Math.sin(this.phi) * this.radius;
    this.cam.position.set(
      this.focus.x + sp * Math.sin(this.theta),
      this.focus.y + Math.cos(this.phi) * this.radius,
      this.focus.z + sp * Math.cos(this.theta)
    );
    this.cam.lookAt(this.focus);
  }

  _tour(dt: number): void {
    if (!this.waypoints.length) return;
    const wp = this.waypoints[this.wp];
    const p = wp.pos;
    const la = wp.look;
    this.cam.position.x = damp(this.cam.position.x, p[0], 2.3, dt);
    this.cam.position.y = damp(this.cam.position.y, p[1], 2.3, dt);
    this.cam.position.z = damp(this.cam.position.z, p[2], 2.3, dt);
    this._lookAt(la[0], la[1], la[2], 3.0, dt);
    const d = Math.hypot(
      this.cam.position.x - p[0],
      this.cam.position.y - p[1],
      this.cam.position.z - p[2]
    );
    if (d < 3.5) {
      this.dwell += dt;
      if (this.autoAdvance && this.dwell > (wp.dwell || 4.5)) this.next();
    }
  }

  _lookAt(x: number, y: number, z: number, lambda: number, dt: number): void {
    const m = new Matrix4().lookAt(
      this.cam.position,
      new Vector3(x, y, z),
      new Vector3(0, 1, 0)
    );
    const q = new Quaternion().setFromRotationMatrix(m);
    this.cam.quaternion.slerp(q, 1 - Math.exp(-lambda * dt));
  }
}
