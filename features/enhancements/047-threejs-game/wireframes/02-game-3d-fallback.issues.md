# Issues: 02-game-3d-fallback.svg

**Feature:** 047-threejs-game
**SVG:** 02-game-3d-fallback.svg
**Last Review:** 2026-05-15
**Validator:** v5.0

---

## Summary

| Status   | Count |
| -------- | ----- |
| Open     | 0     |
| Resolved | 9     |

---

## Resolved Issues (2026-05-15 Review)

### Callout positioning

| ID   | Issue                                                                         | Code        | Classification | Resolution                                                                                             |
| ---- | ----------------------------------------------------------------------------- | ----------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| X-01 | Callout at cy=620 too close to desktop footer (y=640) — move up               | COLL-001    | PATCH          | Moved callout 3 from (1056,620) to (1180,568) — pushed up to status-bar level, away from footer.       |
| X-02 | Callout at (640,524) overlaps button at (540,502) — place after (right/below) | CALLOUT-003 | PATCH          | Moved callout 2 from (640,524) to (770,524) — now sits to the right of the desktop Retry button.       |
| X-03 | Callout at (180,506) overlaps button at (80,484) — place after (right/below)  | CALLOUT-003 | PATCH          | Moved mobile callout 2 from (180,506) to (304,506) — now sits to the right of the mobile Retry button. |

### Callout count vs annotation count

| ID   | Issue                                                                                   | Code        | Classification | Resolution                                                                                                        |
| ---- | --------------------------------------------------------------------------------------- | ----------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| X-04 | Mockup missing 1 callout circles (annotation has 6 concepts, mockup only illustrates 5) | CALLOUT-002 | PATCH          | Added callouts 4, 5, 6 on desktop mockup at distinct concept locations (silhouette context, body copy, headline). |

### User Story badge minimum

| ID   | Issue                                                         | Code   | Classification | Resolution                                                                                                                                           |
| ---- | ------------------------------------------------------------- | ------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| X-05 | Only 1 User Story badges found — need at least 3 User Stories | US-002 | PATCH          | Added US badges to annotation groups 4, 5, 6 (US-001 — fallback as degraded visit path; US-004 — Pa11y baseline; US-002 — visual theme consistency). |

### Signature

| ID   | Issue                                                                      | Code          | Classification | Resolution                                                                |
| ---- | -------------------------------------------------------------------------- | ------------- | -------------- | ------------------------------------------------------------------------- |
| X-06 | Signature must be left-aligned at x=40, got x=960                          | SIGNATURE-003 | PATCH          | Moved signature `<text>` from `x="960" text-anchor="middle"` to `x="40"`. |
| X-07 | Signature must NOT use `text-anchor="middle"` — use left-alignment at x=40 | SIGNATURE-003 | PATCH          | Removed `text-anchor="middle"`.                                           |
| X-08 | Signature format wrong: `'047:02 \| Three.js Game - Fallback \| SpecKit'`  | SIGNATURE-004 | PATCH          | Renamed trailing token `SpecKit` → `ScriptHammer`.                        |

### XML hygiene (regression introduced + fixed in same session)

| ID   | Issue                                       | Code    | Classification | Resolution                                                                                                                           |
| ---- | ------------------------------------------- | ------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| X-09 | Attribute 'x' has unquoted value '80..280,' | XML-004 | PATCH          | Validator's regex parsed an XML comment containing `at x=80..280, y=...` as an attribute. Reworded the comment to drop the literals. |

---

## Notes

- All 9 issues classified as PATCH per `features/CLAUDE.md` decision table (cosmetic/positional/comment-text — no layout overlaps, no spacing, no missing sections requiring REGEN).
- Validator re-run after patches: **PASS** (zero errors).
- Auto-generated initially by validator v5.0; manually annotated with resolutions by `/speckit.wireframe.review` (2026-05-15).
