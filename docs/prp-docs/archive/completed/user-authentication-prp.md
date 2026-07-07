# PRP-016: User Authentication & Authorization

**Status**: Planning
**Priority**: P0 (Blocks production payments)
**Feature Branch**: `016-user-authentication`
**Dependencies**: PRP-015 (Payment Integration)

---

## Problem Statement

Payment system (PRP-015) has CRITICAL security vulnerabilities because user authentication is not implemented. The system currently uses a hardcoded demo user ID, which:

1. Allows authorization bypass (any user can view others' payment history)
2. Prevents tracking users across sessions
3. Makes production deployment impossible
4. Violates PCI compliance requirements

**See**: `specs/015-payment-integration/security-issues.md` for details.

---

## Solution Overview

Implement full-featured authentication system using **Supabase Auth** with:

- Email/password authentication
- Email verification
- Password reset flows
- OAuth providers (GitHub, Google)
- Protected routes
- Session management
- User profile management
- Integration with existing payment system

---

## User Stories

### Authentication

1. **As a user**, I want to sign up with email/password so I can create an account
2. **As a user**, I want to verify my email address for security
3. **As a user**, I want to sign in with my credentials to access my account
4. **As a user**, I want to sign in with GitHub/Google for convenience
5. **As a user**, I want to reset my password if I forget it
6. **As a user**, I want to sign out securely

### Authorization

7. **As a user**, I want my payments to be private (only I can see them)
8. **As a user**, I want protected routes that require login
9. **As a system**, I want to prevent unauthorized access to payment operations

### Profile Management

10. **As a user**, I want to view and edit my profile information
11. **As a user**, I want to see my account creation date and status
12. **As a user**, I want to delete my account if needed

---

## Technical Requirements

### Authentication Flow

- **Sign Up**: Email + password with validation
- **Email Verification**: Confirm email before full access
- **Sign In**: Email/password or OAuth
- **Session**: JWT stored in localStorage/cookies
- **Token Refresh**: Automatic refresh before expiration
- **Sign Out**: Clear session and redirect

### OAuth Providers

- GitHub (primary for developer audience)
- Google (wider user base)
- Extensible for future providers

### Security

- Password requirements: min 8 chars, complexity rules
- Rate limiting on auth endpoints
- CSRF protection
- Secure token storage
- Session timeout (configurable)

### Integration Points

- **Payment System**: Replace hardcoded UUID with `auth.uid()`
- **RLS Policies**: Already configured, will activate with auth
- **Protected Routes**: Payment demo, user dashboard, admin
- **User Context**: React context for auth state

---

## UI Components

### Pages

1. `/sign-up` - Registration form
2. `/sign-in` - Login form
3. `/forgot-password` - Password reset request
4. `/reset-password` - Password reset form (magic link)
5. `/verify-email` - Email verification confirmation
6. `/profile` - User profile management
7. `/account` - Account settings

### Components

1. `SignUpForm` - Email/password registration
2. `SignInForm` - Email/password login
3. `OAuthButtons` - GitHub/Google sign-in
4. `ForgotPasswordForm` - Password reset request
5. `ResetPasswordForm` - Set new password
6. `EmailVerificationNotice` - Prompt to verify email
7. `UserProfileCard` - Display user info
8. `AccountSettings` - Edit profile, change password, delete account
9. `ProtectedRoute` - HOC for auth-required routes
10. `AuthGuard` - Redirect if not authenticated

---

## Data Model

### Supabase Auth Tables (Built-in)

- `auth.users` - User accounts (already exists)
  - `id` (UUID, primary key)
  - `email` (unique)
  - `encrypted_password`
  - `email_confirmed_at`
  - `created_at`
  - `updated_at`

### Custom User Profiles (New)

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

---

## API Endpoints (Supabase Auth)

### Registration

```typescript
// Sign up with email/password
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'SecurePass123!',
  options: {
    emailRedirectTo: `${window.location.origin}/verify-email`,
  },
});
```

### Login

```typescript
// Email/password
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'SecurePass123!',
});

// OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

### Session Management

```typescript
// Get current session
const {
  data: { session },
} = await supabase.auth.getSession();

// Get current user
const {
  data: { user },
} = await supabase.auth.getUser();

// Sign out
const { error } = await supabase.auth.signOut();
```

### Password Reset

```typescript
// Request reset email
const { data, error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  { redirectTo: `${window.location.origin}/reset-password` }
);

// Update password
const { data, error } = await supabase.auth.updateUser({
  password: 'NewSecurePass123!',
});
```

---

## React Context Setup

```typescript
// contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: 'github' | 'google') => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
}

export const useAuth = () => useContext(AuthContext);
```

---

## Protected Routes Pattern

```typescript
// components/auth/ProtectedRoute.tsx
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/sign-in" replace />

  return <>{children}</>
}

// Usage
<ProtectedRoute>
  <PaymentDemoPage />
</ProtectedRoute>
```

---

## Payment System Integration

### Before (INSECURE)

```typescript
// payment-service.ts
template_user_id: '00000000-0000-0000-0000-000000000000'; // ❌ Hardcoded
```

### After (SECURE)

```typescript
// payment-service.ts
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) throw new Error('Authentication required');

template_user_id: user.id; // ✅ Real authenticated user
```

### Payment History

```typescript
// Before (VULNERABLE)
export async function getPaymentHistory(userId: string); // ❌ Accepts any userId

// After (SECURE)
export async function getPaymentHistory() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  // Use authenticated user's ID
  const userId = user.id; // ✅ Can't be spoofed
}
```

---

## Testing Requirements

### Unit Tests

- Sign up form validation
- Sign in form validation
- Password strength checker
- Email validation
- AuthContext provider
- useAuth hook

### Integration Tests

- Complete sign-up flow
- Email verification flow
- Sign-in with email/password
- Sign-in with OAuth
- Password reset flow
- Session persistence
- Protected route redirects
- Sign out clears session

### E2E Tests (Playwright)

- User registration journey
- Login and access protected page
- OAuth flow (GitHub)
- Password reset end-to-end
- Session expiration handling

---

## Security Considerations

### Password Security

- Minimum 8 characters
- Require: uppercase, lowercase, number, special char
- Check against common password lists
- Bcrypt hashing (handled by Supabase)

### Token Security

- HttpOnly cookies for refresh tokens
- Short-lived access tokens (1 hour)
- Automatic token refresh
- Revoke on sign out

### CSRF Protection

- State parameter in OAuth flow
- CSRF tokens for state-changing operations
- SameSite cookie attribute

### Rate Limiting

- Max 5 login attempts per 15 minutes
- Max 3 password reset requests per hour
- Exponential backoff on failures

---

## Environment Variables

```bash
# .env.example additions
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OAuth Providers
NEXT_PUBLIC_OAUTH_REDIRECT_URL=https://yourdomain.com/auth/callback
NEXT_PUBLIC_ENABLE_GITHUB_OAUTH=true
NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH=true

# Email Configuration (Supabase handles this)
# SMTP settings configured in Supabase dashboard
```

---

## Migration Path

### Phase 1: Core Auth (Week 1)

- [ ] Set up Supabase Auth configuration
- [ ] Create AuthContext and useAuth hook
- [ ] Build SignUpForm component
- [ ] Build SignInForm component
- [ ] Implement email/password auth
- [ ] Add email verification flow
- [ ] Create ProtectedRoute component

### Phase 2: OAuth & Features (Week 2)

- [ ] Add GitHub OAuth
- [ ] Add Google OAuth
- [ ] Implement password reset
- [ ] Build user profile page
- [ ] Add account settings
- [ ] Create auth callback handler

### Phase 3: Integration (Week 3)

- [ ] Replace hardcoded UUID in payment service
- [ ] Update getPaymentHistory() to use auth
- [ ] Add ownership checks to all payment operations
- [ ] Protect payment demo routes
- [ ] Update all tests
- [ ] Update security-issues.md (mark as FIXED)

### Phase 4: Polish & Testing

- [ ] Add loading states
- [ ] Error handling improvements
- [ ] Rate limiting
- [ ] E2E test coverage
- [ ] Documentation
- [ ] Security audit

---

## Success Criteria

- [ ] Users can sign up with email/password
- [ ] Email verification required before payment access
- [ ] Users can sign in with email/password or OAuth
- [ ] Password reset flow works end-to-end
- [ ] Protected routes redirect to sign-in
- [ ] Payment system uses real user IDs
- [ ] Authorization bypass vulnerabilities FIXED
- [ ] All tests passing (unit, integration, E2E)
- [ ] Security audit passed
- [ ] Documentation complete

---

## Risks & Mitigations

### Risk 1: OAuth Configuration Complexity

**Mitigation**: Start with email/password, add OAuth later

### Risk 2: Session Management Edge Cases

**Mitigation**: Use Supabase's built-in session handling

### Risk 3: Breaking Existing Payment Flow

**Mitigation**: Feature flag for auth, test thoroughly before merge

### Risk 4: User Experience Friction

**Mitigation**: Clear messaging, smooth onboarding, remember me option

---

## Dependencies

- Supabase project configured (✅ Already done)
- SMTP email provider (Supabase built-in or custom)
- OAuth app credentials (GitHub, Google)
- SSL certificate (GitHub Pages has this)

---

## Documentation Deliverables

1. **User Guide**: How to sign up, sign in, manage account
2. **Developer Guide**: How auth works, how to protect routes
3. **API Reference**: AuthContext, useAuth hook
4. **Security Guide**: Best practices, token handling
5. **Migration Guide**: For existing payment demo users

---

## Notes

- This PRP blocks production deployment of payment system
- Must be completed before accepting real payments
- Integrates seamlessly with existing Supabase RLS policies
- No backend code needed (Supabase handles everything)
- Static site deployment remains unchanged

---

## Related PRPs

- **PRP-015**: Payment Integration (BLOCKED by this PRP)
- **Future PRP-017**: Admin Dashboard (will use this auth system)
