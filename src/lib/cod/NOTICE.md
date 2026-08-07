# Vendored from Claude-of-Duty (MIT)

Source: https://github.com/mshumer/Claude-of-Duty (Matt Shumer), MIT license (see LICENSE).

Verbatim-vendored subsystem primitives (framework-agnostic, `three`-only, 100% procedural):
- `math.js`, `surfaces.js` — pure scalar/geometry kernel + surface vocabulary
- `character.js` — swept-capsule character controller (no THREE import; queries a `world` handle)
- `bvh.js` — StaticWorld: binned-SAH BVH over triangle soup + raycast/capsuleCast queries (plain THREE)
- `springs.js` — Spring/RecoilAxis camera-feel helpers (zero imports)

Ported r180 → r184: these import `three` (r184 in this repo). Runtime-verified against r184 by `scripts/cod-physics-smoke.mjs`.
Only the OVERWATCH `ctx` wiring was dropped; the primitives run standalone.
