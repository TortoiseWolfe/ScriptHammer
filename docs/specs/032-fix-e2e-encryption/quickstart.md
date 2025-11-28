# Quickstart: Fix E2E Encryption Key Management

**Feature**: 032-fix-e2e-encryption

## Overview

This feature replaces the broken random-key encryption with password-derived deterministic keys using Argon2. Users can now decrypt messages on any device using only their password.

## Prerequisites

- Docker Compose running (`docker compose up`)
- Supabase project with existing `user_encryption_keys` table
- Understanding of current encryption flow (see `research.md`)

## Implementation Order

### Phase 1: Core Infrastructure

1. **Install Argon2 dependency**

   ```bash
   docker compose exec scripthammer pnpm add argon2-wasm-esm
   ```

2. **Create key derivation service**
   - Location: `src/lib/messaging/key-derivation.ts`
   - Implements: Argon2 → seed → P-256 key pair
   - Tests: `src/lib/messaging/__tests__/key-derivation.test.ts`

3. **Database migration**
   - Add `encryption_salt` column to `user_encryption_keys`
   - File: `supabase/migrations/032_add_encryption_salt.sql`

### Phase 2: Service Updates

4. **Update key-service.ts**
   - Replace `initializeKeys()` to use password derivation
   - Add `deriveKeys(password)` method
   - Add `needsMigration()` check
   - Add `migrateKeys()` for legacy users

5. **Update message-service.ts**
   - Remove auto-key-generation on missing keys
   - Use derived keys from KeyManagementService
   - Handle "re-authenticate" state for page refresh

### Phase 3: Auth Integration

6. **Update sign-in flow**
   - Capture password before clearing form
   - Call `keyManagementService.deriveKeys(password)` after auth success
   - Handle migration flow for legacy users

7. **Create re-authentication UI**
   - Modal for page refresh scenario
   - "Enter password to decrypt messages" prompt
   - Graceful degradation (show encrypted message count)

### Phase 4: Migration Flow

8. **Create migration UI component**
   - Blocking modal: "Securing your messages"
   - Progress indicator for re-encryption
   - Error handling with retry option

9. **Implement message re-encryption**
   - Batch processing for large message counts
   - Transaction for atomicity
   - Rollback on failure

### Phase 5: Password Change

10. **Update password change flow**
    - Warning about message re-encryption
    - Derive old key, derive new key
    - Re-encrypt all messages
    - Update salt and public key

## Key Files to Modify

| File                                        | Changes                              |
| ------------------------------------------- | ------------------------------------ |
| `src/lib/messaging/key-derivation.ts`       | NEW - Argon2 key derivation          |
| `src/lib/messaging/encryption.ts`           | Remove IndexedDB dependency for keys |
| `src/services/messaging/key-service.ts`     | Password-based key management        |
| `src/services/messaging/message-service.ts` | Use derived keys                     |
| `src/contexts/AuthContext.tsx`              | Key derivation on sign-in            |
| `src/app/(auth)/sign-in/page.tsx`           | Pass password to auth context        |
| `supabase/migrations/032_*.sql`             | Add encryption_salt column           |

## Testing Checklist

- [ ] Unit: Argon2 produces deterministic output
- [ ] Unit: Same password + salt = same key pair
- [ ] Unit: Different password = different key pair
- [ ] Integration: New user registration stores salt
- [ ] Integration: Login derives correct keys
- [ ] Integration: Wrong password detected via public key mismatch
- [ ] E2E: Login on Device A, send message, login on Device B, read message
- [ ] E2E: Close browser, reopen, re-authenticate, messages readable
- [ ] E2E: Legacy user migration completes successfully
- [ ] E2E: Password change re-encrypts all messages

## Common Pitfalls

1. **Don't persist private keys** - They must be re-derived every session
2. **Handle page refresh** - Keys are lost, need re-authentication
3. **Atomic migration** - Use transaction, rollback on any failure
4. **Password timing** - Derive keys BEFORE clearing password from form
5. **P-256 scalar range** - Argon2 output must be reduced mod curve order

## Quick Verification

After implementation, run:

```bash
# E2E test: multi-device scenario
docker compose exec scripthammer pnpm exec playwright test e2e/messaging/multi-device-encryption.spec.ts

# Unit tests: key derivation
docker compose exec scripthammer pnpm test src/lib/messaging/__tests__/key-derivation.test.ts
```

## Rollback Plan

If issues occur:

1. Revert migration: `ALTER TABLE user_encryption_keys DROP COLUMN encryption_salt;`
2. Revert code changes via git
3. Users with migrated keys will need to re-register (messages lost)

**Risk mitigation**: Test thoroughly in staging before production deployment.
