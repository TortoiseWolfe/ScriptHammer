# Issues: 01-landing-page.svg

**Feature:** 000-landing-page
**SVG:** 01-landing-page.svg
**Last Review:** 2026-01-15

---

## Summary

| Status | Count |
|--------|-------|
| Open | 1 |

---

## Open Issues

### SPEC-ORDER Issue (2026-01-15)

| ID | Issue | Classification | Escalation |
|----|-------|----------------|------------|
| SO-01 | Callouts 2 and 3 are in wrong order for UX flow | SPEC-ORDER | **Technical Writer** |

**Details:**
- **Current order:** 1. Product Discovery → 2. Feature Exploration → 3. Getting Started → 4. Technical Confidence
- **Correct UX flow:** 1. Product Discovery → 2. Getting Started → 3. Feature Exploration → 4. Technical Confidence
- **Rationale:** Users should be guided to "Get Started" BEFORE exploring features. Natural flow: discover → begin → explore → trust

**Visual Evidence:**
- "Get Started" button (green CTA) is primary action above fold
- "Explore" buttons are secondary actions in feature cards below
- Annotation callout 3 points to "Get Started" but should be callout 2
- Annotation callout 2 points to feature cards but should be callout 3

**Action Required:**
1. Technical Writer to reorder user stories in spec (swap US-002 ↔ US-003)
2. After spec update, regenerate wireframe with corrected callout order

---

## Inspector Issues (2026-01-15)

| Check | Expected | Actual | Classification |
|-------|----------|--------|----------------|
| footer_nav_corners | desktop footer has rx="4-8" | desktop footer missing rx attribute | PATTERN_VIOLATION |
| footer_nav_corners | mobile nav has rx="4-8" | mobile nav missing rx attribute | PATTERN_VIOLATION |
