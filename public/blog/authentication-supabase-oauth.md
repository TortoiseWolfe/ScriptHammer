---
title: 'Supabase Authentication: OAuth & Security'
author: TortoiseWolfe
date: 2025-10-08
slug: authentication-supabase-oauth
tags:
  - authentication
  - supabase
  - oauth
  - security
  - next.js
  - typescript
categories:
  - tutorials
  - security
excerpt: Secure authentication with Supabase, OAuth providers, server-side rate limiting, and Row-Level Security in Next.js 15 & PostgreSQL.
featuredImage: /blog-images/authentication-supabase-oauth/featured-og.svg
featuredImageAlt: Production-Ready Authentication with Supabase - OAuth, Security Hardening, and PostgreSQL
ogImage: /blog-images/authentication-supabase-oauth/featured-og.png
ogTitle: Production-Ready Authentication with Supabase - OAuth & Security
ogDescription: Complete guide to implementing secure authentication with Supabase, OAuth (GitHub/Google), server-side rate limiting, and Row-Level Security policies.
twitterCard: summary_large_image
---

# 🔒 Production-Ready Authentication with Supabase: OAuth, Security, and Real-World Implementation

Authentication is the foundation of any application that handles user data. Get it wrong, and you're exposing your users to account takeovers, data breaches, and compliance nightmares. Get it right, and your users don't even notice—they just trust you.

This post documents our implementation of production-ready authentication in ScriptHammer using [Supabase](https://supabase.com/), complete with OAuth (Open Authorization) providers, server-side rate limiting, and database-level security policies. This isn't a "hello world" tutorial—this is what we learned building authentication that actually ships to production.

## 🗄️ Why Supabase? (vs Auth0/Firebase)

After evaluating Auth0, Firebase Auth, and Supabase, we chose Supabase for three critical reasons:

1. **Database-First Security**: Row-Level Security (RLS) policies live in PostgreSQL (Structured Query Language), not application code. Even if your API (Application Programming Interface) gets compromised, the database won't leak data.

2. **No Vendor Lock-In**: Supabase runs on open-source PostgreSQL. If we ever need to migrate, we own the database schema and can export everything.

3. **Developer Experience**: Built-in session management with [@supabase/ssr](https://github.com/supabase/auth-helpers) for Next.js, automatic TypeScript type generation, and real-time subscriptions all in one package.

Firebase Auth is great for prototypes, but authentication-as-a-service means you're always dependent on Google's infrastructure. Auth0 is enterprise-grade but expensive at scale. Supabase gives us enterprise features with open-source flexibility.

## 🔨 What We Built: Feature Overview

Here's what ships in our authentication system:

### 🔐 Core Authentication Flows

- ✉️ **Email/Password Authentication**: Traditional sign-up with email verification
- 🔑 **OAuth Providers**: GitHub and Google single sign-on with Cross-Site Request Forgery (CSRF) protection
- 🔄 **Password Reset**: Secure token-based password recovery via email
- ⏱️ **Session Management**: 7-day default sessions, 30-day "Remember Me" option

### 🛡️ Security Hardening

- 🚦 **Server-Side Rate Limiting**: 5 failed attempts per 15-minute window, enforced in PostgreSQL (client can't bypass)
- 🔒 **OAuth CSRF Protection**: State token validation prevents session hijacking
- 📝 **Audit Logging**: Every authentication event logged to database with Internet Protocol (IP) address and user agent
- 🗄️ **Row-Level Security**: Database policies ensure users only see their own data

### 🔧 Developer Features

- 🛣️ **Protected Routes**: Middleware-based authorization checks
- 📘 **Type Safety**: Generated TypeScript types from Supabase schema
- ⚛️ **React Context**: Global `useAuth()` hook for accessing user session
- 🧪 **Test Infrastructure**: Pre-configured test users for integration testing

Let's dive into the implementation.

## 📧 Part 1: Email/Password Auth

### The Sign-Up Flow

Email/password authentication starts with user registration. Here's our `SignUpForm` component:

```tsx
// src/components/auth/SignUpForm/SignUpForm.tsx
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { validateEmail } from '@/lib/auth/email-validator';
import { checkRateLimit } from '@/lib/auth/rate-limit-check';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate email format and check for disposable domains
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        alert(emailValidation.errors.join(', '));
        return;
      }

      // Server-side rate limit check (enforced in PostgreSQL)
      const rateLimit = await checkRateLimit(email, 'sign_up');
      if (!rateLimit.allowed) {
        alert(`Too many attempts. Try again after ${rateLimit.locked_until}`);
        return;
      }

      // Create user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      // User created - verification email sent
      alert('Check your email for the verification link!');
    } catch (error) {
      console.error('Sign up error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 8 chars)"
        minLength={8}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign Up'}
      </button>
    </form>
  );
}
```

### Email Validation with TLD Checks

We enhanced Supabase's built-in validation with custom checks for Top-Level Domain (TLD) validity and disposable email detection:

```typescript
// src/lib/auth/email-validator.ts
const VALID_TLDS = new Set([
  'com',
  'org',
  'net',
  'edu',
  'gov',
  'io',
  'co',
  'uk',
  'us',
  'ca',
  'au',
  'de',
  'fr',
  'it',
  'es',
  'app',
  'dev',
  'cloud',
  'tech',
  'ai',
]);

const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  'throwaway.email',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
]);

export function validateEmail(email: string) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // RFC 5322 format check
  const EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!EMAIL_REGEX.test(email)) {
    errors.push('Invalid email format');
  }

  // TLD validation
  const tld = email.split('.').pop()?.toLowerCase();
  if (!tld || !VALID_TLDS.has(tld)) {
    errors.push('Invalid or missing top-level domain (TLD)');
  }

  // Disposable email detection (warning, not error)
  const domain = email.split('@')[1];
  if (domain && DISPOSABLE_DOMAINS.has(domain)) {
    warnings.push(
      'Disposable email detected - account recovery may be limited'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized: email.toLowerCase(),
  };
}
```

Why validate on the client AND server? Client validation provides instant feedback. Server validation (in Supabase Edge Functions) prevents malicious clients from bypassing checks.

### Email Verification Flow

After sign-up, Supabase sends a verification email with a token. The user clicks the link, which redirects to our callback page:

```tsx
// src/app/auth/callback/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const supabase = await createClient();

  if (searchParams.code) {
    // Exchange authorization code for session
    const { error } = await supabase.auth.exchangeCodeForSession(
      searchParams.code
    );

    if (error) {
      return redirect('/sign-in?error=verification_failed');
    }

    // Email verified - redirect to dashboard
    return redirect('/profile');
  }

  return redirect('/sign-in');
}
```

This callback handles both email verification and OAuth redirects (which we'll cover next).

## 🔑 Part 2: OAuth with GitHub and Google

### Why OAuth?

Password fatigue is real. Users reuse passwords across sites, creating security nightmares. OAuth lets users authenticate with providers they already trust (GitHub, Google) without creating another password.

### OAuth Flow with CSRF Protection

OAuth has a critical vulnerability: Cross-Site Request Forgery (CSRF) attacks. An attacker can initiate an OAuth flow and trick a victim into completing it, linking the attacker's GitHub account to the victim's app account.

We prevent this with **state tokens**:

```typescript
// src/lib/auth/oauth-state.ts
import { supabase } from '@/lib/supabase/client';

// Generate UUID v4 using crypto API (available in modern browsers and Node 16+)
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a session ID for CSRF validation
 * Uses sessionStorage to track the browser session
 */
function getSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const SESSION_KEY = 'oauth_session_id';
  let sessionId = sessionStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = generateUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Generate a cryptographically random state token for OAuth flow
 * Stored in database with 5-minute expiration
 */
export async function generateOAuthState(
  provider: 'github' | 'google'
): Promise<string> {
  const stateToken = generateUUID(); // Cryptographically random UUID
  const sessionId = getSessionId(); // Get or create browser session ID

  // Store in database
  const { error } = await supabase.from('oauth_states').insert({
    state_token: stateToken,
    provider,
    session_id: sessionId, // Tie to browser session
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
  });

  if (error) {
    throw new Error('Failed to generate OAuth state');
  }

  return stateToken;
}

/**
 * Validate state token from OAuth callback
 * Ensures the request originated from the same browser session
 */
export async function validateOAuthState(stateToken: string) {
  const { data, error } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('state_token', stateToken)
    .eq('used', false) // Prevent replay attacks
    .single();

  if (error || !data) {
    return { valid: false, error: 'invalid_state' };
  }

  // Check expiration
  if (new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'state_expired' };
  }

  // Mark as used (single-use tokens)
  await supabase
    .from('oauth_states')
    .update({ used: true })
    .eq('state_token', stateToken);

  return { valid: true, provider: data.provider };
}
```

### OAuth Button Component

Here's how we initiate OAuth flows with state token protection:

```tsx
// src/components/auth/OAuthButtons/OAuthButtons.tsx
import { supabase } from '@/lib/supabase/client';
import { generateOAuthState } from '@/lib/auth/oauth-state';

export function OAuthButtons() {
  const handleOAuth = async (provider: 'github' | 'google') => {
    try {
      // Generate CSRF protection state token
      const stateToken = await generateOAuthState(provider);

      // Initiate OAuth flow with state parameter
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes:
            provider === 'github' ? 'read:user user:email' : 'email profile',
          queryParams: {
            state: stateToken, // Include state for CSRF protection
          },
        },
      });

      if (error) throw error;

      // User redirected to provider's consent page
    } catch (error) {
      console.error('OAuth error:', error);
      alert('Failed to initiate OAuth flow');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => handleOAuth('github')} className="btn btn-outline">
        <svg /* GitHub icon SVG */></svg>
        Continue with GitHub
      </button>

      <button onClick={() => handleOAuth('google')} className="btn btn-outline">
        <svg /* Google icon SVG */></svg>
        Continue with Google
      </button>
    </div>
  );
}
```

### OAuth Callback Handling

When the user authorizes on GitHub/Google, they're redirected back to our callback with an authorization code. We validate the state token before exchanging the code for a session:

```tsx
// src/app/auth/callback/page.tsx (extended)
import { validateOAuthState } from '@/lib/auth/oauth-state';

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: { code?: string; state?: string };
}) {
  const supabase = await createClient();

  if (searchParams.code) {
    // Validate OAuth state token (CSRF protection)
    if (searchParams.state) {
      const stateValidation = await validateOAuthState(searchParams.state);

      if (!stateValidation.valid) {
        return redirect('/sign-in?error=oauth_security_error');
      }
    }

    // Exchange authorization code for session
    const { error } = await supabase.auth.exchangeCodeForSession(
      searchParams.code
    );

    if (error) {
      return redirect('/sign-in?error=oauth_failed');
    }

    // Authenticated - redirect to dashboard
    return redirect('/profile');
  }

  return redirect('/sign-in');
}
```

## 🚦 Part 3: Server-Side Rate Limiting

⚠️ **Critical**: Client-side rate limiting is useless—attackers can bypass JavaScript. We implemented **PostgreSQL-based rate limiting** that's impossible to bypass:

### Database Function for Rate Limiting

```sql
-- supabase/migrations/20251006_complete_monolithic_setup.sql
CREATE TABLE rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- Email or IP address
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('sign_in', 'sign_up', 'password_reset')),
  ip_address INET,
  user_agent TEXT,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  locked_until TIMESTAMPTZ, -- Lockout expiration
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rate_limit_unique
  ON rate_limit_attempts(identifier, attempt_type);

-- Function: Check if user is rate limited
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
  -- Lock row to prevent race conditions
  SELECT * INTO v_record
  FROM rate_limit_attempts
  WHERE identifier = p_identifier AND attempt_type = p_attempt_type
  FOR UPDATE SKIP LOCKED;

  -- Check if locked out
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    RETURN json_build_object(
      'allowed', FALSE,
      'remaining', 0,
      'locked_until', v_record.locked_until,
      'reason', 'rate_limited'
    );
  END IF;

  -- Reset window if expired
  IF v_record.id IS NULL OR (v_now - v_record.window_start) > (v_window_minutes || ' minutes')::INTERVAL THEN
    INSERT INTO rate_limit_attempts (identifier, attempt_type, ip_address, window_start, attempt_count)
    VALUES (p_identifier, p_attempt_type, p_ip_address, v_now, 0)
    ON CONFLICT (identifier, attempt_type) DO UPDATE
      SET window_start = v_now, attempt_count = 0, locked_until = NULL, updated_at = v_now;
    RETURN json_build_object('allowed', TRUE, 'remaining', v_max_attempts, 'locked_until', NULL);
  END IF;

  -- Check attempt count
  IF v_record.attempt_count < v_max_attempts THEN
    RETURN json_build_object(
      'allowed', TRUE,
      'remaining', v_max_attempts - v_record.attempt_count,
      'locked_until', NULL
    );
  ELSE
    -- Lock out user
    UPDATE rate_limit_attempts
    SET locked_until = v_now + (v_window_minutes || ' minutes')::INTERVAL, updated_at = v_now
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

### Client-Side Rate Limit Check

```typescript
// src/lib/auth/rate-limit-check.ts
import { supabase } from '@/lib/supabase/client';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  locked_until: string | null;
  reason?: 'rate_limited';
}

export async function checkRateLimit(
  identifier: string,
  attemptType: 'sign_in' | 'sign_up' | 'password_reset',
  ipAddress?: string
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_attempt_type: attemptType,
    p_ip_address: ipAddress || null,
  });

  if (error) {
    console.error('Rate limit check failed:', error);
    // Fail open (allow request) rather than fail closed (block everyone)
    return { allowed: true, remaining: 5, locked_until: null };
  }

  return data as unknown as RateLimitResult;
}

export async function recordFailedAttempt(
  identifier: string,
  attemptType: 'sign_in' | 'sign_up' | 'password_reset',
  ipAddress?: string
): Promise<void> {
  await supabase.rpc('record_failed_attempt', {
    p_identifier: identifier,
    p_attempt_type: attemptType,
    p_ip_address: ipAddress || null,
  });
}
```

This approach has three critical advantages:

1. **Impossible to Bypass**: Enforced in PostgreSQL, not JavaScript
2. **No External Services**: No Redis or Upstash needed
3. **Audit Trail**: Every attempt logged with IP and user agent

## 🗄️ Part 4: Row-Level Security (RLS) Policies

Even if your API gets compromised, Row-Level Security (RLS) policies in PostgreSQL ensure users can't see each other's data.

### Payment Data Isolation

```sql
-- Users can only view their own payment intents
CREATE POLICY "Users can view own payment intents" ON payment_intents
  FOR SELECT USING (auth.uid() = template_user_id);

-- Users can only create payment intents for themselves
CREATE POLICY "Users can create own payment intents" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

-- Payment intents are immutable (no UPDATE allowed)
CREATE POLICY "Payment intents are immutable" ON payment_intents
  FOR UPDATE USING (false);

-- Users cannot delete payment records
CREATE POLICY "Payment intents cannot be deleted by users" ON payment_intents
  FOR DELETE USING (false);
```

### User Profile Access

```sql
-- Users view their own profile
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users update their own profile
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

✅ **Security Guarantee**: These policies run **at the database level**, enforced by PostgreSQL. Even if an attacker compromises your Next.js API routes, they can't query other users' data.

## ⏱️ Part 5: Session & Route Protection

### AuthContext for Global Session State

We use React Context to provide authentication state throughout the app:

```tsx
// src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Middleware for Protected Routes

Next.js middleware runs before page rendering, making it perfect for authentication checks:

```typescript
// src/middleware.ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

The `updateSession` helper handles session validation and route protection:

```typescript
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Get user session (refreshes expired tokens automatically)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname === '/sign-in' ||
      request.nextUrl.pathname === '/sign-up')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/profile';
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users from protected routes
  const protectedRoutes = ['/profile', '/account', '/payment-demo'];
  if (
    !user &&
    protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

This middleware pattern ensures:

- Unauthenticated users can't access `/profile`, `/account`, or `/payment-demo`
- Authenticated users don't see sign-in/sign-up pages (redirected to `/profile`)
- Session tokens are automatically refreshed before expiration

## 🧪 Part 6: Testing Authentication

### Integration Tests with Vitest

We test authentication flows with real Supabase calls:

```typescript
// tests/integration/auth/sign-up-flow.test.ts
import { describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase/client';

describe('Sign-Up Flow', () => {
  const testEmail = process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com';
  const testPassword =
    process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!';

  it('should sign in with valid credentials', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.session).toBeDefined();
    expect(data.user?.email).toBe(testEmail);
  });

  it('should reject invalid credentials', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'WrongPassword123!',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Invalid login credentials');
    expect(data.user).toBeNull();
  });
});
```

### E2E Tests with Playwright

End-to-End (E2E) tests verify the entire authentication flow in a real browser:

```typescript
// e2e/auth/sign-in.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Sign-In Flow', () => {
  test('should sign in successfully with valid credentials', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    // Fill in credentials
    await page.fill(
      'input[type="email"]',
      process.env.TEST_USER_PRIMARY_EMAIL!
    );
    await page.fill(
      'input[type="password"]',
      process.env.TEST_USER_PRIMARY_PASSWORD!
    );

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to profile
    await expect(page).toHaveURL('/profile');
    await expect(page.getByText('Account Settings')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/sign-in');

    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  });
});
```

## 💡 Part 7: What We Learned

### Lesson 1: Cookies vs localStorage

For static sites with no server-side code exchange, we use `localStorage` for session tokens with Supabase's implicit flow:

```typescript
// src/lib/supabase/client.ts
export function createClient(): SupabaseClient<Database> {
  const supabaseInstance = createSupabaseClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        // Use implicit flow for static sites (no server-side code exchange)
        flowType: 'implicit',
        // Store session in localStorage
        storage:
          typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );

  return supabaseInstance;
}
```

For server-side authentication (SSR), use `@supabase/ssr` with `httpOnly` cookies as shown in the middleware section.

### Lesson 2: Test Isolation & Cleanup

Our tests initially failed because of leftover database state. When testing rate limiting or OAuth flows, **always clean up database records in `beforeEach`**:

```typescript
beforeEach(async () => {
  // Clean up rate limit attempts
  await supabase
    .from('rate_limit_attempts')
    .delete()
    .eq('identifier', testEmail);

  // Clean up OAuth states
  await supabase
    .from('oauth_states')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
});
```

### Lesson 3: Isolate OAuth State

When running multiple OAuth tests, shared `localStorage` caused state token collisions. Solution: **use separate storage keys per test client**:

```typescript
const userAClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'test-user-a-session', // Unique per client
  },
});

const userBClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'test-user-b-session', // Different key
  },
});
```

### Lesson 4: Fail Open on Rate Errors

When the rate limit database query fails, **fail open** (allow the request) rather than **fail closed** (block everyone):

```typescript
export async function checkRateLimit(...args) {
  const { data, error } = await supabase.rpc('check_rate_limit', ...);

  if (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request rather than blocking everyone
    return { allowed: true, remaining: 5, locked_until: null };
  }

  return data;
}
```

This prevents a database outage from locking out all users.

## ✅ Conclusion: Authentication Done Right

Building production authentication isn't about copying Auth0's API. It's about understanding the security principles:

1. **Defense in Depth**: Rate limiting in PostgreSQL, RLS policies at database level, CSRF tokens for OAuth
2. **Fail Safely**: Fail open on errors, provide clear error messages, don't lock out legitimate users
3. **Test Realistically**: Integration tests with real Supabase, E2E tests in real browsers, database cleanup between tests

The result? An authentication system that ships to production, passes security audits, and users don't even notice—because it just works.

Next up: [Offline-First Payment System with Stripe and PayPal](/blog/offline-payment-system-stripe-paypal) - how we handle payments on static sites with Supabase Edge Functions.

---

**Want to see the full implementation?** Check out the [ScriptHammer GitHub repository](https://github.com/TortoiseWolfe/ScriptHammer).
