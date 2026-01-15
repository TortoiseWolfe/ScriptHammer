# Quickstart: User Authentication & Authorization

**Feature**: 003-user-authentication
**Author**: Developer Terminal
**Setup Time**: ~20 minutes

## Prerequisites

### Supabase Project

1. Active Supabase project (any tier)
2. Feature 000 (RLS Implementation) completed
3. OAuth apps registered (GitHub, Google)

### Environment Variables

Create `.env.local` (not committed):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### OAuth Configuration

**GitHub OAuth App** (github.com/settings/developers):
- Homepage URL: `https://your-domain.com`
- Callback URL: `https://your-project.supabase.co/auth/v1/callback`

**Google OAuth** (console.cloud.google.com):
- Authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`

---

## Quick Setup

### Step 1: Apply Database Migration

Execute in Supabase Dashboard > SQL Editor:

```sql
-- Login attempt tracking for rate limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE,
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
ON login_attempts(email, attempted_at DESC);

-- Rate limit check function
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

### Step 2: Configure Supabase Auth

In Supabase Dashboard > Authentication > Settings:

| Setting | Value |
|---------|-------|
| Email confirmations | Enabled |
| Secure email change | Enabled |
| JWT expiry | 604800 (7 days default) |
| Password min length | 8 |

In Authentication > Providers:
- Enable GitHub, add Client ID and Secret
- Enable Google, add Client ID and Secret

### Step 3: Install Dependencies

```bash
docker compose exec app pnpm add @supabase/ssr @supabase/supabase-js zod
```

### Step 4: Create Supabase Clients

Already exist from Feature 000:
- `src/lib/supabase/client.ts` - Browser client
- `src/lib/supabase/server.ts` - Server client
- `src/lib/supabase/middleware.ts` - Session refresh

---

## Key File Locations

### Source Code

| Path | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/middleware.ts` | Token refresh middleware |
| `src/lib/auth/validation.ts` | Password/email validation (Zod) |
| `src/components/auth/` | Auth form components (5-file pattern) |
| `src/app/(auth)/` | Public auth pages (sign-in, sign-up, etc.) |
| `src/app/(protected)/` | Protected pages (profile, payments) |
| `src/hooks/useAuth.ts` | Auth state hook |

### Tests

| Path | Purpose |
|------|---------|
| `tests/unit/auth/` | Unit tests (validation, session) |
| `tests/e2e/auth/` | E2E tests (signup, signin, oauth) |
| `tests/a11y/auth/` | Accessibility tests (Pa11y) |

### Documentation

| Path | Purpose |
|------|---------|
| `features/foundation/003-user-authentication/spec.md` | Feature specification |
| `features/foundation/003-user-authentication/plan.md` | Implementation plan |
| `features/foundation/003-user-authentication/research.md` | Technical decisions |
| `features/foundation/003-user-authentication/data-model.md` | Entity definitions |

---

## Testing Commands

```bash
# Unit tests
docker compose exec app pnpm test -- tests/unit/auth/

# E2E tests (requires dev server)
docker compose exec app pnpm test:e2e -- tests/e2e/auth/

# Accessibility tests
docker compose exec app pnpm test:a11y -- tests/a11y/auth/

# All auth tests
docker compose exec app pnpm test -- --grep "auth"
```

---

## Verification Queries

Run in Supabase SQL Editor to verify setup:

```sql
-- Check login_attempts table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'login_attempts'
);

-- Check rate limit function exists
SELECT EXISTS (
  SELECT FROM pg_proc
  WHERE proname = 'check_login_rate_limit'
);

-- Verify profiles table has RLS (from Feature 000)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';
```

---

## Common Issues

### "Invalid login credentials"

- Verify email is confirmed (check `auth.users` table)
- Check password meets requirements (8+ chars, mixed case, number, special)
- Verify rate limit not exceeded (check `login_attempts` table)

### OAuth "Callback URL mismatch"

- Verify callback URL in OAuth app matches: `https://your-project.supabase.co/auth/v1/callback`
- Check redirect URL in Supabase Auth settings

### "Session expired" on protected routes

- Middleware not running: check `src/middleware.ts` exports correctly
- Cookie not set: verify `@supabase/ssr` is installed
- Token refresh failed: check Supabase project is not paused

### Email verification not received

- Check spam folder
- Verify SMTP settings in Supabase (Dashboard > Settings > Auth)
- Check email template exists (Dashboard > Authentication > Email Templates)

### Rate limiting not working

- Verify `login_attempts` table exists
- Check `check_login_rate_limit` function is created
- Ensure function is called before sign-in attempt

---

## User Story Quick Tests

| Story | Manual Test |
|-------|-------------|
| US1 - Registration | Sign up with email → Check inbox → Click verify → Sign in |
| US2 - Sign In | Sign in with credentials → Verify dashboard access |
| US3 - Password Reset | Click forgot password → Check email → Reset → Sign in |
| US4 - OAuth | Click GitHub/Google → Authorize → Verify redirect |
| US5 - Protected Routes | Sign out → Access /payments → Verify redirect to sign-in |
| US6 - Profile | Sign in → View profile → Update display name |
| US7 - Unverified | Create account → Skip verify → Access /payments → See verify prompt |

---

## Next Steps

After setup verification:

1. Run `/speckit.tasks 003-user-authentication` to generate task list
2. Implement auth components following 5-file pattern
3. Run test suite after each component
4. Proceed to Feature 024 (Payment Integration) after auth complete
