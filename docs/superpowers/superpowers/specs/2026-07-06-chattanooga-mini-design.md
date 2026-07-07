# Chattanooga Mini — Design Spec

**Date:** 2026-07-06
**Status:** Draft for review
**Scope of this spec:** M1 vertical slice (first buildable milestone). Later milestones (remaining objective packs, tours, agents) are sketched but not specified here.

---

## 1. What this is

A tilt-shift _miniature diorama_ of real downtown Chattanooga: accurate geometry (OSM
footprints + USGS terrain + real streets), stylized render (tilt-shift + toy palette),
guided tours, WASD sandbox, optional objectives. A **port** of an existing, complete
vanilla-three.js artifact game (`cm/*.js`) into a **Next.js 15 (App Router) + React Three
Fiber** project, with all geodata **baked offline** so the runtime makes zero third-party
calls.

### 1.1 Corrected premise (important)

The original build prompt says _"port `Rig`/`Hud`/light-rig/material-kit from ScriptHammer
Stage."_ Verified on disk: **ScriptHammer's actual R3F code is only a brand-logo spinner**
(`src/components/game/Scene/Scene.tsx`). It has no Rig, no Hud, no tilt-shift, no light-rig,
no material kit. Those artifacts live in the **`cm/*.js` artifact game**, which is complete
and high quality. Therefore:

- **Port FROM:** the `cm/*.js` game (vanilla-three r128 → R3F/TSX). This is the real source
  of Stage, Rig, Hud, tilt-shift shaders, light rig, world, and agents.
- **Adopt FROM ScriptHammer:** its _conventions only_ — Next 15 App Router, dynamic import
  `ssr:false`, DaisyUI theme-token reading, `getAssetUrl()`/basePath handling, Docker-first
  (no host installs), static export to GitHub Pages, 5-file component pattern.
- **Back-port later:** the generic R3F layer (`StageCore`, `Rig`, `Hud`, tilt-shift,
  light-rig, material-kit) becomes a new ScriptHammer ticket **after** it proves out here.
  This follows the house rule: _templates emerge from shipped apps, never template-first
  speculation._ Chattanooga Mini is the driving app; the ScriptHammer R3F template is the
  extraction.

### 1.2 Source-of-truth map

| Concern                                | Ported from                                            | New work                                                |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Renderer / composer / light-rig / loop | `cm/cm-app.js` (`createStage`)                         | Split into `StageCore` + composition root               |
| Camera controller (4 modes)            | `cm/cm-rig.js` (`CM.Rig`)                              | Make headless for R3F                                   |
| Tilt-shift + grade shaders             | `cm/cm-shaders.js`                                     | Re-host on raw `postprocessing` lib; fix color pipeline |
| HUD (glass, dock, sliders, crosshair)  | `cm/cm-hud.js`                                         | Make generic-by-props; add palette toggle + provenance  |
| World                                  | `cm/cm-world.js` (procedural gray-box — **replaced**)  | `ChattWorld` consuming baked OSM/terrain                |
| Agents (trolley)                       | `cm/cm-world.js` trolley follower                      | Re-anchor to a baked polyline over real streets         |
| Bake: drape + terrain + geocode        | `1450 Blythe Ferry Rd` demo (verbatim fetch mechanics) | Invert live→offline; add batching                       |
| Bake: OSM buildings/streets            | — (Blythe is single-site, has none)                    | **Genuinely new** — Overpass                            |

---

## 2. Architecture: the hard seam

Two subsystems. **Nothing crosses the seam at runtime.**

```
BAKE (offline, Docker service `chatt-bake`, run rarely)
  fetch-osm      Overpass  → 797 buildings + 1849 streets (ways + relations)   [needs User-Agent]
  fetch-terrain  OpenTopoData ned10m → dense elevation grid (batched)
  fetch-drape    USGS NAIP exportImage → single meter-proportional aerial      [public domain]
  build-scene    project → ENU metres, apply height heuristic, quantize, emit
        │  commits static, relative-keyed assets
        ▼
  public/chatt/  buildings.json  streets.json  terrain.json  heroes.json
                 drape.jpg  trolley.json  manifest.json  _raw/ (cached upstream)
        │  the ONLY thing that crosses the seam
        ▼
RUNTIME (Next 15 + R3F)
  loads committed static assets ONLY. Zero fetches to Overpass/OpenTopoData/NAIP.
  manifest header (© OpenStreetMap ODbL · USGS 3DEP · USGS NAIP) surfaced in HUD.
```

**Verified live from this machine (2026-07-06):** Overpass 200 (797 buildings, 1849
highways, 3 building relations; requires a `User-Agent` header — bare curl 406s),
OpenTopoData `ned10m` 200, USGS NAIP `exportImage` 200 (public-domain aerial). Esri
World_Imagery also 200 but is **local-only opt-in** (redistribution terms); the committed
drape uses NAIP to keep the repo redistribution-clean.

### 2.1 The box (WGS-84)

```
SW 35.0340 N, -85.3160 W   ·   NE 35.0600 N, -85.3000 W
≈ 2.9 km N–S × 1.45 km E–W  ·  origin (ENU 0,0) = center ≈ 35.0470 N, -85.3080 W
```

North edge = Tennessee River (+ north-shore sliver for the bridge). West = US-27. East =
bluff / Georgia Ave. South = Southside / the Choo Choo. **Tight-core fallback** (south edge
→ 35.0420) exposed as a one-line config constant. **Lock the bbox before the first bake** —
box redlines are cheap now, expensive after data is committed.

### 2.2 ENU projection (equirectangular, per the Blythe reference)

Origin = box center. Local metres:

```
metersPerDegree_lon = 111320 · cos(lat_center)     // 91136 m/° at 35.047°  (cos = 0.8187)
metersPerDegree_lat = 110574
x_enu = (lon − lon_c) · metersPerDegree_lon
z_enu = −(lat − lat_c) · metersPerDegree_lat        // north = −Z (matches cm-world convention)
```

Accurate to sub-metre across a 2.9 km span at this latitude — adequate for a stylized
diorama. `cos(lat)` is a single constant for the box (not recomputed per row).

---

## 3. Runtime module design

File tree (revised from the prompt to add the composition root the god-object split needs):

```
app/
  page.tsx                    server component; dynamic import of ChattCanvas {ssr:false}
  ChattCanvas.client.tsx      COMPOSITION ROOT — mounts StageCore, wires world+rig+hud+packs
src/
  stage/
    StageCore.tsx             LIFTABLE. renderer/tonemap config, composer chain, resize,
                              loop, imperative handle. Zero imports from world/packs/agents.
    Rig.tsx                   LIFTABLE. headless 4-mode camera controller (ported cm-rig)
    Hud.tsx                   LIFTABLE. generic-by-props glass HUD
    lightRig.ts               LIFTABLE. day/night preset (ported cm-app light rig)
    materialKit.ts            LIFTABLE. MeshStandard presets + draped ground/terrain material
  post/
    tiltShift.ts              raw `postprocessing` EffectComposer builder (ported cm-shaders)
  world/                      PROJECT logic
    ChattWorld.tsx  Buildings.tsx  Terrain.tsx  Streets.tsx  Heroes.tsx  Avatar.tsx
  agents/
    trolley.tsx               PROJECT. CatmullRom follower over a baked polyline
  packs/                      PURE DATA
    themes.ts  tours.ts  objectives.ts
  lib/
    enu.ts  manifest.ts  assetUrl.ts   // assetUrl wraps basePath, adopted from ScriptHammer
scripts/bake/
  fetch-osm.ts  fetch-terrain.ts  fetch-drape.ts  build-scene.ts
public/chatt/
  buildings.json streets.json terrain.json heroes.json trolley.json manifest.json drape.jpg
  _raw/          cached upstream responses (osm.json, ned10m batches, drape source)
```

### 3.1 `StageCore` — the liftable unit (god-object split, BLOCKER fix)

`cm-app.js`'s `createStage` is a single-closure god-object: it hard-wires renderer +
day/night lights + `buildWorld` + `new Rig` + 9 Chattanooga waypoints (built from
`world.landmarks`) + Hud + WASD/T/1–4 hotkeys + avatar mesh + loop + playtest, all at once.
Ported as-is, "liftable into any Next15 R3F project unchanged" is false.

**Split:**

- **`StageCore`** (liftable): renderer/tone-map config (via `<Canvas gl>`/`onCreated`),
  the composer chain, resize (from `useThree` size), the single `useFrame` loop. Exposes an
  imperative handle: `scene`, `camera`, `registerAnimated(fn)`, `setLensUniforms({focus,
blur})`, `rig.board/unboard`, `setDay(t)`. **Imports nothing from `world`/`packs`/
  `agents`.** An automated import-guard test asserts this.
- **`ChattCanvas.client.tsx`** (composition root): mounts `StageCore`, composes `lightRig`
  - `ChattWorld` + `Rig` + `Hud` as `<Canvas>` children, and **injects waypoints from
    `packs/tours.ts`** as pure data. Owns `toggleBoard`, the `T` keybinding, and which object
    is boardable.
- Project chrome the god-object held moves to project files: avatar figure/arrow → `world/
Avatar.tsx`; waypoints → `packs/tours.ts`; playtest/wordmark/provenance → `packs`.

**Acceptance criterion retargets to `StageCore`, not `Stage`.**

### 3.2 Post-processing — raw `postprocessing`, single color owner (2 BLOCKERS)

**Blocker A — model mismatch.** `@react-three/postprocessing`'s `<EffectComposer>`/
`<Effect>` wraps the pmndrs `postprocessing` library, which _fuses_ Effect subclasses into
one merged shader. It **cannot host** cm's raw `{uniforms, vertexShader, fragmentShader}`
`ShaderPass` objects, and it **cannot express** cm's two-pass _separable_ tilt-shift blur (H
then V, each reading the previous framebuffer — a fused single-`mainImage` Effect collapses
the intermediate render target).

→ Depend on the **raw `postprocessing` package** directly (not the React wrapper). Build:

```
EffectComposer
  RenderPass(scene, camera)
  Bloom (BloomEffect via EffectPass, or ported UnrealBloom equivalent)
  ShaderPass(TiltShiftBlur)  direction (1,0)   // H
  ShaderPass(TiltShiftBlur)  direction (0,1)   // V
  ShaderPass(Grade)          terminal
```

Wrap each cm shader object in a `THREE.ShaderMaterial`; rename its input uniform `tDiffuse`
→ `inputBuffer` (the lib's `ShaderPass` default). Hold the composer in a `useMemo`/ref keyed
on `gl+scene+camera+size`; dispose on unmount; drive from **one** `useFrame((_,dt) =>
composer.render(dt))` at **high `renderPriority`** so R3F's own render is suppressed.

**Blocker B — double sRGB / double tonemap.** cm's `Grade` does its own `lin2srgb` as the
final step (valid in r128, where the examples composer bypassed `outputEncoding`). In three
0.184 + R3F 9, R3F sets `outputColorSpace = SRGBColorSpace` **and** the `postprocessing` lib
encodes sRGB on final output → Grade's `lin2srgb` becomes a _second_ encode (washed-out).
ACES tonemapping on the renderer compounds it.

→ **One color owner: the Grade pass.**

- `gl.toneMapping = NoToneMapping`; ensure neither R3F nor the lib adds a final sRGB
  conversion, so the **only** `lin2srgb` in the chain is inside Grade.
- Move cm's ACES tonemapping **into** the Grade shader (ACES approximation before
  `lin2srgb`), since the renderer no longer tonemaps.
- Delete `cm-app.js:23`'s dead `if (THREE.sRGBEncoding !== undefined) outputEncoding=…`
  guard — it no-ops on 0.184.
- **Verify gate (hard M1 blocker):** render a known linear-0.5 mid-gray through the full
  chain and eyedrop it — must read ~0.5 (≈188/255 after one sRGB encode), **not** ~0.73.
- **Re-tune order:** all `setDay()` magic numbers (`toneMappingExposure`, `bloom.threshold/
strength`, grade sat/contrast/vignette/lift) are **MUST-RETUNE-AFTER** the color pipeline
  is fixed. They were calibrated against r128 ordering; do not assume the ported values are
  right until the encode/tonemap count is verified.

### 3.3 `Rig` — headless controller (HIGH)

cm's Rig mutates `camera.position`/`quaternion` every frame and registers global
`window`/`document` listeners + pointer-lock. In R3F this fights the frame loop, drei camera
helpers, and StrictMode double-mount.

→ Make Rig a **headless controller**:

- Receives `camera` + `gl.domElement` via `useThree`; runs from a single `useFrame((_,dt)
=> rig.update(dt))`. **Delete cm's `requestAnimationFrame` loop** — R3F owns the loop.
- **Sole camera authority** — no concurrent drei `OrbitControls`/`PointerLockControls`.
- All listeners in a `useEffect` with cleanup mirroring `rig.dispose()`; attach mouse/
  pointer-lock to `gl.domElement` (canvas-scoped), not `window`, where possible.
- **StrictMode-safe:** idempotent binding, `exitPointerLock` on cleanup.
- `camera.rotation.order = 'YXZ'` on the R3F camera. Resize from `useThree(s => s.size)`,
  never a `window.resize` listener.

The four modes (`tour`/`orbit`/`follow`/`walk`) and tour-interruptible-into-orbit behavior
port from cm-rig.js essentially unchanged — that logic is already clean and mode-complete.
`board(obj:{position,heading})` stays the generic seam (the trolley satisfies it as data).

### 3.4 SSR boundary + r128→0.184 API audit (BLOCKER-adjacent)

- **`page.tsx` stays a server component**; it `dynamic()`-imports `ChattCanvas` with
  `{ssr:false}`. **Nothing** that transitively imports `postprocessing`, `three/examples`,
  or the Rig may be imported outside that boundary. Build-time check: no server bundle
  references `postprocessing` or `three/examples`.
- **Drop `window.THREE`/`window.CM` globals** entirely; convert cm modules to ESM importing
  `three` by name (so 0.184 module paths resolve and tree-shaking works).
- **Mechanical r128→0.184 audit:** `outputEncoding`/`sRGBEncoding` → `outputColorSpace =
SRGBColorSpace` (or leave to R3F); all `THREE.<PostFX>` globals → explicit imports; drape/
  hero textures `.colorSpace = SRGBColorSpace`; if UnrealBloom→BloomEffect, re-map
  `setDay()`'s bloom writes. Grep the ported tree for `Encoding`, `.encoding`, `THREE.`
  global refs, `renderToScreen` and fix each before first render.

### 3.5 Theming — two systems, explicit ownership (MEDIUM)

ScriptHammer's `getDaisyUIColorAsThree` + `data-theme` `MutationObserver` is a runtime
palette reader. If world materials adopt it, every DaisyUI theme switch (32 themes) yanks
the scene palette — fighting the app's own true-to-life ⇄ toy toggle.

→ **Palette packs are the single source of truth for WORLD material colors** (buildings,
terrain, streets, drape tint), driven by the palette-toggle state — **not** `data-theme`.
`getDaisyUIColorAsThree` is reserved for **HUD/chrome/UI accents** that _should_ track the
site theme. No `data-theme` observer on world materials.

### 3.6 Palette toggle — named profiles, not a boolean (MEDIUM)

The "toy" look is produced in three places: narrow 34° FOV (flattens perspective), the Grade
uniforms (which `setDay` _also_ animates), and the material palette + tilt-shift blur.

→ Model palette as a named profile in `packs/themes.ts`:
`{ gradeSat, gradeContrast, gradeVignette, fov, maxBlur, materialPalette }`. `setDay`
computes **base** values that the active profile scales/offsets — **one owner writes grade
uniforms**, so day/night and palette don't fight. **M1 ships two profiles differing in
grade + FOV + blur** (cheap, real). Per-material `true-to-life` recolor is deferred if OSM
materials aren't authored yet. Budget: ~half a day, not trivial.

### 3.7 `Hud` — generic by props (LOW, but required for M1)

cm-hud hardcodes "Chattanooga Mini", the subtitle, mode labels, slider ranges, and a "Run
playtest" button. → Hud takes `title`/`subtitle`, a mode list with labels, slider
descriptors, and an optional actions slot — all from `packs`. Wordmark, playtest button, and
provenance string live in Chattanooga-supplied config. M1 adds the **palette toggle** and the
**provenance line** to the HUD as generic slots.

### 3.8 `ChattWorld` — consuming the bake

Replaces cm-world's procedural generation entirely. Loads `public/chatt/*` (via
`getAssetUrl`, §4.4):

- **`Buildings.tsx`** — one `InstancedMesh` over baked footprints (extruded to baked height),
  instanced color by palette. Hero footprints tagged `userData.swap = "<name>"`.
- **`Terrain.tsx`** — `PlaneGeometry` displaced by the baked height grid (bilinear like
  Blythe), sized in ENU metres, draped with `drape.jpg`. **Asserts** its ground-quad extent
  equals `manifest.ground_w_m × ground_h_m` (fail loud — see §4.3).
- **`Streets.tsx`** — baked highway polylines as ribbons/lines.
- **`Heroes.tsx`** — hero-swap slots mounted at real landmark coordinates from the manifest;
  low-poly placeholder now, `userData.swap` tag for later Meshy/glTF drop-in. `grep -r
userData.swap src/` must list every slot.
- **`Avatar.tsx`** — the ground figure + facing arrow (moved out of Stage).

### 3.9 Trolley — baked polyline, not graph routing (HIGH scope fix)

"Re-anchor to the real street graph" secretly requires a routing+geometry subsystem
(stitching disjoint OSM ways into a cycle, arc-length resampling, lane offset, gap handling)
absent from cm — it can eat the whole slice.

→ **M1: bake ONE hand-authored trolley polyline** (`public/chatt/trolley.json` or
`packs/tours.ts`) drawn _over_ the real Broad/Market streets, fed into the **identical**
`CatmullRomCurve3` follower verbatim. Keeps the `{position, heading}` contract the Rig
already consumes. Graph-derived routing, lane offset, and snapping → **post-M1 ticket**.
Criterion reworded: _"trolley rides a baked polyline authored over the real streets."_

---

## 4. Bake subsystem design

All four scripts are written this session. Per the answered scope, **`fetch-osm` +
`fetch-terrain` run live in Docker now and commit real data**; drape bakes from open NAIP.

### 4.1 `fetch-osm.ts` (NEW — no Blythe reference)

- **Overpass POST** with a `User-Agent` header (verified required — bare requests 406).
- Query **ways AND relations**: `way["building"]`, `relation["building"]`,
  `relation["type"="building"]`, and `way["highway"]`, all with **`out geom;`** so member/
  node geometry returns inline. (Verified: 797 building ways, **3 building relations** — the
  relations are courtyard/multi-part footprints, often civic landmarks; a way-only query
  silently drops them.)
- build-scene assembles relation outer/inner rings into polygon-with-holes before
  triangulation.
- Retry-on-error with backoff; cache raw response to `public/chatt/_raw/osm.json` (~742 KB).

### 4.2 `fetch-terrain.ts` (port Blythe + add batching)

- **OpenTopoData `ned10m`**, `|`-joined `locations=lat,lon|…` grid, 5-decimal precision.
- **Grid density ~40×40** (verified the real risk is _resolution_, not rate limits): a coarse
  N-S grid smears the E-W-running riverfront bluffs. 40×40 = 1600 pts = **16 requests**
  against OpenTopoData's caps (100 loc/request, 1 req/s, 1000 req/day) — two orders of
  magnitude of headroom. **Batch into ≤100-point requests, throttle 1 req/s, retry-on-429
  backoff** (cheap insurance, not over-engineered).
- Bilinear resample (Blythe's `_bilinear`). Heights in metres; store metres, convert at
  render. Cache raw batches to `_raw/`.

### 4.3 `fetch-drape.ts` (port Blythe verbatim; NAIP; meter-proportional — BLOCKER fix)

- **USGS NAIP `exportImage`** (public domain — committable). Same ArcGIS `export` mechanism
  Blythe used for Esri; swap the host. `World_Street_Map` (or Wikimedia OSM raster) as the
  street-basemap alternative. Esri stays a **local-only opt-in** flag.
- **Meter-proportional pixel size (the 22% misregistration fix).** A 4326 `exportImage`
  returns _exactly_ the pixel grid requested. In plate-carrée every pixel is a fixed _degree_
  step, so degree-proportional sizing (616×1000 for this box) does **not** match the ENU
  ground's _metre_ aspect. Verified exact: box degree aspect 0.6154 vs true ground aspect
  0.5072; the ratio is `1/cos(lat) = 1.2215` = **22.1% E-W stretch** — every building would
  sit 22% off its own rooftop. Instead request:

  ```
  ground_w_m = (lonE − lonW) · 111320 · cos(lat_c)   // ≈ 1458 m
  ground_h_m = (latN − latS) · 110574                // ≈ 2875 m
  size = round(ground_w_m / mpp), round(ground_h_m / mpp)   // e.g. 729×1437 @ mpp=2 → aspect 0.5073
  ```

  Then UV-map the drape edge-to-edge (default 0..1) onto the ENU ground quad with **no client
  warp**. `mpp` (metres/pixel) is an independent sharpness/filesize knob (NAIP native is
  sub-metre; 2 m/px is a clean downsample).

- **Bake into `manifest.json`:** exact bbox, `mpp`, requested pixel size, `ground_w_m`,
  `ground_h_m`, `cos(lat_c)`. `Terrain.tsx` asserts its quad extent equals these at load
  (fail loud) so any future box/mpp change that reintroduces the squash is caught.
- On fetch error, fall back to vertex-color/contour ground (Blythe's own fallback).

### 4.4 `build-scene.ts` (deterministic; ENU; quantize; height heuristic)

- Project OSM footprints, streets, and terrain into the ENU metric frame (§2.2).
- **Height heuristic — treat the FALLBACK as the common case (HIGH).** Verified: of 797
  buildings only **97 have a `height` tag** and **120 have `building:levels`** — **~74% have
  neither**. Priority: (1) `height`; (2) `building:levels × 3.2 m`; (3) override table for
  named towers/landmarks; (4) **fallback bucketed by `building=` tag value**
  (commercial/retail/residential/house/garage → distinct level priors), clamped to a
  per-zone cap below the Republic Centre ceiling. Ship the **debug overlay coloring each
  building by which rule fired** (expect ~74% one color); **review it before sign-off**.
  Persist the fired-rule per building in `buildings.json` (auditable, not just a debug
  render). Consider a one-time manual override for the ~20 most visually dominant fallback
  buildings.
  - Override table (real heights; positions from OSM): Republic Centre 300 ft/21 fl · First
    Horizon Bank 204 ft · James Building 187 ft · Volunteer Life 165 ft · The Maclellan
    158 ft · Medical Arts 146 ft · Chattanooga Bank 132 ft · Patten Towers 130 ft · Sheraton
    Read House 130 ft.
- **Quantize geometry to keep the repo lean (HIGH).** Store footprints as ENU-metre
  Int16/Float32 relative to origin, **not** raw WGS-84 f64 (cuts JSON 3–5×). JSON for
  metadata; consider packed typed-array/delta encoding for geometry. Drape as optimized/
  compressed jpeg. `.gitignore` intermediate/debug bakes; commit only final minified
  artifacts. Target total `public/chatt/` under a few MB for fast GH-Pages first paint.
- **Reproducibility (MEDIUM).** Overpass/OpenTopoData/NAIP are live-mutable; "same inputs →
  same scene" holds only because outputs are committed. Cache raw upstream responses in
  `public/chatt/_raw/` and have build-scene read cache-if-present, so re-running the
  _derive_ step (e.g. to fix the height heuristic) is deterministic and code changes are
  cleanly attributable. Stamp `manifest.json` with fetch timestamp + a hash of each raw
  input. A true refetch is then an explicit, reviewable event.
- Emit `manifest.json` header with **provenance** (© OpenStreetMap ODbL · USGS 3DEP · USGS
  NAIP) — surfaced in the HUD.

### 4.5 Hero-swap landmarks

`aquarium`, `walnut_st_bridge`, `tivoli`, `dome_building`, `courthouse`, `hunter_museum`,
`choo_choo`, `republic_centre`. OSM gives footprint + position; a hand-authored/Meshy model
drops onto the footprint later. Everything else is honest OSM massing. Every slot tagged
`userData.swap = "<name>"`.

---

## 5. Conventions & deployment (adopted from ScriptHammer)

### 5.1 Docker-first bake — separate service (HIGH)

The house rule: never run `npm/pnpm install` or `node` on the host. So the bake is **not**
`npm run bake` on the host — it is a **separate compose service** `chatt-bake` (its own
target/image, distinct from the dev server), invoked:

```
docker compose run --rm chatt-bake        # runs tsx scripts/bake/*.ts in order
```

It mounts only `./scripts` and `./public/chatt`, and **writes to a temp dir then atomically
`mv`s into `public/chatt`** so the dev-server file watcher never sees partial JSON (avoids
the chokidar rebuild-storm / partial-serve race). **Do not run it while `docker compose up`
dev is live** unless using the atomic-mv path.

### 5.2 GitHub Pages basePath — every asset URL wrapped (BLOCKER)

ScriptHammer ships `output:'export'`, `trailingSlash:true`, and an auto-detected `basePath`
(e.g. `/chattanooga-mini`). In dev `basePath=''` so `fetch('/chatt/buildings.json')` works;
in the deployed project-site the asset lives at `owner.github.io/chattanooga-mini/chatt/…`
but a root-anchored `fetch('/chatt/…')` resolves against origin root and **404s** —
invisible in dev, fatal in production, and it takes down the whole scene at once (all JSON +
drape + `TextureLoader` paths fail together).

→ **Route EVERY runtime asset URL** (all `/chatt/*.json`, the drape image, any
`TextureLoader`/`loader.load` path) through `src/lib/assetUrl.ts` `getAssetUrl(path)`
(adopted from ScriptHammer's helper), which prefixes `config.basePath`. The bake emits
**relative keys** in `manifest.json`; the runtime resolves them with `getAssetUrl` at load —
**never store absolute `/chatt/…` strings.** Add a Playwright basePath-project smoke
(building with `NEXT_PUBLIC_BASE_PATH=/chattanooga-mini`) asserting the `buildings.json` +
drape requests return 200 under the prefix.

### 5.3 Renderer config (once, at root)

ACES (moved into the Grade shader — see §3.2), sRGB output owned solely by Grade, shadow
maps on, `dpr` clamped `[1, 1.75]`, `powerPreference: "high-performance"`. Instance every
repeated prop (buildings, trees, lamps, agents). Fog hides draw distance and pairs with the
tilt-shift far-blur.

---

## 6. M1 vertical slice — definition of done

The first buildable milestone. Everything else is "extend by pack," deferred.

- [ ] Baked OSM buildings + streets + terrain committed (real data: 797 buildings, 1849
      streets, ~40×40 NED-10m grid). NAIP drape committed (meter-proportional, registers).
- [ ] `ChattWorld` instances baked buildings, lays the draped terrain mesh, draws street
      polylines, mounts hero-swap slots (`userData.swap` on all 8).
- [ ] Recognizably **downtown Chattanooga** from miniature view — river, Walnut Street
      Bridge, Aquarium, Broad/Market spine, the Choo Choo, all in the right places.
- [ ] **Every position traces to OSM/USGS/geocode — nothing vibes-placed.**
- [ ] All four camera modes work; tour interruptible mid-rail; WASD + sprint + jump +
      pointer-lock look.
- [ ] Tilt-shift + grade ported, tuned per mode (miniature strongest, walk lightest).
      **Color-pipeline eyedrop gate passes** (linear-0.5 → ~0.5, not ~0.73).
- [ ] Palette toggles true-to-life ⇄ toy (grade + FOV + blur profiles); FPS counter toggles
      (`~`).
- [ ] HUD: loading gate → crosshair (walk) → four-mode toggle → tour caption → palette
      toggle → provenance line (© OpenStreetMap · USGS 3DEP · USGS NAIP). Nothing hard-coded.
- [ ] ONE tour pack (Riverfront Walk: Ross's Landing → Aquarium → Walnut St Bridge →
      Coolidge Park) with real-fact captions.
- [ ] Trolley rides a baked polyline over the real streets; board/exit works.
- [ ] Bake reproducible offline (raw cache + manifest hash); **no runtime third-party
      calls**; provenance shown in HUD.
- [ ] `StageCore`, `Rig`, `Hud`, `lightRig`, `materialKit` liftable into any Next15 R3F
      project unchanged; **import-guard test** asserts `StageCore` has zero
      `world`/`packs`/`agents` imports. Project logic lives in `world`/`packs`/`agents`/`bake`.
- [ ] Production static-export basePath smoke passes (assets 200 under `/chattanooga-mini`).

**Deferred to later milestones:** objective packs (landmark/photo, trolley-route, time-
trial, trivia); CBD Spine + Bluff & Rails tours; cars/peds/boats agents; street-graph-derived
trolley routing; per-material true-to-life recolor; BroadcastChannel multiplayer.

---

## 7. Back-port ticket (ScriptHammer)

After M1 proves out, open a ScriptHammer issue to extract the generic R3F layer as a reusable
template: `StageCore` (renderer/composer/loop/resize + imperative handle), `Rig` (4-mode
headless controller), `Hud` (generic-by-props glass HUD), `tiltShift` (raw-`postprocessing`
composer), `lightRig`, `materialKit`. Ships as a "3D Stage" template alongside the existing
logo-spinner `Scene`. Driven by _this_ app's shipped code, not speculation.

---

## 8. Risk ledger (from adversarial design review, all verified)

| #   | Sev     | Risk                                                           | Resolution                                          | §   |
| --- | ------- | -------------------------------------------------------------- | --------------------------------------------------- | --- |
| 1   | BLOCKER | react-postprocessing can't host cm's separable ShaderPass blur | raw `postprocessing` composer                       | 3.2 |
| 2   | BLOCKER | double sRGB + double tonemap → washed out                      | Grade is sole color owner; eyedrop gate             | 3.2 |
| 3   | BLOCKER | NAIP drape 22% E-W misregistration                             | meter-proportional exportImage size                 | 4.3 |
| 4   | BLOCKER | Stage god-object → "liftable" false                            | StageCore split + import-guard                      | 3.1 |
| 5   | BLOCKER | root-anchored fetch 404s under GH Pages basePath               | getAssetUrl on every asset                          | 5.2 |
| 6   | HIGH    | Rig fights R3F loop/controls/StrictMode                        | headless controller, sole camera authority          | 3.3 |
| 7   | HIGH    | `npm run bake` violates Docker-first + races dev distDir       | separate `chatt-bake` service, atomic mv            | 5.1 |
| 8   | HIGH    | committed JSON + drape bloat git / GH Pages limits             | quantize ENU int, compress, gitignore intermediates | 4.4 |
| 9   | HIGH    | height heuristic is PRIMARY (74% fallback), not tiebreaker     | tag-bucketed fallback, debug-overlay sign-off       | 4.4 |
| 10  | HIGH    | "re-anchor trolley to street graph" is a hidden subsystem      | baked polyline for M1                               | 3.9 |
| 11  | MED     | way-only query drops 3 building relations (landmarks)          | fetch relations + out geom                          | 4.1 |
| 12  | MED     | two theming systems collide over material colors               | packs own world colors; DaisyUI owns chrome         | 3.5 |
| 13  | MED     | palette toggle is 3 coupled systems, not a boolean             | named profiles, one grade-uniform owner             | 3.6 |
| 14  | MED     | re-bake non-reproducible (live services)                       | cache raw upstream + manifest hash                  | 4.4 |
| 15  | LOW     | terrain N-S undersampling smears bluffs (NOT rate limits)      | ~40×40 grid, 16 requests                            | 4.2 |
| 16  | LOW     | HUD wordmark/playtest contradict "liftable"                    | generic-by-props Hud                                | 3.7 |
