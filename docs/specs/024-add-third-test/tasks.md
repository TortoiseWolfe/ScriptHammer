# Implementation Tasks: Comprehensive E2E Test Suite for User Messaging

**Branch**: `024-add-third-test`
**Created**: 2025-11-24
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document provides actionable implementation tasks for adding a third test user and creating a comprehensive E2E test suite that verifies complete messaging workflow from sign-in to sign-out.

**Critical Safety Requirement**: ALL tests MUST pass locally in Docker before ANY code is pushed to production (FR-011, SC-010).

## User Stories (Priority Order)

1. **[US2]** Third Test User Setup (P1 - Foundational) - Create test-user-b@example.com for testing
2. **[US3]** Local-Only Test Execution (P1 - Foundational) - Configure Docker-based test execution
3. **[US1]** Complete Messaging Workflow Test (P1 - Main Feature) - Full sign-in → message → sign-out test

---

## Phase 1: Setup & Configuration

### Environment Configuration

- [ ] **T001** [US2] Add tertiary test user credentials to `.env` file
  - **File**: `.env`
  - **Action**: Add `TEST_USER_TERTIARY_EMAIL=test-user-b@example.com` and `TEST_USER_TERTIARY_PASSWORD=TestPassword456!`
  - **Success**: Environment variables exist and are loadable
  - **Ref**: FR-001, Data-Model §Environment Configuration

- [ ] **T002** [US2] [P] Update `.env.example` with tertiary test user template
  - **File**: `.env.example`
  - **Action**: Add `TEST_USER_TERTIARY_EMAIL` and `TEST_USER_TERTIARY_PASSWORD` lines with example format
  - **Success**: Template shows required variables
  - **Ref**: FR-001, Data-Model §Environment Configuration

---

## Phase 2: Foundational Prerequisites (US2 & US3)

**Story Goal**: Create third test user and configure Docker test execution environment.

**Independent Test Criteria**:

- Third test user exists in Supabase and can sign in successfully
- Docker container can execute Playwright tests
- Test environment variables are accessible inside Docker

### US2: Third Test User Setup

- [ ] **T003** [US2] Create Supabase seed script for third test user
  - **File**: `supabase/migrations/seed-test-user-b.sql`
  - **Action**: Create SQL script that:
    - Checks if user exists (idempotent)
    - INSERTs into `auth.users` with bcrypt password hash
    - INSERTs into `user_profiles` with username='testuser-b', display_name='Test User B'
    - Confirms email (email_confirmed_at = now())
  - **Success**: Script runs without errors, creates user if not exists
  - **Ref**: FR-001, FR-002, Data-Model §Test User Entity
  - **Pattern**: Follow existing `supabase/seed-test-user.sql` structure

- [ ] **T004** [US2] Run seed script to create third test user in database
  - **Command**: `docker compose exec scripthammer psql $DATABASE_URL -f supabase/migrations/seed-test-user-b.sql`
  - **Action**: Execute seed script against Supabase database
  - **Success**: User exists in auth.users with email='test-user-b@example.com', profile exists with username='testuser-b'
  - **Verification**: Query `SELECT email FROM auth.users WHERE email = 'test-user-b@example.com';`
  - **Ref**: FR-001, FR-002, SC-002

- [ ] **T005** [US2] Verify third test user can sign in successfully
  - **Action**: Manual verification or simple test script
  - **Command**: Sign in with test-user-b@example.com / TestPassword456!
  - **Success**: Authentication succeeds, session created
  - **Ref**: FR-001, FR-002, User Story 2 Scenario 3

### US3: Local-Only Test Execution Setup

- [ ] **T006** [US3] Verify Playwright is installed in Docker container
  - **Command**: `docker compose exec scripthammer pnpm exec playwright --version`
  - **Action**: Check Playwright version
  - **Success**: Returns version number (e.g., "Version 1.55.0")
  - **Ref**: FR-010, Plan §Technical Context
  - **Troubleshooting**: If missing, run `docker compose exec scripthammer pnpm exec playwright install`

- [ ] **T007** [US3] [P] Verify dev server is accessible from Docker container
  - **Command**: `docker compose exec scripthammer curl -I http://localhost:3000`
  - **Action**: Test HTTP connectivity from container to dev server
  - **Success**: Returns `HTTP/1.1 200 OK`
  - **Ref**: FR-010, SC-009, Research §Q1

- [ ] **T008** [US3] [P] Verify environment variables are accessible in test environment
  - **Action**: Check `.env` is mounted in Docker container
  - **Command**: `docker compose exec scripthammer env | grep TEST_USER`
  - **Success**: TEST_USER_PRIMARY_EMAIL, TEST_USER_TERTIARY_EMAIL visible
  - **Ref**: FR-012

**Checkpoint**: Third test user created, Docker test environment validated ✓

---

## Phase 3: Complete Messaging Workflow Test (US1)

**Story Goal**: Implement comprehensive E2E test that verifies both test users can sign in, connect, message, and sign out successfully.

**Independent Test Criteria**:

- Test completes full workflow in <60 seconds (SC-001)
- User search returns results in <2 seconds (SC-004)
- Friend request acceptance completes in <3 seconds (SC-005)
- Messages are encrypted in database (SC-007)
- Test can run repeatedly without manual cleanup (SC-008)
- 100% test pass rate (SC-003)

### Test Implementation

- [ ] **T009** [US1] Create complete-user-workflow.spec.ts test file
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**: Create test file with basic Playwright imports and test structure
  - **Success**: File exists with proper TypeScript imports
  - **Ref**: FR-003 through FR-009, Plan §Project Structure

- [ ] **T010** [US1] Implement test setup and cleanup (beforeAll, beforeEach, afterAll)
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - `beforeAll`: Initialize Supabase client, store test user IDs
    - `beforeEach`: Clean up test data (connections, conversations, messages) using service role key
    - `afterAll`: Final cleanup
  - **Success**: Test data is cleaned before each run (idempotent)
  - **Ref**: FR-013, SC-008, Data-Model §Test Data Lifecycle
  - **Pattern**: Follow Contracts/messaging-contract §Data Cleanup Contract

- [ ] **T010a** [US1] Implement cleanup failure recovery and logging
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Wrap all cleanup operations in try-catch blocks
    - Log specific errors (table name, operation, SQL error, user IDs involved)
    - Implement retry logic with exponential backoff (3 attempts, 1s/2s/4s delays)
    - If cleanup fails after retries: Skip test with clear error message explaining manual cleanup needed
    - Provide troubleshooting guidance in error output (e.g., "Run: docker compose exec scripthammer psql $DATABASE_URL ...")
  - **Success**: Test failures from cleanup issues are diagnosable with actionable error messages
  - **Ref**: User feedback "if it fails we need to know why", Checklist CHK038, Quickstart §Troubleshooting
  - **Pattern**: Defensive error handling with diagnostic output

- [ ] **T011** [US1] Implement User A sign-in test step
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Create browser context for User A
    - Navigate to /sign-in
    - Fill email (TEST_USER_PRIMARY_EMAIL) and password
    - Click sign-in button
    - Wait for redirect to home page (/)
    - Assert session exists in localStorage
  - **Success**: User A authenticated, redirected to /
  - **Timeout**: 5 seconds max
  - **Ref**: FR-003, User Story 1 Scenario 1, Contracts/auth-contract §TC-AUTH-001

- [ ] **T012** [US1] Implement User A navigation to /messages/connections
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Click navigation link or navigate directly to /messages/connections
    - Wait for page load
    - Assert URL is /messages/connections
    - Assert page content loaded (search box visible)
  - **Success**: Connections page loads successfully
  - **Timeout**: 2 seconds max
  - **Ref**: FR-004, User Story 1 Scenario 2

- [ ] **T013** [US1] Implement User A search for User B by email
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Fill search input with TEST_USER_TERTIARY_EMAIL
    - Click search button
    - Wait for search results
    - Assert User B appears in results (by username 'testuser-b')
  - **Success**: Search returns User B within 2 seconds
  - **Timeout**: 2000ms (SC-004)
  - **Ref**: FR-004, SC-004, User Story 1 Scenario 3, Contracts/messaging-contract §TC-MSG-001

- [ ] **T014** [US1] Implement User A send friend request to User B
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Click "Send Friend Request" button for User B
    - Wait for request confirmation
    - Assert request status shows "pending"
    - Query database to verify connection record exists with status='pending'
  - **Success**: Friend request created with status='pending'
  - **Ref**: FR-005, User Story 1 Scenario 4, Contracts/messaging-contract §TC-MSG-004

- [ ] **T015** [US1] Implement User B sign-in test step
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Create separate browser context for User B (isolated from User A)
    - Navigate to /sign-in
    - Fill email (TEST_USER_TERTIARY_EMAIL) and password (TestPassword456!)
    - Click sign-in button
    - Wait for redirect to home page
    - Assert session exists for User B
  - **Success**: User B authenticated in separate context
  - **Timeout**: 5 seconds max
  - **Ref**: FR-003, User Story 1 Scenario 5, Contracts/auth-contract §TC-AUTH-002

- [ ] **T016** [US1] Implement User B view pending friend requests
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Navigate to /messages/connections (or pending requests tab)
    - Wait for requests list to load
    - Assert User A's request appears in received tab
    - Assert request from User A (by username 'testuser')
  - **Success**: User B sees pending request from User A
  - **Ref**: FR-005, User Story 1 Scenario 5, Contracts/messaging-contract §TC-MSG-006

- [ ] **T017** [US1] Implement User B accept friend request from User A
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Click "Accept" button on User A's request
    - Wait for status update
    - Assert connection status changes to "accepted"
    - Query database to verify bidirectional connection (both directions have status='accepted')
  - **Success**: Connection accepted, bidirectional connections exist
  - **Timeout**: 3000ms (SC-005)
  - **Ref**: FR-005, SC-005, User Story 1 Scenario 6, Contracts/messaging-contract §TC-MSG-007/TC-MSG-008

- [ ] **T018** [US1] Implement User A send encrypted message to User B
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Navigate to conversation with User B (or click message button)
    - Wait for conversation page to load
    - Type message in input field: "Hello from User A"
    - Click send button
    - Wait for message to appear in conversation
    - Query database directly to verify:
      - Message exists in `messages` table
      - `encrypted_content` does NOT match plaintext "Hello from User A"
      - `content_iv` exists (initialization vector)
  - **Success**: Message sent, stored encrypted in database (SC-007)
  - **Ref**: FR-006, FR-014, SC-007, User Story 1 Scenario 7, Contracts/messaging-contract §TC-MSG-011/TC-MSG-012

- [ ] **T019** [US1] Implement User B receive and decrypt message from User A
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - In User B's browser context, navigate to conversations
    - Click on conversation with User A
    - Wait for messages to load
    - Assert message "Hello from User A" is visible (decrypted client-side)
  - **Success**: User B sees decrypted message content
  - **Ref**: FR-007, SC-006, User Story 1 Scenario 8, Contracts/messaging-contract §TC-MSG-013

- [ ] **T020** [US1] Implement User B reply to User A's message
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - In User B's context, type reply: "Reply from User B"
    - Click send button
    - Wait for reply to appear
    - Query database to verify reply is encrypted
  - **Success**: Reply sent and encrypted
  - **Ref**: FR-008, SC-006, User Story 1 Scenario 9, Contracts/messaging-contract §TC-MSG-014

- [ ] **T021** [US1] Implement User A receive reply from User B
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - In User A's browser context, refresh or wait for real-time update
    - Assert reply "Reply from User B" appears in conversation
  - **Success**: User A sees decrypted reply
  - **Ref**: FR-008, SC-006, User Story 1 Scenario 9

- [ ] **T022** [US1] Implement User A sign-out test step
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Click sign-out button (in nav menu or account dropdown)
    - Wait for redirect to /sign-in or home page
    - Assert session cleared from localStorage
    - Query Supabase to verify session invalidated
  - **Success**: User A signed out, session cleared
  - **Ref**: FR-009, User Story 1 Scenario 10, Contracts/auth-contract §TC-AUTH-006

- [ ] **T023** [US1] Implement User B sign-out test step
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - In User B's context, click sign-out button
    - Wait for redirect
    - Assert session cleared
  - **Success**: User B signed out, session cleared
  - **Ref**: FR-009, User Story 1 Scenario 10, Contracts/auth-contract §TC-AUTH-007

- [ ] **T024** [US1] Add performance assertions to test
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Wrap test in timer: `const startTime = Date.now();`
    - At end of test: `const duration = Date.now() - startTime;`
    - Assert `duration < 60000` (60 seconds - SC-001)
    - Add individual step timeouts:
      - Search: 2000ms (SC-004)
      - Accept: 3000ms (SC-005)
  - **Success**: Test completes in <60s, individual operations meet targets
  - **Ref**: SC-001, SC-004, SC-005

- [ ] **T025** [US1] Add encryption verification to test
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - After sending messages, query database using service role key
    - For each message:
      - Assert `encrypted_content !== plaintext_message`
      - Assert `encrypted_content` is not empty
      - Assert `content_iv` is not empty
      - Assert `encrypted_content` does not contain any recognizable words from plaintext
  - **Success**: Database contains only ciphertext, no plaintext (SC-007)
  - **Ref**: FR-014, SC-007, Research §Q4

**Checkpoint**: Complete messaging workflow test implemented ✓

### Test Execution Validation

- [ ] **T026** [US3] Run complete-user-workflow test locally in Docker
  - **Command**: `docker compose exec scripthammer pnpm exec playwright test e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**: Execute test inside Docker container
  - **Success**: Test passes, completes in <60 seconds
  - **Ref**: FR-010, SC-001, SC-003, Quickstart §Run Specific Test File

- [ ] **T027** [US3] Verify test idempotency (run multiple times)
  - **Command**: Run T026 command 3 times consecutively
  - **Action**: Execute same test 3 times without manual cleanup
  - **Success**: All 3 runs pass with identical results
  - **Ref**: FR-013, SC-008, Quickstart §Verify Test Idempotency

- [ ] **T028** [US3] Run full E2E test suite to verify no regressions
  - **Command**: `docker compose exec scripthammer pnpm exec playwright test`
  - **Action**: Run all E2E tests (40+ existing + new test)
  - **Success**: All tests pass, no failures
  - **Ref**: FR-011, SC-003, SC-010

---

## Phase 4: Polish & Documentation

### Error Handling & Diagnostics

- [ ] **T029** [P] Add detailed error messages to test cleanup function
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Wrap cleanup operations in try-catch blocks
    - Log specific errors (which table, which user ID, SQL error)
    - Provide troubleshooting hints in error messages
  - **Success**: Test failures provide actionable error messages
  - **Ref**: User feedback "if it fails we need to know why", Quickstart §Troubleshooting

- [ ] **T030** [P] Add screenshot capture on test failure
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Configure Playwright to capture screenshot on failure
    - Store in `test-results/` directory with timestamp
  - **Success**: Failed tests produce screenshots for debugging
  - **Ref**: Checklist CHK078

- [ ] **T031** [P] Add console log capture for debugging
  - **File**: `e2e/messaging/complete-user-workflow.spec.ts`
  - **Action**:
    - Listen to page console events
    - Log console errors to test output
    - Assert no console errors during test execution
  - **Success**: Console errors visible in test output
  - **Ref**: SC-009, Checklist CHK077

### Pre-Push Validation

- [ ] **T032** Verify all tests pass before allowing push
  - **Action**: Run full test suite as final validation
  - **Command**: `docker compose exec scripthammer pnpm exec playwright test`
  - **Success**: 100% pass rate (48+ tests including new test)
  - **Gate**: DO NOT PUSH if any tests fail
  - **Ref**: FR-011, SC-003, SC-010

- [ ] **T033** Document pre-push procedure in quickstart.md
  - **File**: `specs/024-add-third-test/quickstart.md`
  - **Action**: Already documented in §Pre-Push Checklist
  - **Verification**: Review checklist is complete and accurate
  - **Ref**: FR-011, SC-010

---

## Task Summary

**Total Tasks**: 34

### By User Story:

- **US2 (Third Test User Setup)**: 5 tasks (T001-T005)
- **US3 (Local-Only Test Execution)**: 4 tasks (T006-T008, T026-T028)
- **US1 (Complete Messaging Workflow Test)**: 18 tasks (T009-T025, including T010a for cleanup failure recovery)
- **Polish**: 4 tasks (T029-T031, T033)
- **Pre-Push Gate**: 1 task (T032)

### Parallelizable Tasks:

- **Environment Setup**: T001, T002 can run in parallel
- **Docker Validation**: T006, T007, T008 can run in parallel
- **Error Handling**: T029, T030, T031 can run in parallel

### Critical Path (Sequential):

1. T001-T002 (Environment config)
2. T003-T005 (Create third test user)
3. T006-T008 (Validate Docker environment)
4. T009-T025 (Implement complete workflow test)
5. T026-T028 (Validate test execution)
6. T029-T031 (Add error handling)
7. T032 (Final pre-push validation)

---

## Dependencies

### Story Completion Order:

1. **US2 (Third Test User Setup)** - MUST complete first (foundational)
2. **US3 (Local-Only Test Execution)** - MUST complete second (foundational)
3. **US1 (Complete Messaging Workflow Test)** - Depends on US2 and US3

### Task Dependencies:

- T003-T005 → T009 (Need third test user before writing tests)
- T006-T008 → T026 (Need Docker validated before running tests)
- T009-T025 → T026 (Need test written before running it)
- T026-T028 → T032 (Need tests passing before push)

---

## Parallel Execution Examples

### Phase 1 (Environment Setup):

```bash
# Run in parallel
docker compose exec scripthammer sh -c "
  echo 'TEST_USER_TERTIARY_EMAIL=test-user-b@example.com' >> .env &
  echo 'TEST_USER_TERTIARY_PASSWORD=TestPassword456!' >> .env &
  # Update .env.example in separate operation
  wait
"
```

### Phase 2 (Docker Validation):

```bash
# Run validations in parallel
docker compose exec scripthammer pnpm exec playwright --version &
docker compose exec scripthammer curl -I http://localhost:3000 &
docker compose exec scripthammer env | grep TEST_USER &
wait
```

### Phase 4 (Error Handling Improvements):

```bash
# Add error handling to multiple files concurrently
# (if editing different files)
# T029, T030, T031 can be edited in parallel
```

---

## Implementation Strategy

### MVP (Minimum Viable Product):

- **Scope**: Complete Phase 1, 2, and Phase 3 up to T025
- **Goal**: Working E2E test that can run locally
- **Deliverable**: Single test file that verifies complete workflow
- **Timeline**: Implement T001-T025, validate with T026-T028

### Incremental Delivery:

1. **Iteration 1** (Foundation): T001-T008 - Setup environment and validate
2. **Iteration 2** (Core Test): T009-T018 - Implement sign-in through message sending
3. **Iteration 3** (Complete Flow): T019-T025 - Add message receiving, replies, sign-out
4. **Iteration 4** (Validation): T026-T028 - Verify test execution and idempotency
5. **Iteration 5** (Polish): T029-T033 - Add error handling and final validation

### Success Criteria:

- ✅ Third test user exists and can sign in (US2 complete)
- ✅ Tests run in Docker without errors (US3 complete)
- ✅ Complete workflow test passes in <60s (US1 complete, SC-001)
- ✅ Database contains only ciphertext (SC-007)
- ✅ Tests are idempotent (SC-008)
- ✅ 100% test pass rate before push (SC-003, SC-010)

---

## Notes

**Critical Safety Gate**: Task T032 is a MANDATORY gate. Code MUST NOT be pushed to production if any tests fail. This prevents the production breakage that occurred previously (user feedback: "now I'm back to not being able to sign in at all").

**Test Data Cleanup**: Tasks T010 and T027 ensure test idempotency. The `beforeEach` hook must properly clean up all test data (connections, conversations, messages) using the service role key to bypass RLS.

**Performance Monitoring**: Task T024 ensures the test meets all performance success criteria (SC-001, SC-004, SC-005). If timeouts are exceeded, investigate performance issues before proceeding.

**Encryption Verification**: Task T025 is critical for validating zero-knowledge encryption (FR-014, SC-007). The database must contain ONLY ciphertext, never plaintext messages.
