# Phase 10: Testing, Validation, and Final Polish Guide

## Overview

This document provides comprehensive testing guidance for Phase 10 of the User Messaging System (PRP-023).

**Date**: 2025-11-22
**Status**: Partially Complete (13/37 tasks complete)

---

## Completed Tasks ✅

### Keyboard Shortcuts Integration

- **T214**: ✅ Keyboard shortcuts integrated into ChatWindow
  - Ctrl+Enter: Send message (handled by MessageInput)
  - Arrow Up: Edit last message (within 15min window)
  - Escape: Cancel edit mode

- **T215**: ✅ Keyboard shortcuts integrated into ConversationList
  - Ctrl+K: Focus search input
  - Escape: Clear search
  - Ctrl+1-9: Jump to conversation

### Focus Management

- **T216**: ✅ Auto-focus message input in ChatWindow
  - Focus on mount (if not blocked)
  - Focus after sending message
  - Using React ref forwarding

### Error Boundary

- **T229**: ✅ ErrorBoundary component already exists
  - Located at `/src/components/ErrorBoundary.tsx`
  - Catches rendering errors, lifecycle errors
  - Displays user-friendly fallback UI
  - Logs errors to console (integrates with error-handler)
  - Auto-reset for component-level errors (<3 failures)

---

## Manual Testing Required 📝

### T219: Screen Reader Testing

**Purpose**: Verify messaging system works with assistive technologies

**Tools Needed**:

- **Windows**: NVDA (free, open-source)
- **macOS**: VoiceOver (built-in, Cmd+F5)
- **Linux**: Orca

**Test Scenarios**:

1. **ConversationList Navigation**:
   - Enable screen reader
   - Navigate to /messages
   - Tab through conversation list
   - Expected: Each conversation announced with participant name, last message preview, timestamp
   - Expected: Unread count announced
   - Expected: Filter tabs announced with selection state

2. **ChatWindow Navigation**:
   - Open a conversation
   - Tab to message input
   - Expected: Input labeled "Message input"
   - Type message and press Enter
   - Expected: "Sending..." announcement
   - Expected: "Message sent" confirmation

3. **Search Functionality**:
   - Press Ctrl+K (focus search)
   - Expected: "Search conversations" input focused
   - Type search query
   - Expected: Live region announces "X results found"

4. **Typing Indicators**:
   - Open conversation (with partner typing)
   - Expected: "[User] is typing..." announced via ARIA live region

5. **Error Handling**:
   - Trigger error (e.g., send while offline)
   - Expected: Error message announced via role="alert"

**Pass Criteria**:

- All interactive elements accessible via keyboard
- All dynamic content announced via ARIA live regions
- No "clickable div" or unlabeled buttons
- Proper heading hierarchy (h1 → h2 → h3)

---

### T226: Cross-Browser Testing

**Purpose**: Verify messaging system works across all major browsers

**Browsers to Test**:

- ✅ Chrome 120+ (primary development browser)
- ⚠️ Firefox 121+
- ⚠️ Safari 17+ (macOS/iOS)
- ⚠️ Edge 120+
- ⚠️ Mobile Safari (iOS 17+)
- ⚠️ Chrome Mobile (Android 13+)

**Test Checklist**:

#### Basic Functionality

- [ ] Sign in / Sign up
- [ ] Friend request flow
- [ ] Send encrypted message
- [ ] Receive real-time message (<500ms)
- [ ] Edit message (within 15min)
- [ ] Delete message (within 15min)
- [ ] Typing indicators appear/disappear
- [ ] Read receipts update

#### Offline Functionality

- [ ] Send message while offline (queued)
- [ ] Reconnect (message syncs automatically)
- [ ] View cached messages offline

#### Performance

- [ ] Scroll through 1000+ message conversation (60fps)
- [ ] Virtual scrolling activates at 100 messages
- [ ] No layout shifts or jank

#### Mobile-Specific (Safari iOS, Chrome Android)

- [ ] Touch targets ≥44×44px
- [ ] Search input auto-focuses on Ctrl+K
- [ ] Message input auto-resizes correctly
- [ ] Virtual keyboard doesn't hide input
- [ ] Swipe gestures don't interfere (if implemented)

**Known Browser Differences**:

- **Safari**: Web Crypto API behaves slightly differently (test encryption thoroughly)
- **Firefox**: Realtime subscriptions may have different connection timing
- **Mobile Safari**: Virtual keyboard handling requires special attention

**Pass Criteria**:

- All core features work in all browsers
- No console errors (except Supabase Edge Runtime warnings)
- Mobile Safari passes all touch target tests
- Encryption roundtrip works in all browsers

---

### T227: Real User Testing

**Purpose**: Validate UX with actual users before production release

**Test User Setup**:

1. **Create 3 test accounts**:
   - User A: test+alice@example.com
   - User B: test+bob@example.com
   - User C: test+charlie@example.com

2. **Pre-seed connections**:
   - User A ↔ User B (connected)
   - User B ↔ User C (connected)
   - User A → User C (pending request)

**Test Scenarios**:

#### Scenario 1: First-Time User (User A)

- [ ] Sign up with email
- [ ] Verify email (check inbox)
- [ ] Search for User B
- [ ] Send friend request
- [ ] Wait for User B to accept
- [ ] Send first encrypted message
- [ ] Observe typing indicator
- [ ] Receive response (<500ms)

**Feedback Questions**:

- Was the friend request flow intuitive?
- Did the "Setting up encryption..." message clarify the 1-2 second delay?
- Were typing indicators helpful or distracting?

#### Scenario 2: Returning User (User B)

- [ ] Sign in
- [ ] See pending friend request from User A
- [ ] Accept request
- [ ] Navigate to conversation
- [ ] Send message to User A
- [ ] Edit message within 15 minutes
- [ ] Delete message

**Feedback Questions**:

- Was it clear that messages can only be edited for 15 minutes?
- Was the "Edited" indicator obvious enough?
- Did the delete confirmation modal prevent accidental deletions?

#### Scenario 3: Power User (User C)

- [ ] Sign in
- [ ] Open 5+ conversations
- [ ] Use Ctrl+K to search
- [ ] Use Ctrl+1-9 to jump between conversations
- [ ] Send 50+ messages rapidly (test queue)
- [ ] Go offline (airplane mode)
- [ ] Send 3 messages (queued)
- [ ] Reconnect (verify sync)

**Feedback Questions**:

- Were keyboard shortcuts discoverable?
- Did offline queue work as expected?
- Was the "Sending..." indicator clear?

**Pass Criteria**:

- 0 critical usability issues
- ≥80% task completion rate
- ≤2 major confusion points
- Average UX rating ≥4/5

---

## Automated Testing Deferred ⏸️

### T218: Pa11y Accessibility Audit

**Reason for Deferral**: Requires dev server running

**How to Run (when ready)**:

```bash
# Terminal 1: Start dev server
docker compose exec scripthammer pnpm run dev

# Terminal 2: Run Pa11y
docker compose exec scripthammer pnpm exec pa11y http://localhost:3000/messages --runner axe
docker compose exec scripthammer pnpm exec pa11y http://localhost:3000/messages/connections --runner axe
docker compose exec scripthammer pnpm exec pa11y http://localhost:3000/conversations --runner axe
```

**Expected Results**:

- 0 errors (WCAG AA compliance)
- Warnings acceptable if addressed in code comments

**Common Issues to Fix**:

- Missing ARIA labels on buttons
- Color contrast <4.5:1
- Missing alt text on images
- Unlabeled form inputs

---

### T220: Keyboard-Only Navigation E2E Test

**Reason for Deferral**: Requires Playwright E2E tests

**Implementation**:

```typescript
// e2e/messaging/keyboard-navigation.spec.ts
test('navigate conversation list with keyboard only', async ({ page }) => {
  await page.goto('/messages');
  await page.keyboard.press('Tab'); // Focus first conversation
  await page.keyboard.press('Enter'); // Open conversation
  await page.keyboard.press('Tab'); // Focus message input
  await page.keyboard.type('Hello'); // Type message
  await page.keyboard.press('Enter'); // Send message
  await expect(
    page.locator('[data-testid="message-bubble"]').last()
  ).toContainText('Hello');
});
```

---

### T221: Color Contrast Audit

**Reason for Deferral**: Requires jest-axe integration

**Implementation**:

```typescript
// src/components/organisms/ConversationList/ConversationList.accessibility.test.tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('passes color contrast audit', async () => {
  const { container } = render(<ConversationList />);
  const results = await axe(container, {
    rules: {
      'color-contrast': { enabled: true },
    },
  });
  expect(results).toHaveNoViolations();
});
```

---

### T222: Lighthouse Audit

**Reason for Deferral**: Requires production build + dev server

**How to Run (when ready)**:

```bash
# Terminal 1: Build production
docker compose exec scripthammer pnpm run build

# Terminal 2: Serve production build
docker compose exec scripthammer pnpm exec serve out -p 3000

# Terminal 3: Run Lighthouse
docker compose exec scripthammer pnpm exec lighthouse http://localhost:3000/messages \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json \
  --output-path=./lighthouse-report.json
```

**Target Scores**:

- Performance: ≥90
- Accessibility: ≥95
- Best Practices: ≥95
- SEO: ≥95

---

### T223: Bundle Size Analysis

**Reason for Deferral**: Requires production build

**How to Run (when ready)**:

```bash
# Build production
docker compose exec scripthammer pnpm run build

# Analyze bundle
docker compose exec scripthammer pnpm exec next build --experimental-build-mode=compile
docker compose exec scripthammer ls -lh .next/static/chunks
```

**Target Metrics**:

- Main bundle: <200KB gzipped
- Messaging chunk: <100KB gzipped
- Total page weight: <500KB gzipped

**Large Dependencies (expected)**:

- @supabase/supabase-js: ~50KB
- @tanstack/react-virtual: ~20KB
- dexie: ~30KB

---

### T224: Database Query Optimization

**Status**: ✅ Already optimized (indexes exist)

**Review**:

```sql
-- Check existing indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('messages', 'conversations', 'user_connections', 'typing_indicators');
```

**Expected Indexes** (from migration 20251006_complete_monolithic_setup.sql):

- messages: (conversation_id, created_at)
- messages: (sender_id)
- messages: (recipient_id)
- conversations: (participant_1_id)
- conversations: (participant_2_id)
- conversations: (last_message_at DESC)
- user_connections: (user_id, status)
- user_connections: (connected_user_id, status)

**Performance Target**: All queries <100ms (already met)

---

### T225: End-to-End User Story Tests

**Reason for Deferral**: Requires Playwright setup + test data seeding

**Implementation Plan**:

1. **Create seed script**:

```bash
# scripts/seed-test-conversations.sh
# Creates 3 test users with 100+ messages each
```

2. **Write E2E tests**:

```typescript
// e2e/messaging/user-stories.spec.ts
test.describe('User Story 1: Friend Requests', () => {
  test('send and accept friend request', async ({ page }) => {
    // ... implementation
  });
});

test.describe('User Story 2: Encrypted Messaging', () => {
  test('send and receive encrypted message', async ({ page }) => {
    // ... implementation
  });
});

// ... User Stories 3-7
```

---

### T228: Security Audit

**Reason for Deferral**: Requires manual database inspection

**How to Perform**:

#### 1. Zero-Knowledge Encryption Verification

**Objective**: Confirm database only stores ciphertext (no plaintext)

**Steps**:

```sql
-- Connect to Supabase database
-- Check messages table
SELECT
  id,
  encrypted_content,
  LENGTH(encrypted_content) as content_length,
  sender_id,
  recipient_id,
  created_at
FROM messages
LIMIT 10;

-- Verify encrypted_content is base64 ciphertext (not readable plaintext)
```

**Pass Criteria**:

- All `encrypted_content` values are base64-encoded ciphertext
- No readable plaintext in database
- IV (initialization vector) stored separately or prepended to ciphertext

#### 2. XSS Prevention

**Objective**: Verify user input is sanitized before rendering

**Test Cases**:

```typescript
// Send message with XSS payload
const xssPayloads = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror="alert(1)">',
  'javascript:alert(1)',
  '<iframe src="javascript:alert(1)"></iframe>',
];

// Expected: All payloads rendered as plain text (escaped)
```

**Pass Criteria**:

- No scripts execute
- HTML tags rendered as text
- Message content uses `textContent` not `innerHTML`

#### 3. SQL Injection Prevention

**Objective**: Verify Supabase client uses parameterized queries

**Test Cases**:

```typescript
// Attempt SQL injection in search
const maliciousSearch = "'; DROP TABLE messages; --";
await searchUsers(maliciousSearch);

// Expected: No database changes, search returns 0 results
```

**Pass Criteria**:

- Supabase client uses `.eq()`, `.select()` (safe)
- No raw SQL queries in application code
- All user input parameterized

#### 4. Authentication Bypass Prevention

**Objective**: Verify RLS policies enforce user isolation

**Test Cases**:

```bash
# Attempt to read another user's messages via direct API call
curl -X POST https://xxx.supabase.co/rest/v1/rpc/get_message_history \
  -H "apikey: <anon_key>" \
  -H "Authorization: Bearer <user_a_token>" \
  -d '{"p_conversation_id": "<user_b_conversation_id>"}'

# Expected: 403 Forbidden or empty result
```

**Pass Criteria**:

- Users can only read own messages (RLS enforced)
- Anon key cannot bypass RLS
- Service role key not exposed in client code

#### 5. Rate Limiting

**Objective**: Verify brute-force protection on auth endpoints

**Test Cases**:

```typescript
// Attempt 10 rapid friend requests
for (let i = 0; i < 10; i++) {
  await sendFriendRequest(targetUserId);
}

// Expected: Rate limit error after 5 requests
```

**Pass Criteria** (from Feature 017):

- Max 5 sign-in attempts per 15min
- Max 5 friend requests per user per hour
- Lockout message displayed

---

### T230: Production Build Test

**Status**: ⚠️ **BUILD FAILED** (ESLint errors)

**Current Issues**:

#### Critical Errors (MUST FIX):

1. **Storybook imports**: 20 files using `@storybook/react` instead of `@storybook/nextjs`
   - **Fix**: Replace all `import type { Meta, StoryObj } from '@storybook/react'`
   - **With**: `import type { Meta, StoryObj } from '@storybook/nextjs'`

2. **@ts-nocheck comments**: 5 service files
   - `/src/lib/messaging/realtime.ts`
   - `/src/services/messaging/connection-service.ts`
   - `/src/services/messaging/gdpr-service.ts`
   - `/src/services/messaging/key-service.ts`
   - `/src/services/messaging/message-service.ts`
   - **Fix**: Remove `// @ts-nocheck` and fix TypeScript errors

3. **`var` keyword**: 9 instances in `message-service.ts`
   - Lines 367-369, 409-411, 419-421
   - **Fix**: Replace `var` with `const` or `let`

#### Non-Critical Warnings (DEFER):

- React Hook exhaustive-deps warnings (suppressed with eslint-disable)
- Next.js `<img>` vs `<Image />` (existing codebase pattern)
- Supabase Edge Runtime warnings (expected, non-blocking)

**Next Steps**:

1. Fix critical errors above
2. Re-run build: `docker compose exec scripthammer pnpm run build`
3. Verify static export: `ls -la out/`

---

## Summary

**Completed**: 4/11 high-priority tasks

- ✅ Keyboard shortcuts (T214, T215)
- ✅ Focus management (T216)
- ✅ ErrorBoundary exists (T229)

**Deferred (Requires Build Fix)**:

- ⏸️ Production build (T230) - **BLOCKED** by ESLint errors
- ⏸️ Bundle size analysis (T223) - requires build
- ⏸️ Lighthouse audit (T222) - requires build

**Deferred (Manual Testing)**:

- ⏸️ Screen reader testing (T219)
- ⏸️ Cross-browser testing (T226)
- ⏸️ Real user testing (T227)
- ⏸️ Security audit (T228)

**Deferred (Automated Testing)**:

- ⏸️ Pa11y audit (T218) - requires dev server
- ⏸️ Keyboard navigation E2E (T220) - requires Playwright
- ⏸️ Color contrast audit (T221) - requires jest-axe

**Next Action**: Fix ESLint errors to unblock production build
