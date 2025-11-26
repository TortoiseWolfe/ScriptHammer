# Tasks: Fix User Profile System

**Input**: Design documents from `/specs/034-fix-broken-user/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Tests are OPTIONAL for this bug fix - no TDD was explicitly requested. Test scenarios are documented in quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `src/` at repository root (Next.js 15 App Router)
- Components: `src/components/`
- Hooks: `src/hooks/`
- Utilities: `src/lib/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new files needed across multiple user stories

- [x] T001 [P] Create `src/lib/profile/` directory structure
- [x] T002 [P] Create validation utility file `src/lib/profile/validation.ts` with exports

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Implement `validateUsername()` in `src/lib/profile/validation.ts`:
  - Accept string parameter
  - Return `{ valid: boolean, error?: string }`
  - Rules: 3-30 chars, alphanumeric + underscore only, no spaces
  - Error messages per data-model.md validation rules

- [x] T004 Implement `validateDisplayName()` in `src/lib/profile/validation.ts`:
  - Accept string parameter
  - Return `{ valid: boolean, error?: string }`
  - Rules: max 100 chars, optional (empty allowed)

- [x] T005 Implement `checkUsernameAvailable()` in `src/lib/profile/validation.ts`:
  - Accept Supabase client and username string
  - Query user_profiles table for existing username
  - Return boolean (true if available)
  - Exclude current user from check

- [x] T006 Create `src/hooks/useUserProfile.ts`:
  - Hook to fetch current user's profile from user_profiles table
  - Return `{ profile, loading, error, refetch }`
  - Use AuthContext for current user ID
  - Query: `supabase.from('user_profiles').select('*').eq('id', user.id).single()`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Update Profile Settings (Priority: P1) 🎯 MVP

**Goal**: Profile changes (username, display_name, bio) save correctly to user_profiles table and persist across page refresh

**Independent Test**: Log in → Update username and display name in Account Settings → Click "Update Profile" → Refresh page → Values still show

### Implementation for User Story 1

- [x] T007 [US1] Read current `src/components/auth/AccountSettings/AccountSettings.tsx` to understand existing structure

- [x] T008 [US1] Add `displayName` state variable to AccountSettings.tsx:
  - Add `const [displayName, setDisplayName] = useState('')`
  - Initialize alongside existing username/bio states

- [x] T009 [US1] Import and call `useUserProfile` hook in AccountSettings.tsx:
  - Import: `import { useUserProfile } from '@/hooks/useUserProfile'`
  - Call: `const { profile, loading: profileLoading } = useUserProfile()`
  - Update useEffect to set initial values from profile instead of auth.users.user_metadata

- [x] T010 [US1] Add Display Name input field to AccountSettings form:
  - Add label: "Display Name"
  - Add input bound to displayName state
  - Add helper text: "Your friendly name (e.g., 'John Doe')"
  - Position after Username field, before Bio

- [x] T011 [US1] Import validation functions in AccountSettings.tsx:
  - Import: `import { validateUsername, validateDisplayName, checkUsernameAvailable } from '@/lib/profile/validation'`

- [x] T012 [US1] Update handleUpdateProfile function in AccountSettings.tsx:
  - REMOVE: `await supabase.auth.updateUser({ data: { username, bio } })`
  - ADD: Validate username with `validateUsername(username)`
  - ADD: Validate display_name with `validateDisplayName(displayName)`
  - ADD: Check uniqueness with `checkUsernameAvailable(supabase, username)`
  - ADD: `await supabase.from('user_profiles').update({ username, display_name: displayName, bio }).eq('id', user.id)`
  - Handle errors and show appropriate messages

- [x] T013 [US1] Add loading state handling for profile fetch:
  - Show loading indicator while useUserProfile is loading
  - Disable form submission while loading
  - Refetch profile after successful save

**Checkpoint**: At this point, User Story 1 should be fully functional - profile saves persist correctly

---

## Phase 4: User Story 2 - Search and Find Users (Priority: P2)

**Goal**: Users can find each other by searching username or display_name with partial, case-insensitive matching

**Independent Test**: User A sets username "alice" and display_name "Alice Smith" → User B searches "alic" → User A appears in results

### Implementation for User Story 2

- [x] T014 [US2] Read current `src/services/messaging/connection-service.ts` searchUsers method

- [x] T015 [US2] Verify searchUsers already uses ilike for partial matching:
  - Confirm pattern: `.or(\`username.ilike.${searchPattern},display_name.ilike.${searchPattern}\`)`
  - If not present, update to use ilike
  - Verify case-insensitive matching works

- [x] T016 [US2] Verify searchUsers excludes current user:
  - Confirm `.neq('id', user.id)` is present
  - If not, add it to prevent self-matching

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - profile changes save AND users can be found

---

## Phase 5: User Story 3 - Clear Search UI Labels (Priority: P3)

**Goal**: Search UI accurately describes what can be searched (username or name, NOT email)

**Independent Test**: View Find Users / Add Friend interface → Labels say "username or name" not "email or username"

### Implementation for User Story 3

- [x] T017 [US3] Read current `src/components/molecular/UserSearch/UserSearch.tsx`

- [x] T018 [US3] Update UserSearch label text:
  - Change: "Search for users by email or username"
  - To: "Search for users by username or name"

- [x] T019 [US3] Update UserSearch placeholder text:
  - Change any "email" references to "name"
  - New placeholder: "Enter username or name"

- [x] T020 [US3] Update UserSearch error/empty state text:
  - Change: "No users found matching that email or username"
  - To: "No users found matching your search"

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and cleanup

- [x] T021 [P] Manual test: Full end-to-end flow per quickstart.md test scenarios
- [x] T022 [P] Run type-check: `docker compose exec scripthammer pnpm run type-check`
- [x] T023 [P] Run lint: `docker compose exec scripthammer pnpm run lint`
- [x] T024 Run existing test suite to verify no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2

### Within Each User Story

- Read existing file first
- Modify in logical order (imports → state → logic → UI)
- Verify changes work before moving to next task

### Parallel Opportunities

- T001, T002: Can run in parallel (different directories/files)
- T021, T022, T023: Can run in parallel (different validation tools)
- User Stories 2 and 3 can technically run in parallel with US1 (but sequential is fine for single developer)

---

## Parallel Example: Setup Phase

```bash
# Launch setup tasks together:
Task: "Create src/lib/profile/ directory structure"
Task: "Create validation utility file src/lib/profile/validation.ts with exports"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (2 tasks)
2. Complete Phase 2: Foundational (4 tasks)
3. Complete Phase 3: User Story 1 (7 tasks)
4. **STOP and VALIDATE**: Test profile save flow
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready (6 tasks)
2. Add User Story 1 → Test profile persistence → Deploy (7 tasks)
3. Add User Story 2 → Test search functionality → Deploy (3 tasks)
4. Add User Story 3 → Test UI labels → Deploy (4 tasks)
5. Polish → Final validation (4 tasks)

---

## Summary

| Phase                       | Tasks | Cumulative |
| --------------------------- | ----- | ---------- |
| Phase 1: Setup              | 2     | 2          |
| Phase 2: Foundational       | 4     | 6          |
| Phase 3: US1 - Profile Save | 7     | 13         |
| Phase 4: US2 - Search       | 3     | 16         |
| Phase 5: US3 - UI Labels    | 4     | 20         |
| Phase 6: Polish             | 4     | 24         |

**Total Tasks**: 24
**MVP Scope**: Phases 1-3 (13 tasks) delivers core profile save fix
**Parallel Opportunities**: 8 tasks marked [P]
