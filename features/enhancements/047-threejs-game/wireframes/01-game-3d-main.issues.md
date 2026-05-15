# Issues: 01-game-3d-main.svg

**Feature:** 047-threejs-game
**SVG:** 01-game-3d-main.svg
**Last Review:** 2026-05-15
**Validator:** v5.0

---

## Summary

| Status   | Count |
| -------- | ----- |
| Open     | 0     |
| Resolved | 3     |

---

## Resolved Issues (2026-05-15 Review)

### Signature

| ID   | Issue                                                                                                                    | Code          | Classification | Resolution                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | ------------- | -------------- | ---------------------------------------------------------------------------------------- |
| X-01 | Signature must be left-aligned at x=40, got x=960                                                                        | SIGNATURE-003 | PATCH          | Moved signature `<text>` from `x="960" text-anchor="middle"` to `x="40"` (left-aligned). |
| X-02 | Signature must NOT use `text-anchor="middle"` — use left-alignment at x=40                                               | SIGNATURE-003 | PATCH          | Removed `text-anchor="middle"` from signature.                                           |
| X-03 | Signature format wrong: `'047:01 \| Three.js Game - Main \| SpecKit'` — must be `NNN:NN \| Feature Name \| ScriptHammer` | SIGNATURE-004 | PATCH          | Renamed trailing token `SpecKit` → `ScriptHammer` per project signature convention.      |

---

## Notes

- All issues classified as PATCH per `features/CLAUDE.md` decision table (cosmetic/positional, not layout/spacing).
- Validator re-run after patches: **PASS** (zero errors).
- Auto-generated initially by validator v5.0; manually annotated with resolutions by `/speckit.wireframe.review` (2026-05-15).
