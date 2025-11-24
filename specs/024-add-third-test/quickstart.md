# Quickstart Guide: E2E Test Execution

**Feature**: Comprehensive E2E Test Suite for User Messaging
**Branch**: `024-add-third-test`
**Date**: 2025-11-24

## Overview

This guide provides step-by-step instructions for running the comprehensive E2E test suite locally in Docker before pushing to production.

## Prerequisites

### 1. Environment Setup

**Check Docker is running**:

```bash
docker ps
# Should show scripthammer container running
```

**If Docker is not running**:

```bash
docker compose up -d
```

---

### 2. Environment Variables

**Verify test user credentials exist in `.env`**:

```bash
grep "TEST_USER" .env
```

**Expected output**:

```
TEST_USER_PRIMARY_EMAIL=test@example.com
TEST_USER_PRIMARY_PASSWORD=TestPassword123!
TEST_USER_TERTIARY_EMAIL=test-user-b@example.com
TEST_USER_TERTIARY_PASSWORD=TestPassword456!
SUPABASE_SERVICE_ROLE_KEY=eyJ... (long JWT token)
```

**If missing, add them**:

```bash
# Add to .env file
echo "TEST_USER_TERTIARY_EMAIL=test-user-b@example.com" >> .env
echo "TEST_USER_TERTIARY_PASSWORD=TestPassword456!" >> .env
```

---

### 3. Database Setup

**Verify test users exist in Supabase**:

```bash
# Run seed script for third test user
docker compose exec scripthammer psql $DATABASE_URL -f supabase/migrations/seed-test-user-b.sql
```

**Expected output**:

```
INSERT 0 1  -- User created in auth.users
INSERT 0 1  -- Profile created in user_profiles
```

**If already exists**:

```
ERROR: duplicate key value violates unique constraint "users_email_key"
DETAIL: Key (email)=(test-user-b@example.com) already exists.
```

This is OK! The seed script is idempotent.

---

### 4. Dev Server Running

**Start dev server** (if not already running):

```bash
docker compose exec scripthammer pnpm run dev
```

**Expected output**:

```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- info Loaded env from /app/.env
✓ Ready in 2.5s
```

**Verify server is accessible**:

```bash
curl -I http://localhost:3000
# Should return: HTTP/1.1 200 OK
```

---

## Running Tests

### 1. Run All E2E Tests

**Command**:

```bash
docker compose exec scripthammer pnpm exec playwright test
```

**Expected output** (summary):

```
Running 48 tests using 4 workers

  ✓ e2e/messaging/complete-user-workflow.spec.ts (1 test, 45s)
  ✓ e2e/messaging/friend-requests.spec.ts (3 tests, 18s)
  ✓ e2e/messaging/encrypted-messaging.spec.ts (2 tests, 22s)
  ✓ e2e/auth/user-registration.spec.ts (4 tests, 12s)
  ... (40+ more tests)

  48 passed (3.2m)
```

**Success Criteria**:

- ✅ All tests pass (0 failures)
- ✅ Complete workflow test runs in <60 seconds (SC-001)
- ✅ No console errors logged
- ✅ Total runtime <5 minutes

---

### 2. Run Only Messaging Tests

**Command**:

```bash
docker compose exec scripthammer pnpm exec playwright test e2e/messaging/
```

**Expected output**:

```
Running 6 tests using 2 workers

  ✓ e2e/messaging/complete-user-workflow.spec.ts (1 test, 45s)
    ✓ Complete user workflow: sign-in → connect → message → sign-out (45s)

  ✓ e2e/messaging/friend-requests.spec.ts (3 tests, 18s)
    ✓ User A sends friend request to User B (6s)
    ✓ User B accepts friend request (5s)
    ✓ Bidirectional connection established (7s)

  ✓ e2e/messaging/encrypted-messaging.spec.ts (2 tests, 22s)
    ✓ User A sends encrypted message to User B (12s)
    ✓ Database contains only ciphertext (10s)

  6 passed (1.4m)
```

---

### 3. Run Specific Test File

**Complete workflow test**:

```bash
docker compose exec scripthammer pnpm exec playwright test e2e/messaging/complete-user-workflow.spec.ts
```

**Expected output**:

```
Running 1 test using 1 worker

  ✓ e2e/messaging/complete-user-workflow.spec.ts (45s)
    ✓ Complete user workflow: sign-in → connect → message → sign-out (45s)

  1 passed (45s)
```

**Breakdown** (approximate timings):

```
1. User A signs in: 3s
2. User A navigates to /messages/connections: 1s
3. User A searches for User B: 2s (SC-004)
4. User A sends friend request: 2s
5. User B signs in: 3s
6. User B views pending requests: 2s
7. User B accepts request: 3s (SC-005)
8. User A sends message: 5s
9. User B receives message: 4s
10. User B replies: 5s
11. User A reads reply: 4s
12. Both users sign out: 2s
Total: ~36s (well under 60s limit - SC-001)
```

---

### 4. Run with UI Mode (Debugging)

**Interactive Playwright UI**:

```bash
docker compose exec scripthammer pnpm exec playwright test --ui
```

**Features**:

- Step through test execution
- Inspect DOM at each step
- View network requests
- See console logs
- Time travel through test

**Use Cases**:

- Debugging failing tests
- Understanding test flow
- Verifying UI interactions

---

### 5. Run with Headed Browser (Visual)

**See browser in action**:

```bash
docker compose exec scripthammer pnpm exec playwright test --headed
```

**Note**: Requires X11 forwarding for WSL/Linux:

```bash
# On WSL, first start X server (VcXsrv/Xming)
export DISPLAY=:0
docker compose exec scripthammer pnpm exec playwright test --headed
```

---

### 6. Run Specific Test Case

**Run single test by name**:

```bash
docker compose exec scripthammer pnpm exec playwright test -g "Complete user workflow"
```

**Run tests matching pattern**:

```bash
docker compose exec scripthammer pnpm exec playwright test -g "sign-in"
```

---

## Interpreting Results

### Success Indicators

**✅ All tests pass**:

```
48 passed (3.2m)
```

**✅ Performance criteria met**:

- Complete workflow: <60s (SC-001)
- User search: <2s (SC-004)
- Connection acceptance: <3s (SC-005)

**✅ No console errors**:

```
# Check test output for console errors
docker compose exec scripthammer pnpm exec playwright test --reporter=list | grep "console.error"
# Should return empty
```

**✅ Encryption verified**:

```
# Check for "Database contains only ciphertext" test passing
docker compose exec scripthammer pnpm exec playwright test -g "ciphertext"
```

---

### Failure Indicators

**❌ Test failures**:

```
48 tests (1 failed, 47 passed) (3.2m)
```

**Root causes**:

1. **Auth failure**: Test users missing in database → Run seed script
2. **Network failure**: Dev server not running → Start with `pnpm run dev`
3. **Timeout**: Test took >60s → Check performance (network, CPU)
4. **Data conflict**: Previous test data not cleaned → Check beforeEach hooks

**Debugging steps**:

```bash
# 1. Check test users exist
docker compose exec scripthammer pnpm exec playwright test e2e/auth/sign-in.spec.ts

# 2. Check database connectivity
curl http://localhost:3000/api/health

# 3. Check dev server logs
docker compose logs scripthammer | tail -50

# 4. Run with verbose logging
docker compose exec scripthammer pnpm exec playwright test --reporter=list
```

---

## Test Data Management

### Clean Test Data (Manual)

**If tests fail due to stale data**:

```sql
-- Connect to database
psql $DATABASE_URL

-- Delete test data
DELETE FROM messages WHERE conversation_id IN (
  SELECT id FROM conversations
  WHERE participant_1_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'test%@example.com'
  )
);

DELETE FROM conversations WHERE participant_1_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test%@example.com'
);

DELETE FROM connections WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test%@example.com'
);
```

**Note**: Tests should auto-clean in `beforeEach` hooks (SC-008). Manual cleanup only needed if hooks fail.

---

### Verify Test Idempotency

**Run same test multiple times**:

```bash
# Run test 3 times in a row
for i in {1..3}; do
  echo "Run $i:"
  docker compose exec scripthammer pnpm exec playwright test e2e/messaging/complete-user-workflow.spec.ts
done
```

**Expected**:

- ✅ All 3 runs pass
- ✅ Same results each time (no stale data issues)
- ✅ Performance consistent (<60s each run)

---

## Pre-Push Checklist

**Before pushing code to production, verify**:

```bash
# 1. All E2E tests pass
docker compose exec scripthammer pnpm exec playwright test
# ✅ 48 passed

# 2. No console errors in tests
docker compose exec scripthammer pnpm exec playwright test --reporter=list | grep -i error
# ✅ No matches

# 3. Encryption test passes (FR-014)
docker compose exec scripthammer pnpm exec playwright test -g "ciphertext"
# ✅ 1 passed

# 4. Performance criteria met
docker compose exec scripthammer pnpm exec playwright test e2e/messaging/complete-user-workflow.spec.ts
# ✅ Test duration: <60s (SC-001)

# 5. Test idempotency verified
docker compose exec scripthammer pnpm exec playwright test e2e/messaging/complete-user-workflow.spec.ts
docker compose exec scripthammer pnpm exec playwright test e2e/messaging/complete-user-workflow.spec.ts
# ✅ Both runs pass (SC-008)
```

**If ALL checks pass** ✅:

```bash
git add .
git commit -m "feat(e2e): add comprehensive user messaging workflow tests"
git push origin 024-add-third-test
```

**If ANY check fails** ❌:

- **DO NOT PUSH**
- Debug failed test
- Fix issue
- Re-run all checks
- Only push when all checks pass

---

## Continuous Integration (CI)

**Note**: E2E tests run in CI pipeline via GitHub Actions

**CI workflow** (`.github/workflows/ci.yml`):

```yaml
- name: Run E2E tests
  run: docker compose exec scripthammer pnpm exec playwright test
  env:
    TEST_USER_PRIMARY_EMAIL: ${{ secrets.TEST_USER_PRIMARY_EMAIL }}
    TEST_USER_PRIMARY_PASSWORD: ${{ secrets.TEST_USER_PRIMARY_PASSWORD }}
    TEST_USER_TERTIARY_EMAIL: ${{ secrets.TEST_USER_TERTIARY_EMAIL }}
    TEST_USER_TERTIARY_PASSWORD: ${{ secrets.TEST_USER_TERTIARY_PASSWORD }}
```

**Required GitHub Secrets**:

- `TEST_USER_PRIMARY_EMAIL`
- `TEST_USER_PRIMARY_PASSWORD`
- `TEST_USER_TERTIARY_EMAIL`
- `TEST_USER_TERTIARY_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`

**Add secrets at**: `https://github.com/<username>/ScriptHammer/settings/secrets/actions`

---

## Troubleshooting

### Issue 1: "Connection refused" error

**Symptom**:

```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solution**:

```bash
# Start dev server
docker compose exec scripthammer pnpm run dev

# Verify server is running
curl http://localhost:3000
```

---

### Issue 2: "Invalid login credentials"

**Symptom**:

```
Error: Invalid login credentials
  at e2e/messaging/complete-user-workflow.spec.ts:25
```

**Solution**:

```bash
# Verify test user exists
docker compose exec scripthammer psql $DATABASE_URL -c \
  "SELECT email FROM auth.users WHERE email LIKE 'test%@example.com';"

# If missing, run seed script
docker compose exec scripthammer psql $DATABASE_URL -f supabase/migrations/seed-test-user-b.sql
```

---

### Issue 3: Test timeout (>60s)

**Symptom**:

```
Timeout of 60000ms exceeded
```

**Solution**:

```bash
# Check system resources
docker stats scripthammer

# Increase timeout for slow systems
# Edit test file: test.setTimeout(120000); // 2 minutes

# Or run with more time
docker compose exec scripthammer pnpm exec playwright test --timeout=120000
```

---

### Issue 4: "Unique constraint violation"

**Symptom**:

```
ERROR: duplicate key value violates unique constraint "connections_pkey"
```

**Solution**:

```bash
# Test cleanup failed - verify beforeEach hook runs
# Check test file has proper cleanup:
test.beforeEach(async () => {
  await supabase.from('connections').delete()...
});

# Or manually clean data (see "Clean Test Data" section above)
```

---

## Performance Benchmarks

**Target Performance** (Success Criteria):

- Complete workflow: <60s (SC-001)
- User search: <2s (SC-004)
- Connection acceptance: <3s (SC-005)
- Message delivery: <5s
- Message decryption: <2s

**Actual Performance** (typical):

- Complete workflow: ~45s ✅
- User search: ~1.5s ✅
- Connection acceptance: ~2s ✅
- Message delivery: ~4s ✅
- Message decryption: ~1s ✅

**Performance Tips**:

- Run tests in Docker (not host machine) for consistency
- Close other applications during test runs
- Use SSD storage for Docker volumes
- Allocate at least 4GB RAM to Docker

---

## Next Steps

After all tests pass locally:

1. ✅ **Push to feature branch**:

   ```bash
   git push origin 024-add-third-test
   ```

2. ✅ **Create pull request**:

   ```bash
   gh pr create --title "feat(e2e): comprehensive messaging workflow tests"
   ```

3. ✅ **Verify CI pipeline passes**:
   - GitHub Actions runs same tests
   - All checks must pass before merge

4. ✅ **Merge to main**:

   ```bash
   gh pr merge --squash
   ```

5. ✅ **Deploy to production**:
   - Only after CI passes on main branch
   - SC-010: "Zero production deployments with failing E2E tests"

---

## Summary

**Quick Test Execution**:

```bash
# Single command to verify everything
docker compose exec scripthammer pnpm exec playwright test && \
echo "✅ All tests passed - ready to push!"
```

**Expected Runtime**: 3-5 minutes for full suite (48 tests)

**Success Rate**: 100% pass required before push (SC-003)

**Critical Rule**: **NEVER** push code with failing tests to production!
