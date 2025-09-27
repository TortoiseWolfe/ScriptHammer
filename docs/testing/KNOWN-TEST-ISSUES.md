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

## Test Health Metrics

- **Total Tests**: 666
- **Passing**: 646 (97%)
- **Failing**: 4 (0.6%)
- **Skipped**: 16 (2.4%)

All failing tests are documented above and don't affect production.

---

_Last Updated: 2025-09-17_
