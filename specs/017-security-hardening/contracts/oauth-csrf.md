# API Contract: OAuth CSRF Protection

## Overview

State parameter validation for OAuth flows to prevent CSRF attacks and session hijacking.

## State Token Management

### Generate State Token

**Function**: `generateOAuthState()`
**Location**: `/src/lib/auth/oauth-state.ts`

```typescript
interface OAuthState {
  stateToken: string; // UUID v4
  provider: 'github' | 'google';
  returnUrl?: string; // Validated against allowlist
  expiresAt: Date; // 5 minutes from now
}

async function generateOAuthState(
  provider: 'github' | 'google',
  returnUrl?: string
): Promise<string>;
```

**Returns**: State token (UUID) to include in OAuth redirect URL

**Implementation**:

```typescript
import { supabase } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export async function generateOAuthState(
  provider: 'github' | 'google',
  returnUrl?: string
): Promise<string> {
  const stateToken = uuidv4();
  const sessionId = getSessionId(); // From sessionStorage
  const ipAddress = await getClientIP();

  // Validate return URL against allowlist
  if (returnUrl && !isAllowedReturnUrl(returnUrl)) {
    throw new Error('Invalid return URL');
  }

  const { error } = await supabase.from('oauth_states').insert({
    state_token: stateToken,
    provider,
    session_id: sessionId,
    return_url: returnUrl || '/',
    ip_address: ipAddress,
    user_agent: navigator.userAgent,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });

  if (error) throw error;
  return stateToken;
}
```

---

### Validate State Token

**Function**: `validateOAuthState()`
**Location**: `/src/lib/auth/oauth-state.ts`

```typescript
interface StateValidationResult {
  valid: boolean;
  provider?: 'github' | 'google';
  returnUrl?: string;
  errors: string[];
}

async function validateOAuthState(
  stateToken: string
): Promise<StateValidationResult>;
```

**Validation Rules**:

1. ✅ State token exists in database
2. ✅ Not expired (< 5 minutes old)
3. ✅ Not already used (`used = FALSE`)
4. ✅ Session ID matches current session
5. ✅ Mark as used after validation

**Implementation**:

```typescript
export async function validateOAuthState(
  stateToken: string
): Promise<StateValidationResult> {
  const sessionId = getSessionId();

  const { data, error } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('state_token', stateToken)
    .eq('used', false)
    .single();

  if (error || !data) {
    return {
      valid: false,
      errors: ['Invalid or expired state token'],
    };
  }

  const now = new Date();
  const expiresAt = new Date(data.expires_at);

  if (now > expiresAt) {
    return {
      valid: false,
      errors: ['State token expired'],
    };
  }

  if (data.session_id !== sessionId) {
    return {
      valid: false,
      errors: ['Session mismatch - possible CSRF attack'],
    };
  }

  // Mark as used
  await supabase
    .from('oauth_states')
    .update({ used: true })
    .eq('state_token', stateToken);

  return {
    valid: true,
    provider: data.provider,
    returnUrl: data.return_url || '/',
    errors: [],
  };
}
```

---

## Integration Points

### OAuth Button Click (Initiation)

**Location**: `/src/components/auth/OAuthButtons/OAuthButtons.tsx`

**Before**:

```typescript
const handleOAuth = async (provider: 'github' | 'google') => {
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
};
```

**After** (with CSRF protection):

```typescript
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

---

### OAuth Callback (Validation)

**Location**: `/src/app/auth/callback/page.tsx` or route.ts

**Implementation**:

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { validateOAuthState } from '@/lib/auth/oauth-state';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      // Handle OAuth provider errors
      if (error) {
        router.push(`/sign-in?error=${encodeURIComponent(error)}`);
        return;
      }

      // Validate state token
      if (!state) {
        router.push('/sign-in?error=missing_state');
        return;
      }

      const validation = await validateOAuthState(state);

      if (!validation.valid) {
        console.error('OAuth state validation failed:', validation.errors);
        router.push('/sign-in?error=invalid_state');
        return;
      }

      // Exchange code for session (Supabase handles this automatically)
      const { error: authError } = await supabase.auth.exchangeCodeForSession(code);

      if (authError) {
        router.push(`/sign-in?error=${encodeURIComponent(authError.message)}`);
        return;
      }

      // Redirect to return URL (already validated in state)
      router.push(validation.returnUrl || '/');
    };

    handleCallback();
  }, [router, searchParams]);

  return <div className="container mx-auto p-4">Completing sign-in...</div>;
}
```

---

## Database Schema

### oauth_states Table

```sql
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
```

---

## Return URL Validation

### Allowed Patterns

```typescript
const ALLOWED_RETURN_URLS = [
  '/',
  '/profile',
  '/account',
  '/payment-demo',
  '/settings',
  // Add more as needed
];

function isAllowedReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);

    // Must be same origin
    if (parsed.origin !== window.location.origin) {
      return false;
    }

    // Must match allowlist
    return ALLOWED_RETURN_URLS.includes(parsed.pathname);
  } catch {
    return false;
  }
}
```

---

## Error Handling

### Invalid State Token

**User Message**: "Authentication failed. Please try signing in again."

**Developer Log**: "OAuth state validation failed: <reason>"

**Redirect**: `/sign-in?error=invalid_state`

### Expired State Token

**User Message**: "Authentication link expired. Please try signing in again."

**Redirect**: `/sign-in?error=expired_state`

### Session Mismatch (CSRF Attack)

**User Message**: "Security check failed. Please try signing in again."

**Developer Log**: "CRITICAL: Possible CSRF attack detected - session mismatch"

**Action**: Log to security audit trail, redirect to sign-in

---

## Testing Contract

### Test Cases

1. **T001: Valid State Token**
   - Generate state → Validate state
   - Expected: `{ valid: true, provider: 'github', returnUrl: '/' }`

2. **T002: Expired State Token**
   - Generate state → Wait 6 minutes → Validate
   - Expected: `{ valid: false, errors: ['State token expired'] }`

3. **T003: Already Used State Token**
   - Generate state → Validate → Validate again
   - Expected: Second validation fails with "Invalid or expired state token"

4. **T004: Session Mismatch**
   - Generate state with session A → Validate with session B
   - Expected: `{ valid: false, errors: ['Session mismatch'] }`

5. **T005: Invalid State Token**
   - Validate random UUID not in database
   - Expected: `{ valid: false, errors: ['Invalid or expired state token'] }`

6. **T006: Return URL Validation**
   - Generate state with malicious URL: `https://evil.com`
   - Expected: Throws "Invalid return URL"

---

## Cleanup Job

**Requirement**: Remove expired state tokens to prevent database bloat

```sql
-- Run hourly via pg_cron or external scheduler
DELETE FROM oauth_states
WHERE expires_at < (now() - INTERVAL '1 hour')
   OR (used = TRUE AND created_at < (now() - INTERVAL '1 day'));
```

---

## Security Considerations

### State Token Entropy

- **Format**: UUID v4 (122 bits of entropy)
- **Randomness**: Cryptographically secure via `crypto.randomUUID()`
- **Unguessable**: 2^122 possible values

### Replay Attacks

- **Mitigation**: Single-use tokens (`used = TRUE` after validation)
- **Window**: 5-minute expiration limits attack window

### Session Fixation

- **Mitigation**: Session ID validated in addition to state token
- **Storage**: Session ID in sessionStorage (cleared on browser close)

### Return URL Injection

- **Mitigation**: Allowlist-based validation
- **Same-Origin**: Only allow same-origin redirects
- **Path Validation**: Only allow specific paths
