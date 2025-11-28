# Research: Fix Encryption Key Management

## Problem Statement

Users get stuck in "Your account needs to be updated" error loop when trying to unlock encrypted messages. Root cause: NULL-salt encryption keys being created by legacy code paths.

## Current Implementation Analysis

### rotateKeys() - PROBLEMATIC (key-service.ts:344-413)

```typescript
async rotateKeys(): Promise<boolean> {
  // Uses legacy encryptionService.generateKeyPair() - random keys without salt
  const keyPair = await encryptionService.generateKeyPair();

  // Inserts WITHOUT encryption_salt field
  const { error: uploadError } = await (supabase as any)
    .from('user_encryption_keys')
    .insert({
      user_id: user.id,
      public_key: publicKeyJwk,
      // MISSING: encryption_salt
      device_id: null,
      expires_at: null,
      revoked: false,
    });
}
```

**Issue**: Creates NULL-salt keys every time it's called.

### needsMigration() - FLAWED (key-service.ts:222-257)

```typescript
async needsMigration(): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('user_encryption_keys')
    .select('encryption_salt')
    .eq('user_id', user.id)
    .eq('revoked', false)
    .order('created_at', { ascending: false })
    .limit(1)  // <-- PROBLEM: Only checks MOST RECENT key
    .single();

  // Returns true if most recent key has NULL salt
  return data?.encryption_salt === null;
}
```

**Issue**: If most recent key has NULL salt, returns true even if older valid keys exist.

### initializeKeys() - CORRECT (key-service.ts:52-110)

```typescript
async initializeKeys(password: string): Promise<DerivedKeyPair> {
  const salt = this.keyDerivationService.generateSalt();
  const keyPair = await this.keyDerivationService.deriveKeyPair({
    password,
    salt,
  });

  // Correctly includes encryption_salt
  const { error: uploadError } = await (supabase as any)
    .from('user_encryption_keys')
    .insert({
      user_id: user.id,
      public_key: keyPair.publicKeyJwk,
      encryption_salt: keyPair.salt,  // Base64-encoded salt
      device_id: null,
      expires_at: null,
      revoked: false,
    });
}
```

## Database State Analysis

**test@example.com (user_id: 56b94182-07c1-46a3-9e0c-4ed380bf4078)**:

- 19 total keys
- 18 with NULL encryption_salt (legacy/broken) - now revoked
- 1 with valid salt "IJ8Fcxl+8okXMuAFLlSAKg==" (correct)

**testuser-b (user_id: 6332bdd3-7155-490c-bbdd-381dec13de20)**:

- 1 key with valid salt "AU6ZGvTM1+ZZXV0/o2L+TQ==" (correct)

## Legacy Code Paths Creating NULL-Salt Keys

1. **rotateKeys()** in key-service.ts - Primary culprit
2. **generate-keys-for-user.ts** script - Secondary source

## Solution Requirements

1. Update `rotateKeys()` to require password and use `KeyDerivationService`
2. Update `needsMigration()` to check for ANY valid key, not just most recent
3. Delete `generate-keys-for-user.ts` script
4. Handle users with ONLY NULL-salt keys: auto-initialize on sign-in
