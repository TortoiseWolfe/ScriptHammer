# PRD — Model City / Chattanooga Digital Twin

### A Civic Digital Twin You Can Read, Complete, and Play

**Author:** Jonathan "TurtleWolfe" Pohlner / ScriptHammer
**Status:** Draft v0.1
**Date:** July 2026
**Source prototypes:** Claude Design projects `a201abcf-1166-49b7-af4f-56bbc9cac911` (Home, Nav, Chattanooga Twin, Building Registry, Civic League, Civic League HUD, City Ops HUD, Build Plan, What 100% Unlocks) and `4102a769-47b8-40c9-af38-8bb91d49aecc` (Model City board). Concept seed: `public/blog/playable-city-chattanooga.md`.

---

## 1. Overview

Model City is one project with three planes over a single spine — a browser-native **digital twin of downtown Chattanooga** built entirely from open code and public data, with **no backend**.

- **Read it** — a CesiumJS twin (real footprints, heights, terrain, live flights/weather/air/transit). _This already ships as the `/chatt` atlas._
- **Complete it** — a Building Registry that scores every building's data completeness and turns the gaps into a canvassing route + CSV.
- **Play it** — the same data, gamified: a **Civic League** where a crew's score _is_ the twin's data completeness; a **Model City** planning board that lets you propose changes and watch a 5-year projection; and a post-100% **City Ops** mode.

**Design thesis: the data is the game.** Most "civic games" invent a scoreboard. Here the scoreboard is real — _"City score = data completeness + air quality + transit + landmark captures,"_ every point backed by a live feed or a verifiable open-data edit. Fix the map (OSM) and the twin, the registry, and the league score all move together. That single honest loop is what makes this more than a SimCity skin: **you are not the mayor, you are the crew, and your moves are real.**

Two principles govern everything, taken directly from the prototypes:

- **Equity weighted highest** — the Model City board scores Equity above every other dial; it is the plan's real scoreboard.
- **Explainable over accurate** — the planning sim is a transparent teaching model, never a decision oracle. Every metric carries a **live / sim / local** provenance dot; no invented numbers are hidden.

This is a **ScriptHammer showcase**: it stresses the template's static-export, PWA, a11y, and 5-file-component disciplines against a genuinely ambitious, data-heavy, map-driven app.

---

## 2. Goals & Non-Goals

### Goals

- Ship a browser-playable civic app on GitHub Pages (**static export, zero server**) that reads live open data and needs no login to start.
- Make **data completeness** a first-class, visible, movable metric — the community can measurably improve the commons (OSM, addresses, heights, landmark captures) and see the twin improve.
- Keep the game **honest**: browser-only state, provenance dots on every metric, equity weighted highest, and a sim that is explainable, not authoritative.
- Reuse the existing twin/atlas/bake pipeline as the data spine — **one file per screen, the twin stays a twin.**

### Non-Goals (MVP)

- No real accounts, cross-device sync, or server-verified scoring (that rides the Phase-3 relay if it ever exists; until then other crews are seeded SIM).
- No new backend or database. Live data is client-polled; anything keyed goes behind a future ~20-line serverless relay, never client-side secrets.
- No claim of decision-grade accuracy for the planning sim — it is a teaching sandbox.
- Not a from-scratch rebuild of the twin/atlas — that plane exists.

---

## 3. Target Audience

- **Primary — residents & civic-tech volunteers.** People who want to _do something_ about their city with an afternoon and a phone: tag a building, verify an address, capture a landmark, propose a plan.
- **Secondary — students & educators.** The Model City board is a transparent, equity-first teaching tool for urban tradeoffs; the registry is a real open-data lesson.
- **Tertiary — city staff / partners & the ScriptHammer audience.** A credible, forkable reference for "digital twin as civic engagement," and a flagship demo of what the template can carry.

---

## 4. Core Pillars & Feature Requirements

### Pillar 1 — The Twin (EXISTS: the `/chatt` Cesium atlas)

- **MC-1** A CesiumJS twin of downtown (Riverfront→Southside, North Shore) with toggleable layers: buildings (real heights), terrain, flights, weather/air, CARTA transit, traffic, zoning, splat sites; click-to-inspect, measure, time-of-day, bookmarks.
- **Status:** shipped — `src/twin/cesium/`, `src/app/twins/[slug]/page.tsx` (`/chatt` alias), baked data in `public/twins/chatt/`. This PRD _reuses_ it; the net-new work is the registry + game planes on top.
- **Success looks like:** the game screens link into the existing viewer; no twin rebuild.

### Pillar 2 — The Registry (NET-NEW: data completeness engine)

- **MC-2** Query Overpass for every building in the twin's bbox; per-building completeness = **name + tagged height + full address + contact, 25% each**; classify **outreach targets** (primary buildings with gaps) and assign a **LiDAR package** (ORBIT / FACADE / LANDMARK) by footprint volume + height.
- **MC-3** Walk-order sort (street → house number) for canvassing; filters (all / named & businesses / outreach targets / complete); 24 h localStorage cache; graceful Overpass rate-limit retry.
- **MC-4** **CSV export** with `owner_name_TO_COLLECT` / `owner_contact_TO_COLLECT` columns (owners are never in open data — the CSV is the outreach worksheet) + lat/lon + package + complete_pct.
- **Success looks like:** a volunteer opens the registry, sorts by walk order, filters to targets, and leaves with a CSV route sheet; the completeness % is the number the whole app rallies around.

### Pillar 3 — The League (NET-NEW: play = civic data-work)

- **MC-5** **City score = data completeness (40%) + air quality (20%) + transit (20%) + landmark captures (20%)**, composed live: completeness reads the registry cache, AQI from Open-Meteo (already live), transit a sim placeholder until GTFS-RT, captures = splat sites / 6. Every vital shows its **live/sim/local** dot.
- **MC-6** **Mission board** — each mission is a _real action against a live feed_ (tag 5 heights, name 10 unnamed buildings, address-sweep a street on foot, capture a Walnut St Bridge / Choo Choo splat, log CARTA stop drift, scout a PurpleAir host, owner-outreach a block). Categories MAP / FIELD / CAPTURE / CIVIC; claim → mark done → points.
- **MC-7** **Season leaderboard** (your LOCAL crew vs seeded SIM crews), crew rename, season reset; **all state in `localStorage` only.**
- **MC-8** **Field HUD** — the same collection game as a map screen: missions are pins you fly to, with a score plate, vitals, crew rank, and an advisor ticker driven by real state.
- **Success looks like:** a crew turns registry "red cells" green in the field, and the city score visibly rises for everyone — no invented numbers.

### Pillar 4 — The Model (NET-NEW: plan the city)

- **MC-9** **Model City board** — an SVG district board of 8 real neighborhoods (North Shore, Downtown, Highland Park, Southside, East Lake, Brainerd, St. Elmo, Alton Park). Six equity-weighted dials (Fiscal, Safety, Health, **Equity★**, Mobility, Mood) + an overall city-health score.
- **MC-10** Three modes: **Overlays** (rent / canopy / transit / flood recolor + an **Equity Lens** that recolors by investment need), **Build** (place 8 project types — bike lane, bus route, park, affordable homes, flood basin, Main St grants, gig fiber, solar microgrid — each with cost + zone effects), **Budget** (6 department sliders against a fixed pool, live balance).
- **MC-11** **"Run 5-yr projection"** — a transparent `compute()`/`effects()` engine advances the plan and reports Equity/Mood/Fiscal deltas; **reactive advisors** (CARTA Transit Desk, City Hall Finance, Community Equity Board) narrate the state.
- **Success looks like:** the "one honest slice" loop from the blog — _propose a change → see the tradeoffs → understand who it helps_ — with equity as the visible conscience.

### Pillar 5 — The Vision (NET-NEW: what 100% unlocks)

- **MC-12** A pitch/vision board: an interactive fiscal sandbox (lower taxes _and_ higher revenue, with the parking downside made explicit), the eight city departments the twin gamifies, and the "unlock ladder" — what each data-completeness milestone opens up (culminating in City Ops, the post-100% RTS where you play the city itself on a quarterly clock).
- **Success looks like:** a one-screen argument for _why_ completing the twin matters, tied to real fiscal levers.

---

## 5. Supporting Systems (MVP)

- **Shared Nav shell** — one top bar on every screen (Home/Twin/Registry/League/Plan/Docs), the ScriptHammer DaisyUI dark/light theme.
- **Provenance dots** — every metric is tagged live / sim / local so the UI never lies about what's real.
- **Token model** — Cesium ion tokens are per-user (localStorage) now; a hosted deploy uses one app token scoped `assets:read`. True secrets never ship client-side.
- **Home hub** — the Tools / Play / Docs index that frames the whole project as one thing.

---

## 6. Technical Approach

- **Static-export native.** Every screen is a client component with `localStorage` state and client-polled public endpoints (Overpass, Open-Meteo, OpenSky, CARTA GTFS, Hamilton Co. ArcGIS). No Next.js API routes; any keyed/CORS-blocked feed waits for a future Supabase Edge Function relay. This fits ScriptHammer's GitHub Pages constraint exactly.
- **Reuse the twin spine.** The registry/league read the same OSM/bake data the atlas uses (`public/twins/chatt/buildings.json`, `sites/chatt.json`); the game does not fork the twin.
- **Sim as a pure lib.** The Model City `compute()`/`effects()`/projection logic (currently a `DCLogic` class in the prototype) extracts to a pure, unit-tested `src/lib/model-city/` engine; the view is a thin presentational component. Same for the registry's completeness/package math.
- **Renderer split (from the Build Plan).** Cesium is the atlas (georeferenced twin); Three.js is only for bounded exhibits (Phase-4 splat walkthroughs). The data (3D Tiles / glTF / .ply) is the bridge, not the engine — do not re-render the twin in Three.

### Key technical risks, ranked

1. **Scope.** The concept is 20+ mechanics across 9 screens. Shipping all of it at once fails. Mitigation: pick ONE honest slice first (see §7); the PRD carries the rest as phases.
2. **Overpass rate-limits.** The registry + twin hit the same shared public server; concurrent use throttles per-IP. Mitigation: 24 h localStorage cache, exponential retry with a clear message, second Overpass host fallback (both already in the prototype).
3. **Sim honesty.** A pretty model that reads as authoritative can mislead real decisions or be weaponized. Mitigation: "explainable over accurate" banner, provenance dots, equity weighted highest, no persistence of "official" scores.
4. **Static-export + live data + a11y + mobile.** Prototypes are desktop-1280, 3-column; ScriptHammer is mobile-first with a 44 px touch floor and Pa11y gates. Mitigation: responsive rework is explicit plan work, not an afterthought.
5. **Privacy (Civic League field missions).** Location/camera for canvassing + captures require explicit consent (Constitution Principle VI).

---

## 7. Phasing

Maps onto the Build Plan prototype's 6 phases; Phase 0 is **done** (it is the shipping atlas).

- **Phase 0 — Browser twin (DONE).** CesiumJS on open imagery, OSM-extruded buildings, live flights/weather/AQ, CARTA routes, zoning query, measure/sun-shadow/bookmarks. = `src/twin/` + `scripts/bake/` + `#229` accuracy work. _Exit: shipped._
- **Phase 1 — First honest slice (this PRD's MVP).** One screen, ported cleanly into ScriptHammer (see the PRP for the chosen slice). _Exit: the slice is live at a route, tested, a11y-clean, mobile-usable; kill criterion: if it can't be made honest + mobile within the slice budget, cut it._
- **Phase 2 — The civic loop.** Registry + Civic League together (completeness → missions → score), the value core. _Exit: a volunteer can improve completeness and see the city score move._
- **Phase 3 — The planning sim.** Model City board as a tested `src/lib/model-city/` engine + responsive board. _Exit: propose→project→tradeoffs loop, equity-first._
- **Phase 4 — Authoritative data + captures.** 3DEP lidar heights, GTFS-RT relay, landmark splats (feeds the league's capture score). _Exit: real heights + live buses + first published splat._
- **Phase 5 — City Ops + vision.** Post-100% RTS + the fiscal-sandbox vision board. _Exit: the unlock ladder is playable._

---

## 8. Success Metrics

- **North star:** **community-driven data completeness** — the % of the twin's building footprint that goes from red/amber to green because a real person edited OSM / verified an address / captured a landmark. This is the one number the twin, registry, and league all share.
- App works with zero login on GitHub Pages; Lighthouse 90+, Pa11y clean, mobile-usable.
- A volunteer completes one full mission loop (open registry → walk order → field edit → score rises) without help.
- The Model City board's equity dial demonstrably responds to where investment is placed.

---

## 9. Open Questions

- What UI/UX makes civic data-work _feel_ civic (not extractive gamification)?
- Which metrics genuinely inform vs. which mislead if surfaced? (What do we deliberately NOT score?)
- How does a community legitimately move its own score while staying honest, opt-in, and neighborhood-owned — not weaponized against residents?
- Which slice first? (See the PRP; recommended: the self-contained Model City board OR the Registry+League civic loop.)
- Hosted token/quota model when a civic demo outgrows the Cesium free tier — sponsor, or self-host tiles (Phase 5)?

---

## Appendix A — Architecture: three planes

- **A · Base globe** — CesiumJS; token-free floor (Esri/OSM imagery on the ellipsoid) → free ion token unlocks World Terrain, OSM Buildings tileset, Google Photorealistic 3D Tiles. Everything downstream emits OGC 3D Tiles + glTF.
- **B · Live data layers** — WorldView-style fusion; each layer ≈ a 150-line client module (fetch → entities → status chip); _filter before render_ is the main perf lever.
- **C · Capture pipeline** — landmark Gaussian splats from phone video: RealityScan (SfM) → COLMAP text export (with images) → Brush (~3k steps) → SuperSplat cleanup + real-scale calibration. Free + commercial-safe end to end.

## Appendix B — Data-source registry

| Layer            | Source / endpoint                                                   | Access      | Notes                                                                                   |
| ---------------- | ------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| 3D buildings     | Overpass `way["building"]` in bbox                                  | CORS ✓      | Heights from `height`/`building:levels` (est. 3.3 m/level). Fix the map → fix the twin. |
| Terrain          | Cesium World Terrain (ion asset 1)                                  | free token  | Token-free floor is a flat ellipsoid — fine downtown, wrong at ridges.                  |
| Photoreal mesh   | Google Photorealistic 3D Tiles (ion 2275207)                        | free token  | Reference layer, not open data.                                                         |
| Zoning / parcels | Hamilton Co. RPA ArcGIS (`Live_PropertyZoning` L15, `Live_Parcels`) | CORS varies | `f=geojson,outSR=4326`; may need the relay.                                             |
| Transit          | CARTA GTFS (`github.com/gocarta/gtfs`)                              | CORS ✓      | Real shapes; live vehicles need a Phase-3 GTFS-RT relay.                                |
| Flights          | OpenSky `states/all?bbox`                                           | CORS ✓      | Anonymous tier rate-limited.                                                            |
| Weather / air    | Open-Meteo + air-quality-api                                        | CORS ✓      | AQI already live in Civic League.                                                       |
| Street network   | Overpass `highway=…`                                                | CORS ✓      | Drives traffic particles.                                                               |
| LiDAR (Phase 2)  | USGS 3DEP 1 m / TNGIS / UTC GIS Lab                                 | download    | Authoritative heights; tile with py3dtiles or ion.                                      |

## Appendix C — The models (extracted from the prototypes)

- **Civic League score** = `completeness×0.4 + aqiScore×0.2 + transit(72 sim)×0.2 + splats/6×0.2`; completeness = mean of per-building (name+height+full-address+contact, 25% each) read from the registry cache; AQI→score bands (≤50→100, ≤100→70, ≤150→40, else 15).
- **Model City sim** — per-district base stats (rent/canopy/transit/flood/invest); project `effects()` adjust six metrics with an **equity multiplier that is larger in under-invested districts** and a displacement penalty in already-hot ones; overall = `0.18 fiscal + 0.18 safety + 0.18 health + 0.20 equity + 0.13 mobility + 0.13 mood`; a 5-yr projection compounds under-served-share, budget balance, and parks/housing/mobility allocations.
- **Registry LiDAR package** — `LANDMARK` if height > 30 m or volume > 60 k m³; `FACADE` if volume > 8 k or height > 12 m; else `ORBIT`.

## Appendix D — Screen inventory (the prototypes)

| Screen                       | Plane  | Role                    | State                                 |
| ---------------------------- | ------ | ----------------------- | ------------------------------------- |
| Home                         | hub    | Tools/Play/Docs index   | net-new                               |
| Nav                          | chrome | shared top bar          | net-new                               |
| Chattanooga Twin             | Tools  | 3D viewer               | **exists** (`/chatt` atlas)           |
| Building Registry            | Tools  | data-completeness + CSV | net-new (Overpass-live)               |
| Civic League                 | Play   | mission board + score   | net-new                               |
| Civic League HUD (Field HUD) | Play   | missions as map pins    | net-new                               |
| Model City board             | Play   | district planning sim   | net-new                               |
| City Ops HUD                 | Play   | post-100% RTS           | net-new (later)                       |
| What 100% Unlocks            | Docs   | fiscal-sandbox vision   | net-new                               |
| Build Plan                   | Docs   | architecture/roadmap    | net-new (≈ this PRD's Appendices A/B) |

## Appendix E — Exists vs net-new (do not re-propose what ships)

- **Exists:** the Cesium atlas (`src/twin/cesium/`, `src/twin/renderer-select.ts`), the bake pipeline (`scripts/bake/`, `#232`/`#229`), the warehouse GLB pipeline (`scripts/warehouse/`), baked data (`public/twins/chatt/`), site config (`sites/chatt.json`), and the concept blog (`public/blog/playable-city-chattanooga.md`).
- **Net-new:** everything in Pillars 2–5 (Registry, League, Field HUD, Model City board, City Ops, Vision), the shared Nav/Home hub, and the provenance-dot convention. No PRD/PRP existed before this document.

---

## Licensing

Code MIT · captured assets CC-BY 4.0 · data under source terms (OSM = ODbL, city data = public record). The twin improves when the commons improves: a tagged OSM building appears in the twin on next load.
