# Data Model - Security Hardening

## New Database Tables

### 1. rate_limit_attempts

**Purpose**: Server-side tracking of failed authentication attempts for brute force prevention

```sql
CREATE TABLE rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,  -- Email or IP address
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
```

**Fields**:

- `identifier`: Email or IP address being rate-limited
- `attempt_type`: Type of operation (sign_in, sign_up, password_reset)
- `attempt_count`: Number of failed attempts in current window
- `window_start`: Start of rate limit window (15 minutes)
- `locked_until`: Time when rate limit expires (NULL if not locked)

**Business Rules**:

- Maximum 5 attempts per 15-minute window
- Lockout duration: 15 minutes after 5th failure
- Window automatically resets after 15 minutes
- Attempts tracked by email OR IP (whichever is more restrictive)

---

### 2. oauth_states

**Purpose**: CSRF protection for OAuth flows via state parameter validation

```sql
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'google')),
  session_id TEXT,  -- Browser session identifier
  return_url TEXT,
  ip_address INET,
  user_agent TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

CREATE INDEX idx_oauth_states_token ON oauth_states(state_token) WHERE used = FALSE;
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at) WHERE used = FALSE;
```

**Fields**:

- `state_token`: Cryptographically random UUID for CSRF protection
- `provider`: OAuth provider (github, google)
- `session_id`: Client session identifier for additional validation
- `return_url`: URL to redirect after auth (validated against allowlist)
- `used`: Whether state token has been consumed
- `expires_at`: State expires after 5 minutes

**Business Rules**:

- State tokens are single-use (used=TRUE after consumption)
- Expire after 5 minutes for security
- Session ID must match between initiation and callback
- Cleanup job removes expired states daily

---

## Modified Tables

### payment_intents (CRITICAL CHANGE)

**Current Issue**: All payments use placeholder UUID `'00000000-0000-0000-0000-000000000000'`

**Required Change**: Associate payments with authenticated users

**Migration**:

```sql
-- 1. Add RLS policies
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Users can only see their own payment intents
CREATE POLICY "Users can view own payment intents"
  ON payment_intents FOR SELECT
  USING (auth.uid() = template_user_id);

-- 3. Policy: Users can only create payment intents for themselves
CREATE POLICY "Users can create own payment intents"
  ON payment_intents FOR INSERT
  WITH CHECK (auth.uid() = template_user_id);

-- 4. Policy: Users cannot update payment intents (immutable after creation)
CREATE POLICY "Payment intents are immutable"
  ON payment_intents FOR UPDATE
  USING (false);

-- 5. Policy: Users cannot delete payment intents directly
CREATE POLICY "Payment intents cannot be deleted by users"
  ON payment_intents FOR DELETE
  USING (false);
```

**Application Code Change**:

```typescript
// Before (INSECURE):
template_user_id: '00000000-0000-0000-0000-000000000000'

// After (SECURE):
template_user_id: (await supabase.auth.getUser()).data.user?.id || throw new Error('Not authenticated')
```

---

### payment_results

**Add RLS Policies** (inherits user from payment_intents):

```sql
ALTER TABLE payment_results ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view payment results for their own intents
CREATE POLICY "Users can view own payment results"
  ON payment_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_intents
      WHERE payment_intents.id = payment_results.intent_id
      AND payment_intents.template_user_id = auth.uid()
    )
  );

-- Policy: Webhook handlers can insert results (service role only)
CREATE POLICY "Service role can insert payment results"
  ON payment_results FOR INSERT
  TO service_role
  WITH CHECK (true);
```

---

### auth_audit_logs (POPULATE)

**Current Issue**: Table exists but no code writes to it

**Trigger-Based Approach** (Automatic):

```sql
-- Trigger function to log authentication events
CREATE OR REPLACE FUNCTION log_auth_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auth_audit_logs (user_id, event_type, event_data, ip_address, user_agent)
  VALUES (
    NEW.id,
    'sign_up',
    jsonb_build_object('email', NEW.email, 'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email')),
    NEW.last_sign_in_at::TEXT,  -- Placeholder - real IP from app metadata
    NULL  -- User agent from app metadata
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION log_auth_event();
```

**Application-Based Approach** (Explicit - Recommended for flexibility):

```typescript
// New utility: /src/lib/auth/audit-logger.ts
async function logAuthEvent(
  userId: string,
  eventType:
    | 'sign_in'
    | 'sign_out'
    | 'password_change'
    | 'password_reset_request',
  eventData?: Record<string, unknown>
) {
  await supabase.from('auth_audit_logs').insert({
    user_id: userId,
    event_type: eventType,
    event_data: eventData || {},
    ip_address: await getClientIP(), // From request headers or Supabase
    user_agent: navigator.userAgent,
  });
}
```

---

## Database Functions

### 1. check_rate_limit

**Purpose**: Server-side rate limit enforcement (replaces client-side localStorage)

```sql
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
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Find existing record
  SELECT * INTO v_record
  FROM rate_limit_attempts
  WHERE identifier = p_identifier
    AND attempt_type = p_attempt_type
  FOR UPDATE;

  -- Check if locked
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    RETURN json_build_object(
      'allowed', FALSE,
      'remaining', 0,
      'locked_until', v_record.locked_until,
      'reason', 'rate_limited'
    );
  END IF;

  -- Reset if window expired
  IF v_record.id IS NULL OR (v_now - v_record.window_start) > (v_window_minutes || ' minutes')::INTERVAL THEN
    -- Create new window or reset existing
    INSERT INTO rate_limit_attempts (identifier, attempt_type, ip_address, user_agent, window_start, attempt_count)
    VALUES (p_identifier, p_attempt_type, p_ip_address, NULL, v_now, 0)
    ON CONFLICT (identifier, attempt_type) DO UPDATE
      SET window_start = v_now,
          attempt_count = 0,
          locked_until = NULL,
          updated_at = v_now;

    RETURN json_build_object(
      'allowed', TRUE,
      'remaining', v_max_attempts,
      'locked_until', NULL
    );
  END IF;

  -- Check if under limit
  IF v_record.attempt_count < v_max_attempts THEN
    RETURN json_build_object(
      'allowed', TRUE,
      'remaining', v_max_attempts - v_record.attempt_count,
      'locked_until', NULL
    );
  ELSE
    -- Exceeded limit, lock for window duration
    UPDATE rate_limit_attempts
    SET locked_until = v_now + (v_window_minutes || ' minutes')::INTERVAL,
        updated_at = v_now
    WHERE identifier = p_identifier AND attempt_type = p_attempt_type;

    RETURN json_build_object(
      'allowed', FALSE,
      'remaining', 0,
      'locked_until', v_now + (v_window_minutes || ' minutes')::INTERVAL,
      'reason', 'rate_limited'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Usage**:

```typescript
const { data } = await supabase.rpc('check_rate_limit', {
  p_identifier: email,
  p_attempt_type: 'sign_in',
  p_ip_address: await getClientIP(),
});

if (!data.allowed) {
  throw new Error(`Rate limited. Try again at ${data.locked_until}`);
}
```

---

### 2. record_failed_attempt

**Purpose**: Increment failure counter after authentication fails

```sql
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

## Validation Functions (Application Layer)

### 1. Email Validator

**Location**: `/src/lib/auth/email-validator.ts`

**Interface**:

```typescript
interface EmailValidationResult {
  valid: boolean;
  normalized: string; // Lowercase, trimmed
  warnings: string[]; // e.g., "Disposable email detected"
  errors: string[]; // e.g., "Invalid TLD"
}

function validateEmail(email: string): EmailValidationResult;
```

**Rules**:

- Must have valid TLD (`.com`, `.org`, `.net`, etc.)
- No consecutive dots (`..`)
- Check against disposable email list (warn, don't block)
- Normalize to lowercase

---

### 2. Metadata Validator

**Location**: `/src/lib/payments/metadata-validator.ts`

**Interface**:

```typescript
function validateMetadata(metadata: Record<string, unknown>): void;
// Throws Error if invalid
```

**Rules**:

- Reject keys: `__proto__`, `constructor`, `prototype`
- Detect circular references
- Max nesting depth: 2 levels
- Max size: 1KB serialized
- Max array length: 100 items

---

## Data Flow Diagrams

### Payment Creation (Secure)

```
User → [Auth Check] → [Get auth.uid()] → Create Payment Intent
                              ↓
                         RLS Policy Check
                              ↓
                      (user_id = template_user_id)
                              ↓
                         Insert Allowed
```

### OAuth Flow (CSRF Protected)

```
1. User clicks "Sign in with GitHub"
   → Generate state token
   → Insert into oauth_states table
   → Redirect to GitHub with state parameter

2. GitHub redirects to /auth/callback?state=<token>&code=<code>
   → Lookup state token in oauth_states table
   → Verify: not used, not expired, session matches
   → Mark state as used
   → Complete authentication
```

### Rate Limiting (Server-Side)

```
1. User submits sign-in form
   → Call check_rate_limit(email, 'sign_in')
   → If blocked: Show error with lockout time
   → If allowed: Proceed to authentication

2. Authentication fails
   → Call record_failed_attempt(email, 'sign_in')
   → Increment counter

3. Authentication succeeds
   → Clear rate limit (optional)
```

---

## Schema Versioning

**Migration Order**:

1. Create `rate_limit_attempts` table
2. Create `oauth_states` table
3. Create `check_rate_limit()` function
4. Create `record_failed_attempt()` function
5. Add RLS policies to `payment_intents`
6. Add RLS policies to `payment_results`
7. Create audit logging trigger (or implement in app code)

**Rollback Strategy**:

- All tables have `DROP TABLE IF EXISTS` equivalents
- RLS policies can be disabled: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`
- Functions can be dropped: `DROP FUNCTION IF EXISTS check_rate_limit()`
