# Issues: 03-scoreboard-tickets.svg

**Feature:** 048-combined-arms
**SVG:** 03-scoreboard-tickets.svg
**Last Review:** 2026-07-09 (post-patch re-review)
**Validator:** v5.x

---

## Summary

| Status   | Count |
| -------- | ----- |
| Open     | 0     |
| Resolved | 7     |

**Status: PASS** — validator PASS (0 errors) and adversarial re-review confirmed every finding resolved with no regressions.

---

## Patch history

### 2026-07-09 — AI review pass (adversarially verified; an 8th cross-SVG claim was refuted in verification and never logged)

| #   | Check   | Issue                                                                                           | Resolution                                                                                                                  |
| --- | ------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | COV-001 | Required anchor SC-006 badged nowhere                                                           | SC-006 chip (orange, SC family) added to group 2 at translate(404,5)                                                        |
| 2   | COV-002 | "-3 / min BLEED" contradicts CQ-4 (1 of 5 CPs held → 1 ticket/5 s = 12/min)                     | Header now "-12/min BLEED"; group 5 annotation now "OPFOR bleeds -12/min (1 ticket/5 s)…"                                   |
| 3   | COV-002 | No CQ-4 tuning numbers anywhere (300 start, 1/5 s, 1/2 s)                                       | Group 2 annotation now: "Teams start at 300. Minority hold bleeds 1/5 s; zero CPs bleeds 1/2 s. First team to zero loses."  |
| 4   | VIS-005 | Only ALPHA/CHARLIE had starred leaders; BRAVO/DELTA none; mobile list none                      | Leader stars added to BRAVO and DELTA first rows (desktop) and to ALPHA + BRAVO leader rows (mobile, names shifted x=28→48) |
| 5   | VIS-007 | Callout 1 floated at (300,60) on empty space, far from the timer/flag strip it annotates        | Moved to (478,105), beside the timer box                                                                                    |
| 6   | VIS-007 | Callout 5 floated at (1180,470) in blank panel space, ~340px from the bleed text                | Moved to (1165,78), directly above the OPFOR bleed text, clear of the header include and the text itself                    |
| 7   | VIS-002 | Cross-SVG: TreeLine/ParkBench listed under BRAVO here but are ALPHA members in 02-squad-hud.svg | BRAVO renamed to distinct players MoccasinBend / SignalMtn (desktop + mobile, consistent)                                   |

Set-consistency addition (from 01's STR-010 finding): the "Overlay behavior" note group now leads with a US-001 badge, matching the other two files.

---

## Notes

- Machine validation: PASS, 0 errors at final review.
- 03 depicts the moment after flag B flips to BLUFOR (capture toast); 01/02 depict earlier moments of the same match — ticket totals are consistent (drain-only counters), per the refuted cross-SVG claim.
