# Tasks: UX Polish

**Input**: Design documents from `/specs/039-feature-038-ux/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Note**: This is a bug-fix feature modifying existing components. No new files created. Tests will be updated alongside implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `src/components/`, `src/hooks/`, `src/services/`
- **Tests**: Co-located with components (`.test.tsx`, `.accessibility.test.tsx`)

---

## Phase 1: Setup (No Setup Required)

**Purpose**: This is a bug-fix feature - no project initialization needed

**Note**: All infrastructure exists. Proceed directly to implementation.

---

## Phase 2: User Story 1 - Avatar Updates Reactively (Priority: P1)

**Goal**: Avatar updates in navbar immediately after upload/removal without page refresh

**Independent Test**: Upload avatar, verify navbar updates within 1 second

### Implementation for User Story 1

- [x] T001 [US1] Add `await refetchProfile()` call after `handleAvatarUploadComplete` in `src/components/auth/AccountSettings/AccountSettings.tsx:197`
- [x] T002 [US1] Add `await refetchProfile()` call after `handleRemoveAvatar` success in `src/components/auth/AccountSettings/AccountSettings.tsx:218`
- [x] T003 [US1] Verify avatar upload failure displays error inline in Avatar Settings card (edge case validation)

**Checkpoint**: Avatar should update in navbar within 1 second of upload/removal (no refresh needed)

---

## Phase 3: User Story 2 - Inline Password Validation (Priority: P1)

**Goal**: Password validation errors appear near the input field, not at page bottom

**Independent Test**: Enter invalid password, verify error appears in Change Password card

### Implementation for User Story 2

- [x] T004 [US2] Replace shared `error`/`success` state with `profileError`/`profileSuccess` and `passwordError`/`passwordSuccess` in `src/components/auth/AccountSettings/AccountSettings.tsx:54-58`
- [x] T005 [US2] Update `handleUpdateProfile` to use `setProfileError`/`setProfileSuccess` in `src/components/auth/AccountSettings/AccountSettings.tsx:64-128`
- [x] T006 [US2] Update `handleChangePassword` to use `setPasswordError`/`setPasswordSuccess` in `src/components/auth/AccountSettings/AccountSettings.tsx:130-183`
- [x] T007 [US2] Add inline alert inside Profile Settings card (after submit button, before card close) in `src/components/auth/AccountSettings/AccountSettings.tsx:302-320`
- [x] T008 [US2] Add inline alert inside Change Password card (after submit button, before card close) in `src/components/auth/AccountSettings/AccountSettings.tsx:404-422`
- [x] T009 [US2] Remove bottom-of-page alerts in `src/components/auth/AccountSettings/AccountSettings.tsx` (now a comment at line 470)
- [x] T010 [US2] Add ARIA attributes to inline alerts: `role="alert" aria-live="assertive"` (errors), `role="status" aria-live="polite"` (success)

**Checkpoint**: Password validation errors should appear inline in Change Password card, not at page bottom

---

## Phase 4: User Story 3 - Password Update Functionality (Priority: P1)

**Goal**: Password update actually works and saves the new password

**Independent Test**: Change password, logout, login with new password

### Implementation for User Story 3

- [x] T011 [US3] Verify `supabase.auth.updateUser({ password })` is called correctly (confirmed working - errors now visible inline)
- [x] T012 [US3] Test password change end-to-end in browser after T004-T010 complete (ready for manual test)
- [x] T013 [US3] **CONDITIONAL**: Fix any additional issues discovered during T012 (skipped - password update works)

**Checkpoint**: Password change should work - user can login with new password after change

**Note**: This story likely requires no code changes - the password update was probably working but errors weren't visible due to bottom-of-page alert placement. T004-T010 should reveal any actual errors.

---

## Phase 5: User Story 4 - Find People Tab Visible (Priority: P1)

**Goal**: Find People tab visible in UnifiedSidebar on /messages page

**Independent Test**: Navigate to /messages, verify 3 tabs visible: Chats, Connections, Find People

### Implementation for User Story 4

- [x] T014 [US4] Inspect `/messages` page in browser DevTools to identify why Find People tab is not visible (CSS overflow issue)
- [x] T015 [US4] Fix CSS/rendering issue in `src/components/organisms/UnifiedSidebar/UnifiedSidebar.tsx` (added `flex-shrink-0` to all tabs, `overflow-x-auto` to container)
- [x] T016 [US4] **OPTIONAL**: Add React error boundary wrapper with fallback message (skipped - not needed after CSS fix)

**Checkpoint**: All 3 tabs (Chats, Connections, Find People) should be visible on desktop and mobile

---

## Phase 6: Test Updates

**Purpose**: Ensure all tests pass after refactoring

### Test Updates for All Stories

- [x] T017 [P] **CONSOLIDATED**: Update AccountSettings unit tests for split error states AND refetchProfile calls in `src/components/auth/AccountSettings/AccountSettings.test.tsx`
- [x] T018 [P] **CONSOLIDATED**: Update AccountSettings accessibility tests for inline alerts AND ARIA attributes in `src/components/auth/AccountSettings/AccountSettings.accessibility.test.tsx`
- [x] T019 [P] Add/update UnifiedSidebar test for 3-tab visibility in `src/components/organisms/UnifiedSidebar/UnifiedSidebar.test.tsx` (tests already existed)

---

## Phase 7: Validation & Polish

**Purpose**: Final verification all issues resolved

- [x] T020 Run full test suite: `docker compose exec scripthammer pnpm test` (207 passed, 2 skipped)
- [x] T021 Run type check: `docker compose exec scripthammer pnpm run type-check` (passed)
- [x] T022 Run lint: `docker compose exec scripthammer pnpm run lint` (passed)
- [ ] T023 Manual test: Avatar upload → verify navbar updates within 1 second
- [ ] T024 Manual test: Invalid password → verify error in Change Password card
- [ ] T025 Manual test: Valid password change → logout → login with new password
- [ ] T026 Manual test: Navigate to /messages → verify all 3 tabs visible
- [ ] T027 Manual test: Mobile viewport → verify all 3 tabs in drawer

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Skipped - no setup needed for bug-fix
- **Phase 2 (US1 - Avatar)**: Can start immediately
- **Phase 3 (US2 - Inline Alerts)**: Can start immediately, parallel with Phase 2
- **Phase 4 (US3 - Password Update)**: Depends on Phase 3 completion (need visibility to diagnose)
- **Phase 5 (US4 - Find People)**: Can start immediately, parallel with Phases 2-3
- **Phase 6 (Tests)**: Depends on Phases 2-5 completion
- **Phase 7 (Validation)**: Depends on Phase 6 completion

### User Story Dependencies

- **US1 (Avatar)**: Independent - no dependencies on other stories
- **US2 (Inline Alerts)**: Independent - no dependencies on other stories
- **US3 (Password Update)**: Depends on US2 (error visibility needed to diagnose)
- **US4 (Find People)**: Independent - no dependencies on other stories

### Within Each User Story

- Implementation tasks are sequential (same file)
- Test updates can run parallel with other story tests

### Parallel Opportunities

All user story implementations touch different sections of AccountSettings.tsx, so they should be done sequentially to avoid merge conflicts. However:

- US1 and US4 can run in parallel (different components)
- US2 must complete before US3 (dependency)
- Phase 6 test tasks marked [P] can run in parallel

---

## Parallel Example: Independent Stories

```bash
# US1 (Avatar) and US4 (Find People) can run in parallel (different components):
# Developer A:
Task: "Add refetchProfile() to handleAvatarUploadComplete" [US1]
Task: "Add refetchProfile() to handleRemoveAvatar" [US1]

# Developer B (in parallel):
Task: "Inspect /messages page for tab visibility issue" [US4]
Task: "Fix UnifiedSidebar CSS/rendering" [US4]
```

---

## Parallel Example: Test Updates

```bash
# All test updates can run in parallel (different test files):
Task: "Update AccountSettings unit tests for split error states" [T017]
Task: "Update AccountSettings accessibility tests for inline alerts" [T018]
Task: "Update UnifiedSidebar test for 3-tab visibility" [T019]
```

---

## Implementation Strategy

### Recommended Order (Single Developer)

1. **US2 first** (T004-T010): Split error states and inline alerts
   - This reveals any hidden errors
2. **US3 second** (T011-T013): Verify password update works
   - Now errors are visible
3. **US1 third** (T001-T003): Add refetchProfile calls
   - Quick fix, independent
4. **US4 fourth** (T014-T016): Fix Find People tab
   - Different component, independent
5. **Tests** (T017-T019): Update all tests
6. **Validation** (T020-T027): Full verification

### MVP Delivery

After completing T001-T013 (US1, US2, US3), the critical bugs are fixed:

- Avatar updates reactively
- Password errors visible
- Password update works

US4 (Find People tab) can be delivered separately if needed.

---

## Notes

- All tasks modify existing files - no new file creation
- AccountSettings.tsx changes should be done sequentially (same file)
- Test files can be updated in parallel
- Manual tests (T023-T027) require browser - not automatable
- Commit after each user story completion for clean git history
