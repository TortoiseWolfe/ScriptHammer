# Research: Fix E2E Encryption Key Management

**Feature**: 032-fix-e2e-encryption
**Date**: 2025-11-25
**Status**: Complete

## Current Implementation Analysis

### Problem Summary

The current encryption implementation has a **fundamental design flaw**: private keys are stored only in browser IndexedDB and regenerated on every new session/device. This makes messages encrypted with old keys permanently unreadable.

### Existing Architecture

**Files involved:**

- `src/lib/messaging/encryption.ts` - Core encryption (ECDH P-256 + AES-GCM-256)
- `src/lib/messaging/database.ts` - IndexedDB via Dexie (stores private keys)
- `src/services/messaging/key-service.ts` - Key lifecycle management
- `src/services/messaging/message-service.ts` - Message send/receive with encryption

**Current flow:**

```
Login → Check IndexedDB for private key → If missing: generate new random key pair
                                        → Store private in IndexedDB
                                        → Upload public to Supabase
```

**Database schema (`user_encryption_keys`):**

```sql
CREATE TABLE user_encryption_keys (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  public_key JSONB NOT NULL,
  device_id TEXT,              -- unused (future multi-device)
  expires_at TIMESTAMPTZ,      -- unused
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ
);
```

### Root Cause of Failures

1. **key-service.ts:54-57** - `initializeKeys()` checks IndexedDB, generates NEW keys if missing
2. **message-service.ts:465-468** - If no private key found, calls `initializeKeys()` which creates NEW keys
3. **No salt storage** - Keys are random, not deterministic
4. **No password integration** - Keys have no relationship to user's password

### Why Messages Fail to Decrypt

When keys are regenerated:

1. New key pair has different private key
2. ECDH shared secret derivation produces different value
3. AES-GCM decryption fails with `DOMException: The operation failed`
4. Message displays `[Message could not be decrypted]`

## Solution Research

### Password-Derived Key Derivation

**Selected approach:** Argon2id (password + salt → seed → deterministic ECDH key pair)

**Why Argon2 over PBKDF2:**

- Memory-hard function resistant to GPU/ASIC attacks
- Winner of Password Hashing Competition
- Modern standard, widely adopted in security-critical applications
- Browser support via `argon2-wasm-esm` (ESM-compatible, works with Next.js/Vite)

**Package selection:** `argon2-wasm-esm`

- Works in browser without WASM file references
- ES Module exports
- Compatible with Next.js bundler

### Deterministic ECDH Key Generation

Web Crypto API's `generateKey()` is random. For deterministic keys from Argon2 output:

**Option 1 (Selected):** Use Argon2 output as seed for deterministic curve operations

- Use `crypto.subtle.importKey()` with raw bytes mapped to valid P-256 private key scalar
- Compute public key from private key mathematically

**Implementation:**

```typescript
// Argon2 produces 32 bytes
const seed = await argon2.hash(password, salt, { hashLength: 32 });

// Use seed as P-256 private key scalar (after modular reduction)
const privateKey = await crypto.subtle.importKey(
  'raw',
  seedBuffer,
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  ['deriveBits']
);
```

**Note:** P-256 requires private key to be in range [1, n-1] where n is curve order. Need to reduce seed modulo n and reject if zero.

### Salt Storage

**Decision:** Add `encryption_salt` column to `user_encryption_keys` table

**Rationale:**

- Salt is cryptographically coupled to public key
- Single query fetches both on login
- Keeps crypto data together, not mixed with profile metadata

**Salt generation:**

- 16 bytes (128 bits) random via `crypto.getRandomValues()`
- Generated once on first login, stored permanently
- Never changes unless password changes (which triggers full re-encryption)

### Migration Strategy

**Decision:** Force migration on next login

**Flow:**

1. On login, check if user has salt in `user_encryption_keys`
2. If no salt (old user): show "Securing your messages" blocking screen
3. Derive new key pair from password using Argon2
4. Re-encrypt all conversation shared secrets with new key
5. Update public key and add salt in same transaction
6. Delete old private key from IndexedDB (no longer needed)
7. Allow access

**Risk mitigation:**

- Transaction ensures atomic update
- If migration fails, user stays on old keys (no data loss)
- Migration is idempotent (can retry)

### Password Change Handling

**Decision:** Re-encrypt all messages with new key

**Flow:**

1. User initiates password change
2. Show warning: "Changing password will re-encrypt all messages"
3. On confirm: derive old key from old password, new key from new password
4. Decrypt all message shared secrets with old key
5. Re-encrypt with new key
6. Update public key and salt
7. Password change completes

**Performance consideration:**

- May take time for users with many messages
- Show progress indicator during re-encryption

## Dependencies

### New Dependencies Required

```json
{
  "argon2-wasm-esm": "^1.1.0"
}
```

### No Changes to Existing Dependencies

- Dexie (IndexedDB) - still used for caching, but NOT for private key storage
- Supabase - unchanged
- Web Crypto API - unchanged

## Security Considerations

1. **Private key never stored** - Re-derived on every login
2. **Salt is public** - Safe to store on server, only useful with correct password
3. **Memory-hard KDF** - Argon2 resistant to brute-force even with salt known
4. **ECDH unchanged** - Message encryption still uses ECDH shared secret + AES-GCM
5. **Password strength critical** - Key security now depends on password strength

## Testing Strategy

1. **Unit tests:** Argon2 → seed → key pair determinism
2. **Integration tests:** Login → derive key → decrypt old messages
3. **E2E tests:** Multi-device scenario (login Device A, send message, login Device B, read message)
4. **Migration tests:** User with old keys → force migration → verify messages readable

## References

- [argon2-wasm-esm](https://www.npmjs.com/package/argon2-wasm-esm)
- [argon2-browser](https://github.com/antelle/argon2-browser)
- [Web Crypto API - SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [ECDH P-256 Specification](https://www.rfc-editor.org/rfc/rfc6090)
