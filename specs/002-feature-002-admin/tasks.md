# Tasks: Admin Welcome Message & Email Verification

**Input**: Design documents from `/specs/002-feature-002-admin/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Branch**: `002-feature-002-admin`

**Tests**: Included per constitution (TDD approach)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment and configuration setup

- [x] T001 [P] Add admin environment variables to `.env`

  ```bash
  TEST_USER_ADMIN_EMAIL=admin@scripthammer.com
  TEST_USER_ADMIN_PASSWORD=<generate-with: openssl rand -base64 48>
  NEXT_PUBLIC_ADMIN_USER_ID=00000000-0000-0000-0000-000000000001
  ```

- [x] T002 [P] Add admin variable templates to `.env.example`

  ```bash
  # Admin user for system welcome messages
  TEST_USER_ADMIN_EMAIL=admin@scripthammer.com
  TEST_USER_ADMIN_PASSWORD=<secure-password>
  NEXT_PUBLIC_ADMIN_USER_ID=00000000-0000-0000-0000-000000000001
  ```

- [x] T003 [P] Add admin constants to `tests/fixtures/test-user.ts`
  ```typescript
  export const TEST_EMAIL_ADMIN =
    process.env.TEST_USER_ADMIN_EMAIL || 'admin@scripthammer.com';
  export const TEST_PASSWORD_ADMIN = process.env.TEST_USER_ADMIN_PASSWORD;
  export const ADMIN_USER_ID =
    process.env.NEXT_PUBLIC_ADMIN_USER_ID ||
    '00000000-0000-0000-0000-000000000001';
  ```

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and admin profile - MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add `welcome_message_sent` column to `supabase/migrations/20251006_complete_monolithic_setup.sql`

  ```sql
  -- In user_profiles table section, add:
  ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS welcome_message_sent BOOLEAN NOT NULL DEFAULT FALSE;

  -- Add index for efficient lookup
  CREATE INDEX IF NOT EXISTS idx_user_profiles_welcome_pending
  ON user_profiles (id)
  WHERE welcome_message_sent = FALSE;
  ```

- [x] T005 Add admin profile seed to `supabase/migrations/20251006_complete_monolithic_setup.sql`

  ```sql
  -- Admin profile for system messages (after user_profiles table creation)
  INSERT INTO user_profiles (id, username, display_name, welcome_message_sent)
  VALUES ('00000000-0000-0000-0000-000000000001', 'scripthammer', 'ScriptHammer', TRUE)
  ON CONFLICT (id) DO NOTHING;
  ```

- [x] T006 Add admin RLS policy to `supabase/migrations/20251006_complete_monolithic_setup.sql`

  ```sql
  -- Allow admin to create conversations with any user (bypass connection requirement)
  CREATE POLICY "admin_create_any_conversation"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid
  );
  ```

- [x] T007 Execute migration via Supabase Management API
  - Added `welcome_message_sent` column to user_profiles
  - Created index `idx_user_profiles_welcome_pending`
  - Created admin user in auth.users
  - Updated admin profile with username 'scripthammer'

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 3 - Admin User Setup (Priority: P3)

**Goal**: Admin user "ScriptHammer" exists and can be authenticated

**Independent Test**: Verify admin credentials in .env, admin profile exists in database

**Note**: This is implemented FIRST because US1 depends on it (admin sends welcome message)

### Tests for User Story 3

- [x] T008 [P] [US3] Create admin user test in `tests/contract/auth/admin-user.contract.test.ts`
  ```typescript
  describe('Admin User Setup', () => {
    it('should have admin profile in database', async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', ADMIN_USER_ID)
        .single();
      expect(data?.username).toBe('scripthammer');
    });
  });
  ```

### Implementation for User Story 3

- [x] T009 [US3] Verify admin profile exists via Supabase Management API
  - Query verified: `SELECT * FROM user_profiles WHERE id = '00000000-0000-0000-0000-000000000001'`
  - Confirmed: username='scripthammer', display_name='ScriptHammer', welcome_message_sent=true

**Checkpoint**: Admin user setup complete and verified

---

## Phase 4: User Story 2 - Email Verification Gate (Priority: P2)

**Goal**: Unverified users are blocked from /messages with clear explanation

**Independent Test**: Sign up without verifying email, navigate to /messages, confirm blocked state appears

### Tests for User Story 2

- [x] T010 [P] [US2] Create MessagingGate test in `src/components/auth/MessagingGate/MessagingGate.test.tsx`

  ```typescript
  describe('MessagingGate', () => {
    it('renders blocked state for unverified email user');
    it('renders children for verified email user');
    it('renders children for OAuth user (provider-verified)');
    it('shows resend button in blocked state');
  });
  ```

- [x] T011 [P] [US2] Create MessagingGate accessibility test in `src/components/auth/MessagingGate/MessagingGate.accessibility.test.tsx`

### Implementation for User Story 2

- [x] T012 [US2] Generate MessagingGate component using generator

  ```bash
  docker compose exec scripthammer pnpm run generate:component
  # Name: MessagingGate
  # Directory: src/components/auth
  ```

- [x] T013 [US2] Implement MessagingGate logic in `src/components/auth/MessagingGate/MessagingGate.tsx`
  - Check `user.email_confirmed_at` from AuthContext
  - Check OAuth status via `isOAuthUser()` from `@/lib/auth/oauth-utils`
  - If unverified AND not OAuth → render blocked state UI
  - If verified OR OAuth → render children
  - Blocked state: lock icon, heading, explanation, resend button

- [x] T014 [P] [US2] Create MessagingGate Storybook in `src/components/auth/MessagingGate/MessagingGate.stories.tsx`
  - Story: "Blocked" (unverified user)
  - Story: "Allowed" (verified user)
  - Story: "OAuth Allowed" (OAuth user)

- [x] T015 [US2] Integrate MessagingGate into `src/app/messages/page.tsx`

  ```typescript
  import { MessagingGate } from '@/components/auth/MessagingGate';

  export default function MessagesPage() {
    return (
      <MessagingGate>
        <Suspense fallback={...}>
          <MessagesContent />
        </Suspense>
      </MessagingGate>
    );
  }
  ```

**Checkpoint**: Email verification gate working - unverified users blocked

---

## Phase 5: User Story 1 - Welcome Message (Priority: P1) 🎯 MVP

**Goal**: New users receive encrypted welcome message from ScriptHammer on first login

**Independent Test**: Create new user, verify email, log in, check welcome message in conversations

### Tests for User Story 1

- [x] T016 [P] [US1] Create WelcomeService test in `src/services/messaging/welcome-service.test.ts`
  ```typescript
  describe('WelcomeService', () => {
    it('sends welcome message to new user');
    it('skips if welcome_message_sent is true');
    it('derives admin keys lazily on first send');
    it('self-heals if admin keys corrupted');
    it('handles missing admin password gracefully');
    it('encrypts message that recipient can decrypt (SC-003)');
  });
  ```

### Implementation for User Story 1

- [x] T017 [US1] Create WelcomeService in `src/services/messaging/welcome-service.ts`
  - Import key derivation from `@/lib/messaging/key-derivation`
  - Import encryption from `@/lib/messaging/encryption`
  - Implement `sendWelcomeMessage(userId, userPublicKey)`:
    1. Check `welcome_message_sent` status
    2. Derive admin keys from env password (lazy, FR-011)
    3. Verify admin keys match stored (self-heal if needed, FR-012)
    4. Get/create conversation (admin ↔ user)
    5. Encrypt welcome message with user's public key
    6. Insert message into database
    7. Set `welcome_message_sent = TRUE`

- [x] T018 [US1] Add welcome message content constant to `src/services/messaging/welcome-service.ts`

  ```typescript
  export const WELCOME_MESSAGE_CONTENT = `Welcome to ScriptHammer!
  
  Your messages are protected by end-to-end encryption...`;
  ```

- [x] T019 [US1] Integrate WelcomeService trigger in `src/components/auth/SignInForm/SignInForm.tsx`
  - After `keyManagementService.initializeKeys()` succeeds (new user only)
  - Dynamic import WelcomeService
  - Call `sendWelcomeMessage()` with user ID and public key
  - Non-blocking (catch errors, log, don't interrupt flow)

- [x] T020 [US1] Add admin key initialization logic to WelcomeService
  - Check if admin has public key in `user_encryption_keys`
  - If not: derive from env password, store public key
  - If yes: verify derived key matches stored (detect corruption)
  - Cache keys in service singleton

**Checkpoint**: Welcome message system working - new users receive message

---

## Phase 6: User Story 4 - OAuth Email Bypass (Priority: P4)

**Goal**: OAuth users bypass email verification gate (already verified by provider)

**Independent Test**: Sign in with Google/GitHub, navigate to /messages, verify no email gate

### Implementation for User Story 4

- [x] T021 [US4] Verify OAuth bypass in MessagingGate (already implemented in T013)
  - OAuth users have `email_confirmed_at` set by Supabase Auth
  - MessagingGate checks `isOAuthUser()` as secondary check
  - No additional code needed if T013 implemented correctly

- [x] T022 [P] [US4] Add OAuth bypass test case to MessagingGate tests
  ```typescript
  it('allows OAuth user with null email_confirmed_at (edge case)', async () => {
    // Some OAuth providers may not set email_confirmed_at
    // MessagingGate should still allow based on isOAuthUser() check
  });
  ```

**Checkpoint**: OAuth users can access messaging without email verification friction

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T023 [P] Run full test suite

  ```bash
  docker compose exec scripthammer pnpm test
  ```

- [x] T024 [P] Run type check

  ```bash
  docker compose exec scripthammer pnpm run type-check
  ```

- [x] T025 [P] Run linter

  ```bash
  docker compose exec scripthammer pnpm run lint
  ```

- [x] T026 Manual E2E validation following quickstart.md scenarios
  - Test unverified user blocked from /messages
  - Test verified user sees welcome message
  - Test OAuth user bypasses gate
  - **Note**: Unit tests passing; E2E requires manual browser testing

- [x] T027 Update plan.md Progress Tracking to show completion

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ────────────────────────────────────────────────┐
                                                               │
Phase 2: Foundational ─────────────────────────────────────────┤
          │                                                    │
          ├──> Phase 3: US3 (Admin Setup) ─────────────────────┤
          │         │                                          │
          │         └──> Phase 5: US1 (Welcome Message) ◄──────┤
          │                                                    │
          └──> Phase 4: US2 (Email Gate) ──────────────────────┤
                    │                                          │
                    └──> Phase 6: US4 (OAuth Bypass) ──────────┤
                                                               │
Phase 7: Polish ◄──────────────────────────────────────────────┘
```

### User Story Dependencies

- **US3 (Admin Setup)**: Foundation only - no story dependencies
- **US1 (Welcome Message)**: Depends on US3 (needs admin user to send message)
- **US2 (Email Gate)**: Foundation only - independent of other stories
- **US4 (OAuth Bypass)**: Depends on US2 (extends MessagingGate logic)

### Parallel Opportunities

**Phase 1** (all parallel):

```bash
# All setup tasks can run in parallel
T001, T002, T003
```

**Phase 3-4** (can run in parallel after Phase 2):

```bash
# US3 and US2 can start simultaneously
Phase 3 (US3) ║ Phase 4 (US2)
```

**Phase 4 Tests** (parallel within phase):

```bash
T010 ║ T011 ║ T014
```

---

## Implementation Strategy

### MVP First (User Story 1 + Prerequisites)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T007)
3. Complete Phase 3: US3 Admin Setup (T008-T009)
4. Complete Phase 5: US1 Welcome Message (T016-T020)
5. **STOP and VALIDATE**: Test welcome message works

### Full Feature Delivery

1. Complete MVP (above)
2. Add Phase 4: US2 Email Gate (T010-T015)
3. Add Phase 6: US4 OAuth Bypass (T021-T022)
4. Complete Phase 7: Polish (T023-T027)

---

## Summary

| Metric                 | Value |
| ---------------------- | ----- |
| Total Tasks            | 27    |
| US1 Tasks              | 5     |
| US2 Tasks              | 6     |
| US3 Tasks              | 2     |
| US4 Tasks              | 2     |
| Setup Tasks            | 3     |
| Foundation Tasks       | 4     |
| Polish Tasks           | 5     |
| Parallel Opportunities | 12    |

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story independently testable at checkpoint
- TDD: Write tests first, verify they fail, then implement
- Commit after each task or logical group
- Edge case: Welcome message deletion is permanent (by design) - no re-send logic needed
