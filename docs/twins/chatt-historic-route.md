# Chatt twin: the route through the backlog

**Epic:** #1289 · **Plan:** [chatt-historic-rebuild.md](chatt-historic-rebuild.md) · **Backlog:** [chatt-historic-backlog.md](chatt-historic-backlog.md) · **Written:** 2026-09-24

The Car Barns (#1290) went through every stage:

- dossier;
- LiDAR shell;
- scaffold;
- blind-annotated photo cameras;
- three rounds of blind review;
- camera-matched SketchUp scenes the owner accepted (waypoint `spawn-CB-A`).

That depth suits a demolished landmark. Repeating it for 215 buildings would cost too many tokens and too much of the owner's time, and detail everywhere would slow the city game.

So the route first **stakes every Warehouse slot**, cheaply and in batches: the measured footprint, the heights and the photo list. Detail goes only where a visitor will see it.

## Passes

Each building takes the passes its evidence and importance call for.

| Pass                        | What it produces                                                                                                                                                                                                  | Cost                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **1. Stake**                | A site in ada-stair-generator: `site.json`; `lidar_measure.json` (footprint, rotation, grade, eave, parapet and ridge heights); `sources.json`; and a SketchUp scaffold, like the Car Barns' `cb001-scaffold.skp` | Scripted from the public LiDAR, several per session    |
| **2. Photos**               | Every photo found, entered in `sources.json` with its licence use. For standing buildings, the owner's own photos, which are the best source because geometry may be derived from them                            | One research pass per block; one photo walk per street |
| **3. Photo-matched scenes** | The archival stage A0-A9 in ada's `docs/house/ARCHIVAL-PHOTOS-RUNBOOK.md`: solved cameras and camera-matched SketchUp scenes                                                                                      | The expensive pass. Only where it pays                 |
| **4. Owner model**          | The building, modelled by hand over the scaffold                                                                                                                                                                  | Owner's time                                           |
| **5. Into the twin**        | GLB with LODs; the Warehouse slot excluded; credits                                                                                                                                                               | Scripted, after the prerequisites below                |

Which passes each kind of building gets:

- **Demolished (13):** all five. Their photos are the only evidence, so pass 3 is how they get their shapes.
- **Tier A, standing:** 1, 2, 4 and 5. Add pass 3 when the owner wants photo-matched detail on a particular landmark.
- **Tiers B-D:** 1, a light 2, 4 and 5. Tier D can be modelled from the stake alone, at massing level.

## The detail budget: keeping the city game fast

The twin already enforces a budget (`scripts/warehouse/__tests__/budget.test.ts`, #259). Owner models must fit it.

| Ceiling             | Per building | Whole set   |
| ------------------- | ------------ | ----------- |
| LOD0 triangles      | 24,000       | —           |
| LOD2 triangles      | —            | **150,000** |
| File size           | 3 MB         | 15 MB       |
| Materials, textures | 8, 2         | —           |

The runtime switches each model's LOD0, LOD1 and LOD2 by distance. At city distance everything renders at LOD2, and a building goes past LOD2 only within about 150 m of the camera. So:

- **Detail belongs in LOD0.** It costs frame time only near the camera, and a detailed Car Barns does not slow the rest of the city.
- **LOD2 is the city.** 150,000 triangles over about 130 slots averages about 1,150 per slot at LOD2. A landmark can take more if a tier D block takes less.
- **The authored path needs an LOD step (one-time prerequisite).** Warehouse GLBs get LOD0, LOD1 and LOD2 from `scripts/warehouse/abstract-glb.mjs` (meshopt). `scripts/house/convert-scan.mjs`, the authored path, makes no LODs. Owner models must go through the same step. This joins the authored-source prerequisites on #1290.
- **Model to 24,000, not past it.** That is plenty for a brick block. Truss bridges are where it runs out, so draw truss members as simple boxes, not riveted shapes.

## The order

1. **Car Barns (#1290).** The scenes are done and accepted. The owner models it from `cb004-archival.skp`.
2. **Next: the four river bridges**, from the week of 2026-09-28 ([below](#the-four-river-bridges)).
3. **The rest of the Car Barns block** (backlog ranks 2, 3, 5 and 6). Photograph the standing 1907 Hunt trolley barn before its Mast General Store renovation; the office wing and the 1926 garage are demolished.
4. **Stake the rest of tier A** in batches of five to ten, by distance from the spawn. Plan one photo walk per street for the standing ones. Then do B, C and D the same way.
5. **Detail passes** (pass 3) later, one landmark at a time, as tokens allow.

**Open one issue per job when it is started** (epic rule). The four bridges are one job and one issue.

## The four river bridges

**Why they come next:**

- **They clear four Warehouse slots in one job.** All four are `model-later` in the backlog's _Not buildings_ table.
- **They are the city's silhouette** from the river and from the atlas.
- **All four are standing**, so the owner's own photographs are a derive-grade source.
- **Public-domain dimensions already exist for all four.**
- **They are close.** Their centres lie about 0.5-0.8 km from the spawn, Market Street nearest.

| Bridge                          | Slot                               | Built                                                        | Length  | Longest span      | Deck width | Structure                                         | Public-domain source                                                                                                            |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------ | ------- | ----------------- | ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Walnut Street                   | `walnut-street-bridge`             | 1889-91                                                      | —       | —                 | —          | Six camelback through trusses and an iron viaduct | HAER TN-11: 39 data pages, [LoC tn0195](https://www.loc.gov/pictures/collection/hh/item/tn0195/). Pedestrian, so not in the NBI |
| Market Street (Chief John Ross) | `market-street-bridge-chattanooga` | 1917; rehabilitated 2007                                     | 609.6 m | 109.4 m (bascule) | 17.1 m     | Steel bascule, 1 main and 16 approach spans       | NBI structure 33SR0080007                                                                                                       |
| P.R. Olgiati (US 27)            | `the-olgiati-bridge`               | 1955 per the NBI (the backlog says 1959); rehabilitated 2003 | 836.7 m | 114.3 m           | 46.2 m     | Steel continuous girder-floorbeam, 15 + 2 spans   | NBI structure 33FA0271001                                                                                                       |
| Veterans                        | `veterans-bridge`                  | 1984                                                         | 797.9 m | 128.0 m           | 28.3 m     | Steel continuous stringer, 5 + 8 spans            | NBI structure 33035460001                                                                                                       |

The NBI figures are FHWA's National Bridge Inventory, 2025 Tennessee file, read 2026-09-24. Federal data is public domain, so these are geometry you may derive from.

The LoC's HAER record holds data pages only: a written history and description, plus unprocessed field notes (FN-4). It has no drawings or photographs. Its dimensions still count as derive-grade.

Walnut Street (NRHP 90000300) and Market Street (NRHP 10001047) are listed. Any photos in their nominations are **measure-only**, as for the Car Barns.

**Staking a bridge** means reading these from USGS 3DEP B25 LiDAR:

- the deck centreline and its elevation profile;
- the pier positions;
- the truss top chords (Walnut Street);
- the bascule towers (Market Street).

The research archive holds one B25 tile, `16SFD540800`, fetched for the Car Barns. Check which crossings it covers, and fetch the tiles for the rest.

**Photos to take**, because standing bridges are the one case where the owner's own camera beats the archive:

- each bridge from both banks;
- one photo along each pier line;
- Walnut Street from its deck.

Google imagery stays out, as everywhere.

**Settle when starting:**

- **Olgiati's construction year.** The NBI says 1955 and the backlog says 1959 (widened twice).
- **The era.** Present day is recommended for all four, because they stand and the twin shows the present city around them.
- **Market Street's bascule.** Recommended: model the leaves closed.

## Next-week primer

Paste this at the start of the bridges session:

Read docs/twins/chatt-historic-route.md in ScriptHammer, then the plan and its licence rules in docs/twins/chatt-historic-rebuild.md. This session starts the four river bridges: Walnut Street, Market Street, Olgiati and Veterans. Open one issue under epic #1289 for the four as one job.

Stake each bridge as a site in the private ada-stair-generator repo. Work in a git worktree off origin/main, never in the primary checkout, because another session uses it. Fetch the USGS 3DEP B25 LiDAR tiles over the river crossings; the research archive holds only 16SFD540800. Measure each bridge's deck centreline and elevation profile, its pier positions, Walnut Street's truss top chords and Market Street's bascule towers. Write site.json, lidar_measure.json and sources.json for each.

Take dimensions from the public-domain HAER TN-11 data pages for Walnut Street, and from the National Bridge Inventory for the other three (structures 33SR0080007, 33FA0271001 and 33035460001).

List every photo found with its licence use. Keep Google imagery out. Never put my name or email in any web request or user agent.

Build a SketchUp scaffold for each bridge within the 24,000-triangle LOD0 budget. Then tell me which photos I should take myself, and from where.
