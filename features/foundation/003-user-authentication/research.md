# Research: User Authentication & Authorization

**Feature**: 003-user-authentication | **Date**: 2026-01-15

## Research Tasks Completed

### 1. Supabase SSR Patterns for Static Export

**Decision**: Use `@supabase/ssr` with cookie-based session management

**Rationale**:

- `@supabase/ssr` is the official Supabase package for Next.js App Router
- Works with static export by managing sessions client-side
- Automatically handles token refresh in middleware
- No server-side API routes required

**Alternatives Considered**:

- `@supabase/auth-helpers-nextjs` (deprecated, replaced by @supabase/ssr)
- Custom JWT management (unnecessary complexity, reinvents the wheel)
- Local storage tokens (less secure, no automatic refresh)

**Implementation Pattern**:

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

### 2. OAuth Callback Handling Without API Routes

**Decision**: Use client-side callback page at `/auth/callback`

**Rationale**:

- Static export prohibits API routes
- Supabase OAuth redirects to a client-side page
- Page extracts code from URL, exchanges for session
- `@supabase/ssr` handles the PKCE flow automatically

**Alternatives Considered**:

- Supabase Edge Function callback (adds latency, unnecessary)
- Server-side API route (incompatible with static export)

**Implementation Pattern**:

```typescript
// src/app/(auth)/callback/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        router.push('/dashboard')
      }
    })
  }, [router])

  return <div>Completing sign in...</div>
}
```

---

### 3. Session Refresh Strategy

**Decision**: Use middleware for automatic token refresh on each request

**Rationale**:

- Middleware runs on every navigation
- Can refresh tokens before they expire
- Works with static export (middleware is edge runtime)
- Supabase SDK handles token refresh automatically

**Alternatives Considered**:

- Polling interval (wastes resources, inconsistent)
- Manual refresh on protected pages (error-prone, repetitive)

**Implementation Pattern**:

```typescript
// src/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}
```

---

### 4. Rate Limiting for Brute Force Protection

**Decision**: Supabase Auth built-in + RLS-based attempt tracking

**Rationale**:

- Supabase Auth has built-in rate limiting at the API level
- Custom attempt tracking via database table + RLS policies
- Edge Function can enforce additional limits if needed
- No client-side enforcement (easily bypassed)

**Alternatives Considered**:

- Client-side throttling (easily bypassed, security theater)
- External rate limiting service (adds cost, complexity)
- Cloudflare rate limiting (good but requires Pro plan)

**Implementation Pattern**:

```sql
-- Login attempt tracking table
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE,
  ip_address INET
);

-- Index for efficient queries
CREATE INDEX idx_login_attempts_email_time
ON login_attempts(email, attempted_at DESC);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_login_rate_limit(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM login_attempts
  WHERE email = user_email
    AND attempted_at > NOW() - INTERVAL '15 minutes'
    AND success = FALSE;

  RETURN attempt_count < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 5. "Remember Me" Session Duration

**Decision**: Configure Supabase session expiry based on checkbox

**Rationale**:

- Supabase supports custom session expiry per sign-in
- 30 days for "Remember Me", 7 days default (per spec)
- Stored in session metadata, enforced by Supabase
- Cookie `maxAge` matches session expiry

**Alternatives Considered**:

- Single fixed expiry (doesn't meet spec requirements)
- Client-side session management (less secure)

**Implementation Pattern**:

```typescript
// Sign in with remember me
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
  options: {
    // Session duration in seconds
    expiresIn: rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60,
  },
});
```

---

### 6. Email Verification Flow

**Decision**: Use Supabase built-in email verification with custom templates

**Rationale**:

- Supabase handles verification email sending
- Custom templates via Supabase dashboard
- Verification link redirects to `/auth/verify` page
- 24-hour expiry configured in Supabase settings

**Alternatives Considered**:

- Custom email service (unnecessary complexity)
- Skip verification (security risk, spec violation)

**Configuration**:

- Supabase Auth Settings > Email Templates > Confirm signup
- Redirect URL: `https://yourdomain.com/auth/verify`
- Token expiry: 24 hours

---

### 7. Password Validation Rules

**Decision**: Client-side validation + Supabase password policy

**Rationale**:

- Spec requires: 8+ chars, uppercase, lowercase, number, special char
- Client-side validation for UX (immediate feedback)
- Supabase enforces server-side for security
- Zod schema for consistent validation

**Implementation Pattern**:

```typescript
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');
```

---

## Summary of Technology Choices

| Concern         | Decision                | Package/Tool          |
| --------------- | ----------------------- | --------------------- |
| Auth provider   | Supabase Auth           | @supabase/supabase-js |
| SSR integration | Supabase SSR            | @supabase/ssr         |
| Form validation | Zod schemas             | zod                   |
| OAuth providers | GitHub + Google         | Supabase OAuth        |
| Session storage | HTTP-only cookies       | @supabase/ssr         |
| Rate limiting   | Supabase + custom table | PostgreSQL            |
| Email delivery  | Supabase built-in       | Supabase              |

All research tasks resolved. Ready for Phase 1: Design & Contracts.
