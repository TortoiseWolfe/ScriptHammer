# Feature Specification: Accessibility Contrast Fix

**Feature Branch**: `013-accessibility-contrast-fix`
**Created**: 2025-12-26
**Status**: Complete
**SPEC-ID**: SPEC-044

## Problem Statement

Footer text uses `text-base-content/40` (40% opacity) which fails WCAG AA contrast requirements. The contrast ratio is approximately 3.57:1, below the required 4.5:1 for normal text.

**File**: `src/components/Footer.tsx:27`
**Current**: `text-base-content/40`
**Required**: At least 60% opacity for WCAG AA compliance

## User Scenarios & Testing

### User Story 1 - Readable Footer Text (Priority: P1)

As a user with low vision, I want footer text to have sufficient contrast so I can read it comfortably.

**Why this priority**: Accessibility is a legal requirement and core project principle.

**Independent Test**: Run axe-core accessibility tests - should pass contrast checks.

**Acceptance Scenarios**:

1. **Given** the footer component, **When** tested with axe-core, **Then** no contrast violations reported
2. **Given** dark/light themes, **When** viewing footer, **Then** text remains readable in all themes

## Requirements

### Functional Requirements

- **FR-001**: Footer text MUST meet WCAG AA contrast ratio (4.5:1 minimum)
- **FR-002**: Fix MUST work across all 32 DaisyUI themes
- **FR-003**: Visual design SHOULD maintain subtle secondary styling

## Success Criteria

### Measurable Outcomes

- **SC-001**: 0 axe-core contrast violations in footer
- **SC-002**: All 15 affected E2E accessibility tests pass
- **SC-003**: Footer text visible in all themes (visual verification)
