# Vendored from Claude-of-Duty (MIT) — materials forge

Source: https://github.com/mshumer/Claude-of-Duty (Matt Shumer), MIT (see ../LICENSE).

Procedural PBR material forge (`three`-only, zero art assets). Bakes surface
albedo/normal/ORM textures to WebGLRenderTargets at load time via fullscreen
fragment passes. Framework-agnostic: the OVERWATCH `ctx` is fully bypassed by
the `new MaterialSystem({ renderer })` option + `init({})` (no rng/events/config
needed on the `getTextureSet` "plain" path). Only these 10 files are vendored
(the minimal `getTextureSet` set): index, generator, library, shader, masks +
glsl/{noise,surfaces-arch,-ground,-metal,-organic}. `shader.js`/`masks.js` are
import-time-only on the plain path (extendMaterial/bakeMasks unused here).
