# Implementation Tasks: Code Quality Improvements

**Feature**: 040-feature-040-code | **Date**: 2025-11-27
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Task Summary

| Phase     | Description                           | Tasks         | Parallel |
| --------- | ------------------------------------- | ------------- | -------- |
| Phase 1   | Setup & Infrastructure                | T001-T004 (4) | 2        |
| Phase 2   | Foundational (Logger + Result Types)  | T005-T011 (7) | 3        |
| Phase 3   | User Story 1 - Security (P1)          | T012-T015 (4) | 2        |
| Phase 4   | User Story 2 - Logging Migration (P2) | T016-T023 (8) | 6        |
| Phase 5   | User Story 3 - Type Safety (P2)       | T024-T030 (7) | 4        |
| Phase 6   | User Story 4 - Error Handling (P3)    | T031-T036 (6) | 4        |
| Phase 6b  | Edge Cases & Recovery                 | T037-T040 (4) | 2        |
| Phase 7   | Polish & Verification                 | T041-T045 (5) | 3        |
| **Total** |                                       | **45**        | **26**   |

---

## Phase 1: Setup & Infrastructure

**Goal**: Prepare project for code quality refactoring

### T001 - Create feature branch tracking [X]

```
File: specs/040-feature-040-code/CHANGELOG.md
Action: CREATE new file to track changes during implementation
Content: Feature changelog with sections for each user story
```

### T002 - Create logger test mock helper [P] [X]

```
File: src/test/mocks/logger.ts
Action: CREATE test helper for mocking logger in tests
Content: mockLogger object and createMockLogger factory per research.md
Reference: research.md §Topic 5
```

### T003 - Verify existing test suite passes [P] [X]

```
Command: docker compose exec scripthammer pnpm test
Action: RUN full test suite to establish baseline
Expected: All tests pass (SC-007 baseline)
Result: 207 passed, 2 skipped, 2136 tests passed
```

### T004 - Verify TypeScript compilation passes [X]

```
Command: docker compose exec scripthammer pnpm run type-check
Action: RUN TypeScript compiler to establish baseline
Expected: No errors (SC-008 baseline)
Result: No errors
```

**Checkpoint**: Baseline established, test infrastructure ready

---

## Phase 2: Foundational - Logger Service & Result Types

**Goal**: Create shared infrastructure needed by all user stories
**Must complete before**: Any user story implementation

### T005 - Create ServiceResult type definition [P] [X]

```
File: src/types/result.ts
Action: CREATE new file implementing Result contract
Content: ServiceResult<T> type, success(), failure(), isSuccess(), isFailure(), tryCatch()
Reference: contracts/result.ts
```

### T006 - Create Logger service - unit tests (TDD: RED) [P] [X]

```
File: src/lib/logger/logger.test.ts
Action: CREATE unit tests FIRST (Test-First Development per Constitution §II)
Content: Tests for all log levels, environment detection, timestamp formatting, context serialization
Coverage: 100% required (SC-006)
Reference: quickstart.md §4
Result: 28 tests created, all pass
```

### T007 - Create Logger service - core implementation (TDD: GREEN) [X]

```
File: src/lib/logger/logger.ts
Action: CREATE implementation to make tests pass (GREEN phase)
Content: LogLevel enum, LoggerConfig, Logger interface, createLogger factory
Reference: contracts/logger.ts, data-model.md §1
Depends: T006
Result: All 28 tests pass (TDD GREEN complete)
```

### T008 - Create Logger service - barrel export [X]

```
File: src/lib/logger/index.ts
Action: CREATE barrel export
Content: Export all from logger.ts, export default logger instance
Depends: T007
```

### T009 - Create Logger service - Storybook demo [X]

```
File: src/lib/logger/logger.stories.tsx
Action: CREATE Storybook story demonstrating logger usage
Content: Interactive demo showing log levels, categories, environment switching
Depends: T007, T008
```

### T010 - Create Logger service - accessibility test (5-file pattern) [X]

```
File: src/lib/logger/logger.accessibility.test.ts
Action: CREATE accessibility test file per Constitution §I (5-file pattern)
Content: Minimal test documenting that logger is non-UI utility with no accessibility requirements
Note: Required for 5-file pattern compliance even though logger has no UI
Depends: T007
Result: 2 tests pass, 5-file pattern satisfied
```

### T011 - Export Result types from types index [X]

```
File: src/types/index.ts (or create if not exists)
Action: MODIFY to add ServiceResult exports
Content: Export { ServiceResult, success, failure, isSuccess, isFailure, tryCatch } from './result'
Depends: T005
```

**Checkpoint**: Logger service and Result types available for all stories (TDD complete, 5-file pattern satisfied)

---

## Phase 3: User Story 1 - Security Compliance (P1)

**Goal**: Remove CSP unsafe-eval and verify no secret exposure
**Independent Test**: Inspect CSP headers in DevTools, search bundle for secrets

### T012 - Remove unsafe-eval from CSP header [X]

```
File: src/app/layout.tsx
Line: 93
Action: MODIFY CSP script-src directive
Change: Remove 'unsafe-eval' from script-src
Before: "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com..."
After:  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com..."
Reference: research.md §Topic 1
Result: unsafe-eval removed from CSP script-src directive
```

### T013 - Update security documentation [P] [X]

```
File: docs/project/SECURITY.md
Action: MODIFY to document complete CSP policy and removal of unsafe-eval
Content: Added all 11 CSP directives with explanations, noted unsafe-eval removal
Reference: research.md §Topic 1
Result: SECURITY.md updated with comprehensive CSP documentation
```

### T014 - Add code clarity to payment config [P] [X]

```
File: src/config/payment.ts
Action: MODIFY comments for clarity
Change: Added Security Classification JSDoc header
Content: Lists all public vs private env vars with security implications
Reference: research.md §Topic 4
Result: Clear documentation of 6 public and 6 private variables
```

### T015 - Verify security changes [Story US1] [X]

```
Command: docker compose exec scripthammer pnpm run type-check
Action: RUN TypeScript compilation to verify changes don't break
Expected: No TypeScript errors
Result: TypeScript compilation passes
Acceptance: SC-001, SC-002 - CSP hardened, payment config documented
```

**Checkpoint US1**: Security compliance verified - CSP hardened, no secret exposure

---

## Phase 4: User Story 2 - Structured Logging (P2)

**Goal**: Replace all 361 console.log statements with logger service across src/\*_
**Independent Test**: Run app and verify logs use structured format
**Exemption**: console.log IS allowed in _.test.ts, _.test.tsx, _.stories.tsx files (test/documentation purposes)

### T016 - Replace console.log in src/services/auth/\*\* [P] [Story US2] [X]

```
Files: src/services/auth/*.ts
Action: MODIFY all files to use logger instead of console.*
Pattern: Replace console.log/warn/error with logger.debug/info/warn/error
Add: import { createLogger } from '@/lib/logger'; const logger = createLogger('auth:audit');
Count: 2 occurrences migrated
Result: audit-logger.ts migrated to structured logger
```

### T017 - Replace console.log in src/services/messaging/\*\* [P] [Story US2] [X]

```
Files: src/services/messaging/*.ts
Action: MODIFY all files to use logger
Pattern: Same as T016
Category: 'messaging:keys', 'messaging:messages'
Count: ~38 occurrences migrated
Result: key-service.ts (17), message-service.ts (21) migrated to logger
```

### T018 - Replace console.log in src/lib/\*\* [P] [Story US2]

```
Files: src/lib/**/*.ts (excluding logger/)
Action: MODIFY all files to use logger
Pattern: Same as T016
Categories: 'supabase', 'auth', 'payments', 'messaging', 'avatar', 'blog', 'profile'
Count: ~50 occurrences
Status: In Progress
```

### T019 - Replace console.log in src/hooks/\*\* [P] [Story US2] [X]

```
Files: src/hooks/*.ts
Action: MODIFY all files to use logger
Pattern: Same as T016
Category: 'hooks:offlineQueue'
Count: 9 occurrences migrated
Result: useOfflineQueue.ts migrated, test file updated with mock logger
```

### T020 - Replace console.log in src/contexts/\*\* [P] [Story US2] [X]

```
Files: src/contexts/*.tsx
Action: MODIFY all files to use logger
Pattern: Same as T016
Categories: 'contexts:auth'
Count: 6 occurrences migrated
Result: AuthContext.tsx migrated to logger
```

### T021 - Replace console.log in src/components/\*\* [P] [Story US2]

```
Files: src/components/**/*.tsx (excluding *.stories.tsx, *.test.tsx)
Action: MODIFY all component files to use logger
Pattern: Same as T016
Categories: Based on component domain
Count: ~80 occurrences
Exemption: *.test.tsx and *.stories.tsx files MAY retain console.log for debugging/documentation
```

### T022 - Replace console.log in src/utils/\*\* [Story US2]

```
Files: src/utils/*.ts
Action: MODIFY all utility files to use logger
Pattern: Same as T016
Categories: 'pwa', 'analytics', 'email', 'performance'
Count: ~70 occurrences
Depends: T018 (shares some patterns)
```

### T023 - Verify zero console.log in src/\*\* (excluding tests/stories) [Story US2]

```
Command: grep -r "console\.\(log\|warn\|error\|debug\|info\)" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v "\.stories\." | grep -v "logger.ts"
Action: RUN grep to verify no console.* usage remains in production code
Expected: Zero matches (SC-003)
Acceptance: SC-003
Note: Test and story files are explicitly exempt from this requirement
```

**Checkpoint US2**: All src/\*\* production files use structured logger (361 replacements)

---

## Phase 5: User Story 3 - Type Safety (P2)

**Goal**: Eliminate all `as any` assertions in service files
**Independent Test**: Run `pnpm type-check` and grep for `as any`

### T024 - Create messaging types extension [P] [Story US3]

```
File: src/lib/supabase/messaging-types.ts
Action: CREATE new file with messaging table types
Content: ConnectionStatus, UserConnection, Conversation, Message, MessagingTables
Reference: data-model.md §3
```

### T025 - Create typed messaging client wrapper [Story US3]

```
File: src/lib/supabase/messaging-client.ts
Action: CREATE typed wrapper merging messaging types with Database
Content: getMessagingClient() function returning properly typed client
Depends: T024
```

### T026 - Create Zod schemas for external API responses [P] [Story US3]

```
File: src/schemas/external-api.ts
Action: CREATE Zod validation schemas for external API data
Content: Schemas for any external APIs used (e.g., payment webhooks, OAuth responses)
Reference: spec.md US3 Acceptance Scenario 3
Note: Ensures runtime type validation for data from external sources
```

### T027 - Fix `as any` in message-service.ts [P] [Story US3]

```
File: src/services/messaging/message-service.ts
Action: MODIFY to use typed client instead of (supabase as any)
Count: 17 occurrences
Pattern: Replace (supabase as any) with getMessagingClient()
Depends: T025
```

### T028 - Fix `as any` in remaining messaging services [P] [Story US3]

```
Files:
  - src/services/messaging/gdpr-service.ts (8)
  - src/services/messaging/connection-service.ts
  - src/services/messaging/key-service.ts
  - src/services/messaging/offline-queue-service.ts
Action: MODIFY all to use typed client
Pattern: Same as T027
Depends: T025
```

### T029 - Fix `as any` in hooks and components [Story US3]

```
Files:
  - src/hooks/useConversationRealtime.ts
  - src/hooks/useUnreadCount.ts
  - src/components/organisms/ConversationList/useConversationList.ts
  - src/lib/messaging/realtime.ts
  - src/app/messages/page.tsx
Action: MODIFY all to use typed client
Pattern: Same as T027
Depends: T025
```

### T030 - Verify zero `as any` in services [Story US3]

```
Command: grep -r "as any" src/services/ --include="*.ts"
Action: RUN grep to verify no as any assertions
Expected: Zero matches (SC-004)
Acceptance: SC-004
```

**Checkpoint US3**: Type safety restored - all messaging queries properly typed, external API data validated

---

## Phase 6: User Story 4 - Error Handling (P3)

**Goal**: Replace silent catch blocks with proper error handling
**Independent Test**: Trigger error conditions and verify meaningful messages

### T031 - Fix empty catch blocks (Priority 1) [P] [Story US4]

```
Files:
  - src/lib/supabase/server.ts:68
  - src/lib/messaging/database.ts:47
Action: MODIFY to add logging and return ServiceResult
Pattern: Add logger.warn/error with context, return { data: null, error }
Reference: research.md §Topic 3 Priority 1
```

### T032 - Fix silent return catch blocks (Priority 2) [P] [Story US4]

```
Files:
  - src/services/messaging/key-service.ts:317
  - src/lib/supabase/client.ts:107
  - src/lib/avatar/validation.ts:70
Action: MODIFY to add logging before return
Pattern: Add logger.error with context (function name, parameters)
Reference: research.md §Topic 3 Priority 2
```

### T033 - Fix minimal logging catch blocks (Priority 3) [P] [Story US4]

```
Files:
  - src/services/auth/audit-logger.ts:177
  - src/lib/auth/rate-limiter.ts:122
  - src/lib/auth/rate-limit-check.ts:52, 94
  - src/lib/auth/oauth-state.ts:59, 144
  - src/lib/avatar/upload.ts:101, 161
Action: MODIFY to add context to existing logs
Pattern: Add identifier, operation name, relevant parameters to log context
Reference: research.md §Topic 3 Priority 3
```

### T034 - Refactor key service functions to use ServiceResult [P] [Story US4]

```
File: src/services/messaging/key-service.ts
Action: MODIFY functions to return ServiceResult<T> instead of T | null | boolean
Functions: hasKeys(), getPublicKey(), storeKeyPair()
Pattern: per data-model.md §2
Depends: T005
```

### T035 - Refactor auth service functions to use ServiceResult [Story US4]

```
Files: src/services/auth/*.ts
Action: MODIFY key functions to return ServiceResult<T>
Pattern: Same as T034
Depends: T005
```

### T036 - Verify error handling compliance [Story US4]

```
Command: grep -rn "catch.*{" src/services/ src/lib/ --include="*.ts" -A 5 | grep -E "return (false|null|undefined);?\s*$"
Action: RUN grep to find remaining silent returns
Expected: Zero matches (SC-005)
Acceptance: SC-005
```

**Checkpoint US4**: Error handling improved - no silent failures, all errors logged with context

---

## Phase 6b: Edge Cases & Recovery Flows

**Goal**: Handle edge cases identified in checklist CHK057-CHK064
**Reference**: spec.md §Edge Cases, checklist §Scenario Coverage

### T037 - Handle logger initialization failure [Story US4]

```
File: src/lib/logger/logger.ts
Action: MODIFY to add graceful degradation if logger fails to initialize
Content: Fallback to console.warn with "[LOGGER INIT FAILED]" prefix
Test: Verify app continues if logger constructor throws
Reference: checklist CHK057, CHK061
```

### T038 - Handle missing environment variable startup [P] [Story US1]

```
File: src/config/payment.ts, src/lib/supabase/client.ts
Action: MODIFY to log warning on startup if optional env vars missing
Content: Add logger.warn() calls during initialization for missing vars
Note: App should start but log warnings for missing non-critical vars
Reference: checklist CHK062, spec.md §Edge Cases
```

### T039 - Handle type validation failures on external API [P] [Story US3]

```
File: src/schemas/external-api.ts (created in T026)
Action: MODIFY to add error handling for Zod parse failures
Content: Return ServiceResult with descriptive error, log with context
Test: Verify graceful handling when external API returns unexpected shape
Reference: checklist CHK058, spec.md §US3 Acceptance Scenario 3
Depends: T026
```

### T040 - Handle async errors within useEffect [Story US4]

```
Files:
  - src/hooks/useConversationRealtime.ts
  - src/hooks/useUnreadCount.ts
  - src/contexts/AuthContext.tsx
Action: MODIFY to wrap async operations in try-catch with proper logging
Pattern: Use logger.error() with component name and operation context
Reference: checklist CHK059, spec.md §Edge Cases
```

**Checkpoint Edge Cases**: Edge cases handled with graceful degradation

---

## Phase 7: Polish & Verification

**Goal**: Final verification and cleanup

### T041 - Run full test suite [P]

```
Command: docker compose exec scripthammer pnpm test
Action: RUN all tests
Expected: All tests pass (SC-007)
```

### T042 - Run TypeScript type check [P]

```
Command: docker compose exec scripthammer pnpm run type-check
Action: RUN TypeScript compiler
Expected: No errors (SC-008)
```

### T043 - Run linter [P]

```
Command: docker compose exec scripthammer pnpm run lint
Action: RUN ESLint
Expected: No errors
```

### T044 - Verify logger test coverage

```
Command: docker compose exec scripthammer pnpm test --coverage src/lib/logger/
Action: RUN tests with coverage report
Expected: 100% coverage (SC-006)
```

### T045 - Build production bundle

```
Command: docker compose exec scripthammer pnpm run build
Action: RUN production build
Expected: Build succeeds with no errors
```

**Checkpoint Final**: All success criteria verified

---

## Dependencies Graph

```
Phase 1 (Setup)
  T001 ─┐
  T002 ─┼─► Phase 2
  T003 ─┤
  T004 ─┘

Phase 2 (Foundational) ─────────────────────────────────────┐
  T005 (Result) ──► T011 ──────────────────────────────────┤
  T006 (Logger tests) ──► T007 (impl) ──► T008, T009, T010 │
                                                            │
Phase 3 (US1 Security) ◄────────────────────────────────────┤
  T012 ──► T015                                            │
  T013 [P]                                                 │
  T014 [P]                                                 │
                                                            │
Phase 4 (US2 Logging) ◄── Depends on T007, T008 ───────────┤
  T016-T022 [P] ──► T023                                   │
                                                            │
Phase 5 (US3 Types) ◄──────────────────────────────────────┤
  T024 ──► T025 ──► T027, T028, T029 ──► T030              │
  T026 (Zod) [P]                                           │
                                                            │
Phase 6 (US4 Errors) ◄── Depends on T005, T007 ────────────┤
  T031-T035 [P] ──► T036                                   │
                                                            │
Phase 6b (Edge Cases) ◄── Depends on T007, T026 ───────────┘
  T037 ──► T038 [P], T040
  T039 ◄── T026

Phase 7 (Polish)
  T041-T045 ◄── All phases complete
```

---

## Parallel Execution Examples

### Phase 2 Parallel Group

```bash
# Can run simultaneously:
T005 (Result type)
T006 (Logger tests - TDD RED)

# Then sequential (TDD GREEN):
T007 (Logger impl - depends on T006)

# Then parallel:
T008 (barrel export)
T009 (Storybook demo)
T010 (accessibility test)
T011 (Result type exports - depends on T005)
```

### Phase 4 Parallel Group (Logging Migration)

```bash
# Can run simultaneously after Phase 2:
T016 (auth services)
T017 (messaging services)
T018 (lib/)
T019 (hooks/)
T020 (contexts/)
T021 (components/)

# Then sequential:
T022 (utils/ - shares patterns with T018)
T023 (verification)
```

### Phase 5 Parallel Group (Type Safety)

```bash
# Sequential start:
T024 (messaging types)
T025 (typed client wrapper)

# Then parallel:
T026 (Zod schemas - can start earlier)
T027 (message-service.ts)
T028 (other messaging services)
T029 (hooks and components)

# Then verification:
T030
```

### Phase 6b Parallel Group (Edge Cases)

```bash
# After Phase 6:
T037 (logger init failure)

# Then parallel:
T038 (missing env vars)
T039 (external API validation - depends on T026)
T040 (useEffect errors)
```

---

## Implementation Strategy

### MVP Scope (User Story 1 Only)

If time-constrained, implement only:

- Phase 1: T001-T004 (setup)
- Phase 2: T005-T011 (foundational - required for future stories)
- Phase 3: T012-T015 (US1 security)

This delivers immediate security improvement with CSP hardening.

### Incremental Delivery

Each user story phase can be merged independently:

1. **PR 1**: Phase 1 + Phase 2 + Phase 3 (Security) - Highest priority
2. **PR 2**: Phase 4 (Logging) - High volume but low risk
3. **PR 3**: Phase 5 (Type Safety) - Isolated to messaging
4. **PR 4**: Phase 6 + Phase 6b + Phase 7 (Error Handling + Edge Cases + Polish)

### Risk Mitigation

- Run `pnpm test` after each task group
- Commit after each checkpoint
- Use `git stash` if switching between parallel tasks
