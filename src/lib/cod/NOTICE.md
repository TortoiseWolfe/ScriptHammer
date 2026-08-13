# Vendored from Claude-of-Duty (MIT)

Source: https://github.com/mshumer/Claude-of-Duty (Matt Shumer), MIT license (see LICENSE).

Verbatim-vendored subsystem primitives (framework-agnostic, `three`-only, 100% procedural):

- `math.js`, `surfaces.js` — pure scalar/geometry kernel + surface vocabulary
- `character.js` — swept-capsule character controller (no THREE import; queries a `world` handle)
- `bvh.js` — StaticWorld: binned-SAH BVH over triangle soup + raycast/capsuleCast queries (plain THREE)
- `springs.js` — Spring/RecoilAxis camera-feel helpers (zero imports)

Ported r180 → r184: these import `three` (r184 in this repo). Runtime-verified against r184 by `scripts/cod-physics-smoke.mjs`.
Only the OVERWATCH `ctx` wiring was dropped; the primitives run standalone.

## Local changes to the vendored files

Kept deliberately minimal — anything beyond a genuine upstream bug belongs in our own code.

- **`bvh.js` — `bakeMesh` reads positions the way THREE does (#702).** Upstream read
  `posAttr.array` with `itemSize` as the stride, which is correct only for tightly packed,
  un-normalized Float32 attributes. The digital-twin landmarks are `KHR_mesh_quantization` +
  `EXT_meshopt_compression` GLBs: POSITION is Int16 with `normalized: true`, and meshopt
  decoding produces interleaved buffers. Baking those raw put every collision shell 32767×
  too large and far outside the city. `bakeMesh` now denormalizes (`denormScale`) and honours
  `InterleavedBufferAttribute` (`data.array` / `data.stride` / `offset`).
  Covered by `tests/unit/walk-model-colliders.test.ts`.

- **`bvh.js` — optional single-sided triangle collision (#713).** New `cullBackfaces` flag,
  **off by default**, consulted in `raycast`, `sweepCapsule` and `overlapCapsule`: when on, a
  query that meets a triangle's back face passes through it. This is the default behaviour of
  PhysX (back faces culled unless `PxMeshGeometryFlag::eDOUBLE_SIDED`) and of Godot's
  `ConcavePolygonShape3D` (`backface_collision = false`); upstream simply had no such option.
  Needed because the digital-twin landmarks have inconsistent winding, so faces the
  `FrontSide` renderer culls were still solid. Covered by
  `tests/unit/backface-collision.test.ts`.
