# Feature: Font Switcher

**Feature ID**: 018
**Category**: enhancements
**Source**: ScriptHammer_v_001/docs/specs/006-font-switcher
**Status**: Ready for SpecKit (Completed in v_001)

## Description

A font switching system that mirrors the ThemeSwitcher pattern, allowing users to dynamically change typography across the application. Enhances accessibility with options for users with dyslexia or visual preferences.

## User Scenarios

### US-1: Select Font Family (P1)

A user opens the font switcher and selects from available font options. The entire application updates to use the selected font family.

**Acceptance Criteria**:

1. Given the font switcher, when user selects a font, then all text updates immediately
2. Given a font is selected, when user refreshes, then the font preference persists
3. Given any font selected, when combined with any theme, then layout remains stable

### US-2: Accessibility Font Options (P2)

Users with dyslexia or visual impairments can select specialized accessibility fonts.

**Acceptance Criteria**:

1. Given font options, when viewing list, then OpenDyslexic is available with "dyslexia-friendly" badge
2. Given font options, when viewing list, then Atkinson Hyperlegible is available with "high-readability" badge
3. Given accessibility font selected, when reading content, then readability is improved

### US-3: Font Preview (P3)

Users can preview how each font looks before selecting it.

**Acceptance Criteria**:

1. Given font dropdown, when viewing options, then each option displays in its own font family
2. Given font option, when hovered, then description explains the font's purpose

## Available Fonts

| Font                  | Category   | Purpose            | Accessibility     |
| --------------------- | ---------- | ------------------ | ----------------- |
| System Default        | Sans-serif | OS default         | Standard          |
| Inter                 | Sans-serif | Screen-optimized   | Standard          |
| OpenDyslexic          | Sans-serif | Dyslexia support   | Dyslexia-friendly |
| Atkinson Hyperlegible | Sans-serif | Maximum legibility | High-readability  |
| Georgia               | Serif      | Long-form reading  | Standard          |
| JetBrains Mono        | Monospace  | Code display       | Standard          |

### Default Accessible Font

**Default font**: `Inter` - Selected as the default because:

- Optimized for screen readability across all sizes
- Variable font with weight range 100-900
- Large x-height improves legibility at small sizes
- Available as system font on modern OSes (Windows 11, macOS Sonoma)
- Open source (SIL Open Font License)

**Fallback stack**:

```css
font-family:
  'Inter',
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  sans-serif;
```

**Accessibility default**: Users with `prefers-reduced-motion: reduce` or using screen readers default to `System Default` to respect OS accessibility settings.

## Requirements

### Functional

- FR-001: Font switcher UI mirrors ThemeSwitcher pattern
- FR-002: At least 6 font options available
- FR-003: Font preference persists via localStorage
- FR-004: Seamless integration with all 32 themes
- FR-005: No layout shift when switching fonts
- FR-006: Include accessibility-friendly font options
- FR-007: Storybook documentation complete
- FR-008: Works with print stylesheets

### Non-Functional

- NFR-001: Use font-display: swap to prevent FOUT
- NFR-002: Initial load < 50ms (system fonts)
- NFR-003: Lazy load web fonts on selection
- NFR-004: Storage < 1KB for preference

### Key Components

- **FontSwitcher**: Dropdown component in navigation
- **fonts.ts**: Font configuration with metadata
- **fonts.css**: @font-face declarations

### Out of Scope

- Custom font upload by users
- Per-component font overrides
- Variable font weight controls
- Font size controls (handled by AccessibilityContext)

## Success Criteria

- SC-001: All 6+ fonts selectable and render correctly
- SC-002: Preference persists across sessions
- SC-003: No visible layout shift during font changes
- SC-004: Accessibility fonts improve readability metrics
- SC-005: Works correctly with all 32 themes
