# Phase 0: Research - Security Hardening

## Overview

This document analyzes the existing authentication and payment systems in ScriptHammer to identify security vulnerabilities and plan remediation strategies. The research covers PRP-015 (Payment Integration) and PRP-016 (User Authentication) implementations.

## Current System Analysis

### Authentication System (PRP-016)

**Location**: `/src/components/auth/`, `/src/lib/auth/`, `/src/contexts/AuthContext.tsx`

**Components**:

- SignInForm, SignUpForm - Email/password authentication
- OAuthButtons - GitHub and Google OAuth
- AuthGuard, ProtectedRoute - Route protection
- ForgotPasswordForm, ResetPasswordForm - Password recovery

**Current Implementation**:

```typescript
// OAuth Flow (OAuthButtons.tsx:20-27)
const handleOAuth = async (provider: 'github' | 'google') => {
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
};
```

**Security Issues Identified**:

1. ❌ No state parameter for CSRF protection (REQ-SEC-002)
2. ❌ No OAuth session validation on callback

### Rate Limiting System

**Location**: `/src/lib/auth/rate-limiter.ts`

**Current Implementation** (Client-Side Only):

```typescript
// Lines 21-24
constructor(identifier: string, maxAttempts: number, windowMinutes: number) {
  this.key = `rate_limit_${identifier}`;
  this.maxAttempts = maxAttempts;
  this.windowMs = windowMinutes * 60 * 1000;
}

// Lines 110-125
private getData(): RateLimitData {
  if (typeof window === 'undefined') {
    return { attempts: [], windowStart: Date.now() };
  }
  const stored = localStorage.getItem(this.key);
  // ... localStorage-based tracking
}
```

**Security Issues Identified**:

1. ❌ Entirely client-side using localStorage (REQ-SEC-003)
2. ❌ Trivially bypassable (clear storage, incognito, different browser)
3. ❌ Initialized with empty email on component mount (REQ-SEC-008)

### Payment System (PRP-015)

**Location**: `/src/lib/payments/payment-service.ts`, `/src/components/payment/`

**Database Schema** (`supabase/migrations/complete_setup.sql:26-38`):

```sql
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id), -- Has FK but...
  amount INTEGER NOT NULL CHECK (amount >= 100 AND amount <= 99999),
  currency TEXT NOT NULL DEFAULT 'usd',
  type TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  customer_email TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
```

**Current Implementation** (`payment-service.ts:82-95`):

```typescript
const { data, error } = await supabase
  .from('payment_intents')
  .insert({
    amount: intentData.amount,
    currency: intentData.currency,
    type: intentData.type,
    customer_email: intentData.customer_email,
    metadata: (intentData.metadata || {}) as Json,
    template_user_id: '00000000-0000-0000-0000-000000000000', // ❌ HARDCODED!
  })
  .select()
  .single();
```

**Security Issues Identified**:

1. ❌ **CRITICAL**: All payments use placeholder UUID (REQ-SEC-001)
2. ❌ No RLS policies to enforce user isolation
3. ⚠️ Weak metadata validation (lines 46-58) - needs prototype pollution check (REQ-SEC-005)
4. ⚠️ Email regex too permissive (line 41) - no TLD validation (REQ-SEC-006)

### Audit Logging

**Database Schema** (`complete_setup.sql:189-200`):

```sql
CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Security Issues Identified**:

1. ❌ Table exists but NO code populates it (REQ-SEC-007)
2. ❌ No audit logging for sign-in, sign-out, password changes

## Existing Validation

### Email Validation (Weak)

**Location**: `payment-service.ts:40-43`

```typescript
const sanitizedEmail = customerEmail.trim().toLowerCase();
if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
  throw new Error('Invalid email address');
}
```

**Issues**:

- ❌ Allows emails without valid TLD (e.g., `user@localhost`)
- ❌ No disposable email detection
- ✅ Good: Normalization to lowercase

### Metadata Validation (Incomplete)

**Location**: `payment-service.ts:46-58`

```typescript
if (options?.metadata) {
  const metadataStr = JSON.stringify(options.metadata);
  if (metadataStr.length > 1024) {
    throw new Error('Metadata exceeds 1KB limit');
  }
  const checkNesting = (obj: unknown, depth = 0): void => {
    if (depth > 2) throw new Error('Metadata nesting exceeds 2 levels');
    if (obj && typeof obj === 'object') {
      Object.values(obj).forEach((v) => checkNesting(v, depth + 1));
    }
  };
  checkNesting(options.metadata);
}
```

**Issues**:

- ❌ No check for dangerous keys: `__proto__`, `constructor`, `prototype`
- ❌ No circular reference detection
- ✅ Good: Size limit (1KB)
- ✅ Good: Nesting depth limit (2 levels)

## Security Architecture Gaps

### Missing Components

1. **Server-Side Rate Limiting**
   - Need: Supabase Edge Function or Database Function
   - Track: IP address + email combination
   - Store: New table `rate_limit_attempts`

2. **OAuth State Management**
   - Need: Session state tokens
   - Store: New table `oauth_states`
   - Validate: On `/auth/callback`

3. **CSRF Token System**
   - Need: Token generation + validation
   - Store: Secure HTTP-only cookies (if possible) or session storage
   - Validate: On all state-changing operations

4. **Audit Logging Service**
   - Need: Logging utility function
   - Call from: All auth operations
   - Data: user_id, event_type, ip_address, user_agent, timestamp

5. **RLS Policies**
   - Need: Row-Level Security on `payment_intents`, `payment_results`
   - Enforce: `template_user_id = auth.uid()`

### WCAG Compliance Requirements

From REQ-A11Y-001:

- Error messages need `role="alert"` and `aria-live="assertive"`
- Currently missing in form error displays

## Technical Constraints

### Static Export Limitation

ScriptHammer uses Next.js static export (`output: 'export'` in `next.config.ts`), which means:

- ❌ No API routes (server-side code)
- ✅ Can use Supabase Edge Functions
- ✅ Can use Supabase Database Functions
- ✅ Can use Supabase RLS policies

**Implication**: Server-side rate limiting must be implemented as:

1. Supabase Database Function (PL/pgSQL)
2. Called from client before authentication attempt
3. Enforced via database constraints

### Supabase Auth Architecture

**Current Flow**:

```
Client → Supabase Auth API → Database (auth.users)
       ↓
    AuthContext (React)
       ↓
    Protected Routes
```

**Required Changes**:

```
Client → Rate Limit Check (DB Function)
       ↓ (if allowed)
     Supabase Auth API
       ↓
     Audit Log (Trigger)
       ↓
     AuthContext
```

## Modification Points

### High Priority (P0 - Critical)

1. **Payment User Association** (REQ-SEC-001)
   - File: `/src/lib/payments/payment-service.ts:92`
   - Change: Replace hardcoded UUID with `auth.uid()`
   - Add: RLS policies on `payment_intents` and `payment_results`

2. **OAuth State Validation** (REQ-SEC-002)
   - Files:
     - `/src/components/auth/OAuthButtons/OAuthButtons.tsx:20-27`
     - `/src/app/auth/callback/page.tsx` (needs creation/update)
   - Add: State parameter generation and validation
   - New table: `oauth_states`

3. **Server-Side Rate Limiting** (REQ-SEC-003)
   - New file: `/supabase/functions/rate-limit-check/index.ts` OR
   - New migration: Database function `check_rate_limit(email TEXT, ip_address TEXT)`
   - Update: SignInForm, SignUpForm to call before auth attempt

4. **CSRF Protection** (REQ-SEC-004)
   - New file: `/src/lib/auth/csrf.ts`
   - Update: All forms (SignInForm, SignUpForm, AccountSettings, payment forms)
   - Middleware: Validate CSRF tokens

### Medium Priority (P1 - High)

5. **Metadata Validation** (REQ-SEC-005)
   - File: `/src/lib/payments/payment-service.ts:46-58`
   - Add: Dangerous key detection
   - Add: Circular reference check

6. **Email Validation** (REQ-SEC-006)
   - New file: `/src/lib/auth/email-validator.ts`
   - Features: TLD validation, disposable email warning
   - Update: All email input points

7. **Audit Logging** (REQ-SEC-007)
   - New file: `/src/lib/auth/audit-logger.ts`
   - Hook: Database trigger or explicit calls
   - Update: All auth operations

8. **Rate Limiter Initialization** (REQ-SEC-008)
   - File: `/src/lib/auth/rate-limiter.ts` (deprecate in favor of server-side)
   - Note: May become obsolete if server-side rate limiting implemented

## Technology Decisions

### Rate Limiting Approach

**Option A: Supabase Edge Function** (Recommended)

- Pros: TypeScript, familiar environment, easy testing
- Cons: Cold start latency, Deno runtime differences
- Implementation: `/supabase/functions/rate-limit-check/`

**Option B: Database Function**

- Pros: No cold start, always warm, lowest latency
- Cons: PL/pgSQL learning curve, harder to test
- Implementation: Migration with `CREATE FUNCTION check_rate_limit()`

**Decision**: Start with Database Function (Option B) for lowest latency and simplicity.

### CSRF Token Storage

**Option A: HTTP-Only Cookies**

- Pros: Most secure, XSS-proof
- Cons: Requires server (not compatible with static export)

**Option B: Session Storage + Double Submit**

- Pros: Works with static export, good security
- Cons: Requires client-side management
- Implementation: Token in sessionStorage + HTTP header

**Decision**: Use Session Storage with Double Submit pattern (Option B).

### OAuth State Storage

**Option A: Database Table**

- Pros: Persistent, server-validated
- Cons: Extra DB queries

**Option B: Signed JWT in URL**

- Pros: Stateless, no DB queries
- Cons: URL length limits, requires signing key

**Decision**: Use Database Table (Option A) for auditability and simplicity.

## Open Questions (Resolved via /clarify)

All open questions have been resolved in the clarification session:

1. ✅ Idle timeout: 24 hours (configurable), 7 days for "Remember Me"
2. ✅ Disposable emails: Warn but allow (not block)
3. ✅ Webhook retry alerts: Email + database flag
4. ✅ Payment cleanup schedule: Weekly Sunday 3 AM UTC (configurable)

## Next Steps

Proceed to Phase 1:

1. Create data model for new tables (oauth_states, rate_limit_attempts)
2. Define API contracts for validation functions
3. Plan RLS policies for payment isolation
4. Generate quickstart guide for security hardening setup
