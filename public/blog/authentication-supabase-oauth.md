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

- 🚦 **Server-Side Rate Limiting**: Supabase Auth enforces it where the request lands — a captcha on every password sign-in, sign-up and reset, plus per-network request ceilings
- 🔒 **OAuth CSRF Protection**: Supabase's built-in OAuth2 `state` parameter prevents session hijacking
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
import { authRateLimitMessage } from '@/lib/auth/auth-rate-limit';
import CaptchaWidget from '@/components/auth/CaptchaWidget';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Set by the Turnstile widget once the challenge is solved
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

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

      // Create user with Supabase Auth. The captcha token rides along and
      // Supabase Auth verifies it server-side, so skipping this form skips nothing.
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          captchaToken: captchaToken ?? undefined,
        },
      });

      if (error) {
        // A 429 from Supabase Auth becomes a sentence, not an error code
        alert(authRateLimitMessage(error) ?? error.message);
        return;
      }

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
      <CaptchaWidget onToken={setCaptchaToken} />
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

### 🔒 OAuth Flow with CSRF Protection

OAuth has a critical vulnerability: Cross-Site Request Forgery (CSRF) attacks. An attacker can initiate an OAuth flow and trick a victim into completing it, linking the attacker's GitHub account to the victim's app account.

💡 **The good news**: with Supabase you don't hand-roll CSRF protection. The Supabase client automatically generates a cryptographically random OAuth2 `state` parameter, ties it to the browser, and verifies it when the provider redirects back — rejecting any mismatch. That is the standard, provider-recommended OAuth CSRF defense, so a self-managed `state`-token table only duplicates (more weakly) what Supabase already does. So the entire OAuth entry point is just:

```tsx
// src/components/auth/OAuthButtons/OAuthButtons.tsx
import { supabase } from '@/lib/supabase/client';

export function OAuthButtons() {
  const handleOAuth = async (provider: 'github' | 'google') => {
    try {
      // Supabase handles CSRF protection via its built-in OAuth2 state
      // parameter — no need to manually manage state tokens.
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes:
            provider === 'github' ? 'read:user user:email' : 'email profile',
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

⚠️ **Gotcha**: a **static export** does not rule out PKCE. The code exchange is a request from the browser, not the server, so the client is configured with `flowType: 'pkce'` (see `src/lib/supabase/client.ts`). Starting sign-in stores a random verifier in this browser; the redirect back to `/auth/callback/` carries a `?code=`, and supabase-js exchanges it together with that verifier. Register your callback URL in the Supabase dashboard's redirect allow-list.

This template shipped the implicit flow until [#1255](https://github.com/TortoiseWolfe/ScriptHammer/issues/1255), on the theory that PKCE needs a server. The implicit flow puts the session itself in the URL fragment, and the client consumed it on any page, so a link carrying an attacker's session signed whoever clicked it into the attacker's account (login CSRF). Only the redirect from the provider to Supabase is protected by the OAuth `state` parameter; nothing protected the redirect from Supabase to the app. PKCE binds that second redirect to the browser that started the flow. The cost is that an emailed link has to be opened in the same browser, within five minutes of requesting it.

### OAuth Callback Handling

When the user authorizes on GitHub/Google, they're redirected back to our callback with a `?code=`. supabase-js redeems it when the page loads, and it only looks at the URL on `/auth/callback/` and `/reset-password/`, the two pages a sign-in lands on. So the callback doesn't hand-check anything; it waits for the client to reflect the authenticated session:

```tsx
// src/app/auth/callback/page.tsx (simplified)
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AuthCallbackPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Supabase handles state validation internally — no manual check needed.
    // supabase-js exchanges the ?code= with this browser's verifier and fires
    // the auth state change; we just redirect once the session is present.
    if (user) {
      // ...populate the OAuth profile (non-blocking), then:
      router.replace('/profile');
    } else {
      router.replace('/sign-in?error=oauth_failed');
    }
  }, [user, isLoading, router]);

  return <p>Completing sign-in…</p>;
}
```

## 🚦 Part 3: Rate Limiting Lives on the Auth Server

⚠️ **Critical**: a limit only counts if it runs where the request lands. Anyone can call Supabase Auth directly with your public anon key, so a check the browser runs first is advice, not protection.

### ✅ What Protects the Forms

Supabase Auth enforces two limits itself:

1. **A captcha on every password grant.** Sign-in, sign-up and password reset each carry a [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) token, and Supabase Auth verifies it on the server before doing anything else. A script that skips the form has no token, so Supabase Auth refuses it.
2. **Per-network request ceilings.** Supabase Auth caps how often one network address can call its sign-in, sign-up, reset and email endpoints, and answers with HyperText Transfer Protocol (HTTP) status 429 when a caller goes over.

The app's remaining job is to turn a 429 into a sentence a person can act on:

```typescript
// src/lib/auth/auth-rate-limit.ts
export const EMAIL_QUOTA_MESSAGE =
  'Too many emails have been sent recently. Check your inbox, or try again later.';

export const REQUEST_RATE_MESSAGE =
  'Too many attempts. Please wait a few minutes, then try again.';

// The message for a rate-limit refusal, or null for any other error
export function authRateLimitMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { status, code } = error as { status?: unknown; code?: unknown };
  const limited =
    status === 429 ||
    (typeof code === 'string' && /^over_[a-z_]+_rate_limit$/.test(code));
  if (!limited) return null;
  return code === 'over_email_send_rate_limit'
    ? EMAIL_QUOTA_MESSAGE
    : REQUEST_RATE_MESSAGE;
}
```

💡 **Why the email message stays vague**: Supabase Auth uses one code, `over_email_send_rate_limit`, for both the project's hourly email cap and the wait between two emails to the same address. On the reset form, "we emailed this address recently" would confirm the address has an account.

### ❌ The Lockout We Removed, and Why

An earlier version of this post taught a lockout of our own: a `rate_limit_attempts` table keyed on the email address, two PostgreSQL functions (`check_rate_limit` and `record_failed_attempt`), and a browser wrapper that called them before every sign-in. It looked like defense in depth. It had three defects, and we found and fixed each one in ScriptHammer:

1. **The browser consulted it, so it stopped nobody.** An attacker who called Supabase Auth directly never met the limiter. Only well-behaved users did.
2. **Anyone could use it as a weapon.** The limiter was keyed on the address being signed in to, and anyone holding the public anon key could call both functions. Five anonymous calls with your email address locked you out of sign-in for 15 minutes, and the check told anyone whether an address was under attack (issue #1245).
3. **It failed open under concurrency.** The row lock used `FOR UPDATE SKIP LOCKED`. When two requests arrived together, the second saw no row, treated itself as a first attempt, reset the count and cleared a lockout already in force. The limiter was strictest against one patient caller and absent against a burst (issue #1237).

The table still exists, but only the service role writes to it now. The contact-form and booking-lead Edge Functions use it for their own per-sender ceilings, through one atomic `consume_rate_limit` function. Brute-force protection for sign-in belongs to Supabase Auth.

📝 **The lesson for your fork**: before you build a limiter, ask who can call the thing it protects. If the answer includes "anyone with the anon key", the limit has to live on the server that answers them, and you must never key it on something an attacker can type.

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

### Client-Side Route Protection with `<ProtectedRoute>`

> 📝 **Note (updated):** an earlier version of this post documented Next.js middleware (`src/middleware.ts`) for route protection. That pattern conflicts with `output: 'export'` (the static-export config ScriptHammer uses to deploy to GitHub Pages) — Next.js logs a `Middleware cannot be used with "output: export"` warning, and the middleware silently doesn't run in production. The implementation moved to a client-side guard component; the rewrite below reflects what actually ships on scripthammer.com.

For static-site deployments, route protection happens in a **client component** that wraps the page content and checks the auth context. The protected page imports the guard and renders its content inside:

```tsx
// src/app/profile/page.tsx
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import UserProfileCard from '@/components/auth/UserProfileCard';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <UserProfileCard />
    </ProtectedRoute>
  );
}
```

The guard reads the `useAuth()` hook and either renders the children, shows a "please sign in" card, or redirects to the sign-in page with a `returnUrl`:

```tsx
// src/components/auth/ProtectedRoute/ProtectedRoute.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({
  children,
  redirectTo = '/sign-in',
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const wasAuthenticated = useRef(false);

  // Remember if this mount was ever authenticated, so a transient
  // token-refresh flip doesn't redirect the user mid-interaction.
  useEffect(() => {
    if (isAuthenticated) wasAuthenticated.current = true;
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    if (wasAuthenticated.current) return; // ignore transient flips

    const returnUrl = encodeURIComponent(pathname);
    const timer = setTimeout(() => {
      router.push(`${redirectTo}?returnUrl=${returnUrl}`);
    }, 500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, router, redirectTo, pathname]);

  if (isLoading) {
    return <span className="loading loading-spinner loading-lg" />;
  }

  if (!isAuthenticated && !wasAuthenticated.current) {
    return (
      <div className="card bg-base-100 max-w-md shadow-xl">
        <h2>Authentication Required</h2>
        <Link href={`${redirectTo}?returnUrl=${encodeURIComponent(pathname)}`}>
          Sign In
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
```

This pattern handles three things the server middleware was responsible for:

- **Unauthenticated visitors** to `/profile`, `/account`, `/payment-demo` see a "Sign In" prompt instead of the page content, and get redirected to `/sign-in?returnUrl=…`.
- **Token refreshes** that briefly flip `isAuthenticated` to false (a real Supabase behavior) are debounced by 500 ms and tracked via a `wasAuthenticated` ref, so the user isn't yanked away mid-interaction.
- **Authenticated users browsing to `/sign-in`** are redirected away via `AuthContext.signOut()`'s `window.location.href = '/'` pattern combined with the sign-in page's own auth-aware effect.

**Trade-off versus middleware:** because the check happens in the browser, the protected page's HTML and bundled JS are still served — a determined user could read them in DevTools. The actual data (which is what matters) is protected at the database level by [Row-Level Security policies](#part-4-row-level-security-rls-policies). The guard is a UX layer; **RLS is the security layer**. Defense in depth.

If you're deploying to a Node host (Vercel, your own server) where middleware does run, the original middleware pattern is a perfectly good fit — just remove `output: 'export'` from `next.config.ts` and add the middleware file back. The choice is "where does the auth check run, browser or server?" rather than "which one is correct?"

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

A static site keeps the session in the browser. We use `localStorage` (or `sessionStorage` when "Remember me" is off) with Supabase's PKCE flow:

```typescript
// src/lib/supabase/client.ts
export function createClient(): SupabaseClient<Database> {
  const supabaseInstance = createSupabaseClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        // PKCE: a sign-in link only works in the browser that asked for it
        flowType: 'pkce',
        // Store session in localStorage
        storage:
          typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        // Only the two pages a sign-in lands on redeem a code
        detectSessionInUrl: shouldDetectSessionInUrl(window.location.href),
      },
    }
  );

  return supabaseInstance;
}
```

For server-side authentication (SSR), use `@supabase/ssr` with `httpOnly` cookies as shown in the middleware section.

### Lesson 2: Test Isolation & Cleanup

Our tests initially failed because of leftover database state. When testing OAuth flows or anything else that writes rows, **always clean up database records in `beforeEach`**:

```typescript
beforeEach(async () => {
  // Service-role client: delete the rows a previous run left for this test user
  await adminClient.from('auth_audit_logs').delete().eq('user_id', testUserId);
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

### Lesson 4: Put the Limit Where the Request Lands

Our first limiter failed open on purpose: if its database call errored, the browser let the sign-in through, so an outage would not lock everyone out. That instinct is right for a convenience and wrong for a protection, and it was a sign the limiter sat in the wrong place. Moving the limit to Supabase Auth removed the question: no client-side check is left to fail, open or closed. The app's only remaining job is the one in Part 3, turning a 429 into a plain message.

## ✅ Conclusion: Authentication Done Right

Building production authentication isn't about copying Auth0's API. It's about understanding the security principles:

1. **Defense in Depth**: Captcha and rate limits enforced by Supabase Auth, RLS policies at database level, and OAuth's built-in `state` parameter against CSRF
2. **Fail Safely**: Enforce limits on the server, turn refusals into clear messages, and never key a lockout on something an attacker can type
3. **Test Realistically**: Integration tests with real Supabase, E2E tests in real browsers, database cleanup between tests

The result? An authentication system that ships to production, passes security audits, and users don't even notice—because it just works.

Next up: [Offline-First Payment System with Stripe and PayPal](/blog/offline-payment-system-stripe-paypal) - how we handle payments on static sites with Supabase Edge Functions.

---

**Want to see the full implementation?** Check out the [ScriptHammer GitHub repository](https://github.com/TortoiseWolfe/ScriptHammer).
