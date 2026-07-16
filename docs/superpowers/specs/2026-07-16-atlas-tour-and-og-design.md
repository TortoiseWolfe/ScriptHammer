# Atlas as the default: wide bake → flip → tour + social card

**Date:** 2026-07-16
**Status:** approved, ready for implementation plan
**Refs:** #292 (atlas continuation). Supersedes the A+B-only draft of this file. Project C (site-wide OG) tracked separately — see "Out of scope".

## Why

The Chattanooga atlas went live today (PR #296) and is better than the diorama it hides behind. Three things follow from that:

1. **Nobody finds the tour.** It is a `btn btn-xs min-h-0` chip, fifth in a row of near-identical chips. The best thing on the page is the hardest control to see. `min-h-0` also contradicts CLAUDE.md's 44px touch-target rule — an accessibility defect, not only a design one.
2. **Sharing the atlas advertises the homepage.** `/chatt/` serves the root layout's OG block verbatim — homepage title, homepage description, homepage image, and `og:url = https://scripthammer.com/`. Post the 3D map, get a card pointing home.
3. **The atlas is opt-in.** It lives behind `?atlas`, so it is unindexed, invisible to analytics (GA strips query params), and not what a visitor lands on.

The decision: **make the atlas the default.** This is the roadmap's own stated endgame ("flip `?atlas` to default → retire the R3F atlas path"), pulled forward because the owner prefers the atlas today.

Rejected: a dedicated `/atlas` route. It names the URL after the _engine_, which is exactly what the Build Plan's renderer-split forbids ("the data is the bridge, not the engine"). `/twins/[slug]` scales to N cities; `/atlas` hard-codes one, needs `/atlas/[slug]` at city #2, adds a third URL for Chattanooga, and is a URL you would then have to deprecate.

## The arc — four sequenced pieces

Order is load-bearing. Each piece leaves `main` shippable.

### 1. `buildings-wide.json` — bake the atlas extent

**This must land before the flip.** Today the atlas queries Overpass **at runtime, on every page load**: an unthrottled 43 km² query against a free, community-run API whose usage policy forbids heavy automated use. That is tolerable while the atlas is opt-in. The moment it is the default, every visitor fires it.

**The root cause is not the missing cache — it is a wrong-shaped bake.** From `src/twin/cesium/overpass.ts`'s own header:

```
Phase 0 demo bbox   5.66 x 5.33 km = 30.1 km2   6,099 OSM buildings
baked chatt box     1.46 x 5.79 km =  8.5 km2   1,547 OSM buildings
```

The baked box was composed for the tilt-shift **diorama** — a 1.46 km north–south corridor framed for the Ross's Landing → Choo Choo tour. The atlas widens at runtime only because the bake hands it the diorama's slice.

**Precedent exists for the plumbing — but NOT for the payload.** `1b3b0b4` ("kill the atlas terrain plateau — wide DEM over the atlas extent") added `terrain-wide.json`, and its five mechanical moves are the template for _wiring_ a second wide artifact: parameterize the fetcher's output filename, add the artifact to `run.ts`'s temp→out promotion list, copy raw→out in `build-scene.ts`.

**The payload is where the analogy breaks, and this is the crux of the task.** `terrain-wide.json` is the _same shape_ as `terrain.json` over a bigger box — a straight copy. Buildings are not:

- `buildings.json` entries are **ENU-projected and box-clipped**. `build-scene.ts:296-300` actively **drops** any building whose footprint centroid falls outside `site.box` (`inBox`, defined against `site.box` half-extents). Its `ring` is `number[]` in ENU metres, requiring `vectorOffsetM` to unwind.
- The atlas's runtime type deliberately does **not** do that. `src/twin/cesium/overpass.ts:68-70` on `LiveBuilding.lonLat`: _"Flat [lon, lat, ...] straight from OSM — no ENU round-trip, so no projection error and no vectorOffsetM to unwind."_

So **do not emit a wide `buildings.json`.** Emit a **baked `LiveBuilding[]`** — precisely what `fetchLiveBuildings()` returns today, computed at bake time instead of in the browser:

- **Emit** `public/twins/chatt/buildings-wide.json` typed `LiveBuilding[]` (`{ id, lonLat, heightM, rule, baked, tags }`), over `atlasBoxFor(site)`.
- **The runtime change is then minimal**: `fetchLiveBuildings` keeps its signature and return type; the atlas fetches the JSON instead of calling Overpass. Same type, same join, same consumer. `?live` re-enables the network path.
- **`sites/chatt.json` already has `atlasBox`** — `atlasBoxFor(site)` unions it with `box`. **No new config.** Note the guard idiom `atlasBox !== site.box` is _reference identity_, valid only because `atlasBoxFor` returns the same object when `atlasBox` is absent — preserve that contract.
- **`fetchOsm` hardcodes `osm.json`** (`scripts/bake/fetch-osm.ts:35`) and needs the same `filename?` parameterization `fetch-terrain.ts` got in `1b3b0b4`.
- **The join is preserved.** `Building.id` IS the OSM way id. Inside the baked box use the bake's measured height + rule (lidar for 1,328 roofs); outside, `resolveHeight()` on the live tags via the same ladder — exactly what the runtime does now, moved to bake time.
- **Cost:** ~8,031 buildings ≈ 1.75 MB uncompressed, **~314 KB gzipped** — next to the already-committed `terrain.json` (898 KB).
- **Trade-off, accepted:** wide data goes stale between bakes. Building footprints do not change hourly.

**`run.ts`'s promotion list is a silent-failure trap.** Its own commit message: _"that allowlist is the atomic-swap guard, and a file missing from it is silently dropped, which cost two rebakes to notice."_ Append `'buildings-wide.json'` to the list at `scripts/bake/run.ts:208-221`.

Per `lesson_bake_byte_comparability_prettier`: verify the rebake **semantically** (manifest modulo `fetchedAt`/`site`/`drape.path`; `drape.jpg` is the byte-identity check), not by byte-diffing prettified artifacts.

### 2. Flip the default

- `/chatt/` and `/twins/[slug]` render the **atlas** by default.
- `?diorama` opts out to the R3F diorama. `?atlas` stays as a no-op alias so existing links keep working.
- `?ortho` implies `?diorama` — it is a diorama compare mode.
- **Nav: "Twin" → "3D Map"**, pointing at `/chatt/`.

**What this hides:** the diorama's dock (Miniature, Ride, Directory, Edit, As-built demo), `?ortho` compare, and the tilt-shift look all move behind `?diorama` until ported. Accepted deliberately — the roadmap gated this on parity; the owner's preference is the evidence that parity mattered less than the plan assumed.

### 3. Retarget E2E — the flip breaks it

**Verified against the live atlas, not assumed** — `https://scripthammer.com/chatt/?atlas`:

```
atlas_has_ChattanoogaMini : false      <- the suite's core assertion
hasMoreControlsBtn        : false
hasTopDownBtn             : false
panelText                 : "Atlas — chatt / 8031 buildings · live OSM + baked lidar · 3DEP…"
```

The atlas renders **"Atlas — chatt"**. The string "Chattanooga Mini" appears nowhere in it. So flipping the default breaks 4–6 tests in `tests/e2e/twins.spec.ts` that assert `getByText('Chattanooga Mini')` or drive diorama chrome.

- Retarget the diorama specs to `?diorama` — they are still valid, just no longer the default.
- Add atlas coverage, closing the standing gap that the atlas shipped with **zero** E2E (`grep -riE "atlas|cesium" tests/e2e/` → 0 hits).
- **Assert on DOM chrome, never the canvas.** CI has no guaranteed WebGL, so a canvas assertion `test.skip()`s into a false green — #288's exact failure mode. Use `data-testid="atlas-tour"`, the "Atlas — chatt" heading, the `N buildings` line.

### 4. Tour auto-start + social card

#### Tour behaviour

- The tour plays **automatically, every visit. Stateless** — no localStorage, no "seen" bit.
- `?notour` suppresses it. (Bookmark it while working on the atlas; otherwise every reload flies the camera.)
- Any globe interaction — drag, zoom, click — aborts immediately. A camera that fights the mouse is worse than no tour. Manual stepping already cancels autoplay (`AtlasViewer.client.tsx:368-371`); extend the same abort to camera input.

**The obvious hook is a trap.** `AtlasViewer.client.tsx` creates its `ScreenSpaceEventHandler` at `:466` — **after** the live-fetch `await` at `:424-429`, which the code's own comment budgets at 60s+. Auto-start fires off `setReady(true)` at `:415`. So between `:415` and `:466` the tour is playing with **no Cesium input handler registered**, and an abort hooked there would be inert for exactly the window auto-start is most likely running. Register the abort on `document` (`pointerdown`, `wheel`, `touchstart`) instead — the pattern `Scene.tsx:~112` already uses; it needs no Cesium object and can be registered immediately. Piece 1 shortens that await to a local fetch, but the ordering bug must not survive on the `?live` path.

**Sequencing:** auto-start hangs off the **tour-built** signal (`rebuildTourRef`), **not** page load — there are no stops until buildings resolve. After piece 1 that is a local fetch rather than a public API, which is precisely why the flip waits for it. If no stops resolve, nothing auto-plays and the button simply sits there. No spinner, no error toast.

**Reduced motion** — **use `useReducedMotion()`, not AccessibilityContext.** There are two disjoint mechanisms in this repo and only one is right here:

| API                                            | shape                         | provider                      | used by                                                        |
| ---------------------------------------------- | ----------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `useReducedMotion()`                           | `boolean`, `matchMedia`       | none needed                   | `Scene.tsx:85` — gates **auto-orbit**. The identical use case. |
| `settings.reduceMotion` (AccessibilityContext) | `'reduce' \| 'no-preference'` | **throws without a provider** | 2 files, neither 3D                                            |

Use `useReducedMotion()`. Note also that `src/styles/reduced-motion.css` **cannot** help — it nulls four Tailwind keyframe classes and has no reach over a `camera.flyTo`. Suppressing auto-start is a code decision, not a CSS one.

When it returns true, **auto-start is suppressed** — non-negotiable, WCAG 2.3.3; auto-flying a camera is the vestibular trigger that whole system exists to prevent. If such a user _clicks_ Play they get the **normal flight**: they asked for it, and the flight is the button's essential function. (Rejected: instant `camera.setView` cuts.)

**The button** — `AtlasViewer.client.tsx:541-556`:

```
▶ Play tour            <- btn-primary, min-h-11, full width of the panel
[source][type][height]
[⊹ corners]
```

`corners` stays a chip — a QC tool for the DEM/drape seam, not a feature.

**Unit test:** extract `shouldAutoStart({ hasStops, notourParam, reducedMotion }): boolean` as a pure function. That is where the logic lives, and it needs no WebGL.

#### Social card

`src/app/chatt/page.tsx` switches from hand-rolled `metadata` to the existing helper (`src/utils/metadata.tsx:21`, already used by `layout.tsx`):

```tsx
export const metadata: Metadata = {
  ...generateMetadata({
    title: 'Chattanooga in 3D — open-source city atlas',
    description:
      '8,000 buildings at real lidar heights over live OpenStreetMap and USGS 3DEP terrain, in your browser. Open source — join in at Chattanooga.Digital.',
    path: '/chatt/',
    image: '/chatt-atlas-og.jpg',
  }),
  alternates: { canonical: '/twins/chatt/' },
};
```

**The canonical override is load-bearing.** `generateMetadata` derives `alternates.canonical` from `path`. `page.tsx:9` deliberately points canonical at `/twins/chatt/`. Letting the helper overwrite it creates `/chatt/` ↔ `/twins/chatt/` duplicate content — an SEO regression introduced while fixing SEO. So `og:url = /chatt/` (what people share), `canonical = /twins/chatt/` (unchanged). The mismatch is intentional.

After the flip the card is honest: it advertises the atlas, and the atlas is what you land on.

**Copy.** Open-source framing pointing at **https://chattanooga.digital** or **https://github.com/TortoiseWolfe/ScriptHammer** — both verified live (200) on 2026-07-16; do not ship a dead link. The draft above ships as written and is explicitly cheap to change later; it must never block implementation.

**Length budgets are measured, not estimated.** The helper renders `"<title> | ScriptHammer"`, so the title costs 14 chars more than it looks:

|                     | chars | budget | headroom |
| ------------------- | ----- | ------ | -------- |
| `og:title` rendered | 57    | ~60    | 3        |
| `og:description`    | 147   | ~160   | 13       |

The first drafts measured 60 and 160 — exactly at the cap, where any later tweak truncates mid-word in the card. **Re-measure on any rewrite; do not eyeball it.**

**Image.** Capture the live atlas at 1200×630, chrome hidden (nav, cookie banner, HUD panel), framed on downtown across the river. Save as **JPEG** at `public/chatt-atlas-og.jpg`, target < 300 KB. JPEG not PNG: the content is a photographic 3D render. For reference `public/opengraph-image.png` is correctly sized but **3.55 MB** — 10-30× heavier than needed. Not fixed here; filed as follow-up.

## Out of scope (deliberate)

- **Project C — site-wide OG.** An audit of all 43 routes: **5** proper, **13** partial (title/description only → inherit the homepage block), **25** none. Every one claims `og:url = the homepage`. Its own spec, because the code is trivial and the **images** are the cost — a custom OG tag carrying the homepage picture only changes _which_ wrong image appears. Split **C1** (og:title/description/url per public route, shared image — mechanical, kills the wrong-`og:url` bug) and **C2** (bespoke images per headline route). Piece 4's card is C2's first instance.
  Private routes are already covered — `robots.txt` disallows `/sign-in/`, `/account/`, `/auth/` etc., several layouts carry explicit `robots: { noindex }`, `/admin` is absent from the sitemap. A sharing/SEO gap, not a privacy leak.
- **Porting the diorama's features to the atlas** (Miniature, Ride, Directory, Edit, As-built, tilt-shift). They stay behind `?diorama`.
- **Retiring the R3F path.** Not until those are ported.
- **`relative h-screen` overflow** — bottom ~65px of the globe under the cookie banner (#292).
- **`opengraph-image.png` at 3.55 MB.**

## Files

| Piece | Files                                                                                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `scripts/bake/overpass.ts`, `scripts/bake/fetch-osm.ts`, `scripts/bake/run.ts`, `scripts/bake/site-config.ts`, new `public/twins/chatt/buildings-wide.json`; `src/twin/cesium/overpass.ts` → `?live` opt-in |
| 2     | `src/twin/TwinCanvasHost.tsx` (renderer selection), `src/app/chatt/page.tsx`, `src/app/twins/[slug]/`, nav component ("Twin" → "3D Map")                                                                    |
| 3     | `tests/e2e/twins.spec.ts`                                                                                                                                                                                   |
| 4     | `src/twin/cesium/AtlasViewer.client.tsx`, `src/twin/cesium/tour.ts`, `src/twin/cesium/__tests__/`, `src/app/chatt/page.tsx`, new `public/chatt-atlas-og.jpg`                                                |
