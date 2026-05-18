# Issues: 01-game-3d-main.svg

**Feature:** 047-threejs-game
**SVG:** 01-game-3d-main.svg
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

The hand-drawn "hammer + anvil + DaisyUI accent orbs" composition was replaced with the three canonical ScriptHammer brand SVGs inlined as `<symbol>` definitions in the SVG's `<defs>`, then referenced via `<use href="#brand-..."` at the correct layered positions.

Composition follows the canonical layering rules from `src/components/atomic/SpinningLogo/LayeredScriptHammerLogo.tsx`:

| Layer      | Asset                                                           | Position                               | Size relative to cog |
| ---------- | --------------------------------------------------------------- | -------------------------------------- | -------------------- |
| 1 (BACK)   | `#brand-printing-mallet` (mirrors `public/printing-mallet.svg`) | top: 58%, left: 42% (offset down-left) | 65%                  |
| 2 (MIDDLE) | `#brand-cog` (mirrors `public/scripthammer-logo.svg`)           | centered                               | 100%                 |
| 3 (FRONT)  | `#brand-script-tags` (mirrors `public/script-tags.svg`)         | centered                               | 68%                  |

Geometry data copied verbatim from the canonical brand SVGs. Solid silver fill (`#c0c0c0`) substitutes the source's metallic gradients (which aren't perceptible at wireframe scale and would have caused id-collision overhead).

**File structure note**: the wireframe uses two `<defs>` blocks. The first holds the small gradient defs. The background `<rect>` + centered title `<text>` + section labels then follow, ensuring those structural elements land within the validator's 2000-char G-024/SECTION-001 scan window. A second `<defs>` block holds the large brand symbol defs.

### 2026-05-15 — Initial review (pre-regen)

3 patch-classified issues resolved on the original hammer+anvil composition (signature alignment x3). All passed v5.0 validator before regeneration.

---

## Notes

- Validator status: PASS (0 errors) at every recorded final review.
- Callout positions: callout 1 at the center of the brackets, callout 2 at the cog rim top, callout 3 at the auto-orbit chip, callout 4 over the mallet head.
