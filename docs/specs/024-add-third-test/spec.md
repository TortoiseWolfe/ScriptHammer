# Feature Specification: Comprehensive E2E Test Suite for User Messaging

**Feature Branch**: `024-add-third-test`
**Created**: 2025-11-24
**Status**: Draft
**Input**: User description: "Add third test user and create comprehensive E2E test suite that verifies both test users can sign in, find each other at /messages/connections, send friend requests, accept connections, send encrypted messages, reply to messages, and sign out successfully. All tests must run locally in Docker before any code is pushed to production."

## Clarifications

### Session 2025-11-24

- Q: What should the password be for the third test user (`test-user-b@example.com`)? → A: TestPassword456!
- Q: What should the username be for the third test user's profile (`test-user-b@example.com`)? → A: testuser-b

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Complete Messaging Workflow Test (Priority: P1)

As a developer, I need to verify that two test users can complete the entire messaging workflow from sign-in to sign-out, so that I can confirm all messaging features work correctly before deploying to production.

**Why this priority**: This is the core requirement - without this test, we cannot verify the messaging system works end-to-end. This directly addresses the user's inability to find other users and send messages.

**Independent Test**: Can be fully tested by running the E2E test in Docker with two test users, and delivers confidence that the complete messaging workflow functions correctly from start to finish.

**Acceptance Scenarios**:

1. **Given** two test users exist in the database, **When** User A signs in with valid credentials, **Then** User A is redirected to the home page and authenticated
2. **Given** User A is signed in, **When** User A navigates to `/messages/connections`, **Then** the connections page loads successfully
3. **Given** User A is on the connections page, **When** User A searches for User B by email, **Then** User B appears in search results
4. **Given** User B appears in search results, **When** User A sends a friend request, **Then** the request is created with status "pending"
5. **Given** User B signs in, **When** User B views pending requests, **Then** User A's request appears in the received tab
6. **Given** User A's request is visible, **When** User B accepts the request, **Then** the connection status changes to "accepted" for both users
7. **Given** both users are connected, **When** User A sends an encrypted message to User B, **Then** the message is stored encrypted in the database
8. **Given** User A sent a message, **When** User B opens the conversation, **Then** User B sees the decrypted message content
9. **Given** User B sees the message, **When** User B replies to User A, **Then** User A can see the reply in the conversation
10. **Given** both users have completed messaging, **When** each user signs out, **Then** both users are redirected to the home page and no longer authenticated

---

### User Story 2 - Third Test User Setup (Priority: P1)

As a developer, I need a third test user in the system (separate from my personal account), so that I can test messaging workflows between two isolated test accounts.

**Why this priority**: Critical prerequisite for Story 1. Currently only two test users exist (test@example.com and the developer's personal account JonPohlner@gmail.com). We need a third user specifically for testing.

**Independent Test**: Can be tested by verifying the new user exists in Supabase, has correct credentials in .env, and can successfully sign in.

**Acceptance Scenarios**:

1. **Given** a new test user email is defined, **When** the user is created in Supabase, **Then** the user record exists in auth.users table
2. **Given** the user exists in Supabase, **When** credentials are added to .env file, **Then** TEST_USER_TERTIARY_EMAIL and TEST_USER_TERTIARY_PASSWORD variables are set
3. **Given** the user credentials are configured, **When** attempting to sign in with those credentials, **Then** authentication succeeds
4. **Given** authentication succeeds, **When** checking the user_profiles table, **Then** a profile record exists for the user with a username

---

### User Story 3 - Local-Only Test Execution (Priority: P1)

As a developer, I need to run E2E tests inside Docker locally before pushing to production, so that I never deploy broken code that affects users.

**Why this priority**: Critical safety requirement. The user explicitly stated they were harmed by untested code being pushed to production ("now I'm back to not being able to sing in at all").

**Independent Test**: Can be tested by running `docker compose exec scripthammer pnpm exec playwright test` and verifying tests execute within the container.

**Acceptance Scenarios**:

1. **Given** Docker containers are running, **When** E2E test command is executed inside container, **Then** Playwright tests run successfully
2. **Given** tests are running, **When** tests interact with localhost:3000, **Then** the dev server responds (tests don't fail with connection refused)
3. **Given** all tests pass locally, **When** developer attempts to push code, **Then** push is allowed
4. **Given** any test fails locally, **When** developer attempts to push code, **Then** the process is blocked until tests pass

---

### Edge Cases

- What happens when User A searches for a non-existent user email?
- How does the system handle duplicate friend requests?
- What happens if User A tries to message User B before connection is accepted?
- How does the system handle sign-out when the user has unsent messages in offline queue?
- What happens if encryption keys are missing when attempting to decrypt a message?
- How does the system handle concurrent friend requests (A→B and B→A simultaneously)?
- What happens if database connection is lost during message send?
- How does the system handle very long messages (>10,000 characters)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a third test user with email `test-user-b@example.com` and password `TestPassword456!` stored in .env as TEST_USER_TERTIARY_PASSWORD
- **FR-002**: System MUST create user profile record for third test user with username `testuser-b`
- **FR-003**: E2E tests MUST verify both test users (`test@example.com` and `test-user-b@example.com`) can sign in successfully
- **FR-004**: E2E tests MUST verify user search functionality at `/messages/connections` returns correct results
- **FR-005**: E2E tests MUST verify friend request creation, acceptance, and connection establishment
- **FR-006**: E2E tests MUST verify encrypted message sending and receiving between connected users
- **FR-007**: E2E tests MUST verify message decryption displays correct plaintext content
- **FR-008**: E2E tests MUST verify reply functionality works bidirectionally
- **FR-009**: E2E tests MUST verify sign-out functionality works correctly
- **FR-010**: E2E tests MUST run inside Docker container via `docker compose exec scripthammer pnpm exec playwright test`
- **FR-011**: System MUST NOT allow code push to production until all E2E tests pass locally
- **FR-012**: Tests MUST use test users from .env configuration (TEST_USER_PRIMARY_EMAIL, TEST_USER_TERTIARY_EMAIL)
- **FR-013**: Tests MUST clean up test data (connections, messages) between test runs to ensure idempotency
- **FR-014**: Tests MUST verify zero-knowledge encryption by checking database contains only ciphertext, not plaintext (verification procedure detailed in contracts/messaging-contract.md §Encryption Security and §TC-MSG-012)
- **FR-015**: System MUST auto-generate ECDH encryption keys (P-256 curve) on first sign-in and store in localStorage for zero-knowledge architecture (implementation exists in src/contexts/AuthContext.tsx lines 84-100)

### Key Entities

- **Test User A**: Primary test user (test@example.com) - initiates friend requests and messages
- **Test User B**: Tertiary test user (email: test-user-b@example.com, username: testuser-b) - receives and responds to friend requests and messages
- **User Profile**: Database record containing username, display_name, and avatar_url for each user
- **Connection**: Database record linking two users with status (pending/accepted/declined/blocked)
- **Message**: Database record containing encrypted message content, IV, conversation_id, and sender_id
- **Conversation**: Database record linking two participants and tracking last_message_at timestamp

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: E2E test completes full workflow (sign-in → find users → connect → message → reply → sign-out) in under 60 seconds
- **SC-002**: Third test user can be created in Supabase and sign in successfully within 5 minutes
- **SC-003**: 100% of E2E tests pass when run locally in Docker before any code is pushed to production
- **SC-004**: User search returns results within 2 seconds of clicking "Search" button
- **SC-005**: Friend request acceptance updates connection status to "accepted" within 3 seconds
- **SC-006**: Encrypted messages are delivered and decrypted correctly 100% of the time
- **SC-007**: Database inspection confirms zero plaintext messages are stored (only ciphertext)
- **SC-008**: Tests can be run repeatedly without manual data cleanup (idempotent)
- **SC-009**: Test execution inside Docker container succeeds without "connection refused" errors
- **SC-010**: Zero production deployments occur with failing E2E tests
