# PRP — Model City (First Slice: the planning board)

**Feature ID:** 049
**Category:** enhancements
**Status:** Draft
**Date:** July 2026
**Source (authoritative):** [`model-city-prd.md`](../../model-city-prd.md) — the full Model City / Chattanooga Digital Twin vision. This PRP scopes only the **first honest slice**.
**Prototype:** Claude Design `Model City - Chattanooga.dc.html` (project `4102a769-47b8-40c9-af38-8bb91d49aecc`).

---

## Slice decision

The PRD carries five pillars. This PRP scopes **Pillar 4 — the Model City planning board** as the first slice, because it is:

- **Self-contained** — no live data, no backend, no auth, no rate-limit dependency; a pure client sandbox that ports cleanly to static export.
- **The blog's own "one honest slice"** — _propose a change → see the tradeoffs → understand who it helps_, with equity as the visible conscience.
- **Highest visible value, lowest infra risk.**

> **Alternative first slice (owner's call at `/clarify`):** the **Registry + Civic League civic loop** (PRD Pillars 2–3) is the more civically valuable slice but adds Overpass-live data + a two-screen loop. If chosen, re-scope this PRP to that loop; the PRD covers both.

---

## 1. Product Requirements (this slice)

A `/model-city` route: an interactive, equity-first city-planning board over 8 real Chattanooga districts (North Shore, Downtown, Highland Park, Southside, East Lake, Brainerd, St. Elmo, Alton Park).

- **PR-1** SVG district board with the Tennessee River, Lookout Mtn, and landmarks; each district is clickable and recolors by the active overlay.
- **PR-2** Six equity-weighted dials (Fiscal, Safety, Health, **Equity★**, Mobility, Mood) + an overall city-health score with a delta-vs-baseline.
- **PR-3** Three modes: **Overlays** (rent / canopy / transit / flood + an **Equity Lens** recolor by investment need), **Build** (place 8 project types with cost + per-zone effects), **Budget** (6 department sliders vs a fixed pool, live balance).
- **PR-4** **"Run 5-yr projection"** — a transparent engine advances the plan and reports Equity/Mood/Fiscal deltas; reset returns to the 2026 baseline.
- **PR-5** Reactive **advisors** (CARTA Transit Desk, City Hall Finance, Community Equity Board) that narrate the current state.
- **PR-6** A **district inspector** (rent/canopy/transit/flood + placed projects) and an "explainable, not authoritative" banner + provenance framing.
- **Success:** the equity dial demonstrably responds to _where_ investment lands; the projection is legible; nothing reads as a decision oracle.

## 2. Context & Codebase Intelligence

- **Extract the sim to a pure lib.** The prototype's `DCLogic` class holds all logic (`compute()`, `effects()`, `effZone()`, `colorFor()`, the 5-yr projection, advisor selection). Port it to a **pure, unit-tested `src/lib/model-city/` engine** (no React) — `engine.ts` (scoring), `districts.ts` / `tools.ts` / `departments.ts` (data), `types.ts`. The view holds only `useState`/`useReducer` + handlers.
- **Components via the generator (Constitution I).** `docker compose exec scripthammer pnpm run generate:component` for each 5-file component (e.g. `DistrictBoard`, `CityMetrics`, `BuildPanel`, `BudgetPanel`, `DistrictInspector`, `AdvisorRail`). No manual component creation (CI fails it).
- **Reuse:** link "open in twin" to the existing `/chatt` atlas; follow the `src/components/game/` patterns (the `/game/3d` R3F scene) for a client-only interactive route; DaisyUI theming conventions from the rest of the app.
- **Theming decision (for `/clarify`):** the prototype uses a bespoke warm palette + Google Fonts (Space Grotesk / IBM Plex Mono / Newsreader). Recommend a **faithful self-contained port** (scoped CSS module, matches the mockup) with a dark-aware variant as a follow-up — vs. remapping onto DaisyUI's 32 themes (loses the designed palette).
- **Static export (Constitution + `features/CLAUDE.md`):** this slice needs **no** server/API — district stats are baked/synthetic ("explainable over accurate"), state is `localStorage`. Fully GitHub-Pages-safe.

## 3. Technical Specifications

- **Engine (pure):** `compute(budget, placed, projYears) → {6 metrics, overall, planCost, balance}`; `effects(toolKey, zone)` with an equity multiplier larger in under-invested districts + displacement penalty; overall weights `0.18/0.18/0.18/0.20(equity)/0.13/0.13`. Deterministic — no `Date.now()`/`Math.random()` in scoring (testable).
- **Data model:** `District {rent,canopy,transit,flood,invest}`, `Tool {key,label,cost,effects}`, `Department {key,alloc}`, board geometry (SVG viewBox 720×600, 8 tiles + river/ridge/landmarks).
- **Responsive:** prototype is desktop-1280 3-column; MUST rework to mobile-first (stacked panels, ≥44 px touch targets, board scales) per Constitution V.
- **A11y (Constitution II/V, Pa11y gate):** keyboard-selectable districts + tools; slider labels; the SVG board needs an accessible name + a non-color cue for overlays; advisors are live-region text.

## 4. Implementation Runbook (SpecKit — Constitution III)

1. `./scripts/prp-to-feature.sh model-city 049` → branch + `features/enhancements/049-model-city/`.
2. `/speckit.specify` → `/speckit.clarify` (resolve slice + theming + mobile scope).
3. `/speckit.wireframe.generate` → `/speckit.wireframe.review` **[HARD GATE]** — **the imported `.dc.html` prototype IS the mockup**; embed it under `spec.md ## UI Mockup` + generate the SVG wireframes from it (desktop + mobile).
4. `/speckit.plan` → `/speckit.checklist` → `/speckit.tasks` → `/speckit.analyze` → `/speckit.implement` → `/speckit.wireframe.screenshots`.
5. Build order: engine lib (TDD) → 5-file components (generator) → `/model-city` route → wire modes → projection → advisors → responsive + a11y pass.

## 5. Validation Loops

- **Engine unit tests (Vitest, TDD-first):** deterministic scoring; equity multiplier higher in under-invested zones; projection deltas monotonic where expected; budget balance math.
- **Component + a11y tests:** each 5-file component's `.test.tsx` + `.accessibility.test.tsx`; Pa11y clean.
- **E2E (Playwright):** switch mode → place a project on a district → district recolors + metrics move → run projection → advisor updates → reset returns to baseline. Mobile viewport pass.
- **Gates:** `type-check` · `lint` · `pnpm test` · `pnpm exec playwright test` · `docker compose run --rm builder pnpm build` · Lighthouse 90+.

## 6. Risk Mitigation

- **Sim honesty:** persistent "explainable teaching model, not a decision tool" banner; equity weighted highest; never persist an "official" score; provenance framing.
- **Scope:** this slice is the board ONLY — Registry, Civic League, Field HUD, City Ops, and the Vision board are later phases in the PRD, not this feature.
- **Mobile/a11y:** treated as first-class plan work (the prototype is desktop-only).
- **Theming churn:** decide faithful-port vs DaisyUI at `/clarify` before building components.

## 7. References

- Authoritative vision: `model-city-prd.md` (repo root).
- Concept seed: `public/blog/playable-city-chattanooga.md`.
- Existing twin/atlas (reuse, do not rebuild): `src/twin/cesium/`, `src/twin/renderer-select.ts`, `src/app/twins/[slug]/page.tsx`, `public/twins/chatt/`, `sites/chatt.json`, `scripts/bake/`.
- Interactive-route precedent: `src/app/game/3d/page.tsx`, `src/components/game/`.
- Conventions: `docs/prp-docs/SPECKIT-PRP-GUIDE.md`, `features/CLAUDE.md`, `.specify/memory/constitution.md`.
- Prototypes (Claude Design): board `4102a769-47b8-40c9-af38-8bb91d49aecc`; rest `a201abcf-1166-49b7-af4f-56bbc9cac911`.
