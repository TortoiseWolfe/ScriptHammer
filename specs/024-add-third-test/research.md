# Phase 0: Research & Technical Investigation

**Feature**: Comprehensive E2E Test Suite for User Messaging
**Branch**: `024-add-third-test`
**Date**: 2025-11-24
**Status**: Complete

## Research Questions & Decisions

### 1. How should E2E tests run in Docker environment?

**Question**: What is the correct pattern for running Playwright tests inside Docker containers?

**Research**:

- Examined existing test setup: `/e2e/messaging/friend-requests.spec.ts`, `/e2e/auth/user-registration.spec.ts`
- Playwright config: `playwright.config.ts` already configured for Docker execution
- 40+ existing E2E tests run successfully with: `docker compose exec scripthammer pnpm exec playwright test`

**Decision**: Reuse existing Playwright Docker setup (no changes needed)

**Rationale**:

- ✅ Proven pattern - 40+ tests already passing
- ✅ No host-based Playwright issues (tests run inside container)
- ✅ Consistent with Docker-First Development principle (Constitution IV)
- ✅ dev server on localhost:3000 accessible from tests inside same container

**Alternatives Considered**:

- ❌ Host-based Playwright - rejected (previous failures with Docker networking)
- ❌ Separate test container - rejected (unnecessary complexity)

**Implementation Notes**:

```bash
# Execute tests inside Docker
docker compose exec scripthammer pnpm exec playwright test

# Run specific test file
docker compose exec scripthammer pnpm exec playwright test e2e/messaging/complete-user-workflow.spec.ts

# Run with UI mode for debugging
docker compose exec scripthammer pnpm exec playwright test --ui
```

---

### 2. How should the third test user be created?

**Question**: What is the best method to create and seed the third test user (test-user-b@example.com)?

**Research**:

- Examined `/supabase/seed-test-user.sql` (existing primary test user script)
- Supabase auth.users table structure requires: id (UUID), email, encrypted_password (bcrypt hash)
- User profile automatically created via trigger: `handle_new_user` function
- Existing seed script pattern: INSERT auth.users → trigger creates user_profiles record

**Decision**: Create `/supabase/migrations/seed-test-user-b.sql` following same pattern as `seed-test-user.sql`

**Rationale**:

- ✅ Repeatable - SQL script can be run multiple times idempotently
- ✅ Consistent with existing pattern
- ✅ Works with Supabase Edge Functions for password hashing
- ✅ Automatic profile creation via existing trigger

**Alternatives Considered**:

- ❌ Manual Supabase Dashboard creation - rejected (not repeatable, not version controlled)
- ❌ Test setup code with Supabase Admin API - rejected (adds complexity, slower)
- ❌ Create user programmatically in beforeAll hook - rejected (requires service role key exposure)

**Implementation Notes**:

```sql
-- seed-test-user-b.sql structure
-- 1. Check if user exists
-- 2. If not exists: INSERT into auth.users with bcrypt password hash
-- 3. If not exists: INSERT into user_profiles (or rely on trigger)
-- 4. Grant test user necessary permissions
```

---

### 3. How should test data cleanup work?

**Question**: How do we ensure tests are idempotent and don't leave stale data?

**Research**:

- Examined existing test patterns: `/e2e/messaging/friend-requests.spec.ts`
- Current pattern: Tests use unique email addresses for each run (e.g., `friend-request-tester-a@example.com`)
- Problem: This approach accumulates test data in database
- Requirement: SC-008 states "Tests can be run repeatedly without manual data cleanup (idempotent)"

**Decision**: Add cleanup logic in `beforeEach` hooks to delete test data before each test run

**Rationale**:

- ✅ Ensures clean state for each test
- ✅ Prevents false positives from stale data
- ✅ Meets idempotency requirement (SC-008)
- ✅ Service role key available in test environment for admin operations

**Alternatives Considered**:

- ❌ Manual cleanup - rejected (not automated, violates SC-008)
- ❌ afterEach cleanup - rejected (fails to clean if test crashes)
- ❌ Unique data per run - rejected (accumulates cruft, doesn't test real scenarios)

**Implementation Notes**:

```typescript
// In complete-user-workflow.spec.ts
test.beforeEach(async () => {
  // Delete existing connections between test users
  await supabase
    .from('connections')
    .delete()
    .or(`user_id.eq.${USER_A_ID},user_id.eq.${USER_B_ID}`);

  // Delete existing messages in conversations
  await supabase
    .from('messages')
    .delete()
    .in('conversation_id', [...conversation_ids]);

  // Delete existing conversations
  await supabase
    .from('conversations')
    .delete()
    .or(`participant_1_id.eq.${USER_A_ID},participant_2_id.eq.${USER_B_ID}`);
});
```

**Security Note**: Cleanup requires service role key (bypasses RLS). Store in `.env` as `SUPABASE_SERVICE_ROLE_KEY` and NEVER expose in client code.

---

### 4. How should we verify zero-knowledge encryption in tests?

**Question**: How do we test that messages are actually encrypted in the database (FR-014)?

**Research**:

- Examined encryption service: `/src/services/messaging/encryption-service.ts`
- Messages stored with: `encrypted_content` (ciphertext), `content_iv` (initialization vector)
- Key requirement: FR-014 states "Tests MUST verify zero-knowledge encryption by checking database contains only ciphertext"

**Decision**: Query database directly during test execution to verify `encrypted_content` does NOT match plaintext

**Rationale**:

- ✅ Direct verification - queries actual database state
- ✅ Fails if encryption is bypassed or broken
- ✅ Service role key allows bypassing RLS to read raw ciphertext
- ✅ Simple assertion: `encrypted_content !== plaintext_message`

**Alternatives Considered**:

- ❌ Trust encryption service unit tests - rejected (E2E test should verify end-to-end)
- ❌ Mock encryption - rejected (defeats purpose of E2E test)
- ❌ Check for base64 pattern - rejected (too weak, could be base64-encoded plaintext)

**Implementation Notes**:

```typescript
// After sending message in test
const sentMessage = 'Hello from User A';
await page.fill('[data-testid="message-input"]', sentMessage);
await page.click('[data-testid="send-button"]');

// Query database directly
const { data: messages } = await supabase
  .from('messages')
  .select('encrypted_content, content_iv')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: false })
  .limit(1);

// Verify encryption
expect(messages[0].encrypted_content).not.toBe(sentMessage);
expect(messages[0].encrypted_content).toBeTruthy(); // Has ciphertext
expect(messages[0].content_iv).toBeTruthy(); // Has IV
```

**Success Criteria Mapping**: This directly tests SC-007 ("Database inspection confirms zero plaintext messages are stored")

---

### 5. What performance baselines exist for success criteria?

**Question**: Are the performance targets in success criteria (SC-001, SC-004, SC-005) realistic?

**Research**:

- SC-001: E2E test completes full workflow in under 60 seconds
- SC-004: User search returns results within 2 seconds
- SC-005: Friend request acceptance updates status within 3 seconds
- Existing test execution times: friend-requests.spec.ts runs in ~15 seconds locally

**Decision**: Accept success criteria as written - they are achievable with current architecture

**Rationale**:

- ✅ Existing friend-requests test (partial workflow) completes in ~15 seconds
- ✅ Full workflow (sign-in → connect → message → sign-out) should complete in 45-60 seconds
- ✅ User search is simple DB query (indexed email column) - should be <2s
- ✅ Connection acceptance is single UPDATE query - should be <3s

**Alternatives Considered**:

- ❌ Increase timeouts - rejected (creates slow tests, hides performance issues)
- ❌ Remove performance criteria - rejected (violates spec requirements)

**Implementation Notes**:

```typescript
// Set Playwright timeout to match success criteria
test('Complete user workflow', async ({ browser }) => {
  test.setTimeout(60000); // 60 seconds for SC-001

  // Individual operations also have timeouts
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible({
    timeout: 2000,
  }); // SC-004

  await page.click('[data-testid="accept-request"]');
  await expect(page.locator('[data-testid="connection-status"]')).toHaveText(
    'Connected',
    { timeout: 3000 }
  ); // SC-005
});
```

---

## Summary of Research Outcomes

**No Blockers Identified** ✅

All technical questions resolved with existing patterns and infrastructure:

1. **Docker Execution**: Reuse existing Playwright setup (40+ tests proven)
2. **User Creation**: SQL seed script matching existing pattern
3. **Test Cleanup**: beforeEach hooks with service role key for idempotency
4. **Encryption Verification**: Direct database queries to verify ciphertext
5. **Performance**: Success criteria achievable with current architecture

**Key Files to Reference**:

- `/e2e/messaging/friend-requests.spec.ts` - Test pattern to follow
- `/supabase/seed-test-user.sql` - Seed script pattern to replicate
- `/src/services/messaging/encryption-service.ts` - Encryption implementation
- `playwright.config.ts` - Docker execution configuration

**Ready to Proceed**: Phase 1 (Design & Contracts) can begin immediately with no unknowns remaining.
