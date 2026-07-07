# Tasks: Geolocation Map

**Input**: Design documents from `/specs/014-geolocation-map/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → ✓ Found: Next.js 15.5, Leaflet 1.9.4, react-leaflet 4.2.1
   → ✓ Structure: Single project (src/, tests/, app/)
2. Load optional design documents:
   → ✓ data-model.md: 5 entities extracted
   → ✓ contracts/: component-interfaces.ts found
   → ✓ research.md: Technical decisions loaded
3. Generate tasks by category:
   → Setup: Dependencies, CSP, configuration
   → Tests: Component tests, integration tests
   → Core: Hook, components (5-file structure)
   → Integration: GDPR consent, PWA caching
   → Polish: Accessibility, performance, docs
4. Apply task rules:
   → [P] marked for parallel component generation
   → Sequential for shared files (consent context)
   → Tests before implementation (TDD)
5. Number tasks: T001-T032
6. Dependencies mapped
7. Parallel execution examples included
8. Validation: ✓ Complete coverage
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/`, `app/` at repository root
- Components follow 5-file structure in `src/components/`
- Hooks in `src/hooks/`, utils in `src/utils/`

## Phase 3.1: Setup

- [ ] T001 Install Leaflet dependencies: leaflet react-leaflet @types/leaflet
- [ ] T002 Configure Next.js dynamic imports for Leaflet SSR issues
- [ ] T003 Update CSP headers for OpenStreetMap tile servers
- [ ] T004 [P] Create map utilities file at src/utils/map-utils.ts
- [ ] T005 [P] Configure Leaflet CSS fixes in src/app/globals.css

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] T006 [P] Test useGeolocation hook in src/hooks/useGeolocation.test.ts
- [ ] T007 [P] Test MapContainer component in src/components/map/MapContainer/MapContainer.test.tsx
- [ ] T008 [P] Test LocationButton component in src/components/map/LocationButton/LocationButton.test.tsx
- [ ] T009 [P] Test LocationMarker component in src/components/map/LocationMarker/LocationMarker.test.tsx
- [ ] T010 [P] Test GeolocationConsent modal in src/components/map/GeolocationConsent/GeolocationConsent.test.tsx
- [ ] T011 [P] Integration test permission flow in tests/integration/geolocation-flow.test.tsx
- [ ] T012 [P] Integration test consent flow in tests/integration/consent-integration.test.tsx
- [ ] T013 [P] E2E test map page in e2e/map.spec.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Hooks & Utilities

- [ ] T014 Implement useGeolocation hook in src/hooks/useGeolocation.ts
- [ ] T015 Implement map utilities in src/utils/map-utils.ts

### Component Generation (Use pnpm run generate:component)

- [ ] T016 Generate MapContainer component (5-file structure)
- [ ] T017 Generate LocationButton component (5-file structure)
- [ ] T018 Generate LocationMarker component (5-file structure)
- [ ] T019 Generate GeolocationConsent component (5-file structure)

### Component Implementation

- [ ] T020 Implement MapContainer with Leaflet integration
- [ ] T021 Implement LocationButton with permission states
- [ ] T022 Implement LocationMarker with accuracy circle
- [ ] T023 Implement GeolocationConsent with GDPR integration

### Page Creation

- [ ] T024 Create map demo page at app/map/page.tsx
- [ ] T025 Add navigation link to map page in header

## Phase 3.4: Integration

- [ ] T026 Extend consent context for geolocation in src/contexts/consent-context.tsx
- [ ] T027 Configure service worker for tile caching
- [ ] T028 Implement offline tile caching strategy
- [ ] T029 Add Storybook stories for all map components
- [ ] T030 Accessibility testing and fixes with Pa11y

## Phase 3.5: Polish

- [ ] T031 [P] Performance optimization with lazy loading
- [ ] T032 [P] Bundle size analysis and optimization
- [ ] T033 [P] Update project-status.json with map feature
- [ ] T034 [P] Documentation in /docs/features/geolocation-map.md
- [ ] T035 Run quickstart.md verification checklist
- [ ] T036 Final test suite run with coverage check

## Dependencies

- Setup (T001-T005) blocks all other tasks
- Tests (T006-T013) before implementation (T014-T025)
- Component generation (T016-T019) before implementation (T020-T023)
- T014 (hook) blocks T020-T022 (components using hook)
- T026 (consent) blocks T023 (consent modal)
- Core implementation before integration (T026-T030)
- Everything before polish (T031-T036)

## Parallel Example

```bash
# Phase 3.1 - Run T004 and T005 in parallel:
Task agent: "Create map utilities file at src/utils/map-utils.ts"
Task agent: "Configure Leaflet CSS fixes in src/app/globals.css"

# Phase 3.2 - Launch all test tasks together (T006-T013):
Task agent: "Test useGeolocation hook in src/hooks/useGeolocation.test.ts"
Task agent: "Test MapContainer component"
Task agent: "Test LocationButton component"
Task agent: "Test LocationMarker component"
Task agent: "Test GeolocationConsent modal"
Task agent: "Integration test permission flow"
Task agent: "Integration test consent flow"
Task agent: "E2E test map page"

# Phase 3.3 - Generate all components in parallel (T016-T019):
docker compose exec scripthammer pnpm run generate:component
# Select: atomic, MapContainer
docker compose exec scripthammer pnpm run generate:component
# Select: atomic, LocationButton
docker compose exec scripthammer pnpm run generate:component
# Select: atomic, LocationMarker
docker compose exec scripthammer pnpm run generate:component
# Select: atomic, GeolocationConsent

# Phase 3.5 - Polish tasks in parallel (T031-T034):
Task agent: "Performance optimization with lazy loading"
Task agent: "Bundle size analysis and optimization"
Task agent: "Update project-status.json"
Task agent: "Documentation in /docs/features/geolocation-map.md"
```

## Notes

- **5-file pattern**: All components MUST use the generator for consistency
- **TDD strict**: Tests must fail first - no skipping RED phase
- **CSP critical**: Update headers before testing map tiles
- **SSR handling**: Dynamic imports required for all map components
- **GDPR compliance**: Consent required before geolocation access
- **Offline support**: Service worker integration with existing PWA
- **Accessibility**: WCAG AA compliance required (keyboard nav, ARIA)
- **Bundle target**: < 100KB additional bundle size

## Task Generation Rules

_Applied during main() execution_

1. **From Contracts**:
   - component-interfaces.ts → 5 component test tasks [P]
   - Each component interface → implementation task

2. **From Data Model**:
   - GeolocationState → useGeolocation hook
   - MapConfiguration → MapContainer props
   - MarkerData → LocationMarker component
   - GeolocationConsent → consent modal

3. **From Quickstart Scenarios**:
   - Permission prompt → integration test
   - Permission denied → error handling test
   - Offline usage → service worker test
   - Custom markers → marker test
   - Mobile responsive → E2E test
   - Accessibility → Pa11y test

4. **Ordering**:
   - Dependencies → Tests → Components → Integration → Polish
   - Hook before components that use it
   - Consent extension before consent modal

## Validation Checklist

_GATE: Checked by main() before returning_

- [x] All component interfaces have test tasks
- [x] All entities have implementation tasks
- [x] All tests come before implementation
- [x] Parallel tasks truly independent
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] 5-file structure enforced for components
- [x] TDD cycle explicitly stated

## Time Estimates

- **Phase 3.1 (Setup)**: 1 hour
- **Phase 3.2 (Tests)**: 3 hours
- **Phase 3.3 (Implementation)**: 4 hours
- **Phase 3.4 (Integration)**: 2 hours
- **Phase 3.5 (Polish)**: 2 hours
- **Total**: ~12 hours (1.5 days)

## Success Criteria

- [ ] All 36 tasks completed
- [ ] Tests pass with > 80% coverage
- [ ] Bundle size < 100KB impact
- [ ] Lighthouse score > 90
- [ ] No accessibility violations
- [ ] Quickstart scenarios verified
- [ ] Map works offline
- [ ] GDPR compliant

---

_Generated from /plan artifacts | Ready for execution_
