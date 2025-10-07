# API Contract: Rate Limiting

## Overview

Server-side rate limiting to prevent brute force attacks on authentication endpoints.

## Database Function: check_rate_limit()

### Signature

```sql
check_rate_limit(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_ip_address INET DEFAULT NULL
) RETURNS JSON
```

### Parameters

| Parameter        | Type | Required | Description                                    |
| ---------------- | ---- | -------- | ---------------------------------------------- |
| `p_identifier`   | TEXT | Yes      | Email address or IP address to rate limit      |
| `p_attempt_type` | TEXT | Yes      | One of: `sign_in`, `sign_up`, `password_reset` |
| `p_ip_address`   | INET | No       | Client IP address for additional tracking      |

### Returns

```typescript
{
  allowed: boolean;           // Whether attempt is allowed
  remaining: number;          // Remaining attempts before lockout
  locked_until: string | null; // ISO timestamp when lockout expires, or null
  reason?: string;            // "rate_limited" if blocked
}
```

### Examples

**Allowed Attempt:**

```json
{
  "allowed": true,
  "remaining": 4,
  "locked_until": null
}
```

**Rate Limited:**

```json
{
  "allowed": false,
  "remaining": 0,
  "locked_until": "2025-10-06T16:30:00Z",
  "reason": "rate_limited"
}
```

### Business Rules

- **Max Attempts**: 5 per 15-minute window
- **Lockout Duration**: 15 minutes after 5th failure
- **Window Reset**: Automatic after 15 minutes of inactivity
- **Tracking**: By email OR IP (whichever is more restrictive)

### Usage

```typescript
import { supabase } from '@/lib/supabase/client';

async function checkRateLimit(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_identifier: email,
    p_attempt_type: 'sign_in',
    p_ip_address: await getClientIP(), // Optional
  });

  if (error) throw error;

  if (!data.allowed) {
    const lockedUntil = new Date(data.locked_until);
    const minutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
    throw new Error(`Too many attempts. Try again in ${minutes} minutes.`);
  }

  return true;
}
```

---

## Database Function: record_failed_attempt()

### Signature

```sql
record_failed_attempt(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_ip_address INET DEFAULT NULL
) RETURNS VOID
```

### Parameters

| Parameter        | Type | Required | Description                                    |
| ---------------- | ---- | -------- | ---------------------------------------------- |
| `p_identifier`   | TEXT | Yes      | Email address or IP that failed authentication |
| `p_attempt_type` | TEXT | Yes      | One of: `sign_in`, `sign_up`, `password_reset` |
| `p_ip_address`   | INET | No       | Client IP address for tracking                 |

### Returns

None (VOID)

### Usage

```typescript
async function handleFailedLogin(email: string) {
  await supabase.rpc('record_failed_attempt', {
    p_identifier: email,
    p_attempt_type: 'sign_in',
  });
}
```

---

## Integration Points

### Sign-In Form

**Before authentication:**

```typescript
// 1. Check rate limit
await checkRateLimit(email);

// 2. Attempt sign-in
const { error } = await supabase.auth.signInWithPassword({ email, password });

// 3. Record failure if needed
if (error) {
  await supabase.rpc('record_failed_attempt', {
    p_identifier: email,
    p_attempt_type: 'sign_in',
  });
  throw error;
}
```

### Sign-Up Form

**Before creating account:**

```typescript
await checkRateLimit(email);
```

### Password Reset

**Before sending reset email:**

```typescript
await checkRateLimit(email);
```

---

## Error Handling

### Rate Limit Exceeded

**User-Facing Message:**

> Too many failed attempts. Please try again in 12 minutes.

**Developer Details:**

```typescript
class RateLimitError extends Error {
  constructor(
    public lockedUntil: Date,
    public identifier: string,
    public attemptType: string
  ) {
    const minutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
    super(`Rate limited. Try again in ${minutes} minutes.`);
    this.name = 'RateLimitError';
  }
}
```

### Database Unavailable

**Fallback Behavior:**

- If `check_rate_limit()` call fails, **ALLOW** the attempt (fail open)
- Log the error for investigation
- Rationale: Availability > strict security for transient issues

```typescript
try {
  await checkRateLimit(email);
} catch (error) {
  console.error('Rate limit check failed:', error);
  // Continue with authentication attempt
}
```

---

## Testing Contract

### Test Cases

1. **T001: First Attempt Allowed**
   - Input: New email, 'sign_in'
   - Expected: `{ allowed: true, remaining: 5 }`

2. **T002: Multiple Attempts Decremented**
   - Input: 3 failed attempts
   - Expected: `{ allowed: true, remaining: 2 }`

3. **T003: Lockout After 5 Failures**
   - Input: 5 failed attempts
   - Expected: `{ allowed: false, remaining: 0, locked_until: <timestamp> }`

4. **T004: Lockout Persists Across Clients**
   - Input: Attempt from different browser/IP
   - Expected: Still locked (server-side enforcement)

5. **T005: Window Reset After 15 Minutes**
   - Input: Wait 15 minutes, try again
   - Expected: `{ allowed: true, remaining: 5 }` (fresh window)

6. **T006: Successful Login Clears Limit** (Optional)
   - Input: Successful authentication
   - Expected: Counter reset to 0

---

## Performance Considerations

### Index Usage

Queries use these indexes:

- `idx_rate_limit_identifier` - Lookup by email
- `idx_rate_limit_window` - Window expiration cleanup
- `idx_rate_limit_locked` - Lockout status checks

### Expected Latency

- **check_rate_limit()**: <10ms (single SELECT + possible UPDATE)
- **record_failed_attempt()**: <5ms (single UPDATE)

### Cleanup Job

**Requirement**: Remove expired records to prevent unbounded growth

```sql
-- Run daily via pg_cron or external scheduler
DELETE FROM rate_limit_attempts
WHERE window_start < (now() - INTERVAL '24 hours');
```

---

## Security Considerations

### SQL Injection

- All parameters are properly typed (TEXT, INET)
- Function uses SECURITY DEFINER to enforce RLS
- No dynamic SQL construction

### Timing Attacks

- Response time should be constant whether locked or not
- No early return based on identifier lookup

### Bypassing

**Cannot be bypassed by:**

- Clearing localStorage
- Using incognito mode
- Switching browsers
- Using VPN (IP tracked but email is primary)

**Can be bypassed by:**

- Using different email addresses (acceptable - requires email verification)
- Distributed attack from many IPs (mitigated by IP tracking as secondary identifier)
