# Tasks: Row Level Security Foundation

**Input**: Design documents from `/specs/000-rls-implementation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rls-policies.sql

**Tests**: Included per Constitution (TDD requirement)

**Organization**: Tasks grouped by user story for independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Supabase client setup

- [x] T001 Create Supabase project structure in supabase/
- [x] T002 [P] Create Supabase browser client in src/lib/supabase/client.ts
- [x] T003 [P] Create Supabase server client in src/lib/supabase/server.ts
- [x] T004 [P] Create auth middleware in src/lib/supabase/middleware.ts
- [x] T005 [P] Create test user factory in tests/fixtures/test-users.ts
- [x] T006 Configure environment variables in .env.example

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database schema and RLS infrastructure - MUST complete before user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Create profiles table schema in supabase/migrations/00000000000000_rls_foundation.sql
- [x] T008 Create audit_logs table schema in supabase/migrations/00000000000000_rls_foundation.sql
- [x] T009 Enable RLS on profiles table in supabase/migrations/00000000000000_rls_foundation.sql
- [x] T010 Enable RLS on audit_logs table in supabase/migrations/00000000000000_rls_foundation.sql
- [x] T011 [P] Create performance indexes in supabase/migrations/00000000000000_rls_foundation.sql
- [x] T012 [P] Create handle_new_user() trigger function in supabase/migrations/00000000000000_rls_foundation.sql
- [x] T013 [P] Create handle_updated_at() trigger function in supabase/migrations/00000000000000_rls_foundation.sql
- [ ] T014 Apply migration via Supabase Dashboard SQL Editor (MANUAL - requires Supabase project)
- [x] T015 Generate TypeScript types in src/types/database.ts using Supabase CLI

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - User Data Isolation (Priority: P0) MVP

**Goal**: Ensure authenticated users can only SELECT their own data from profiles table

**Independent Test**: Create two test users, verify User A cannot see User B's profile data

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T016 [P] [US1] Create user isolation test suite skeleton in tests/rls/user-isolation.test.ts
- [x] T017 [P] [US1] Add test: authenticated user can query own profile in tests/rls/user-isolation.test.ts
- [x] T018 [P] [US1] Add test: authenticated user cannot query other user's profile in tests/rls/user-isolation.test.ts
- [x] T019 [P] [US1] Add test: unauthenticated user cannot query any profiles in tests/rls/user-isolation.test.ts

### Implementation for User Story 1

- [x] T020 [US1] Create profiles_select_own policy (SELECT, authenticated, id = auth.uid()) in supabase/migrations/00000000000000_rls_foundation.sql
- [ ] T021 [US1] Apply updated migration via Supabase Dashboard (MANUAL - requires Supabase project)
- [ ] T022 [US1] Verify tests pass for user isolation (MANUAL - requires running tests)

**Checkpoint**: User data isolation is verified - users can only see their own profile

---

## Phase 4: User Story 2 - Profile Self-Management (Priority: P0)

**Goal**: Ensure only profile owner can UPDATE their profile; others are denied

**Independent Test**: Owner update succeeds, non-owner update is denied

### Tests for User Story 2

- [x] T023 [P] [US2] Add test: profile owner can update display_name in tests/rls/user-isolation.test.ts
- [x] T024 [P] [US2] Add test: profile owner can update bio in tests/rls/user-isolation.test.ts
- [x] T025 [P] [US2] Add test: non-owner cannot update another user's profile in tests/rls/user-isolation.test.ts
- [x] T026 [P] [US2] Add test: update returns error (not silent fail) for non-owner in tests/rls/user-isolation.test.ts

### Implementation for User Story 2

- [x] T027 [US2] Create profiles_update_own policy (UPDATE, authenticated, id = auth.uid()) in supabase/migrations/00000000000000_rls_foundation.sql
- [ ] T028 [US2] Apply updated migration via Supabase Dashboard (MANUAL - requires Supabase project)
- [ ] T029 [US2] Verify tests pass for profile self-management (MANUAL - requires running tests)

**Checkpoint**: Profile ownership is enforced - only owners can modify their profiles

---

## Phase 5: User Story 3 - Service Role Operations (Priority: P1)

**Goal**: Backend services using service_role can perform cross-user operations

**Independent Test**: Service role client can read/write all profiles; authenticated client cannot

### Tests for User Story 3

- [x] T030 [P] [US3] Create service role test suite in tests/rls/service-role.test.ts
- [x] T031 [P] [US3] Add test: service role can SELECT all profiles in tests/rls/service-role.test.ts
- [x] T032 [P] [US3] Add test: service role can INSERT audit_logs in tests/rls/service-role.test.ts
- [x] T033 [P] [US3] Add test: service role can UPDATE any profile in tests/rls/service-role.test.ts
- [x] T034 [P] [US3] Add test: authenticated user cannot INSERT to audit_logs in tests/rls/service-role.test.ts

### Implementation for User Story 3

- [x] T035 [US3] Verify service_role bypasses RLS by default (no policy needed)
- [x] T036 [US3] Document service role usage pattern in specs/000-rls-implementation/quickstart.md
- [ ] T037 [US3] Verify tests pass for service role operations (MANUAL - requires running tests)

**Checkpoint**: Service role can perform backend operations across all users

---

## Phase 6: User Story 4 - Anonymous User Restrictions (Priority: P1)

**Goal**: Unauthenticated (anon) users cannot access or enumerate user data

**Independent Test**: Queries without auth return empty results or access denied

### Tests for User Story 4

- [x] T038 [P] [US4] Create anonymous access test suite in tests/rls/anonymous-access.test.ts
- [x] T039 [P] [US4] Add test: anon user cannot SELECT from profiles in tests/rls/anonymous-access.test.ts
- [x] T040 [P] [US4] Add test: anon user cannot INSERT to profiles in tests/rls/anonymous-access.test.ts
- [x] T041 [P] [US4] Add test: anon user cannot SELECT from audit_logs in tests/rls/anonymous-access.test.ts
- [x] T042 [P] [US4] Add test: anon user enumeration attempt returns zero results in tests/rls/anonymous-access.test.ts

### Implementation for User Story 4

- [x] T043 [US4] Verify no anon policies exist (default deny)
- [ ] T044 [US4] Verify tests pass for anonymous restrictions (MANUAL - requires running tests)

**Checkpoint**: Anonymous users have no access to protected tables

---

## Phase 7: User Story 5 - Audit Trail Protection (Priority: P2)

**Goal**: Audit logs are immutable - no UPDATE/DELETE allowed for any role

**Independent Test**: Attempts to UPDATE or DELETE audit entries fail for all users

### Tests for User Story 5

- [x] T045 [P] [US5] Create audit immutability test suite in tests/rls/audit-immutability.test.ts
- [x] T046 [P] [US5] Add test: authenticated user can SELECT own audit entries in tests/rls/audit-immutability.test.ts
- [x] T047 [P] [US5] Add test: authenticated user cannot SELECT other user's audit entries in tests/rls/audit-immutability.test.ts
- [x] T048 [P] [US5] Add test: authenticated user cannot UPDATE audit_logs in tests/rls/audit-immutability.test.ts
- [x] T049 [P] [US5] Add test: authenticated user cannot DELETE from audit_logs in tests/rls/audit-immutability.test.ts
- [x] T050 [P] [US5] Add test: service role INSERT creates audit entry in tests/rls/audit-immutability.test.ts

### Implementation for User Story 5

- [x] T051 [US5] Create audit_logs_select_own policy (SELECT, authenticated, user_id = auth.uid()) in supabase/migrations/00000000000000_rls_foundation.sql
- [x] T052 [US5] Verify no UPDATE/DELETE policies exist for audit_logs (immutability)
- [ ] T053 [US5] Apply updated migration via Supabase Dashboard (MANUAL - requires Supabase project)
- [ ] T054 [US5] Verify tests pass for audit immutability (MANUAL - requires running tests)

**Checkpoint**: Audit logs are immutable and owner-scoped for SELECT

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and final cleanup

- [x] T055 [P] Update quickstart.md with verification queries in specs/000-rls-implementation/quickstart.md
- [x] T056 [P] Create seed data for manual testing in supabase/seed.sql
- [ ] T057 Run full RLS test suite and verify 100% pass rate (MANUAL - requires Supabase project)
- [x] T058 Document RLS pattern templates in specs/000-rls-implementation/research.md
- [ ] T059 [P] Performance test: verify <10ms policy latency (SC-004) (MANUAL - requires Supabase project)
- [ ] T060 Security review checklist completion (MANUAL - requires security review)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational completion
  - US1 and US2 are P0 (MVP) - complete first
  - US3 and US4 are P1 - complete second
  - US5 is P2 - complete last
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P0)**: No dependencies on other stories - MVP candidate
- **US2 (P0)**: No dependencies on other stories - MVP candidate
- **US3 (P1)**: No dependencies - tests service role bypass
- **US4 (P1)**: No dependencies - tests anonymous restrictions
- **US5 (P2)**: No dependencies - tests audit immutability

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Policies created in migration file
3. Migration applied via Dashboard
4. Tests verified to pass
5. Checkpoint validated before next story

### Parallel Opportunities

**Phase 1 (Setup)**:

```
T002, T003, T004, T005 can run in parallel (different files)
```

**Phase 2 (Foundational)**:

```
T011, T012, T013 can run in parallel (different SQL blocks)
```

**Each User Story Tests**:

```
All tests within a story can run in parallel (T016-T019, T023-T026, etc.)
```

**Cross-Story Parallelism**:

```
After Foundational, different developers can work on different stories:
- Developer A: US1 + US2 (P0 stories)
- Developer B: US3 + US4 (P1 stories)
- Developer C: US5 (P2 story)
```

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together:
Task: "Create user isolation test suite skeleton in tests/rls/user-isolation.test.ts"
Task: "Add test: authenticated user can query own profile"
Task: "Add test: authenticated user cannot query other user's profile"
Task: "Add test: unauthenticated user cannot query any profiles"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1 - User Data Isolation
4. Complete Phase 4: US2 - Profile Self-Management
5. **STOP and VALIDATE**: Test isolation and ownership independently
6. Deploy/demo if ready - core security is in place

### Incremental Delivery

1. Setup + Foundational → Database ready with RLS enabled
2. Add US1 + US2 → Core user isolation (MVP!)
3. Add US3 → Service role operations work
4. Add US4 → Anonymous users blocked
5. Add US5 → Audit immutability enforced
6. Polish → Documentation and performance verified

### Single Developer Strategy

Execute in priority order:

1. Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → **MVP Complete**
2. Phase 5 (US3) → Phase 6 (US4) → Phase 7 (US5)
3. Phase 8 (Polish)

---

## Summary

| Metric                 | Value                                   |
| ---------------------- | --------------------------------------- |
| Total Tasks            | 60                                      |
| Setup Tasks            | 6                                       |
| Foundational Tasks     | 9                                       |
| US1 Tasks (P0)         | 7                                       |
| US2 Tasks (P0)         | 7                                       |
| US3 Tasks (P1)         | 8                                       |
| US4 Tasks (P1)         | 7                                       |
| US5 Tasks (P2)         | 10                                      |
| Polish Tasks           | 6                                       |
| Parallel Opportunities | 28 tasks marked [P]                     |
| MVP Scope              | US1 + US2 (14 tasks after foundational) |

---

## Notes

- All policies use idempotent SQL (safe to re-run)
- Migration applied via Dashboard (not local CLI per Supabase free tier)
- Tests use real Supabase client with auth contexts
- Service role key must never be exposed to client
- Commit after each checkpoint
