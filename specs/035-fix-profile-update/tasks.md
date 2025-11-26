# Tasks: Fix Profile Update Silent Failure

**Input**: Design documents from `/specs/035-fix-profile-update/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Scope**: Bug fix in single component (AccountSettings.tsx) - no new files needed

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=Profile Persists, US2=Username Case, US3=Feedback)

---

## Phase 1: Update Test Mocks (Before Implementation)

**Purpose**: Update existing test files to expect new upsert behavior

- [x] T001 [P] [US1] Update AccountSettings.test.tsx mocks: Change `.update()` mock to `.upsert()` mock that returns `{ data, error }` instead of just `{ error }`. File: `src/components/auth/AccountSettings/AccountSettings.test.tsx`

- [x] T002 [P] [US1] Update AccountSettings.accessibility.test.tsx mocks: Same change - `.update()` to `.upsert()` mock pattern. File: `src/components/auth/AccountSettings/AccountSettings.accessibility.test.tsx`

**Checkpoint**: Test mocks updated. Tests will fail until implementation is complete.

---

## Phase 2: User Story 1 - Profile Update Persists (Priority: P1)

**Goal**: Fix the core bug - profile changes actually persist to database

**Independent Test**: Change display name, click Update Profile, refresh page, verify change persisted

### Implementation for User Story 1

- [x] T003 [US1] Change `.update()` to `.upsert()` with `onConflict: 'id'` in handleProfileSubmit. File: `src/components/auth/AccountSettings/AccountSettings.tsx` (lines ~117-124)

  **Before:**

  ```typescript
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ username, display_name, bio })
    .eq('id', user.id);
  ```

  **After:**

  ```typescript
  const { data, error: updateError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: user.id,
        username: username?.trim().toLowerCase() || null,
        display_name: displayName?.trim() || null,
        bio: bio?.trim() || null,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();
  ```

- [x] T004 [US1] Add data validation check - verify returned data exists, not just `!error`. Show error message if `data` is null. File: `src/components/auth/AccountSettings/AccountSettings.tsx`

  ```typescript
  if (updateError) {
    setError('Failed to update profile. Please try again.');
  } else if (!data) {
    setError('Profile update failed - please try again.');
  } else {
    setSuccess(true);
    // ... refetch profile
  }
  ```

- [x] T005 [US1] Add profile data refetch after successful save to ensure UI reflects database state. File: `src/components/auth/AccountSettings/AccountSettings.tsx`

**Checkpoint**: Profile updates now persist. Manual test: change display name, refresh, verify it saved.

---

## Phase 3: User Story 2 - Username Case Consistency (Priority: P2)

**Goal**: Normalize username to lowercase to match availability check

**Independent Test**: Save username "JohnDoe", verify stored as "johndoe"

### Implementation for User Story 2

- [x] T006 [US2] Ensure username is normalized to lowercase before upsert: `username?.trim().toLowerCase() || null`. This should already be done in T003. Verify existing `checkUsernameAvailable()` also uses lowercase (it does per research.md line 34). File: `src/components/auth/AccountSettings/AccountSettings.tsx`

**Checkpoint**: Username case normalization complete.

---

## Phase 4: User Story 3 - Clear Success/Error Feedback (Priority: P3)

**Goal**: Auto-dismiss success message, add loading state during save

**Independent Test**: Update profile, see success message auto-dismiss after 3 seconds

### Implementation for User Story 3

- [x] T007 [US3] Add auto-dismiss for success message after 3 seconds using setTimeout. File: `src/components/auth/AccountSettings/AccountSettings.tsx`

  ```typescript
  setSuccess(true);
  setTimeout(() => setSuccess(false), 3000);
  ```

- [x] T008 [US3] Add loading state to "Update Profile" button during save operation. Add `isUpdating` state, show spinner, disable button while saving. File: `src/components/auth/AccountSettings/AccountSettings.tsx`

- [x] T009 [US3] Disable form inputs while save is in progress to prevent concurrent edits. File: `src/components/auth/AccountSettings/AccountSettings.tsx`

**Checkpoint**: UX improvements complete. Success auto-dismisses, loading state shown during save.

---

## Phase 5: Verification & Polish

**Purpose**: Run tests, verify all changes work together

- [x] T010 Run unit tests to verify all test mocks work with new implementation. Command: `docker compose exec scripthammer pnpm test src/components/auth/AccountSettings`

- [ ] T011 Manual end-to-end verification per quickstart.md:
  1. Sign in
  2. Go to Account Settings
  3. Change display name
  4. Click "Update Profile"
  5. Verify success message appears and auto-dismisses
  6. Refresh page
  7. Verify change persisted

- [x] T012 Run type-check to ensure no TypeScript errors. Command: `docker compose exec scripthammer pnpm run type-check`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Test Mocks)**: Can start immediately. T001 and T002 are parallel [P].
- **Phase 2 (US1)**: Depends on Phase 1. T003 → T004 → T005 are sequential (same file).
- **Phase 3 (US2)**: Included in T003 (username normalization). Verify after Phase 2.
- **Phase 4 (US3)**: Depends on Phase 2. T007 → T008 → T009 are sequential (same file).
- **Phase 5 (Verification)**: Depends on all phases complete.

### Parallel Opportunities

```bash
# Phase 1: Launch both test mock updates in parallel
Task: "Update AccountSettings.test.tsx mocks"
Task: "Update AccountSettings.accessibility.test.tsx mocks"
```

### Same File Constraint

T003-T009 all modify `AccountSettings.tsx` - these MUST be sequential, not parallel.

---

## Implementation Strategy

### Recommended Order

1. T001, T002 (parallel) - Update test mocks first
2. T003 - Core fix: .update() → .upsert() with lowercase username
3. T004 - Add data validation check
4. T005 - Add profile refetch
5. T007 - Add success auto-dismiss
6. T008 - Add loading state
7. T009 - Disable inputs during save
8. T010 - Run tests
9. T011 - Manual verification
10. T012 - Type check

### MVP (Minimum Viable Fix)

Complete T001-T005 only. This fixes the core bug (profile not saving). T007-T009 are UX polish.

---

## Notes

- All implementation tasks modify the same file (`AccountSettings.tsx`) - NO parallel execution for implementation
- Test mock updates (T001, T002) CAN run in parallel - different files
- Verify tests fail after T001/T002 before implementing T003+
- The upsert pattern handles both UPDATE (row exists) and INSERT (row missing)
- Username normalization in T003 fixes US2 automatically
