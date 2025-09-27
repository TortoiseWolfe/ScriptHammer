# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **CRUDkit Structure**: `src/app/`, `src/components/`, `src/utils/`, `src/tests/`
- **Components**: `src/components/{atomic|subatomic|privacy|theme}/`
- **Tests**: Component tests co-located, integration in `src/tests/`
- **Config**: `src/config/`, root config files (`next.config.ts`, etc.)

## Phase 3.1: Setup
- [ ] T001 Create feature branch using PRP naming convention
- [ ] T002 Set up Docker environment with `docker compose up`
- [ ] T003 [P] Install dependencies with `pnpm install`
- [ ] T004 [P] Configure TypeScript strict mode and ESLint

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T005 [P] Component unit tests in ComponentName.test.tsx
- [ ] T006 [P] Accessibility tests in ComponentName.accessibility.test.tsx
- [ ] T007 [P] Integration tests in src/tests/integration/
- [ ] T008 [P] E2E tests with Playwright in e2e/

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Components (use generator)
- [ ] T009 Generate component with `pnpm run generate:component ComponentName`
- [ ] T010 Implement component logic in ComponentName.tsx
- [ ] T011 Create Storybook stories in ComponentName.stories.tsx
- [ ] T012 Add component to barrel export in index.ts

### Features
- [ ] T013 [P] API routes in src/app/api/
- [ ] T014 [P] React hooks in src/hooks/
- [ ] T015 [P] Utility functions in src/utils/
- [ ] T016 Form validation with Zod schemas
- [ ] T017 Error boundaries and loading states

## Phase 3.4: Integration

### Privacy & Compliance
- [ ] T018 Implement consent management with ConsentContext
- [ ] T019 Add cookie consent banner
- [ ] T020 Configure Google Analytics with consent mode
- [ ] T021 Add GDPR-compliant data handling

### PWA & Performance
- [ ] T022 Configure service worker for offline support
- [ ] T023 Implement background sync for forms
- [ ] T024 Add IndexedDB for offline queue
- [ ] T025 Optimize bundle with dynamic imports

## Phase 3.5: Polish
- [ ] T026 [P] Run accessibility audit with Pa11y
- [ ] T027 Performance testing with Lighthouse
- [ ] T028 [P] Update CLAUDE.md with new features
- [ ] T029 Run `pnpm run lint` and fix issues
- [ ] T030 Run `pnpm run type-check`
- [ ] T031 Update PRP status dashboard

## Dependencies
- Tests (T005-T008) before implementation (T009-T017)
- Component generation (T009) before implementation (T010-T012)
- Core features before integration (T013-T017 before T018-T025)
- Integration before polish (T018-T025 before T026-T031)

## Parallel Example
```
# Launch T005-T008 together (different test files):
Task: "Component unit tests in ComponentName.test.tsx"
Task: "Accessibility tests in ComponentName.accessibility.test.tsx"
Task: "Integration tests in src/tests/integration/"
Task: "E2E tests with Playwright in e2e/"
```

## CRUDkit-Specific Commands
```bash
# Component generation (replaces manual creation)
pnpm run generate:component ComponentName

# Docker development
docker compose up
docker compose exec crudkit pnpm test

# Testing commands
pnpm test                # Vitest unit tests
pnpm test:e2e           # Playwright E2E tests
pnpm test:a11y          # Pa11y accessibility tests
pnpm test:coverage      # Coverage report

# Sprint planning
pnpm run sprint:plan    # Full sprint planning
pnpm run sprint:status  # Check sprint status

# Code quality
pnpm run lint           # ESLint
pnpm run type-check     # TypeScript validation
pnpm run validate:structure  # Component structure check
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Avoid: vague tasks, same file conflicts

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - Each contract file → contract test task [P]
   - Each endpoint → implementation task
   
2. **From Data Model**:
   - Each entity → model creation task [P]
   - Relationships → service layer tasks
   
3. **From User Stories**:
   - Each story → integration test [P]
   - Quickstart scenarios → validation tasks

4. **Ordering**:
   - Setup → Tests → Models → Services → Endpoints → Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [ ] All contracts have corresponding tests
- [ ] All entities have model tasks
- [ ] All tests come before implementation
- [ ] Parallel tasks truly independent
- [ ] Each task specifies exact file path
- [ ] No task modifies same file as another [P] task