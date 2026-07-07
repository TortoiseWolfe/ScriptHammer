# Implementation Plan: E2E Testing Framework (Playwright)

**Branch**: `003-e2e-testing-framework` | **Date**: 2025-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-e2e-testing-framework/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Implement comprehensive end-to-end testing using Playwright to validate critical user journeys across Chrome, Firefox, and Safari. Tests will cover PWA installation, theme switching, form submissions, and accessibility features with full CI/CD integration.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+
**Primary Dependencies**: @playwright/test, Next.js 15.5.2
**Storage**: Test artifacts and reports in test-results/
**Testing**: Playwright Test Runner with built-in assertions
**Target Platform**: Web (Chrome, Firefox, Safari)
**Project Type**: web - frontend E2E testing
**Performance Goals**: < 5 min full suite, < 10 min CI
**Constraints**: Must run in Docker, GitHub Actions
**Scale/Scope**: ~20-30 test scenarios across 6 test files

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Simplicity**:

- Projects: 1 (e2e directory with test suites)
- Using framework directly? YES (Playwright Test, no abstractions)
- Single data model? YES (page objects and test fixtures)
- Avoiding patterns? YES (standard Playwright patterns only)

**Architecture**:

- EVERY feature as library? N/A (test suite, not library)
- Test organization:
  - homepage.spec.ts: Homepage and navigation tests
  - theme-switching.spec.ts: Theme persistence tests
  - forms.spec.ts: Form validation and submission
  - pwa.spec.ts: PWA installation and offline
  - accessibility.spec.ts: Keyboard and screen reader
  - navigation.spec.ts: Cross-page navigation
- CLI integration: pnpm test:e2e commands
- Test docs: Inline comments and README

**Testing (NON-NEGOTIABLE)**:

- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: E2E tests ARE the tests
- Real dependencies used? YES (actual browsers, real app)
- Integration tests for: All user journeys
- FORBIDDEN: Implementation before test ✓

**Observability**:

- Structured logging included? YES (Playwright reporters)
- Test artifacts? YES (screenshots, videos, traces)
- Error context sufficient? YES (full error traces)

**Versioning**:

- Version number assigned? 1.0.0
- BUILD increments on every change? YES
- Breaking changes handled? N/A (first version)

## Project Structure

### Documentation (this feature)

```
specs/003-e2e-testing-framework/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
e2e/
├── tests/
│   ├── homepage.spec.ts
│   ├── theme-switching.spec.ts
│   ├── forms.spec.ts
│   ├── pwa.spec.ts
│   ├── accessibility.spec.ts
│   └── navigation.spec.ts
├── fixtures/
│   ├── test-data.json
│   └── users.json
├── pages/
│   ├── HomePage.ts
│   ├── ThemePage.ts
│   └── BasePage.ts
└── playwright.config.ts

test-results/           # Generated
playwright-report/      # Generated
```

**Structure Decision**: Single e2e project with page objects

## Phase 0: Outline & Research

✅ **COMPLETE** - See [research.md](./research.md)

Key decisions made:

- Playwright over Cypress (better browser support)
- Page Object Model for maintainability
- Parallel execution with sharding
- Docker integration via mcr.microsoft.com/playwright
- GitHub Actions with artifact uploads

All technical clarifications resolved, no unknowns remaining.

## Phase 1: Design & Contracts

✅ **COMPLETE** - All artifacts generated

Generated artifacts:

- [data-model.md](./data-model.md) - Page objects, fixtures, and test data structures
- [contracts/test-api.yaml](./contracts/test-api.yaml) - Test execution API specification
- [contracts/report-schema.json](./contracts/report-schema.json) - Test report format
- [quickstart.md](./quickstart.md) - Step-by-step testing guide

Key design decisions:

- Page Object Model with TypeScript classes
- JSON fixtures for test data
- HTML/JSON/JUnit report formats
- Screenshot/video on failure
- Trace files for debugging

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:
The /tasks command will generate approximately 25-30 tasks following TDD principles:

1. **Setup Tasks** - Environment preparation:
   - Install Playwright and dependencies
   - Create playwright.config.ts
   - Setup Docker configuration
   - Configure GitHub Actions

2. **Test Creation Tasks (RED phase)** - Write failing tests:
   - Homepage navigation tests
   - Theme switching tests (all 32 themes)
   - Form submission tests
   - PWA installation tests
   - Accessibility tests
   - Cross-browser tests

3. **Page Object Tasks** - Create page models:
   - BasePage abstract class
   - HomePage, ThemePage, ComponentsPage
   - Shared components and utilities

4. **Integration Tasks** - Wire everything together:
   - Update package.json scripts
   - CI/CD pipeline configuration
   - Docker integration
   - Report generation

**Ordering Strategy**:

- Configuration first (Playwright setup)
- Page objects before tests that use them
- Simple tests (homepage) before complex (PWA)
- Parallel markers [P] for independent test files

**Estimated Output**: ~25-30 tasks with clear dependencies

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md with Playwright)
**Phase 5**: Validation (run tests across all browsers, verify CI)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

No violations - all constitutional principles followed ✓

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅
- [x] All NEEDS CLARIFICATION resolved ✅
- [x] Complexity deviations documented (none needed) ✅

---

_Based on Constitution v2.1.1 - See `.specify/memory/constitution.md`_
