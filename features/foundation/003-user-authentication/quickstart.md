# Quickstart: User Authentication & Authorization

**Feature**: 003-user-authentication | **Date**: 2026-01-15

## Prerequisites

- Docker and Docker Compose installed
- Supabase project created ([supabase.com](https://supabase.com))
- GitHub and Google OAuth apps registered (optional for OAuth)

## Environment Setup

### 1. Configure Environment Variables

Create `.env.local` in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Site URL (for OAuth callbacks)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. Run Database Migrations

Apply the RLS policies and tables:

```bash
# Using Supabase CLI (inside Docker)
docker compose exec app supabase db push

# Or via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Paste contents of contracts/rls-policies.sql
# 3. Run
```

### 3. Configure Supabase Auth Settings

In Supabase Dashboard → Authentication → Settings:

**Email Settings:**
- Enable email confirmations: ON
- Confirm email change: ON
- Secure email change: ON
- Token expiry (seconds): 86400 (24 hours)

**Password Settings:**
- Minimum password length: 8

**OAuth Providers (optional):**
- GitHub: Add Client ID and Secret from GitHub OAuth App
- Google: Add Client ID and Secret from Google Cloud Console

## Quick Test

### Start Development Server

```bash
docker compose up -d
docker compose exec app pnpm dev
```

### Test Sign Up Flow

```typescript
// In browser console or test file
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'Test123!@#',
  options: {
    data: {
      display_name: 'Test User'
    }
  }
})

console.log(data, error)
```

### Test Sign In Flow

```typescript
// Sign in with email/password
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'Test123!@#'
})

// Check session
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)
```

### Test OAuth Flow

```typescript
// Redirect to GitHub
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
})
```

## Component Usage

### Protected Route Wrapper

```tsx
// src/components/common/ProtectedRoute/ProtectedRoute.tsx
'use client'
import { useAuth } from '@/hooks/useAuth'
import { redirect } from 'next/navigation'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth()

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (status === 'unauthenticated') {
    redirect('/sign-in')
  }

  if (status === 'unverified') {
    redirect('/verify-email')
  }

  return <>{children}</>
}
```

### Sign In Form

```tsx
// src/components/auth/SignInForm/SignInForm.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <label>
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        Remember me
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
```

### useAuth Hook

```tsx
// src/hooks/useAuth.ts
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import type { AuthState } from '@/lib/auth/types'

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateState(session)
    })

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        updateState(session)
      }
    )

    function updateState(session: Session | null) {
      if (!session) {
        setState({ status: 'unauthenticated' })
        return
      }

      const user = session.user
      if (!user.email_confirmed_at) {
        setState({
          status: 'unverified',
          user: {
            id: user.id,
            email: user.email!,
            emailVerified: false,
            createdAt: new Date(user.created_at),
            lastSignInAt: user.last_sign_in_at
              ? new Date(user.last_sign_in_at)
              : null,
          },
        })
        return
      }

      setState({
        status: 'authenticated',
        user: {
          id: user.id,
          email: user.email!,
          emailVerified: true,
          createdAt: new Date(user.created_at),
          lastSignInAt: user.last_sign_in_at
            ? new Date(user.last_sign_in_at)
            : null,
        },
        session: {
          id: session.access_token,
          userId: user.id,
          createdAt: new Date(),
          expiresAt: new Date(session.expires_at! * 1000),
          isRememberMe: false, // Determined by expiry duration
        },
      })
    }

    return () => subscription.unsubscribe()
  }, [])

  return state
}
```

## Testing Commands

```bash
# Run all auth tests
docker compose exec app pnpm test src/components/auth

# Run E2E auth tests
docker compose exec app pnpm test:e2e tests/e2e/auth

# Run accessibility tests
docker compose exec app pnpm test:a11y tests/a11y/auth
```

## Common Issues

### "Email not confirmed" error
- Check Supabase Dashboard → Authentication → Users
- Manually confirm email for testing, or check spam folder

### OAuth callback fails
- Verify redirect URL matches Supabase OAuth settings
- Check browser console for CORS errors
- Ensure `NEXT_PUBLIC_SITE_URL` is correct

### Session not persisting
- Check browser cookies are enabled
- Verify middleware.ts is correctly configured
- Check for CORS issues with Supabase URL

## Next Steps

1. Run `/speckit.tasks` to generate task breakdown
2. Implement components following 5-file pattern
3. Write tests before implementation (TDD)
4. Run `/speckit.implement` to execute tasks
