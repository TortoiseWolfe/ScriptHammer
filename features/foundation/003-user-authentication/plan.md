# Implementation Plan: User Authentication & Authorization

**Branch**: `003-user-authentication` | **Date**: 2026-01-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `features/foundation/003-user-authentication/spec.md`

## Summary

Implement a complete user authentication and authorization system using Supabase Auth with email/password registration, OAuth providers (GitHub, Google), session management with "Remember Me" functionality, and Row-Level Security (RLS) integration for payment data protection. The system supports 1,000 concurrent sessions and enforces GDPR-compliant data handling.

## Technical Context

**Language/Version**: TypeScript 5.x with React 19+ / Next.js 15+
**Primary Dependencies**: Supabase Auth (@supabase/supabase-js), Supabase SSR (@supabase/ssr), Next.js App Router
**Storage**: Supabase PostgreSQL with Row-Level Security policies
**Testing**: Vitest (unit), Playwright (E2E), Pa11y (accessibility)
**Target Platform**: Static web deployment (GitHub Pages)
**Project Type**: web (frontend with Supabase backend)
**Performance Goals**: 95% sign-in < 2s, OAuth < 10s, 1000 concurrent sessions
**Constraints**: Static export (no API routes), GDPR compliant, PCI-ready for payments
**Scale/Scope**: 100-1,000 concurrent users, 7 user stories, 33 functional requirements

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                   | Status | Notes                                                                                                |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| I. 5-file component pattern | PASS   | Auth components will use: index.tsx, Component.tsx, .test.tsx, .stories.tsx, .accessibility.test.tsx |
| II. Test-First Development  | PASS   | E2E tests for auth flows, unit tests for validation logic                                            |
| III. SpecKit Workflow       | PASS   | Currently executing /speckit.plan                                                                    |
| IV. Docker-First            | PASS   | All development in Docker containers                                                                 |
| V. Progressive Enhancement  | PASS   | Mobile-first auth forms, keyboard nav, screen reader support                                         |
| VI. Privacy First           | PASS   | GDPR compliant, explicit consent, account deletion rights (FR-027, FR-028)                           |

**Static Export Constraint**: All server-side auth logic handled by Supabase. Client uses `@supabase/ssr` for session management. No Next.js API routes.

## Project Structure

### Documentation (this feature)

```text
features/foundation/003-user-authentication/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── auth-api.yaml    # OpenAPI spec for auth endpoints
│   └── rls-policies.sql # RLS policy definitions
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── auth/
│   │   ├── SignInForm/           # 5-file pattern
│   │   ├── SignUpForm/           # 5-file pattern
│   │   ├── PasswordResetForm/    # 5-file pattern
│   │   ├── OAuthButtons/         # 5-file pattern
│   │   ├── EmailVerification/    # 5-file pattern
│   │   └── ProfileSettings/      # 5-file pattern
│   └── common/
│       └── ProtectedRoute/       # 5-file pattern
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server component client
│   │   └── middleware.ts         # Session refresh
│   └── auth/
│       ├── validation.ts         # Password/email validation
│       ├── session.ts            # Session management helpers
│       └── types.ts              # Auth type definitions
├── hooks/
│   ├── useAuth.ts                # Auth state hook
│   └── useSession.ts             # Session management hook
└── app/
    ├── (auth)/
    │   ├── sign-in/page.tsx
    │   ├── sign-up/page.tsx
    │   ├── verify-email/page.tsx
    │   ├── reset-password/page.tsx
    │   └── callback/page.tsx     # OAuth callback handler
    └── (protected)/
        ├── profile/page.tsx
        └── payments/page.tsx

tests/
├── unit/
│   └── auth/
│       ├── validation.test.ts
│       └── session.test.ts
├── e2e/
│   └── auth/
│       ├── signup.spec.ts
│       ├── signin.spec.ts
│       ├── oauth.spec.ts
│       └── password-reset.spec.ts
└── a11y/
    └── auth/
        ├── signin-form.a11y.ts
        └── signup-form.a11y.ts
```

**Structure Decision**: Web application with Next.js App Router. Auth UI components in `src/components/auth/` following 5-file pattern. Supabase client utilities in `src/lib/supabase/`. Route groups `(auth)` for public pages, `(protected)` for authenticated pages.

## Complexity Tracking

No constitution violations requiring justification. Implementation follows all 6 principles.

## Implementation Phases

### Phase 0: Research (Unknowns Resolution)

See [research.md](./research.md) for resolved unknowns:

- Supabase SSR patterns for static export
- OAuth callback handling without API routes
- Session refresh strategy for token management
- Rate limiting implementation for brute force protection

### Phase 1: Design & Contracts

See the following artifacts:

- [data-model.md](./data-model.md) - Entity definitions
- [contracts/auth-api.yaml](./contracts/auth-api.yaml) - API contract
- [contracts/rls-policies.sql](./contracts/rls-policies.sql) - RLS policies
- [quickstart.md](./quickstart.md) - Developer guide

### Phase 2: Tasks

Generated via `/speckit.tasks` command after plan approval.

## Risk Assessment

| Risk                    | Likelihood | Impact   | Mitigation                                            |
| ----------------------- | ---------- | -------- | ----------------------------------------------------- |
| OAuth provider downtime | Low        | Medium   | Fallback to email/password with clear error messaging |
| Email delivery failures | Medium     | High     | Retry mechanism, clear user feedback, resend option   |
| Session hijacking       | Low        | Critical | Secure cookies, token rotation, session revocation    |
| Brute force attacks     | Medium     | High     | Rate limiting (5 attempts/15 min), account lockout    |

## Dependencies

- Feature 000 (RLS Implementation) - Required for payment data protection
- Feature 001 (WCAG AA Compliance) - Accessibility standards for auth forms
- Feature 002 (Cookie Consent) - Must integrate with auth session cookies
