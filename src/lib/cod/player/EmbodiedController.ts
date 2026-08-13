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
import { LAYER, MASK } from '../surfaces';
import { makeHitRecord } from '../math';
import type { Mesh, Object3D } from 'three';

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
  /** Max steering rate, rad/s — the cap A/D can turn the heading at (reached only
   *  once rolling; see turnGain). */
  turnRate: number;
  /** How steering authority ramps with roll speed, rad/s per m/s. The heading
   *  turns at min(turnRate, turnGain · speed), so at a standstill (speed 0) the
   *  front wheel does NOT rotate the bike — it needs forward motion to bite
   *  (a bicycle is non-holonomic; you can't pivot in place). */
  turnGain: number;
  /** Hop take-off speed, m/s (#705). Deliberately below the on-foot jump — enough to
   *  clear a kerb or pop off a stair edge, not to launch. Ramps do the real launching. */
  hop: number;
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
  /**
   * Single-sided triangle collision (#713) — a hit on a triangle's BACK passes through.
   * PhysX and Godot both default to this; here it is opt-in, because it is only correct
   * for worlds whose walls are consistently wound, and the twin's landmarks are not.
   */
  cullBackfaces?: boolean;
  /** Fired when the player state label changes — a foot stance
   *  (`stand`/`crouch`/`prone`) or `bike`. A raise blocked by a ceiling does NOT
   *  fire. Wire a HUD / event bus here. */
  onStanceChange?: (label: Stance | 'bike') => void;
}

/** Human-scale defaults for the real-metre digital twin. */
const DEFAULT_STANCE: Record<Stance, StanceCfg> = {
  stand: {
    height: 1.85,
    eye: 1.7,
    speedRatio: 1,
    gait: 'walk',
    bobScale: 1,
    dustScale: 1,
  },
  crouch: {
    height: 1.0,
    eye: 1.0,
    speedRatio: 0.5,
    gait: 'crouch',
    bobScale: 0.5,
    dustScale: 0.4,
  },
  prone: {
    height: 0.5,
    eye: 0.45,
    speedRatio: 0.28,
    gait: 'crouch',
    bobScale: 0.2,
    dustScale: 0.25,
  },
};
// base 3.3 × 2.2 ≈ 7.3 m/s sprint (games run ~2–4× real pace: a flat monitor's
// narrow FOV kills the optic-flow that conveys speed, so real 1.4 m/s reads as a
// crawl — CoD-ish jog-default is the fix).
const DEFAULT_SPRINT: SprintCfg = {
  speedRatio: 2.2,
  gait: 'sprint',
  bobScale: 1.4,
  dustScale: 1.6,
};
// Bike: cruise ~14 m/s, pedal-hard ~22; ~1 s to reach speed, ~2.5 s coast; mount
// within 2.5 m of where it's parked.
const DEFAULT_BIKE: BikeCfg = {
  speed: 16,
  sprint: 28,
  eye: 1.5,
  accelTau: 0.35, // snappy pick-up — reaches cruise in ~1 s (was a sluggish 1.0)
  brakeTau: 1.5, // a short roll on release, not a long glide
  mountRadius: 3, // a touch more forgiving to walk up and mount
  turnRate: 2.2, // steering-rate CAP (rad/s), reached only while rolling
  turnGain: 0.5, // steering authority ramps with speed; 0 at a standstill
  // Hop height is v²/2g. At g = 22 m/s², 5.15 m/s buys 5.15²/44 = 0.60 m — measured at
  // 0.37 m with the previous 3.8, which fired correctly and was simply too small to read
  // as a hop from a 1.5 m saddle while moving. Still well under the 7 m/s on-foot jump.
  hop: 5.15,
};

/**
 * Terminal velocity, m/s (#705).
 *
 * A body falling at more than this is not simulating anything — it is carrying stored
 * integration error. The runaway this clamps was measured at **-220 m/s after 10 s on
 * flat ground**, which is what made leaving a ledge read as an instantaneous snap to the
 * surface below rather than a fall.
 */
const TERMINAL_VELOCITY = -60;

/**
 * How much authority the input has over horizontal velocity while airborne (#705).
 *
 * Momentum-preserving, by choice: the speed you leave a ramp with is the speed you carry
 * through the arc. Steering nudges the direction; it cannot accelerate or brake. Zero
 * would be pure ballistic and unrecoverable; 1 would let you swim through the air and
 * would reintroduce the bug where releasing the throttle BRAKES the bike in mid-flight.
 */
const AIR_CONTROL = 0.12;

/**
 * How fast the remembered climb rate fades, m/s² (#705).
 *
 * The climb that becomes take-off velocity is measured from the body's own vertical
 * progress rather than projected from the ground normal, because a staircase tread has
 * ny = 1 — normal projection yields exactly zero launch off stairs, which is the case the
 * owner asked for by name ("jump the bike off of them like a ramp"). Measuring what the
 * body actually climbed covers smooth ramps and stepped geometry with one mechanism.
 *
 * It is held as a decaying PEAK rather than an average because the ground-snap keeps the
 * body nominally grounded for ~0.5 m past a lip while it is already descending; an
 * average is dragged negative by exactly the frames before take-off. At 12 m/s² a climb
 * is forgotten in ~0.2 s — long enough to survive that overshoot, short enough that
 * riding downhill and off a ledge produces no phantom pop.
 */
const CLIMB_DECAY = 12;
/** Climb rate below which take-off is just walking off an edge, m/s. */
const LAUNCH_MIN = 0.5;
/** Cap on take-off speed derived from the climb rate, m/s. */
const MAX_LAUNCH = 9;

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
  /** Smoothed rate of climb while grounded, m/s — becomes take-off velocity (#705). */
  private climbRate_ = 0;
  /** Feet height at the end of the previous fixed step, for the climb estimate. */
  private prevY_ = 0;
  /** The controller's configured ground-snap distance, so it can be suspended while
   *  rising and restored afterwards (#705). */
  private readonly snapDistance_: number;
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
    this.snapDistance_ = this.cc.snapDistance;
    this.eye = stand.eye;
    this.prevY_ = this.cc.position.y;
    // Bike starts parked at the spawn point (mountable from frame 0).
    const sp = config.spawn ?? { x: 0, y: 0, z: 0 };
    this.bikePos_.x = sp.x;
    this.bikePos_.y = sp.y;
    this.bikePos_.z = sp.z;
  }

  /** Build from prebuilt THREE meshes (world-space; `bakeMesh` reads matrixWorld).
   *  Each spec's `surface` tags footing/footstep audio. */
  static fromMeshes(
    specs: ReadonlyArray<{
      mesh: Mesh | null | undefined;
      surface: string | number;
    }>,
    config: EmbodiedConfig = {}
  ): EmbodiedController {
    const world = new StaticWorld();
    world.cullBackfaces = config.cullBackfaces === true;
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
  /** Live velocity, m/s. The controller owns integration — treat as read-only. */
  get velocity(): Vec3Like {
    return this.cc.velocity;
  }
  /** Vertical velocity, m/s; positive is rising. Exposed because a trajectory can only
   *  be tested by reading it (#705). */
  get verticalVelocity(): number {
    return this.cc.velocity.y;
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
  /**
   * Add a mesh hierarchy to the LIVE collision world (#702).
   *
   * WHY THIS EXISTS RATHER THAN A REBUILD. The landmark and bridge GLBs load
   * asynchronously, long after terrain and buildings. Two ways to give them
   * collision were possible and one is a trap:
   *
   *   - Rebuild the controller when a GLB arrives. That re-seeds the player and
   *     the bike to the spawn point — #703, the "my bike moved on its own" bug.
   *     Never do this.
   *   - Grow the existing world. `StaticWorld.addMesh()` appends and sets
   *     `dirty`, and `build()` re-derives the BVH from every live object, so the
   *     world can take new geometry without the controller — and therefore the
   *     player's and bike's poses — being touched at all.
   *
   * `bakeMesh` needs real geometry, so a GLB root (a Group) is traversed and each
   * child Mesh added individually; passing the Group alone silently adds nothing.
   *
   * DOES NOT BUILD THE BVH — call `commitColliders()` once when a batch is in.
   *
   * That split is not fussiness. `chatt` places 129 models, and building per
   * model means 129 BVH rebuilds over an ever-larger triangle set (measured:
   * ~261k triangles across all nodes, ~87k for LOD0 alone). Rebuilding is the
   * expensive part; adding is cheap. One build for the batch, not one per model.
   *
   * @param root  a Mesh or any Object3D to traverse (typically a GLB LOD group)
   * @param surface  footing/footstep tag, e.g. 'concrete'
   * @returns the collision-object ids added — pass them to `removeColliders`
   *          later. Empty means nothing collidable was found, which is worth
   *          surfacing rather than assuming success.
   */
  addCollider(
    root: Object3D | null | undefined,
    surface: string | number
  ): number[] {
    if (!root) return [];
    const ids: number[] = [];
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || !m.geometry) return;
      // Marked single-sided (#713): these imported models have inconsistent winding, so
      // faces the FrontSide renderer culls were still solid. The terrain and massing boxes
      // go through `fromMeshes` and keep double-sided collision, so no ground triangle can
      // ever become a hole.
      const id = this.world.addMesh(
        m,
        surface,
        LAYER.STATIC | LAYER.SINGLE_SIDED
      );
      if (id >= 0) ids.push(id);
    });
    return ids;
  }

  /** Rebuild the BVH after a batch of `addCollider` / `removeColliders` (#702). */
  commitColliders(): void {
    this.world.build();
  }

  /**
   * Drop previously added colliders (#702) — the ids from `addCollider`.
   *
   * Needed because a model can unmount: without this, walking through where a
   * landmark USED to be would hit an invisible wall, which is a worse bug than
   * the one collision fixes.
   */
  removeColliders(ids: readonly number[]): void {
    if (!ids.length) return;
    for (const id of ids) this.world.removeObject(id);
    // Same batching contract as `addCollider`: the caller commits. A mass unmount is
    // as capable of triggering a rebuild storm as a mass mount.
  }

  get triCount(): number {
    return this.world.triCount;
  }

  /**
   * What am I looking at? Returns the collision-object id under the crosshair, or -1 (#706).
   *
   * Deliberately a ray into the COLLISION world rather than a scene-graph pick: what you
   * can inspect is then exactly what you can bump into, so a building that turns out not to
   * be selectable is itself the report that it is not solid. It also means the caller needs
   * no access to the BVH internals — it maps the id back through whatever registry it used
   * to add the collider.
   */
  lookAt(dx: number, dy: number, dz: number, maxDist = 150): number {
    const l = Math.hypot(dx, dy, dz);
    if (l < 1e-6) return -1;
    const eye = this.eyePosition({ x: 0, y: 0, z: 0 });
    const hit = this.camHit_;
    const ok = this.world.raycast(
      eye.x,
      eye.y,
      eye.z,
      dx / l,
      dy / l,
      dz / l,
      maxDist,
      MASK.CHARACTER,
      hit
    );
    return ok ? hit.object : -1;
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
      speed =
        this.walkSpeed *
        (sprinting ? this.sprintCfg.speedRatio : cfg.speedRatio);
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
      Math.exp(
        -this.fixedStep / (moving ? this.bike.accelTau : this.bike.brakeTau)
      );

    // Fixed-step accumulator → framerate-independent feel. Clamp dt so a
    // backgrounded tab can't explode the tick count.
    this.accum += Math.min(dt, 0.1);
    let moved = 0;
    let wasGrounded = cc.grounded;
    while (this.accum >= this.fixedStep) {
      this.accum -= this.fixedStep;
      // Standing on the floor must not bank downward velocity (#705). Nothing clipped it
      // on the grounded path — `_slide` there is horizontal-only, so no contact plane is
      // ever hit and `_clipVelocity` never runs. Measured: -220 m/s after 10 s of walking
      // on FLAT ground, all of it discharged in a single step the moment you cleared a
      // ledge. That is what read as "the bike snaps to nearest surface level".
      if (cc.grounded && cc.velocity.y < 0) cc.velocity.y = 0;
      cc.velocity.y += this.gravity * this.fixedStep;
      if (cc.velocity.y < TERMINAL_VELOCITY) cc.velocity.y = TERMINAL_VELOCITY;
      // AIRBORNE = MOMENTUM (#705). Ground locomotion assumes traction; running it in
      // mid-flight is what made arcs collapse — releasing the throttle set the bike's
      // target speed to 0 and it BRAKED against thin air. Off the ground the speed you
      // took off with is the speed you carry, and input only nudges the direction.
      const airborne = !cc.grounded;
      const authority = airborne ? AIR_CONTROL : 1;

      if (this.riding_) {
        // Bicycle: A/D steers the heading, W/S throttles ALONG it — no strafe,
        // reverse allowed — with momentum. NON-HOLONOMIC: the heading only turns
        // as the bike ROLLS — the turn rate scales with current ground speed
        // (capped at turnRate), so at a standstill A/D does nothing. You can't
        // pivot in place; the front wheel needs forward motion to consume the
        // steering. Sign: the camera looks (−sin h, −cos h), so an INCREASING
        // heading turns screen-LEFT — D (right = +1) must turn RIGHT, so it
        // DECREASES the heading, hence the minus.
        const rollSpeed = Math.hypot(cc.velocity.x, cc.velocity.z);
        const turn = Math.min(
          this.bike.turnRate,
          this.bike.turnGain * rollSpeed
        );
        this.bikeHeading_ -= turn * str * this.fixedStep;
        if (airborne) {
          // Hold the launch speed and steer the momentum, rather than re-targeting it
          // from the throttle. Without this the arc dies the moment you stop pedalling.
          const tx = -Math.sin(this.bikeHeading_) * rollSpeed;
          const tz = -Math.cos(this.bikeHeading_) * rollSpeed;
          cc.velocity.x += (tx - cc.velocity.x) * AIR_CONTROL;
          cc.velocity.z += (tz - cc.velocity.z) * AIR_CONTROL;
        } else {
          const tx = -Math.sin(this.bikeHeading_) * speed * fwd;
          const tz = -Math.cos(this.bikeHeading_) * speed * fwd;
          cc.velocity.x += (tx - cc.velocity.x) * bikeK;
          cc.velocity.z += (tz - cc.velocity.z) * bikeK;
        }
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
        if (airborne) {
          // Lerp, don't snap — a jump keeps its horizontal momentum. Standing still in
          // mid-air used to stop you dead above the ground.
          cc.velocity.x += (wx - cc.velocity.x) * authority;
          cc.velocity.z += (wz - cc.velocity.z) * authority;
        } else {
          cc.velocity.x = wx;
          cc.velocity.z = wz;
        }
      }
      // Jump on foot (standing) or a smaller hop on the bike (#705) — a bike that
      // cannot leave the ground cannot pop off a stair edge.
      if (inp.jump && cc.grounded) {
        if (this.riding_) {
          cc.velocity.y = this.bike.hop;
        } else if (this.stance === 'stand') {
          cc.velocity.y = this.jumpSpeed;
        }
      }
      // Don't cling to a lip you are leaving (#705). The stair-DESCENT snap exists to
      // keep you glued to the ground going downhill; applied to a body that is rising, or
      // that has just been climbing, it is exactly the "snaps to nearest surface level"
      // the owner reported — measured dragging the bike 0.5 m past the lip, descending
      // the whole way, before it was finally allowed to be airborne.
      cc.snapDistance =
        cc.velocity.y > 0.1 || this.climbRate_ > LAUNCH_MIN
          ? 0
          : this.snapDistance_;

      const yBefore = cc.position.y;
      moved += cc.move(
        cc.velocity.x * this.fixedStep,
        cc.velocity.y * this.fixedStep,
        cc.velocity.z * this.fixedStep
      );

      if (cc.grounded) {
        // How fast the body is ACTUALLY gaining height — not the ground normal, because
        // a staircase tread's normal points straight up and would yield no launch at all.
        //
        // A DECAYING PEAK, not a running average. Measured: leaving a ramp, the descent
        // snap keeps the body "grounded" for ~0.5 m past the lip while it drops, and an
        // average is dragged negative by those frames — the climb is forgotten a few
        // milliseconds before it is needed. The peak survives the overshoot and fades in
        // ~0.2 s, so riding DOWN a slope and off a ledge still gives no phantom pop.
        const rate = (cc.position.y - yBefore) / this.fixedStep;
        this.climbRate_ = Math.max(
          this.climbRate_ - CLIMB_DECAY * this.fixedStep,
          rate
        );
      } else if (
        wasGrounded &&
        this.climbRate_ > LAUNCH_MIN &&
        cc.velocity.y <= 0
      ) {
        // Just left a surface while climbing: convert that climb into real upward
        // velocity, so the body follows a ballistic arc instead of walking off an edge.
        cc.velocity.y = Math.min(this.climbRate_, MAX_LAUNCH);
        this.climbRate_ = 0;
      }
      if (!cc.grounded && cc.velocity.y <= 0) this.climbRate_ = 0;
      wasGrounded = cc.grounded;
      this.prevY_ = cc.position.y;
    }
    cc.snapDistance = this.snapDistance_;
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
