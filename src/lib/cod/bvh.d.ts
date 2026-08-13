// Hand-written public types for the vendored `bvh.js` (Claude-of-Duty, MIT).
// The runtime is the sibling .js (bundled); this declares its public API surface.
import type * as THREE from 'three';

/** A collision hit record (see `math.makeHitRecord`). */
export interface HitRecord {
  hit: boolean;
  /** Time of impact / parametric distance. */
  t: number;
  /** Contact point. */
  px: number;
  py: number;
  pz: number;
  /** Contact normal (faces the query). */
  nx: number;
  ny: number;
  nz: number;
  tri: number;
  surface: number;
  object: number;
  frontFace: boolean;
  body: unknown;
}

export interface AddMeshOptions {
  userData?: unknown;
}

/**
 * Static world: triangle soup + binned-SAH BVH. Register meshes, `build()`, then
 * run raycast / swept-capsule / overlap queries. Allocation-free after build.
 */
export class StaticWorld {
  constructor();

  /** Bake a mesh (or InstancedMesh) into world-space triangles. Returns the object id, or -1. */
  addMesh(
    mesh: THREE.Mesh | THREE.InstancedMesh,
    surface?: string | number,
    mask?: number,
    opts?: AddMeshOptions
  ): number;
  /** Register raw world-space triangles (Float32Array, 9 floats each). */
  addTriangles(
    positions: Float32Array,
    count: number,
    surface: string | number,
    mask?: number,
    name?: string
  ): number;
  removeObject(id: number): boolean;
  findByMesh(mesh: THREE.Object3D): number;

  /**
   * Single-sided triangle collision (#713): a hit on a triangle's BACK passes through.
   * Off by default. Matches PhysX (back faces culled unless `eDOUBLE_SIDED`) and Godot
   * (`ConcavePolygonShape3D.backface_collision = false`).
   */
  cullBackfaces: boolean;

  /** Rebuild the BVH after adding/removing meshes. */
  build(): void;

  /** Closest-hit ray query. Writes into `out`; returns true on hit. */
  raycast(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    mask: number,
    out: HitRecord,
    ignoreObject?: number
  ): boolean;
  /** Any-hit shadow/visibility ray. */
  raycastAny(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    mask: number
  ): boolean;
  /** Swept capsule vs the static world (true time of impact, no tunnelling). */
  sweepCapsule(
    p0x: number,
    p0y: number,
    p0z: number,
    p1x: number,
    p1y: number,
    p1z: number,
    radius: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    mask: number,
    out: HitRecord
  ): boolean;
  /** Penetration contacts for a capsule at rest (fills `this.contacts`). Returns count. */
  overlapCapsule(
    p0x: number,
    p0y: number,
    p0z: number,
    p1x: number,
    p1y: number,
    p1z: number,
    radius: number,
    mask: number,
    margin?: number
  ): number;

  surfaceOf(tri: number): number;
  dispose(): void;

  readonly triCount: number;
  /** World-space bounds of every baked triangle. Valid after `build()`. */
  readonly aabb: {
    minx: number;
    miny: number;
    minz: number;
    maxx: number;
    maxy: number;
    maxz: number;
  };
  /** Increments once per `build()` — a direct rebuild counter (#702). */
  readonly version: number;
  /** Wall-clock cost of the last `build()`, ms. */
  readonly buildMs: number;
}
