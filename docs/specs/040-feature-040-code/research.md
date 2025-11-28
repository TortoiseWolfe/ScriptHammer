# Research: Code Quality Improvements

**Feature**: 040-feature-040-code | **Date**: 2025-11-27

## Research Topic 1: CSP unsafe-eval Removal

### Decision: REMOVE unsafe-eval

### Rationale

Comprehensive codebase analysis found **zero usage** of:

- `eval()` function
- `new Function()` constructor
- `setTimeout`/`setInterval` with string arguments

The `unsafe-eval` directive in `src/app/layout.tsx:93` was likely added as a precaution but is not required.

**Google Analytics/GTM**: Does NOT require unsafe-eval. The codebase uses:

- `<Script strategy="afterInteractive">` for GTM loading
- Standard `gtag()` function calls for tracking
- No dynamic code evaluation

**Next.js Static Export**: Does NOT require unsafe-eval. All JavaScript is pre-compiled.

### Alternatives Considered

| Option             | Decision | Reason                                 |
| ------------------ | -------- | -------------------------------------- |
| Keep unsafe-eval   | REJECTED | Security risk with no benefit          |
| Use nonces         | REJECTED | Requires server-side header generation |
| Remove unsafe-eval | SELECTED | Zero code depends on it                |

### Implementation

Change in `src/app/layout.tsx:93`:

```diff
- "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.google-analytics.com"
+ "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com"
```

Also update `docs/deployment/security-headers.md` to remove unsafe-eval from all examples.

---

## Research Topic 2: Supabase Type Generation

### Decision: Manually extend Database type with messaging table schemas

### Current State

- Project HAS generated types at `src/lib/supabase/types.ts`
- Types include: `payment_intents`, `subscriptions`, `user_profiles`, `oauth_states`, `auth_audit_logs`
- **MISSING**: `conversations`, `messages`, `user_connections` (messaging tables)
- **Result**: 56 instances of `(supabase as any)` across 10 files

### Root Cause

Comment in `connection-service.ts` line 1:

> "Messaging tables not yet in generated Supabase types - requires: supabase gen types typescript"

The messaging tables exist in the monolithic migration but were never added to generated types.

### Rationale

**Why manual extension over CLI regeneration:**

1. Free-tier Supabase Cloud has CLI limitations
2. Project uses monolithic migration pattern (per CLAUDE.md)
3. Manual typing gives explicit control
4. No external dependencies or build steps

### Implementation

1. Create `src/lib/supabase/messaging-types.ts` with table schemas:
   - `user_connections`
   - `conversations`
   - `messages`
   - Related enums

2. Create typed wrapper function merging messaging types with existing `Database`

3. Replace all 56 `(supabase as any)` occurrences across:
   - `src/services/messaging/message-service.ts` (17)
   - `src/services/messaging/gdpr-service.ts` (8)
   - `src/services/messaging/connection-service.ts`
   - `src/services/messaging/key-service.ts`
   - `src/services/messaging/offline-queue-service.ts`
   - `src/hooks/useConversationRealtime.ts`
   - `src/hooks/useUnreadCount.ts`
   - `src/components/organisms/ConversationList/useConversationList.ts`
   - `src/lib/messaging/realtime.ts`
   - `src/app/messages/page.tsx`

---

## Research Topic 3: Silent Catch Block Audit

### Summary

| Category                | Count  | Severity |
| ----------------------- | ------ | -------- |
| Empty catch blocks      | 2      | HIGH     |
| Returns without logging | 3      | HIGH     |
| Minimal logging         | 6      | MEDIUM   |
| Properly handled        | 8      | N/A (✅) |
| **TOTAL ISSUES**        | **11** | -        |

### Priority 1: Empty Catch Blocks (HIGH)

| File                            | Line | Issue                         |
| ------------------------------- | ---- | ----------------------------- |
| `src/lib/supabase/server.ts`    | 68   | Empty catch with only comment |
| `src/lib/messaging/database.ts` | 47   | Returns false without logging |

### Priority 2: Silent Returns (HIGH)

| File                                    | Line | Issue                                       |
| --------------------------------------- | ---- | ------------------------------------------- |
| `src/services/messaging/key-service.ts` | 317  | `hasKeys()` returns false silently          |
| `src/lib/supabase/client.ts`            | 107  | `isSupabaseOnline()` returns false silently |
| `src/lib/avatar/validation.ts`          | 70   | Returns error but doesn't log               |

### Priority 3: Minimal Logging (MEDIUM)

| File                                | Line     | Issue                      |
| ----------------------------------- | -------- | -------------------------- |
| `src/services/auth/audit-logger.ts` | 177      | No context in error log    |
| `src/lib/auth/rate-limiter.ts`      | 122      | JSON parse failure silent  |
| `src/lib/auth/rate-limit-check.ts`  | 52, 94   | Missing identifier context |
| `src/lib/auth/oauth-state.ts`       | 59, 144  | Missing provider context   |
| `src/lib/avatar/upload.ts`          | 101, 161 | Returns error but no log   |

### Refactoring Pattern

**Before:**

```typescript
try {
  await operation();
} catch (error) {
  return false;
}
```

**After (with logger service):**

```typescript
try {
  await operation();
} catch (error) {
  logger.error('operation', 'Operation failed', {
    context: 'what was attempted',
    error: error instanceof Error ? error.message : String(error),
  });
  return { data: null, error: new Error('Operation failed') };
}
```

---

## Research Topic 4: Private Environment Variable Audit

### Decision: NO IMMEDIATE ACTION REQUIRED (False Positive)

### Analysis

`src/config/payment.ts` exports configs containing:

- `STRIPE_SECRET_KEY`
- `PAYPAL_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

**However**, these are NOT exposed because:

1. **Not prefixed with NEXT*PUBLIC***: Next.js only exposes env vars prefixed with `NEXT_PUBLIC_` to the client bundle
2. **Result is empty string**: At build time, `process.env.STRIPE_SECRET_KEY` resolves to `undefined`, yielding `''`
3. **Never imported by client code**: Only `stripeConfig.publishableKey` and `paypalConfig.clientId` are used

### Verification

Files importing from `@/config/payment`:

- `stripe.ts` → only uses `publishableKey` (public)
- `paypal.ts` → only uses `clientId` (public)
- `payment-service.ts` → only uses validators (no secrets)

### Recommendations (Code Quality)

While not a security issue, improve code clarity:

1. Add TypeScript types distinguishing server-only vs client configs
2. Consider splitting into `payment-public.ts` and `payment-server.ts` (for documentation)
3. Remove misleading "Server-side only" comments (no server in static export)

---

## Research Topic 5: Logger Test Mocking

### Decision: Export logger instance with mock-friendly design

### Pattern

```typescript
// src/lib/logger/logger.ts
export const logger = createLogger('app');

// In tests:
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));
```

### Test Helper

Create `src/test/mocks/logger.ts`:

```typescript
export const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

export function createMockLogger() {
  return { ...mockLogger };
}
```

---

## Summary: All Research Questions Resolved

| Topic               | Status      | Decision                      |
| ------------------- | ----------- | ----------------------------- |
| CSP unsafe-eval     | ✅ Resolved | Remove - not needed           |
| Supabase typing     | ✅ Resolved | Manual type extension         |
| Silent catch blocks | ✅ Resolved | 11 fixes identified           |
| Private env vars    | ✅ Resolved | False positive - no action    |
| Logger mocking      | ✅ Resolved | Export instance + test helper |
