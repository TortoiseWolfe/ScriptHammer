# Issues: 02-checkout.svg

**Feature:** 050-commerce-catalog
**SVG:** 02-checkout.svg
**Last Review:** 2026-08-06
**Validator:** v5.x

---

## Summary

| Status   | Count |
| -------- | ----- |
| Open     | 0     |
| Resolved | 0     |

**Status: PASS** — validator PASS (0 errors).

---

## Patch history

### 2026-08-06 — first authoring pass

| #      | Check | Issue                              | Resolution |
| ------ | ----- | ---------------------------------- | ---------- |
| _none_ | —     | Passed on the first validator run. |

### 2026-08-06 — post-approval revision: phone field

| #   | Check  | Issue                                                                                                                                                                                        | Resolution                                                                                                                                                                                 |
| --- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | review | The intake form had no phone field, while the catalog promises every build ships with click-to-call and a form "wired to your inbox and phone" — the product could not deliver what it sells | Desktop row 1 became three columns (Email / Phone / Business, 220px each); mobile intake panel grew to three stacked fields and the blocks below it shifted up to keep clear of the footer |

The mobile change cascaded: the intake panel grew by 54px, so the uploader, order summary
and Pay button all moved and mobile callout 3 shifted from cy=348 to cy=398 to keep tracking
the uploader heading. Re-validated PASS after the move.

Raised by the owner during wireframe approval, not by the validator — the gate has no way to
know a form is missing a field the catalog copy promises. Spec FR-013 and the PRD's
`intake_data` shape were corrected in the same change, so the wireframe and the spec agree.

---

## Notes

- Machine validation: `python3 .specify/extensions/wireframe/scripts/validate.py 02-checkout.svg` — PASS, 0 errors.
- Authored against the template proven by 01-pricing.svg.
