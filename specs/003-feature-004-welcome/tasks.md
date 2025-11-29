# Tasks: Welcome Message Redesign

**Input**: Design documents from `/specs/003-feature-004-welcome/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/welcome-service.ts, quickstart.md

**Tests**: Included per Constitution Principle II (Test-First Development)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3, or SETUP/FOUNDATION/POLISH

---

## Phase 1: Setup

**Purpose**: Verify prerequisites and prepare development environment

- [x] T001 [SETUP] Verify Docker environment running: `docker compose ps`
- [x] T002 [SETUP] Verify existing messaging system works: test sending a message between two users
- [x] T003 [SETUP] Delete all existing users for clean slate (per clarification): SQL via Supabase Dashboard

**Checkpoint**: Clean environment ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Admin user and public key MUST exist before any welcome message can be sent

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [FOUNDATION] Add admin user constant to `scripts/seed-test-users.ts`:

  ```typescript
  const ADMIN_USER = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@scripthammer.com',
    username: 'scripthammer',
    displayName: 'ScriptHammer',
  };
  ```

- [x] T005 [FOUNDATION] Implement `setupAdminUser()` function in `scripts/seed-test-users.ts`:
  - Create admin auth user with fixed UUID if not exists
  - Create admin profile if not exists
  - Generate ECDH P-256 keypair using Web Crypto API
  - Store public key in `user_encryption_keys` table
  - Discard private key (not needed)

- [x] T006 [FOUNDATION] Update `main()` in `scripts/seed-test-users.ts` to call `setupAdminUser()` before test users

- [x] T007 [FOUNDATION] Run seed script and verify admin public key exists:

  ```bash
  docker compose exec scripthammer pnpm exec tsx scripts/seed-test-users.ts
  ```

- [x] T008 [FOUNDATION] Verify admin public key in database via SQL query

**Checkpoint**: Admin user with public key exists - welcome service implementation can begin

---

## Phase 3: User Story 1 - New User Receives Welcome Message (Priority: P1) 🎯 MVP

**Goal**: New users automatically receive encrypted welcome message from admin after key initialization

**Independent Test**: Create new user, initialize keys, verify welcome message appears in conversations

### Tests for User Story 1

- [x] T009 [P] [US1] Update `src/services/messaging/welcome-service.test.ts`: Remove tests for `initializeAdminKeys()` and password derivation

- [x] T010 [P] [US1] Add test in `welcome-service.test.ts`: `getAdminPublicKey()` returns valid JWK when admin key exists

- [x] T011 [P] [US1] Add test in `welcome-service.test.ts`: `getAdminPublicKey()` throws when admin key missing

- [x] T012 [US1] Add test in `welcome-service.test.ts`: `sendWelcomeMessage()` with new signature (userId, userPrivateKey, userPublicKey) creates conversation and message

- [x] T013 [US1] Add test in `welcome-service.test.ts`: `sendWelcomeMessage()` derives shared secret using ECDH(userPrivate, adminPublic)

### Implementation for User Story 1

- [x] T014 [US1] Remove from `src/services/messaging/welcome-service.ts`:
  - `ADMIN_CONFIG.password` getter
  - `initializeAdminKeys()` method
  - `ensureAdminKeys()` method
  - `adminKeys` private property

- [x] T015 [US1] Add `getAdminPublicKey()` method to `src/services/messaging/welcome-service.ts`:

  ```typescript
  async getAdminPublicKey(): Promise<JsonWebKey> {
    const { data, error } = await supabase
      .from('user_encryption_keys')
      .select('public_key')
      .eq('user_id', ADMIN_USER_ID)
      .eq('revoked', false)
      .single();
    if (error || !data) throw new Error('Admin public key not found');
    return data.public_key;
  }
  ```

- [x] T016 [US1] Update `sendWelcomeMessage()` signature in `src/services/messaging/welcome-service.ts`:
  - Change from `(userId, userPublicKey)` to `(userId, userPrivateKey: CryptoKey, userPublicKey: JsonWebKey)`
  - Implement new flow per contract

- [x] T017 [US1] Implement shared secret derivation in `sendWelcomeMessage()`:
  - Fetch admin public key via `getAdminPublicKey()`
  - Import admin public key as CryptoKey
  - Derive shared secret: `ECDH(userPrivateKey, adminPublicKey)`

- [x] T018 [US1] Update `src/components/auth/SignInForm/SignInForm.tsx` to pass `keyPair.privateKey` to `sendWelcomeMessage()`:

  ```typescript
  welcomeService.sendWelcomeMessage(
    userId,
    keyPair.privateKey,
    keyPair.publicKeyJwk
  );
  ```

- [x] T019 [US1] Run tests: `docker compose exec scripthammer pnpm test welcome-service`

- [x] T020 [US1] Manual verification: Sign up new user, check conversations for welcome message from scripthammer

**Checkpoint**: User Story 1 complete - new users receive welcome messages

---

## Phase 4: User Story 2 - Idempotent Welcome Messages (Priority: P2)

**Goal**: Prevent duplicate welcome messages on re-initialization or multiple calls

**Independent Test**: Call welcome service multiple times for same user, verify only one message exists

### Tests for User Story 2

- [x] T021 [P] [US2] Add test in `welcome-service.test.ts`: `sendWelcomeMessage()` returns `{skipped: true}` when `welcome_message_sent = true`

- [x] T022 [P] [US2] Add test in `welcome-service.test.ts`: Concurrent calls create only one conversation (upsert pattern)

### Implementation for User Story 2

- [x] T023 [US2] Verify idempotency check exists in `sendWelcomeMessage()`:
  - Query `welcome_message_sent` flag from `user_profiles`
  - Return early with `{success: true, skipped: true, reason: 'Welcome message already sent'}` if true

- [x] T024 [US2] Verify conversation creation uses upsert pattern in `sendWelcomeMessage()`:
  - Use `ON CONFLICT DO NOTHING` or check-then-insert with retry
  - Handle race condition gracefully

- [x] T025 [US2] Run idempotency tests: Call service twice for same user, verify one message

**Checkpoint**: User Story 2 complete - no duplicate welcome messages

---

## Phase 5: User Story 3 - Graceful Admin Key Missing Handling (Priority: P3)

**Goal**: System handles missing admin public key gracefully without blocking sign-in

**Independent Test**: Delete admin public key, sign in new user, verify sign-in succeeds (no welcome message)

### Tests for User Story 3

- [x] T026 [P] [US3] Add test in `welcome-service.test.ts`: `sendWelcomeMessage()` catches `getAdminPublicKey()` error and returns `{success: false, skipped: true}`

- [x] T027 [P] [US3] Add test in `welcome-service.test.ts`: Missing admin key logs error via logger

### Implementation for User Story 3

- [x] T028 [US3] Wrap `getAdminPublicKey()` call in try/catch in `sendWelcomeMessage()`:

  ```typescript
  try {
    const adminPublicKey = await this.getAdminPublicKey();
    // ... proceed with encryption
  } catch (error) {
    logger.error('Failed to fetch admin public key', { error });
    return {
      success: false,
      skipped: true,
      reason: 'Admin public key not found',
    };
  }
  ```

- [x] T029 [US3] Verify SignInForm catch block handles welcome service failure gracefully (already exists, just verify)

- [x] T030 [US3] Manual test: Delete admin public key, sign up user, verify sign-in completes

**Checkpoint**: User Story 3 complete - graceful degradation when admin key missing

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final verification

- [x] T031 [P] [POLISH] Update `CLAUDE.md` with static hosting constraint section:

  ```markdown
  ## Static Hosting Constraint

  This app is deployed to GitHub Pages (static hosting). This means:

  - NO server-side API routes (`src/app/api/` won't work in production)
  - NO access to non-NEXT*PUBLIC* environment variables in browser
  - All server-side logic must be in Supabase (database, Edge Functions, or triggers)

  When implementing features that need secrets:

  - Use Supabase Vault for secure storage
  - Use Edge Functions for server-side logic
  - Or design client-side solutions that don't require secrets
  ```

- [x] T032 [P] [POLISH] Remove obsolete `TEST_USER_ADMIN_PASSWORD` references from `.env.example` if present

- [x] T033 [POLISH] Run full test suite: `docker compose exec scripthammer pnpm test`

- [x] T034 [POLISH] Run type check: `docker compose exec scripthammer pnpm type-check`

- [x] T035 [POLISH] Run linter: `docker compose exec scripthammer pnpm lint`

- [x] T036 [POLISH] Run quickstart.md verification steps

- [x] T037 [POLISH] Commit changes with message: `fix(welcome): redesign to use admin public key instead of password derivation`

**Checkpoint**: Feature complete and ready for merge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (admin public key must exist)
- **User Story 2 (Phase 4)**: Can run after US1 OR in parallel (tests different behavior)
- **User Story 3 (Phase 5)**: Can run after US1 OR in parallel (tests different behavior)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Core functionality - MUST complete first for MVP
- **User Story 2 (P2)**: Independent of US1 implementation (tests idempotency)
- **User Story 3 (P3)**: Independent of US1/US2 (tests error handling)

### Within Each User Story

- Tests FIRST (RED) → Implementation (GREEN) → Refactor if needed
- Verify tests fail before implementing
- Run tests after each implementation task

### Parallel Opportunities

```bash
# Phase 3 tests (all [P]):
T009, T010, T011 can run in parallel

# Phase 4 tests (all [P]):
T021, T022 can run in parallel

# Phase 5 tests (all [P]):
T026, T027 can run in parallel

# Phase 6 polish (some [P]):
T031, T032 can run in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify environment)
2. Complete Phase 2: Foundational (admin user + public key)
3. Complete Phase 3: User Story 1 (welcome message works!)
4. **STOP and VALIDATE**: Test with real sign-up flow
5. Deploy if ready - US2 and US3 can be added incrementally

### Estimated Time

| Phase        | Tasks        | Time           |
| ------------ | ------------ | -------------- |
| Setup        | T001-T003    | 10 min         |
| Foundational | T004-T008    | 30 min         |
| User Story 1 | T009-T020    | 45 min         |
| User Story 2 | T021-T025    | 20 min         |
| User Story 3 | T026-T030    | 20 min         |
| Polish       | T031-T037    | 15 min         |
| **Total**    | **37 tasks** | **~2.5 hours** |

---

## Notes

- Constitution requires Test-First (Principle II) - tests included
- All development in Docker (Principle IV)
- No new components - service modification only
- SignInForm change is minimal (add one parameter to existing call)
- Admin private key is NEVER stored or needed at runtime
