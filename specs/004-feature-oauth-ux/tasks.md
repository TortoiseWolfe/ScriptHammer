# Tasks: OAuth UX Polish

**Input**: Design documents from `/specs/004-feature-oauth-ux/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Constitution requires Test-First Development (TDD). Unit tests included for new functions.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (OAuth Utility Functions)

**Purpose**: Create extraction functions in oauth-utils.ts that are required by User Story 1

**⚠️ CRITICAL**: User Story 1 cannot be completed until these functions exist

### Tests First (TDD)

- [x] T001 [P] [US1] Write unit test for `extractOAuthDisplayName()` with fallback cascade in `src/lib/auth/oauth-utils.test.ts`:
  - Test: user.user_metadata.full_name="Jon Pohlner" → returns "Jon Pohlner"
  - Test: user.user_metadata.name="johndoe" (no full_name) → returns "johndoe"
  - Test: user.email="user@example.com" (no full_name, no name) → returns "user"
  - Test: user=null → returns "Anonymous User"
  - Test: user has no metadata and no email → returns "Anonymous User"

- [x] T002 [P] [US1] Write unit test for `extractOAuthAvatarUrl()` in `src/lib/auth/oauth-utils.test.ts`:
  - Test: user.user_metadata.avatar_url="https://..." → returns URL
  - Test: No avatar_url in metadata → returns null
  - Test: user=null → returns null

### Implementation

- [x] T003 [US1] Implement `extractOAuthDisplayName(user: User | null): string` in `src/lib/auth/oauth-utils.ts`:

  ```typescript
  export function extractOAuthDisplayName(user: User | null): string {
    if (!user) return 'Anonymous User';
    return (
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Anonymous User'
    );
  }
  ```

- [x] T004 [US1] Implement `extractOAuthAvatarUrl(user: User | null): string | null` in `src/lib/auth/oauth-utils.ts`:

  ```typescript
  export function extractOAuthAvatarUrl(user: User | null): string | null {
    return user?.user_metadata?.avatar_url || null;
  }
  ```

- [x] T005 [US1] Run unit tests to verify T001-T004 pass:
  ```bash
  docker compose exec scripthammer pnpm test src/lib/auth/oauth-utils.test.ts
  ```

**Checkpoint**: Extraction functions ready - User Story 1 integration can proceed

---

## Phase 2: User Story 1 - OAuth Display Name Population (Priority: P1) 🎯 MVP

**Goal**: OAuth users have display_name populated from provider metadata on first sign-in

**Independent Test**: Sign in with Google OAuth → verify display_name is set in user_profiles table

### Tests First (TDD)

- [x] T006 [US1] Write unit test for `populateOAuthProfile()` in `src/lib/auth/oauth-utils.test.ts`:
  - Test: Profile with NULL display_name → updates display_name from metadata
  - Test: Profile with existing display_name → does NOT overwrite
  - Test: OAuth user with avatar_url → populates avatar_url if NULL
  - Test: Returns true if updated, false if skipped
  - Mock: Supabase client for database operations

### Implementation

- [x] T007 [US1] Implement `populateOAuthProfile(user: User): Promise<boolean>` in `src/lib/auth/oauth-utils.ts`:
  - Import createClient from '@/lib/supabase/client'
  - Query user_profiles for current display_name/avatar_url
  - If display_name is NULL, update with extractOAuthDisplayName(user)
  - If avatar_url is NULL and OAuth has avatar, update with extractOAuthAvatarUrl(user)
  - Add logging via createLogger
  - Return true if any field updated, false otherwise

- [x] T008 [US1] Run unit tests to verify T006-T007 pass:
  ```bash
  docker compose exec scripthammer pnpm test src/lib/auth/oauth-utils.test.ts
  ```

### Auth Callback Integration

- [x] T009 [US1] Update `src/app/auth/callback/page.tsx` to import new functions:

  ```typescript
  import { isOAuthUser, populateOAuthProfile } from '@/lib/auth/oauth-utils';
  ```

- [x] T010 [US1] Add profile population in OAuth callback (around line 47, in the useEffect after `if (user)`):

  ```typescript
  if (user) {
    // Populate OAuth profile before redirect
    try {
      if (isOAuthUser(user)) {
        await populateOAuthProfile(user);
      }
    } catch (err) {
      logger.error('Failed to populate OAuth profile', { error: err });
      // Non-blocking - continue with redirect
    }

    logger.info('User authenticated, redirecting to profile');
    router.push('/profile');
  }
  ```

- [x] T011 [US1] Verify end-to-end flow manually:
  1. Sign out completely
  2. Sign in with Google OAuth (new user or existing with NULL display_name)
  3. Check user_profiles table - display_name should be populated
  4. Verify no "null" appears in conversation lists

**Checkpoint**: User Story 1 complete - OAuth users now get display_name on first sign-in

---

## Phase 3: User Story 2 - Message Scroll Fix (Priority: P2)

**Goal**: Users can scroll to see full content of long messages in ChatWindow

**Independent Test**: Open conversation with long welcome message → scroll to bottom → see entire content

### Implementation

- [x] T012 [US2] Fix scroll container height in `src/app/messages/page.tsx` at line 290:
  - Current: `<div className="drawer-content flex flex-col">`
  - Fixed: `<div className="drawer-content flex h-full flex-col">`

- [x] T013 [US2] Verify scroll fix manually:
  1. Open /messages in browser
  2. Select a conversation with long message (welcome message)
  3. Verify scroll works on desktop viewport
  4. Verify scroll works on mobile viewport (320px width)
  5. Verify scroll works on tablet viewport (768px width)
  6. Send a new message → verify view auto-scrolls to newest message (US2§3)

**Checkpoint**: User Story 2 complete - Message scroll works on all viewports

---

## Phase 4: User Story 3 - Existing OAuth User Migration (Priority: P3)

**Goal**: Existing OAuth users with NULL display_name get populated from auth metadata

**Independent Test**: Run migration → verify existing OAuth users have display_name set

### Implementation

- [x] T014 [US3] Add migration query to `supabase/migrations/20251006_complete_monolithic_setup.sql` (before final COMMIT):

  ```sql
  -- Feature 004: Populate OAuth user profiles (one-time migration)
  -- Only updates NULL display_name for OAuth users
  UPDATE public.user_profiles p
  SET
    display_name = COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email, '@', 1),
      'Anonymous User'
    ),
    avatar_url = COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
  FROM auth.users u
  WHERE p.id = u.id
    AND p.display_name IS NULL
    AND u.raw_app_meta_data->>'provider' IS DISTINCT FROM 'email';
  ```

- [x] T015 [US3] Run migration for existing data via Supabase Management API:
  - Executed UPDATE statement via API
  - Verified affected rows

- [x] T016 [US3] Verify migration results:
  - Query: `SELECT id, display_name FROM user_profiles WHERE display_name IS NULL`
  - Expected: No OAuth users with NULL display_name

**Checkpoint**: User Story 3 complete - All existing OAuth users have display_name

---

## Phase 5: Polish & Verification

**Purpose**: Final validation and cleanup

- [x] T017 Run full test suite:

  ```bash
  docker compose exec scripthammer pnpm test
  ```

  ✅ 243 tests passed

- [x] T018 Run type check:

  ```bash
  docker compose exec scripthammer pnpm run type-check
  ```

  ✅ No type errors

- [x] T019 Run linter:

  ```bash
  docker compose exec scripthammer pnpm run lint
  ```

  ✅ Passed (1 unrelated warning in ReAuthModal)

- [x] T020 Manual E2E verification:
  1. Sign out → Sign in with OAuth → Verify display_name populated
  2. Open /messages → Verify scroll works on long messages
  3. Check conversation list → No "null" text visible

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies - start immediately
- **Phase 2 (US1)**: Depends on Phase 1 completion (extraction functions)
- **Phase 3 (US2)**: No dependencies on other phases - can run in parallel with US1
- **Phase 4 (US3)**: No dependencies - can run in parallel with US1/US2
- **Phase 5 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

| Story                    | Depends On             | Can Parallel With |
| ------------------------ | ---------------------- | ----------------- |
| US1 (OAuth Display Name) | Phase 1 (Foundational) | -                 |
| US2 (Scroll Fix)         | None                   | US1, US3          |
| US3 (Migration)          | None                   | US1, US2          |

### Within Each Phase

- Tests marked [P] can run in parallel
- T001 and T002 are [P] - write both test files simultaneously
- T003 and T004 are sequential (same file)

---

## Parallel Execution Examples

### Parallel Test Writing (Phase 1)

```bash
# These can run simultaneously:
Task T001: "Write unit test for extractOAuthDisplayName()"
Task T002: "Write unit test for extractOAuthAvatarUrl()"
```

### Parallel User Stories (After Phase 1)

```bash
# Developer A: User Story 1 (OAuth integration)
Task T006-T011

# Developer B: User Story 2 (Scroll fix)
Task T012-T013

# Developer C: User Story 3 (Migration)
Task T014-T016
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational functions (T001-T005)
2. Complete Phase 2: User Story 1 - OAuth Display Name (T006-T011)
3. **STOP and VALIDATE**: New OAuth users get display_name
4. Deploy if ready - addresses the most critical issue

### Incremental Delivery

1. Phase 1 → Foundational ready
2. Phase 2 (US1) → OAuth display_name works (MVP!)
3. Phase 3 (US2) → Scroll fix works
4. Phase 4 (US3) → Existing users migrated
5. Phase 5 → Full validation

### Single Developer Order

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests written FIRST (TDD) for oauth-utils functions per Constitution
- US2 (scroll fix) and US3 (migration) have no code dependencies on US1
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
