# Issues: 01-wcag-compliance-overview.svg

**Feature:** 001-wcag-aa-compliance
**SVG:** 01-wcag-compliance-overview.svg
**Last Review:** 2026-01-13
**Validator:** v5.0

---

## Summary

| Classification | Count |
|----------------|-------|
| REGEN | 50 |

**Recommendation: FULL REGENERATION**

This is a **dark theme v3 wireframe** with information architecture layout. Does not follow v5 light theme standards with desktop+mobile mockups.

---

## Critical Structural Issues

| Issue | Current | Required (v5) |
|-------|---------|---------------|
| Theme | Dark (#1a1a2e background) | Light (#e8d4b8 parchment) |
| Layout | Full-width info diagram | Desktop 1280×720 + Mobile 360×720 |
| Desktop mockup | Missing | x=40, y=60, 1280×720 |
| Mobile mockup | Missing | x=1360, y=60, 360×720 |
| Annotation panel | Missing | y=800, 4-column grid |
| Numbered callouts | Missing | ①②③④ on mockups |
| Background gradient | Missing | #c7ddf5 → #b8d4f0 |
| Section labels | Missing | "DESKTOP (16:9)" / "MOBILE" |

---

## Validator Errors (50 total)

- **FONT-001**: 27 instances of text below 14px minimum
- **LINK-001**: 16 badges not wrapped in `<a>` tags
- **ANN-001**: No annotation panel
- **SECTION-001/002**: Missing desktop/mobile section labels
- **SIGNATURE-001/002**: Signature wrong size and not bold
- **G-022**: Missing background gradient
- **G-024**: Missing centered title block

---

## Generator Action

**Regenerate using `/wireframe 001-wcag-aa-compliance`**

This SVG shows WCAG compliance automation concepts:
- CI/CD pipeline with Pa11y testing
- User Stories for accessibility needs
- Success Criteria checklist
- Requirement categories

When regenerating:
1. Convert to light theme with parchment colors
2. Create desktop mockup showing accessibility dashboard UI
3. Create mobile mockup with responsive view
4. Add annotation panel with US-anchored callout groups
5. Map FR/SC badges to numbered callouts

---

## Notes

- Dark theme wireframe from older generation
- Good content concept, needs v5 structure
- Consider consolidating 3 SVGs into 1-2 if content overlaps
