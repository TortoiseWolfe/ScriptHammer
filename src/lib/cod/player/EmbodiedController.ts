// EmbodiedController — the framework-agnostic first-person body, extracted from
// components/game/CodSkeleton's `FirstPersonWorld` so BOTH the cod-skeleton demo
// and the digital-twin diorama's Walk mode drive the same proven loop (harvest,
// not embed).
//
// It owns a swept-capsule `CharacterController` over a static BVH plus the
// fixed-step gravity/move integration, stand/crouch/prone stances (ceiling-
// checked via `setHeight`/`canFit`), sprint, and the glided eye height. It is
// pure CoD + math: it takes prebuilt THREE meshes only to bake the collider, and
// exposes plain-number state — no React/R3F/three-scene dependency. Callers feed
// a NORMALIZED input struct each frame (so each maps its own key convention:
// CodSkeleton off `e.key`, the twin Rig off `e.code`), read `eyePosition()` for
// the camera, and own look (yaw/pitch) themselves.

import { StaticWorld } from '../bvh';
import { CharacterController } from '../character';
import { MASK } from '../surfaces';
import { makeHitRecord } from '../math';
import type { Mesh } from 'three';

export type Stance = 'stand' | 'crouch' | 'prone';

export interface StanceCfg {
  /** Capsule height (feet→crown) for this stance, metres. */
  height: number;
  /** Camera eye height above the feet, metres. */
  eye: number;
  /** Speed as a fraction of the base walk speed. */
  speedRatio: number;
  /** Footstep gait tag. */
  gait: string;
  /** Head-bob scale. */
  bobScale: number;
  /** Footstep-dust scale. */
  dustScale: number;
}

/** Sprint = a modifier applied to the standing stance while moving forward. */
export interface SprintCfg {
  speedRatio: number;
  gait: string;
  bobScale: number;
  dustScale: number;
}

/** Normalized per-frame input. `crouch`/`prone` are HELD flags; the controller
 *  edge-detects the press internally (auto-repeat-safe), so callers just pass the
 *  current key state. */
export interface EmbodiedInput {
  /** −1 (back) … +1 (forward). */
  forward: number;
  /** −1 (left) … +1 (right). */
  right: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  prone: boolean;
  /** Held; edge-detected to toggle the bike (vehicle) locomotion profile. */
  mount: boolean;
  /** Look yaw (radians); movement basis is derived from it. */
  yaw: number;
}

/** Vehicle (bicycle) locomotion: faster, with momentum — you accelerate up to
 *  speed and coast down instead of stopping instantly. */
export interface BikeCfg {
  /** Cruise top speed, m/s. */
  speed: number;
  /** Pedal-hard (sprint) top speed, m/s. */
  sprint: number;
  /** Seated eye height, m. */
  eye: number;
  /** Time constant to reach target speed while pedalling (s). */
  accelTau: number;
  /** Rolling-resistance time constant while coasting (s) — bigger = longer roll. */
  brakeTau: number;
  /** How close (m) the player must be to the parked bike to mount it. */
  mountRadius: number;
  /** Steering rate, rad/s — how fast A/D turns the bike's heading. */
  turnRate: number;
}

export interface EmbodiedConfig {
  radius?: number;
  /** Standing capsule height; defaults to `stances.stand.height`. */
  height?: number;
  stepHeight?: number;
  /** Downward acceleration, m/s² (negative). */
  gravity?: number;
  /** Jump take-off speed, m/s. */
  jump?: number;
  /** Base walk speed, m/s (stance/sprint ratios scale it). */
  walkSpeed?: number;
  /** Physics tick, seconds. */
  fixedStep?: number;
  stances?: Record<Stance, StanceCfg>;
  sprint?: SprintCfg;
  /** Bike locomotion profile; omit to use the defaults. */
  bike?: BikeCfg;
  spawn?: { x: number; y: number; z: number };
  /** Fired when the player state label changes — a foot stance
   *  (`stand`/`crouch`/`prone`) or `bike`. A raise blocked by a ceiling does NOT
   *  fire. Wire a HUD / event bus here. */
  onStanceChange?: (label: Stance | 'bike') => void;
}

/** Human-scale defaults for the real-metre digital twin. */
const DEFAULT_STANCE: Record<Stance, StanceCfg> = {
  stand: { height: 1.85, eye: 1.7, speedRatio: 1, gait: 'walk', bobScale: 1, dustScale: 1 },
  crouch: { height: 1.0, eye: 1.0, speedRatio: 0.5, gait: 'crouch', bobScale: 0.5, dustScale: 0.4 },
  prone: { height: 0.5, eye: 0.45, speedRatio: 0.28, gait: 'crouch', bobScale: 0.2, dustScale: 0.25 },
};
// base 3.3 × 2.2 ≈ 7.3 m/s sprint (games run ~2–4× real pace: a flat monitor's
// narrow FOV kills the optic-flow that conveys speed, so real 1.4 m/s reads as a
// crawl — CoD-ish jog-default is the fix).
const DEFAULT_SPRINT: SprintCfg = { speedRatio: 2.2, gait: 'sprint', bobScale: 1.4, dustScale: 1.6 };
// Bike: cruise ~14 m/s, pedal-hard ~22; ~1 s to reach speed, ~2.5 s coast; mount
// within 2.5 m of where it's parked.
const DEFAULT_BIKE: BikeCfg = {
  speed: 16,
  sprint: 28,
  eye: 1.5,
  accelTau: 0.35, // snappy pick-up — reaches cruise in ~1 s (was a sluggish 1.0)
  brakeTau: 1.5, // a short roll on release, not a long glide
  mountRadius: 3, // a touch more forgiving to walk up and mount
  turnRate: 2.2, // A/D steers ~126°/s
};

/** Collision radius of the parked bike as a walk-through obstacle, m (a bike is
 *  ~0.5 m wide). It only blocks the inner core, well inside `mountRadius`, so B
 *  can still mount from arm's length. */
const BIKE_COLLIDE_RADIUS = 0.5;

const ZERO_INPUT: EmbodiedInput = {
  forward: 0,
  right: 0,
  jump: false,
  sprint: false,
  crouch: false,
  prone: false,
  mount: false,
  yaw: 0,
};

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export class EmbodiedController {
  readonly world: StaticWorld;
  private readonly cc: CharacterController;

  private readonly stances: Record<Stance, StanceCfg>;
  private readonly sprintCfg: SprintCfg;
  private readonly bike: BikeCfg;
  private readonly walkSpeed: number;
  private readonly fixedStep: number;
  private readonly gravity: number;
  private readonly jumpSpeed: number;
  private readonly onStanceChange?: (label: Stance | 'bike') => void;

  private input: EmbodiedInput = ZERO_INPUT;
  private prevCrouch = false;
  private prevProne = false;
  private prevMount = false;
  private riding_ = false;
  /** The parked bike's world position + facing (a real object you return to). */
  private readonly bikePos_ = { x: 0, y: 0, z: 0 };
  private bikeYaw_ = 0;
  /** The parked bike blocks walk-through, but only once you've stepped clear of
   *  it — so spawning/dismounting on top of it never punts you. Re-armed (false)
   *  every time it's (re)parked. */
  private bikeArmed_ = false;
  /** Reused hit record for the chase-cam raycast (no per-frame allocation). */
  private readonly camHit_ = makeHitRecord();
  /** Capsule radius (matches the CharacterController); the bike-collision push
   *  uses it to keep the body's edge out of the bike core. */
  private readonly radius_: number;
  /** Live steered heading while riding (rad); A/D turns it, W/S drives along it. */
  private bikeHeading_ = 0;
  private accum = 0;
  private eye: number;

  stance: Stance = 'stand';
  /** Distance the capsule travelled during the last `step()` (footstep cadence). */
  movedThisFrame = 0;
  /** Feel snapshot for the last `step()` — mirror onto camera-feel/audio/dust. */
  gait = 'walk';
  bobScale = 1;
  dustScale = 1;

  private constructor(world: StaticWorld, config: EmbodiedConfig) {
    this.world = world;
    this.stances = config.stances ?? DEFAULT_STANCE;
    this.sprintCfg = config.sprint ?? DEFAULT_SPRINT;
    this.bike = config.bike ?? DEFAULT_BIKE;
    this.walkSpeed = config.walkSpeed ?? 3.3;
    this.fixedStep = config.fixedStep ?? 1 / 120;
    this.gravity = config.gravity ?? -22;
    this.jumpSpeed = config.jump ?? 7;
    this.onStanceChange = config.onStanceChange;

    const stand = this.stances.stand;
    this.cc = new CharacterController(world, {
      radius: config.radius ?? 0.4,
      height: config.height ?? stand.height,
      stepHeight: config.stepHeight ?? 0.4,
      mask: MASK.CHARACTER,
      position: config.spawn ?? { x: 0, y: 0, z: 0 },
    });
    this.radius_ = config.radius ?? 0.4;
    this.eye = stand.eye;
    // Bike starts parked at the spawn point (mountable from frame 0).
    const sp = config.spawn ?? { x: 0, y: 0, z: 0 };
    this.bikePos_.x = sp.x;
    this.bikePos_.y = sp.y;
    this.bikePos_.z = sp.z;
  }

  /** Build from prebuilt THREE meshes (world-space; `bakeMesh` reads matrixWorld).
   *  Each spec's `surface` tags footing/footstep audio. */
  static fromMeshes(
    specs: ReadonlyArray<{ mesh: Mesh | null | undefined; surface: string | number }>,
    config: EmbodiedConfig = {}
  ): EmbodiedController {
    const world = new StaticWorld();
    for (const s of specs) if (s.mesh) world.addMesh(s.mesh, s.surface);
    world.build();
    return new EmbodiedController(world, config);
  }

  /** Feet position (authoritative transform). */
  get position(): Vec3Like {
    return this.cc.position;
  }
  get grounded(): boolean {
    return this.cc.grounded;
  }
  /** Downward impact speed on the frame of landing (m/s) — for camera-feel. */
  get landingSpeed(): number {
    return this.cc.landingSpeed;
  }
  get groundSurfaceName(): string {
    return this.cc.groundSurfaceName;
  }
  /** Current glided eye height above the feet. */
  get eyeHeight(): number {
    return this.eye;
  }
  /** True while on the bike (vehicle locomotion profile). */
  get riding(): boolean {
    return this.riding_;
  }
  /** The parked bike's world position (feet-level). */
  get bikePosition(): Vec3Like {
    return this.bikePos_;
  }
  /** The parked bike's facing (radians). */
  get bikeYaw(): number {
    return this.bikeYaw_;
  }
  /** Facing for the third-person model + chase cam: the bike's steered heading
   *  while riding, else the camera look yaw. */
  get facingYaw(): number {
    return this.riding_ ? this.bikeHeading_ : this.input.yaw;
  }
  /** On foot AND within mountRadius of the parked bike → B will mount it. */
  get nearBike(): boolean {
    if (this.riding_) return false;
    const dx = this.cc.position.x - this.bikePos_.x;
    const dz = this.cc.position.z - this.bikePos_.z;
    return dx * dx + dz * dz <= this.bike.mountRadius * this.bike.mountRadius;
  }

  /** Park the (dismounted) bike at a world pose — e.g. seed it at spawn. */
  parkBike(x: number, y: number, z: number, yaw = 0): void {
    this.bikePos_.x = x;
    this.bikePos_.y = y;
    this.bikePos_.z = z;
    this.bikeYaw_ = yaw;
    this.bikeArmed_ = false; // becomes solid only after you step clear of it
  }
  get triCount(): number {
    return this.world.triCount;
  }

  setInput(input: EmbodiedInput): void {
    this.input = input;
  }

  /** Place the body (clears velocity, depenetrates, probes ground). */
  teleport(x: number, y: number, z: number): void {
    this.cc.teleport(x, y, z);
  }

  private applyStance(next: Stance): void {
    if (next === this.stance) return;
    // A raise blocked by a low ceiling (canFit → setHeight false) keeps the
    // current stance — you can't stand up under an overhang.
    if (!this.cc.setHeight(this.stances[next].height)) return;
    this.stance = next;
    this.onStanceChange?.(this.stance);
  }

  /** Advance the body by `dt` seconds. Returns the distance travelled. */
  step(dt: number): number {
    const inp = this.input;
    const cc = this.cc;

    // Edge-triggered bike mount/dismount. The bike is a real parked object:
    // dismounting parks it where you got off; mounting only works when you're
    // standing next to it (no conjuring it from thin air).
    if (inp.mount && !this.prevMount) {
      if (this.riding_) {
        this.riding_ = false;
        this.bikePos_.x = cc.position.x;
        this.bikePos_.y = cc.position.y;
        this.bikePos_.z = cc.position.z;
        this.bikeYaw_ = this.bikeHeading_;
        this.bikeArmed_ = false; // don't punt yourself off the bike you just left
        this.onStanceChange?.(this.stance);
      } else if (this.nearBike) {
        this.riding_ = true;
        this.bikeHeading_ = inp.yaw; // start pointing where you were looking
        if (this.stance !== 'stand') this.applyStance('stand');
        this.onStanceChange?.('bike');
      }
      // else: too far from the parked bike — nothing happens.
    }
    this.prevMount = inp.mount;

    // Foot stance toggles (C/X) — ignored while riding.
    if (!this.riding_) {
      if (inp.crouch && !this.prevCrouch) {
        this.applyStance(this.stance === 'crouch' ? 'stand' : 'crouch');
      }
      if (inp.prone && !this.prevProne) {
        this.applyStance(this.stance === 'prone' ? 'stand' : 'prone');
      }
    }
    this.prevCrouch = inp.crouch;
    this.prevProne = inp.prone;

    const cfg = this.stances[this.stance];
    const sprinting =
      !this.riding_ && this.stance === 'stand' && inp.sprint && inp.forward > 0;

    let speed: number;
    let eyeTarget: number;
    if (this.riding_) {
      speed = inp.sprint ? this.bike.sprint : this.bike.speed;
      eyeTarget = this.bike.eye;
      this.gait = 'roll';
      this.bobScale = 0.25;
      this.dustScale = 0.6;
    } else {
      speed = this.walkSpeed * (sprinting ? this.sprintCfg.speedRatio : cfg.speedRatio);
      eyeTarget = cfg.eye;
      this.gait = sprinting ? this.sprintCfg.gait : cfg.gait;
      this.bobScale = sprinting ? this.sprintCfg.bobScale : cfg.bobScale;
      this.dustScale = sprinting ? this.sprintCfg.dustScale : cfg.dustScale;
    }

    const sy = Math.sin(inp.yaw);
    const cy = Math.cos(inp.yaw);
    const fwd = inp.forward;
    const str = inp.right;

    // Bike momentum: approach the target velocity (accelerate while pedalling,
    // roll on when coasting) instead of snapping — the "vehicle" feel. On foot,
    // velocity snaps (crisp FPS control). Steering-only (no throttle) coasts.
    const moving = this.riding_ ? fwd !== 0 : fwd !== 0 || str !== 0;
    const bikeK =
      1 -
      Math.exp(-this.fixedStep / (moving ? this.bike.accelTau : this.bike.brakeTau));

    // Fixed-step accumulator → framerate-independent feel. Clamp dt so a
    // backgrounded tab can't explode the tick count.
    this.accum += Math.min(dt, 0.1);
    let moved = 0;
    while (this.accum >= this.fixedStep) {
      this.accum -= this.fixedStep;
      cc.velocity.y += this.gravity * this.fixedStep;
      if (this.riding_) {
        // Bicycle: A/D steers the heading, W/S throttles ALONG it — no strafe,
        // reverse allowed — with momentum. This is what makes it ride like a bike.
        this.bikeHeading_ += this.bike.turnRate * str * this.fixedStep;
        const tx = -Math.sin(this.bikeHeading_) * speed * fwd;
        const tz = -Math.cos(this.bikeHeading_) * speed * fwd;
        cc.velocity.x += (tx - cc.velocity.x) * bikeK;
        cc.velocity.z += (tz - cc.velocity.z) * bikeK;
      } else {
        // On foot: camera-relative omnidirectional WASD, snapped (crisp).
        // forward = (−sy, 0, −cy), right = (cy, 0, −sy)
        let wx = cy * str - sy * fwd;
        let wz = -sy * str - cy * fwd;
        const wl = Math.hypot(wx, wz);
        if (wl > 1e-6) {
          wx = (wx / wl) * speed;
          wz = (wz / wl) * speed;
        } else {
          wx = 0;
          wz = 0;
        }
        cc.velocity.x = wx;
        cc.velocity.z = wz;
      }
      // Jump only on foot, standing.
      if (inp.jump && cc.grounded && !this.riding_ && this.stance === 'stand') {
        cc.velocity.y = this.jumpSpeed;
      }
      moved += cc.move(
        cc.velocity.x * this.fixedStep,
        cc.velocity.y * this.fixedStep,
        cc.velocity.z * this.fixedStep
      );
    }
    this.movedThisFrame = moved;

    // Parked-bike collision: on foot the bike is a solid object you can't walk
    // through. It arms (becomes solid) only once you've stepped clear of its
    // core, so spawning or dismounting on top of it never shoves you. The push
    // goes through cc.move so it slides along walls instead of tunnelling you
    // into one. Mounting is unaffected: the blocked core (BIKE_COLLIDE_RADIUS)
    // is well inside mountRadius.
    if (!this.riding_) {
      const dxb = cc.position.x - this.bikePos_.x;
      const dzb = cc.position.z - this.bikePos_.z;
      const d = Math.hypot(dxb, dzb);
      const solidR = BIKE_COLLIDE_RADIUS + this.radius_;
      if (!this.bikeArmed_) {
        if (d > solidR + 0.2) this.bikeArmed_ = true; // stepped clear → now solid
      } else if (d > 1e-4 && d < solidR) {
        const corr = solidR - d;
        cc.move((dxb / d) * corr, 0, (dzb / d) * corr);
      }
    }

    // Glide the eye toward the target (smooth stance / mount transitions).
    this.eye += (eyeTarget - this.eye) * (1 - Math.exp(-dt / 0.09));
    return moved;
  }

  /** Write the camera eye position (feet + glided eye) into `out`; returns it. */
  eyePosition(out: Vec3Like): Vec3Like {
    out.x = this.cc.position.x;
    out.y = this.cc.position.y + this.eye;
    out.z = this.cc.position.z;
    return out;
  }

  /** Longest unobstructed distance a third-person camera can pull back along the
   *  unit direction (dx,dy,dz) from the eye (ox,oy,oz) before it would clip world
   *  geometry. Raycasts the static world and stops `pad` metres short of the
   *  first hit, so the chase cam tucks in against a wall behind you instead of
   *  seeing through it. Returns `dist` unobstructed. */
  cameraDistance(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    dist: number,
    pad = 0.3
  ): number {
    const out = this.camHit_;
    if (
      this.world.raycast(ox, oy, oz, dx, dy, dz, dist, MASK.CHARACTER, out) &&
      out.hit
    ) {
      return Math.max(0.25, out.t - pad);
    }
    return dist;
  }

  /** Kinematic-caller seam (unboarded follow): push a feet position out of solids.
   *  Leaves `pos.y` for the caller's own ground snap. */
  collide(pos: Vec3Like, _r?: number): void {
    this.cc.setPosition(pos.x, pos.y, pos.z);
    this.cc.depenetrate();
    pos.x = this.cc.position.x;
    pos.z = this.cc.position.z;
  }

  dispose(): void {
    this.world.dispose();
  }
}
