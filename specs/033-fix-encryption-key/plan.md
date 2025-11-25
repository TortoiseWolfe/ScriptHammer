# Implementation Plan: Fix Encryption Key Management

**Branch**: `033-fix-encryption-key` | **Date**: 2025-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/033-fix-encryption-key/spec.md`

## Summary

Fix NULL-salt encryption keys being created by legacy `rotateKeys()` method, causing users to get stuck in "Your account needs to be updated" error loop. Technical approach: update `rotateKeys()` to use password-derived keys with Argon2id, improve `needsMigration()` to find ANY valid key (not just most recent), and delete legacy scripts.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 15, React 19
**Primary Dependencies**: Supabase (auth, database), hash-wasm (Argon2id), Web Crypto API (ECDH P-256)
**Storage**: Supabase PostgreSQL (user_encryption_keys table), Memory-only for derived keys
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web (PWA), Browser with SubtleCrypto support
**Project Type**: Web application (Next.js)
**Performance Goals**: Key derivation < 500ms, no blocking UI
**Constraints**: Password-derived keys only (zero-knowledge), no IndexedDB storage for derived keys
**Scale/Scope**: Single user key management, 2 test users currently affected

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | Status | Notes                                                 |
| ---------------------------- | ------ | ----------------------------------------------------- |
| I. Component Structure       | N/A    | No new components - service-level fix                 |
| II. Test-First Development   | PASS   | Unit tests for needsMigration(), rotateKeys() changes |
| III. PRP Methodology         | PASS   | Using /specify → /plan → /tasks → /implement          |
| IV. Docker-First Development | PASS   | All dev/testing in Docker                             |
| V. Progressive Enhancement   | N/A    | Backend service fix                                   |
| VI. Privacy & Compliance     | PASS   | Zero-knowledge encryption preserved                   |

## Project Structure

### Documentation (this feature)

```
specs/033-fix-encryption-key/
├── plan.md              # This file
├── research.md          # Phase 0 output - existing code analysis
├── data-model.md        # Phase 1 output - user_encryption_keys schema
├── quickstart.md        # Phase 1 output - implementation guide
├── contracts/           # Phase 1 output - API contracts
│   └── key-service.ts   # Updated KeyManagementService interface
└── tasks.md             # Phase 2 output (via /tasks command)
```

### Source Code (repository root)

```
src/
├── services/
│   └── messaging/
│       └── key-service.ts        # KeyManagementService - PRIMARY TARGET
├── lib/
│   └── messaging/
│       └── key-derivation.ts     # KeyDerivationService - REFERENCE
├── components/
│   └── auth/
│       ├── SignInForm/           # Passes password to key initialization
│       └── ReAuthModal/          # Handles migration check
└── contexts/
    └── AuthContext.tsx           # Auth state management

scripts/
└── generate-keys-for-user.ts     # TO BE DELETED
```

**Structure Decision**: Existing web application structure. Changes confined to `src/services/messaging/key-service.ts` and deletion of `scripts/generate-keys-for-user.ts`.

## Complexity Tracking

No constitution violations - this is a bugfix within existing architecture.

## Phase 0: Research - COMPLETE

See [research.md](./research.md) for detailed analysis of:

- Current `rotateKeys()` implementation (lines 344-413)
- Current `needsMigration()` implementation (lines 222-257)
- Root cause of NULL-salt key creation
- Database state analysis

## Phase 1: Design - COMPLETE

See:

- [data-model.md](./data-model.md) - user_encryption_keys table schema
- [contracts/key-service.ts](./contracts/key-service.ts) - Updated API contract
- [quickstart.md](./quickstart.md) - Implementation guide

## Phase 2: Tasks - COMPLETE

See [tasks.md](./tasks.md) for detailed task breakdown (19 tasks across 6 phases).

Key tasks by user story:

- **US1 (P1)**: T006-T008 - Fix needsMigration(), manual verification
- **US2 (P2)**: T009-T012 - Fix rotateKeys(password), TypeScript verification
- **US3 (P3)**: T013-T015 - Delete legacy script, audit code paths
- **Setup**: T001-T003 - Branch, type-check, code review
- **Foundational**: T004-T005 - Database cleanup
- **Polish**: T016-T019 - Final verification

## Progress Tracking

| Phase             | Status   | Artifacts                                |
| ----------------- | -------- | ---------------------------------------- |
| Phase 0: Research | COMPLETE | research.md                              |
| Phase 1: Design   | COMPLETE | data-model.md, contracts/, quickstart.md |
| Phase 2: Tasks    | COMPLETE | tasks.md                                 |
| Implementation    | COMPLETE | key-service.ts updated                   |
