# Warehouse Sampling Pipeline — The One-Page Flow (#259)

Every 3D Warehouse building reaches the twin through exactly **three stages,
one output each**. One model on disk = **2 files**: a raw source cache and the
served GLB. Everything else is shared config/data.

```
┌─ COMMITTED (scripts/warehouse/) ─────────────────────────────────────────┐
│ curated-chatt.json    which models, grouped by neighborhood (the intake) │
│ overrides-chatt.json  hand-tuning: yaw/scale/yOffset/dx/dz/exclude       │
│                       (produced by the viewer's Edit mode → Export)      │
└───────────────────────────────────────────────────────────────────────────┘
┌─ LOCAL-ONLY (sites/_warehouse/, gitignored) ─────────────────────────────┐
│ inventory.json        Warehouse metadata: location, binaries, downloads, │
│                       reviewCount, averageRating, thumbnail URL          │
│ raw/<slug>.glb        stage-1 source cache (re-crank input)              │
│ report.json           stage-2 before/after stats (feeds the budget gate) │
│ qc.html               generated contact sheet (warehouse:qc)             │
└───────────────────────────────────────────────────────────────────────────┘
┌─ SERVED, LOCAL-ONLY (public/twins/<site>/models/, gitignored) ───────────┐
│ <slug>.glb            stage-2 output — written DIRECTLY (no copy hop)    │
│ models.json           stage-3 output — the runtime descriptor            │
└───────────────────────────────────────────────────────────────────────────┘
```

## The crank

```bash
docker compose exec scripthammer pnpm run warehouse:sync        # all 3 stages
```

| Stage                     | Command                                                  | Input → Output                                                                                                                                                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Inventory (occasional) | `pnpm warehouse:inventory`                               | Warehouse API → `inventory.json` (metadata only, ≤1 req/s, ratings for reviewed in-box models)                                                                                                                                                                                                            |
| 1. Fetch                  | `tsx scripts/warehouse/fetch-glbs.ts`                    | curated ids + inventory → `raw/<slug>.glb` (public render-server GLBs; resumable)                                                                                                                                                                                                                         |
| 2. Abstract               | `node scripts/warehouse/abstract-glb.mjs [--site chatt]` | `raw/` → **served** `public/twins/<site>/models/<slug>.glb` + `report.json`. The "sampling" pass: drop edge-lines, textures → dominant-color matte, dedup→palette→flatten→join→weld→simplify, 3 LOD nodes, meshopt. Freshness-skips unchanged models; `--force` reprocesses; `--only <slug>` targets one. |
| 3. Emit                   | `tsx scripts/warehouse/emit-models.ts [--site chatt]`    | curated + overrides + inventory → `models.json` (ENU projection through the site's `vectorOffsetM`, overrides merge, ratings/provenance passthrough). Sweeps served GLBs not in the list.                                                                                                                 |

Adding a building later: add its id to `curated-chatt.json` → `warehouse:sync`.

## Hand-tuning loop (the Edit mode)

1. Open the twin, toggle **Edit** in the dock (or `?edit`), click a building.
2. Adjust: panel buttons or `[` `]` yaw · `-` `=` height · arrows nudge.
   Edits apply live and persist in `localStorage['twin-edit:<site>']`.
3. **Export JSON** → paste into `scripts/warehouse/overrides-chatt.json` →
   commit → re-run stage 3 (`emit`) → **Clear local** in the panel.
   Tuning now survives every pipeline re-run.

`exclude: true` in an override drops the model at emit (and its served GLB is
swept). The budget gate (`scripts/warehouse/__tests__/budget.test.ts`) only
counts what ships.

## Quality control

`pnpm warehouse:qc` regenerates `sites/_warehouse/qc.html`: a card grid of
every emitted model — the Warehouse's own thumbnail, title, creator,
★rating (reviewCount), downloads, our post-abstraction stats, links to the
Warehouse page and to the viewer (`/chatt/?edit&select=<slug>` deep-link) —
with per-card **Exclude** checkboxes that build paste-ready overrides JSON.

## Relation to the other 3D pipelines (deliberately separate, for now)

- **Bake** (`scripts/bake/`) — terrain/drape/streets/extruded buildings from
  open geodata. The warehouse pipeline reuses its `createProjection`.
- **House** (`scripts/house/convert-scan.mjs`) — the #234 premium LiDAR
  as-built path (privacy-gated). Unifying its conventions with this pipeline
  is a known backlog item, not an accident.

## Licensing posture

3D Warehouse General Model License: use-in-project OK, redistribution of the
model files is restricted. Default: GLBs stay local-only (gitignored).
Publishing is a deliberate per-site decision — **chatt's sampled city is
published (2026-07-10, owner decision)**: the served GLBs are heavily
transformative abstractions (154:1 reduction, photo textures replaced by
sampled flat colors), and every `models.json` entry carries creator + source
URL, surfaced in the viewer's Directory as the attribution page. Raw source
GLBs (`sites/_warehouse/raw/`) are never committed.
