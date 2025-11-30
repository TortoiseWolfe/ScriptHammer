# Tasks: Messages Page Code Quality

**Input**: Design documents from `/specs/009-feature-009-messages/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: This is a refactoring-only feature. Existing tests cover functionality; verification is via type-check, lint, and manual testing per success criteria.

**Organization**: Tasks are grouped by priority phase (P1-P4) to enable incremental implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 0: Setup (Verification Baseline)

**Purpose**: Establish baseline state before any changes

- [x] T001 Run `docker compose exec scripthammer pnpm run type-check` and record current state
- [x] T002 [P] Run `docker compose exec scripthammer pnpm run lint` and record current warnings
- [x] T003 [P] Run `grep -r "err: any" src/app/messages/` to document current violations

**Checkpoint**: Baseline recorded, ready to implement fixes

---

## Phase 1: User Story 1 - Critical Bug Fixes (Priority: P1)

**Goal**: Fix pending connection count, TypeScript safety, memory leaks, and console pollution

**Independent Test**: Type-check passes without `any` warnings, React DevTools shows no memory leak warnings, connection badges update correctly

### Implementation for User Story 1

- [x] T004 [US1] Add `onPendingConnectionCountChange?: (count: number) => void` to UnifiedSidebar interface in `src/components/organisms/UnifiedSidebar/UnifiedSidebar.tsx:25-28`
- [x] T005 [US1] Wire ConnectionManager to call `onPendingConnectionCountChange` when pending count changes in `src/components/organisms/UnifiedSidebar/UnifiedSidebar.tsx`
- [x] T006 [US1] Pass `setPendingConnectionCount` to UnifiedSidebar in `src/app/messages/page.tsx:507-508`
- [x] T007 [P] [US1] Replace `catch (err: any)` with `catch (err: unknown)` at line 284 in `src/app/messages/page.tsx` using pattern:
  ```typescript
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    setError(message);
  }
  ```
- [x] T008 [P] [US1] Replace `catch (err: any)` with `catch (err: unknown)` at line 304 in `src/app/messages/page.tsx`
- [x] T009 [US1] Create `toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)` and store setTimeout in ref at lines 139-149 in `src/app/messages/page.tsx`
- [x] T010 [US1] Add cleanup in useEffect return: `if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)` in `src/app/messages/page.tsx`
- [x] T011 [P] [US1] Remove/replace all `console.warn` statements at lines 198, 217, 232, 240 in `src/app/messages/page.tsx` (use createLogger if debugging needed)

**Checkpoint**: P1 Critical issues resolved - verify with:

- `grep -r "err: any" src/app/messages/` returns empty
- `grep -r "console.warn" src/app/messages/` returns empty
- Manual test: pending connection badge updates when requests exist

---

## Phase 2: User Story 2 - High Priority Code Quality (Priority: P2)

**Goal**: Fix useEffect dependencies and architecture consistency for count callbacks

**Independent Test**: ESLint passes without exhaustive-deps disable comments, both unread/pending counts follow same callback pattern

### Implementation for User Story 2

- [x] T012 [US2] Review and fix useEffect dependencies at lines 154-160 in `src/app/messages/page.tsx`:
  - Either wrap `loadConversationInfo` and `loadMessages` in useCallback and include in deps
  - Or move logic into the effect itself
  - Or document why exclusion is intentional with `// eslint-disable-next-line react-hooks/exhaustive-deps -- [reason]`
- [x] T013 [US2] Ensure ConnectionManager component within UnifiedSidebar calls the new `onPendingConnectionCountChange` callback (verify T005 integration)
- [x] T014 [US2] Verify architecture consistency: both `onUnreadCountChange` and `onPendingConnectionCountChange` should follow identical callback patterns

**Checkpoint**: P2 High priority issues resolved - verify with:

- `grep -r "eslint-disable.*exhaustive-deps" src/app/messages/` shows only documented exceptions
- ConnectionManager bubbles up pending count same as ConversationList bubbles up unread count

---

## Phase 3: User Story 3 - Medium Priority Improvements (Priority: P3)

**Goal**: Standardize code patterns, fix accessibility, stabilize virtual scrolling

**Independent Test**: A11y audit passes, virtual scroll maintains stable keys, className patterns consistent

### Implementation for User Story 3

- [x] T015 [P] [US3] Standardize className in ChatWindow at line 124 in `src/components/organisms/ChatWindow/ChatWindow.tsx`:
  ```typescript
  className={cn('base-classes', className)}
  ```
- [x] T016 [P] [US3] Standardize className in MessageInput at line 144 in `src/components/atomic/MessageInput/MessageInput.tsx`:
  ```typescript
  className={cn('base-classes', className)}
  ```
- [x] T017 [US3] Change aria-label from "Clear search" to "Clear conversation search" at line 145 in `src/components/organisms/ConversationList/ConversationList.tsx`
- [x] T018 [US3] Change virtual scroll key from `virtualItem.key` to `messages[virtualItem.index].id` at line 251 in `src/components/molecular/MessageThread/MessageThread.tsx`
- [x] T019 [US3] Fix race condition in conversation loading (lines 169-246 in `src/app/messages/page.tsx`):
  - Either chain loadConversationInfo then loadMessages
  - Or use single source of truth for participant name
- [x] T020 [US3] Add documented constants for scroll thresholds in `src/components/molecular/MessageThread/MessageThread.tsx`:
  ```typescript
  /** Minimum messages for virtual scrolling (performance threshold) */
  const VIRTUAL_SCROLL_THRESHOLD = 100;
  /** Distance from bottom (px) to show "jump to bottom" button */
  const SHOW_JUMP_BUTTON_THRESHOLD = 500;
  ```

**Checkpoint**: P3 Medium priority issues resolved - verify with:

- `docker compose exec scripthammer pnpm run test:a11y` passes
- Manual test: edit message in long thread, verify no full re-render
- Code review: all className concatenation uses cn() utility

---

## Phase 4: User Story 4 - Low Priority Polish (Priority: P4)

**Goal**: Error boundaries, cleanup patterns, consistent fallbacks, production optimization

**Independent Test**: Error boundary catches ChatWindow errors, Supabase channels properly cleanup, consistent "Unknown User" fallback

### Implementation for User Story 4

- [x] T021 [P] [US4] Conditionally load React Profiler only in development in `src/components/molecular/MessageThread/MessageThread.tsx:9-10`:
  ```typescript
  const ProfilerWrapper =
    process.env.NODE_ENV === 'development' ? React.Profiler : React.Fragment;
  ```
- [x] T022 [US4] Wrap ChatWindow in ErrorBoundary in `src/app/messages/page.tsx`:
  ```typescript
  <ErrorBoundary level="component">
    <ChatWindow ... />
  </ErrorBoundary>
  ```
- [x] T023 [US4] Fix Supabase channel cleanup order in `src/components/organisms/ConversationList/useConversationList.ts:241-304`:
  ```typescript
  return () => {
    channel.unsubscribe(); // Explicit unsubscribe first
    supabase.removeChannel(channel);
  };
  ```
- [x] T024 [US4] Change "Deleted User" fallback to "Unknown User" at line 236 in `src/app/messages/page.tsx` for consistency with line 244
- [x] T025 [P] [US4] Review error handling patterns across messaging components and standardize using createLogger utility where appropriate
- [x] T026 [P] [US4] (Optional) Add development-mode runtime validation for critical callback props in UnifiedSidebar

**Checkpoint**: P4 Low priority issues resolved - verify with:

- Manual test: throw error in ChatWindow component, verify ErrorBoundary catches
- Production build has no Profiler overhead
- All fallback text shows "Unknown User" consistently

---

## Phase 5: Final Verification

**Purpose**: Confirm all 18 issues resolved

- [x] T027 Run full verification suite:
  ```bash
  docker compose exec scripthammer pnpm run type-check
  docker compose exec scripthammer pnpm run lint
  docker compose exec scripthammer pnpm test
  docker compose exec scripthammer pnpm run build
  ```
- [x] T028 Manual verification checklist:
  - [x] SC-001: `grep -r "err: any" src/app/messages/` returns empty
  - [x] SC-002: `grep -r "eslint-disable.*exhaustive-deps" src/app/messages/` returns empty or documented
  - [x] SC-003: Navigate away from messages during toast, check console for warnings
  - [x] SC-004: `grep -r "console.warn" src/app/messages/` returns empty
  - [x] SC-005: Create pending request, verify badge updates
  - [x] SC-006: A11y audit passes for conversation search button
  - [x] SC-007: Manually throw error in ChatWindow, verify boundary catches
  - [x] SC-008: All 18 code review issues documented as resolved
  - [x] EC-001: Pending connection count callback called during unmount - no crash
  - [x] EC-002: err:unknown handles error with no message property gracefully
  - [x] EC-003: Toast timeout fires after component unmount - no state warning
  - [x] EC-004: Virtual scroll handles message deletion mid-scroll - no crash
  - [x] EC-005: Both loadConversationInfo and loadMessages fail - graceful error display

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 0)**: No dependencies - establishes baseline
- **User Story 1 (Phase 1)**: Depends on Setup - CRITICAL fixes
- **User Story 2 (Phase 2)**: Depends on Phase 1 (T004-T006 creates the callback infrastructure)
- **User Story 3 (Phase 3)**: Can run in parallel with Phase 2 after Phase 1
- **User Story 4 (Phase 4)**: Can run in parallel with Phases 2-3 after Phase 1
- **Final Verification (Phase 5)**: Depends on all previous phases

### Parallel Opportunities

Within Phase 1 (US1):

- T007, T008, T011 can run in parallel (different code locations)

Within Phase 3 (US3):

- T015, T016 can run in parallel (different files)

Within Phase 4 (US4):

- T021, T025, T026 can run in parallel (different files/concerns)

### Critical Path

T001-T003 → T004-T006 → T007-T011 → T012-T014 → T015-T020 → T021-T026 → T027-T028

---

## Parallel Example: Phase 2 Critical Fixes

```bash
# After T004-T006 (callback wiring), launch these in parallel:
Task: "Replace err: any at line 284 in src/app/messages/page.tsx"
Task: "Replace err: any at line 304 in src/app/messages/page.tsx"
Task: "Remove console.warn at lines 198, 217, 232, 240 in src/app/messages/page.tsx"
```

---

## Implementation Strategy

### Incremental Delivery

1. Complete Phase 0: Setup → Baseline established
2. Complete Phase 1: US1 (P1 Critical) → Deploy/Demo (highest value fixes)
3. Complete Phase 2: US2 (P2 High) → Architecture consistency
4. Complete Phase 3: US3 (P3 Medium) → Code quality and a11y
5. Complete Phase 4: US4 (P4 Low) → Polish and edge cases
6. Complete Phase 5: Verification → All 18 issues confirmed resolved

### Files Modified Summary

| File                                                               | Tasks                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `src/app/messages/page.tsx`                                        | T006, T007, T008, T009, T010, T011, T012, T019, T022, T024 |
| `src/components/organisms/UnifiedSidebar/UnifiedSidebar.tsx`       | T004, T005, T026                                           |
| `src/components/organisms/ConversationList/ConversationList.tsx`   | T017                                                       |
| `src/components/organisms/ConversationList/useConversationList.ts` | T023                                                       |
| `src/components/organisms/ChatWindow/ChatWindow.tsx`               | T015                                                       |
| `src/components/atomic/MessageInput/MessageInput.tsx`              | T016                                                       |
| `src/components/molecular/MessageThread/MessageThread.tsx`         | T018, T020, T021                                           |

---

## Notes

- This is a refactoring-only feature - no new functionality
- All changes maintain backward compatibility
- Commit after each phase or logical task group
- Run type-check and lint after each phase to verify no regressions
- 18 issues total: 4 Critical, 3 High, 5 Medium, 6 Low
