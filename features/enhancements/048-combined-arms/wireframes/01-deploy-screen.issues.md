# Issues: 01-deploy-screen.svg

**Feature:** 048-combined-arms
**SVG:** 01-deploy-screen.svg
**Last Review:** 2026-07-09 (post-regen re-review)
**Validator:** v5.x

---

## Summary

| Status   | Count                                         |
| -------- | --------------------------------------------- |
| Open     | 0                                             |
| Resolved | 13 (5 G-015 + 7 AI-review + 1 COLL-001 regen) |

**Status: PASS** — validator PASS (0 errors) and adversarial re-review confirmed every finding resolved with no regressions.

---

## Regeneration history

### 2026-07-09 — Second regeneration (AI review pass, adversarially verified)

7 findings from the AI review gate (machine validator passed but did not govern these), each confirmed by an independent adversarial verification agent (0 refuted), all resolved by full regeneration:

| #   | Check   | Issue                                                                                                                                                           | Resolution                                                                                                                                       |
| --- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | VIS-005 | Combat-denial state absent — spec (UI Mockup contract + SQ-4 Clarification + US2 AC3) requires BOTH denial variants: visible countdown AND opaque "unavailable" | Spawn list rebuilt to 6 rows: rows 4/5 depict "Squad leader - spawn in 0:05" (VAR A, countdown) and "Squad leader - unavailable" (VAR B, opaque) |
| 2   | COV-001 | Required anchor SQ-2 badged nowhere                                                                                                                             | Group 2 rebuilt as "Leader spawn + denial" with US-002 / SQ-2 / SQ-4 / CQ-5 chips at 62px pitch                                                  |
| 3   | VIS-002 | CQ-5/SQ-4 chips overlapped 2px; narrow chips centered labels at x=24 instead of 28                                                                              | All chips rebuilt on 62px pitch; every 56-wide chip label at x=28                                                                                |
| 4   | VIS-007 | Callout 4 (class row) sat on the DEPLOY button face                                                                                                             | Callout 4 moved to (970,595) beside the class row (COLL-001-compliant)                                                                           |
| 5   | STR-010 | "Mobile parity" group led with no US badge                                                                                                                      | US-002 badge added (also mirrored to 02/03 note groups for set consistency)                                                                      |
| 6   | VIS-001 | Cross-SVG: enemy-held flag B was grey (#9ca3af), aliasing neutral; 02/03 legend is blue/orange/grey by owner                                                    | Flag B now #ea580c on desktop + mobile; group 1 annotation restated as the owner-color legend ("green ring = spawnable" replaces "enemy greyed") |
| 7   | STR-009 | Cross-SVG: SQ-4 chip was #ea580c (VC-family color); SQ-family chips are #2563eb in 02/03                                                                        | SQ-4 chip now #2563eb                                                                                                                            |

During regeneration the machine validator flagged one placement (COLL-001: callout 4 at cy=610/600 within 30px of the desktop footer at y=640); fixed at cy=595. Post-regen adversarial re-review: all 7 resolved, no new issues.

### 2026-07-09 — First regeneration (validator v5.0 initial review)

5 G-015 findings: toggle-pattern rects with wrong fills (#2563eb ×4, #ea580c ×1; toggles must be #6b7280 OFF or #22c55e ON), classified REGENERATE. Resolved same day — requirement-tag chips restyled so they no longer match the validator's toggle heuristic; validator PASS thereafter.

---

## Notes

- Machine validation: `python3 .specify/extensions/wireframe/scripts/validate.py <svg>` — PASS, 0 errors at final review.
- Desktop depicts both SQ-4 denial variants; the mobile pane and map leader icon depict the healthy SQ-2 path, so all three leader-spawn states are covered in one wireframe.
