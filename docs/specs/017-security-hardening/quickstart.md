# Quickstart Guide: Security Hardening

## Prerequisites

- Supabase project with existing auth setup
- Docker Compose environment running
- Access to Supabase Studio or CLI
- Current codebase with PRP-015 and PRP-016 implemented

## Phase-by-Phase Implementation

### Phase 1: Database Setup (P0 - Critical)

#### Step 1.1: Create Rate Limiting Infrastructure

```bash
# Create migration file
cat > supabase/migrations/$(date +%Y%m%d%H%M%S)_security_hardening_p0.sql << 'EOF'
-- Rate limiting table
CREATE TABLE rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('sign_in', 'sign_up', 'password_reset')),
  ip_address INET,
  user_agent TEXT,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_identifier ON rate_limit_attempts(identifier, attempt_type);
CREATE INDEX idx_rate_limit_window ON rate_limit_attempts(window_start);
CREATE INDEX idx_rate_limit_locked ON rate_limit_attempts(locked_until) WHERE locked_until IS NOT NULL;

-- OAuth state tracking
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'google')),
  session_id TEXT,
  return_url TEXT,
  ip_address INET,
  user_agent TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

CREATE INDEX idx_oauth_states_token ON oauth_states(state_token) WHERE used = FALSE;
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at) WHERE used = FALSE;
EOF

# Apply migration
docker compose exec scripthammer pnpm supabase:migrate
```

#### Step 1.2: Add RLS Policies to Payment Tables

```sql
-- Enable RLS on payment_intents
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

-- Users can only view their own payment intents
CREATE POLICY "Users can view own payment intents"
  ON payment_intents FOR SELECT
  USING (auth.uid() = template_user_id);

-- Users can only create payment intents for themselves
CREATE POLICY "Users can create own payment intents"
  ON payment_intents FOR INSERT
  WITH CHECK (auth.uid() = template_user_id);

-- Enable RLS on payment_results
ALTER TABLE payment_results ENABLE ROW LEVEL SECURITY;

-- Users can view payment results for their own intents
CREATE POLICY "Users can view own payment results"
  ON payment_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_intents
      WHERE payment_intents.id = payment_results.intent_id
      AND payment_intents.template_user_id = auth.uid()
    )
  );

-- Service role can insert payment results (from webhooks)
CREATE POLICY "Service role can insert payment results"
  ON payment_results FOR INSERT
  TO service_role
  WITH CHECK (true);
```

#### Step 1.3: Create Rate Limiting Functions

```sql
-- Check if attempt is allowed
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_record rate_limit_attempts%ROWTYPE;
  v_max_attempts INTEGER := 5;
  v_window_minutes INTEGER := 15;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- See data-model.md for full implementation
  -- ... (implementation in migration file)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record failed attempt
CREATE OR REPLACE FUNCTION record_failed_attempt(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE rate_limit_attempts
  SET attempt_count = attempt_count + 1,
      updated_at = now()
  WHERE identifier = p_identifier
    AND attempt_type = p_attempt_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Phase 2: Fix Payment User Association (P0 - CRITICAL)

#### Step 2.1: Create Secure Payment Service Wrapper

```typescript
// /src/lib/payments/secure-payment-service.ts
import { supabase } from '@/lib/supabase/client';

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Authentication required to create payment');
  }

  return user.id;
}

export async function createSecurePaymentIntent(
  amount: number,
  currency: Currency,
  type: PaymentType,
  customerEmail: string,
  options?: PaymentIntentOptions
): Promise<PaymentIntent> {
  // Get authenticated user ID
  const userId = await getAuthenticatedUserId();

  // Create payment with real user ID
  const { data, error } = await supabase
    .from('payment_intents')
    .insert({
      template_user_id: userId, // ✅ Real user ID, not placeholder
      amount,
      currency,
      type,
      customer_email: customerEmail,
      description: options?.description || null,
      metadata: options?.metadata || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as PaymentIntent;
}
```

#### Step 2.2: Update Payment Components

```typescript
// /src/components/payment/PaymentButton/PaymentButton.tsx
import { createSecurePaymentIntent } from '@/lib/payments/secure-payment-service';

// Replace calls to createPaymentIntent with createSecurePaymentIntent
```

---

### Phase 3: Implement OAuth CSRF Protection (P0)

#### Step 3.1: Create OAuth State Utilities

```typescript
// /src/lib/auth/oauth-state.ts
import { supabase } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';

// Get or create session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = uuidv4();
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
}

// Generate state token
export async function generateOAuthState(
  provider: 'github' | 'google',
  returnUrl?: string
): Promise<string> {
  const stateToken = uuidv4();
  const sessionId = getSessionId();

  const { error } = await supabase.from('oauth_states').insert({
    state_token: stateToken,
    provider,
    session_id: sessionId,
    return_url: returnUrl || '/',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });

  if (error) throw error;
  return stateToken;
}

// Validate state token
export async function validateOAuthState(stateToken: string) {
  const sessionId = getSessionId();

  const { data, error } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('state_token', stateToken)
    .eq('used', false)
    .single();

  if (error || !data) {
    return { valid: false, errors: ['Invalid or expired state token'] };
  }

  if (new Date() > new Date(data.expires_at)) {
    return { valid: false, errors: ['State token expired'] };
  }

  if (data.session_id !== sessionId) {
    return { valid: false, errors: ['Session mismatch'] };
  }

  // Mark as used
  await supabase
    .from('oauth_states')
    .update({ used: true })
    .eq('state_token', stateToken);

  return {
    valid: true,
    provider: data.provider,
    returnUrl: data.return_url,
    errors: [],
  };
}
```

#### Step 3.2: Update OAuth Buttons

```typescript
// /src/components/auth/OAuthButtons/OAuthButtons.tsx
import { generateOAuthState } from '@/lib/auth/oauth-state';

const handleOAuth = async (provider: 'github' | 'google') => {
  // Generate state token
  const stateToken = await generateOAuthState(
    provider,
    window.location.pathname
  );

  // Include state in OAuth flow
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        state: stateToken,
      },
    },
  });
};
```

#### Step 3.3: Update OAuth Callback Handler

```typescript
// /src/app/auth/callback/page.tsx
import { validateOAuthState } from '@/lib/auth/oauth-state';

useEffect(() => {
  const state = searchParams.get('state');

  if (!state) {
    router.push('/sign-in?error=missing_state');
    return;
  }

  const validation = await validateOAuthState(state);

  if (!validation.valid) {
    router.push('/sign-in?error=invalid_state');
    return;
  }

  // Continue with authentication
  router.push(validation.returnUrl || '/');
}, []);
```

---

### Phase 4: Add Server-Side Rate Limiting (P0)

#### Step 4.1: Create Rate Limit Wrapper

```typescript
// /src/lib/auth/rate-limit-check.ts
import { supabase } from '@/lib/supabase/client';

export async function checkRateLimit(
  email: string,
  attemptType: 'sign_in' | 'sign_up' | 'password_reset'
): Promise<void> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_identifier: email,
    p_attempt_type: attemptType,
  });

  if (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow attempt if rate limiter unavailable
    return;
  }

  if (!data.allowed) {
    const lockedUntil = new Date(data.locked_until);
    const minutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
    throw new Error(`Too many attempts. Try again in ${minutes} minutes.`);
  }
}

export async function recordFailedAttempt(
  email: string,
  attemptType: 'sign_in' | 'sign_up' | 'password_reset'
): Promise<void> {
  await supabase.rpc('record_failed_attempt', {
    p_identifier: email,
    p_attempt_type: attemptType,
  });
}
```

#### Step 4.2: Update Sign-In Form

```typescript
// /src/components/auth/SignInForm/SignInForm.tsx
import {
  checkRateLimit,
  recordFailedAttempt,
} from '@/lib/auth/rate-limit-check';

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();

  try {
    // Check rate limit BEFORE attempting sign-in
    await checkRateLimit(email, 'sign_in');

    // Attempt authentication
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Record failure
      await recordFailedAttempt(email, 'sign_in');
      setError(error.message);
      return;
    }

    // Success - redirect
    onSuccess?.();
  } catch (err) {
    setError(err.message);
  }
};
```

---

### Phase 5: Enhanced Validation (P1)

#### Step 5.1: Email Validator

```typescript
// /src/lib/auth/email-validator.ts
const VALID_TLDS = ['com', 'org', 'net', 'edu', 'gov', 'io', 'dev', 'app'];
const DISPOSABLE_DOMAINS = [
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
];

export function validateEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    errors.push('Invalid email format');
  }

  // Check TLD
  const tld = normalized.split('.').pop();
  if (!VALID_TLDS.includes(tld)) {
    errors.push('Invalid email domain');
  }

  // Check for consecutive dots
  if (normalized.includes('..')) {
    errors.push('Email contains consecutive dots');
  }

  // Check disposable email
  const domain = normalized.split('@')[1];
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    warnings.push(
      'Disposable email detected - may cause issues with account recovery'
    );
  }

  return {
    valid: errors.length === 0,
    normalized,
    warnings,
    errors,
  };
}
```

#### Step 5.2: Metadata Validator

```typescript
// /src/lib/payments/metadata-validator.ts
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

export function validateMetadata(metadata: Record<string, unknown>): void {
  // Check for dangerous keys
  const keys = Object.keys(metadata);
  for (const key of keys) {
    if (DANGEROUS_KEYS.includes(key)) {
      throw new Error(`Dangerous key detected: ${key}`);
    }
  }

  // Check for circular references
  const seen = new WeakSet();
  function detectCircular(obj: unknown): void {
    if (obj && typeof obj === 'object') {
      if (seen.has(obj)) {
        throw new Error('Circular reference detected in metadata');
      }
      seen.add(obj);
      Object.values(obj).forEach(detectCircular);
    }
  }
  detectCircular(metadata);

  // Existing checks (size, nesting) remain
}
```

---

## Testing the Implementation

### P0 Critical Tests

```bash
# Test 1: Payment user isolation
docker compose exec scripthammer pnpm test src/lib/payments/secure-payment-service.test.ts

# Test 2: OAuth CSRF protection
docker compose exec scripthammer pnpm test src/lib/auth/oauth-state.test.ts

# Test 3: Rate limiting
docker compose exec scripthammer pnpm test src/lib/auth/rate-limit-check.test.ts

# E2E Security Tests
docker compose exec scripthammer pnpm exec playwright test e2e/security/
```

### Manual Verification

1. **Payment Isolation**:
   - Create payment as User A
   - Sign in as User B
   - Verify User B cannot see User A's payments

2. **OAuth CSRF**:
   - Start OAuth flow
   - Modify state parameter in callback URL
   - Verify authentication fails

3. **Rate Limiting**:
   - Attempt 6 failed logins
   - Verify lockout message appears
   - Clear localStorage and try again
   - Verify still locked (server-side enforcement)

---

## Rollout Strategy

### Development Environment

1. Apply all migrations
2. Update code with security fixes
3. Run test suite
4. Manual testing

### Staging Environment

1. Apply migrations with RLS policies disabled initially
2. Deploy code changes
3. Enable RLS policies one table at a time
4. Monitor for errors

### Production Environment

1. **Backup database** before migration
2. Apply migrations during low-traffic window
3. Enable RLS policies with monitoring
4. Have rollback plan ready

---

## Rollback Plan

```sql
-- Disable RLS if issues occur
ALTER TABLE payment_intents DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_results DISABLE ROW LEVEL SECURITY;

-- Drop new tables if needed
DROP TABLE IF EXISTS oauth_states CASCADE;
DROP TABLE IF EXISTS rate_limit_attempts CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, TEXT, INET);
DROP FUNCTION IF EXISTS record_failed_attempt(TEXT, TEXT, INET);
```

---

## Monitoring & Alerts

### Key Metrics

1. **Rate Limiting**:
   - Failed attempts per hour
   - Lockouts per day
   - Top rate-limited IPs/emails

2. **OAuth Security**:
   - Invalid state token attempts
   - Session mismatch events
   - Expired token usage

3. **Payment Security**:
   - RLS policy denials
   - Cross-user access attempts

### Supabase Dashboard Queries

```sql
-- Failed authentication attempts (last hour)
SELECT identifier, attempt_type, attempt_count
FROM rate_limit_attempts
WHERE window_start > now() - INTERVAL '1 hour'
ORDER BY attempt_count DESC;

-- OAuth security events (last 24h)
SELECT provider, COUNT(*) as invalid_attempts
FROM oauth_states
WHERE used = FALSE AND expires_at < now()
GROUP BY provider;
```

---

## Success Criteria

✅ All P0 requirements implemented:

- REQ-SEC-001: Payment data isolation with RLS
- REQ-SEC-002: OAuth CSRF protection with state tokens
- REQ-SEC-003: Server-side rate limiting
- REQ-SEC-004: CSRF token system (if applicable)

✅ All tests passing:

- Unit tests for validators
- Integration tests for auth flows
- E2E tests for security scenarios

✅ No regressions:

- Existing functionality works
- Performance within acceptable limits
- No new console errors

---

## Next Steps

After completing this quickstart:

1. Proceed to P1 requirements (audit logging, enhanced validation)
2. Implement P2 UX improvements (password strength, idle timeout)
3. Add P3 polish (error announcements, logging discipline)
4. Schedule security audit review
