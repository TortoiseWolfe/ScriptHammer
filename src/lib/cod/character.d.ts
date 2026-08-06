// Hand-written public types for the vendored `character.js` (Claude-of-Duty, MIT).
// The runtime is the sibling .js (bundled); this declares its public API surface.
import type { StaticWorld } from './bvh';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CharacterControllerOptions {
  id?: string;
  owner?: unknown;
  /** Capsule radius (default 0.32). */
  radius?: number;
  /** Total capsule height, feet to crown (default 1.78). */
  height?: number;
  /** Max step-up height (default 0.42). */
  stepHeight?: number;
  /** Walkable slope limit in radians (default 50°). */
  slopeLimit?: number;
  snapDistance?: number;
  /** Collision mask (see MASK in surfaces). */
  mask?: number;
  maxIterations?: number;
  position?: Vec3;
}

/**
 * Swept-capsule character controller — collide and slide. Kinematic: the caller
 * owns velocity each fixed step; `move()` resolves a displacement against the
 * static BVH and only clips velocity against contacts.
 */
export class CharacterController {
  constructor(world: StaticWorld, opts?: CharacterControllerOptions);

  radius: number;
  height: number;
  stepHeight: number;
  slopeLimit: number;
  snapDistance: number;
  mask: number;
  maxIterations: number;

  /** Feet position (bottom of the capsule) — the authoritative transform. */
  readonly position: Vec3;
  /** Velocity owned by the caller; `move()` only clips it against contacts. */
  readonly velocity: Vec3;

  grounded: boolean;
  wasGrounded: boolean;
  readonly groundNormal: Vec3;
  groundSurface: number;
  groundDistance: number;
  groundObject: number;
  onSteepSlope: boolean;
  touchingCeiling: boolean;
  touchingWall: boolean;
  readonly wallNormal: Vec3;
  lastMoveBlocked: boolean;
  steppedUp: number;
  /** Impact speed along the ground normal on the frame the character landed. */
  landingSpeed: number;
  enabled: boolean;

  get cosSlope(): number;
  get p0y(): number;
  get p1y(): number;
  get groundFriction(): number;
  get groundSurfaceName(): string;

  setPosition(x: number, y: number, z: number): void;
  teleport(x: number, y: number, z: number): void;
  /**
   * Change capsule height keeping the feet planted. Returns false if standing up
   * is blocked by a ceiling (caller stays crouched).
   */
  setHeight(h: number, force?: boolean): boolean;
  /** Would a capsule of `h` metres fit at the current feet position? */
  canFit(h: number): boolean;
  /**
   * Resolve a displacement (metres for this step). Returns the distance actually
   * travelled.
   */
  move(dx: number, dy: number, dz: number): number;
  depenetrate(iterations?: number): number;
  probeGround(): boolean;
  checkCapsule(x: number, y: number, z: number, height?: number): boolean;
}
