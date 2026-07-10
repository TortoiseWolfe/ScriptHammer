# Issues: 02-squad-hud.svg

**Feature:** 048-combined-arms
**SVG:** 02-squad-hud.svg
**Last Review:** 2026-07-09 (post-patch re-review)
**Validator:** v5.x

---

## Summary

| Status   | Count                             |
| -------- | --------------------------------- |
| Open     | 0                                 |
| Resolved | 5 (4 AI-review + 1 re-review nit) |

**Status: PASS** — validator PASS (0 errors) and adversarial re-review confirmed every finding resolved.

---

## Patch history

### 2026-07-09 — AI review pass (adversarially verified, 0 refuted)

| #   | Check   | Issue                                                                                    | Resolution                                                                                                                                  |
| --- | ------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | COV-VC4 | Above-head half of VC-4 not depicted (roster dots only)                                  | Teammate silhouette with green above-head name tag + speaking dot added to the desktop viewport (900,240) and mobile viewport (196,216)     |
| 2   | COV-CQ2 | Capture meters drawn as unidirectional 0..100 bars; CQ-2 mandates −100…+100 two-stage    | Both meters gained a center-zero tick and −100 / 0 / +100 labels inside their panels; group 5 annotation now states the two-stage semantics |
| 3   | COV-001 | US badges paired with wrong stories (G1 US-001, G3 US-003, G4 US-002, G5 US-003)         | Swapped to G1→US-002, G3→US-001, G4→US-003, G5→US-001 (anchor set unchanged)                                                                |
| 4   | VIS-007 | Callout 4 (PTT) sat 24px from the capture meter but 51px from the PTT chips it annotates | Moved to (360,520), directly above the COMMAND chip, clear of roster slot 6                                                                 |

Re-review found one regression from fix 1: the mobile speaking dot (cx=46) clipped the final glyph of "TreeLine" by ~5px — moved to cx=56 (desktop-matching gap). Re-validated PASS.

Set-consistency addition (from 01's STR-010 finding): the "Mobile HUD parity" note group now leads with a US-002 badge, matching the other two files.

---

## Notes

- Machine validation: PASS, 0 errors at final review.
