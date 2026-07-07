# Tasks: Colorblind Mode

**Input**: Design documents from `/specs/005-colorblind-mode/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓)

## Execution Flow (main)

```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript, React, CSS Filters
   → Structure: Web app (frontend feature)
2. Load design documents ✓
   → data-model.md: ColorblindType, ColorblindSettings, filters
   → contracts/: Component props, context interfaces
   → research.md: SVG filters, performance targets
3. Generate tasks by category (see below)
4. Apply TDD rules: Tests before implementation
5. Number tasks sequentially (T001-T030)
6. Mark parallel tasks with [P]
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- Frontend components: `src/components/atomic/`
- Utilities: `src/utils/`
- Hooks: `src/hooks/`
- Styles: `src/styles/`
- Tests: Colocated with components

## Phase 3.1: Setup

- [ ] T001 Create colorblind type definitions in `src/utils/colorblind.ts`
- [ ] T002 [P] Create colorblind filter matrices in `src/utils/colorblind-matrices.ts`
- [ ] T003 [P] Create pattern overlay styles in `src/styles/colorblind-patterns.css`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### Component Tests (RED Phase)

- [ ] T004 Write failing test for ColorblindToggle component in `src/components/atomic/ColorblindToggle/ColorblindToggle.test.tsx`
- [ ] T005 [P] Write failing test for ColorblindFilters component in `src/components/atomic/ColorblindFilters/ColorblindFilters.test.tsx`
- [ ] T006 [P] Write failing accessibility test for ColorblindToggle in `src/components/atomic/ColorblindToggle/ColorblindToggle.accessibility.test.tsx`
- [ ] T007 [P] Write failing accessibility test for ColorblindFilters in `src/components/atomic/ColorblindFilters/ColorblindFilters.accessibility.test.tsx`

### Hook Tests (RED Phase)

- [ ] T008 Write failing test for useColorblindMode hook in `src/hooks/useColorblindMode.test.ts`
- [ ] T009 [P] Write test for localStorage persistence in hook test file
- [ ] T010 [P] Write test for filter application logic in hook test file

### Integration Tests (RED Phase)

- [ ] T011 Write failing integration test with AccessibilityContext
- [ ] T012 [P] Write failing theme compatibility test for all 32 themes

## Phase 3.3: Core Implementation (GREEN Phase)

### Utilities Implementation

- [ ] T013 Implement ColorblindType enum and base types (make T001 pass)
- [ ] T014 [P] Implement filter matrices with validated values (make T002 pass)
- [ ] T015 [P] Implement pattern overlay CSS classes (make T003 pass)

### Hook Implementation

- [ ] T016 Implement useColorblindMode hook with state management (make T008 pass)
- [ ] T017 Add localStorage persistence to hook (make T009 pass)
- [ ] T018 Add filter application logic to hook (make T010 pass)

### Component Implementation

- [ ] T019 Generate ColorblindToggle component structure using Plop
- [ ] T020 Implement ColorblindToggle component logic (make T004 pass)
- [ ] T021 [P] Generate ColorblindFilters component structure using Plop
- [ ] T022 [P] Implement ColorblindFilters SVG filters (make T005 pass)
- [ ] T023 Ensure ColorblindToggle passes accessibility tests (make T006 pass)
- [ ] T024 [P] Ensure ColorblindFilters passes accessibility tests (make T007 pass)

## Phase 3.4: Integration

### Context Integration

- [ ] T025 Extend AccessibilityContext with colorblind settings (make T011 pass)
- [ ] T026 Add ColorblindFilters to app layout at `src/app/layout.tsx`
- [ ] T027 Add ColorblindToggle to accessibility page at `src/app/accessibility/page.tsx`

### Theme Testing

- [ ] T028 Verify all 32 DaisyUI themes work with filters (make T012 pass)

## Phase 3.5: Polish & Documentation

### Storybook

- [ ] T029 [P] Create Storybook stories for ColorblindToggle
- [ ] T030 [P] Create Storybook stories for ColorblindFilters

### Performance Validation

- [ ] T031 Measure and optimize filter application time (< 10ms requirement)
- [ ] T032 [P] Test pattern overlay performance impact

### Documentation

- [ ] T033 [P] Update CLAUDE.md with colorblind implementation details
- [ ] T034 [P] Update component documentation with usage examples

## Parallel Execution Examples

**Batch 1** (can run simultaneously):

```bash
# Terminal 1
Task agent: "Execute T002 - Create filter matrices"

# Terminal 2
Task agent: "Execute T003 - Create pattern styles"

# Terminal 3
Task agent: "Execute T005 - Write ColorblindFilters test"
```

**Batch 2** (after utilities complete):

```bash
# Terminal 1
Task agent: "Execute T014 - Implement filter matrices"

# Terminal 2
Task agent: "Execute T015 - Implement pattern CSS"
```

## Validation Checklist

- ✅ All component contracts have tests (T004-T007)
- ✅ All data model entities have implementations (T013-T015)
- ✅ All hooks have tests and implementations (T008-T010, T016-T018)
- ✅ Integration with existing system (T025-T027)
- ✅ Performance requirements validated (T031-T032)

## Dependencies Graph

```
Setup (T001-T003)
    ↓
Tests (T004-T012) [TDD - must fail first]
    ↓
Implementation (T013-T024) [Make tests pass]
    ↓
Integration (T025-T028)
    ↓
Polish (T029-T034)
```

## Success Criteria

- All tests pass (100% of defined tests)
- Performance < 10ms filter application
- Works with all 32 themes
- Accessibility tests pass (jest-axe)
- Storybook stories render correctly

---

_Generated from plan.md and design artifacts using TDD principles_
