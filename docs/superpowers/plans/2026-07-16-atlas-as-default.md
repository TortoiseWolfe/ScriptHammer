# Atlas as the Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Cesium atlas the default renderer at `/chatt` and `/twins/[slug]`, with its tour auto-playing and its own social card — without the default route depending on a public API.

**Architecture:** Four sequenced tasks, each leaving `main` shippable. Task 1 moves the Overpass query from runtime to bake time (emitting a baked `LiveBuilding[]`), which is what makes the flip safe. Task 2 flips the renderer switch. Task 3 retargets the E2E suite the flip breaks. Task 4 adds tour auto-start and the OG card.

**Tech Stack:** Next.js 15.5 (`output: 'export'`), React 19, TypeScript strict, Cesium 1.143, vitest, Playwright, Docker-first.

**Spec:** `docs/superpowers/specs/2026-07-16-atlas-tour-and-og-design.md`

## Global Constraints

- **Docker-first.** Never run `pnpm`/`npx` on the host. Commands run as `docker compose exec -T scripthammer <cmd>`. Never `sudo`.
- **Production builds run in their OWN container:** `docker compose run --rm builder pnpm build`. Never `docker compose exec scripthammer pnpm build` — that wipes the dev server's `.next` (#293).
- **Commit from inside the container** so husky/lint-staged/gitleaks run: `docker compose exec -T scripthammer git commit`. Push from the host. **Never `--no-verify`.**
- **Touch targets:** `min-h-11 min-w-11` (44px) per CLAUDE.md. `min-h-0` is a defect.
- **Query params are read via `new URLSearchParams(window.location.search)`, NEVER `useSearchParams`** — the latter forces a Suspense bailout under `output: 'export'` (`TwinCanvasHost.tsx:51-56`).
- **E2E asserts DOM chrome, never `canvas`.** CI has no guaranteed WebGL; a canvas assertion `test.skip()`s into a false green (#288).
- **Verify with unpiped exit codes.** `node --check file | head` returns _head's_ status. Never grep piped tool output for a verdict.
- **Restore generated churn before committing:** `git checkout -- public/manifest.json` (the build rewrites `start_url`/`scope`).
- Dev URL: `http://127.0.0.1:3002/ScriptHammer/`. Playwright MCP connects to `http://127.0.0.1:3002`, never `host.docker.internal`.
- HMR does not reliably pick up `src/twin/cesium/` changes — `docker compose restart scripthammer` + a `?cb=N` buster before judging.

---

## File Structure

| File                                                  | Responsibility                                                                                    | Task |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---- |
| `scripts/bake/fetch-osm.ts`                           | Gains `filename?` param (mirrors `fetch-terrain.ts`'s `1b3b0b4` change)                           | 1    |
| `scripts/bake/build-wide-buildings.ts`                | **New.** Pure: `(osm, baked, box) => LiveBuilding[]`. The bake-time twin of `fetchLiveBuildings`. | 1    |
| `scripts/bake/__tests__/build-wide-buildings.test.ts` | **New.** Unit tests for the above.                                                                | 1    |
| `scripts/bake/run.ts`                                 | Wide-OSM fetch stage + promotion-list entry                                                       | 1    |
| `scripts/bake/build-scene.ts`                         | Writes `buildings-wide.json` to tmp                                                               | 1    |
| `src/twin/cesium/overpass.ts`                         | `fetchLiveBuildings` reads baked JSON; `?live` re-enables network                                 | 1    |
| `src/twin/TwinCanvasHost.tsx`                         | The renderer switch — the flip                                                                    | 2    |
| nav config                                            | "Twin" → "3D Map"                                                                                 | 2    |
| `tests/e2e/twins.spec.ts`                             | Diorama specs → `?diorama`; new atlas specs                                                       | 3    |
| `src/twin/cesium/tour.ts`                             | `shouldAutoStart()` pure helper                                                                   | 4    |
| `src/twin/cesium/__tests__/tour.test.ts`              | Tests for `shouldAutoStart`                                                                       | 4    |
| `src/twin/cesium/AtlasViewer.client.tsx`              | Auto-start effect, abort listener, button promotion                                               | 4    |
| `src/app/chatt/page.tsx`                              | OG card via `generateMetadata`                                                                    | 4    |
| `public/chatt-atlas-og.jpg`                           | **New.** 1200×630 capture                                                                         | 4    |

---

## Task 1: Bake `buildings-wide.json`

**Why first:** the atlas queries Overpass at runtime on every page load — an unthrottled 43 km² query against a free community API. Fine while opt-in; the moment it is the default (Task 2), every visitor fires it.

**Files:**

- Create: `scripts/bake/build-wide-buildings.ts`
- Create: `scripts/bake/__tests__/build-wide-buildings.test.ts`
- Modify: `scripts/bake/fetch-osm.ts:35`, `scripts/bake/run.ts:163-221`, `scripts/bake/build-scene.ts:496-503`
- Modify: `src/twin/cesium/overpass.ts` (`fetchLiveBuildings`)

**Interfaces:**

- Consumes: `LiveBuilding` and `atlasBoxFor` from `src/twin/cesium/overpass.ts`; `GeoBox` + `atlasBoxFor(site)` from `scripts/bake/site-config.ts`; `resolveHeight()` from `src/lib/height.ts`.
- Produces: `buildWideBuildings(osm: OverpassResponse, baked: Building[], box: GeoBox): LiveBuilding[]` — consumed by `build-scene.ts`. Emits `public/twins/chatt/buildings-wide.json` typed `LiveBuilding[]`, consumed by `fetchLiveBuildings` in Task 4's runtime.

> **CRITICAL — do not mirror `terrain.json`.** `terrain-wide.json` was a straight copy of a same-shaped artifact over a bigger box. Buildings are not: `buildings.json` rings are **ENU-projected and box-clipped** (`build-scene.ts:296-300` drops anything whose centroid fails `inBox`, defined against `site.box`). The atlas consumes `LiveBuilding`, whose `lonLat` is raw OSM lon/lat _deliberately_ — _"no ENU round-trip, so no projection error and no vectorOffsetM to unwind"_ (`src/twin/cesium/overpass.ts:68-70`). **Emit `LiveBuilding[]`, not a wide `buildings.json`.**

- [ ] **Step 1: Read the two contracts before writing anything**

Run:

```bash
docker compose exec -T scripthammer sed -n '60,140p' src/twin/cesium/overpass.ts
docker compose exec -T scripthammer sed -n '1,60p' scripts/bake/fetch-osm.ts
```

Expected: you can quote `LiveBuilding`, `OverpassBox`, `atlasBoxFor`, `fetchLiveBuildings`, and see that `fetchOsm` hardcodes `osm.json`. `buildWideBuildings` must return exactly `LiveBuilding[]` — same field names, same types.

- [ ] **Step 2: Write the failing test**

Create `scripts/bake/__tests__/build-wide-buildings.test.ts`. House style (per `src/twin/cesium/__tests__/tour.test.ts`): vitest, no mocks, hand-built literals, test names state the invariant.

```ts
import { describe, it, expect } from 'vitest';
import { buildWideBuildings } from '../build-wide-buildings';

const box = { swLat: 35.0078, swLon: -85.345, neLat: 35.076, neLon: -85.283 };

// A minimal Overpass way: a square footprint, tagged.
const way = (
  id: number,
  lon: number,
  lat: number,
  tags: Record<string, string>
) => ({
  type: 'way' as const,
  id,
  tags,
  geometry: [
    { lat, lon },
    { lat, lon: lon + 0.0001 },
    { lat: lat + 0.0001, lon: lon + 0.0001 },
    { lat, lon },
  ],
});

describe('buildWideBuildings', () => {
  it('keeps the BAKED height inside the baked box — a lidar roof is a measurement', () => {
    const osm = { elements: [way(1, -85.31, 35.02, { building: 'yes' })] };
    const baked = [{ id: 1, ring: [], height: 42.5, rule: 'lidar' }];
    const [b] = buildWideBuildings(osm as never, baked as never, box);
    expect(b.heightM).toBe(42.5);
    expect(b.rule).toBe('lidar');
    expect(b.baked).toBe(true);
  });

  it('derives height from tags OUTSIDE the baked box, via the same ladder', () => {
    const osm = {
      elements: [way(2, -85.34, 35.07, { building: 'yes', height: '30' })],
    };
    const [b] = buildWideBuildings(osm as never, [] as never, box);
    expect(b.heightM).toBeCloseTo(30, 1);
    expect(b.baked).toBe(false);
  });

  it('emits raw lon/lat — NOT ENU. The atlas has no vectorOffsetM to unwind', () => {
    const osm = { elements: [way(3, -85.31, 35.02, { building: 'yes' })] };
    const [b] = buildWideBuildings(osm as never, [] as never, box);
    expect(b.lonLat[0]).toBeCloseTo(-85.31, 4);
    expect(b.lonLat[1]).toBeCloseTo(35.02, 4);
  });

  it('does NOT box-clip: a building outside site.box but inside the atlas box survives', () => {
    // -85.34 is outside site.box (swLon -85.316) but inside atlasBox (swLon -85.345).
    // This is the whole point of the wide bake; build-scene.ts's inBox would drop it.
    const osm = { elements: [way(4, -85.34, 35.07, { building: 'yes' })] };
    expect(buildWideBuildings(osm as never, [] as never, box)).toHaveLength(1);
  });

  it('ignores non-building ways — the query is wide, the output is not', () => {
    const osm = {
      elements: [way(5, -85.31, 35.02, { highway: 'residential' })],
    };
    expect(buildWideBuildings(osm as never, [] as never, box)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `docker compose exec -T scripthammer pnpm vitest run scripts/bake/__tests__/build-wide-buildings.test.ts`
Expected: FAIL — `Failed to resolve import "../build-wide-buildings"`.

- [ ] **Step 4: Implement `buildWideBuildings`**

Create `scripts/bake/build-wide-buildings.ts`. Mirror the join `fetchLiveBuildings` already does — read `src/twin/cesium/overpass.ts` and port its join logic, keeping `resolveHeight()` as the ladder for un-baked buildings and `OUTSIDE_HEIGHTS.fallbackClampM = 91.44` as the clamp. Return `LiveBuilding[]`.

```ts
// Bake-time twin of src/twin/cesium/overpass.ts's fetchLiveBuildings (#292).
// Same join, same output type — computed once at bake instead of on every page
// load. The atlas then needs no public API on its default path.
//
// NOT a wide buildings.json: that artifact is ENU-projected and clipped to
// site.box. LiveBuilding.lonLat is raw OSM lon/lat on purpose.
import type { GeoBox } from './site-config';
import { resolveHeight } from '../../src/lib/height';
import type { LiveBuilding } from '../../src/twin/cesium/overpass';

export function buildWideBuildings(
  osm: {
    elements: Array<{
      type: string;
      id: number;
      tags?: Record<string, string>;
      geometry?: Array<{ lat: number; lon: number }>;
    }>;
  },
  baked: Array<{ id: number; height: number; rule: string }>,
  _box: GeoBox
): LiveBuilding[] {
  const bakedById = new Map(baked.map((b) => [b.id, b]));
  const out: LiveBuilding[] = [];
  for (const el of osm.elements) {
    if (!el.tags?.building || !el.geometry?.length) continue;
    const lonLat: number[] = [];
    for (const p of el.geometry) lonLat.push(p.lon, p.lat);
    const hit = bakedById.get(el.id);
    if (hit) {
      out.push({
        id: el.id,
        lonLat,
        heightM: hit.height,
        rule: hit.rule,
        baked: true,
        tags: el.tags,
      });
    } else {
      const r = resolveHeight(el.tags);
      out.push({
        id: el.id,
        lonLat,
        heightM: r.heightM,
        rule: r.rule,
        baked: false,
        tags: el.tags,
      });
    }
  }
  return out;
}
```

> If `resolveHeight`'s real signature differs from `(tags) => { heightM, rule }`, adapt to the actual one — read `src/lib/height.ts` first and match it exactly rather than reshaping it.

- [ ] **Step 5: Run the tests until green**

Run: `docker compose exec -T scripthammer pnpm vitest run scripts/bake/__tests__/build-wide-buildings.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Parameterize `fetchOsm`'s output filename**

Mirror what `1b3b0b4` did to `fetch-terrain.ts`. In `scripts/bake/fetch-osm.ts:35`:

```ts
export async function fetchOsm(
  outDir: string,
  box: GeoBox,
  opts: { filename?: string } = {}
) {
  const filename = opts.filename ?? 'osm.json';
```

and at its write site, replace the hardcoded `'osm.json'` with `filename`.

- [ ] **Step 7: Add the wide-OSM fetch stage to `run.ts`**

In `scripts/bake/run.ts`, beside the existing wide-terrain stage (`:163-179`), add:

```ts
// Wide OSM for the atlas (#292). Guard is reference identity — atlasBoxFor
// returns site.box itself when the site has no atlasBox.
if (atlasBox !== site.box) {
  console.log('[bake] fetch-osm (wide atlas extent)...');
  await fetchOsm(paths.raw, atlasBox, { filename: 'osm-wide.json' });
}
```

- [ ] **Step 8: Add `buildings-wide.json` to the promotion list**

In `scripts/bake/run.ts:208-221`, append to the array:

```ts
    // Wide atlas buildings (#292). Optional — sites without an atlasBox have none.
    'buildings-wide.json',
```

> This list is the atomic-swap guard. Its own commit message: _"a file missing from it is silently dropped, which cost two rebakes to notice."_ Skipping this step produces a green bake with no artifact.

- [ ] **Step 9: Write `buildings-wide.json` in `build-scene.ts`**

Where the wide terrain is copied (`:496-503`), add the wide-buildings write — read `osm-wide.json`, call `buildWideBuildings(osmWide, buildings, atlasBoxFor(site))`, `writeFileSync` to `join(tmpDir, 'buildings-wide.json')`. Guard on `existsSync(join(rawDir, 'osm-wide.json'))` so sites without an `atlasBox` are unaffected.

- [ ] **Step 10: Run the bake and verify the artifact SEMANTICALLY**

Run the bake (find the command: `docker compose exec -T scripthammer cat package.json | grep -A2 '"bake'`).

Then:

```bash
docker compose exec -T scripthammer node -e '
const b=require("./public/twins/chatt/buildings-wide.json");
console.log("count:", b.length);
console.log("has lonLat:", Array.isArray(b[0].lonLat));
console.log("baked share:", b.filter(x=>x.baked).length);
console.log("rules:", [...new Set(b.map(x=>x.rule))].join(","));
'
```

Expected: count in the several-thousands (prod's live query returned **8031**); `has lonLat: true`; `baked share` ≈ 1500 (the site.box buildings keep their measured heights); rules include `lidar`.

Per `lesson_bake_byte_comparability_prettier`: verify **semantically**, not by byte-diffing prettified artifacts. `drape.jpg` is the byte-identity check; the manifest compares modulo `fetchedAt`/`site`/`drape.path`.

- [ ] **Step 11: Point `fetchLiveBuildings` at the baked artifact, keep `?live`**

In `src/twin/cesium/overpass.ts`, `fetchLiveBuildings` keeps its exact signature and return type. Default path: fetch `<assetUrl>/twins/<slug>/buildings-wide.json` and return it. When `new URLSearchParams(window.location.search).has('live')`, take the existing Overpass path instead. Use `getAssetUrl` from `@/config/project.config` for the URL — never a literal (basePath is `''` in prod, `/ScriptHammer` locally).

- [ ] **Step 12: Verify in the browser — the network tab is the assertion**

```bash
docker compose restart scripthammer
```

Wait for 200, then load `http://127.0.0.1:3002/ScriptHammer/chatt/?atlas&cb=1` in Playwright MCP and check:

- The HUD's building count is in the thousands.
- **No request to `overpass-api.de`** in `browser_network_requests`. That is the whole point of this task.
- Then load `?atlas&live&cb=2` and confirm the Overpass request _does_ fire.

- [ ] **Step 13: Commit**

```bash
git checkout -- public/manifest.json
docker compose exec -T scripthammer git add scripts/bake src/twin/cesium/overpass.ts public/twins/chatt/buildings-wide.json
docker compose exec -T scripthammer git commit -m "feat(#292): bake the atlas's wide buildings, so the default path needs no public API

The atlas queried Overpass at runtime on EVERY page load — an unthrottled 43km2
query against a free community API whose usage policy forbids heavy automated
use. Tolerable while the atlas is opt-in; it is about to become the default.

Not a wide buildings.json: that artifact is ENU-projected and clipped to
site.box (build-scene.ts drops anything whose centroid fails inBox). The atlas
consumes LiveBuilding, whose lonLat is raw OSM lon/lat on purpose — no ENU
round-trip, no projection error, no vectorOffsetM to unwind. So bake a
LiveBuilding[]: exactly what fetchLiveBuildings returns, computed once.

sites/chatt.json already carried atlasBox, so no new config. Live Overpass
stays available behind ?live."
```

---

## Task 2: Flip the default

**Files:**

- Modify: `src/twin/TwinCanvasHost.tsx:9-14` (the comment) and `:51-61` (the switch)
- Modify: the nav config ("Twin" → "3D Map")

**Interfaces:**

- Consumes: nothing new.
- Produces: no exported API change. `TwinCanvasHost({ slug, focus })` keeps its signature.

- [ ] **Step 1: Find the nav item**

Run: `docker compose exec -T scripthammer grep -rn "'Twin'\|\"Twin\"\|>Twin<" src/components src/config --include=*.tsx --include=*.ts`
Expected: one nav definition. Note its file:line — you edit it in Step 5.

- [ ] **Step 2: Write the failing test**

The switch is currently inline and untestable. Extract the decision as a pure function so it can be tested without a browser. Create `src/twin/__tests__/renderer-select.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectRenderer } from '../renderer-select';

const q = (s: string) => new URLSearchParams(s);

describe('selectRenderer', () => {
  it('defaults to the atlas — it is the better renderer and the one we ship', () => {
    expect(selectRenderer(q(''))).toBe('atlas');
  });

  it('?diorama opts out to the R3F exhibit', () => {
    expect(selectRenderer(q('?diorama'))).toBe('diorama');
  });

  it('?atlas stays a no-op alias so shared links keep working', () => {
    expect(selectRenderer(q('?atlas'))).toBe('atlas');
  });

  it('?ortho implies the diorama — it is a diorama compare mode', () => {
    expect(selectRenderer(q('?ortho'))).toBe('diorama');
  });

  it('?edit implies the diorama — the placement editor is diorama-only', () => {
    expect(selectRenderer(q('?edit'))).toBe('diorama');
  });

  it('?house implies the diorama — the as-built framing is diorama-only', () => {
    expect(selectRenderer(q('?house'))).toBe('diorama');
  });

  it('an explicit ?diorama beats a stray ?atlas', () => {
    expect(selectRenderer(q('?atlas&diorama'))).toBe('diorama');
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `docker compose exec -T scripthammer pnpm vitest run src/twin/__tests__/renderer-select.test.ts`
Expected: FAIL — cannot resolve `../renderer-select`.

- [ ] **Step 4: Implement and wire it**

Create `src/twin/renderer-select.ts`:

```ts
// Which renderer does this URL want? (#292)
//
// The atlas is the default: it is the better view of the city, and the one the
// nav points at. The diorama's own features are its opt-in — ?ortho, ?house and
// ?edit are diorama-only, so they imply it rather than needing ?diorama too.
// ?atlas remains a no-op alias: links shared before the flip must keep working.
export type Renderer = 'atlas' | 'diorama';

const DIORAMA_ONLY = ['diorama', 'ortho', 'house', 'edit'] as const;

export function selectRenderer(params: URLSearchParams): Renderer {
  return DIORAMA_ONLY.some((p) => params.has(p)) ? 'diorama' : 'atlas';
}
```

Then in `src/twin/TwinCanvasHost.tsx` replace `:57-61`:

```tsx
const params =
  typeof window === 'undefined'
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);
// focus='house' is the as-built property framing (#234) — diorama-only, and it
// arrives as a prop rather than a param.
if (focus === 'house' || selectRenderer(params) === 'diorama') {
  return <TwinCanvas slug={slug} focus={focus} />;
}
return <AtlasViewer slug={slug} />;
```

And update the file's header comment (`:9-14`) — it currently says _"`?atlas` selects the Cesium view. It is opt-in while the atlas is built out — the diorama stays the default until the atlas is at parity"_. That is now false. Replace with the current truth: the atlas is the default; `?diorama` opts out; the diorama's own features imply it.

- [ ] **Step 5: Rename the nav item**

At the file:line from Step 1, change the label `Twin` → `3D Map`. Leave the href at `/chatt/`.

- [ ] **Step 6: Run the tests**

Run: `docker compose exec -T scripthammer pnpm vitest run src/twin/__tests__/renderer-select.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 7: Drive both renderers in the browser**

```bash
docker compose restart scripthammer
```

Via Playwright MCP at `http://127.0.0.1:3002`:

- `/ScriptHammer/chatt/?cb=1` → the **atlas** (panel reads "Atlas — chatt").
- `/ScriptHammer/chatt/?diorama&cb=2` → the **diorama** (text "Chattanooga Mini" present).
- `/ScriptHammer/chatt/?ortho&cb=3` → the **diorama**.
- `/ScriptHammer/chatt/?atlas&cb=4` → the **atlas** (alias still works).
- Screenshot the first two. **Look at them** — `textContent` returns obscured text as happily as visible text.

- [ ] **Step 8: Commit**

```bash
git checkout -- public/manifest.json
docker compose exec -T scripthammer git add src/twin/ src/components src/config
docker compose exec -T scripthammer git commit -m "feat(#292): the atlas is the default renderer; ?diorama opts out

The atlas is the better view of the city and the one worth landing on. This is
the roadmap's own endgame ('flip ?atlas to default'), pulled forward.

?atlas stays a no-op alias so links shared before the flip keep working. The
diorama's own features imply it rather than needing ?diorama too: ?ortho,
?house and ?edit are all diorama-only. Nav: Twin -> 3D Map.

Rejected a dedicated /atlas route: it names the URL after the ENGINE, which is
what the Build Plan's renderer-split forbids ('the data is the bridge, not the
engine'). /twins/[slug] scales to N cities; /atlas hard-codes one.

The switch moves out of the component into selectRenderer() so the decision is
testable without a browser.

Hides the diorama dock + tilt-shift behind ?diorama until ported."
```

---

## Task 3: Retarget the E2E suite

**Why:** Task 2 breaks it. Verified against the live atlas: it renders **"Atlas — chatt"**, and the string `Chattanooga Mini` appears **nowhere** in it, nor do `More controls`/`Top-down`.

**Files:**

- Modify: `tests/e2e/twins.spec.ts`

**Interfaces:**

- Consumes: `selectRenderer` semantics from Task 2 (`?diorama` opts out).
- Produces: nothing importable.

- [ ] **Step 1: Confirm the breakage before fixing it — this is the control**

Run: `docker compose exec -T scripthammer pnpm exec playwright test tests/e2e/twins.spec.ts --project=chromium --reporter=list`
Expected: **FAILURES** on the wordmark specs. If everything passes, Task 2 did not land — stop and check, because a green here means the flip is not in effect and the retarget below would be meaningless.

- [ ] **Step 2: Retarget the diorama specs**

In `tests/e2e/twins.spec.ts`, every `page.goto('/twins/chatt/')` and `page.goto('/chatt/')` in a spec that asserts `WORDMARK` or drives the dock becomes `?diorama`:

```ts
await page.goto('/twins/chatt/?diorama');
await page.goto('/chatt/?diorama');
```

`?ortho` already implies the diorama (Task 2), so the `?ortho` spec at `:96` needs no change.

The homepage-navigation spec (`:50-63`) clicks a `Digital Twin` link and then asserts the wordmark. That link now lands on the **atlas**, so it must assert atlas chrome instead — see Step 4.

Update the file's header comment (`:1-14`) — it describes the diorama as the default.

- [ ] **Step 3: Run them green**

Run: `docker compose exec -T scripthammer pnpm exec playwright test tests/e2e/twins.spec.ts --project=chromium --reporter=list`
Expected: PASS.

- [ ] **Step 4: Add the atlas coverage that has never existed**

`grep -riE "atlas|cesium" tests/e2e/` returns **0 hits** today — the atlas shipped with no E2E at all. Add to `tests/e2e/twins.spec.ts`:

```ts
test.describe('/chatt — the atlas is the default (#292)', () => {
  // DOM chrome, never the canvas: CI has no guaranteed WebGL, so a canvas
  // assertion test.skip()s into a false green — the #288 failure mode. The
  // panel is a DOM sibling of the canvas and renders without a GPU.
  test('/chatt/ renders the atlas by default', async ({ page }) => {
    await page.goto('/chatt/');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });
  });

  test('the atlas reports a real building count, not an empty scene', async ({
    page,
  }) => {
    await page.goto('/chatt/');
    await expect(page.getByText(/\d[\d,]* buildings/).first()).toBeVisible({
      timeout: 20000,
    });
  });

  test('?diorama still reaches the exhibit', async ({ page }) => {
    await page.goto('/chatt/?diorama');
    await expect(page.getByText('Chattanooga Mini').first()).toBeVisible({
      timeout: 20000,
    });
  });

  test('?atlas remains a working alias for links shared before the flip', async ({
    page,
  }) => {
    await page.goto('/chatt/?atlas');
    await expect(page.getByText('Atlas —').first()).toBeVisible({
      timeout: 20000,
    });
  });
});
```

- [ ] **Step 5: Run the whole file**

Run: `docker compose exec -T scripthammer pnpm exec playwright test tests/e2e/twins.spec.ts --project=chromium --reporter=list`
Expected: PASS. Read the summary line for `flaky` — a retry-recovered pass is not a pass.

- [ ] **Step 6: Commit**

```bash
docker compose exec -T scripthammer git add tests/e2e/twins.spec.ts
docker compose exec -T scripthammer git commit -m "test(#292): retarget the twin E2E to ?diorama, and cover the atlas at last

The default flip breaks this suite by design: the atlas renders 'Atlas — chatt'
and the string 'Chattanooga Mini' appears nowhere in it, nor do More controls /
Top-down. Verified against the live atlas before writing this.

Also closes a real gap — grep -riE 'atlas|cesium' tests/e2e/ returned ZERO hits.
The atlas took prod down for five hours (#294) and shipped with no E2E at all.

Asserts DOM chrome, never the canvas: CI has no guaranteed WebGL, so a canvas
assertion test.skip()s into a false green — #288's exact failure mode."
```

---

## Task 4: Tour auto-start + the social card

**Files:**

- Modify: `src/twin/cesium/tour.ts` (add `shouldAutoStart`)
- Modify: `src/twin/cesium/__tests__/tour.test.ts`
- Modify: `src/twin/cesium/AtlasViewer.client.tsx` (`:415`, `:541-556`)
- Modify: `src/app/chatt/page.tsx`
- Create: `public/chatt-atlas-og.jpg`
- Modify: `tests/e2e/tests/broken-links.spec.ts:281`

**Interfaces:**

- Consumes: `useReducedMotion()`; `generateMetadata` from `@/utils/metadata`; `rebuildTourRef`/`tourRef.current.play` in `AtlasViewer.client.tsx`.
- Produces: `shouldAutoStart(o: { hasStops: boolean; notour: boolean; reducedMotion: boolean }): boolean`, exported from `src/twin/cesium/tour.ts`.

- [ ] **Step 1: Write the failing test**

Append to `src/twin/cesium/__tests__/tour.test.ts`:

```ts
describe('shouldAutoStart', () => {
  it('plays on arrival — the tour is the best thing on the page', () => {
    expect(
      shouldAutoStart({ hasStops: true, notour: false, reducedMotion: false })
    ).toBe(true);
  });

  it('?notour suppresses it — you cannot work on the atlas if it flies every reload', () => {
    expect(
      shouldAutoStart({ hasStops: true, notour: true, reducedMotion: false })
    ).toBe(false);
  });

  it('NEVER auto-flies under reduced motion (WCAG 2.3.3) — the button still offers it', () => {
    expect(
      shouldAutoStart({ hasStops: true, notour: false, reducedMotion: true })
    ).toBe(false);
  });

  it('no stops, no autoplay — never a tour that flies nowhere', () => {
    expect(
      shouldAutoStart({ hasStops: false, notour: false, reducedMotion: false })
    ).toBe(false);
  });
});
```

Add `shouldAutoStart` to the file's existing import from `../tour`.

- [ ] **Step 2: Run it and watch it fail**

Run: `docker compose exec -T scripthammer pnpm vitest run src/twin/cesium/__tests__/tour.test.ts`
Expected: FAIL — `shouldAutoStart is not a function`.

- [ ] **Step 3: Implement it**

Append to `src/twin/cesium/tour.ts`:

```ts
/**
 * Should the tour play itself on arrival? (#292)
 *
 * Reduced motion is the hard no: auto-flying a camera is exactly the vestibular
 * trigger WCAG 2.3.3 exists for. A user who CLICKS play still gets the normal
 * flight — they asked for it, and the flight is the button's whole function.
 */
export function shouldAutoStart(o: {
  hasStops: boolean;
  notour: boolean;
  reducedMotion: boolean;
}): boolean {
  return o.hasStops && !o.notour && !o.reducedMotion;
}
```

- [ ] **Step 4: Run the tests**

Run: `docker compose exec -T scripthammer pnpm vitest run src/twin/cesium/__tests__/tour.test.ts`
Expected: PASS.

- [ ] **Step 5: Promote the button**

In `src/twin/cesium/AtlasViewer.client.tsx:541-556`, the tour button is `className="btn btn-xs min-h-0"` inside `<div className="mt-2 flex gap-1">`. Make Play a full-width primary above the chip row, and leave `corners` a chip:

```tsx
<button
  className="btn btn-primary btn-sm min-h-11 w-full"
  onClick={() => tourRef.current?.play(tourRef.current.stops)}
  disabled={!tourRef.current?.stops.length}
>
  ▶ Play tour
</button>
```

`min-h-0` must not survive — CLAUDE.md mandates `min-h-11` (44px).

- [ ] **Step 6: Wire auto-start to the tour-BUILT signal**

Hang auto-start off `rebuildTourRef` (where stops first exist), **not** page load — there are no stops until buildings resolve. Read `?notour` with `new URLSearchParams(window.location.search)`, never `useSearchParams`. Gate with `shouldAutoStart` and `useReducedMotion()`. Fire once — guard with a ref so a rebuild does not restart a tour the user already cancelled.

> **Use `useReducedMotion()`, not AccessibilityContext.** There are two disjoint mechanisms: `settings.reduceMotion` (AccessibilityContext) **throws without a provider** and is used by no 3D code; `useReducedMotion()` is a matchMedia boolean needing no provider, and `Scene.tsx:85` already uses it to gate auto-orbit — the identical use case. `reduced-motion.css` is irrelevant: it nulls four Tailwind keyframe classes and has no reach over `camera.flyTo`.

- [ ] **Step 7: Abort on interaction — NOT via the Cesium handler**

> **The obvious hook is a trap.** `AtlasViewer.client.tsx` creates its `ScreenSpaceEventHandler` at `:466` — _after_ the live-fetch `await` at `:424-429` that the code budgets at 60s+. Auto-start fires off `setReady(true)` at `:415`. An abort hooked at `:466` is **inert for exactly the window auto-start is playing**.

Register on `document` instead — the pattern `Scene.tsx:~112` uses, which needs no Cesium object:

```tsx
useEffect(() => {
  const abort = () => tourRef.current?.stop();
  const opts = { passive: true } as const;
  document.addEventListener('pointerdown', abort, opts);
  document.addEventListener('wheel', abort, opts);
  document.addEventListener('touchstart', abort, opts);
  return () => {
    document.removeEventListener('pointerdown', abort);
    document.removeEventListener('wheel', abort);
    document.removeEventListener('touchstart', abort);
  };
}, []);
```

> Clicking the Play button is itself a `pointerdown`. Ensure the handler does not cancel the tour the click just started — either stop propagation on the HUD panel, or ignore events whose `target` is inside the panel. **Verify this by hand in Step 10; it is the most likely bug in this task.**

- [ ] **Step 8: Capture the OG image**

With the atlas live, use Playwright MCP: resize to 1200×630, load `/ScriptHammer/chatt/?notour&cb=9`, hide the chrome, screenshot, save as JPEG < 300KB at `public/chatt-atlas-og.jpg`.

```js
// hide chrome so the card is the city, not the UI
document
  .querySelectorAll(
    'nav, header, [data-testid="atlas-tour"], [class*="cookie"]'
  )
  .forEach((el) => (el.style.display = 'none'));
```

Verify: `node -e 'const s=require("fs").statSync("public/chatt-atlas-og.jpg"); console.log(s.size)'` → under 300000.

- [ ] **Step 9: Wire the card**

Rewrite `src/app/chatt/page.tsx`:

```tsx
// Flagship alias: /chatt is the friendly URL for the Chattanooga twin.
// The canonical viewer route is /twins/chatt (see src/app/twins/[slug]).
import type { Metadata } from 'next';
import TwinCanvasHost from '@/twin/TwinCanvasHost';
import { generateMetadata as buildMetadata } from '@/utils/metadata';

export const metadata: Metadata = {
  ...buildMetadata({
    title: 'Chattanooga in 3D — open-source city atlas',
    description:
      '8,000 buildings at real lidar heights over live OpenStreetMap and USGS 3DEP terrain, in your browser. Open source — join in at Chattanooga.Digital.',
    path: '/chatt/',
    image: '/chatt-atlas-og.jpg',
  }),
  // The helper derives BOTH canonical and og:url from `path` (metadata.tsx:40).
  // og:url should be what people share (/chatt/), but canonical must stay the
  // canonical viewer route — otherwise /chatt/ and /twins/chatt/ become
  // duplicate content, an SEO regression introduced while fixing SEO.
  alternates: { canonical: '/twins/chatt/' },
};

export default function ChattPage() {
  return <TwinCanvasHost slug="chatt" />;
}
```

> Import the helper **aliased** (`as buildMetadata`). `generateMetadata` is also Next's own route-level export name — `src/app/twins/[slug]/page.tsx:35` exports one. Aliasing keeps the two unambiguous.

- [ ] **Step 10: Verify the card and the tour for real**

```bash
docker compose run --rm builder pnpm build
docker compose exec -T scripthammer node -e '
const h=require("fs").readFileSync("out/chatt/index.html","utf8");
for (const m of h.match(/<meta (property|name)="(og|twitter):[a-z:]+" content="[^"]*"/g) || []) console.log(m);
console.log(h.match(/<link rel="canonical"[^>]*>/)[0]);
'
```

Expected: `og:title` = "Chattanooga in 3D — open-source city atlas | ScriptHammer"; `og:url` = `https://scripthammer.com/chatt/`; `og:image` = `https://scripthammer.com/chatt-atlas-og.jpg`; **canonical** = `https://scripthammer.com/twins/chatt/`. If canonical shows `/chatt/`, the override is missing — that is the SEO regression.

Then in the browser (`docker compose restart scripthammer` first):

- `/ScriptHammer/chatt/?cb=1` → tour **auto-plays**; caption appears.
- **Drag the globe mid-tour** → tour stops, camera yields. This is the Step 7 hazard — verify by hand.
- **Click Play** → tour starts and _keeps running_ (the click's own `pointerdown` must not cancel it).
- `/ScriptHammer/chatt/?notour&cb=2` → still globe, no auto-play, Play button prominent.
- Screenshot. **Look at it.**

- [ ] **Step 11: Guard the new image with the existing test**

`tests/e2e/tests/broken-links.spec.ts:281` already fetches each page's `og:image` and fails on status ≥ 400 — but only for `['/', '/blog', '/blog/scripthammer-intro']`. Add `'/chatt'` to that array so a broken card fails CI.

- [ ] **Step 12: Full validation**

Run: `./scripts/validate-ci.sh --quick`
Expected: all green, including the chunk-parse gate.

- [ ] **Step 13: Commit**

```bash
git checkout -- public/manifest.json
docker compose exec -T scripthammer git add src/twin/cesium src/app/chatt/page.tsx public/chatt-atlas-og.jpg tests/e2e/tests/broken-links.spec.ts
docker compose exec -T scripthammer git commit -m "feat(#292): the tour plays itself, and /chatt gets its own card

The tour was the best thing on the page and the hardest control to find — a
btn-xs min-h-0 chip, fifth in a row of near-identical chips, below the 44px
touch target CLAUDE.md mandates. Now it plays on arrival and the button is a
real primary.

Reduced motion never gets an auto-flight (WCAG 2.3.3) — but a CLICK still flies:
they asked for it. Uses useReducedMotion() (matchMedia, no provider), the same
hook Scene.tsx:85 uses to gate auto-orbit; AccessibilityContext's reduceMotion
throws without a provider and no 3D code reads it.

Abort-on-interaction listens on document, NOT the Cesium ScreenSpaceEventHandler
— that is created after a 60s+ await while auto-start fires before it, so an
abort hooked there is inert for exactly the window the tour is playing.

And /chatt stops advertising the homepage: it served the root layout's OG block
verbatim, og:url included, so sharing the 3D map linked people home. canonical
is deliberately overridden back to /twins/chatt/ — the helper derives both from
`path`, and letting it win would make /chatt/ and /twins/chatt/ duplicate
content while 'fixing' SEO."
```

---

## Verification (whole arc)

1. `./scripts/validate-ci.sh --quick` green.
2. Prod after deploy: `/chatt/` renders the atlas; `/chatt/?diorama` renders the diorama; `og:url` = `https://scripthammer.com/chatt/`; canonical = `/twins/chatt/`.
3. **No `overpass-api.de` request** on the default path — the reason Task 1 came first.
4. Card preview: paste `https://scripthammer.com/chatt/` into a social debugger and confirm the atlas image, not the homepage.

## Out of scope

Project C (site-wide OG for the other ~15 public routes), porting the diorama's dock to the atlas, retiring the R3F path, the `relative h-screen` overflow, and `opengraph-image.png`'s 3.55 MB. All tracked in the spec.
