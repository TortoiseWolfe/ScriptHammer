# Atlas tour auto-start + `/chatt` social card — design

**Date:** 2026-07-16
**Status:** approved, ready for implementation plan
**Refs:** #292 (atlas continuation). Follow-up project C tracked separately (see "Out of scope").

## Why

The Chattanooga atlas went live today (`https://scripthammer.com/chatt/?atlas`, PR #296). Two things blunt it:

1. **Nobody finds the tour.** It is a `btn btn-xs min-h-0` chip, fifth in a row of near-identical chips in the top-left panel. The tour is the single best thing on the page and it is the hardest control to see. `min-h-0` also contradicts CLAUDE.md's 44px touch-target rule, so this is an accessibility defect, not only a design one.
2. **Sharing the atlas advertises the homepage.** `/chatt/` serves the root layout's Open Graph block verbatim: `og:title` "ScriptHammer - Modern Web Starter", the homepage description, the homepage image, and — worst — `og:url = https://scripthammer.com/`. Post the 3D map anywhere and the card points home.

Goal: the atlas sells itself on arrival, and the link sells itself before arrival.

## A. Tour auto-start + discoverability

### Behaviour

- On `/chatt/?atlas`, the tour plays automatically. **Every visit. Stateless** — no localStorage, no "seen" bit.
- `?notour` suppresses auto-start. (Bookmark `?atlas&notour` when working on the atlas; otherwise every reload flies the camera.)
- Any globe interaction — drag, zoom, click — aborts the auto-tour immediately. A camera that fights the mouse is worse than no tour. Manual stepping already cancels autoplay (`AtlasViewer.client.tsx:368-371`); this extends the same abort to camera input.

### Sequencing — the part that is easy to get wrong

Auto-start hangs off the **tour-built** signal (`rebuildTourRef`), **not** page load. The tour is derived from `landmarkStops(buildings)`, so there are no stops until buildings resolve, and Overpass is unreliable (observed: 504 locally, success in prod — the atlas falls back to baked data either way).

- Overpass fails → baked tour still auto-plays.
- No stops resolve at all → nothing auto-plays; the button simply sits there. No spinner, no error toast.

### Reduced motion

`prefers-reduced-motion: reduce` **or** `data-reduce-motion="true"` (AccessibilityContext, `src/styles/reduced-motion.css`, FR-022 / WCAG 2.3.3) **suppresses auto-start**. Non-negotiable: auto-flying a camera is the vestibular trigger that system exists to prevent.

If such a user _clicks_ Play, they get the **normal flight**. Decided deliberately: they asked for it, and the flight is the button's essential function. The rejected alternative was instant `camera.setView` cuts.

### The button

`AtlasViewer.client.tsx:541-556` becomes:

```
▶ Play tour            <- btn-primary, min-h-11, full width of the panel
[source][type][height]
[⊹ corners]
```

`corners` stays a small chip — it is a QC tool for the DEM/drape seam, not a feature. `min-h-0` is removed; `min-h-11` per CLAUDE.md.

### Testing

- **Unit:** extract `shouldAutoStart({ hasStops, notourParam, reducedMotion }): boolean` as a pure function and test it directly. That is where the logic lives, and it needs no WebGL.
- **E2E:** assert the tour caption (`data-testid="atlas-tour-caption"`) appears on `?atlas` and does **not** on `?atlas&notour`.
  **Assert on DOM chrome, never the canvas.** CI has no guaranteed WebGL, so a canvas assertion `test.skip()`s into a false green — the exact failure mode of #288. This also closes the standing gap that the atlas shipped with zero E2E coverage (`grep -riE "atlas|cesium" tests/e2e/` → 0 hits).

## B. `/chatt` social card

### Metadata

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

**The canonical override is load-bearing.** `generateMetadata` derives `alternates.canonical` from `path`. `page.tsx:9` deliberately points canonical at `/twins/chatt/` (the canonical viewer route). Letting the helper overwrite it would create `/chatt/` ↔ `/twins/chatt/` duplicate content — a silent SEO regression introduced while "fixing" SEO. So: `og:url = /chatt/` (what people share), `canonical = /twins/chatt/` (unchanged). The mismatch is intentional.

### Copy

Open-source framing; point contributors at **https://chattanooga.digital** or **https://github.com/TortoiseWolfe/ScriptHammer**. Both verified live (200) on 2026-07-16 — do not ship a dead link.

The copy above is a concrete draft, not a placeholder: implementation ships it as written. It is also explicitly cheap to change later and must never block this work.

**Length budgets are measured, not estimated.** The helper renders `"<title> | ScriptHammer"`, so the title's real cost is 14 chars more than it looks:

|                     | chars | budget | headroom |
| ------------------- | ----- | ------ | -------- |
| `og:title` rendered | 57    | ~60    | 3        |
| `og:description`    | 147   | ~160   | 13       |

Deliberately kept off the limit. The first drafts measured 60 and 160 — exactly at the cap, where any later tweak truncates mid-word in the card. **Re-measure on any rewrite; do not eyeball it.**

### Image

Capture the **live atlas** at 1200×630, chrome hidden (nav, cookie banner, HUD panel), framed on downtown Chattanooga across the river. Save as **JPEG** at `public/chatt-atlas-og.jpg`, target < 300KB.

JPEG, not PNG: the content is a photographic 3D render. For reference, the existing `public/opengraph-image.png` is correctly sized (1200×630) but **3.55 MB** — 10-30× heavier than it needs to be. Not fixed here; filed as follow-up.

### Accepted limitation

`?atlas` **cannot** have its own OG tags. Static export serves one HTML for `/chatt/` regardless of query string, so one card serves both renderers. The atlas is the headline, so the card shows the atlas and the diorama shares it. The alternative — a separate `/atlas` route — contradicts the Build Plan's governing renderer-split ("one endpoint; `?atlas` selects the renderer"), which is not open for re-litigation.

## Out of scope (deliberate)

- **Project C — site-wide OG.** An audit of all 43 routes found only **5** with proper OG, **13** partial (title/description only → inherit the homepage block), **25** with none. Every one of those claims `og:url = the homepage`. This needs its own spec, because the code is trivial and the **images** are the cost: a custom OG tag carrying the homepage picture only changes _which_ wrong image appears. Split as **C1** (og:title/description/url per public route, shared image — mechanical, kills the wrong-`og:url` bug) and **C2** (bespoke images for headline routes). B is C2's first instance.
  Private routes are already covered — `robots.txt` disallows `/sign-in/`, `/account/`, `/auth/` etc., several layouts carry explicit `robots: { noindex }`, and `/admin` is absent from the sitemap. This is a sharing/SEO gap, not a privacy leak.
- **Overpass 504 storm.** An unthrottled 43 km² query per page load against a public API. #292's top item, and now load-bearing on whether the tour has good data to fly through.
- **Renderer inconsistency.** The diorama has a bottom dock; the atlas has a top-left panel. Considered and rejected for now — "promote in place" keeps the diff small.
- **`relative h-screen` overflow** — bottom ~65px of the globe sits under the cookie banner (#292).
- **`opengraph-image.png` at 3.55 MB.**

## Files

- `src/twin/cesium/AtlasViewer.client.tsx` — button, auto-start effect, interaction abort
- `src/twin/cesium/tour.ts` — `shouldAutoStart` pure helper
- `src/twin/cesium/__tests__/` — unit test for `shouldAutoStart`
- `tests/e2e/twins.spec.ts` — caption present on `?atlas`, absent on `?atlas&notour`
- `src/app/chatt/page.tsx` — `generateMetadata` + canonical override
- `public/chatt-atlas-og.jpg` — new, captured from the live atlas
