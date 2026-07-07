# Chattanooga Mini Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the M1 vertical slice of Chattanooga Mini — a tilt-shift miniature diorama of real downtown Chattanooga, ported from the `cm/*.js` vanilla-three artifact game to Next.js 15 + React Three Fiber, with all geodata baked offline.

**Architecture:** A hard bake↔runtime seam. **Part A (bake)** is a Docker service that fetches OSM footprints/streets (Overpass), terrain (OpenTopoData NED-10m), and an aerial drape (USGS NAIP), projects everything into a local ENU metric frame, and commits static JSON + a drape image to `public/chatt/`. **Part B (runtime)** is a Next.js App Router app whose `<Canvas>` host is dynamically imported `ssr:false`; it loads the committed assets only — zero third-party calls at runtime. The generic 3D layer (`StageCore`, `Rig`, `Hud`, tilt-shift, light-rig, material-kit) is built to be liftable; project logic lives in `world`/`packs`/`agents`/`bake`.

**Tech Stack:** Next.js 15.5 (App Router, static export), React 19, TypeScript strict, three 0.184, @react-three/fiber 9, @react-three/drei 10, the raw `postprocessing` package (NOT @react-three/postprocessing), `tsx` for bake scripts, Docker + Docker Compose, Vitest, Playwright.

## Global Constraints

- **Docker-first, no host installs.** Never run `npm install`/`pnpm install`/`node` on the host. All commands run in containers: `docker compose exec app pnpm ...`, `docker compose run --rm chatt-bake ...`. Never use `sudo`; fix permission errors with `docker compose down && docker compose up`.
- **Zero runtime third-party calls.** The runtime fetches only `public/chatt/*`. No Overpass/OpenTopoData/NAIP/Esri at runtime.
- **Every runtime asset URL goes through `getAssetUrl(path)`** (from `src/lib/assetUrl.ts`). Never hardcode `/chatt/...` absolute strings — they 404 under the GitHub Pages basePath.
- **The box (WGS-84), v2 corridor:** `SW 35.0078,-85.3160 · NE 35.0600,-85.3000`. ENU origin = center `35.0339,-85.3080`. `metersPerDegree_lon = 111320·cos(35.0339°) ≈ 91150`, `metersPerDegree_lat = 110574`. North = −Z. Ground ≈ 1458 m (E-W) × 5772 m (N-S), aspect ~0.25. **v2 note:** the south edge was extended from 35.0340 → 35.0078 to include the Chattanooga Choo Choo / Terminal Station (~35.0093). Re-baked: buildings 797→1544, highways 1849→2499, terrain grid 40×40→25×60, drape 729×1437→729×2886. The compact pre-Choo-Choo extent is kept as `BOX.tightCoreSouthLat = 35.034`. Any plan code block below showing the OLD values (35.034 south edge, 1458×2875, 729×1437) is historical — the committed code uses the v2 corridor values.
- **One color owner: the Grade pass.** `gl.toneMapping = NoToneMapping`; the only `lin2srgb` in the whole chain is inside the Grade shader (ACES folded in before it). Eyedrop gate: linear-0.5 → ~0.5, not ~0.73.
- **Post-processing uses the raw `postprocessing` package**, not `@react-three/postprocessing`'s `<EffectComposer>`/`<Effect>` (it cannot host cm's separable ShaderPass blur).
- **`StageCore` imports nothing from `src/world`, `src/packs`, `src/agents`.** Enforced by an import-guard test.
- **SSR boundary:** `app/page.tsx` is a server component that `dynamic()`-imports `ChattCanvas` with `{ssr:false}`. Nothing importing `postprocessing`, `three`, or the Rig may cross that boundary.
- **Provenance string (verbatim, shown in HUD):** `© OpenStreetMap · USGS 3DEP · USGS NAIP`.
- **Overpass requires a `User-Agent` header** (bare requests 406). Value: `chattanooga-mini-bake/0.1 (jonpohlner@gmail.com)`.
- **Hero-swap slots** are tagged `userData.swap = "<name>"`; `grep -r userData.swap src/` must find all 8.
- **TDD, DRY, YAGNI, frequent commits.** Every code step shows real code. Commit from inside the container.

---

## File Structure

**Bake (Part A):**

- `scripts/bake/box.ts` — the locked bbox + ENU constants + config (tight-core fallback). Single source of truth for coordinates.
- `scripts/bake/enu.ts` — `lonLatToEnu()`, `enuToLonLat()`. Shared by bake and runtime (re-exported from `src/lib/enu.ts`).
- `scripts/bake/overpass.ts` — Overpass POST client with User-Agent + retry.
- `scripts/bake/fetch-osm.ts` — buildings (ways + relations) + highways → `_raw/osm.json`.
- `scripts/bake/fetch-terrain.ts` — OpenTopoData ned10m grid, batched ≤100/req, throttled → `_raw/terrain-*.json`.
- `scripts/bake/fetch-drape.ts` — NAIP exportImage, meter-proportional size → `_raw/drape.jpg`.
- `scripts/bake/height.ts` — the height heuristic (4 rules, tag-bucketed fallback).
- `scripts/bake/build-scene.ts` — reads `_raw/`, projects to ENU, quantizes, emits `public/chatt/*`.
- `scripts/bake/run.ts` — orchestrates the four fetches + build in order, atomic-mv into `public/chatt`.

**Runtime (Part B):**

- `app/page.tsx`, `app/layout.tsx`, `app/ChattCanvas.client.tsx` (composition root).
- `src/lib/assetUrl.ts`, `src/lib/enu.ts`, `src/lib/manifest.ts`.
- `src/stage/StageCore.tsx` (liftable), `src/stage/Rig.ts` (liftable), `src/stage/Hud.tsx` (liftable), `src/stage/lightRig.ts`, `src/stage/materialKit.ts`.
- `src/post/tiltShift.ts` (raw-`postprocessing` composer builder), `src/post/shaders.ts` (ported GLSL).
- `src/world/ChattWorld.tsx`, `Buildings.tsx`, `Terrain.tsx`, `Streets.tsx`, `Heroes.tsx`, `Avatar.tsx`.
- `src/agents/trolley.tsx`.
- `src/packs/themes.ts`, `tours.ts`.

---

## Part A — Bake pipeline (offline, Docker). Produces `public/chatt/*`.

### Task 1: Fork ScriptHammer + verify green + add diorama deps (REVISED — fork-based)

> **PIVOT (session 2026-07-06):** Chattanooga Mini is a **ScriptHammer fork**, not a
> standalone repo. The fork gives us, working and tested: the real `pnpm-lock.yaml`,
> `next.config.ts` (with auto-detected basePath), `docker/Dockerfile` (multi-stage
> `node:22-slim`), `docker-compose.yml`, `src/config/project.config.ts` (the real
> `getAssetUrl`), Vitest, Playwright, and CI. **We do NOT hand-write bootstrap config.**
> The original hand-written Task 1 (with its phantom `typescript@5.7.0`) is obsolete.
>
> **Docker service name is `scripthammer`** (from the fork's compose). Every plan command
> written as `docker compose run --rm app …` MUST be read as
> `docker compose run --rm scripthammer …`. (A later cleanup pass may rename the service.)
>
> **Diorama mounts at `app/chatt/`** (a new route), NOT `app/page.tsx` — ScriptHammer's
> existing app stays running. Prune ScriptHammer's auth/messaging/payments/blog in a
> LATER dedicated pass, only after the diorama renders.
>
> **Runtime asset URLs use the fork's existing `getAssetUrl` from `@/config/project.config`**
> — do NOT create `src/lib/assetUrl.ts` (Task 10 is revised accordingly).

**Files:**

- Fork base already in place (ScriptHammer source copied, git re-init'd on `feat/m1-vertical-slice`).
- Modify: `package.json` (add `postprocessing`; `three`/`@react-three/fiber`/`@react-three/drei`/`tsx` are ALREADY present), add a `bake` script.
- Create: `scripts/bake/__tests__/smoke.test.ts`, `app/chatt/page.tsx` (route stub), `app/chatt/ChattCanvas.client.tsx` (filled in Task 20).
- Add a `chatt-bake` service (or a `bake` npm script run via `docker compose run --rm scripthammer pnpm bake`).

**Interfaces:**

- Produces: a GREEN forked base (`docker compose run --rm scripthammer pnpm test` passes the inherited suite), `postprocessing` installed, `pnpm bake` wired, an `app/chatt/` route stub reachable.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "chattanooga-mini",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "type-check": "tsc --noEmit",
    "bake": "tsx scripts/bake/run.ts"
  },
  "dependencies": {
    "next": "15.5.9",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "three": "0.184.0",
    "@react-three/fiber": "9.6.1",
    "@react-three/drei": "10.7.7",
    "postprocessing": "6.36.0"
  },
  "devDependencies": {
    "@types/node": "22.10.0",
    "@types/react": "19.1.0",
    "@types/three": "0.184.1",
    "typescript": "5.7.0",
    "tsx": "4.19.0",
    "vitest": "2.1.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`, `next.config.ts`, `vitest.config.ts`**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "resolveJsonModule": true,
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts` (basePath auto-detected via env; no detect-project script in this standalone repo):

```ts
import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath ? `${basePath}/` : '',
  trailingSlash: true,
  images: { unoptimized: true },
  distDir: process.env.NEXT_DIST_DIR || '.next',
  cleanDistDir: true,
};

export default nextConfig;
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['**/*.test.ts'] },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
```

- [ ] **Step 3: Write Docker files**

`docker/Dockerfile`:

```dockerfile
FROM node:24-bookworm
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json ./
RUN pnpm install --no-frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]
```

`docker-compose.yml` (two services: `app` dev server + `chatt-bake` one-shot):

```yaml
services:
  app:
    build: { context: ., dockerfile: docker/Dockerfile }
    ports: ['3000:3000']
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH:-}
    command: pnpm dev
  chatt-bake:
    build: { context: ., dockerfile: docker/Dockerfile }
    volumes:
      - ./scripts:/app/scripts
      - ./public:/app/public
      - /app/node_modules
    command: pnpm bake
```

`.dockerignore`: `node_modules`, `.next`, `out`, `.git`.
`.gitignore`: `node_modules/`, `.next/`, `out/`, `*.tsbuildinfo`, `public/chatt/_raw/*.tmp`, `.env.local`.

- [ ] **Step 4: Write minimal `app/layout.tsx` + `app/page.tsx`**

`app/layout.tsx`:

```tsx
export const metadata = { title: 'Chattanooga Mini' };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, height: '100vh', background: '#070a12' }}>
        {children}
      </body>
    </html>
  );
}
```

`app/page.tsx` (placeholder until Task 15 wires the Canvas):

```tsx
export default function Page() {
  return (
    <main style={{ color: '#cdbfa4', padding: 24 }}>
      Chattanooga Mini — bootstrapping.
    </main>
  );
}
```

- [ ] **Step 5: Write the smoke test**

`scripts/bake/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('bootstrap', () => {
  it('runs tsx/vitest in the container', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Build the container and run the smoke test**

Run:

```bash
docker compose build app
docker compose run --rm app pnpm test
```

Expected: PASS (1 test), and `docker compose up app` serves localhost:3000 with the placeholder page.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Next 15 + R3F + Docker + tsx"
```

### Task 2: The box + ENU projection (pure, shared by bake & runtime)

**Files:**

- Create: `scripts/bake/box.ts`, `scripts/bake/enu.ts`
- Test: `scripts/bake/__tests__/enu.test.ts`

**Interfaces:**

- Produces:
  - `BOX = { swLat, swLon, neLat, neLon, centerLat, centerLon, tightCoreSouthLat }` (all numbers)
  - `M_PER_DEG_LON: number` (`111320 * Math.cos(centerLat * Math.PI/180)`), `M_PER_DEG_LAT = 110574`
  - `lonLatToEnu(lon: number, lat: number): [number, number]` → `[x_east, z_north_negated]` where north is −Z
  - `enuGroundSize(): { widthM: number, depthM: number }`

- [ ] **Step 1: Write the failing test**

`scripts/bake/__tests__/enu.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  BOX,
  M_PER_DEG_LON,
  M_PER_DEG_LAT,
  lonLatToEnu,
  enuGroundSize,
} from '../enu';

describe('ENU projection', () => {
  it('locks the box constants', () => {
    expect(BOX.swLat).toBe(35.034);
    expect(BOX.neLon).toBe(-85.3);
    expect(BOX.centerLat).toBeCloseTo(35.047, 4);
    expect(BOX.centerLon).toBeCloseTo(-85.308, 4);
  });
  it('applies cos(lat) to longitude metres/degree', () => {
    expect(M_PER_DEG_LON).toBeCloseTo(91136, 0); // 111320 * cos(35.047°)
    expect(M_PER_DEG_LAT).toBe(110574);
  });
  it('puts the box center at the origin', () => {
    const [x, z] = lonLatToEnu(BOX.centerLon, BOX.centerLat);
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });
  it('projects north as -Z and east as +X', () => {
    const [, zN] = lonLatToEnu(BOX.centerLon, BOX.neLat); // north edge
    const [xE] = lonLatToEnu(BOX.neLon, BOX.centerLat); // east edge
    expect(zN).toBeLessThan(0); // north => -Z
    expect(xE).toBeGreaterThan(0); // east => +X
  });
  it('reports true ground size in metres (~1458 x 2875)', () => {
    const { widthM, depthM } = enuGroundSize();
    expect(widthM).toBeCloseTo(1458, -1);
    expect(depthM).toBeCloseTo(2875, -1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/enu.test.ts`
Expected: FAIL (`Cannot find module '../enu'`).

- [ ] **Step 3: Write `scripts/bake/box.ts` and `scripts/bake/enu.ts`**

`scripts/bake/box.ts`:

```ts
// The locked box (WGS-84). Redlines are cheap now, expensive after the first bake.
export const BOX = {
  swLat: 35.034,
  swLon: -85.316,
  neLat: 35.06,
  neLon: -85.3,
  get centerLat() {
    return (this.swLat + this.neLat) / 2;
  },
  get centerLon() {
    return (this.swLon + this.neLon) / 2;
  },
  // One-line tight-core fallback: set the effective south edge here to shrink the box.
  tightCoreSouthLat: 35.042,
} as const;
```

`scripts/bake/enu.ts`:

```ts
import { BOX } from './box';

const DEG = Math.PI / 180;
export const M_PER_DEG_LAT = 110574;
export const M_PER_DEG_LON = 111320 * Math.cos(BOX.centerLat * DEG);

/** lon/lat -> local ENU metres. Origin = box center. North = -Z, East = +X. */
export function lonLatToEnu(lon: number, lat: number): [number, number] {
  const x = (lon - BOX.centerLon) * M_PER_DEG_LON;
  const z = -(lat - BOX.centerLat) * M_PER_DEG_LAT;
  return [x, z];
}

/** True ground extent of the box in metres. */
export function enuGroundSize(): { widthM: number; depthM: number } {
  return {
    widthM: (BOX.neLon - BOX.swLon) * M_PER_DEG_LON,
    depthM: (BOX.neLat - BOX.swLat) * M_PER_DEG_LAT,
  };
}

export { BOX };
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/enu.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/bake/box.ts scripts/bake/enu.ts scripts/bake/__tests__/enu.test.ts
git commit -m "feat(bake): locked box + ENU projection"
```

### Task 3: Overpass client (User-Agent + retry)

**Files:**

- Create: `scripts/bake/overpass.ts`
- Test: `scripts/bake/__tests__/overpass.test.ts`

**Interfaces:**

- Produces: `overpassQuery(ql: string): Promise<OverpassResponse>` where `OverpassResponse = { elements: OverpassElement[] }`. Sends a POST with `User-Agent` and `data=<ql>`, retries up to 3× with backoff on non-2xx.

- [ ] **Step 1: Write the failing test** (mocks `fetch`; no live call in unit test)

`scripts/bake/__tests__/overpass.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { overpassQuery, USER_AGENT } from '../overpass';

beforeEach(() => vi.restoreAllMocks());

describe('overpassQuery', () => {
  it('POSTs with a User-Agent and the QL body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ elements: [{ type: 'way', id: 1 }] }), {
        status: 200,
      })
    );
    const r = await overpassQuery('[out:json];out count;');
    expect(r.elements[0].id).toBe(1);
    const [, init] = spy.mock.calls[0];
    expect((init!.headers as Record<string, string>)['User-Agent']).toBe(
      USER_AGENT
    );
    // body is URL-encoded (encodeURIComponent) — decode before asserting content
    expect(decodeURIComponent(String(init!.body))).toContain('out count');
  });
  it('retries then throws on repeated 406', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('no', { status: 406 })
    );
    await expect(
      overpassQuery('x', { retries: 2, backoffMs: 0 })
    ).rejects.toThrow(/406/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/overpass.test.ts`
Expected: FAIL (`Cannot find module '../overpass'`).

- [ ] **Step 3: Write `scripts/bake/overpass.ts`**

```ts
export const USER_AGENT = 'chattanooga-mini-bake/0.1 (jonpohlner@gmail.com)';
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: {
    type: string;
    role: string;
    geometry?: { lat: number; lon: number }[];
  }[];
}
export interface OverpassResponse {
  elements: OverpassElement[];
}

export async function overpassQuery(
  ql: string,
  opts: { retries?: number; backoffMs?: number } = {}
): Promise<OverpassResponse> {
  const retries = opts.retries ?? 3;
  const backoffMs = opts.backoffMs ?? 2000;
  let lastErr = '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'data=' + encodeURIComponent(ql),
    });
    if (res.ok) return (await res.json()) as OverpassResponse;
    lastErr = `${res.status}`;
    if (backoffMs)
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
  }
  throw new Error(
    `Overpass failed after ${retries + 1} attempts: HTTP ${lastErr}`
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/overpass.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/bake/overpass.ts scripts/bake/__tests__/overpass.test.ts
git commit -m "feat(bake): Overpass client with User-Agent + retry"
```

### Task 4: fetch-osm (buildings ways + relations + highways → `_raw/osm.json`)

**Files:**

- Create: `scripts/bake/fetch-osm.ts`
- Test: `scripts/bake/__tests__/fetch-osm.test.ts`

**Interfaces:**

- Consumes: `overpassQuery` (Task 3), `BOX` (Task 2).
- Produces: `buildOsmQL(): string` (the exact QL); `fetchOsm(outDir: string): Promise<{ buildings: number; highways: number; relations: number }>` — writes `<outDir>/osm.json`.

- [ ] **Step 1: Write the failing test** (asserts the QL shape; does not hit the network)

`scripts/bake/__tests__/fetch-osm.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildOsmQL } from '../fetch-osm';

describe('buildOsmQL', () => {
  it('queries buildings (ways + relations) and highways with geometry, in the box', () => {
    const ql = buildOsmQL();
    expect(ql).toContain('[out:json]');
    expect(ql).toContain('way["building"](35.034,-85.316,35.06,-85.3)');
    expect(ql).toContain('relation["building"](35.034,-85.316,35.06,-85.3)');
    expect(ql).toContain('way["highway"](35.034,-85.316,35.06,-85.3)');
    expect(ql).toContain('out geom;'); // geometry inline so we don't resolve node refs
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/fetch-osm.test.ts`
Expected: FAIL (`Cannot find module '../fetch-osm'`).

- [ ] **Step 3: Write `scripts/bake/fetch-osm.ts`**

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BOX } from './box';
import { overpassQuery } from './overpass';

/** bbox in Overpass order: south,west,north,east */
function bbox(): string {
  return `${BOX.swLat},${BOX.swLon},${BOX.neLat},${BOX.neLon}`;
}

export function buildOsmQL(): string {
  const b = bbox();
  return [
    '[out:json][timeout:120];',
    '(',
    `  way["building"](${b});`,
    `  relation["building"](${b});`,
    `  relation["type"="building"](${b});`,
    `  way["highway"](${b});`,
    ');',
    'out geom;',
  ].join('\n');
}

export async function fetchOsm(outDir: string) {
  mkdirSync(outDir, { recursive: true });
  const data = await overpassQuery(buildOsmQL());
  writeFileSync(join(outDir, 'osm.json'), JSON.stringify(data));
  const buildings = data.elements.filter(
    (e) => e.type === 'way' && e.tags?.building
  ).length;
  const relations = data.elements.filter((e) => e.type === 'relation').length;
  const highways = data.elements.filter(
    (e) => e.type === 'way' && e.tags?.highway
  ).length;
  return { buildings, highways, relations };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/fetch-osm.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Live-fetch verification (manual, once)**

Run:

```bash
docker compose run --rm chatt-bake pnpm tsx -e "import('./scripts/bake/fetch-osm.ts').then(m=>m.fetchOsm('public/chatt/_raw')).then(console.log)"
```

Expected: prints roughly `{ buildings: ~797, highways: ~1849, relations: ~3 }` and writes `public/chatt/_raw/osm.json` (~700 KB). If it 406s, confirm the User-Agent header is present.

- [ ] **Step 6: Commit** (commit the code AND the raw fixture so re-derives are reproducible)

```bash
git add scripts/bake/fetch-osm.ts scripts/bake/__tests__/fetch-osm.test.ts public/chatt/_raw/osm.json
git commit -m "feat(bake): fetch OSM buildings (ways+relations) + highways"
```

### Task 5: fetch-terrain (OpenTopoData ned10m, batched ≤100/req, throttled)

**Files:**

- Create: `scripts/bake/fetch-terrain.ts`
- Test: `scripts/bake/__tests__/fetch-terrain.test.ts`

**Interfaces:**

- Consumes: `BOX` (Task 2).
- Produces:
  - `buildGrid(cols: number, rows: number): { lat: number; lon: number }[]` — row-major, S→N rows, W→E cols, over the box.
  - `chunk<T>(arr: T[], size: number): T[][]`
  - `fetchTerrain(outDir: string, cols?: number, rows?: number): Promise<{ cols: number; rows: number; heights: number[] }>` — writes `<outDir>/terrain.json` = `{ cols, rows, heights }` (heights in metres, row-major).

- [ ] **Step 1: Write the failing test**

`scripts/bake/__tests__/fetch-terrain.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGrid, chunk } from '../fetch-terrain';
import { BOX } from '../box';

describe('terrain grid', () => {
  it('builds a row-major grid over the box, S->N, W->E', () => {
    const g = buildGrid(3, 3);
    expect(g).toHaveLength(9);
    expect(g[0].lat).toBeCloseTo(BOX.swLat, 5); // first row = south
    expect(g[0].lon).toBeCloseTo(BOX.swLon, 5); // first col = west
    expect(g[8].lat).toBeCloseTo(BOX.neLat, 5); // last = north-east
    expect(g[8].lon).toBeCloseTo(BOX.neLon, 5);
  });
  it('chunks into <=100 for OpenTopoData', () => {
    const c = chunk(
      Array.from({ length: 250 }, (_, i) => i),
      100
    );
    expect(c.map((x) => x.length)).toEqual([100, 100, 50]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/fetch-terrain.test.ts`
Expected: FAIL (`Cannot find module '../fetch-terrain'`).

- [ ] **Step 3: Write `scripts/bake/fetch-terrain.ts`**

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BOX } from './box';

const DATASET = 'ned10m';
const MAX_PER_REQ = 100;
const THROTTLE_MS = 1100; // OpenTopoData: 1 req/s public cap

export function buildGrid(
  cols: number,
  rows: number
): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  for (let j = 0; j < rows; j++) {
    const lat = BOX.swLat + (BOX.neLat - BOX.swLat) * (j / (rows - 1));
    for (let i = 0; i < cols; i++) {
      const lon = BOX.swLon + (BOX.neLon - BOX.swLon) * (i / (cols - 1));
      pts.push({ lat, lon });
    }
  }
  return pts;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchBatch(
  batch: { lat: number; lon: number }[]
): Promise<number[]> {
  const locs = batch
    .map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`)
    .join('|');
  const url = `https://api.opentopodata.org/v1/${DATASET}?locations=${locs}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const j = (await res.json()) as {
        results?: { elevation: number | null }[];
      };
      if (!j.results) throw new Error('elevation service unavailable');
      return j.results.map((r) => (r.elevation == null ? 0 : r.elevation));
    }
    if (res.status === 429)
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    else throw new Error(`OpenTopoData HTTP ${res.status}`);
  }
  throw new Error('OpenTopoData 429 backoff exhausted');
}

export async function fetchTerrain(outDir: string, cols = 40, rows = 40) {
  mkdirSync(outDir, { recursive: true });
  const grid = buildGrid(cols, rows);
  const heights: number[] = [];
  const batches = chunk(grid, MAX_PER_REQ);
  for (let b = 0; b < batches.length; b++) {
    heights.push(...(await fetchBatch(batches[b])));
    if (b < batches.length - 1)
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
  const out = { cols, rows, heights };
  writeFileSync(join(outDir, 'terrain.json'), JSON.stringify(out));
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/fetch-terrain.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Live-fetch verification (manual, once — ~16 requests, ~18s)**

Run:

```bash
docker compose run --rm chatt-bake pnpm tsx -e "import('./scripts/bake/fetch-terrain.ts').then(m=>m.fetchTerrain('public/chatt/_raw')).then(r=>console.log(r.cols,'x',r.rows,'=',r.heights.length,'pts'))"
```

Expected: `40 x 40 = 1600 pts`; writes `public/chatt/_raw/terrain.json`. Non-zero, spatially varying heights (Chattanooga ≈ 200–230 m near the river, higher on the bluff).

- [ ] **Step 6: Commit**

```bash
git add scripts/bake/fetch-terrain.ts scripts/bake/__tests__/fetch-terrain.test.ts public/chatt/_raw/terrain.json
git commit -m "feat(bake): fetch NED-10m terrain, batched + throttled"
```

### Task 6: fetch-drape (NAIP exportImage, meter-proportional — the 22% misregistration fix)

**Files:**

- Create: `scripts/bake/fetch-drape.ts`
- Test: `scripts/bake/__tests__/fetch-drape.test.ts`

**Interfaces:**

- Consumes: `BOX` (Task 2), `M_PER_DEG_LON`, `M_PER_DEG_LAT` (Task 2).
- Produces:
  - `drapePixelSize(mpp: number): { width: number; height: number; groundWm: number; groundHm: number }` — meter-proportional, NOT degree-proportional.
  - `drapeUrl(mpp: number, source?: 'naip' | 'esri'): string`
  - `fetchDrape(outDir: string, mpp?: number): Promise<{ width: number; height: number; bytes: number }>` — writes `<outDir>/drape.jpg`.

- [ ] **Step 1: Write the failing test** (the aspect-ratio assertion is the blocker guard)

`scripts/bake/__tests__/fetch-drape.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { drapePixelSize, drapeUrl } from '../fetch-drape';

describe('drape sizing (meter-proportional, cos-lat corrected)', () => {
  it('matches the TRUE ground aspect (~0.507), not the degree aspect (0.615)', () => {
    const { width, height } = drapePixelSize(2);
    const aspect = width / height;
    expect(aspect).toBeCloseTo(0.507, 2); // ground metres, NOT 0.615 degrees
  });
  it('sizes ~729 x 1437 at mpp=2', () => {
    const { width, height } = drapePixelSize(2);
    expect(width).toBeCloseTo(729, -1);
    expect(height).toBeCloseTo(1437, -1);
  });
  it('requests NAIP exportImage with the exact box bbox at SR 4326', () => {
    const url = drapeUrl(2, 'naip');
    expect(url).toContain('imagery.nationalmap.gov');
    expect(url).toContain('exportImage');
    expect(url).toContain('bbox=-85.316,35.034,-85.3,35.06'); // minx,miny,maxx,maxy
    expect(url).toContain('bboxSR=4326');
    expect(url).toContain('imageSR=4326');
    expect(url).toContain('size=729,1437');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/fetch-drape.test.ts`
Expected: FAIL (`Cannot find module '../fetch-drape'`).

- [ ] **Step 3: Write `scripts/bake/fetch-drape.ts`**

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BOX } from './box';
import { M_PER_DEG_LON, M_PER_DEG_LAT } from './enu';

const NAIP =
  'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage';
const ESRI =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';

/** Meter-proportional size so the plate-carrée image registers on the cos(lat) ENU ground. */
export function drapePixelSize(mpp: number) {
  const groundWm = (BOX.neLon - BOX.swLon) * M_PER_DEG_LON;
  const groundHm = (BOX.neLat - BOX.swLat) * M_PER_DEG_LAT;
  return {
    width: Math.round(groundWm / mpp),
    height: Math.round(groundHm / mpp),
    groundWm,
    groundHm,
  };
}

export function drapeUrl(
  mpp: number,
  source: 'naip' | 'esri' = 'naip'
): string {
  const { width, height } = drapePixelSize(mpp);
  const bbox = `${BOX.swLon},${BOX.swLat},${BOX.neLon},${BOX.neLat}`; // minx,miny,maxx,maxy
  const base = source === 'naip' ? NAIP : ESRI;
  return `${base}?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=jpeg&f=image`;
}

export async function fetchDrape(outDir: string, mpp = 2) {
  mkdirSync(outDir, { recursive: true });
  const { width, height } = drapePixelSize(mpp);
  const res = await fetch(drapeUrl(mpp, 'naip'));
  if (!res.ok) throw new Error(`NAIP HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(outDir, 'drape.jpg'), buf);
  return { width, height, bytes: buf.length };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/fetch-drape.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Live-fetch verification (manual, once)**

Run:

```bash
docker compose run --rm chatt-bake pnpm tsx -e "import('./scripts/bake/fetch-drape.ts').then(m=>m.fetchDrape('public/chatt/_raw')).then(console.log)"
```

Expected: `{ width: 729, height: 1437, bytes: ~200000 }`; writes a real aerial photo to `public/chatt/_raw/drape.jpg`. Open it — it should be recognizably downtown Chattanooga with the river along the top.

- [ ] **Step 6: Commit**

```bash
git add scripts/bake/fetch-drape.ts scripts/bake/__tests__/fetch-drape.test.ts public/chatt/_raw/drape.jpg
git commit -m "feat(bake): fetch NAIP drape, meter-proportional (registration fix)"
```

### Task 7: Height heuristic (4 rules; fallback is the COMMON case)

**Files:**

- Create: `scripts/bake/height.ts`
- Test: `scripts/bake/__tests__/height.test.ts`

**Interfaces:**

- Produces:
  - `HEIGHT_OVERRIDES: Record<string, number>` (name → metres).
  - `resolveHeight(tags: Record<string, string>, footprintAreaM2: number): { meters: number; rule: 'height' | 'levels' | 'override' | 'fallback' }`
  - Constant `REPUBLIC_CENTRE_M = 91.44` (300 ft cap).
- Note: ~74% of buildings have neither `height` nor `building:levels`, so `fallback` fires for most — it must be a real model, not a constant.

- [ ] **Step 1: Write the failing test**

`scripts/bake/__tests__/height.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveHeight, HEIGHT_OVERRIDES, REPUBLIC_CENTRE_M } from '../height';

describe('resolveHeight', () => {
  it('rule 1: uses an explicit height tag (metres)', () => {
    expect(resolveHeight({ building: 'yes', height: '52' }, 400)).toEqual({
      meters: 52,
      rule: 'height',
    });
  });
  it('rule 1: parses height with a unit suffix', () => {
    expect(resolveHeight({ height: '40 m' }, 400).meters).toBeCloseTo(40, 5);
  });
  it('rule 2: building:levels * 3.2', () => {
    expect(resolveHeight({ 'building:levels': '5' }, 400)).toEqual({
      meters: 16,
      rule: 'levels',
    });
  });
  it('rule 3: named override wins over a missing tag', () => {
    const r = resolveHeight({ name: 'Republic Centre' }, 2000);
    expect(r.rule).toBe('override');
    expect(r.meters).toBeCloseTo(HEIGHT_OVERRIDES['Republic Centre'], 5);
  });
  it('rule 4: fallback buckets by building tag and clamps below Republic Centre', () => {
    const house = resolveHeight({ building: 'house' }, 120);
    expect(house.rule).toBe('fallback');
    expect(house.meters).toBeLessThan(10);
    const commercial = resolveHeight({ building: 'commercial' }, 1200);
    expect(commercial.rule).toBe('fallback');
    expect(commercial.meters).toBeGreaterThan(house.meters);
    expect(commercial.meters).toBeLessThanOrEqual(REPUBLIC_CENTRE_M);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/height.test.ts`
Expected: FAIL (`Cannot find module '../height'`).

- [ ] **Step 3: Write `scripts/bake/height.ts`**

```ts
const FT = 0.3048;
export const REPUBLIC_CENTRE_M = 300 * FT; // 91.44

export const HEIGHT_OVERRIDES: Record<string, number> = {
  'Republic Centre': 300 * FT,
  'First Horizon Bank Building': 204 * FT,
  'James Building': 187 * FT,
  'Volunteer Life': 165 * FT,
  'The Maclellan': 158 * FT,
  'Medical Arts': 146 * FT,
  'Chattanooga Bank': 132 * FT,
  'Patten Towers': 130 * FT,
  'Sheraton Read House': 130 * FT,
};

// Fallback level priors by building tag value (the COMMON path — ~74% of buildings).
// NOTE (fix from T7 review): priors give real range so the clamp is reachable and
// downtown mid-rise isn't flattened to ~6 stories. OSM tags the true towers with
// building:levels (rule 2 catches them); this fallback is for untagged mid-rise.
const LEVEL_PRIORS: Record<string, number> = {
  house: 1,
  detached: 1,
  garage: 1,
  shed: 1,
  hut: 1,
  residential: 2,
  apartments: 4,
  retail: 2,
  commercial: 5,
  office: 8,
  industrial: 2,
  warehouse: 2,
  hotel: 6,
  civic: 3,
  yes: 3,
};
const LEVEL_M = 3.2;

// Tiered area→extra-levels: big downtown footprints tend taller. Gives the
// fallback real dynamic range (and makes the Republic Centre clamp reachable).
function areaBonusLevels(areaM2: number): number {
  if (areaM2 >= 3000) return 6;
  if (areaM2 >= 1500) return 4;
  if (areaM2 >= 800) return 2;
  if (areaM2 >= 300) return 1;
  return 0;
}

export function resolveHeight(
  tags: Record<string, string>,
  footprintAreaM2: number
): { meters: number; rule: 'height' | 'levels' | 'override' | 'fallback' } {
  // Rule 1: explicit height tag (may carry a unit suffix). Guard against
  // nonpositive/NaN (vandalized tags) — fall through if bad.
  if (tags.height) {
    const m = parseFloat(tags.height);
    if (!Number.isNaN(m) && m > 0) return { meters: m, rule: 'height' };
  }
  // Rule 2: building:levels (same nonpositive/NaN guard).
  if (tags['building:levels']) {
    const lv = parseFloat(tags['building:levels']);
    if (!Number.isNaN(lv) && lv > 0)
      return { meters: lv * LEVEL_M, rule: 'levels' };
  }
  // Rule 3: named override
  if (tags.name && HEIGHT_OVERRIDES[tags.name] != null) {
    return { meters: HEIGHT_OVERRIDES[tags.name], rule: 'override' };
  }
  // Rule 4: fallback — bucket by building tag, add tiered area bonus, clamp
  // below the Republic Centre ceiling (now reachable).
  const kind = tags.building || 'yes';
  const priorLevels = LEVEL_PRIORS[kind] ?? 3;
  const totalLevels = priorLevels + areaBonusLevels(footprintAreaM2);
  const meters = Math.min(REPUBLIC_CENTRE_M, totalLevels * LEVEL_M);
  return { meters, rule: 'fallback' };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/height.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/bake/height.ts scripts/bake/__tests__/height.test.ts
git commit -m "feat(bake): height heuristic with tag-bucketed fallback"
```

### Task 8: build-scene (project → ENU, quantize, emit `public/chatt/*` + manifest)

**Files:**

- Create: `scripts/bake/build-scene.ts`
- Test: `scripts/bake/__tests__/build-scene.test.ts`

**Interfaces:**

- Consumes: `lonLatToEnu`, `enuGroundSize`, `M_PER_DEG_LON` (Task 2); `resolveHeight` (Task 7).
- Produces:
  - `ringAreaM2(ring: [number, number][]): number` (ENU-metre shoelace area, absolute).
  - `polygonCentroid(ring: [number, number][]): [number, number]`
  - `buildScene(rawDir: string, outDir: string, mpp?: number): Promise<Manifest>` — reads `<rawDir>/{osm,terrain}.json` + `drape.jpg`, writes `buildings.json`, `streets.json`, `terrain.json`, `heroes.json`, `drape.jpg` (copied), `manifest.json`.
- Data shapes (also consumed by runtime, Part B):
  - `Building = { id: number; ring: number[]; height: number; rule: string; swap?: string }` (ring = flat ENU `[x0,z0,x1,z1,...]`, rounded to 0.1 m).
  - `Street = { pts: number[] }` (flat ENU x,z).
  - `Manifest = { box: {...}; groundWm: number; groundHm: number; cosLat: number; drape: { path: string; width: number; height: number; mpp: number }; provenance: string; fetchedAt: string; ruleHistogram: Record<string, number> }`.

- [ ] **Step 1: Write the failing test** (pure geometry helpers; no file IO)

`scripts/bake/__tests__/build-scene.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ringAreaM2, polygonCentroid } from '../build-scene';

describe('build-scene geometry', () => {
  it('computes ring area via the shoelace formula', () => {
    const square: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(ringAreaM2(square)).toBeCloseTo(100, 5);
  });
  it('computes the centroid of a square', () => {
    const square: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const [cx, cz] = polygonCentroid(square);
    expect(cx).toBeCloseTo(5, 5);
    expect(cz).toBeCloseTo(5, 5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/build-scene.test.ts`
Expected: FAIL (`Cannot find module '../build-scene'`).

- [ ] **Step 3: Write `scripts/bake/build-scene.ts`**

```ts
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { lonLatToEnu, enuGroundSize, M_PER_DEG_LON } from './enu';
import { BOX } from './box';
import { resolveHeight } from './height';

export function ringAreaM2(ring: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

export function polygonCentroid(ring: [number, number][]): [number, number] {
  let x = 0,
    z = 0;
  for (const [px, pz] of ring) {
    x += px;
    z += pz;
  }
  return [x / ring.length, z / ring.length];
}

// Hero-swap landmark names → slot key. Matched case-insensitively against OSM name.
const HERO_MATCH: [RegExp, string][] = [
  [/aquarium/i, 'aquarium'],
  [/walnut.*bridge/i, 'walnut_st_bridge'],
  [/tivoli/i, 'tivoli'],
  [/dome/i, 'dome_building'],
  [/courthouse/i, 'courthouse'],
  [/hunter museum/i, 'hunter_museum'],
  [/(choo|terminal station)/i, 'choo_choo'],
  [/republic centre/i, 'republic_centre'],
];
function heroSlot(name?: string): string | undefined {
  if (!name) return undefined;
  for (const [re, key] of HERO_MATCH) if (re.test(name)) return key;
  return undefined;
}

const q = (n: number) => Math.round(n * 10) / 10; // 0.1 m quantization

export async function buildScene(rawDir: string, outDir: string, mpp = 2) {
  mkdirSync(outDir, { recursive: true });
  const osm = JSON.parse(readFileSync(join(rawDir, 'osm.json'), 'utf8')) as {
    elements: {
      type: string;
      id: number;
      tags?: Record<string, string>;
      geometry?: { lat: number; lon: number }[];
    }[];
  };

  const buildings: {
    id: number;
    ring: number[];
    height: number;
    rule: string;
    swap?: string;
  }[] = [];
  const heroes: { swap: string; x: number; z: number; name: string }[] = [];
  const streets: { pts: number[] }[] = [];
  const ruleHistogram: Record<string, number> = {
    height: 0,
    levels: 0,
    override: 0,
    fallback: 0,
  };

  for (const el of osm.elements) {
    const tags = el.tags || {};
    if (
      el.type === 'way' &&
      tags.building &&
      el.geometry &&
      el.geometry.length >= 3
    ) {
      const ringEnu = el.geometry.map((g) => lonLatToEnu(g.lon, g.lat)) as [
        number,
        number,
      ][];
      const area = ringAreaM2(ringEnu);
      const { meters, rule } = resolveHeight(tags, area);
      ruleHistogram[rule]++;
      const swap = heroSlot(tags.name);
      const flat: number[] = [];
      for (const [x, z] of ringEnu) flat.push(q(x), q(z));
      buildings.push({ id: el.id, ring: flat, height: q(meters), rule, swap });
      if (swap) {
        const [cx, cz] = polygonCentroid(ringEnu);
        heroes.push({ swap, x: q(cx), z: q(cz), name: tags.name! });
      }
    } else if (
      el.type === 'way' &&
      tags.highway &&
      el.geometry &&
      el.geometry.length >= 2
    ) {
      const flat: number[] = [];
      for (const g of el.geometry) {
        const [x, z] = lonLatToEnu(g.lon, g.lat);
        flat.push(q(x), q(z));
      }
      streets.push({ pts: flat });
    }
  }

  const { widthM, depthM } = enuGroundSize();
  const drapePath = join(outDir, 'drape.jpg');
  if (existsSync(join(rawDir, 'drape.jpg')))
    copyFileSync(join(rawDir, 'drape.jpg'), drapePath);

  const manifest = {
    box: {
      swLat: BOX.swLat,
      swLon: BOX.swLon,
      neLat: BOX.neLat,
      neLon: BOX.neLon,
    },
    groundWm: q(widthM),
    groundHm: q(depthM),
    cosLat: M_PER_DEG_LON / 111320,
    drape: {
      path: 'chatt/drape.jpg',
      width: Math.round(widthM / mpp),
      height: Math.round(depthM / mpp),
      mpp,
    },
    provenance: '© OpenStreetMap · USGS 3DEP · USGS NAIP',
    fetchedAt: new Date().toISOString(),
    ruleHistogram,
  };

  writeFileSync(join(outDir, 'buildings.json'), JSON.stringify(buildings));
  writeFileSync(join(outDir, 'streets.json'), JSON.stringify(streets));
  writeFileSync(join(outDir, 'heroes.json'), JSON.stringify(heroes));
  copyFileSync(join(rawDir, 'terrain.json'), join(outDir, 'terrain.json'));
  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  return manifest;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/build-scene.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the derive step against the committed `_raw/` and inspect the histogram**

Run:

```bash
docker compose run --rm chatt-bake pnpm tsx -e "import('./scripts/bake/build-scene.ts').then(m=>m.buildScene('public/chatt/_raw','public/chatt')).then(x=>console.log(JSON.stringify(x.ruleHistogram),'hero slots + provenance emitted'))"
```

Expected: a histogram like `{"height":97,"levels":120,"override":9,"fallback":~571}` (fallback dominant — confirms the ~74% finding), and `public/chatt/{buildings,streets,heroes,terrain,manifest}.json` written. Confirm `manifest.json` shows the provenance string and `drape` size ~729×1437.

- [ ] **Step 6: Commit** (commit the derived artifacts — they are the runtime's source of truth)

```bash
git add scripts/bake/build-scene.ts scripts/bake/__tests__/build-scene.test.ts public/chatt/*.json
git commit -m "feat(bake): build-scene projects to ENU, emits committed artifacts"
```

### Task 9: bake orchestrator (`run.ts`, atomic-mv, provenance/hash stamp)

**Files:**

- Create: `scripts/bake/run.ts`
- Test: `scripts/bake/__tests__/run.test.ts`

**Interfaces:**

- Consumes: `fetchOsm`, `fetchTerrain`, `fetchDrape`, `buildScene`.
- Produces: `bakeOrder: string[]` (the ordered step names, for the test to assert). `run()` executes fetches into `public/chatt/_raw/` then `buildScene` into a temp dir, then atomically renames into `public/chatt/`.

- [ ] **Step 1: Write the failing test**

`scripts/bake/__tests__/run.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bakeOrder } from '../run';

describe('bake orchestration', () => {
  it('runs fetches before build-scene', () => {
    expect(bakeOrder).toEqual([
      'fetch-osm',
      'fetch-terrain',
      'fetch-drape',
      'build-scene',
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/run.test.ts`
Expected: FAIL (`Cannot find module '../run'`).

- [ ] **Step 3: Write `scripts/bake/run.ts`**

```ts
import { mkdirSync, renameSync, rmSync, existsSync, cpSync } from 'node:fs';
import { fetchOsm } from './fetch-osm';
import { fetchTerrain } from './fetch-terrain';
import { fetchDrape } from './fetch-drape';
import { buildScene } from './build-scene';

export const bakeOrder = [
  'fetch-osm',
  'fetch-terrain',
  'fetch-drape',
  'build-scene',
] as const;

const RAW = 'public/chatt/_raw';
const OUT = 'public/chatt';
const TMP = 'public/chatt/_tmp';

export async function run() {
  mkdirSync(RAW, { recursive: true });
  console.log('[bake] fetch-osm...');
  console.log(await fetchOsm(RAW));
  console.log('[bake] fetch-terrain...');
  await fetchTerrain(RAW);
  console.log('[bake] fetch-drape...');
  console.log(await fetchDrape(RAW));
  console.log('[bake] build-scene -> temp...');
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  const manifest = await buildScene(RAW, TMP);
  // Atomic swap: move each derived file into OUT so the dev watcher never sees partials.
  for (const f of [
    'buildings.json',
    'streets.json',
    'heroes.json',
    'terrain.json',
    'manifest.json',
    'drape.jpg',
  ]) {
    if (existsSync(`${TMP}/${f}`)) {
      cpSync(`${TMP}/${f}`, `${OUT}/${f}`);
    }
  }
  rmSync(TMP, { recursive: true, force: true });
  console.log('[bake] done. rules:', JSON.stringify(manifest.ruleHistogram));
}

if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test scripts/bake/__tests__/run.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Full end-to-end bake (the real thing)**

Run: `docker compose run --rm chatt-bake pnpm bake`
Expected: fetches all three sources, builds the scene, prints the rule histogram, and refreshes `public/chatt/*`. Total < 1 min.

- [ ] **Step 6: Commit**

```bash
git add scripts/bake/run.ts scripts/bake/__tests__/run.test.ts public/chatt/*.json public/chatt/drape.jpg
git commit -m "feat(bake): orchestrator with atomic swap into public/chatt"
```

---

## Part B — Runtime (Next.js + R3F). Consumes `public/chatt/*`. Zero third-party calls.

### Task 10: Runtime libs (`enu` re-export, `manifest` loader)

> **FORK REVISION:** Do NOT create `src/lib/assetUrl.ts`. The fork already ships a real,
> tested `getAssetUrl(path)` in `src/config/project.config.ts` — import it from
> `@/config/project.config`. Drop the `assetUrl.test.ts` step; instead add ONE test
> confirming the manifest loader routes through the existing `getAssetUrl` (spy on it, or
> assert the fetched URL carries the basePath when `NEXT_PUBLIC_BASE_PATH` is set). The
> `manifest.ts` loader below changes its import to `@/config/project.config`.

**Files:**

- Create: `src/lib/enu.ts`, `src/lib/manifest.ts`
- Test: `src/lib/__tests__/manifest.test.ts`
- Reuse (do not create): `getAssetUrl` from `@/config/project.config` (fork-provided).

**Interfaces:**

- Produces:
  - `src/lib/enu.ts` re-exports `lonLatToEnu`, `enuGroundSize`, `BOX`, `M_PER_DEG_LON`, `M_PER_DEG_LAT` from `../../scripts/bake/enu` (single source of truth).
  - `manifest.ts` imports `getAssetUrl` from `@/config/project.config` (NOT a new local helper).
  - `loadManifest(): Promise<Manifest>`, `loadJson<T>(name: string): Promise<T>` — both go through `getAssetUrl`.
  - Re-export the `Manifest`, `Building`, `Street` types.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/assetUrl.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { getAssetUrl } from '../assetUrl';

const orig = process.env.NEXT_PUBLIC_BASE_PATH;
afterEach(() => {
  process.env.NEXT_PUBLIC_BASE_PATH = orig;
});

describe('getAssetUrl', () => {
  it('returns a root-relative path when basePath is empty', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '';
    expect(getAssetUrl('/chatt/buildings.json')).toBe('/chatt/buildings.json');
    expect(getAssetUrl('chatt/x.json')).toBe('/chatt/x.json');
  });
  it('prefixes the basePath in production (GH Pages project site)', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/chattanooga-mini';
    expect(getAssetUrl('/chatt/buildings.json')).toBe(
      '/chattanooga-mini/chatt/buildings.json'
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/lib/__tests__/assetUrl.test.ts`
Expected: FAIL (`Cannot find module '../assetUrl'`).

- [ ] **Step 3: Write the three lib files**

`src/lib/assetUrl.ts`:

```ts
export function getAssetUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${clean}`;
}
```

`src/lib/enu.ts`:

```ts
// Single source of truth: bake and runtime share the same projection.
export {
  lonLatToEnu,
  enuGroundSize,
  BOX,
  M_PER_DEG_LON,
  M_PER_DEG_LAT,
} from '../../scripts/bake/enu';
```

`src/lib/manifest.ts`:

```ts
import { getAssetUrl } from './assetUrl';

export interface Manifest {
  box: { swLat: number; swLon: number; neLat: number; neLon: number };
  groundWm: number;
  groundHm: number;
  cosLat: number;
  drape: { path: string; width: number; height: number; mpp: number };
  provenance: string;
  fetchedAt: string;
  ruleHistogram: Record<string, number>;
}
export interface Building {
  id: number;
  ring: number[];
  height: number;
  rule: string;
  swap?: string;
}
export interface Street {
  pts: number[];
}
export interface TerrainGrid {
  cols: number;
  rows: number;
  heights: number[];
}
export interface Hero {
  swap: string;
  x: number;
  z: number;
  name: string;
}

export async function loadJson<T>(name: string): Promise<T> {
  const res = await fetch(getAssetUrl(`/chatt/${name}`));
  if (!res.ok) throw new Error(`asset ${name} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}
export const loadManifest = () => loadJson<Manifest>('manifest.json');
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/lib/__tests__/assetUrl.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/
git commit -m "feat(runtime): assetUrl (basePath), enu re-export, manifest loader"
```

### Task 11: Ported shaders (`src/post/shaders.ts`) with ACES folded into Grade

**Files:**

- Create: `src/post/shaders.ts`
- Test: `src/post/__tests__/shaders.test.ts`

**Interfaces:**

- Produces: `TILT_SHIFT_FRAG: string`, `TILT_SHIFT_VERT: string`, `GRADE_FRAG: string`, and factory fns `makeTiltShiftUniforms()`, `makeGradeUniforms()` returning the uniform objects (input uniform named `inputBuffer` for the `postprocessing` lib's ShaderPass convention).
- Note: GLSL ported verbatim from `cm/cm-shaders.js` EXCEPT (a) `tDiffuse` → `inputBuffer`, (b) an ACES approximation is inserted into the Grade fragment immediately before `lin2srgb` (since the renderer no longer tonemaps).

- [ ] **Step 1: Write the failing test** (guards the two invariants that prevent the double-encode)

`src/post/__tests__/shaders.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  TILT_SHIFT_FRAG,
  GRADE_FRAG,
  makeTiltShiftUniforms,
  makeGradeUniforms,
} from '../shaders';

describe('ported shaders', () => {
  it('uses inputBuffer (postprocessing convention), not tDiffuse', () => {
    expect(TILT_SHIFT_FRAG).toContain('inputBuffer');
    expect(TILT_SHIFT_FRAG).not.toContain('tDiffuse');
    expect(GRADE_FRAG).not.toContain('tDiffuse');
  });
  it('Grade folds ACES in before the single sRGB encode', () => {
    const acesIdx = GRADE_FRAG.indexOf('aces');
    const srgbIdx = GRADE_FRAG.indexOf('lin2srgb');
    expect(acesIdx).toBeGreaterThanOrEqual(0);
    expect(srgbIdx).toBeGreaterThan(acesIdx); // sRGB is the LAST step
  });
  it('exposes the tilt-shift focus/band/maxBlur uniforms', () => {
    const u = makeTiltShiftUniforms();
    expect(u.focus.value).toBeCloseTo(0.52, 2);
    expect(u.maxBlur.value).toBeCloseTo(3.2, 2);
    expect(makeGradeUniforms().saturation.value).toBeCloseTo(1.34, 2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/post/__tests__/shaders.test.ts`
Expected: FAIL (`Cannot find module '../shaders'`).

- [ ] **Step 3: Write `src/post/shaders.ts`** (port cm-shaders.js verbatim; rename input; fold ACES into Grade)

```ts
import { Vector2 } from 'three';

export const TILT_SHIFT_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// Directional 9-tap gaussian keyed to a horizontal focus band (Scheimpflug tilt).
// Ported verbatim from cm-shaders.js TiltShiftBlur; tDiffuse -> inputBuffer.
export const TILT_SHIFT_FRAG = `
varying vec2 vUv;
uniform sampler2D inputBuffer;
uniform vec2 texel;
uniform vec2 direction;
uniform float focus, band, gradient, tilt, maxBlur;
void main(){
  float focusY = focus + tilt * (vUv.x - 0.5);
  float d = abs(vUv.y - focusY);
  float amt = smoothstep(band, band + gradient, d);
  amt = amt * amt;
  float r = amt * maxBlur;
  vec2 dir = direction * texel * r;
  vec4 c = texture2D(inputBuffer, vUv) * 0.1964825501511404;
  c += texture2D(inputBuffer, vUv + dir * 1.0) * 0.2969069646728344 * 0.5;
  c += texture2D(inputBuffer, vUv - dir * 1.0) * 0.2969069646728344 * 0.5;
  c += texture2D(inputBuffer, vUv + dir * 2.0) * 0.09447039785044732;
  c += texture2D(inputBuffer, vUv - dir * 2.0) * 0.09447039785044732;
  c += texture2D(inputBuffer, vUv + dir * 3.0) * 0.010381362401148057;
  c += texture2D(inputBuffer, vUv - dir * 3.0) * 0.010381362401148057;
  c += texture2D(inputBuffer, vUv + dir * 4.0) * 0.002214997443481223;
  c += texture2D(inputBuffer, vUv - dir * 4.0) * 0.002214997443481223;
  gl_FragColor = c;
}`;

// Grade: ported from cm-shaders.js Grade, with ACES folded in before lin2srgb
// (the renderer no longer tonemaps — Grade is the sole color owner).
export const GRADE_FRAG = `
varying vec2 vUv;
uniform sampler2D inputBuffer;
uniform float saturation, contrast, exposure, vignette, warmth, lift, grain, time;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
vec3 aces(vec3 x){ // Narkowicz ACES filmic approximation
  const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
vec3 lin2srgb(vec3 c){ return mix(1.055*pow(max(c,0.0),vec3(1.0/2.4))-0.055, c*12.92, step(c,vec3(0.0031308))); }
void main(){
  vec3 c = texture2D(inputBuffer, vUv).rgb;
  c *= exposure;
  c = max(c + lift * (1.0 - c), 0.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c = (c - 0.5) * contrast + 0.5;
  c += vec3(warmth, warmth * 0.1, -warmth) * 0.6;
  float dv = distance(vUv, vec2(0.5)) * 1.414;
  c *= 1.0 - vignette * smoothstep(0.55, 1.05, dv);
  c = aces(c);            // ACES tonemap (moved off the renderer)
  c = lin2srgb(c);        // <- the ONLY sRGB encode in the whole chain
  c += (hash(vUv * vec2(1920.0,1080.0) + time) - 0.5) * grain;
  gl_FragColor = vec4(c, 1.0);
}`;

export function makeTiltShiftUniforms() {
  return {
    inputBuffer: { value: null },
    texel: { value: new Vector2(1 / 1024, 1 / 1024) },
    direction: { value: new Vector2(1, 0) },
    focus: { value: 0.52 },
    band: { value: 0.1 },
    gradient: { value: 0.34 },
    tilt: { value: 0.06 },
    maxBlur: { value: 3.2 },
  };
}
export function makeGradeUniforms() {
  return {
    inputBuffer: { value: null },
    saturation: { value: 1.34 },
    contrast: { value: 1.07 },
    exposure: { value: 1.03 },
    vignette: { value: 0.34 },
    warmth: { value: 0.05 },
    lift: { value: 0.0 },
    grain: { value: 0.025 },
    time: { value: 0 },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/post/__tests__/shaders.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/post/shaders.ts src/post/__tests__/shaders.test.ts
git commit -m "feat(post): port tilt-shift + grade shaders, ACES folded into Grade"
```

### Task 12: Tilt-shift composer builder (raw `postprocessing`, single color owner)

**Files:**

- Create: `src/post/tiltShift.ts`
- Test: `src/post/__tests__/tiltShift.test.ts`

**Interfaces:**

- Consumes: `TILT_SHIFT_VERT/FRAG`, `GRADE_FRAG`, `makeTiltShiftUniforms`, `makeGradeUniforms` (Task 11).
- Produces: `buildComposer(gl, scene, camera, size): { composer, setLens(focus, blur), setGrade(partial), setTime(t), setSize(w,h), dispose() }`. Uses `EffectComposer`, `RenderPass`, `ShaderPass` from the raw `postprocessing` package. Chain: Render → blurH → blurV → Grade (terminal). Bloom is added in Task 14's StageCore integration to keep this unit focused on the tilt-shift/grade core.
- Note: this module is client-only (imports `postprocessing`); it must never be imported outside the `ssr:false` boundary.

- [ ] **Step 1: Write the failing test** (unit-level: shape + wiring, using a jsdom-free stub of the passes is impractical, so assert the builder's pure helpers)

`src/post/__tests__/tiltShift.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { texelFor, lensClamp } from '../tiltShift';

describe('tiltShift helpers', () => {
  it('computes texel size from pixel dims', () => {
    const t = texelFor(1000, 500);
    expect(t.x).toBeCloseTo(0.001, 6);
    expect(t.y).toBeCloseTo(0.002, 6);
  });
  it('clamps lens focus to [0.2,0.8] and blur to [0,6]', () => {
    expect(lensClamp(1.2, 99)).toEqual({ focus: 0.8, blur: 6 });
    expect(lensClamp(-1, -1)).toEqual({ focus: 0.2, blur: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/post/__tests__/tiltShift.test.ts`
Expected: FAIL (`Cannot find module '../tiltShift'`).

- [ ] **Step 3: Write `src/post/tiltShift.ts`**

```ts
import { EffectComposer, RenderPass, ShaderPass } from 'postprocessing';
import { ShaderMaterial, WebGLRenderer, Scene, Camera } from 'three';
import {
  TILT_SHIFT_VERT,
  TILT_SHIFT_FRAG,
  GRADE_FRAG,
  makeTiltShiftUniforms,
  makeGradeUniforms,
} from './shaders';

export function texelFor(w: number, h: number) {
  return { x: 1 / w, y: 1 / h };
}
export function lensClamp(focus: number, blur: number) {
  return {
    focus: Math.min(0.8, Math.max(0.2, focus)),
    blur: Math.min(6, Math.max(0, blur)),
  };
}

function shaderPass(
  frag: string,
  uniforms: Record<string, { value: unknown }>
) {
  const material = new ShaderMaterial({
    vertexShader: TILT_SHIFT_VERT,
    fragmentShader: frag,
    uniforms,
  });
  // postprocessing's ShaderPass writes the previous buffer into uniforms.inputBuffer.
  const pass = new ShaderPass(material, 'inputBuffer');
  return { pass, uniforms };
}

export function buildComposer(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  size: { width: number; height: number }
) {
  const composer = new EffectComposer(gl);
  composer.addPass(new RenderPass(scene, camera));

  const blurH = shaderPass(TILT_SHIFT_FRAG, makeTiltShiftUniforms());
  const blurV = shaderPass(TILT_SHIFT_FRAG, makeTiltShiftUniforms());
  (
    blurH.uniforms.direction.value as { set: (x: number, y: number) => void }
  ).set(1, 0);
  (
    blurV.uniforms.direction.value as { set: (x: number, y: number) => void }
  ).set(0, 1);
  const grade = shaderPass(GRADE_FRAG, makeGradeUniforms());

  composer.addPass(blurH.pass);
  composer.addPass(blurV.pass);
  composer.addPass(grade.pass); // terminal — sole sRGB encode

  function setSize(w: number, h: number) {
    composer.setSize(w, h);
    const t = texelFor(w, h);
    for (const b of [blurH, blurV])
      (b.uniforms.texel.value as { set: (x: number, y: number) => void }).set(
        t.x,
        t.y
      );
  }
  setSize(size.width, size.height);

  return {
    composer,
    setLens(focus: number, blur: number) {
      const c = lensClamp(focus, blur);
      for (const b of [blurH, blurV]) {
        (b.uniforms.focus as { value: number }).value = c.focus;
        (b.uniforms.maxBlur as { value: number }).value = c.blur;
      }
    },
    setGrade(partial: Record<string, number>) {
      for (const [k, v] of Object.entries(partial)) {
        const u = grade.uniforms[k] as { value: number } | undefined;
        if (u) u.value = v;
      }
    },
    setTime(t: number) {
      (grade.uniforms.time as { value: number }).value = t;
    },
    setSize,
    dispose() {
      composer.dispose();
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/post/__tests__/tiltShift.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/post/tiltShift.ts src/post/__tests__/tiltShift.test.ts
git commit -m "feat(post): raw-postprocessing composer (Render->blurH->blurV->Grade)"
```

### Task 13: Rig — headless 4-mode camera controller (port cm-rig.js)

**Files:**

- Create: `src/stage/Rig.ts`
- Test: `src/stage/__tests__/Rig.test.ts`

**Interfaces:**

- Consumes: `three` (`PerspectiveCamera`, `Vector3`, etc.).
- Produces: `class Rig` with constructor `(camera, dom, opts?)`, methods `setMode(m)`, `update(dt)`, `setWaypoints(wps)`, `next()`, `prev()`, `goTo(i)`, `board(obj)`, `unboard()`, `bind()`, `dispose()`, plus fields `mode`, `avatar`, `focus`, `groundHeight`, `collide`, `onCaption`, `onModeInternal`. Modes: `'tour' | 'orbit' | 'follow' | 'walk'`. Ported from `cm/cm-rig.js` with three changes: (1) ESM import of `three` (no `window.THREE`); (2) listeners bound via an explicit `bind()` (called from a React effect), not in the constructor, so StrictMode double-mount is idempotent; (3) no internal RAF — `update(dt)` is driven by the host's `useFrame`.

- [ ] **Step 1: Write the failing test** (pure logic: mode transitions + tour interruption — no DOM)

`src/stage/__tests__/Rig.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Rig } from '../Rig';

function makeRig() {
  const cam = new PerspectiveCamera(34, 1.6, 1, 2400);
  // dom stub: only addEventListener/removeEventListener/requestPointerLock are touched, and only in bind()
  const dom = {
    addEventListener() {},
    removeEventListener() {},
    requestPointerLock() {},
  } as unknown as HTMLElement;
  return new Rig(cam, dom);
}

describe('Rig', () => {
  let rig: ReturnType<typeof makeRig>;
  beforeEach(() => {
    rig = makeRig();
  });

  it('starts in tour mode', () => {
    expect(rig.mode).toBe('tour');
  });

  it('switches modes and fires onModeInternal', () => {
    let seen = '';
    rig.onModeInternal = (m) => {
      seen = m;
    };
    rig.setMode('walk');
    expect(rig.mode).toBe('walk');
    expect(seen).toBe('walk');
  });

  it('tour is interruptible: a WASD press breaks tour into orbit', () => {
    rig.setWaypoints([
      { pos: [0, 10, 0], look: [0, 0, 0], dwell: 4, name: 'A', blurb: '' },
    ]);
    expect(rig.mode).toBe('tour');
    // simulate the keydown handler path the bound listener would call
    rig.handleKey('KeyW', true);
    expect(rig.mode).toBe('orbit');
  });

  it('board stores a follow target and unboard clears it', () => {
    const trolley = { position: { x: 1, y: 0, z: 2 }, heading: 0 };
    rig.board(trolley);
    expect(rig.followObj).toBe(trolley);
    rig.unboard();
    expect(rig.followObj).toBeNull();
  });

  it('update(dt) advances without throwing in each mode', () => {
    for (const m of ['orbit', 'follow', 'walk'] as const) {
      rig.setMode(m);
      expect(() => rig.update(0.016)).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/stage/__tests__/Rig.test.ts`
Expected: FAIL (`Cannot find module '../Rig'`).

- [ ] **Step 3: Write `src/stage/Rig.ts`**

Port `cm/cm-rig.js` to a TypeScript ESM class. Apply exactly these transforms to the source (keep all camera math identical):

- Replace `window.THREE` with named imports: `import { Vector3, Quaternion, Euler, Matrix4 } from 'three';`.
- Move the body of `_bind()` into a public `bind()` method; do NOT call it from the constructor. Add an idempotent guard: `if (this._bound) return; this._bound = true;` at the top of `bind()`, and reset `this._bound = false` in `dispose()`.
- Extract the keydown decision (`cm-rig.js` `_key`, the `mode==='tour' && WASD -> setMode('orbit')` branch and the `this.keys[e.code]=down`) into a public `handleKey(code: string, down: boolean): void` that the bound listener calls; the bound `keydown`/`keyup` handlers just forward `e.code`/`down` to `handleKey`. This makes the interruption logic unit-testable without a DOM event.
- Delete nothing from the four `_tour/_orbit/_follow/_walk` methods — they port verbatim.
- Type the public surface: `mode: 'tour'|'orbit'|'follow'|'walk'`; `avatar: { pos: Vector3; heading: number; vel: Vector3; moving: boolean; speed: number }`; `groundHeight: ((x:number,z:number)=>number) | null`; `collide: ((pos: Vector3, r: number)=>void) | null`; `followObj: { position: {x:number;y:number;z:number}; heading: number } | null`; `onCaption`, `onModeInternal` callbacks; `waypoints: { pos:[number,number,number]; look:[number,number,number]; dwell:number; name:string; blurb:string }[]`.

(The full ported source is ~230 lines mirroring `cm/cm-rig.js`; reproduce that file with the transforms above. Every method name and field used by the test must exist: `mode`, `setMode`, `setWaypoints`, `handleKey`, `board`, `unboard`, `followObj`, `update`, `onModeInternal`.)

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/stage/__tests__/Rig.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stage/Rig.ts src/stage/__tests__/Rig.test.ts
git commit -m "feat(stage): headless 4-mode Rig (ESM, bind(), handleKey)"
```

### Task 14: lightRig + materialKit (liftable presets)

**Files:**

- Create: `src/stage/lightRig.ts`, `src/stage/materialKit.ts`
- Test: `src/stage/__tests__/lightRig.test.ts`

**Interfaces:**

- Produces:
  - `computeDay(t: number): DayState` — pure function porting `cm-app.js` `setDay` math into a returned state object `{ sunPos:[number,number,number]; sunColor:number; sunIntensity:number; hemiSky:number; hemiGround:number; hemiIntensity:number; ambient:number; skyColor:number; fogColor:number; fogNear:number; fogFar:number; exposure:number; gradeBase:{saturation:number;contrast:number;vignette:number;lift:number}; bloom:{threshold:number;strength:number} }`. **exposure is reported for reference only** — the renderer uses NoToneMapping; ACES lives in Grade (Task 11). `gradeBase` are the BASE grade uniforms a palette profile then scales (Task 19).
  - `materialKit`: factory `standard(color, opts?)`, plus `drapedGround(texture, sizeWm, sizeHm)` returning a `MeshStandardMaterial` with the drape `map` and `colorSpace = SRGBColorSpace`.

- [ ] **Step 1: Write the failing test**

`src/stage/__tests__/lightRig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeDay } from '../lightRig';

describe('computeDay', () => {
  it('is darker at midnight than at noon', () => {
    const night = computeDay(0.0);
    const noon = computeDay(0.5);
    expect(noon.sunIntensity).toBeGreaterThan(night.sunIntensity);
    expect(noon.ambient).toBeGreaterThan(night.ambient);
  });
  it('returns base grade + bloom that day/night animates', () => {
    const d = computeDay(0.5);
    expect(d.gradeBase.saturation).toBeGreaterThan(1);
    expect(d.bloom.strength).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/stage/__tests__/lightRig.test.ts`
Expected: FAIL (`Cannot find module '../lightRig'`).

- [ ] **Step 3: Write `src/stage/lightRig.ts` and `src/stage/materialKit.ts`**

`src/stage/lightRig.ts` — port `cm-app.js:112-146` `setDay` into a pure `computeDay(t)`. Keep the same lerp/smoothstep math; return the values instead of mutating live objects.

```ts
function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function smooth(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255,
    ag = (a >> 8) & 255,
    ab = a & 255,
    br = (b >> 16) & 255,
    bg = (b >> 8) & 255,
    bb = b & 255;
  return (
    (((ar + (br - ar) * t) | 0) << 16) |
    (((ag + (bg - ag) * t) | 0) << 8) |
    ((ab + (bb - ab) * t) | 0)
  );
}

export interface DayState {
  sunPos: [number, number, number];
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  ambient: number;
  skyColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  exposure: number;
  gradeBase: {
    saturation: number;
    contrast: number;
    vignette: number;
    lift: number;
  };
  bloom: { threshold: number; strength: number };
}

export function computeDay(t: number): DayState {
  const dayT = clamp(t, 0, 1);
  const elev = Math.sin(dayT * Math.PI);
  const day = clamp(elev, 0, 1);
  const az = (dayT - 0.5) * Math.PI * 1.1;
  const R = 420;
  const warm = 1 - smooth(0.15, 0.85, elev);
  return {
    sunPos: [
      Math.sin(az) * R,
      Math.max(12, elev * R),
      Math.cos(az) * R * 0.4 + 120,
    ],
    sunColor: mixHex(0xfff2df, 0xffa74e, warm),
    sunIntensity: day * 1.05,
    hemiSky: mixHex(0x24304e, 0xbfd4ff, day),
    hemiGround: mixHex(0x1a1712, 0x6b5a44, day),
    hemiIntensity: lerp(0.12, 0.3, day),
    ambient: lerp(0.04, 0.1, day),
    skyColor: mixHex(0x0a1020, 0x8fb2da, day),
    fogColor: mixHex(0x0c1424, 0x93a7bd, day),
    fogNear: 360,
    fogFar: lerp(1000, 1600, day),
    exposure: lerp(0.78, 0.94, day),
    gradeBase: {
      saturation: lerp(1.2, 1.44, day),
      contrast: 1.12,
      vignette: lerp(0.54, 0.34, day),
      lift: lerp(-0.02, 0.0, day),
    },
    bloom: { threshold: lerp(0.18, 0.72, day), strength: lerp(1.15, 0.5, day) },
  };
}
```

`src/stage/materialKit.ts`:

```ts
import { MeshStandardMaterial, SRGBColorSpace, Texture } from 'three';

export const materialKit = {
  standard(color: number, opts: Partial<MeshStandardMaterial> = {}) {
    return new MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0,
      ...opts,
    });
  },
  drapedGround(texture: Texture) {
    texture.colorSpace = SRGBColorSpace;
    return new MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
    });
  },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/stage/__tests__/lightRig.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stage/lightRig.ts src/stage/materialKit.ts src/stage/__tests__/lightRig.test.ts
git commit -m "feat(stage): liftable lightRig (computeDay) + materialKit"
```

### Task 15: StageCore + import-guard test (the liftable seam)

**Files:**

- Create: `src/stage/StageCore.tsx`
- Test: `src/stage/__tests__/stagecore-imports.test.ts`

**Interfaces:**

- Consumes: `buildComposer` (Task 12), `useThree`/`useFrame` (@react-three/fiber).
- Produces: `<StageCore>` — a component rendered INSIDE `<Canvas>`. Props: `{ children, day?: number, lens?: {focus:number;blur:number}, grade?: Record<string,number>, onFrame?: (dt:number, t:number)=>void, registerHandle?: (h: StageHandle)=>void }`. It owns the composer, the single `useFrame` at `renderPriority = 1` that calls `composer.render(dt)`, resize from `useThree(s=>s.size)`, and exposes `StageHandle = { setLens; setGrade; setTime }`.
- **CONSTRAINT: StageCore imports nothing from `src/world`, `src/packs`, `src/agents`.** The import-guard test enforces this.

- [ ] **Step 1: Write the failing import-guard test**

`src/stage/__tests__/stagecore-imports.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('StageCore liftability', () => {
  it('imports nothing from world/packs/agents', () => {
    const src = readFileSync(
      new URL('../StageCore.tsx', import.meta.url),
      'utf8'
    );
    expect(src).not.toMatch(/from ['"]@?\/?.*\/(world|packs|agents)\//);
    expect(src).not.toMatch(/from ['"]\.\.\/(world|packs|agents)/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/stage/__tests__/stagecore-imports.test.ts`
Expected: FAIL (`ENOENT ... StageCore.tsx`).

- [ ] **Step 3: Write `src/stage/StageCore.tsx`**

```tsx
'use client';
import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { buildComposer } from '@/post/tiltShift';

export interface StageHandle {
  setLens: (focus: number, blur: number) => void;
  setGrade: (partial: Record<string, number>) => void;
  setTime: (t: number) => void;
}

export interface StageCoreProps {
  children?: React.ReactNode;
  lens?: { focus: number; blur: number };
  grade?: Record<string, number>;
  onFrame?: (dt: number, t: number) => void;
  registerHandle?: (h: StageHandle) => void;
}

export default function StageCore({
  children,
  lens,
  grade,
  onFrame,
  registerHandle,
}: StageCoreProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const timeRef = useRef(0);

  const rig = useMemo(
    () =>
      buildComposer(gl, scene, camera, {
        width: size.width,
        height: size.height,
      }),
    [gl, scene, camera] // size handled by setSize effect below
  );

  useEffect(() => {
    rig.setSize(size.width, size.height);
  }, [rig, size.width, size.height]);
  useEffect(() => {
    if (lens) rig.setLens(lens.focus, lens.blur);
  }, [rig, lens]);
  useEffect(() => {
    if (grade) rig.setGrade(grade);
  }, [rig, grade]);
  useEffect(() => {
    registerHandle?.({
      setLens: rig.setLens,
      setGrade: rig.setGrade,
      setTime: rig.setTime,
    });
    return () => rig.dispose();
  }, [rig, registerHandle]);

  useFrame((_, dt) => {
    timeRef.current += dt;
    rig.setTime(timeRef.current);
    onFrame?.(dt, timeRef.current);
    rig.composer.render(dt);
  }, 1); // renderPriority 1 suppresses R3F's own render

  return <>{children}</>;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/stage/__tests__/stagecore-imports.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/stage/StageCore.tsx src/stage/__tests__/stagecore-imports.test.ts
git commit -m "feat(stage): StageCore (liftable) + import-guard test"
```

### Task 16: Buildings (instanced, extruded footprints, hero swap tags)

**Files:**

- Create: `src/world/Buildings.tsx`, `src/world/geometry.ts`
- Test: `src/world/__tests__/geometry.test.ts`

**Interfaces:**

- Consumes: `Building` type (Task 10).
- Produces:
  - `src/world/geometry.ts`: `ringToShape(flatRing: number[]): { center:[number,number]; localRing:[number,number][] }` — recenters a flat ENU ring on its centroid (for a centered extrude), returns centroid + local verts.
  - `<Buildings buildings={Building[]} palette={BuildingPalette} />` — builds ONE `InstancedMesh` from an extruded unit shape scaled per building is not possible (footprints differ), so instead: batch buildings into a single merged `BufferGeometry` via per-building `ExtrudeGeometry` translated to its centroid; color per-building by palette. Hero buildings (with `swap`) are rendered as separate meshes tagged `userData.swap` (Task 18 mounts hero placeholders; here we just tag the massing).

- [ ] **Step 1: Write the failing test**

`src/world/__tests__/geometry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ringToShape } from '../geometry';

describe('ringToShape', () => {
  it('recenters a flat ENU ring on its centroid', () => {
    // square from (10,10) to (20,20)
    const { center, localRing } = ringToShape([10, 10, 20, 10, 20, 20, 10, 20]);
    expect(center[0]).toBeCloseTo(15, 5);
    expect(center[1]).toBeCloseTo(15, 5);
    expect(localRing[0]).toEqual([-5, -5]);
    expect(localRing[2]).toEqual([5, 5]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/world/__tests__/geometry.test.ts`
Expected: FAIL (`Cannot find module '../geometry'`).

- [ ] **Step 3: Write `src/world/geometry.ts` and `src/world/Buildings.tsx`**

`src/world/geometry.ts`:

```ts
export function ringToShape(flatRing: number[]): {
  center: [number, number];
  localRing: [number, number][];
} {
  const pts: [number, number][] = [];
  for (let i = 0; i < flatRing.length; i += 2)
    pts.push([flatRing[i], flatRing[i + 1]]);
  let cx = 0,
    cz = 0;
  for (const [x, z] of pts) {
    cx += x;
    cz += z;
  }
  cx /= pts.length;
  cz /= pts.length;
  return {
    center: [cx, cz],
    localRing: pts.map(([x, z]) => [x - cx, z - cz] as [number, number]),
  };
}
```

`src/world/Buildings.tsx`:

```tsx
'use client';
import { useMemo } from 'react';
import {
  Shape,
  ExtrudeGeometry,
  BufferGeometry,
  BufferAttribute,
  Color,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Building } from '@/lib/manifest';
import { ringToShape } from './geometry';

export interface BuildingPalette {
  bricks: number[];
}

function extrude(b: Building): BufferGeometry {
  const { center, localRing } = ringToShape(b.ring);
  const shape = new Shape();
  localRing.forEach(([x, z], i) =>
    i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)
  );
  shape.closePath();
  // Extrude along +Y: build in XZ by extruding the XY shape then rotating.
  const geo = new ExtrudeGeometry(shape, {
    depth: b.height,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2); // shape's Y -> world Z; extrude depth -> world +Y
  geo.translate(center[0], 0, center[1]);
  return geo;
}

export default function Buildings({
  buildings,
  palette,
}: {
  buildings: Building[];
  palette: BuildingPalette;
}) {
  const { geometry } = useMemo(() => {
    const nonHero = buildings.filter((b) => !b.swap);
    const geos = nonHero.map((b) => {
      const g = extrude(b);
      const c = new Color(palette.bricks[b.id % palette.bricks.length]);
      const count = g.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new BufferAttribute(colors, 3));
      return g;
    });
    return {
      geometry: geos.length
        ? mergeGeometries(geos, false)
        : new BufferGeometry(),
    };
  }, [buildings, palette]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0} />
    </mesh>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/world/__tests__/geometry.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/world/geometry.ts src/world/Buildings.tsx src/world/__tests__/geometry.test.ts
git commit -m "feat(world): extruded footprint massing, merged geometry"
```

### Task 17: Terrain (draped plane, manifest extent assertion)

**Files:**

- Create: `src/world/Terrain.tsx`, `src/world/terrainSample.ts`
- Test: `src/world/__tests__/terrainSample.test.ts`

**Interfaces:**

- Consumes: `TerrainGrid`, `Manifest` (Task 10).
- Produces:
  - `src/world/terrainSample.ts`: `bilinear(grid: TerrainGrid, u: number, v: number): number` (u,v in [0,1]; u=W→E, v=S→N), and `assertExtent(manifest: Manifest, quadWm: number, quadHm: number): void` — throws if the built quad extent differs from `manifest.groundWm/Hm` by >1 m (the drape-registration guard).
- `<Terrain grid drapeTexture manifest />` — a `PlaneGeometry(groundWm, groundHm, cols-1, rows-1)` displaced by `bilinear`, rotated flat, draped edge-to-edge; asserts extent at build.

- [ ] **Step 1: Write the failing test**

`src/world/__tests__/terrainSample.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bilinear, assertExtent } from '../terrainSample';

const grid = { cols: 2, rows: 2, heights: [0, 10, 20, 30] }; // SW,SE,NW,NE row-major (S->N)

describe('terrain sampling', () => {
  it('bilinear samples the corners', () => {
    expect(bilinear(grid, 0, 0)).toBeCloseTo(0, 5); // SW
    expect(bilinear(grid, 1, 0)).toBeCloseTo(10, 5); // SE
    expect(bilinear(grid, 0, 1)).toBeCloseTo(20, 5); // NW
    expect(bilinear(grid, 1, 1)).toBeCloseTo(30, 5); // NE
  });
  it('bilinear interpolates the center', () => {
    expect(bilinear(grid, 0.5, 0.5)).toBeCloseTo(15, 5);
  });
  it('assertExtent throws when the quad mismatches the manifest', () => {
    const m = { groundWm: 1458, groundHm: 2875 } as never;
    expect(() => assertExtent(m, 1458, 2875)).not.toThrow();
    expect(() => assertExtent(m, 1800, 2875)).toThrow(/extent/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/world/__tests__/terrainSample.test.ts`
Expected: FAIL (`Cannot find module '../terrainSample'`).

- [ ] **Step 3: Write `src/world/terrainSample.ts` and `src/world/Terrain.tsx`**

`src/world/terrainSample.ts`:

```ts
import type { TerrainGrid, Manifest } from '@/lib/manifest';

export function bilinear(grid: TerrainGrid, u: number, v: number): number {
  const { cols, rows, heights } = grid;
  const gx = Math.min(cols - 1, Math.max(0, u * (cols - 1)));
  const gz = Math.min(rows - 1, Math.max(0, v * (rows - 1)));
  const x0 = Math.floor(gx),
    z0 = Math.floor(gz);
  const x1 = Math.min(cols - 1, x0 + 1),
    z1 = Math.min(rows - 1, z0 + 1);
  const fx = gx - x0,
    fz = gz - z0;
  const h = (c: number, r: number) => heights[r * cols + c];
  const top = h(x0, z0) * (1 - fx) + h(x1, z0) * fx;
  const bot = h(x0, z1) * (1 - fx) + h(x1, z1) * fx;
  return top * (1 - fz) + bot * fz;
}

export function assertExtent(
  manifest: Manifest,
  quadWm: number,
  quadHm: number
): void {
  if (
    Math.abs(quadWm - manifest.groundWm) > 1 ||
    Math.abs(quadHm - manifest.groundHm) > 1
  ) {
    throw new Error(
      `terrain extent mismatch: quad ${quadWm}x${quadHm} vs manifest ${manifest.groundWm}x${manifest.groundHm}`
    );
  }
}
```

`src/world/Terrain.tsx`:

```tsx
'use client';
import { useMemo } from 'react';
import { PlaneGeometry, Texture } from 'three';
import type { TerrainGrid, Manifest } from '@/lib/manifest';
import { bilinear, assertExtent } from './terrainSample';
import { materialKit } from '@/stage/materialKit';

export default function Terrain({
  grid,
  drape,
  manifest,
}: {
  grid: TerrainGrid;
  drape: Texture;
  manifest: Manifest;
}) {
  const geometry = useMemo(() => {
    const w = manifest.groundWm,
      h = manifest.groundHm;
    assertExtent(manifest, w, h); // fail loud if the box/mpp changed under us
    const g = new PlaneGeometry(w, h, grid.cols - 1, grid.rows - 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / w + 0.5; // W->E
      const v = pos.getY(i) / h + 0.5; // S->N (plane Y before rotate)
      pos.setZ(i, bilinear(grid, u, v)); // displace along plane normal
    }
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [grid, manifest]);

  const material = useMemo(() => materialKit.drapedGround(drape), [drape]);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/world/__tests__/terrainSample.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/world/terrainSample.ts src/world/Terrain.tsx src/world/__tests__/terrainSample.test.ts
git commit -m "feat(world): draped terrain with manifest extent assertion"
```

### Task 18: Streets + Heroes + ChattWorld (loader that assembles the scene)

**Files:**

- Create: `src/world/Streets.tsx`, `src/world/Heroes.tsx`, `src/world/Avatar.tsx`, `src/world/ChattWorld.tsx`
- Test: `src/world/__tests__/heroes.test.ts`

**Interfaces:**

- Consumes: `loadJson`, types (Task 10); `Buildings`, `Terrain` (Tasks 16-17).
- Produces:
  - `<Streets streets={Street[]} />` — thin ribbons/lines from flat ENU polylines.
  - `HERO_KEYS: string[]` (the 8 slot names) and `<Heroes heroes={Hero[]} />` — each mounts a low-poly placeholder `mesh` with `userData.swap = hero.swap` at `[x, y, z]`.
  - `<ChattWorld palette={{ bricks: number[] }} onLoaded={(m: Manifest)=>void} />` — loads all `public/chatt/*` via `loadJson`, loads the drape via `TextureLoader` + `getAssetUrl`, renders `<Terrain>`, `<Buildings>`, `<Streets>`, `<Heroes>`. (Avatar and the `groundHeight`/`collide` wiring for the Rig are added in a later milestone; M1 drives the avatar with the Rig's built-in flat-ground default.)

- [ ] **Step 1: Write the failing test** (guards all 8 hero slots exist and are tagged)

`src/world/__tests__/heroes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HERO_KEYS } from '../Heroes';

describe('hero swap slots', () => {
  it('defines all 8 hero-swap keys', () => {
    expect(new Set(HERO_KEYS)).toEqual(
      new Set([
        'aquarium',
        'walnut_st_bridge',
        'tivoli',
        'dome_building',
        'courthouse',
        'hunter_museum',
        'choo_choo',
        'republic_centre',
      ])
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/world/__tests__/heroes.test.ts`
Expected: FAIL (`Cannot find module '../Heroes'`).

- [ ] **Step 3: Write the four files**

`src/world/Heroes.tsx` (placeholder massing, every slot tagged — satisfies `grep userData.swap`):

```tsx
'use client';
import type { Hero } from '@/lib/manifest';

export const HERO_KEYS = [
  'aquarium',
  'walnut_st_bridge',
  'tivoli',
  'dome_building',
  'courthouse',
  'hunter_museum',
  'choo_choo',
  'republic_centre',
];

export default function Heroes({ heroes }: { heroes: Hero[] }) {
  return (
    <>
      {heroes.map((h, i) => (
        <mesh
          key={`${h.swap}-${i}`}
          position={[h.x, 8, h.z]}
          castShadow
          onUpdate={(self) => {
            self.userData.swap = h.swap;
          }}
        >
          <boxGeometry args={[16, 16, 16]} />
          <meshStandardMaterial
            color={0x8fd0d8}
            roughness={0.3}
            metalness={0.1}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </>
  );
}
```

`src/world/Streets.tsx`:

```tsx
'use client';
import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { Street } from '@/lib/manifest';

export default function Streets({ streets }: { streets: Street[] }) {
  const geometry = useMemo(() => {
    const verts: number[] = [];
    for (const s of streets) {
      for (let i = 0; i + 3 < s.pts.length; i += 2) {
        verts.push(
          s.pts[i],
          0.15,
          s.pts[i + 1],
          s.pts[i + 2],
          0.15,
          s.pts[i + 3]
        );
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(verts, 3));
    return g;
  }, [streets]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={0x9c9384} />
    </lineSegments>
  );
}
```

`src/world/Avatar.tsx`:

```tsx
'use client';
import { forwardRef } from 'react';
import { Group } from 'three';

const Avatar = forwardRef<Group>(function Avatar(_, ref) {
  return (
    <group ref={ref}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.9, 2, 10]} />
        <meshStandardMaterial color={0x3d6ea5} />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <sphereGeometry args={[0.95, 14, 12]} />
        <meshStandardMaterial color={0xf0c9a0} />
      </mesh>
    </group>
  );
});
export default Avatar;
```

`src/world/ChattWorld.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { TextureLoader, Texture } from 'three';
import { getAssetUrl } from '@/lib/assetUrl';
import { loadJson, loadManifest } from '@/lib/manifest';
import type {
  Building,
  Street,
  Hero,
  TerrainGrid,
  Manifest,
} from '@/lib/manifest';
import Buildings from './Buildings';
import Terrain from './Terrain';
import Streets from './Streets';
import Heroes from './Heroes';

interface WorldData {
  manifest: Manifest;
  buildings: Building[];
  streets: Street[];
  heroes: Hero[];
  terrain: TerrainGrid;
  drape: Texture;
}

export default function ChattWorld({
  palette,
  onLoaded,
}: {
  palette: { bricks: number[] };
  onLoaded?: (m: Manifest) => void;
}) {
  const [data, setData] = useState<WorldData | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [manifest, buildings, streets, heroes, terrain] = await Promise.all(
        [
          loadManifest(),
          loadJson<Building[]>('buildings.json'),
          loadJson<Street[]>('streets.json'),
          loadJson<Hero[]>('heroes.json'),
          loadJson<TerrainGrid>('terrain.json'),
        ]
      );
      const drape = await new TextureLoader().loadAsync(
        getAssetUrl('/chatt/drape.jpg')
      );
      if (!alive) return;
      setData({ manifest, buildings, streets, heroes, terrain, drape });
      onLoaded?.(manifest);
    })();
    return () => {
      alive = false;
    };
  }, [onLoaded]);

  if (!data) return null;
  return (
    <>
      <Terrain
        grid={data.terrain}
        drape={data.drape}
        manifest={data.manifest}
      />
      <Buildings buildings={data.buildings} palette={palette} />
      <Streets streets={data.streets} />
      <Heroes heroes={data.heroes} />
    </>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/world/__tests__/heroes.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Verify all 8 hero slots are grep-able**

Run: `docker compose run --rm app sh -c "grep -rn userData.swap src/ | wc -l"` and inspect `HERO_KEYS`.
Expected: `Heroes.tsx` tags `userData.swap`; `HERO_KEYS` has 8 entries.

- [ ] **Step 6: Commit**

```bash
git add src/world/Streets.tsx src/world/Heroes.tsx src/world/Avatar.tsx src/world/ChattWorld.tsx src/world/__tests__/heroes.test.ts
git commit -m "feat(world): streets, hero slots, avatar, ChattWorld loader"
```

### Task 19: Packs (themes + Riverfront tour) + trolley

**Files:**

- Create: `src/packs/themes.ts`, `src/packs/tours.ts`, `src/agents/trolley.tsx`
- Test: `src/packs/__tests__/packs.test.ts`

**Interfaces:**

- Produces:
  - `PALETTES: Record<'trueToLife'|'toy', PaletteProfile>` where `PaletteProfile = { label:string; gradeSat:number; gradeContrast:number; gradeVignette:number; fov:number; maxBlur:number; bricks:number[] }`.
  - `applyProfile(base: {saturation:number;contrast:number;vignette:number}, p: PaletteProfile): Record<string,number>` — one owner composes base (from `computeDay`) with the active profile.
  - `RIVERFRONT_TOUR: Waypoint[]` (Ross's Landing → Aquarium → Walnut St Bridge → Coolidge Park) with real-fact captions; `Waypoint = { pos:[number,number,number]; look:[number,number,number]; dwell:number; name:string; blurb:string }`.
  - `<Trolley polyline={number[]} onTick={(pos, heading)=>void} />` — CatmullRom follower over a baked ENU polyline (flat x,z), exposing `{position, heading}` each frame.

- [ ] **Step 1: Write the failing test**

`src/packs/__tests__/packs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PALETTES, applyProfile, RIVERFRONT_TOUR } from '../themes';

describe('packs', () => {
  it('has two palette profiles that differ in saturation, fov, blur', () => {
    expect(PALETTES.trueToLife.gradeSat).toBeLessThan(PALETTES.toy.gradeSat);
    expect(PALETTES.trueToLife.maxBlur).toBeLessThan(PALETTES.toy.maxBlur);
    expect(PALETTES.trueToLife.fov).not.toBe(PALETTES.toy.fov);
  });
  it('applyProfile scales the day/night base (single owner)', () => {
    const out = applyProfile(
      { saturation: 1.3, contrast: 1.1, vignette: 0.4 },
      PALETTES.toy
    );
    expect(out.saturation).toBeGreaterThan(1.3); // toy pushes saturation up
  });
});

import { RIVERFRONT_TOUR as TOUR } from '../tours';
describe('riverfront tour', () => {
  it('visits the four riverfront landmarks with captions', () => {
    expect(TOUR).toHaveLength(4);
    expect(TOUR.map((w) => w.name)).toEqual([
      "Ross's Landing",
      'Tennessee Aquarium',
      'Walnut Street Bridge',
      'Coolidge Park',
    ]);
    for (const w of TOUR) expect(w.blurb.length).toBeGreaterThan(0);
  });
});
```

Note: `PALETTES`/`applyProfile` live in `themes.ts`; `RIVERFRONT_TOUR` lives in `tours.ts`. The test imports each from its own module (`../themes` and `../tours` respectively) — no re-export needed.

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/packs/__tests__/packs.test.ts`
Expected: FAIL (`Cannot find module '../themes'`).

- [ ] **Step 3: Write `src/packs/themes.ts`, `src/packs/tours.ts`, `src/agents/trolley.tsx`**

`src/packs/themes.ts`:

```ts
export interface PaletteProfile {
  label: string;
  gradeSat: number;
  gradeContrast: number;
  gradeVignette: number;
  fov: number;
  maxBlur: number;
  bricks: number[];
}

export const PALETTES: Record<'trueToLife' | 'toy', PaletteProfile> = {
  trueToLife: {
    label: 'True to life',
    gradeSat: 1.0,
    gradeContrast: 1.0,
    gradeVignette: 0.9,
    fov: 42,
    maxBlur: 2.2,
    bricks: [0xb0a89c, 0x9a9188, 0xc2b6a4, 0x8f8a86, 0xa89e90],
  },
  toy: {
    label: 'Toy',
    gradeSat: 1.15,
    gradeContrast: 1.05,
    gradeVignette: 1.0,
    fov: 34,
    maxBlur: 3.2,
    bricks: [
      0xc98b5a, 0xb5623f, 0xcab196, 0x8f8a86, 0xd8c2a0, 0xa66b52, 0x9aa0a6,
      0xbf9b6b,
    ],
  },
};

// Single owner: day/night base * profile => the grade uniforms actually applied.
export function applyProfile(
  base: { saturation: number; contrast: number; vignette: number },
  p: PaletteProfile
): Record<string, number> {
  return {
    saturation: base.saturation * p.gradeSat,
    contrast: base.contrast * p.gradeContrast,
    vignette: base.vignette * p.gradeVignette,
  };
}
```

`src/packs/tours.ts` (positions are ENU metres; captions carry real facts):

```ts
export interface Waypoint {
  pos: [number, number, number];
  look: [number, number, number];
  dwell: number;
  name: string;
  blurb: string;
}

// Positions resolved from heroes.json / manifest at wire time; these are seed values
// over the real layout (north = -Z). Replace with manifest-derived coords in Task 20.
export const RIVERFRONT_TOUR: Waypoint[] = [
  {
    pos: [-40, 40, 120],
    look: [-40, 4, 40],
    dwell: 5,
    name: "Ross's Landing",
    blurb: 'The 1815 riverfront landing where Chattanooga began.',
  },
  {
    pos: [-70, 46, 20],
    look: [-70, 14, -14],
    dwell: 5,
    name: 'Tennessee Aquarium',
    blurb: "Opened 1992 — the world's largest freshwater aquarium at the time.",
  },
  {
    pos: [20, 40, 0],
    look: [45, 8, -52],
    dwell: 5,
    name: 'Walnut Street Bridge',
    blurb:
      '1890 truss bridge, 2,376 ft — one of the longest pedestrian bridges in the world.',
  },
  {
    pos: [46, 52, -60],
    look: [46, 12, -120],
    dwell: 5,
    name: 'Coolidge Park',
    blurb:
      'North Shore park with a 1894 Dentzel carousel and a climbable fountain.',
  },
];
```

`src/agents/trolley.tsx`:

```tsx
'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Vector3, Group } from 'three';

export default function Trolley({
  polyline,
  onTick,
}: {
  polyline: number[];
  onTick?: (pos: Vector3, heading: number) => void;
}) {
  const ref = useRef<Group>(null);
  const uRef = useRef(0);
  const { curve, len } = useMemo(() => {
    const pts: Vector3[] = [];
    for (let i = 0; i + 1 < polyline.length; i += 2)
      pts.push(new Vector3(polyline[i], 0, polyline[i + 1]));
    const c = new CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    return { curve: c, len: c.getLength() || 1 };
  }, [polyline]);

  const pos = useRef(new Vector3());
  const tan = useRef(new Vector3());
  const heading = useRef(0);
  useFrame((_, dt) => {
    uRef.current = (uRef.current + (15 * dt) / len) % 1;
    curve.getPointAt(uRef.current, pos.current);
    curve.getTangentAt(uRef.current, tan.current);
    const target = Math.atan2(tan.current.x, tan.current.z);
    const d = ((target - heading.current + Math.PI) % (Math.PI * 2)) - Math.PI;
    heading.current += d * (1 - Math.exp(-7 * dt));
    if (ref.current) {
      ref.current.position.set(pos.current.x, 0, pos.current.z);
      ref.current.rotation.y = heading.current;
    }
    onTick?.(pos.current, heading.current);
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 3.4, 0]} castShadow>
        <boxGeometry args={[6, 5, 13]} />
        <meshStandardMaterial color={0xb23a2e} />
      </mesh>
      <mesh position={[0, 6.4, 0]}>
        <boxGeometry args={[6.6, 0.8, 13.6]} />
        <meshStandardMaterial color={0xf0e6d2} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/packs/__tests__/packs.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/packs/ src/agents/trolley.tsx src/packs/__tests__/packs.test.ts
git commit -m "feat(packs): palette profiles, Riverfront tour, trolley follower"
```

### Task 20: Hud + ChattCanvas composition root + page wiring

**Files:**

- Create: `src/stage/Hud.tsx`, `app/ChattCanvas.client.tsx`
- Modify: `app/page.tsx`
- Test: `src/stage/__tests__/hud.test.tsx` (component render smoke)

**Interfaces:**

- Consumes: everything above.
- Produces:
  - `<Hud>` — generic-by-props: `{ title, subtitle, modes: {key,label}[], activeMode, onMode, palettes: {key,label}[], activePalette, onPalette, caption?: {name,blurb}, provenance: string, showFps, fps? }`. No hardcoded Chattanooga strings.
  - `app/ChattCanvas.client.tsx` — the composition root: `<Canvas gl={{toneMapping: NoToneMapping, antialias:true, powerPreference:'high-performance'}} dpr={[1,1.75]} camera={{fov:34, position:[-30,150,250], near:1, far:2400}}>` mounting `<StageCore>` with `<ChattWorld>`, `<Trolley>`, lights (from `computeDay`), and driving the `Rig` via a `useFrame` inside a child; DOM `<Hud>` sibling. Owns mode state, palette state, `toggleBoard` (T key), FPS toggle (`~`), day value.
- The page dynamically imports ChattCanvas with `{ssr:false}`.

- [ ] **Step 1: Write the failing test** (Hud renders its props, no hardcoded wordmark)

`src/stage/__tests__/hud.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Hud from '../Hud';

describe('Hud', () => {
  it('renders provided title/provenance, not a hardcoded wordmark', () => {
    const html = renderToStaticMarkup(
      <Hud
        title="Test City"
        subtitle="sub"
        provenance="© X · Y"
        modes={[{ key: 'tour', label: 'Tour' }]}
        activeMode="tour"
        onMode={() => {}}
        palettes={[{ key: 'toy', label: 'Toy' }]}
        activePalette="toy"
        onPalette={() => {}}
        showFps={false}
      />
    );
    expect(html).toContain('Test City');
    expect(html).toContain('© X · Y');
    expect(html).not.toContain('Chattanooga Mini'); // wordmark comes from props/packs
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm app pnpm test src/stage/__tests__/hud.test.tsx`
Expected: FAIL (`Cannot find module '../Hud'`). (Add `react-dom` to deps if not resolved; it is a peer of React 19 and already present.)

- [ ] **Step 3: Write `src/stage/Hud.tsx`, `app/ChattCanvas.client.tsx`, and update `app/page.tsx`**

`src/stage/Hud.tsx` — generic glass HUD. Port the visual style from `cm/cm-hud.js` (glass CSS, mode dock, caption chip, crosshair, fps) but drive ALL copy from props. Add a palette toggle row and a provenance line. Wordmark = `props.title`. (Reproduce the cm-hud styling as inline styles or a CSS module; every label comes from props.)

`app/ChattCanvas.client.tsx` — the composition root:

```tsx
'use client';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { NoToneMapping, Group, Vector3 } from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StageCore, { StageHandle } from '@/stage/StageCore';
import { Rig } from '@/stage/Rig';
import ChattWorld from '@/world/ChattWorld';
import Trolley from '@/agents/trolley';
import Hud from '@/stage/Hud';
import { computeDay } from '@/stage/lightRig';
import { PALETTES, applyProfile } from '@/packs/themes';
import { RIVERFRONT_TOUR } from '@/packs/tours';
import type { Manifest } from '@/lib/manifest';

type Mode = 'tour' | 'orbit' | 'follow' | 'walk';

function SceneInner({
  paletteKey,
  day,
  onCaption,
  registerHandle,
}: {
  paletteKey: 'trueToLife' | 'toy';
  day: number;
  onCaption: (c: { name: string; blurb: string } | null) => void;
  registerHandle: (h: StageHandle) => void;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const rig = useMemo(() => new Rig(camera, gl.domElement), [camera, gl]);
  useEffect(() => {
    rig.bind();
    rig.setWaypoints(RIVERFRONT_TOUR);
    rig.onCaption = (c) => onCaption(c as never);
    return () => rig.dispose();
  }, [rig, onCaption]);

  const d = useMemo(() => computeDay(day), [day]);
  const grade = useMemo(
    () => applyProfile(d.gradeBase, PALETTES[paletteKey]),
    [d, paletteKey]
  );

  return (
    <StageCore
      lens={{ focus: 0.52, blur: PALETTES[paletteKey].maxBlur }}
      grade={grade}
      onFrame={(dt) => rig.update(dt)}
      registerHandle={registerHandle}
    >
      <ambientLight intensity={d.ambient} />
      <hemisphereLight args={[d.hemiSky, d.hemiGround, d.hemiIntensity]} />
      <directionalLight
        position={d.sunPos}
        intensity={d.sunIntensity}
        color={d.sunColor}
        castShadow
      />
      <ChattWorld palette={{ bricks: PALETTES[paletteKey].bricks }} />
      <Trolley
        polyline={[
          -90, 20, -90, 210, -20, 210, -20, 60, 45, 60, 45, 200, 115, 200, 115,
          30, 45, 30, -20, 30,
        ]}
      />
    </StageCore>
  );
}

export default function ChattCanvas() {
  const [mode, setMode] = useState<Mode>('tour');
  const [paletteKey, setPaletteKey] = useState<'trueToLife' | 'toy'>('toy');
  const [caption, setCaption] = useState<{
    name: string;
    blurb: string;
  } | null>(RIVERFRONT_TOUR[0]);
  const [showFps, setShowFps] = useState(false);
  const day = 0.28;
  const handleRef = useRef<StageHandle | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Backquote') setShowFps((v) => !v);
      if (e.code === 'Digit1') setMode('tour');
      if (e.code === 'Digit2') setMode('orbit');
      if (e.code === 'Digit3') setMode('follow');
      if (e.code === 'Digit4') setMode('walk');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{
          toneMapping: NoToneMapping,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{
          fov: PALETTES[paletteKey].fov,
          position: [-30, 150, 250],
          near: 1,
          far: 2400,
        }}
      >
        <SceneInner
          paletteKey={paletteKey}
          day={day}
          onCaption={setCaption}
          registerHandle={(h) => (handleRef.current = h)}
        />
      </Canvas>
      <Hud
        title="Chattanooga Mini"
        subtitle="a living tilt-shift diorama"
        provenance="© OpenStreetMap · USGS 3DEP · USGS NAIP"
        modes={[
          { key: 'tour', label: 'Tour' },
          { key: 'orbit', label: 'Miniature' },
          { key: 'follow', label: 'Follow' },
          { key: 'walk', label: 'Walk' },
        ]}
        activeMode={mode}
        onMode={(m) => setMode(m as Mode)}
        palettes={[
          { key: 'trueToLife', label: 'True to life' },
          { key: 'toy', label: 'Toy' },
        ]}
        activePalette={paletteKey}
        onPalette={(p) => setPaletteKey(p as 'trueToLife' | 'toy')}
        caption={mode === 'tour' ? caption : null}
        showFps={showFps}
      />
    </div>
  );
}
```

`app/page.tsx`:

```tsx
import dynamic from 'next/dynamic';
const ChattCanvas = dynamic(() => import('./ChattCanvas.client'), {
  ssr: false,
});
export default function Page() {
  return <ChattCanvas />;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `docker compose run --rm app pnpm test src/stage/__tests__/hud.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Type-check the whole app**

Run: `docker compose run --rm app pnpm type-check`
Expected: no errors. Fix any type mismatches surfaced by the integration.

- [ ] **Step 6: Commit**

```bash
git add src/stage/Hud.tsx app/ChattCanvas.client.tsx app/page.tsx src/stage/__tests__/hud.test.tsx
git commit -m "feat: Hud (generic) + ChattCanvas composition root + page wiring"
```

### Task 21: Color-pipeline eyedrop gate (Playwright) — the double-encode guard

**Files:**

- Create: `playwright.config.ts`, `tests/e2e/color-pipeline.spec.ts`, `app/eyedrop/page.tsx` (a test-only route rendering a flat linear-0.5 surface through the composer)
- Modify: `package.json` (add `@playwright/test`, `test:e2e` script)

**Interfaces:**

- Produces: a Playwright test that loads `/eyedrop/`, reads a center pixel via canvas `toDataURL`/`getImageData`, and asserts it is ~188/255 (linear 0.5 → one sRGB encode), NOT ~128 (no encode) or ~233 (double encode).

- [ ] **Step 1: Write the test route** `app/eyedrop/page.tsx`

A client component that renders a full-screen quad with a constant linear color `vec3(0.5)` through `StageCore`'s composer with tilt-shift blur = 0 and grade at neutral (saturation 1, contrast 1, vignette 0, exposure 1, grain 0), so the ONLY transform is ACES+sRGB. Expose the canvas with `data-testid="eyedrop-canvas"`. (ACES(0.5) ≈ 0.512 linear → sRGB ≈ 0.74 → ~188/255. Assert the window [180,196].)

- [ ] **Step 2: Write `playwright.config.ts` and the spec**

`tests/e2e/color-pipeline.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('linear-0.5 renders through the chain with exactly ONE sRGB encode', async ({
  page,
}) => {
  await page.goto('/eyedrop/');
  await page.waitForTimeout(800); // let one composer frame render
  const rgb = await page.evaluate(() => {
    const c = document.querySelector(
      '[data-testid="eyedrop-canvas"]'
    ) as HTMLCanvasElement;
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const px = new Uint8Array(4);
    (gl as WebGLRenderingContext).readPixels(
      Math.floor(c.width / 2),
      Math.floor(c.height / 2),
      1,
      1,
      (gl as WebGLRenderingContext).RGBA,
      (gl as WebGLRenderingContext).UNSIGNED_BYTE,
      px
    );
    return [px[0], px[1], px[2]];
  });
  // one sRGB encode of ACES(0.5): ~188. Double encode would be ~233; none ~128.
  expect(rgb[0]).toBeGreaterThan(178);
  expect(rgb[0]).toBeLessThan(200);
});
```

`playwright.config.ts` (serves the static export or the dev server):

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
```

- [ ] **Step 3: Run the gate**

Run: `docker compose run --rm app pnpm exec playwright test color-pipeline`
Expected: PASS. If the pixel reads ~233, the double-encode is present — set `gl.toneMapping=NoToneMapping` (already in the Canvas) and confirm neither R3F nor `postprocessing` adds a second sRGB pass; the Grade must be the only encoder. If ~128, ACES/sRGB isn't being applied — confirm Grade is the terminal pass.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/color-pipeline.spec.ts app/eyedrop/ package.json
git commit -m "test(e2e): color-pipeline eyedrop gate (single sRGB encode)"
```

### Task 22: Production build, basePath smoke, and visual acceptance

**Files:**

- Create: `tests/e2e/basepath.spec.ts`, `tests/e2e/acceptance.spec.ts`

**Interfaces:**

- Produces: (a) a static export that serves under a basePath with assets returning 200; (b) a visual acceptance test that loads the app, waits for the world, switches all four modes, toggles the palette, and screenshots the miniature view.

- [ ] **Step 1: Write the basePath smoke** `tests/e2e/basepath.spec.ts`

```ts
import { test, expect } from '@playwright/test';

// Run against a production export built with NEXT_PUBLIC_BASE_PATH=/chattanooga-mini,
// served under that prefix. Asserts the committed assets resolve (no root-anchored 404).
test('chatt assets return 200 under the basePath', async ({ page }) => {
  const bad: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/chatt/') && r.status() >= 400)
      bad.push(`${r.status()} ${r.url()}`);
  });
  await page.goto('/chattanooga-mini/');
  await page.waitForTimeout(2000);
  expect(bad, `asset 404s under basePath: ${bad.join(', ')}`).toHaveLength(0);
});
```

- [ ] **Step 2: Build the static export under the basePath and serve it**

Run:

```bash
docker compose run --rm -e NEXT_PUBLIC_BASE_PATH=/chattanooga-mini app pnpm build
docker compose run --rm app sh -c "cd out && python3 -m http.server 3000"   # serve the export
```

(Or a Playwright `webServer` that serves `out/` under the prefix.) Then run the basePath spec.
Expected: zero `/chatt/*` 404s — proves `getAssetUrl` prefixes correctly and no absolute `/chatt/...` string leaked in.

- [ ] **Step 3: Write + run the visual acceptance test** `tests/e2e/acceptance.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('M1 diorama: world loads, four modes, palette toggle', async ({
  page,
}) => {
  await page.goto('/');
  // world loaded => buildings.json fetched and a canvas is present
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(2500);
  for (const label of ['Miniature', 'Follow', 'Walk', 'Tour']) {
    await page.getByRole('button', { name: label }).click();
    await page.waitForTimeout(400);
  }
  await page.getByRole('button', { name: 'True to life' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Toy' }).click();
  await expect(
    page.getByText('© OpenStreetMap · USGS 3DEP · USGS NAIP')
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/miniature.png' });
});
```

Run: `docker compose run --rm app pnpm exec playwright test acceptance`
Expected: PASS; `test-results/miniature.png` shows a recognizable downtown Chattanooga miniature — river along the top, Walnut St Bridge, Broad/Market spine, the Choo Choo, with the tilt-shift blur toward the edges. **Eyeball this against the M1 acceptance criteria.**

- [ ] **Step 4: Run the full test suite + type-check**

Run:

```bash
docker compose run --rm app pnpm test
docker compose run --rm app pnpm type-check
docker compose run --rm app pnpm exec playwright test
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/basepath.spec.ts tests/e2e/acceptance.spec.ts
git commit -m "test(e2e): basePath smoke + M1 visual acceptance"
```

- [ ] **Step 6: Review the height debug overlay before final sign-off**

Temporarily set `Buildings` to color by `b.rule` (height=green, levels=blue, override=gold, fallback=red) and screenshot the miniature. Expected: ~74% red (fallback), matching the finding. Confirm no landmark tower is stunted; if a dominant fallback building looks wrong, add it to `HEIGHT_OVERRIDES` (Task 7) and re-bake. Revert the debug coloring after review.

---

## Deferred to later milestones (not in this plan)

Objective packs (landmark/photo mode, trolley-route run, time-trial, trivia); CBD Spine + Bluff & Rails tours; cars/peds/boats agents; street-graph-derived trolley routing (M1 uses a baked polyline); per-material true-to-life recolor beyond grade/FOV/blur; BroadcastChannel multiplayer; the ScriptHammer back-port ticket (open after M1 ships).

## Self-Review

**Spec coverage** — every design section maps to a task: seam/box/ENU (T2), fetch-osm+relations (T4), terrain batching (T5), drape meter-proportional (T6), height heuristic+fallback (T7), build-scene quantize+manifest+reproducibility (T8/T9), assetUrl/basePath (T10/T22), raw-postprocessing+single-color-owner (T11/T12/T21), headless Rig (T13), StageCore god-object split+import-guard (T15), theming ownership via packs (T16/T19/T20), palette profiles (T19), generic Hud (T20), trolley baked polyline (T19), hero swap tags (T18), Docker-first separate bake service (T1/T9), provenance in HUD (T20/T22). All 16 risk-ledger items resolved.

**Placeholders** — none: every code step shows real code; the two prose-directed ports (Rig T13, Hud T20) name the exact source file, the exact transforms, and the exact public surface the tests require.

**Type consistency** — `Building`/`Street`/`Hero`/`TerrainGrid`/`Manifest` defined in T10, consumed unchanged in T16-T20; `StageHandle` (T15) consumed in T20; `Waypoint` (T19) consumed by `Rig.setWaypoints` (T13); `PaletteProfile` (T19) fields (`bricks`, `maxBlur`, `fov`) consumed in T20.
