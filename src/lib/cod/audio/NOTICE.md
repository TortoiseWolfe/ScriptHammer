# Vendored from Claude-of-Duty (MIT) — procedural audio (footsteps)

Source: https://github.com/mshumer/Claude-of-Duty (Matt Shumer), MIT (see ../LICENSE).

Minimal set for surface-keyed procedural footsteps (pure Web Audio, zero assets,
three-free, no ctx): rng.js (seedable PRNG, copied from src/core/rng.js),
dsp.js (NoiseBank + synth primitives), foley.js (footstep() + its STEP table,
imports only ./dsp.js). Not vendored: mixer/spatial/ir/ambience/index/weapons/vox.
foley's STEP surface keys are byte-identical to the physics SURFACE_NAMES, so
CharacterController.groundSurfaceName passes straight through (fallback: concrete).
