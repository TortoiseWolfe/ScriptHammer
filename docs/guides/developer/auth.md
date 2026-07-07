# Authentication Guide

Comprehensive guide to implementing authentication in ScriptHammer using Supabase Auth.

---

## Table of Contents

- [Overview](#overview)
- [Auth Flows](#auth-flows)
- [Client Setup](#client-setup)
- [Email/Password Auth](#emailpassword-auth)
- [OAuth Providers](#oauth-providers)
- [Session Management](#session-management)
- [Protected Routes](#protected-routes)
- [Password Reset](#password-reset)
- [Security Best Practices](#security-best-practices)
- [Testing Authentication](#testing-authentication)
- [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture

ScriptHammer uses Supabase Auth (GoTrue) for authentication. Since the app is a static export, all auth happens client-side with Supabase handling the backend.

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │               Next.js Static Export                      ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  ││
│  │  │  Login   │  │  Auth    │  │  Protected Pages     │  ││
│  │  │  Page    │  │  Context │  │  (Payment, Profile)  │  ││
│  │  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  ││
│  └───────┼─────────────┼───────────────────┼──────────────┘│
└──────────┼─────────────┼───────────────────┼────────────────┘
           │             │                   │
           └─────────────┼───────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Auth (GoTrue)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   JWT        │  │   Sessions   │  │   OAuth          │  │
│  │   Tokens     │  │   Storage    │  │   Providers      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                           │                                  │
│                    ┌──────┴──────┐                          │
│                    │  auth.users │                          │
│                    │   (table)   │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Supported Auth Methods

| Method         | Description               | Use Case               |
| -------------- | ------------------------- | ---------------------- |
| Email/Password | Traditional signup/signin | Primary authentication |
| GitHub OAuth   | Sign in with GitHub       | Developer users        |
| Google OAuth   | Sign in with Google       | General users          |
| Magic Link     | Passwordless email link   | Optional, simpler UX   |

### Session Configuration

| Setting          | Default             | With "Remember Me"  |
| ---------------- | ------------------- | ------------------- |
| Session duration | 7 days              | 30 days             |
| Token refresh    | Automatic           | Automatic           |
| Rate limit       | 5 attempts / 15 min | 5 attempts / 15 min |

---

## Auth Flows

### Signup Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│  Signup  │────▶│ Supabase │────▶│  Email   │
│  Visits  │     │   Form   │     │   Auth   │     │  Sent    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                        │
                      ┌─────────────────────────────────┘
                      ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│  Click   │────▶│ Account  │
│  Email   │     │  Verify  │     │ Verified │
└──────────┘     └──────────┘     └──────────┘
```

### Signin Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│  Login   │────▶│ Validate │────▶│  Create  │
│  Visits  │     │   Form   │     │  Creds   │     │ Session  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                        │               │
                                        │               ▼
                                        │         ┌──────────┐
                                        │         │  Store   │
                                        │         │  JWT     │
                                        │         └──────────┘
                                        │               │
                                  ┌─────┴─────┐        │
                                  │           │        │
                                  ▼           ▼        ▼
                            ┌─────────┐  ┌─────────┐
                            │ Success │  │ Failure │
                            │Redirect │  │  Error  │
                            └─────────┘  └─────────┘
```

### OAuth Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│  Click   │────▶│ Redirect │────▶│ Provider │
│  Visits  │     │  OAuth   │     │ to OAuth │     │  Login   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                        │
                      ┌─────────────────────────────────┘
                      ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ Callback │────▶│ Session  │
│  Returns │     │  Handle  │     │ Created  │
└──────────┘     └──────────┘     └──────────┘
```

---

## Client Setup

### Supabase Client Configuration

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Auth Context Provider

```typescript
// src/providers/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### Root Layout Integration

```typescript
// src/app/layout.tsx
import { AuthProvider } from '@/providers/AuthProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## Email/Password Auth

### Signup

```typescript
// src/lib/auth/signup.ts
import { createClient } from '@/lib/supabase/client';

interface SignupData {
  email: string;
  password: string;
  displayName?: string;
}

export async function signUp({ email, password, displayName }: SignupData) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw new AuthError(error.message, error.status);
  }

  return data;
}

class AuthError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
```

### Signup Form Component

```typescript
// src/components/auth/SignupForm/SignupForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/auth/signup';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signUp({ email, password });
      setSuccess(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="alert alert-success">
        Check your email for a verification link.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      <div className="form-control">
        <label className="label" htmlFor="email">
          <span className="label-text">Email</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input input-bordered"
          required
          autoComplete="email"
        />
      </div>

      <div className="form-control">
        <label className="label" htmlFor="password">
          <span className="label-text">Password</span>
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input input-bordered"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <label className="label">
          <span className="label-text-alt">
            Minimum 8 characters with uppercase, lowercase, number, and special character
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={loading}
      >
        {loading ? 'Creating account...' : 'Sign Up'}
      </button>
    </form>
  );
}
```

### Signin

```typescript
// src/lib/auth/signin.ts
import { createClient } from '@/lib/supabase/client';

interface SigninData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export async function signIn({ email, password, rememberMe }: SigninData) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Handle rate limiting
    if (error.message.includes('rate limit')) {
      throw new Error(
        'Too many login attempts. Please try again in 15 minutes.'
      );
    }
    throw new Error(error.message);
  }

  // Note: "Remember Me" is handled by Supabase session configuration
  // Default session is 7 days, extended sessions configured in Supabase dashboard

  return data;
}
```

### Signout

```typescript
// src/lib/auth/signout.ts
import { createClient } from '@/lib/supabase/client';

export async function signOut() {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}
```

---

## OAuth Providers

### GitHub OAuth

```typescript
// src/lib/auth/oauth.ts
import { createClient } from '@/lib/supabase/client';

export async function signInWithGitHub() {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'read:user user:email',
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
```

### Google OAuth

```typescript
// src/lib/auth/oauth.ts
export async function signInWithGoogle() {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
```

### OAuth Callback Handler

```typescript
// src/app/auth/callback/route.ts
// Note: This works during development but needs Edge Function for static export

import { createClient } from '@/lib/supabase/client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // Return to login with error
  return NextResponse.redirect(new URL('/login?error=auth', request.url));
}
```

### OAuth Callback (Static Export Version)

For static export, handle the callback client-side:

```typescript
// src/app/auth/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Handle the OAuth callback
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard');
      }
    });
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  );
}
```

### OAuth Buttons Component

```typescript
// src/components/auth/OAuthButtons/OAuthButtons.tsx
'use client';

import { useState } from 'react';
import { signInWithGitHub, signInWithGoogle } from '@/lib/auth/oauth';

export function OAuthButtons() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleGitHub = async () => {
    setLoading('github');
    try {
      await signInWithGitHub();
    } catch (error) {
      console.error('GitHub auth error:', error);
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setLoading('google');
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google auth error:', error);
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleGitHub}
        disabled={loading !== null}
        className="btn btn-outline w-full"
      >
        {loading === 'github' ? (
          <span className="loading loading-spinner"></span>
        ) : (
          <>
            <GitHubIcon className="w-5 h-5 mr-2" />
            Continue with GitHub
          </>
        )}
      </button>

      <button
        onClick={handleGoogle}
        disabled={loading !== null}
        className="btn btn-outline w-full"
      >
        {loading === 'google' ? (
          <span className="loading loading-spinner"></span>
        ) : (
          <>
            <GoogleIcon className="w-5 h-5 mr-2" />
            Continue with Google
          </>
        )}
      </button>
    </div>
  );
}
```

---

## Session Management

### Checking Auth State

```typescript
// src/hooks/useAuth.ts (already in AuthProvider)

// Usage in components:
function MyComponent() {
  const { user, session, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <LoginPrompt />;
  }

  return <AuthenticatedContent user={user} />;
}
```

### Token Refresh

Supabase handles token refresh automatically. The client checks token expiry and refreshes before it expires.

```typescript
// Manual refresh if needed
const supabase = createClient();

const { data, error } = await supabase.auth.refreshSession();
```

### Session Events

```typescript
// Listen for specific auth events
useEffect(() => {
  const supabase = createClient();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    switch (event) {
      case 'SIGNED_IN':
        console.log('User signed in:', session?.user.email);
        break;
      case 'SIGNED_OUT':
        console.log('User signed out');
        break;
      case 'TOKEN_REFRESHED':
        console.log('Token refreshed');
        break;
      case 'USER_UPDATED':
        console.log('User updated');
        break;
      case 'PASSWORD_RECOVERY':
        console.log('Password recovery initiated');
        break;
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

---

## Protected Routes

### Auth Guard Component

```typescript
// src/components/auth/AuthGuard/AuthGuard.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';

interface AuthGuardProps {
  children: React.ReactNode;
  requireVerified?: boolean;
}

export function AuthGuard({ children, requireVerified = false }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }

    if (!loading && user && requireVerified && !user.email_confirmed_at) {
      router.push('/verify-email');
    }
  }, [user, loading, router, requireVerified]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  if (requireVerified && !user.email_confirmed_at) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
```

### Using Auth Guard

```typescript
// src/app/(protected)/dashboard/page.tsx
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Dashboard } from '@/components/Dashboard';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
```

### Protected Layout

```typescript
// src/app/(protected)/layout.tsx
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requireVerified>
      <div className="min-h-screen">
        <Header />
        <main>{children}</main>
        <Footer />
      </div>
    </AuthGuard>
  );
}
```

### Email Verification Gate

```typescript
// src/components/auth/VerificationGate/VerificationGate.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';

export function VerificationGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user) return null;

  if (user.email_confirmed_at) {
    return <>{children}</>;
  }

  const handleResend = async () => {
    setResending(true);
    const supabase = createClient();

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email!,
    });

    setResending(false);
    if (!error) {
      setSent(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="card bg-base-200 w-full max-w-md">
        <div className="card-body">
          <h2 className="card-title">Verify Your Email</h2>
          <p>
            Please verify your email address to access payment features.
            Check your inbox for a verification link.
          </p>

          {sent ? (
            <div className="alert alert-success">
              Verification email sent! Check your inbox.
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="btn btn-primary"
            >
              {resending ? 'Sending...' : 'Resend Verification Email'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Password Reset

### Request Password Reset

```typescript
// src/lib/auth/password-reset.ts
import { createClient } from '@/lib/supabase/client';

export async function requestPasswordReset(email: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }
}
```

### Update Password

```typescript
// src/lib/auth/password-reset.ts
export async function updatePassword(newPassword: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
}
```

### Reset Password Page

```typescript
// src/app/auth/reset-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updatePassword } from '@/lib/auth/password-reset';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if we have a valid recovery session
    const supabase = createClient();

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);
      router.push('/login?message=password-updated');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <form onSubmit={handleSubmit} className="card bg-base-200 w-full max-w-md">
        <div className="card-body">
          <h2 className="card-title">Set New Password</h2>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-control">
            <label className="label" htmlFor="password">
              <span className="label-text">New Password</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input input-bordered"
              required
              minLength={8}
            />
          </div>

          <div className="form-control">
            <label className="label" htmlFor="confirmPassword">
              <span className="label-text">Confirm Password</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input input-bordered"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

## Security Best Practices

### Password Requirements

Enforce strong passwords:

```typescript
// src/lib/auth/validation.ts
export function validatePassword(password: string): string[] {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain a special character');
  }

  return errors;
}
```

### Rate Limiting

Supabase Auth includes built-in rate limiting. Display appropriate errors:

```typescript
// src/lib/auth/errors.ts
export function getAuthErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit')) {
    return 'Too many attempts. Please wait 15 minutes before trying again.';
  }

  if (message.includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }

  if (message.includes('email not confirmed')) {
    return 'Please verify your email before signing in.';
  }

  if (message.includes('user already registered')) {
    return 'An account with this email already exists.';
  }

  return 'An error occurred. Please try again.';
}
```

### Security Headers

Configure in `next.config.js`:

```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### Audit Logging

Log auth events for security monitoring:

```typescript
// src/lib/auth/audit.ts
import { createClient } from '@/lib/supabase/client';

export async function logAuthEvent(
  event: string,
  metadata?: Record<string, unknown>
) {
  const supabase = createClient();

  // This inserts via service role trigger, not direct insert
  // See RLS guide for audit_logs table policies
  await supabase.functions.invoke('log-auth-event', {
    body: {
      event,
      metadata,
      timestamp: new Date().toISOString(),
    },
  });
}
```

---

## Testing Authentication

### Unit Tests

```typescript
// tests/unit/auth/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validatePassword } from '@/lib/auth/validation';

describe('validatePassword', () => {
  it('rejects short passwords', () => {
    const errors = validatePassword('Ab1!');
    expect(errors).toContain('Password must be at least 8 characters');
  });

  it('requires uppercase', () => {
    const errors = validatePassword('abcd1234!');
    expect(errors).toContain('Password must contain an uppercase letter');
  });

  it('accepts valid passwords', () => {
    const errors = validatePassword('ValidPass1!');
    expect(errors).toHaveLength(0);
  });
});
```

### Integration Tests

```typescript
// tests/integration/auth/signup.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Signup Flow', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';

  it('creates account with valid credentials', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.user?.email).toBe(testEmail);
  });

  it('rejects duplicate email', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    expect(error).not.toBeNull();
  });
});
```

### E2E Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can sign up', async ({ page }) => {
    await page.goto('/signup');

    await page.fill('[name="email"]', 'newuser@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('.alert-success')).toContainText(
      'Check your email'
    );
  });

  test('user can sign in', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[name="email"]', 'existing@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
  });

  test('protected route redirects unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL('/login');
  });
});
```

---

## Troubleshooting

### Common Issues

#### "Invalid login credentials"

**Causes**:

- Wrong email or password
- Account doesn't exist
- Email not verified (for some configurations)

**Solution**: Double-check credentials, try password reset.

#### "Email not confirmed"

**Cause**: User hasn't clicked verification link.

**Solution**: Resend verification email, check spam folder.

#### OAuth redirect fails

**Causes**:

- Incorrect redirect URL in provider settings
- Mismatched URLs between dev/prod

**Solution**: Verify OAuth app settings match your domain exactly.

#### Session not persisting

**Causes**:

- Cookies blocked by browser
- Missing auth state listener
- Incorrect client initialization

**Solution**: Check browser settings, verify AuthProvider setup.

### Debug Checklist

```typescript
// Debug auth state
const supabase = createClient();

// Check current session
const {
  data: { session },
} = await supabase.auth.getSession();
console.log('Session:', session);

// Check current user
const {
  data: { user },
} = await supabase.auth.getUser();
console.log('User:', user);

// Check if email is verified
console.log('Email confirmed:', user?.email_confirmed_at);
```

---

## Quick Reference

### Auth Functions

| Function                  | Purpose                |
| ------------------------- | ---------------------- |
| `signUp()`                | Create new account     |
| `signInWithPassword()`    | Email/password login   |
| `signInWithOAuth()`       | OAuth login            |
| `signOut()`               | End session            |
| `resetPasswordForEmail()` | Send reset link        |
| `updateUser()`            | Update password/email  |
| `getSession()`            | Get current session    |
| `getUser()`               | Get current user       |
| `onAuthStateChange()`     | Listen for auth events |

### Auth Events

| Event               | Description        |
| ------------------- | ------------------ |
| `SIGNED_IN`         | User logged in     |
| `SIGNED_OUT`        | User logged out    |
| `TOKEN_REFRESHED`   | JWT refreshed      |
| `USER_UPDATED`      | User data changed  |
| `PASSWORD_RECOVERY` | Reset link clicked |

### Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# OAuth (configure in Supabase dashboard)
# GitHub: Settings > Authentication > Providers
# Google: Settings > Authentication > Providers
```

---

## Further Reading

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Auth Helpers for Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [OAuth Provider Setup](https://supabase.com/docs/guides/auth/social-login)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
