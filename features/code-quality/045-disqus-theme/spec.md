# Feature Specification: Disqus Theme Enhancement

**Feature ID**: 045-disqus-theme
**Created**: 2025-12-31
**Status**: Specified
**Category**: Code Quality

## Overview

Visual integration between the application's theme system and Disqus comment embeds. Maps all 32 DaisyUI themes to appropriate Disqus color schemes (light/dark with accent colors), ensuring comments visually match the rest of the application. Theme changes dynamically update Disqus appearance. Disqus only loads after user grants consent per privacy requirements.

---

## User Scenarios & Testing

### User Story 1 - Theme Synchronization (Priority: P1)

A user browsing the site in dark mode sees Disqus comments displayed in a matching dark theme, maintaining visual consistency.

**Why this priority**: Visual consistency is the core purpose of this feature. Mismatched themes create jarring user experience.

**Independent Test**: Load page with dark theme active, verify Disqus embed uses dark color scheme. Switch to light theme, verify Disqus updates.

**Acceptance Scenarios**:

1. **Given** light DaisyUI theme active, **When** Disqus loads, **Then** Disqus uses light color scheme
2. **Given** dark DaisyUI theme active, **When** Disqus loads, **Then** Disqus uses dark color scheme
3. **Given** user switches theme, **When** toggle clicked, **Then** Disqus updates to match new theme
4. **Given** custom/unique theme, **When** active, **Then** closest matching Disqus scheme selected
5. **Given** system prefers-color-scheme changes, **When** detected, **Then** Disqus updates if following system

---

### User Story 2 - Color Mapping (Priority: P1)

A user sees Disqus comments with accent colors that complement the active DaisyUI theme's primary color.

**Why this priority**: Color harmony between app and comments is essential for polished appearance.

**Independent Test**: Load page with "cupcake" theme, verify Disqus accent color matches theme's primary teal.

**Acceptance Scenarios**:

1. **Given** DaisyUI primary color, **When** mapped to Disqus, **Then** Disqus accent color harmonizes
2. **Given** DaisyUI background color, **When** mapped, **Then** Disqus background blends with page
3. **Given** DaisyUI text color, **When** mapped, **Then** Disqus text is readable against background
4. **Given** any of 32 DaisyUI themes, **When** active, **Then** mapped Disqus configuration exists

---

### User Story 3 - Dynamic Updates (Priority: P2)

A user toggles between themes and sees Disqus update smoothly without jarring transitions or layout shifts.

**Why this priority**: Smooth transitions improve perceived quality but are not core functionality.

**Independent Test**: Toggle theme rapidly 5 times, verify no layout shift and final state correct.

**Acceptance Scenarios**:

1. **Given** theme toggle clicked, **When** Disqus reloads, **Then** transition is smooth with no flash
2. **Given** system preference changes, **When** detected, **Then** Disqus updates automatically
3. **Given** page reload, **When** theme restored from storage, **Then** Disqus matches immediately
4. **Given** rapid theme changes, **When** multiple toggles, **Then** changes are debounced (final state applied)
5. **Given** comment scroll position, **When** theme changes, **Then** scroll position preserved if possible

---

### User Story 4 - Consent Handling (Priority: P1)

A user who hasn't consented to third-party services sees a placeholder instead of Disqus, with option to enable.

**Why this priority**: Privacy compliance is mandatory. Disqus cannot load without consent.

**Independent Test**: Load page without consent, verify placeholder shown. Grant consent, verify Disqus loads.

**Acceptance Scenarios**:

1. **Given** user has not consented, **When** comment section reached, **Then** placeholder with "Enable Comments" button shown
2. **Given** user clicks enable button, **When** consent granted, **Then** Disqus loads with correct theme
3. **Given** user previously consented, **When** page loads, **Then** Disqus loads automatically
4. **Given** user revokes consent, **When** preference changed, **Then** Disqus unloads and placeholder returns

---

### User Story 5 - Fallback Handling (Priority: P3)

A user on a theme without exact mapping or when Disqus is unavailable still has acceptable experience.

**Why this priority**: Fallbacks are edge cases that should be handled but are not primary flows.

**Independent Test**: Set unmapped theme, verify fallback scheme used. Block Disqus, verify graceful degradation.

**Acceptance Scenarios**:

1. **Given** unmapped or new theme, **When** loading Disqus, **Then** sensible fallback (light or dark based on theme brightness)
2. **Given** Disqus service unavailable, **When** loading fails, **Then** graceful error message shown
3. **Given** color contrast issues detected, **When** accessibility check fails, **Then** high-contrast fallback used

---

### Edge Cases

**Theme Detection Edge Cases**:

- Theme set via URL parameter (should be detected)
- Theme set before page fully loads (race condition)
- Theme attribute removed from document (fallback to system)
- Invalid theme value set (fallback to default)

**Disqus Loading Edge Cases**:

- Disqus blocked by ad blocker (show fallback)
- Disqus script timeout (retry with backoff)
- Multiple Disqus embeds on same page (sync themes)
- Disqus loaded before consent check completes (must not happen)

**Theme Change Edge Cases**:

- Theme changed while Disqus still loading (abort and restart)
- Theme changed while user typing comment (preserve draft)
- Theme changed by external script (detect mutation)
- System theme change while tab not visible (apply on visibility)

**Color Mapping Edge Cases**:

- Theme with very low contrast colors (ensure readability)
- Theme with extreme saturation (normalize for Disqus)
- Theme colors change mid-session (CSS custom properties updated)
- Browser doesn't support CSS custom properties (fallback extraction)

**Consent Edge Cases**:

- Consent cookie expires (re-prompt)
- Consent granted but Disqus fails (show error, not placeholder)
- Multiple consent categories (check correct category)
- Consent withdrawn while comment being written (warn before unload)

---

## Requirements

### Functional Requirements

**Theme Mapping**:

- **FR-001**: System MUST map all 32 DaisyUI themes to Disqus color configurations
- **FR-002**: System MUST extract current theme from document attribute or CSS
- **FR-003**: System MUST determine light/dark scheme for each theme
- **FR-004**: System MUST select appropriate accent color per theme
- **FR-005**: System MUST provide fallback mapping for unmapped themes

**Disqus Configuration**:

- **FR-006**: System MUST set Disqus colorScheme parameter (light/dark)
- **FR-007**: System MUST configure Disqus background color when supported
- **FR-008**: System MUST configure Disqus accent color when supported
- **FR-009**: System MUST handle Disqus configuration API limitations gracefully

**Dynamic Updates**:

- **FR-010**: System MUST listen for theme change events
- **FR-011**: System MUST reload Disqus embed when theme changes
- **FR-012**: System MUST debounce rapid theme changes (prevent reload spam)
- **FR-013**: System MUST minimize visual disruption during reload
- **FR-014**: System MUST detect system color scheme preference changes

**Consent Integration**:

- **FR-015**: System MUST NOT load Disqus until user grants consent
- **FR-016**: System MUST display placeholder when consent not granted
- **FR-017**: System MUST provide "Enable Comments" action on placeholder
- **FR-018**: System MUST load Disqus after consent is granted
- **FR-019**: System MUST unload Disqus if consent is withdrawn
- **FR-020**: System MUST sync consent state with consent manager

**Fallback Handling**:

- **FR-021**: System MUST detect when Disqus fails to load
- **FR-022**: System MUST show appropriate error message on load failure
- **FR-023**: System MUST use fallback color scheme for unmapped themes

### Non-Functional Requirements

**Visual Quality**:

- **NFR-001**: Theme changes MUST NOT cause jarring visual flash
- **NFR-002**: Disqus colors MUST meet WCAG AA contrast ratios
- **NFR-003**: Appearance MUST be consistent across modern browsers

**Performance**:

- **NFR-004**: Theme detection MUST complete within 10 milliseconds
- **NFR-005**: Disqus reload MUST complete within 500 milliseconds
- **NFR-006**: Theme changes MUST NOT cause layout shift (CLS impact)
- **NFR-007**: Disqus script MUST be lazy-loaded (not in critical path)

**Privacy & Compliance**:

- **NFR-008**: Disqus embed MUST NOT load without explicit user consent
- **NFR-009**: Consent preference MUST persist across sessions
- **NFR-010**: Consent state MUST sync with site-wide consent manager

### Key Entities

**Theme Configurations**:

- 32 DaisyUI themes (16 light, 16 dark)
- Color scheme (light or dark)
- Accent/primary color
- Fallback mapping for edge cases

**Disqus Integration**:

- Disqus embed component
- Color scheme configuration
- Consent-gated loading
- Placeholder component

**Consent States**:

- Not asked (show placeholder with prompt)
- Denied (show placeholder with info)
- Granted (load Disqus)
- Revoked (unload Disqus, show placeholder)

**User Preferences**:

- Active theme selection
- System theme preference
- Comment consent status

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 32 DaisyUI themes have mapped Disqus color configurations
- **SC-002**: Theme changes update Disqus smoothly within 500ms
- **SC-003**: All theme/Disqus combinations meet WCAG AA contrast (4.5:1)
- **SC-004**: Zero Cumulative Layout Shift (CLS) during theme changes
- **SC-005**: System theme preference changes detected and applied
- **SC-006**: Disqus never loads before user consent confirmed
- **SC-007**: Placeholder provides clear path to enable comments
- **SC-008**: Fallback gracefully handles Disqus service unavailability

---

## Dependencies

- **019-Google Analytics**: Consent framework for third-party services
- **002-Cookie Consent**: Cookie consent banner and storage
- DaisyUI theme system (application provides this)

## Out of Scope

- Disqus moderation and admin features
- Custom Disqus CSS beyond color configuration
- Disqus comment count widgets
- Disqus Single Sign-On (SSO) integration
- Disqus API integration (read/write comments)
- Adding new themes beyond existing 32

## Assumptions

- DaisyUI theme system is already implemented in the application
- Theme is set via data-theme attribute on document element
- Consent framework (019) is implemented and provides consent status
- Disqus account exists with embed code available
- Disqus supports colorScheme configuration (light/dark basic support)
- Limited Disqus color customization (mainly scheme + accent if available)
