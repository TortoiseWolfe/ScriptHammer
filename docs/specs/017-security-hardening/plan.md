# Implementation Plan: Authentication & Payment Security Hardening

**Branch**: `017-security-hardening` | **Date**: 2025-10-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-security-hardening/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path ✅
2. Fill Technical Context ✅
3. Fill Constitution Check section ✅
4. Evaluate Constitution Check → In Progress
5. Execute Phase 0 → research.md → Pending
6. Execute Phase 1 → contracts, data-model.md, quickstart.md → Pending
7. Re-evaluate Constitution Check → Pending
8. Plan Phase 2 → Task generation approach → Pending
9. STOP - Ready for /tasks command
```

## Summary

This feature addresses critical security vulnerabilities discovered in PRP-015 (Payment Integration) and PRP-016 (User Authentication). The primary requirements are:

1. **Payment Data Isolation** (P0): Associate all payment intents with authenticated users via RLS policies
2. **OAuth CSRF Protection** (P0): Implement state parameter validation for OAuth flows
3. **Server-Side Rate Limiting** (P0): Replace client-side localStorage rate limiting with server enforcement
4. **CSRF Token Protection** (P0): Add CSRF tokens to all state-changing operations
5. **Metadata Injection Prevention** (P1): Validate payment metadata against prototype pollution
6. **Comprehensive Email Validation** (P1): Validate TLDs and warn on disposable emails
7. **Security Audit Logging** (P1): Log all auth events to audit table
8. **UX & Reliability Improvements** (P2-P3): Password strength indicators, idle timeouts, error handling

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20+ LTS
**Primary Dependencies**: Next.js 15.5, React 19, Supabase (Auth + Database), Stripe SDK, PayPal SDK
**Storage**: Supabase PostgreSQL with Row-Level Security (RLS), localStorage for non-sensitive client state
**Authentication**: Supabase Auth with email/password and OAuth (GitHub, Google)
**Testing**: Vitest (unit), Playwright (E2E), Pa11y (accessibility), React Testing Library
**Target Platform**: Static export PWA deployed to GitHub Pages
**Project Type**: web (Next.js App Router with static export + Supabase backend)
**Performance Goals**: Lighthouse 95+/96+/100/100 (current scores)
**Constraints**: Static export (no server-side rendering), offline-capable with service worker, WCAG AA compliant
**Scale/Scope**: Multi-user authentication system, payment processing with Stripe/PayPal, audit logging for compliance

**Security Standards**:

- OWASP Top 10 (2021) compliance
- GDPR audit logging requirements
- PCI DSS payment data isolation
- WCAG AA accessibility

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Component Structure Compliance

- [x] All components follow 5-file pattern (index, Component, test, stories, a11y)
  - **Status**: Existing auth components already compliant (SignInForm, SignUpForm, etc.)
  - **New Components**: Password strength indicator will use generator
- [x] Using `pnpm run generate:component` for new components
  - **Confirmed**: Generator available and documented in CLAUDE.md
- [x] No manual component creation
  - **Enforced**: CI/CD validation prevents manual creation

### II. Test-First Development

- [x] Tests written before implementation (RED-GREEN-REFACTOR)
  - **Approach**: Unit tests for validators, integration tests for auth flows, E2E for security scenarios
- [x] Minimum 25% unit test coverage
  - **Current**: 58% overall, security modules will maintain this standard
- [x] E2E tests for user workflows
  - **Required**: OAuth flow, brute force prevention, payment isolation tests
- [x] Accessibility tests with Pa11y
  - **Required**: Password strength indicator, error announcements with ARIA live regions

### III. PRP Methodology

- [x] Following PRP workflow (spec → plan → tasks → implement)
  - **Status**: Currently in /plan phase after /specify and /clarify completion
- [x] Clear success criteria defined
  - **Confirmed**: All 14 requirements have measurable acceptance criteria
- [x] Tracking from inception to completion
  - **Location**: /specs/017-security-hardening/

### IV. Docker-First Development

- [x] Docker Compose setup included
  - **Confirmed**: Existing docker-compose.yml supports development
- [x] CI/CD uses containerized environments
  - **Confirmed**: GitHub Actions runs tests in Docker
- [x] Environment consistency maintained
  - **Supabase**: Requires .env configuration for local development

### V. Progressive Enhancement

- [x] Core functionality works without JS
  - **Limitation**: Auth requires JS (Supabase client-side SDK), acceptable for security features
- [x] PWA capabilities for offline support
  - **Enhancement**: Offline payment queue already implemented in PRP-015
- [x] Accessibility features included
  - **Required**: ARIA announcements for errors (REQ-A11Y-001)
- [x] Mobile-first responsive design
  - **Confirmed**: 44px touch targets enforced per PRP-017

### VI. Privacy & Compliance First

- [x] GDPR compliance with consent system
  - **Enhancement**: Audit logging adds GDPR compliance for data access tracking
- [x] Analytics only after consent
  - **Not Applicable**: No new analytics in this feature
- [x] Third-party services need modals
  - **Not Applicable**: OAuth already has consent flows
- [x] Privacy controls accessible
  - **Enhancement**: Session timeout protects unattended devices

**Constitution Compliance**: ✅ PASS - All principles satisfied

## Progress Tracking

- [x] Initial Constitution Check - Passed 2025-10-06
- [x] Phase 0: Research - Completed 2025-10-06
- [x] Phase 1: Contracts & Data Model - Completed 2025-10-06
- [x] Phase 1: Quickstart Guide - Completed 2025-10-06
- [x] Post-Design Constitution Check - Passed (no violations)
- [ ] Phase 2: Task Generation - Ready for /tasks command

## Artifacts Generated

### Phase 0 - Research

- `research.md` - Analysis of existing systems, security issues, modification points

### Phase 1 - Design

- `data-model.md` - Database schemas, RLS policies, validation functions
- `contracts/rate-limiting.md` - Server-side rate limiting API contract
- `contracts/oauth-csrf.md` - OAuth CSRF protection API contract
- `quickstart.md` - Phase-by-phase implementation guide

## Post-Design Constitution Check

Re-evaluated constitution compliance after Phase 1 design:

### I. Component Structure Compliance ✅

- New components (PasswordStrengthIndicator) will use generator
- No manual component creation planned

### II. Test-First Development ✅

- Test files planned for all new utilities
- E2E tests for security scenarios defined
- Accessibility tests for password strength indicator

### III. PRP Methodology ✅

- Following /specify → /clarify → /plan → /tasks workflow
- Currently at end of /plan phase

### IV. Docker-First Development ✅

- All commands in quickstart.md use Docker
- Supabase migrations run in Docker environment

### V. Progressive Enhancement ✅

- Security features enhance existing functionality
- No core functionality removal

### VI. Privacy & Compliance First ✅

- Audit logging adds GDPR compliance
- Session timeout protects privacy

**Result**: ✅ No constitution violations introduced

## Phase 2: Task Generation Approach

The `/tasks` command will generate `tasks.md` by:

1. **Breaking down requirements by priority**:
   - P0 Critical (8 requirements) → 20-25 tasks
   - P1 High (4 requirements) → 10-15 tasks
   - P2 Medium (4 requirements) → 8-10 tasks
   - P3 Low (2 requirements) → 4-6 tasks

2. **Dependency ordering**:
   - Database migrations before code changes
   - Server-side utilities before client integration
   - Component updates after library changes
   - Testing after implementation

3. **Task granularity**:
   - Each task 1-4 hours of work
   - Clear acceptance criteria
   - Testable outcomes

4. **Test coverage requirements**:
   - Unit tests for validators (email, metadata, rate limiting)
   - Integration tests for auth flows (OAuth, rate limiting)
   - E2E tests for security scenarios (payment isolation, CSRF protection)
   - Accessibility tests for new components

## Ready for /tasks Command

All planning artifacts complete. Proceed with `/tasks` to generate implementation task list.
