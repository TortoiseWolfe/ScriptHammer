# Implementation Plan: Welcome Message Redesign

**Branch**: `003-feature-004-welcome` | **Date**: 2025-11-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-feature-004-welcome/spec.md`

## Summary

Fix critical architecture flaw where welcome messages fail on GitHub Pages (static hosting) due to client-side code trying to access server-side `TEST_USER_ADMIN_PASSWORD` env var. Redesign to use client-side encryption with pre-stored admin public key - no secrets required at runtime.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 15 with static export
**Primary Dependencies**: @supabase/supabase-js, Web Crypto API (ECDH P-256)
**Storage**: Supabase PostgreSQL (user_encryption_keys, conversations, messages tables)
**Testing**: Vitest for unit tests, Playwright for E2E
**Target Platform**: GitHub Pages (static hosting) + Supabase Cloud
**Project Type**: Web application (static frontend + BaaS)
**Performance Goals**: Welcome message delivered within 5 seconds of key initialization
**Constraints**: No server-side code (static hosting), no runtime secrets
**Scale/Scope**: Single admin user, unlimited new users

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | Status | Notes                                                       |
| ---------------------------- | ------ | ----------------------------------------------------------- |
| I. Component Structure       | N/A    | No new components - modifying existing service              |
| II. Test-First Development   | ✅     | Will update welcome-service.test.ts before implementation   |
| III. PRP Methodology         | ✅     | Following /specify → /clarify → /plan → /tasks → /implement |
| IV. Docker-First Development | ✅     | All development in Docker containers                        |
| V. Progressive Enhancement   | ✅     | Client-side encryption works offline after key init         |
| VI. Privacy & Compliance     | ✅     | E2E encryption preserved, no new data collection            |

**Gate Status**: PASSED - No violations

## Project Structure

### Documentation (this feature)

```
specs/003-feature-004-welcome/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```
src/
├── services/
│   └── messaging/
│       ├── welcome-service.ts        # MODIFY: Use admin public key
│       └── welcome-service.test.ts   # MODIFY: Update tests
├── components/
│   └── auth/
│       └── SignInForm/
│           └── SignInForm.tsx        # MODIFY: Add userPrivateKey param to sendWelcomeMessage()
└── lib/
    └── messaging/
        ├── encryption.ts             # EXISTING: ECDH encryption utils
        └── key-derivation.ts         # EXISTING: Key derivation service

scripts/
└── seed-test-users.ts                # MODIFY: Add admin user + key generation

CLAUDE.md                             # MODIFY: Add static hosting constraint docs
```

**Structure Decision**: Minimal changes to existing structure. Service layer modification only - no new components or architectural changes.

## Complexity Tracking

_No violations - table not needed_
