# UX Flow Order: 000-landing-page

**Created**: 2026-01-16
**Author**: UX Designer
**Based on**: Wireframe analysis (01-landing-page.svg)

## Visual Flow Analysis

The landing page follows a natural top-to-bottom reading pattern with clear visual hierarchy.

### Recommended User Story Sequence

| Order | Callout | User Story                   | Screen Location                    | Rationale                                            |
| ----- | ------- | ---------------------------- | ---------------------------------- | ---------------------------------------------------- |
| 1     | ①       | US-001: Product Discovery    | Hero section (top)                 | First thing users see - understand value proposition |
| 2     | ②       | US-002: Feature Exploration  | Feature cards row 1 (upper-middle) | After value prop, users want details                 |
| 3     | ③       | US-003: Getting Started      | CTA buttons (below hero)           | Conversion action follows understanding              |
| 4     | ④       | US-004: Technical Confidence | Feature cards row 2 (lower-middle) | Quality indicators reinforce decision                |

### Visual Flow Map

```
Desktop (1280x720):
┌────────────────────────────────────────────┐
│ Header Nav                                 │
├────────────────────────────────────────────┤
│ ① HERO SECTION (y=70-250)                  │ ← US-001: Product Discovery
│    "Build Better Apps Faster"              │
│    [Get Started] [View Docs]               │ ← US-003: Getting Started (③)
├────────────────────────────────────────────┤
│ ② FEATURE CARDS ROW 1 (y=270-420)         │ ← US-002: Feature Exploration
│    [46 Specs] [Wireframes] [SpecKit]       │
├────────────────────────────────────────────┤
│ ④ FEATURE CARDS ROW 2 (y=440-590)         │ ← US-004: Technical Confidence
│    [Constitution] [Docker] [WCAG]          │
├────────────────────────────────────────────┤
│ Footer                                     │
└────────────────────────────────────────────┘
```

### Mobile Flow (360x720)

Mobile maintains same sequence with stacked vertical layout:

1. Hero (compact) → ①
2. Feature cards stacked → ②
3. CTA prominent → ③
4. Additional cards stacked → ④

### Current vs Recommended

| Current Wireframe   | Recommended       | Change Needed                                  |
| ------------------- | ----------------- | ---------------------------------------------- |
| ① Hero              | ① Hero            | None                                           |
| ② Cards Row 1       | ② Cards Row 1     | None                                           |
| ③ CTA (below cards) | ③ CTA (with hero) | SPEC-ORDER: Move ③ annotation to hero CTA area |
| ④ Cards Row 2       | ④ Cards Row 2     | None                                           |

### Issue

Wireframe callout ③ appears BELOW the feature cards, but the actual "Getting Started" CTAs are IN the hero section. Users encounter CTAs immediately after the value proposition, not after scrolling past feature cards.

**Recommendation**: Update annotation callout ③ position to point at hero CTA buttons, maintaining the natural user journey: Discover → Decide → Act.
