# Issues: 01-pricing.svg

**Feature:** 050-commerce-catalog
**SVG:** 01-pricing.svg
**Last Review:** 2026-08-06
**Validator:** v5.x

---

## Summary

| Status   | Count |
| -------- | ----- |
| Open     | 0     |
| Resolved | 2     |

**Status: PASS** — validator PASS (0 errors).

---

## Patch history

### 2026-08-06 — first authoring pass

| #   | Check       | Issue                                                                  | Resolution                                                                            |
| --- | ----------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | COLL-001    | Desktop callout 4 at cy=596 put its lower edge at exactly 610, the cap | Moved to cy=580 (lower edge 594), still adjacent to the booking CTA                   |
| 2   | CALLOUT-003 | Mobile callout 1 at (180,144) sat inside the lane-toggle active tab    | Moved all three mobile callouts to the right gutter at cx=332, clear of every control |

Both were PATCH-class: the callouts moved, no layout was restructured.

The mobile relocation is worth keeping in mind for the other four screens — a mobile
viewport is only 360 wide, so a centred callout lands on top of a full-width control almost
every time. The right gutter at cx=332 clears anything ending at x<=321.

---

## Notes

- Machine validation: `python3 .specify/extensions/wireframe/scripts/validate.py 01-pricing.svg` — PASS, 0 errors.
- This file was authored first deliberately and driven to a clean run before the other four
  were written, so the 37 rules were learned once rather than debugged five times at once.
