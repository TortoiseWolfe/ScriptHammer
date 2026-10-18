# Chattanooga twin: the most accurate version we can build for free, and what a budget would add

Written 2026-10-17 for #256, #257 and #292. Research and ranking only: nothing in
`src/` or `scripts/` changed. Counts come from `public/twins/chatt/buildings-wide.json`
and `manifest.json` on `main` at `a771352f`. External facts were fetched on the same
day; anything not confirmed is marked **unverified**.

The brief: the most accurate real-world twin possible with no budget, and a written
route for improving it later when there is one.

## 1. What is measured and what is guessed today

The default view (`/chatt`) renders 13,877 buildings. How each height was obtained:

| Height rule | Buildings | Share | What it is                                         |
| ----------- | --------: | ----: | -------------------------------------------------- |
| `lidar`     |     1,335 |  9.6% | **Measured.** USGS 3DEP first-return p90 minus DTM |
| `height`    |       146 |  1.1% | Tagged in OSM by a person (asserted, not measured) |
| `levels`    |       503 |  3.6% | Derived: floor count x 3.2 m                       |
| `ms`        |        43 |  0.3% | Microsoft ML estimate                              |
| `fallback`  |    11,850 | 85.4% | **Guessed** from building type and footprint area  |

Only 1,521 buildings (the baked corridor, 35.0078..35.06 N, -85.316..-85.300 W) went
through the lidar stage. The other 12,356 resolve from OSM tags only. So the guess is
not for lack of data: the lidar covers the whole atlas box, and the stage was simply
never run beyond the corridor.

Everything else in the scene:

| Layer             | Today                                                                           | Status                                         |
| ----------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| Terrain           | USGS 3DEP 1 m DEM, baked (`terrain-wide.json` for the atlas box)                | Measured                                       |
| Footprints        | OpenStreetMap (volunteer-mapped; about 85% of downtown has only `building=yes`) | Mapped, not surveyed                           |
| Imagery           | Esri World Imagery in the atlas; TDOT aerial drape in the corridor              | Real photos, third-party terms (see section 4) |
| Roofs, facades    | None. Flat-capped extruded prisms, one colour                                   | Not modelled (#331 and #257 own this)          |
| Trees, street kit | None                                                                            | Not modelled                                   |

The atlas colours by provenance (`src/twin/cesium/buildings.ts`), which is the one
thing Google's photoreal mesh cannot do. Any plan below should keep that: more
buildings turn from red (`fallback`) to blue (`lidar`), and the page says so honestly.

## 2. Free and open sources, researched

Atlas box: lon -85.3451..-85.2545, lat 35.0075..35.0783, about 8.3 x 7.9 km
(65 km2, about 25 square miles).

### Height and terrain: USGS 3DEP lidar (public domain)

The National Map Access API (`tnmaccess.nationalmap.gov`) lists three point-cloud
collections over the atlas box:

| Collection               | Acquired / published                          | Tiles over box | Access                                                                                               | Covers our 13,877 buildings |
| ------------------------ | --------------------------------------------- | -------------: | ---------------------------------------------------------------------------------------------------- | --------------------------: |
| `TN_27County_blk4_2015`  | 2015, published 2018                          |             31 | **EPT on S3** (already pinned in `sites/chatt.json`)                                                 |              13,825 (99.6%) |
| `TN_HAMILTONCOUNTY_2011` | 2011 (QA report: 31 Mar 2011), published 2014 |             36 | LAZ tiles                                                                                            |               13,877 (100%) |
| `TN_HamiltonCounty_B25`  | **8-9 Apr 2025**, published 16 Apr 2026       |    88 (7.4 GB) | LAZ tiles; **not on the EPT bucket** (listed `USGS_LPC_TN_*` prefixes have no Hamilton County entry) |               13,877 (100%) |

- Licence: US Government work, no restrictions beyond the USGS credit line.
  The metadata "use constraints" text asks for acknowledgement of USGS as source.
- Accuracy: the 3DEP base specification sets QL2 as the floor: 2 pts/m2, 10 cm
  RMSEz (non-vegetated). QL1 is 8 pts/m2 at the same 10 cm RMSEz
  ([USGS quality levels](https://www.usgs.gov/3d-elevation-program/topographic-data-quality-levels-qls)).
  The 2015 block belongs to the 2015-16 Woolpert 3DEP programme, reported as QL2 across
  49 East Tennessee counties
  ([TN GIS news](https://www.tn.gov/finance/gis-resources-news-events-gis-news-woolpert-conducts-usgs-lidar-projects-in.html));
  that `blk4` is QL2 specifically is **unverified**, so confirm it from the project report.
  The quality level of `B25` is **unverified**: its tile XML does not state it, and the
  [FY25 3DEP list](https://www.usgs.gov/3d-national-topography-model/fy25-3dep-data-collaboration-announcement-dca-selected-projects)
  has a Tennessee Hamilton County entry whose level is ambiguous in the text. Read it from
  the project report in the first step of the follow-up issue.
- Height error is not the 10 cm ground figure. The rule is first-return p90 minus DTM,
  so tree overhang and rooftop plant bias it upward and a 2015 collection misses
  anything built or demolished since. Measure it, don't assume it (see the issue).
- A newer 1 m DEM from `TN_HamiltonCounty_B25` was published 2026-04-29 (TNM API,
  `Digital Elevation Model (DEM) 1 meter`), while the baked terrain uses the 2015 one.

### Footprints and heights: Overture Maps, Microsoft, OSM

- **Overture Maps buildings**, release `2026-09-23.0`. Merges OSM, Esri Community Maps,
  Microsoft GlobalMLBuildingFootprints, Google Open Buildings and others. Published under
  **ODbL** because it contains OSM ([guide](https://docs.overturemaps.org/guides/buildings)).
  Overture's 2023 pre-release published heights for over six million US buildings
  estimated from 3DEP lidar
  ([LIDAR News](https://lidarnews.com/overture-maps-foundation-pre-releases-map-dataset/)),
  the same method as ours. **Chattanooga height coverage in the current release is
  unmeasured** (no DuckDB available on the lane host; the Docker credential helper
  failed). Value: an independent cross-check on our lidar numbers, not a better source.
- **Microsoft US Building Footprints**, ODbL, Tennessee included (3,212,306 buildings).
  Already in the pipeline as `ms` (43 buildings), via `scripts/bake/fetch-ms-heights.ts`.
  The repo documents no height attribute beyond what that stage reads.
  ([repo](https://github.com/microsoft/USBuildingFootprints))
- **OpenStreetMap**: ODbL. Already the footprint source. Contributing `building:levels`
  and `height` back is the slow, permanent route and the one the twin already advertises.
- **ODbL obligation to check**: Overture and Microsoft derived data carry share-alike
  attribution. Nothing is adopted in this change; the follow-up decides it.

### City and county GIS

- Hamilton County public ArcGIS REST: `mapsdev.hamiltontn.gov/hcwa03/rest/services`.
  Listed 50 services (parcels, zoning, addressing, FEMA, assessor annotation, water). **No
  building footprint or height layer is among them.** `Live_Assessor` and
  `Live_RealProperty` hold parcel/appraisal attributes; whether they carry year-built or
  stories is **unverified**, and bulk-use terms are **unverified**.
- ChattaData (`data.chattanooga.gov`) and the City's
  [maps and open data page](https://chattanooga.gov/stay-informed/maps-open-data): permits,
  crime, budget. Building permits could date new construction but give no heights.
- UTC GIS Lab hub (`utcgis-igtlab.hub.arcgis.com`): the city page says it holds "lidar
  data of buildings". Contents, licence and coverage **unverified**: worth one email.
- Equator Studios sells Hamilton County footprints and lidar processing
  (`gis.equatorstudios.com/tennessee_hamilton`): commercial, not free, and a resale of data
  we can already get.

### Imagery

- **NAIP** (USDA): public domain, 0.6 m, four-band, free from the National Map. Tennessee's
  latest acquisition year and GSD are **unverified**. It would replace the Esri World
  Imagery dependency noted in `build-wide-buildings.ts`, which is hit unthrottled on every
  load.
- **TDOT aerials** are already used for the corridor drape (`provenance` in the manifest).

## 3. The free path, ranked by accuracy gained per effort

Effort: S under a day, M a few days, L a week or more.

| Rank | Step                                                                                                                    | Buildings gained                                                    | Effort  | Why this rank                                                                                    |
| ---: | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
|    1 | **Run the existing lidar stage over all 13,877 footprints** (EPT 2015, already pinned), in district chunks              | **Projected 9,500-11,200 of the 11,850 `fallback` become measured** | M       | Code exists (`fetch-lidar-heights.ts`). Data is a pinned URL. The work is chunking and a budget. |
|    2 | Cross-check against Overture's lidar-derived heights; log disagreements                                                 | 0 new, but proves step 1                                            | S       | The accuracy rule: prove against something the result didn't make.                               |
|    3 | Re-measure with `B25` (2025) where 2015 disagrees with it by more than a storey, or where a building is newer than 2015 | Fixes new-build and demolished-since errors                         | L       | LAZ tiles, 7.4 GB, no EPT. `decompressLazFile` exists, but a tile walker does not.               |
|    4 | Swap baked terrain to the 2026-04-29 1 m DEM                                                                            | Terrain only                                                        | S       | Small gain; do it with step 3 since it is the same collection.                                   |
|    5 | Replace Esri World Imagery with NAIP in the atlas                                                                       | Removes a third-party dependency                                    | M       | Fidelity gain is small; value is licence safety.                                                 |
|    6 | OSM tag contributions for the remaining guesses                                                                         | Slow, permanent                                                     | ongoing | Cheap per building, but not schedulable.                                                         |
|    7 | County assessor attributes (stories, year built)                                                                        | Unknown                                                             | M-L     | **Unverified** that the data exists in bulk, licence unknown.                                    |

**Why step 1 is first, and the projection behind it.** In the corridor the same stage left
2.8% of buildings (43 of 1,510 baked) as `fallback`, and 87.8% (1,335 of 1,521) as `lidar`.
Applying a corridor rate to the wide set assumes downtown behaves like the suburbs, which
it may not: tree canopy over houses can push p90 up, and `MIN_POINTS` and `MIN_HEIGHT_M`
(10 returns, 2 m) reject some small outbuildings. That is why the figure is a range,
and why the plan starts with one pilot district before the full run. Measured share would go
from 9.6% to roughly 75-90% of all buildings.

## 4. The budget ladder

### Low budget: Google Photorealistic 3D Tiles

- **Price**: SKU "Map Tiles API: Photorealistic 3D Tiles" (C6E1-98B2-DBD0), 1,000 free
  events a month, then USD 6.00 per 1,000 up to 100,000, 5.10 to 500,000, 4.20 to
  1,000,000 ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)).
  The pricing page lists **no monthly credit** for this SKU.
- **What an "event" is**: a root tileset request, roughly one per app launch, with a
  10,000-per-day project cap (the Cesium forum's reading,
  [community.cesium.com](https://community.cesium.com/t/google-3d-tiles-cost/27625);
  Google's own pages fetched here do not state it): **unverified** against Google.
  Worked example under that reading: 10,000 sessions a month costs (10,000 - 1,000) / 1,000
  x USD 6 = **USD 54**; 100,000 sessions about USD 594.
- **Coverage over Chattanooga: unverified.** Google offers only an interactive coverage
  search, no downloadable extent. #257 already holds the check (search the lat/lon, or
  enable the API and walk `root.json`). Do it before spending anything else.
- **Terms that shape the design**
  ([policies](https://developers.google.com/maps/documentation/tile/policies)):
  visualization only; no caching or pre-fetching; objects "can't be extracted, traced, or
  otherwise derived by hand or machine" from the tiles; Google-sourced content must be
  labelled apart from ours; Google logo and per-tile copyright must be shown. So the mesh
  can make the city look real, but it can **not** measure a height or correct a footprint.
  It sits beside the lidar-measured layer, never replaces it, and the provenance colouring
  stays.
- **Needs**: a billing account, a restricted API key shipped in the client bundle (static
  hosting), and a graceful no-key fallback per #292.

### Paid: commissioned lidar and survey

- **New aerial lidar** is the weak buy here, because 3DEP already gives QL2-or-better
  over the box, and the 2025 collection is free. Order-of-magnitude only, from older and
  regional benchmarks, not a quote: roughly USD 100-400 per square mile
  (Oregon consortium urban table USD 103.50, undated:
  [pricing table](https://oregon.gov/dogami/lidar/Documents/Lidar_Pricing_Table_Amendment_10.pdf);
  a Bay Area 2024 monitoring-plan estimate about USD 280:
  [WRMP appendix](https://www.wrmp.org/wp-content/uploads/2024/09/Monitoring-Plan-Appendix-2_Preliminary-Cost-Estimates.pdf);
  Washoe County 2017 about USD 255-370:
  [briefing](https://www.washoecounty.gov/gis/board_committees/regional_basemap/2017/files/misc/Lidar_Comparison.pdf)).
  Over about 25 square miles that is USD 2,500-10,000 before minimum fees and small-area
  premiums. It buys a newer or denser (QL1) cloud, not a new kind of data.
- **What money buys that nothing free can**:
  - Oblique-photo photogrammetry or a ground-truth survey of selected landmarks: roofs,
    eaves, facades. Cost depends on vendor and building count: **quotes needed**.
  - A **ground-truth set** for the whole project: RTK or total-station heights for about
    50 buildings, so the lidar rule's error is a measured number instead of an assumption.
    Cheap and the first thing to buy.
  - A licensed Esri or Maxar imagery basemap if the Esri World Imagery terms are found not to
    cover this use (**unverified**: not read for this document).

| Rung                                | Gets you                                       | Cost                                      | Blocker                         |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------------- | ------------------------------- |
| Free (this document)                | About 75-90% of buildings measured             | Engineering time                          | None                            |
| Ground-truth survey (~50 buildings) | A measured error figure for the lidar rule     | Quote needed                              | Choosing a surveyor             |
| Google photoreal tiles              | Looks like Google Earth, labelled and licensed | USD 0 to a few hundred a month            | Coverage check, billing account |
| New QL1 lidar                       | Newer/denser cloud                             | About USD 2,500-10,000 order of magnitude | Little gain over 2025           |
| Commissioned facade/roof survey     | Real roof forms and facades                    | Quotes needed                             | Scope and vendor                |

## 5. Next

The follow-up issue for rank 1 is #1363 (it references #256). Ranks 2-4 are listed in its
"after this" section. Nothing here is built.
