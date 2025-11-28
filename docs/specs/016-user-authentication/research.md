# Phase 0: Research & Technical Decisions

**Feature**: User Authentication & Authorization (PRP-016)
**Date**: 2025-10-05

## Research Questions

Based on Technical Context unknowns and integration requirements:

### 1. Authentication Provider Selection

**Question**: Which auth provider best supports static site deployment with Supabase backend?

**Research Findings**:

- **Supabase Auth** is already configured in the project
- Supports static export with @supabase/ssr for server-side rendering
- Built-in OAuth providers (GitHub, Google)
- Email verification and password reset out-of-the-box
- Session management with automatic token refresh

**Decision**: Use Supabase Auth (existing dependency)

**Rationale**:

- Already integrated with database and RLS policies
- No additional setup cost
- Feature-complete for all requirements (FR-001 through FR-028)
- Static export compatible

**Alternatives Considered**:

- NextAuth.js: Requires server-side runtime, incompatible with static export
- Auth0: External dependency, additional cost, complexity
- Custom JWT: Reinventing wheel, security risks, no OAuth

### 2. Session Management for Static Sites

**Question**: How to manage sessions in a statically exported Next.js app?

**Research Findings**:

- @supabase/ssr package provides SSR-compatible session handling
- Client-side: localStorage for session persistence
- Server-side: Next.js middleware validates sessions before page load
- Automatic token refresh via Supabase SDK

**Decision**: Hybrid approach with @supabase/ssr + localStorage

**Rationale**:

- Supports static export (pre-rendering + client hydration)
- SSR middleware validates tokens during request
- localStorage enables "Remember Me" functionality
- Built-in token rotation for security

**Alternatives Considered**:

- Client-only (localStorage): No SSR protection, SEO issues
- Cookies-only: Static export limitations, complex refresh logic
- SessionStorage: Loses sessions on tab close (UX issue)

### 3. Protected Route Implementation

**Question**: How to protect routes in static Next.js app with auth requirements?

**Research Findings**:

- Next.js middleware runs before page render (edge runtime)
- Can validate Supabase session and redirect
- Client-side HOC for additional protection after hydration
- Supports programmatic redirects to /sign-in

**Decision**: Dual protection (middleware + HOC)

**Rationale**:

- Middleware: Server-side protection (fast, SEO-friendly)
- HOC: Client-side fallback (progressive enhancement)
- Defense-in-depth security model
- Handles edge cases (expired tokens, network errors)

**Alternatives Considered**:

- Middleware-only: Client-side bypass risk
- HOC-only: No SSR protection, flash of unprotected content
- Route guards: Not available in App Router

### 4. OAuth Callback Handling

**Question**: How to handle OAuth callbacks in static export?

**Research Findings**:

- Supabase Auth handles OAuth redirects
- Callback URL: `/auth/callback` route handler
- Exchange code for session on client-side
- Store session in localStorage

**Decision**: Client-side callback handler with Supabase exchange

**Rationale**:

- Works with static export (client-side code exchange)
- Supabase handles provider communication
- No server runtime required
- Secure token exchange via PKCE

**Alternatives Considered**:

- Server-side callback: Requires server runtime
- Direct token storage: Security risk (token in URL)
- Popup flow: UX complexity, blocked by browsers

### 5. Rate Limiting Strategy

**Question**: How to implement rate limiting without server-side state?

**Research Findings**:

- Client-side: Track attempts in localStorage
- Server-side: Supabase Auth has built-in rate limiting
- IP-based limits enforced by Supabase Edge Functions
- Exponential backoff on retry

**Decision**: Dual-layer rate limiting (client + Supabase)

**Rationale**:

- Client-side: Immediate feedback, prevents unnecessary API calls
- Supabase: Server enforcement, prevents API abuse
- FR-017 compliance: 5 attempts per 15 minutes

**Alternatives Considered**:

- Client-only: Easily bypassed (not secure)
- Server-only: Delayed feedback, wasted API calls
- Third-party service: Additional cost, complexity

### 6. Audit Logging Implementation

**Question**: How to log all auth events for security auditing?

**Research Findings**:

- Custom logging service writes to Supabase table
- Triggered by auth state changes (onAuthStateChange)
- Captures: event type, timestamp, IP, user agent
- RLS policies restrict access to own logs

**Decision**: Custom audit logging with Supabase storage

**Rationale**:

- FR-244: Comprehensive logging requirement
- Supabase provides structured storage
- RLS ensures privacy
- Queryable for compliance reports

**Alternatives Considered**:

- Supabase Auth logs: Limited to auth events, no custom fields
- External service (Sentry): Additional cost, data sovereignty concerns
- Client-side only: Incomplete (misses server events)

### 7. Email Verification Flow

**Question**: How to handle email verification in static app?

**Research Findings**:

- Supabase sends verification email with magic link
- Link contains token, redirects to `/verify-email?token=...`
- Client-side handler validates token via Supabase API
- Updates user.email_confirmed_at timestamp

**Decision**: Magic link verification with client validation

**Rationale**:

- FR-004, FR-005: Email verification requirements
- Static export compatible
- No server-side processing needed
- Secure token validation via API

**Alternatives Considered**:

- OTP codes: Additional UI, UX friction
- Server-side verification: Requires runtime
- No verification: Security risk, compliance violation

## Technology Stack

### Core Dependencies

```json
{
  "@supabase/supabase-js": "^2.39.0",
  "@supabase/ssr": "^0.0.10",
  "react": "^19.0.0",
  "next": "^15.5.2",
  "typescript": "^5.9.0"
}
```

### Auth-Specific Libraries

```json
{
  "@supabase/auth-helpers-nextjs": "^0.8.7",
  "zod": "^3.22.4", // Form validation
  "bcryptjs": "^2.4.3" // Client-side password strength check
}
```

### Testing Libraries

```json
{
  "@testing-library/react": "^14.0.0",
  "@playwright/test": "^1.40.0",
  "vitest": "^1.0.4",
  "msw": "^2.0.0" // Mock Supabase API
}
```

## Integration Patterns

### Supabase Auth Integration

**Pattern**: React Context + Custom Hooks

```typescript
// contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// hooks/useAuth.ts
export const useAuth = () => useContext(AuthContext);
```

**Rationale**: Standard React pattern, type-safe, testable

### Protected Routes Pattern

**Pattern**: Middleware + HOC

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && protectedPath) {
    return NextResponse.redirect('/sign-in')
  }

  return response
}

// components/auth/ProtectedRoute.tsx
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/sign-in" />
  return <>{children}</>
}
```

**Rationale**: Defense-in-depth, handles SSR + CSR edge cases

### OAuth Integration Pattern

**Pattern**: Callback Route Handler

```typescript
// app/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect('/');
}
```

**Rationale**: Client-side code exchange, static export compatible

## Security Best Practices

### Password Requirements

- Minimum 8 characters (FR-003)
- Complexity: uppercase, lowercase, number, special char
- Check against common password lists (zxcvbn library)
- Client-side validation + Supabase server validation

### Token Management

- Access tokens: 1 hour expiration
- Refresh tokens: 30 days (with Remember Me)
- Automatic refresh 5 minutes before expiration
- Revoke on sign out (server-side)

### CSRF Protection

- Supabase Auth uses PKCE for OAuth (built-in CSRF protection)
- State parameter validation on OAuth callbacks
- SameSite=Lax cookies for session storage

### Rate Limiting

- Client-side: localStorage tracking
- Server-side: Supabase built-in (5 attempts per 15 min)
- Exponential backoff: 1s, 2s, 4s, 8s, 16s

### Audit Logging

- Log all auth events (sign-up, sign-in, password change, etc.)
- Store: event type, timestamp, IP, user agent
- Exclude: passwords, tokens, sensitive data
- Retention: 90 days (compliance requirement)

## Performance Optimization

### Bundle Size

- Code splitting: Auth components lazy-loaded
- Tree-shaking: Import only used Supabase functions
- Target: <20KB for auth module

### Loading States

- Skeleton screens for protected routes
- Optimistic UI for sign-in (instant redirect)
- Error boundaries for auth failures

### Caching

- Session cached in localStorage (reduces API calls)
- User profile cached (invalidate on update)
- Token refresh only when <5 min to expiration

## Accessibility Considerations

### WCAG AA Compliance

- Form labels with proper `for` attributes
- Error messages announced by screen readers
- Keyboard navigation for all auth flows
- Focus management (trap in modals)

### Mobile-First Design

- 44px minimum touch targets (WCAG AAA)
- Password visibility toggle
- Auto-complete support (email, password)
- Biometric auth (future enhancement)

## Deployment Considerations

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

### OAuth Provider Setup

**GitHub**:

1. Create OAuth App at github.com/settings/developers
2. Set callback URL: `{SUPABASE_URL}/auth/v1/callback`
3. Add Client ID/Secret to Supabase dashboard

**Google**:

1. Create OAuth 2.0 Client at console.cloud.google.com
2. Set authorized redirect URI: `{SUPABASE_URL}/auth/v1/callback`
3. Add Client ID/Secret to Supabase dashboard

### Database Migrations

```sql
-- User profiles table (custom)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users view own logs" ON auth_audit_logs
  FOR SELECT USING (auth.uid() = user_id);
```

## Success Metrics

### Functional Completeness

- All 28 functional requirements (FR-001 through FR-028) implemented
- All 5 user scenarios validated via E2E tests
- All edge cases handled per spec.md

### Performance Targets

- Auth module bundle: <20KB gzipped
- Sign-in latency: <500ms (p95)
- Token refresh: <200ms (p95)
- Page load (protected): <2s FCP

### Security Compliance

- Zero OWASP Top 10 vulnerabilities
- PCI DSS compliance (payment integration)
- GDPR compliance (data protection, right to deletion)
- SOC 2 audit trail (comprehensive logging)

### Scale Validation

- 1,000 concurrent sessions (load test)
- 100 sign-ins per minute (stress test)
- Token refresh under load (chaos test)

## Next Steps

All research questions resolved. Ready for Phase 1: Design & Contracts.

**Phase 1 will generate**:

1. data-model.md (entities, relationships, RLS policies)
2. contracts/ (OpenAPI schemas for Supabase Auth + custom endpoints)
3. quickstart.md (primary user journey validation)
4. CLAUDE.md updates (auth patterns, examples)
5. Contract tests (failing, to drive TDD implementation)
