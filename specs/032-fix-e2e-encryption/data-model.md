# Data Model: Fix E2E Encryption Key Management

**Feature**: 032-fix-e2e-encryption
**Date**: 2025-11-25

## Schema Changes

### Modified Table: `user_encryption_keys`

**Current schema:**

```sql
CREATE TABLE user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  public_key JSONB NOT NULL,
  device_id TEXT,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**New schema (migration required):**

```sql
-- Add encryption_salt column for password-derived keys
ALTER TABLE user_encryption_keys
ADD COLUMN encryption_salt TEXT;

-- Add index for salt lookups during login
CREATE INDEX idx_user_encryption_keys_salt
ON user_encryption_keys(user_id)
WHERE encryption_salt IS NOT NULL;

-- Comment explaining the column
COMMENT ON COLUMN user_encryption_keys.encryption_salt IS
'16-byte base64-encoded random salt for Argon2 key derivation. NULL indicates legacy random-generated keys requiring migration.';
```

## Entity Definitions

### UserEncryptionKey (Updated)

```typescript
interface UserEncryptionKey {
  id: string; // UUID
  user_id: string; // References user_profiles.id
  public_key: JsonWebKey; // ECDH P-256 public key (JSONB)
  encryption_salt: string | null; // Base64 Argon2 salt (NULL = legacy)
  device_id: string | null; // Reserved for future multi-device
  expires_at: string | null; // Reserved for key expiration
  revoked: boolean; // Key revocation flag
  created_at: string; // ISO timestamp
}
```

### DerivedKeyPair (New - client-side only)

```typescript
interface DerivedKeyPair {
  privateKey: CryptoKey; // ECDH P-256 private key (never stored)
  publicKey: CryptoKey; // ECDH P-256 public key
  salt: Uint8Array; // 16-byte Argon2 salt
}
```

### KeyDerivationParams (New)

```typescript
interface KeyDerivationParams {
  password: string; // User's plaintext password
  salt: Uint8Array; // 16 bytes random
  hashLength: 32; // Output length for P-256 seed
  memoryCost: 65536; // 64 MB memory (Argon2id default)
  timeCost: 3; // 3 iterations
  parallelism: 4; // 4 lanes
}
```

## Data Flow

### New User Registration

```
User creates account with password
    │
    ▼
Generate 16-byte random salt ───────────────────────────┐
    │                                                    │
    ▼                                                    │
password + salt → Argon2id → 32-byte seed               │
    │                                                    │
    ▼                                                    │
seed → P-256 private key scalar (mod curve order)       │
    │                                                    │
    ▼                                                    │
Compute public key from private key                      │
    │                                                    │
    ▼                                                    │
Store in Supabase: { public_key, encryption_salt } ◄────┘
    │
    ▼
Private key kept in memory only (never persisted)
```

### Existing User Login

```
User enters password
    │
    ▼
Fetch { public_key, encryption_salt } from Supabase
    │
    ├── encryption_salt = NULL? ──► MIGRATION FLOW
    │
    ▼
password + salt → Argon2id → 32-byte seed
    │
    ▼
seed → P-256 private key scalar
    │
    ▼
Compute public key from private key
    │
    ▼
Compare computed public key with stored public key
    │
    ├── MATCH ──► User authenticated, keys ready
    │
    └── MISMATCH ──► "Incorrect password" error
```

### Migration Flow (Legacy Users)

```
User with encryption_salt = NULL logs in
    │
    ▼
Show "Securing your messages" blocking modal
    │
    ▼
Generate new 16-byte random salt
    │
    ▼
password + salt → Argon2id → new key pair
    │
    ▼
Fetch all conversations for user
    │
    ▼
For each conversation:
    │
    ├── Get old private key from IndexedDB
    │
    ├── Get other user's public key from Supabase
    │
    ├── Derive old shared secret (old private + other public)
    │
    ├── Derive new shared secret (new private + other public)
    │
    └── Re-encrypt conversation_keys entry with new shared secret
    │
    ▼
Transaction: UPDATE user_encryption_keys
SET public_key = new_public_key, encryption_salt = salt
    │
    ▼
Delete old private key from IndexedDB
    │
    ▼
Migration complete, allow access
```

## IndexedDB Changes

### Current Schema (Dexie)

```typescript
// src/lib/messaging/database.ts
const db = new Dexie('ScriptHammerMessaging');
db.version(1).stores({
  messaging_private_keys: 'userId', // Stores JsonWebKey
  // ... other stores
});
```

### Updated Usage (No Schema Change)

The `messaging_private_keys` store will no longer be used for primary key storage. Keys are re-derived on every login. However, the store may optionally be used for:

1. **Session caching** - Cache derived key for tab persistence (optional optimization)
2. **Migration source** - Read old random keys during migration, then delete

**Post-migration:** Store can be emptied. Private keys are derived, not stored.

## RLS Policy Updates

No changes required. Existing policies allow:

- Anyone can SELECT public keys (needed for encryption)
- Users can INSERT/UPDATE their own keys
- Salt is public information (only useful with correct password)

## Migration SQL

```sql
-- Migration: 032_add_encryption_salt.sql

-- Add salt column (nullable for existing users)
ALTER TABLE user_encryption_keys
ADD COLUMN IF NOT EXISTS encryption_salt TEXT;

-- Add index for login performance
CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_salt
ON user_encryption_keys(user_id)
WHERE encryption_salt IS NOT NULL;

-- Add comment
COMMENT ON COLUMN user_encryption_keys.encryption_salt IS
'Base64-encoded 16-byte random salt for Argon2 key derivation. NULL = legacy random keys.';
```

## Validation Rules

| Field           | Validation                                              |
| --------------- | ------------------------------------------------------- |
| encryption_salt | Base64 string, exactly 24 characters (16 bytes encoded) |
| public_key      | Valid P-256 JWK with kty="EC", crv="P-256"              |
| user_id         | Must exist in user_profiles                             |
