# Feature Specification: Form Honeypot Fix

**Feature Branch**: `012-form-honeypot-fix`
**Created**: 2025-12-26
**Status**: Draft
**SPEC-ID**: SPEC-043
**Input**: Fix 12 form E2E test failures caused by tests filling honeypot field

## Problem Statement

The contact form includes a honeypot field for bot detection. When this field is filled, the form displays "Bot detected" error and disables submission. The E2E test `form submission with valid data` fills ALL text inputs on the page, including the honeypot field, causing the test to fail.

**Root Cause**: `tests/e2e/tests/form-submission.spec.ts` lines 84-98 iterate over all `input[type="text"]` elements and fill them with "Test Value", not excluding the honeypot field.

**Evidence**: Error context shows:

- Honeypot field: `textbox "Don't fill this out if you're human:" [active]: Test Value`
- Alert displayed: `alert: Bot detected`
- Submit button: `[disabled]`

## User Scenarios & Testing

### User Story 1 - E2E Tests Pass with Honeypot (Priority: P1)

As a developer, I want E2E form tests to correctly skip honeypot fields so that CI passes and bot detection remains functional.

**Why this priority**: Blocking CI pipeline with 12 failures; prevents deployment of any changes.

**Independent Test**: Run `pnpm exec playwright test form-submission.spec.ts` - all tests should pass.

**Acceptance Scenarios**:

1. **Given** contact form with honeypot field, **When** E2E test fills form, **Then** honeypot field remains empty and form submits successfully
2. **Given** form test uses generic input filling, **When** encountering hidden/honeypot fields, **Then** test skips those fields automatically
3. **Given** honeypot detection is active, **When** legitimate E2E test runs, **Then** "Bot detected" error never appears

---

### User Story 2 - Bot Detection Still Works (Priority: P1)

As a site owner, I want honeypot bot detection to remain functional after the fix so that spam submissions are still blocked.

**Why this priority**: Security feature must not be broken by test fixes.

**Independent Test**: Manually submit form with honeypot filled - should show "Bot detected".

**Acceptance Scenarios**:

1. **Given** contact form, **When** honeypot field is filled by actual bot, **Then** "Bot detected" error displays
2. **Given** contact form, **When** human user submits (honeypot empty), **Then** form submits successfully

---

### Edge Cases

- What if honeypot field has different selector in future? → Use semantic selector (label text) not hardcoded ID
- What if multiple forms have honeypot fields? → Solution should work generically across all forms
- What if honeypot is visually hidden but DOM-visible? → Exclude by label pattern, not visibility

## Requirements

### Functional Requirements

- **FR-001**: E2E tests MUST skip input fields with labels containing "human" or "don't fill"
- **FR-002**: E2E tests MUST skip input fields that are honeypot traps (name containing "honeypot", "trap", or similar)
- **FR-003**: Contact form honeypot detection MUST remain functional after test changes
- **FR-004**: Test changes MUST be isolated to test files (no production code changes needed)

### Key Entities

- **Honeypot Field**: Hidden/visible input field used for bot detection; should never be filled by humans or legitimate tests
- **Form Test Helpers**: Reusable functions for filling forms while respecting honeypot fields

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 12 form-submission.spec.ts tests pass (0 failures)
- **SC-002**: CI E2E test job completes without form-related failures
- **SC-003**: Manual honeypot test confirms bot detection still works
- **SC-004**: No changes to production code (src/) - test-only changes

## Assumptions

1. The honeypot field label contains "Don't fill this out if you're human"
2. Only test code needs modification, not the form component
3. The fix pattern can be reused if other forms have honeypot fields

## Out of Scope

- Refactoring the contact form component
- Adding new honeypot detection methods
- Changing honeypot field visibility/styling
