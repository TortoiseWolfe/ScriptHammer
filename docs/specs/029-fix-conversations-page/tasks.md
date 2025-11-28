# Tasks: Fix Conversations Page Infinite Loading Spinner

**Input**: Design documents from `/specs/029-fix-conversations-page/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Organization**: Tasks ordered by debug-first approach per clarification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = Loading Fix, US2 = Error Handling)
- Include exact file paths in descriptions

---

## Phase 1: Diagnostic Logging (FR-001, FR-007)

**Purpose**: Add console.logs to identify exact root cause before implementing fixes

- [x] T001 [US1] Add diagnostic logging to `src/app/conversations/page.tsx`
  - Log at component render with auth state
  - Log when useEffect triggers
  - Log loadConversations entry/exit
  - Log Supabase query start/complete/error
  - All logs prefixed with `[Conversations]`

- [x] T002 [US1] Manual verification - reproduce issue and check console
  - Sign in as test@example.com
  - Navigate to /conversations
  - Open browser DevTools → Console
  - Document where logs stop (identifies root cause)

**Checkpoint**: Root cause identified from console logs

---

## Phase 2: User Story 1 - Conversations Page Loads Successfully (Priority: P1) 🎯 MVP

**Goal**: Page displays content (conversations list or empty state) within 5 seconds for authenticated users

**Independent Test**: Navigate to /conversations while signed in, verify content within 5 seconds

### Implementation for User Story 1

- [x] T003 [US1] Add withTimeout helper function to `src/app/conversations/page.tsx`

  ```typescript
  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), ms)
    );
    return Promise.race([promise, timeout]);
  };
  ```

- [x] T004 [US1] Wrap Supabase query with 10-second timeout in `src/app/conversations/page.tsx`
  - Use withTimeout helper on conversations query
  - Catch timeout error and set appropriate error message

- [x] T005 [US1] Ensure all code paths call setLoading(false) in `src/app/conversations/page.tsx`
  - authLoading=false + user=null → setLoading(false) + setError("Please sign in")
  - Query success → setLoading(false) + setConversations
  - Query error → setLoading(false) + setError
  - Query timeout → setLoading(false) + setError("Timeout")
  - finally block must always execute

- [x] T006 [US1] Manual verification of loading state fix
  - Sign in as test@example.com
  - Navigate to /conversations
  - Verify content or empty state within 5 seconds
  - Verify no infinite spinner

**Checkpoint**: User Story 1 complete - page loads for authenticated users

---

## Phase 3: User Story 2 - Error Handling for Failed Queries (Priority: P2)

**Goal**: Clear error message with retry option when database issues occur

**Independent Test**: Simulate query failure, verify error message and retry button appear

### Implementation for User Story 2

- [x] T007 [US2] Add retry functionality to `src/app/conversations/page.tsx`
  - Ensure loadConversations is callable from error state
  - Add retry button to error UI (if not present)
  - Button onClick triggers loadConversations

- [x] T008 [US2] Improve error messages for user-friendliness
  - Timeout error: "Loading took too long. Please try again."
  - Query error: Display user-friendly message from Supabase error
  - Auth error: "Please sign in to view conversations"

**Checkpoint**: User Story 2 complete - errors handled gracefully with retry

---

## Phase 4: Testing & Validation

**Purpose**: Verify all success criteria are met

- [x] T009 [P] Manual E2E validation
  - Sign in as test@example.com
  - Navigate to /conversations
  - Verify content within 5 seconds (SC-001)
  - Verify no infinite spinner (SC-002)
  - Verify console shows diagnostic logs (SC-004)

- [x] T010 Code validation complete
  - Type-check passes
  - Lint passes
  - No existing E2E tests for /conversations page (messaging tests are for /messages)

**Checkpoint**: All success criteria verified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Diagnostic)**: No dependencies - start immediately
- **Phase 2 (US1 Fix)**: Depends on Phase 1 identifying root cause
- **Phase 3 (US2 Error Handling)**: Can run after Phase 2
- **Phase 4 (Testing)**: Depends on Phases 2 and 3

### Within-Phase Dependencies

- T001 → T002 (logs must exist before checking them)
- T003 → T004 (helper must exist before using it)
- T004 → T005 (timeout must work before verifying all paths)
- T005 → T006 (fix must be in place before manual testing)
- T007 → T008 (retry must work before improving messages)

### Parallel Opportunities

None - all tasks modify the same file (`src/app/conversations/page.tsx`) and must be sequential.

---

## Implementation Strategy

### Sequential Bug Fix

1. Complete Phase 1: Add logging, identify root cause
2. Complete Phase 2: Fix loading state (US1)
3. Complete Phase 3: Add error handling (US2)
4. Complete Phase 4: Validate all success criteria
5. Commit and merge

### Single File Focus

All code changes in: `src/app/conversations/page.tsx`

---

## Notes

- Debug-first approach per user clarification
- Keep diagnostic logs in production code (FR-007)
- All tasks modify same file - no parallel execution
- Commit after each phase completion
- Target: Page content within 5 seconds, query timeout at 10 seconds
