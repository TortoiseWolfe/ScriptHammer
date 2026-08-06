# Vendored from Claude-of-Duty (MIT) — procedural sky

Source: https://github.com/mshumer/Claude-of-Duty (Matt Shumer), MIT (see ../LICENSE).

Procedural atmospheric sky + IBL env map (`three`-only, GLSL3, zero art assets,
no HDRI). Vendored the 8 framework-agnostic files for a STATIC sky + env bake:
fullscreen, atmosphere, noise, stars, clouds, luts, celestial, dome. `index.js`
(the OVERWATCH shell) is NOT vendored — its ctx wiring is replaced by `driver.js`
(buildSharedUniforms + updateCelestial ports). `volumetrics.js` is dropped
(light shafts depend on CoD's post chain). Env map = equirect blit → PMREM →
scene.environment; the dome is a renderOrder -10000 background mesh.
