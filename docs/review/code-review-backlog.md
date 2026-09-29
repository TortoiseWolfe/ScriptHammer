# Whole-repo code review backlog

Started 2026-09-29. Findings from a tiered read-only review of the whole repo, sorted by
severity (P0 first). This is a working backlog, not the record: per CLAUDE.md, a finding
that is going to be fixed gets an **issue**, and the issue body becomes the source of truth.
When an item is filed, put the issue number in its heading; when it is fixed, delete the row.

| Severity | Meaning                                                            |
| -------- | ------------------------------------------------------------------ |
| P0       | Security hole, data loss, auth bypass, money                       |
| P1       | User-facing bug on a real path, or a check that hides real failure |
| P2       | Latent bug, edge case, wrong under some configuration              |
| P3       | Minor / robustness                                                 |

"Confirmed" means the reviewer traced the failure path in code. "Plausible" means the
defect is real in the code but exploitability or impact depends on something the reviewer
could not see (deployed config, live data).

## Coverage

| Tier | Scope                                          | Status  |
| ---- | ---------------------------------------------- | ------- |
| 1    | `supabase/`                                    | pending |
| 2    | `src/lib`                                      | pending |
| 2    | `src/services`, `src/contexts`                 | pending |
| 3    | `src/hooks`, `src/utils`, `src/app`            | pending |
| 4    | `src/world`, `src/twin`, `src/stage` + assets  | pending |
| 5    | `src/components` (payment, auth, forms, …)     | pending |
| 5    | `src/components` (everything else)             | pending |
| 6    | `scripts/`, `.github/workflows/`               | pending |
| 6    | `tests/`, `src/tests/`                         | pending |

## Backlog

### P2 — City renders full-detail models at every distance; route doc budgets as if it didn't

- **Where:** `src/world/WarehouseModels.tsx:216-222`, `docs/twins/chatt-historic-route.md:44`
- **Defect:** The renderer always mounts `lods[0]` and its comment says distance LOD
  switching was removed. The route doc says LOD0 is only drawn near the camera and LOD2
  city-wide, so it concludes detail only costs frame time near the camera.
- **Failure scenario:** Landmarks and truss bridges built up to the 24k-triangle LOD0 cap
  are all drawn at full detail across the whole city; the 150k city-wide cap no longer
  bounds what is actually drawn and the game's frame rate drops.
- **Fix:** Either restore distance LOD switching before the route is built out, or rewrite
  the doc's budget against LOD0 totals.
- **Confidence:** confirmed
- **Source:** `/code-review` of #1304
