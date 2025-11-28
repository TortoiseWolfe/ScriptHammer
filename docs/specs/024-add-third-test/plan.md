# Implementation Plan: Comprehensive E2E Test Suite for User Messaging

**Branch**: `024-add-third-test` | **Date**: 2025-11-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-add-third-test/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a third test user (test-user-b@example.com) with credentials in .env and create comprehensive E2E test suite using Playwright inside Docker to verify complete messaging workflow: sign-in → find users at /messages/connections → send friend requests → accept connections → send encrypted messages → reply → sign-out. Critical safety requirement: ALL tests must pass locally before any production push.

## Technical Context

**Language/Version**: TypeScript 5.9.2 / Next.js 15.5.2 / React 19.1.0
**Primary Dependencies**: Playwright 1.55.0, @supabase/supabase-js 2.58.0, Vitest 3.2.4
**Storage**: Supabase (PostgreSQL) - existing auth.users, user_profiles, connections, messages, conversations tables
**Testing**: Playwright for E2E (Docker-based), Vitest for unit tests
**Target Platform**: Docker containers (scripthammer service), GitHub Pages static export
**Project Type**: Single (Next.js App Router with static export)
**Performance Goals**: E2E test workflow completes in <60 seconds, user search <2s, connection acceptance <3s
**Constraints**: Tests run inside Docker (no host-based Playwright), test data cleanup required for idempotency, must verify zero-knowledge encryption (database contains only ciphertext)
**Scale/Scope**: 2 test users, 1 E2E test file, extends existing 40+ E2E tests, maintains 58% test coverage minimum

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Principle Compliance

**I. Component Structure Compliance**: ✅ PASS

- No UI components created (test-only feature)
- Existing messaging components already follow 5-file pattern

**II. Test-First Development**: ✅ PASS

- Feature IS test creation
- Implements RED-GREEN-REFACTOR cycle by writing E2E tests that initially fail, then pass after setup

**III. PRP Methodology**: ✅ PASS

- Using /specify → /clarify → /plan → /tasks → /implement workflow
- Clear success criteria defined (SC-001 through SC-010)

**IV. Docker-First Development**: ✅ PASS

- Tests MUST run inside Docker container (FR-010)
- Addresses previous failure of running tests from host

**V. Progressive Enhancement**: ✅ PASS

- Tests verify existing offline-capable messaging features
- Tests verify encryption (zero-knowledge architecture)

**VI. Privacy & Compliance First**: ✅ PASS

- Tests verify encryption (FR-014) ensures privacy
- Tests use isolated test accounts (no real user data)

### Quality Gates Status

**Build Requirements**: ✅ PASS - No build changes (test-only)
**Test Requirements**: ✅ PASS - Adds comprehensive E2E test coverage
**Performance Standards**: ✅ PASS - Tests verify performance criteria (SC-001, SC-004, SC-005)
**Accessibility Standards**: N/A - Test-only feature (existing UI already WCAG compliant)

### Gate Result: ✅ ALL GATES PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/024-add-third-test/
├── spec.md             # Feature specification (completed)
├── plan.md             # This file (/speckit.plan output)
├── research.md         # Phase 0 output (next)
├── data-model.md       # Phase 1 output (database schema for third user)
├── quickstart.md       # Phase 1 output (test execution guide)
├── contracts/          # Phase 1 output (test user API contracts)
└── tasks.md            # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Single project structure (Next.js App Router)
src/
├── app/
│   ├── messages/
│   │   └── connections/page.tsx    # Existing: user search
│   ├── conversations/page.tsx       # Existing: conversation list
│   └── sign-in/page.tsx             # Existing: authentication
├── contexts/AuthContext.tsx         # Existing: auth state
├── services/messaging/              # Existing: connection-service.ts
└── lib/supabase/client.ts           # Existing: Supabase client

e2e/
├── messaging/
│   ├── friend-requests.spec.ts                # Existing
│   ├── encrypted-messaging.spec.ts            # Existing
│   └── complete-user-workflow.spec.ts         # NEW: comprehensive test
└── auth/
    ├── user-registration.spec.ts              # Existing
    └── session-persistence.spec.ts            # Existing

supabase/
├── migrations/
│   └── seed-test-user-b.sql                   # NEW: third user seeding
└── seed-test-user.sql                         # Existing: primary user

.env                                           # UPDATE: add TEST_USER_TERTIARY_*
.env.example                                   # UPDATE: document new vars
```

**Structure Decision**: Single project (Next.js App Router). Tests extend existing `/e2e/messaging/` directory. Supabase database schema already exists (Feature 023 - User Messaging System). This feature adds test infrastructure only.

## Complexity Tracking

_No constitutional violations - section not applicable_
