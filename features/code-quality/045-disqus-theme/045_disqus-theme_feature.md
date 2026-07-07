# Feature: Disqus Theme Enhancement

**Feature ID**: 045
**Category**: code-quality
**Source**: ScriptHammer README (SPEC-063)
**Status**: Ready for SpecKit
**Depends on**: 019-analytics-consent

## Description

Map DaisyUI themes to Disqus color schemes. Ensures Disqus comment sections visually integrate with the application's theme system across all 32 DaisyUI themes.

**Third-Party Consent Requirement**: Disqus is a third-party service that tracks users. Per the constitution's Privacy & Compliance First principle, Feature 019 (Analytics Consent Framework) MUST be implemented first. Disqus embed scripts can only load AFTER user grants consent for "comments" or "third-party" category.

## User Scenarios

### US-1: Theme Synchronization (P1)

Disqus comments match the current DaisyUI theme.

**Acceptance Criteria**:

1. Given light theme, when Disqus loads, then light color scheme used
2. Given dark theme, when Disqus loads, then dark color scheme used
3. Given theme change, when switched, then Disqus updates accordingly
4. Given custom theme, when active, then closest Disqus scheme selected

### US-2: Color Mapping (P1)

DaisyUI color variables map to Disqus configuration.

**Acceptance Criteria**:

1. Given primary color, when mapped, then Disqus accent color matches
2. Given background color, when mapped, then Disqus background matches
3. Given text color, when mapped, then Disqus text readable
4. Given border color, when mapped, then Disqus borders consistent

### US-3: Dynamic Updates (P2)

Theme changes update Disqus in real-time.

**Acceptance Criteria**:

1. Given theme toggle, when clicked, then Disqus reloads with new theme
2. Given system preference change, when detected, then Disqus updates
3. Given reload, when occurring, then minimal flicker
4. Given cached theme, when restored, then Disqus matches immediately

### US-4: Fallback Handling (P3)

Graceful handling when exact theme match unavailable.

**Acceptance Criteria**:

1. Given unmapped theme, when loading, then fallback scheme used
2. Given Disqus unavailable, when loading, then graceful degradation
3. Given contrast issues, when detected, then accessible scheme used

## Requirements

### Functional

**Theme Mapping**

- FR-001: Create mapping table for 32 DaisyUI themes
- FR-002: Extract theme colors from CSS variables
- FR-003: Map to Disqus color scheme (light/dark)
- FR-004: Calculate accent color from primary
- FR-005: Handle theme variants (light/dark)

**Disqus Configuration**

- FR-006: Set colorScheme parameter on embed
- FR-007: Configure background color
- FR-008: Configure accent color
- FR-009: Configure text colors
- FR-010: Support custom CSS injection (if allowed)

**Dynamic Updates**

- FR-011: Listen for theme change events
- FR-012: Reload Disqus embed on theme change
- FR-013: Preserve comment scroll position
- FR-014: Handle transition animations
- FR-015: Debounce rapid theme changes

**Theme Detection**

- FR-016: Read current DaisyUI theme
- FR-017: Detect system color scheme preference
- FR-018: Subscribe to theme changes
- FR-019: Cache theme mapping results

### Non-Functional

**Visual Quality**

- NFR-001: No visual jarring on theme change
- NFR-002: Colors meet accessibility contrast ratios
- NFR-003: Consistent appearance across browsers

**Performance**

- NFR-004: Theme detection < 10ms
- NFR-005: Disqus reload < 500ms
- NFR-006: No layout shift on reload

**Compatibility**

- NFR-007: Works with Disqus universal embed
- NFR-008: Respects Disqus privacy settings

**Consent Compliance**

- NFR-009: Disqus embed MUST NOT load until user consents via Feature 019 consent framework
- NFR-010: Show placeholder with "Enable Comments" button when consent not granted
- NFR-011: Persist consent preference in localStorage and sync with consent manager

### Theme Mapping Table

```typescript
const themeMapping: Record<string, DisqusTheme> = {
  // Light themes
  light: { colorScheme: 'light', accent: '#570df8' },
  cupcake: { colorScheme: 'light', accent: '#65c3c8' },
  bumblebee: { colorScheme: 'light', accent: '#e0a82e' },
  emerald: { colorScheme: 'light', accent: '#66cc8a' },
  corporate: { colorScheme: 'light', accent: '#4b6bfb' },
  garden: { colorScheme: 'light', accent: '#5c7f67' },
  lofi: { colorScheme: 'light', accent: '#808080' },
  pastel: { colorScheme: 'light', accent: '#d1c1d7' },
  fantasy: { colorScheme: 'light', accent: '#6e0b75' },
  wireframe: { colorScheme: 'light', accent: '#b8b8b8' },
  cmyk: { colorScheme: 'light', accent: '#45AEEE' },
  autumn: { colorScheme: 'light', accent: '#8C0327' },
  acid: { colorScheme: 'light', accent: '#FF00F4' },
  lemonade: { colorScheme: 'light', accent: '#519903' },
  winter: { colorScheme: 'light', accent: '#047AFF' },
  nord: { colorScheme: 'light', accent: '#5E81AC' },

  // Dark themes
  dark: { colorScheme: 'dark', accent: '#661AE6' },
  synthwave: { colorScheme: 'dark', accent: '#e779c1' },
  retro: { colorScheme: 'dark', accent: '#ef9995' },
  cyberpunk: { colorScheme: 'dark', accent: '#ff7598' },
  valentine: { colorScheme: 'dark', accent: '#e96d7b' },
  halloween: { colorScheme: 'dark', accent: '#f28c18' },
  forest: { colorScheme: 'dark', accent: '#1eb854' },
  aqua: { colorScheme: 'dark', accent: '#09ecf3' },
  black: { colorScheme: 'dark', accent: '#343232' },
  luxury: { colorScheme: 'dark', accent: '#ffffff' },
  dracula: { colorScheme: 'dark', accent: '#ff79c6' },
  business: { colorScheme: 'dark', accent: '#1C4E80' },
  night: { colorScheme: 'dark', accent: '#38bdf8' },
  coffee: { colorScheme: 'dark', accent: '#DB924B' },
  dim: { colorScheme: 'dark', accent: '#9FE88D' },
  sunset: { colorScheme: 'dark', accent: '#FF865B' },
};
```

### Components

```
src/components/comments/
├── DisqusEmbed/
│   ├── DisqusEmbed.tsx
│   ├── DisqusEmbed.test.tsx
│   └── useDisqusTheme.ts
└── index.ts

src/lib/themes/
├── disqus-mapping.ts
└── theme-utils.ts
```

### Out of Scope

- Disqus moderation features
- Custom Disqus CSS beyond color scheme
- Comment count widgets
- Disqus SSO integration

## Success Criteria

- SC-001: All 32 themes mapped to Disqus schemes
- SC-002: Theme changes update Disqus smoothly
- SC-003: Colors accessible in all themes
- SC-004: No layout shift during updates
- SC-005: Works with system theme detection
