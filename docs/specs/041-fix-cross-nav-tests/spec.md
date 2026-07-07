# Feature Specification: Fix Cross-Page Navigation E2E Tests

**Feature Branch**: `041-fix-cross-nav-tests`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "Fix tests-cross E2E tests - 7 failures related to cross-page navigation timing issues"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - All Cross-Navigation Tests Pass (Priority: P1)

As a developer, I need all 14 cross-page navigation E2E tests to pass reliably so that CI/CD pipelines don't fail on navigation-related flakiness.

**Why this priority**: Failing E2E tests block merges and reduce confidence in the test suite. Navigation tests are foundational - they verify core site functionality.

**Independent Test**: Run `pnpm exec playwright test cross-page-navigation.spec.ts` and verify all tests pass.

**Acceptance Scenarios**:

1. **Given** the test suite runs, **When** cross-page-navigation.spec.ts executes, **Then** all 14 tests pass without flakiness
2. **Given** tests run in CI (GitHub Actions), **When** multiple browsers (Chromium, Firefox, WebKit) execute, **Then** all tests pass consistently

---

### User Story 2 - Timing-Resilient Assertions (Priority: P1)

As a test author, I need tests to use proper Playwright waiting patterns so assertions don't fail due to race conditions.

**Why this priority**: Timing issues are the root cause of the 7 failures. Using `.toPass()`, `waitForLoadState()`, and proper locator strategies eliminates flakiness.

**Independent Test**: Verify each fixed test uses retry-capable assertions or proper waiting.

**Acceptance Scenarios**:

1. **Given** a navigation action, **When** the page transitions, **Then** the test waits for network idle or DOM ready before asserting
2. **Given** an element check, **When** the element may appear asynchronously, **Then** use `expect().toPass()` or explicit `waitFor()`

---

### Edge Cases

- What happens when navigation is slow (network throttling)?
- How does the test handle pages that 404 or redirect?
- What if the cookie banner animation blocks clicks?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Tests MUST wait for navigation to complete before asserting URL changes
- **FR-002**: Tests MUST use retry-capable assertions (`toPass()`) for dynamic content
- **FR-003**: Tests MUST dismiss cookie banner before interacting with navigation
- **FR-004**: Tests MUST not rely on arbitrary `waitForTimeout()` delays
- **FR-005**: Tests MUST handle both mobile and desktop viewport scenarios
- **FR-006**: Tests MUST work across Chromium, Firefox, and WebKit browsers

### Key Entities

- **cross-page-navigation.spec.ts**: Single test file with 14 navigation tests
- **dismissCookieBanner()**: Helper from test-user-factory.ts

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All 14 tests in cross-page-navigation.spec.ts pass locally
- **SC-002**: All tests pass in CI across 3 browser engines
- **SC-003**: No test uses `waitForTimeout()` with hardcoded delays
- **SC-004**: Tests complete within 30 seconds each (no infinite waits)

## Clarifications

### Session 2025-12-26 (Initial Analysis)

**Actual test run results** (Chromium-only):

- 9 passed, 5 failed (not 7 as documented)

**Root causes identified**:

1. **browser back/forward navigation works** (line 35)
   - Error: URL is "about:blank" after goBack()
   - Root cause: Clicks via `text=` selector don't wait for navigation
   - Fix: Add `waitForURL()` after each navigation click

2. **anchor links within pages work** (line 128)
   - Error: Header element intercepts pointer events on skip link
   - Root cause: Sticky header overlays the skip-to-content link
   - Fix: Use `{ force: true }` or scroll past header first

3. **navigation preserves theme selection** (line 194)
   - Error: Strict mode violation - 2 elements match `button:has-text("dark")`
   - Root cause: Theme picker has both dropdown and preview buttons
   - Fix: Use more specific selector like `getByRole('button', { name: 'dark', exact: true })`

4. **navigation menu is keyboard accessible** (line 214)
   - Error: Timing/flakiness when tabbing through nav
   - Root cause: Focus state detection race condition
   - Fix: Add explicit waits or use `toPass()` pattern

5. **Tests passing in isolation but failing together**
   - Some tests pass individually but fail in parallel
   - Root cause: Shared state or resource contention
   - Fix: Ensure test isolation with fresh page state
