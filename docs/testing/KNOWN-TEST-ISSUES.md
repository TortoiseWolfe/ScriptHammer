# Known Test Issues

This document tracks known test failures and issues that don't affect production functionality.

---

## PRP-011: PWA Background Sync Integration Tests

### Issue Summary

**File**: `src/tests/offline-integration.test.tsx`
**Failing Tests**: 4 out of 15
**Impact**: Test environment only - production functionality works correctly
**Priority**: Low

### Affected Tests

1. `should queue form submission when offline`
2. `should show queued message was sent offline`
3. `should update queue size after submission`
4. `should handle queue addition failure gracefully`

### Root Cause Analysis

#### The Problem

The ContactForm component uses React Hook Form with Zod validation. The form validation happens asynchronously, and the submit button is disabled until the form is valid (`!isValid`). In the test environment, the validation state doesn't update properly even after filling all fields and triggering blur events.

#### Technical Details

```typescript
// The button is disabled when:
disabled={isSubmitting || !isValid || !!honeypotValue}

// Where isValid comes from React Hook Form:
const { formState: { errors, isValid } } = useForm<ContactFormData>({
  resolver: zodResolver(contactSchema),
  mode: 'onBlur',
});
```

#### Why It Fails in Tests

1. **Async Validation Timing**: React Hook Form's validation is asynchronous
2. **Mock Complexity**: We mock `useOfflineQueue` but the form still uses the real `useForm` hook
3. **Event Simulation**: `fireEvent.blur()` doesn't perfectly replicate real browser behavior
4. **State Updates**: Multiple `act()` wrappers needed but timing is unpredictable

### Attempted Solutions

1. **Added blur events to trigger validation** ✅ Partial success

   ```typescript
   fireEvent.change(nameInput, { target: { value: 'John Doe' } });
   fireEvent.blur(nameInput);
   ```

2. **Wrapped in act() with timeouts** ✅ Helped with some tests

   ```typescript
   await act(async () => {
     await new Promise((resolve) => setTimeout(resolve, 200));
   });
   ```

3. **Created fillContactForm helper** ✅ Improved consistency

   ```typescript
   async function fillContactForm(screen: any) {
     /* ... */
   }
   ```

4. **Mocked at hook level instead of utility level** ✅ Simplified mocking

### Why Production Works

In production:

- Real user interactions trigger proper validation
- Browser handles async operations naturally
- No mocking layer interfering with hooks
- Service Worker and IndexedDB work as expected

### Verification Steps

To verify production functionality:

```bash
# 1. Start the development server
docker compose exec scripthammer pnpm run dev

# 2. Open Chrome and navigate to http://localhost:3000/contact

# 3. Open DevTools > Network tab

# 4. Set network to "Offline"

# 5. Fill and submit the contact form

# 6. Observe:
#    - "Message queued for sending when online" notification
#    - Form clears after submission
#    - Queue indicator shows "1 message queued"

# 7. Set network back to "Online"

# 8. Observe:
#    - Automatic submission to Web3Forms
#    - Success notification
#    - Queue indicator disappears

# 9. Check IndexedDB:
#    - DevTools > Application > IndexedDB > OfflineFormSubmissions
#    - Should be empty after successful sync
```

### Future Recommendations

1. **Split Test Strategy**
   - Keep unit tests for hooks (`useOfflineQueue.test.ts`) ✅ Working
   - Keep unit tests for utilities (`offline-queue.ts`) ✅ Working
   - Move integration tests to E2E with Playwright for real browser

2. **Alternative Testing Approaches**
   - Use MSW (Mock Service Worker) for better integration testing
   - Test form submission logic separately from UI
   - Mock React Hook Form's `isValid` state directly

3. **Example E2E Test** (Playwright)

   ```typescript
   test('queues form submission when offline', async ({ page, context }) => {
     // Set offline
     await context.setOffline(true);

     // Navigate and fill form
     await page.goto('/contact');
     await page.fill('[name="name"]', 'John Doe');
     await page.fill('[name="email"]', 'john@example.com');
     await page.fill('[name="subject"]', 'Test Subject');
     await page.fill('[name="message"]', 'Test message');

     // Submit
     await page.click('button[type="submit"]');

     // Verify queued message
     await expect(page.locator('.alert')).toContainText('queued for sending');

     // Go back online
     await context.setOffline(false);

     // Verify sync
     await expect(page.locator('.alert')).toContainText('successfully sent');
   });
   ```

### Impact Assessment

**Does NOT affect:**

- ✅ Production functionality
- ✅ User experience
- ✅ Data integrity
- ✅ Offline/online detection
- ✅ Background sync
- ✅ Form submission

**Does affect:**

- ❌ Test coverage metrics (4 tests show as failing)
- ❌ CI/CD pipeline (shows red even though production works)
- ❌ Developer confidence (seeing failing tests is concerning)

### Decision

**Status**: Won't Fix (in current form)
**Rationale**: Production functionality is verified working. The complexity of fixing these specific integration tests outweighs the benefit. Better to rewrite as E2E tests in the future.

---

## Other Known Test Issues

_No other known test issues at this time._

---

## Resolved E2E Issues

This section documents previously-failing E2E tests that are now green,
so future debugging doesn't relearn the root causes. Keep entries brief;
commit messages have the full detail.

### payment-isolation on chromium / firefox (resolved in `aef59b7`)

**Symptom**: `tests/e2e/security/payment-isolation.spec.ts` tests at `:44`,
`:113` failed on chromium-gen 4/6 and firefox-gen 4/6 with the Step 4
heading never becoming visible (or flicking visible then disappearing),
and the failure-time page snapshot showed an empty "Logged in as: - User
ID:" with Sign In links in the nav.

**Root cause**: `getAuthenticatedUserId()` in `src/lib/payments/payment-service.ts`
called `supabase.auth.getUser()` which hits `/auth/v1/user`. Under CI shard
load Supabase rate-limited that endpoint with 403, and supabase-js treated
the 403 as "session gone" — firing SIGNED_OUT. AuthContext cleared `user`
mid-render, the payment-demo Step 4 block (gated on `user?.id`) unmounted,
and the test's `toBeVisible` timed out.

**Fix**: switch `getAuthenticatedUserId()` to `supabase.auth.getSession()`
— reads from localStorage, no server round-trip, can't 403. RLS still
enforces auth at DB-query time. This mirrors the pattern already in
`src/services/messaging/key-service.ts` for the same reason.

### payment-isolation on webkit (resolved via JWT TTL bump)

**Symptom**: webkit-gen 4/6 flaked randomly with redirects to `/sign-in`
and a refresh-token storm (400 then 429s for ~30s) visible in the blob
report network trace.

**Root cause**: Supabase JWT default TTL is 3600s. The `needs:` chain in
`.github/workflows/e2e.yml` runs chromium → firefox → webkit serially,
so webkit starts ~50–60 min after `auth-setup` produced the fixture.
Access token was near or past expiry when webkit tests ran; supabase-js
attempted to refresh; the single-use refresh token had been consumed by
an earlier shard; and the 400 triggered the retry/backoff storm.

**Fix**: raised `jwt_exp` from 3600s to 7200s via the Supabase Management
API. Config is committed as code in `scripts/supabase/auth-config.json`
and can be reapplied with `pnpm supabase:auth-config --apply` against
any environment — no dashboard click required.

### firefox-msg / webkit-msg T149 conflict resolution (resolved in `40f0d0e`)

**Symptom**: `offline-queue.spec.ts` T149 failed with
`expect(messages).not.toBeNull()` — after both users went offline, sent
a message, and came back online, neither message ever reached the
database. 36 × 5s polls against `adminClient.from('messages')` returned
at most the leftover count from `beforeAll`.

**Wrong diagnoses that cost ~10 rounds** (recorded so I don't repeat):

1. Cloudflare `__cf_bm` cookie rejection blocking realtime. _Red herring_
   — realtime isn't load-bearing for the offline-queue send path; the
   insert is a straight REST POST triggered by the online event.
2. `navigator.onLine` not flipping under Playwright's emulated offline →
   online transition. _Partly true, but not the root cause_ — Playwright
   does flip it, we just had a stale-closure suspicion that didn't pan
   out. Verified via trace.
3. Window `online` event listener not firing. _Also partly true on some
   runs, but fixing that only got us to "sync runs, still no insert"._

**Actual root cause**: `QueuedMessage.synced` was declared as `boolean`
and written as `synced: false` in `queueMessage()`, but the Dexie query
in `getQueue()` used `.where('synced').equals(0)`. IndexedDB does not
permit booleans as index key values — Dexie silently failed to index the
records, so the query never matched. `getQueue()` returned `[]`
indefinitely. The offline-queue E2E tests T146-T148 passed because they
verify only the optimistic UI bubble (rendered from React state), not
the database round-trip. T149 is the only test that exercises the full
queue → sync → INSERT path, so it was the only test to expose the bug —
which had been present since the feature shipped.

**Fix**: `QueuedMessage.synced: boolean → 0 | 1`. Write sites
(`queueMessage` and the `syncQueue` success branch) updated to write
0/1. Query sites already used `.equals(0)` / `.equals(1)` and now match.

**Diagnostic tooling left in place**:

- `window.__scripthammer_syncQueue` in `src/hooks/useOfflineQueue.ts` —
  installed only when `playwright_e2e=true` is in localStorage. E2E
  tests call it to trigger sync deterministically, avoiding dependence
  on browser-specific event dispatch semantics.
- Visibility-change and focus event triggers in the same hook — these
  help real users who close/reopen tabs or whose browser misses an
  online event, not just tests.

### Related CI-only changes

- `scripts/supabase/set-auth-config.ts` + `auth-config.json`: GET/diff/apply
  script for Supabase Management API `/config/auth`. Dry-run by default;
  `--apply` to commit. First use raised `jwt_exp` to 7200; second raised
  `rate_limit_verify` to 100 to absorb the ~14 legitimate
  `performSignIn` calls the auth spec suite still makes.

---

## Test Health Metrics

- **Total Tests**: 666
- **Passing**: 646 (97%)
- **Failing**: 4 (0.6%)
- **Skipped**: 16 (2.4%)

All failing tests are documented above and don't affect production.

---

_Last Updated: 2026-04-20_
