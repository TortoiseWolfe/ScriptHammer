# Tasks: Fix Auth System Failures

**Input**: Design documents from `/specs/028-fix-auth-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create utility functions and extend types needed by all stories

- [ ] T001 [P] Create retry utility with exponential backoff in `src/lib/auth/retry-utils.ts`
  - Export `sleep(ms: number): Promise<void>`
  - Export `retryWithBackoff<T>(fn, maxRetries=3, delays=[1000,2000,4000]): Promise<T>`
  - Include proper TypeScript types

- [ ] T002 [P] Add AuthError interface to AuthContext types in `src/contexts/AuthContext.tsx`
  - Add `AuthError` interface: `{ code: 'TIMEOUT'|'NETWORK'|'AUTH_FAILED'|'UNKNOWN', message: string, retryable: boolean }`
  - Extend `AuthState` with `error: AuthError | null` and `retryCount: number`
  - Extend `AuthContextType` with `retry(): Promise<void>` and `clearError(): void`

**Checkpoint**: Types and utilities ready for implementation

---

## Phase 2: User Story 1 - Reliable Sign-In (Priority: P1) 🎯

**Goal**: Sign-in button works reliably on first click with proper error feedback

**Independent Test**: Click sign-in with valid credentials → authenticated within 3 seconds

### Tests for User Story 1

- [ ] T003 [P] [US1] Write unit test for retry utility in `src/lib/auth/retry-utils.test.ts`
  - Test successful retry after transient failure
  - Test max retries exceeded throws error
  - Test backoff delays are correct

- [ ] T004 [P] [US1] Write unit test for AuthContext error state in `src/contexts/AuthContext.test.tsx`
  - Test error state is set on getSession failure
  - Test retry() clears error and retries
  - Test clearError() clears error state

### Implementation for User Story 1

- [ ] T005 [US1] Implement getSessionWithRetry in `src/contexts/AuthContext.tsx`
  - Replace direct `getSession()` call with retry wrapper
  - Use exponential backoff from retry-utils
  - Set error state on final failure with retryable=true
  - Clear loadingTimeout on success OR final failure

- [ ] T006 [US1] Add retry() method to AuthContext in `src/contexts/AuthContext.tsx`
  - Clear current error state
  - Reset retryCount to 0
  - Re-run getSessionWithRetry

- [ ] T007 [US1] Add clearError() method to AuthContext in `src/contexts/AuthContext.tsx`
  - Set error to null
  - Keep retryCount for debugging

- [ ] T008 [US1] Handle checkRateLimit errors in `src/components/auth/SignInForm/SignInForm.tsx`
  - Wrap checkRateLimit call in try/catch
  - Show error alert if rate limit check fails
  - Allow form submission even if rate limit check fails (fail-open for better UX)

> **Note**: FR-008 (loading indicators) is already implemented in SignInForm.tsx lines 164-165. No new task required.

**Checkpoint**: Sign-in works reliably with retry logic and error feedback

---

## Phase 3: User Story 2 - Working Sign-Out (Priority: P1)

**Goal**: Sign-out reliably clears session and redirects to home

**Independent Test**: Click sign-out → redirected to home page within 2 seconds

### Tests for User Story 2

- [ ] T009 [P] [US2] Write unit test for fail-safe signOut in `src/contexts/AuthContext.test.tsx`
  - Test local state cleared before Supabase call
  - Test redirect happens even if Supabase call fails
  - Test page reload clears React state

### Implementation for User Story 2

- [ ] T010 [US2] Implement fail-safe signOut in `src/contexts/AuthContext.tsx`
  - Clear local state (setUser(null), setSession(null)) FIRST
  - Then call supabase.auth.signOut() without awaiting
  - Catch and log any Supabase errors (don't throw)
  - Force redirect: `window.location.href = '/'`

**Checkpoint**: Sign-out works reliably with fail-safe behavior

---

## Phase 4: User Story 3 - Conversations Page Loads (Priority: P2)

**Goal**: Conversations page shows content or error, never infinite spinner

**Independent Test**: Navigate to /conversations → see conversations list or error within 5 seconds

### Tests for User Story 3

- [ ] T011 [P] [US3] Write E2E test for conversations page loading in `tests/e2e/auth/conversations.spec.ts`
  - Test page loads with conversations list
  - Test empty state shows message
  - Test auth error shows error alert with retry

### Implementation for User Story 3

- [ ] T012 [US3] Handle auth error state in `src/app/conversations/page.tsx`
  - Import `error`, `retry`, `clearError` from useAuth()
  - If authLoading timeout + error, show DaisyUI alert
  - Add retry button to error alert
  - Remove infinite spinner possibility

**Checkpoint**: Conversations page handles all auth states gracefully

---

## Phase 5: User Story 4 - Auth State Recovery (Priority: P2)

**Goal**: Users can recover from auth failures with clear feedback

**Independent Test**: Simulate auth timeout → see error message with retry button → click retry → auth succeeds

### Tests for User Story 4

- [ ] T013 [P] [US4] Write E2E test for auth recovery flow in `tests/e2e/auth/recovery.spec.ts`
  - Test timeout shows error with retry button
  - Test retry button initiates new auth attempt
  - Test "Sign in again" clears session and redirects

### Implementation for User Story 4

- [ ] T014 [US4] Implement cross-tab sign-out detection in `src/contexts/AuthContext.tsx`
  - In onAuthStateChange listener, check for SIGNED_OUT event
  - If SIGNED_OUT detected (from another tab), redirect: `window.location.href = '/'`
  - Ensure redirect doesn't fire for local signOut (already redirecting)

- [ ] T015 [US4] Add auth error messages to constants
  - Create error messages object in AuthContext or separate file
  - TIMEOUT: "Authentication taking longer than expected"
  - NETWORK: "Unable to connect. Check your internet connection."
  - AUTH_FAILED: "Sign in failed. Please try again."
  - UNKNOWN: "Something went wrong. Please try again."

**Checkpoint**: All auth failure scenarios have clear recovery paths

---

## Phase 6: Polish & Integration

**Purpose**: Ensure all stories work together and pass validation

- [ ] T016 [P] Run existing auth tests to ensure no regressions
  - `docker compose exec scripthammer pnpm test src/contexts/AuthContext`
  - `docker compose exec scripthammer pnpm test src/components/auth`

- [ ] T017 [P] Run E2E auth tests
  - `docker compose exec scripthammer pnpm exec playwright test tests/e2e/auth/`

- [ ] T018 [P] Run type-check and lint
  - `docker compose exec scripthammer pnpm run type-check`
  - `docker compose exec scripthammer pnpm run lint`

- [ ] T019 Manual verification on local environment
  - Test sign-in flow end-to-end
  - Test sign-out flow end-to-end
  - Test conversations page loading
  - Test cross-tab sign-out (open two tabs, sign out in one)

- [ ] T020 Commit changes with descriptive message
  - Stage all modified files
  - Commit: "fix(auth): add retry logic, fail-safe signOut, cross-tab sync"

**Checkpoint**: All tests pass, feature ready for PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - T001 and T002 can run in parallel
- **Phase 2 (US1)**: Depends on T001 (retry-utils) and T002 (types)
- **Phase 3 (US2)**: Depends on T002 (types) - can run parallel with Phase 2
- **Phase 4 (US3)**: Depends on T002 (types) - can run parallel with Phase 2/3
- **Phase 5 (US4)**: Depends on T002 (types) and T005 (retry logic)
- **Phase 6 (Polish)**: Depends on all implementation tasks

### Within Each Phase

- Tests SHOULD be written first (TDD)
- Implementation follows test failures
- Same file = sequential
- Different files = can be parallel [P]

### Parallel Opportunities

```bash
# Phase 1 - Run in parallel:
Task: "T001 - Create retry utility"
Task: "T002 - Add AuthError interface"

# Phase 2/3/4 Tests - Run in parallel:
Task: "T003 - Unit test for retry utility"
Task: "T004 - Unit test for AuthContext error state"
Task: "T009 - Unit test for fail-safe signOut"
Task: "T011 - E2E test for conversations page"
Task: "T013 - E2E test for auth recovery"

# Phase 6 - Run in parallel:
Task: "T016 - Run existing auth tests"
Task: "T017 - Run E2E auth tests"
Task: "T018 - Run type-check and lint"
```

---

## Critical File Summary

| File                                            | Tasks                                    | Changes                          |
| ----------------------------------------------- | ---------------------------------------- | -------------------------------- |
| `src/lib/auth/retry-utils.ts`                   | T001                                     | NEW: Retry utility functions     |
| `src/contexts/AuthContext.tsx`                  | T002, T005, T006, T007, T010, T014, T015 | Types, retry, signOut, cross-tab |
| `src/components/auth/SignInForm/SignInForm.tsx` | T008                                     | Error handling for rate limit    |
| `src/app/conversations/page.tsx`                | T012                                     | Auth error state handling        |

---

## Notes

- Total tasks: 20
- Parallel-capable: 12 tasks marked [P]
- Files modified: 4 (3 existing + 1 new)
- Estimated effort: 4-6 hours
- All changes in `src/` - no database migrations needed
