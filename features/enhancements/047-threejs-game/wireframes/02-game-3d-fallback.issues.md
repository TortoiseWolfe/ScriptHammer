# Issues: 02-game-3d-fallback.svg

**Feature:** 047-threejs-game
**SVG:** 02-game-3d-fallback.svg
**Last Review:** 2026-05-16 (post-regen)
**Validator:** v5.0

---

## Summary

| Status   | Count                          |
| -------- | ------------------------------ |
| Open     | 0                              |
| Resolved | All initial + regen iterations |

---

## Regeneration history

### 2026-05-16 — Brand-asset symbol-based regeneration

The hand-drawn "hammer + anvil silhouette" composition was replaced with the same three canonical brand SVG symbols used by the main wireframe (`#brand-printing-mallet`, `#brand-cog`, `#brand-script-tags`), wrapped in a parent group with `opacity="0.5"` to read as "off / unavailable".

Composition matches `src/components/atomic/SpinningLogo/LayeredScriptHammerLogo.tsx` layering rules (mallet BACK, cog MIDDLE, brackets FRONT) at a smaller scale (240×240 desktop cog, 116×116 mobile).

The earlier "diagonal stripe over headline" cue was dropped — the group opacity alone communicates "unavailable."

### 2026-05-15 — Initial review (pre-regen)

9 patch-classified issues resolved on the original hammer+anvil silhouette composition: callout positioning to avoid Retry-button overlap, callout count parity with annotation groups, US-badge minimum for annotation panel, signature alignment, and one XML hygiene fix.

---

## Notes

- Validator status: PASS (0 errors) at every recorded final review.
- All Pa11y-auditable DOM (headline, body copy, Retry button) preserved in the fallback panel below the silhouette.
