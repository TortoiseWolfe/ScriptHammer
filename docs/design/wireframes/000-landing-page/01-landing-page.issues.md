# Issues: 01-landing-page.svg

**Feature:** 000-landing-page
**SVG:** 01-landing-page.svg
**Last Review:** 2026-01-13
**Validator:** v5.0

---

## Summary

| Classification | Count |
|----------------|-------|
| REGEN | 12 |
| PATCH | 14 |

**Recommendation: FULL REGENERATION**

This is a v3 wireframe that predates current standards. The structural issues (wrong viewports, no annotation panel, no callouts) require regeneration rather than patching.

---

## REGEN Issues (Structural)

### Viewport Dimensions (Not Caught by Validator)

| ID | Issue | Current | Required |
|----|-------|---------|----------|
| V-01 | Desktop viewport wrong size | 1366×768 | 1280×720 |
| V-02 | Mobile position wrong | x=1500 | x=1360 |

### Validator-Detected Structural Issues

| ID | Issue | Code |
|----|-------|------|
| H-01 | Include paths use `../includes/` instead of `includes/` | HDR-001 |
| A-01 | No callout circles in annotation panel (0 of 4 minimum) | ANN-002 |
| A-02 | No proper annotation panel - content floating outside | ANN-004 |
| B-01 | "View Docs" button has transparent fill | BTN-001 |
| X-01 | Signature not bold | SIGNATURE-002 |
| U-01 | No User Story badges in annotation panel | US-001 |
| S-01 | Background gradient defined but opacity="0" | G-022 |
| S-02 | Title at x=723 (not centered at x=960) | G-024 |
| S-03 | No numbered callouts (①②③④) on mockups | G-026 |

---

## PATCH Issues (Could Be Fixed, But Regen Preferred)

### Font Size Violations (14 instances)

All button text at 11-12px needs to be 14px minimum:

**Desktop buttons (12px → 14px):**
- "Explore", "View", "Learn", "Read", "Setup", "Check", "Get Started"

**Mobile buttons (11px → 14px):**
- "Explore", "View", "Learn", "Read", "Setup", "Home"

**Annotation (11px → 14px):**
- "94px gap" label

---

## What's Missing (v5 Requirements)

| Requirement | Status |
|-------------|--------|
| Annotation panel at y=800 | Missing |
| 4+ numbered callouts on mockups | Missing |
| US-anchored annotation groups | Missing |
| FR/SC badge pills | Missing |
| Correct viewport dimensions | Wrong |
| Background gradient applied | Opacity=0 |

---

## Generator Action

**Regenerate using `/wireframe 000-landing-page`**

When regenerating:
1. Use 1280×720 desktop at x=40, y=60
2. Use 360×720 mobile at x=1360, y=60
3. Add annotation panel at y=800 with US-anchored groups
4. Add numbered callouts (①②③④) on mockup elements
5. Apply background gradient (remove opacity="0")
6. Use 14px minimum for all button text

---

## Notes

- v3 wireframe from 2026-01-05 (predates v5 standards)
- Good content/layout concept, just needs v5 structure
- Keep the 6 feature cards concept when regenerating
