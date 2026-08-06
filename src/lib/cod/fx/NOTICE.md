# Vendored from Claude-of-Duty (MIT) — GPU particles

Source: https://github.com/mshumer/Claude-of-Duty (Matt Shumer), MIT (see ../LICENSE).

`ParticleLayer` — a deterministic GPU particle system: instanced quads, per-particle
sim in the vertex shader (closed-form from a `uTime` clock, CPU never re-touches a
particle after spawn). Standalone `THREE.ShaderMaterial` (GLSL3) — three-only, no ctx,
no renderer, and r184-safe (no onBeforeCompile / no shader-chunk patching). Only this
one file is vendored; the sprite atlas + FPS effects (impacts/muzzle/decals/…) are not.
Lifecycle: new ParticleLayer({capacity,mode,atlas,cols,soft}) → .mesh (add to scene) →
resetSpawn()+emit(SP,now) per particle → flush(now) each frame → dispose().
