# Implementation Plan: User Authentication & Authorization

**Branch**: `016-user-authentication` | **Date**: 2025-10-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-user-authentication/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path → ✅ COMPLETE
2. Fill Technical Context → ✅ COMPLETE
3. Fill Constitution Check → ✅ COMPLETE
4. Evaluate Constitution Check → ✅ PASS
5. Execute Phase 0 → research.md → ✅ COMPLETE
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md → ✅ COMPLETE
7. Re-evaluate Constitution Check → ✅ PASS
8. Plan Phase 2 → Task generation approach → ✅ COMPLETE
9. STOP - Ready for /tasks command → ✅ READY
```

## Summary

Implement production-ready authentication and authorization system using Supabase Auth to resolve critical security vulnerabilities in the payment system (PRP-015). The system will support email/password authentication, OAuth (GitHub/Google), email verification, password reset, session management with "Remember Me" functionality, and comprehensive security audit logging. All authentication will integrate with existing Supabase RLS policies to enforce row-level security for payment data.

**Primary Requirement**: Secure user authentication with email verification, OAuth providers, and session management that supports 100-1,000 concurrent users.

**Technical Approach**: Leverage Supabase Auth (already configured) for all authentication operations, implement React Context for client-side auth state, create protected route HOCs, and integrate with existing payment service to replace hardcoded user IDs with authenticated sessions.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20+ LTS
**Primary Dependencies**: Next.js 15.5, React 19, Supabase Auth (JS Client v2), @supabase/ssr, Tailwind CSS 4, DaisyUI
**Storage**: Supabase PostgreSQL (auth.users, user_profiles tables), localStorage for session persistence
**Testing**: Vitest, Playwright, Pa11y, React Testing Library
**Target Platform**: Static export (GitHub Pages), PWA-capable, all modern browsers
**Project Type**: Web (Next.js App Router with static export + Supabase backend)
**Performance Goals**: Lighthouse 90+, FCP <2s, TTI <3.5s, CLS <0.1
**Constraints**: Bundle <150KB first load, WCAG AA compliant, offline-capable, PCI/GDPR compliant
**Scale/Scope**: 100-1,000 concurrent authenticated sessions, comprehensive audit logging

**Additional Context**:

- Supabase project already configured with auth.users table and RLS policies
- OAuth apps must be registered with GitHub and Google
- Email delivery via Supabase built-in SMTP (with manual retry on failure)
- Session duration: 30 days with "Remember Me" checkbox, shorter default without
- Rate limiting: 5 failed login attempts per 15 minutes per email
- Token expiration: Password reset 1 hour, email verification 24 hours
- Must support static site deployment (client-side auth with SSR middleware for protected routes)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Component Structure Compliance

- [x] All components follow 5-file pattern (index, Component, test, stories, a11y)
- [x] Using `pnpm run generate:component` for new components
- [x] No manual component creation

**Components to generate**:

- SignUpForm, SignInForm, OAuthButtons, ForgotPasswordForm, ResetPasswordForm
- EmailVerificationNotice, UserProfileCard, AccountSettings
- ProtectedRoute (HOC), AuthGuard (redirect component)

### II. Test-First Development

- [x] Tests written before implementation (RED-GREEN-REFACTOR)
- [x] Minimum 25% unit test coverage
- [x] E2E tests for user workflows
- [x] Accessibility tests with Pa11y

**Test Strategy**:

- Unit tests for form validation, password strength, email format
- Integration tests for auth flows (sign-up, sign-in, password reset, OAuth)
- E2E tests for complete user journeys (registration → verification → sign-in → protected access)
- Contract tests for Supabase Auth API interactions

### III. PRP Methodology

- [x] Following PRP workflow (spec → plan → tasks → implement)
- [x] Clear success criteria defined
- [x] Tracking from inception to completion

**PRP Compliance**: This is PRP-016, following standard workflow with spec.md, plan.md (this file), tasks.md (next), and implementation tracking in PRP-STATUS.md

### IV. Docker-First Development

- [x] Docker Compose setup included
- [x] CI/CD uses containerized environments
- [x] Environment consistency maintained

**Docker Usage**: All development via `docker compose exec scripthammer`, env vars in .env for Supabase keys

### V. Progressive Enhancement

- [x] Core functionality works without JS
- [x] PWA capabilities for offline support
- [x] Accessibility features included
- [x] Mobile-first responsive design

**Enhancement Strategy**:

- Server-side session validation with @supabase/ssr
- Client-side auth state with React Context (progressive enhancement)
- Offline queue for session refresh failures
- Mobile-first forms with 44px touch targets (WCAG AAA)

### VI. Privacy & Compliance First

- [x] GDPR compliance with consent system
- [x] Analytics only after consent
- [x] Third-party services need modals
- [x] Privacy controls accessible

**Compliance**:

- OAuth requires consent modal before redirect
- Audit logs exclude passwords/credentials (metadata only)
- Account deletion cascades all user data
- Session cookies use HttpOnly, Secure, SameSite=Lax

## Project Structure

### Documentation (this feature)

```
specs/016-user-authentication/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
src/
├── app/
│   ├── sign-up/page.tsx
│   ├── sign-in/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── verify-email/page.tsx
│   ├── profile/page.tsx
│   ├── account/page.tsx
│   └── auth/callback/route.ts       # OAuth callback handler
├── components/
│   └── auth/                         # Auth components (5-file pattern each)
│       ├── SignUpForm/
│       ├── SignInForm/
│       ├── OAuthButtons/
│       ├── ForgotPasswordForm/
│       ├── ResetPasswordForm/
│       ├── EmailVerificationNotice/
│       ├── UserProfileCard/
│       ├── AccountSettings/
│       ├── ProtectedRoute/
│       └── AuthGuard/
├── contexts/
│   └── AuthContext.tsx               # Auth state management
├── hooks/
│   └── useAuth.ts                    # Auth hook
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # SSR client
│   │   └── middleware.ts             # Session validation
│   └── auth/
│       ├── password-validator.ts
│       ├── email-validator.ts
│       └── rate-limiter.ts
└── middleware.ts                     # Next.js middleware for protected routes

tests/
├── unit/
│   ├── auth/
│   │   ├── password-validator.test.ts
│   │   ├── email-validator.test.ts
│   │   └── rate-limiter.test.ts
│   └── components/auth/              # Component tests (generated)
├── integration/
│   └── auth/
│       ├── sign-up-flow.test.ts
│       ├── sign-in-flow.test.ts
│       ├── password-reset-flow.test.ts
│       └── oauth-flow.test.ts
└── e2e/
    └── auth/
        ├── user-registration.spec.ts
        ├── protected-routes.spec.ts
        └── session-persistence.spec.ts
```

**Structure Decision**: DEFAULT (single Next.js project) - Web application with client-side auth + Supabase backend via API calls

## Phase 0: Outline & Research

**Research completed** - see [research.md](./research.md)

Key decisions made:

1. **Auth Provider**: Supabase Auth (already configured, feature-complete)
2. **Session Storage**: @supabase/ssr for SSR + localStorage for client persistence
3. **State Management**: React Context (AuthContext) for global auth state
4. **Protected Routes**: Next.js middleware + ProtectedRoute HOC pattern
5. **OAuth Flow**: Supabase's built-in OAuth with callback handler
6. **Rate Limiting**: Client-side + Supabase Auth built-in protection
7. **Audit Logging**: Custom logging service integrated with Supabase

**All NEEDS CLARIFICATION resolved** via /clarify session (see spec.md Clarifications section)

## Phase 1: Design & Contracts

### 1. Data Model

**Data model completed** - see [data-model.md](./data-model.md)

Entities:

- **auth.users** (Supabase built-in): id, email, encrypted_password, email_confirmed_at, created_at, updated_at
- **user_profiles** (custom): id (FK), username, display_name, avatar_url, bio, created_at, updated_at
- **auth_audit_logs** (custom): id, user_id, event_type, event_data, ip_address, user_agent, created_at

RLS policies enforce:

- Users can only view/update their own profile
- Users can only view their own audit logs
- All payment queries automatically filtered by auth.uid()

### 2. API Contracts

**Contracts completed** - see [contracts/](./contracts/)

Generated OpenAPI schemas:

- **auth-api.yaml**: Supabase Auth endpoints (sign-up, sign-in, sign-out, password reset, email verification)
- **profile-api.yaml**: User profile CRUD operations
- **session-api.yaml**: Session management (refresh, validate, extend)

### 3. Contract Tests

**Contract tests generated** (failing as expected):

```
tests/contract/auth/
├── sign-up.contract.test.ts          # POST /auth/v1/signup
├── sign-in.contract.test.ts          # POST /auth/v1/token
├── sign-out.contract.test.ts         # POST /auth/v1/logout
├── password-reset.contract.test.ts   # POST /auth/v1/recover
└── oauth.contract.test.ts            # POST /auth/v1/authorize

tests/contract/profile/
├── get-profile.contract.test.ts      # GET /rest/v1/user_profiles
├── update-profile.contract.test.ts   # PATCH /rest/v1/user_profiles
└── delete-account.contract.test.ts   # DELETE /rest/v1/user_profiles
```

All tests currently FAIL (no implementation yet) - expected RED phase of TDD

### 4. Integration Test Scenarios

**Integration tests from user stories**:

From spec.md acceptance scenarios:

1. **New User Registration** → `tests/integration/auth/sign-up-flow.test.ts`
2. **Existing User Login** → `tests/integration/auth/sign-in-flow.test.ts`
3. **Password Reset** → `tests/integration/auth/password-reset-flow.test.ts`
4. **OAuth Authentication** → `tests/integration/auth/oauth-flow.test.ts`
5. **Protected Content Access** → `tests/integration/auth/protected-routes.test.ts`

Each test follows Given-When-Then pattern from spec scenarios

### 5. Quickstart Test

**Quickstart completed** - see [quickstart.md](./quickstart.md)

Validates primary user journey:

1. User signs up with email/password
2. Receives verification email
3. Clicks verification link
4. Signs in successfully
5. Accesses protected payment demo page
6. Views only their own payment history

Quickstart includes setup steps, test data, and expected outcomes

### 6. Agent Context Update

**CLAUDE.md updated** with:

- Supabase Auth integration patterns
- AuthContext usage examples
- Protected route implementation
- OAuth callback handling
- Session management with @supabase/ssr
- Rate limiting implementation
- Audit logging patterns

Changes kept incremental (added auth section, preserved existing content)

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

1. **Load tasks-template.md** as base structure
2. **Generate from Phase 1 artifacts**:
   - Each contract test → Task to implement contract [P]
   - Each entity → Task to create model/service [P]
   - Each integration test → Task for implementation
   - Each component → Task to generate + implement logic

3. **Task Categories**:
   - **Setup Tasks** (T001-T005): Supabase config, env vars, middleware, context
   - **Auth Service Tasks** (T006-T015): Sign-up, sign-in, OAuth, password reset, email verification
   - **Profile Service Tasks** (T016-T020): CRUD operations, RLS policies
   - **Component Tasks** (T021-T040): Generate + implement all 10 auth components
   - **Integration Tasks** (T041-T050): Payment service integration, RLS enforcement
   - **Testing Tasks** (T051-T060): E2E tests, accessibility tests, security tests
   - **Documentation Tasks** (T061-T065): User guides, API docs, troubleshooting

4. **Ordering Strategy**:
   - **TDD Order**: Contract tests → Implementation → Integration tests → E2E tests
   - **Dependency Order**:
     1. Foundation: Supabase client, middleware, context
     2. Core auth: Sign-up, sign-in, sign-out services
     3. Extended auth: OAuth, password reset, email verification
     4. Profile: User profile CRUD
     5. Components: Forms → HOCs → Pages
     6. Integration: Payment service updates, RLS enforcement
     7. Testing: E2E scenarios, security validation
   - **Parallel Execution**: Mark [P] for independent file tasks

5. **Estimated Task Count**: 60-70 numbered tasks

**Dependencies**:

- T001-T005 must complete before any other tasks (foundation)
- Component generation must precede component implementation
- Auth services must complete before payment integration
- All implementation before E2E tests

**Success Criteria** (from spec.md):

- All 28 functional requirements passing tests
- 100-1,000 concurrent sessions supported
- Comprehensive audit logging active
- Zero authorization bypass vulnerabilities
- All user scenarios validated via E2E tests

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_No constitutional violations - all patterns align with existing principles_

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |

**Justification**:

- Auth components follow 5-file pattern (compliant)
- Using Supabase Auth (existing dependency, no new complexity)
- React Context standard for auth state (Next.js best practice)
- Protected routes via middleware (framework feature)
- All patterns documented in PRP workflow

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---

_Based on Constitution v1.0.1 - See `.specify/memory/constitution.md`_
