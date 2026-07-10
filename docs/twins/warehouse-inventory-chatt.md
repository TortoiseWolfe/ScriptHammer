# 3D Warehouse Inventory — Geolocated Chattanooga Models (#259)

**Generated:** 2026-07-10 · **Method:** `scripts/warehouse/inventory.mjs` (metadata-only harvest, ≤1 req/s, contact UA) · **Raw data:** `sites/_warehouse/inventory.json` — local-only (regenerate with the script; model titles/descriptions can legitimately reference streets the #234 privacy gate denylists, so the full dump is not committed)

## The real count (memory said "over a hundred")

| Measure                                                             | Count                    |
| ------------------------------------------------------------------- | ------------------------ |
| Unique models (creator ∪ text-search union)                         | **265** — all geolocated |
| Inside the greater-Chattanooga box (34.95…35.15 N, −85.42…−85.15 W) | **226**                  |
| …with an **anonymously-downloadable public GLB**, unrestricted      | **212**                  |
| By the "Chattanooga 3D" account (the 2011-era CVB downtown program) | 134 (132 in-box)         |

The remembered trove is real and slightly bigger than remembered: the dedicated **Chattanooga 3D** account (active 2011–2014) modeled downtown block-by-block ("800 Block Between Market and Broad", Hunter Museum, both Tennessee Aquarium buildings, the Marriott, Warehouse Row, 1200 Market Street…), and a second program, **Glass Street 3D** (18 models), covered the Glass Street corridor. Independent contributors (Ken 26, Connor B. 22, Museum Maker 5, Chris W. 2…) fill in landmarks like the Market Street Bridge and the Tivoli Theater.

## Condition

- **Era:** 2007-03 → 2014-12. This is the Google-Earth-era hand-modeling program; nothing newer is geolocated here. Expect SketchUp 7/8-era authoring: textured, over-detailed for real-time, pre-PBR materials.
- **Formats:** the Warehouse render server pre-generates a **`glb` binary served from `content/public/`** — anonymously downloadable, no login (verified via plain `curl`). `skp` binaries are `content/restricted/` (entitled accounts only) — **not needed**. `usdz` also public. Only 14 in-box models lack a public GLB (mostly stuck render jobs); 0 are download-restricted.
- **Weight (the optimization wall, quantified):** in-box GLBs are median **1.4 MB**, max **19.8 MB**, **~454 MB total** for all 226 — desktop-authored density that no browser scene loads raw. This is exactly what #259's abstraction/optimization pass exists to solve.
- **Licensing:** 3D Warehouse General Model License (use in projects OK; redistribution of model files restricted). Per the 2026-07-10 decision, converted GLBs stay **local-only** (gitignored twin-assets pattern); publishing is a later per-model call. Full provenance (id/author/url) is carried in the JSON.

## Top in-box models by downloads

| Model                                              | Creator        | Public GLB | Downloads     |
| -------------------------------------------------- | -------------- | ---------- | ------------- |
| Public Sculpture                                   | Museum Maker   | ✓          | 4,575         |
| "Poise" by Angela Conner                           | Chattanooga 3D | ✓          | 3,649         |
| Chattanooga Marriott (Convention Center)           | Chattanooga 3D | ✓          | 2,860         |
| The Hunter Museum of American Art (×2 variants)    | Chattanooga 3D | ✓          | 2,221 / 2,073 |
| Market Street Bridge                               | Daniel G.      | ✓          | 1,881         |
| Warehouse Row                                      | Chattanooga 3D | ✓          | 1,257         |
| Carmike Majestic 12                                | Chattanooga 3D | ✗          | 1,155         |
| Tennessee Aquarium — Ocean Journey / River Journey | Chattanooga 3D | ✓          | 1,053 / 953   |
| IMAX Chattanooga                                   | Museum Maker   | ✓          | 857           |
| 1200 Market Street                                 | Chattanooga 3D | ✓          | 801           |
| Tivoli Theater                                     | Chris W.       | ✗          | 717           |

## API notes (for the pipeline)

- Base: `https://3dwarehouse.sketchup.com/warehouse/v1.0` — internal SPA API, no official public API. Metadata endpoints answer plain HTTP with no auth.
- Search: `GET /entities?contentType=3dw&show=public&count=50&offset=N` + either `q=<text>` or `fq=creator.id==<id>` (RSQL-ish). `showBinaryMetadata=true&showAttributes=true` inlines per-binary `contentUrl`/size and legacy flags. Envelope: `{entries, total, startRow, endRow}`.
- Entity detail: `GET /entities/{id}` → `location {latitude, longitude, altitude}`, `binaries.<name>.contentUrl`.
- No spatial/bbox filter param was found (several candidates silently ignored), so the count above is a **floor**: a geolocated-in-Chattanooga model that neither mentions "chattanooga" nor belongs to the known accounts would be missed. The known city/neighborhood programs are captured; the tail can be extended later via per-model "nearby" crawling if needed.
- The front-end SPA renders no results in headless browsers (silent bot-gating) — but the API itself is indifferent; the harvest script needs no browser at all.

## Next (per the #259 plan)

Curate 10–15 in-box buildings (landmarks first, sculpture/misc excluded), fetch their **public GLBs** directly — the DAE-conversion step is demoted to a fallback for the 14 GLB-less models — then run the abstraction/optimization pass ("sampling": aggressive simplify, textures → palette materials) and place via `models[]`/ENU anchors.
