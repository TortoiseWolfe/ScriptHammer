# Implementation Plan: Fix E2E Encryption Key Management

**Branch**: `032-fix-e2e-encryption` | **Date**: 2025-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/032-fix-e2e-encryption/spec.md`

## Summary

Replace the broken random-key encryption system with password-derived deterministic keys using Argon2. The current implementation stores private keys in IndexedDB which are lost on session/device change, making messages permanently unreadable. The fix derives identical key pairs from the user's password + server-stored salt, enabling cross-device message decryption.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 15, React 19, Supabase, argon2-wasm-esm (new)
**Storage**: Supabase (PostgreSQL) for salt + public key, IndexedDB removed for private keys
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Browser (PWA), all modern browsers with Web Crypto API
**Project Type**: Web application (Next.js)
**Performance Goals**: Key derivation < 500ms, decryption unaffected
**Constraints**: Argon2 memory: 64MB, no private key storage
**Scale/Scope**: All users with encrypted messages (~10-100 conversations typical)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                  | Status  | Notes                                            |
| -------------------------- | ------- | ------------------------------------------------ |
| I. Component Structure     | ✅ N/A  | Service changes only, no new UI components       |
| II. Test-First Development | ✅ PASS | Unit tests for Argon2, E2E for multi-device      |
| III. PRP Methodology       | ✅ PASS | Using SpecKit /specify → /plan → /tasks flow     |
| IV. Docker-First           | ✅ PASS | All development in Docker container              |
| V. Progressive Enhancement | ✅ PASS | Graceful degradation if keys not derived         |
| VI. Privacy & Compliance   | ✅ PASS | Private keys never stored, salt is non-sensitive |

## Project Structure

### Documentation (this feature)

```
specs/032-fix-e2e-encryption/
├── plan.md              # This file
├── research.md          # Phase 0: Current implementation analysis
├── data-model.md        # Phase 1: Schema changes
├── quickstart.md        # Phase 1: Implementation guide
├── contracts/           # Phase 1: Service interfaces
│   ├── key-derivation.ts
│   ├── key-service-updated.ts
│   └── auth-integration.ts
└── tasks.md             # Phase 2: Task breakdown (via /tasks)
```

### Source Code (repository root)

```
src/
├── lib/
│   └── messaging/
│       ├── key-derivation.ts      # NEW: Argon2 key derivation
│       ├── encryption.ts          # MODIFY: Use derived keys
│       └── __tests__/
│           └── key-derivation.test.ts  # NEW: Unit tests
├── services/
│   └── messaging/
│       ├── key-service.ts         # MODIFY: Password-based keys
│       └── message-service.ts     # MODIFY: Use derived keys
├── contexts/
│   └── AuthContext.tsx            # MODIFY: Key derivation on sign-in
└── app/
    └── (auth)/
        └── sign-in/
            └── page.tsx           # MODIFY: Pass password to context

supabase/
└── migrations/
    └── 032_add_encryption_salt.sql  # NEW: Add salt column

e2e/
└── messaging/
    └── multi-device-encryption.spec.ts  # NEW: Cross-device test
```

**Structure Decision**: Web application structure. Changes span lib (core crypto), services (business logic), contexts (auth), and app (sign-in page). No new UI components required beyond migration modal.

## Implementation Phases

### Phase 1: Core Infrastructure

1. Install `argon2-wasm-esm` dependency
2. Create `key-derivation.ts` with Argon2 → P-256 key derivation
3. Write unit tests for deterministic key generation
4. Add database migration for `encryption_salt` column

### Phase 2: Service Updates

5. Update `key-service.ts` with password-based key derivation
6. Update `message-service.ts` to use derived keys (not IndexedDB)
7. Remove auto-key-generation on missing keys
8. Handle "re-authenticate needed" state

### Phase 3: Auth Integration

9. Update sign-in flow to derive keys after auth success
10. Create re-authentication modal for page refresh
11. Update sign-out to clear derived keys from memory

### Phase 4: Migration Flow

12. Create migration detection (`needsMigration()`)
13. Create migration UI with progress indicator
14. Implement message re-encryption in transaction
15. Test migration with legacy user accounts

### Phase 5: Password Change

16. Add warning modal for password change
17. Implement old-key derivation, new-key derivation
18. Re-encrypt all messages with new key
19. Update salt and public key atomically

### Phase 6: Testing & Validation

20. E2E test: multi-device login and message reading
21. E2E test: browser close/reopen with re-authentication
22. E2E test: legacy user migration
23. E2E test: password change re-encryption

## Risk Assessment

| Risk                           | Likelihood | Impact   | Mitigation                                      |
| ------------------------------ | ---------- | -------- | ----------------------------------------------- |
| Argon2 WASM fails to load      | Low        | High     | Fallback to PBKDF2 (less secure but functional) |
| P-256 scalar out of range      | Low        | High     | Reduce mod curve order, reject zero             |
| Migration corrupts messages    | Medium     | Critical | Transaction + rollback, test thoroughly         |
| Password change race condition | Low        | Medium   | Lock UI during re-encryption                    |
| Memory leak from derived keys  | Low        | Low      | Clear keys on sign-out                          |

## Dependencies

### New

```json
{
  "argon2-wasm-esm": "^1.1.0"
}
```

### Unchanged

- `@supabase/supabase-js` - Auth and database
- `dexie` - IndexedDB (still used for message caching, NOT for private keys)

## Success Metrics

From spec:

- SC-001: User can decrypt messages on any device after correct login
- SC-002: Browser close/reopen does not break decryption (after re-auth)
- SC-003: Zero "[Message could not be decrypted]" errors with correct password
- SC-004: E2E tests pass consistently
- SC-005: Password change shows re-encryption warning

## Progress Tracking

| Phase                           | Status      | Artifacts                                |
| ------------------------------- | ----------- | ---------------------------------------- |
| Phase 0: Research               | ✅ Complete | research.md                              |
| Phase 1: Data Model & Contracts | ✅ Complete | data-model.md, contracts/, quickstart.md |
| Phase 2: Tasks                  | ⏳ Pending  | tasks.md (via /tasks command)            |

---

_Generated by SpecKit /plan command_
