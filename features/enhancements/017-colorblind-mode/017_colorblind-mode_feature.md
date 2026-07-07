# Feature: Colorblind Mode

**Feature ID**: 017
**Category**: enhancements
**Source**: ScriptHammer/docs/specs/005-colorblind-mode
**Status**: Ready for SpecKit

## Description

A comprehensive colorblind mode system providing filters and adjustments for all major types of color vision deficiencies. Integrates with accessibility controls and works across all 32 themes, ensuring usability for the ~8% of men and ~0.5% of women with color vision deficiencies.

## User Scenarios

### US-1: Enable Colorblind Filter (P1)

A user with color vision deficiency accesses the accessibility settings and selects their specific condition type. The interface applies appropriate color corrections across the entire application.

**Acceptance Criteria**:

1. Given a user in accessibility settings, when they select a colorblind type, then CSS filters are applied immediately
2. Given a colorblind filter is active, when user switches themes, then the filter persists
3. Given any colorblind mode, when viewing critical UI elements, then they remain distinguishable

### US-2: Enable Pattern Overlays (P2)

For better distinction beyond color filtering, users can enable pattern overlays that add visual patterns to differentiate UI elements.

**Acceptance Criteria**:

1. Given colorblind mode is active, when patterns are enabled, then success/error states have distinct patterns
2. Given patterns enabled, when viewing buttons and badges, then they have distinguishable patterns
3. Given patterns enabled, when disabled, then UI returns to standard appearance

### US-3: Simulation Mode for Testing (P3)

Developers and designers can simulate various colorblind types to test their work.

**Acceptance Criteria**:

1. Given simulation mode, when any type is selected, then the entire page simulates that condition
2. Given simulation mode, when switched, then the change is immediate with no page reload

## Colorblind Types Supported

| Type          | Description         | Prevalence  |
| ------------- | ------------------- | ----------- |
| Protanopia    | Red-blind           | 1% of males |
| Protanomaly   | Red-weak            | 1% of males |
| Deuteranopia  | Green-blind         | 1% of males |
| Deuteranomaly | Green-weak          | 5% of males |
| Tritanopia    | Blue-blind          | 0.001%      |
| Tritanomaly   | Blue-weak           | 0.01%       |
| Achromatopsia | Complete colorblind | 0.003%      |
| Achromatomaly | Partial colorblind  | Rare        |

### Colorblind-Optimized Palettes

When colorblind mode is active, the following 4 optimized palettes replace standard DaisyUI colors:

```css
/* Protanopia/Deuteranopia Safe (red-green blind) */
:root[data-colorblind='protan'],
:root[data-colorblind='deutan'] {
  --primary: #0077bb; /* Blue - replaces violet/purple */
  --secondary: #ee7733; /* Orange - high contrast with blue */
  --accent: #009988; /* Teal - distinguishable from both */
  --success: #009988; /* Teal - replaces green */
  --warning: #ee7733; /* Orange - replaces yellow */
  --error: #cc3311; /* Red-orange - still visible */
  --info: #0077bb; /* Blue */
}

/* Tritanopia Safe (blue-yellow blind) */
:root[data-colorblind='tritan'] {
  --primary: #ee3377; /* Magenta - replaces blue */
  --secondary: #009988; /* Teal */
  --accent: #ee7733; /* Orange */
  --success: #009988; /* Teal */
  --warning: #ee7733; /* Orange - replaces yellow */
  --error: #cc3311; /* Red */
  --info: #ee3377; /* Magenta - replaces blue */
}

/* Achromatopsia Safe (complete colorblindness) */
:root[data-colorblind='achroma'] {
  --primary: #000000; /* Black */
  --secondary: #666666; /* Dark gray */
  --accent: #333333; /* Charcoal */
  --success: #000000; /* Black with checkmark pattern */
  --warning: #666666; /* Gray with warning pattern */
  --error: #000000; /* Black with X pattern */
  --info: #333333; /* Charcoal */
  /* Uses patterns (stripes, dots, hatching) for distinction */
}

/* High Contrast Mode */
:root[data-colorblind='high-contrast'] {
  --primary: #ffffff;
  --secondary: #ffff00;
  --accent: #00ffff;
  --success: #00ff00;
  --warning: #ffff00;
  --error: #ff0000;
  --info: #00ffff;
  --base-100: #000000;
  --base-content: #ffffff;
}
```

## Requirements

### Functional

- FR-001: Support all 8 major colorblind types via SVG filters
- FR-002: Apply CSS filters for real-time conversion
- FR-003: Provide pattern overlays for critical UI elements
- FR-004: Work seamlessly with all 32 DaisyUI themes
- FR-005: Persist user preference in localStorage
- FR-006: Performance impact < 10ms
- FR-007: Accessible toggle in Settings UI
- FR-008: Include simulation mode for testing

### Non-Functional

- NFR-001: No external library dependencies (pure CSS/SVG)
- NFR-002: GPU-accelerated filter rendering
- NFR-003: Patterns must be subtle, not intrusive

### Key Components

- **ColorblindToggle**: Dropdown selector in accessibility panel
- **ColorblindFilters**: Hidden SVG filter definitions
- **useColorblindMode**: Hook for mode management

### Out of Scope

- Hardware-level color correction
- Custom filter creation by users
- Real-time image/video recoloring
- External content adaptation

## Success Criteria

- SC-001: All 8 colorblind types supported with accurate filters
- SC-002: Patterns visible and distinguishable for all alert/button states
- SC-003: Works with all 32 themes without conflicts
- SC-004: Preference persists across sessions
- SC-005: Performance impact unnoticeable to users
