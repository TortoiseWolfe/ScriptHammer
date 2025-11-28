# Quickstart: Fix Encryption Key Management

## Implementation Steps

### 1. Fix rotateKeys() Method

**File**: `src/services/messaging/key-service.ts`

Change signature from `rotateKeys()` to `rotateKeys(password: string)`:

```typescript
async rotateKeys(password: string): Promise<boolean> {
  // Generate new salt and derive keys from password
  const salt = this.keyDerivationService.generateSalt();
  const keyPair = await this.keyDerivationService.deriveKeyPair({
    password,
    salt,
  });

  // Insert WITH encryption_salt
  const { error: uploadError } = await (supabase as any)
    .from('user_encryption_keys')
    .insert({
      user_id: user.id,
      public_key: keyPair.publicKeyJwk,
      encryption_salt: keyPair.salt,  // REQUIRED
      device_id: null,
      expires_at: null,
      revoked: false,
    });

  // Update in-memory keys
  this.derivedKeys = keyPair;
}
```

### 2. Fix needsMigration() Method

**File**: `src/services/messaging/key-service.ts`

Check for ANY valid key, not just most recent:

```typescript
async needsMigration(): Promise<boolean> {
  // Check if ANY active key has a valid salt
  const { data: validKeys } = await (supabase as any)
    .from('user_encryption_keys')
    .select('id')
    .eq('user_id', user.id)
    .eq('revoked', false)
    .not('encryption_salt', 'is', null)
    .limit(1);

  // If user has at least one valid key, no migration needed
  if (validKeys && validKeys.length > 0) {
    return false;
  }

  // Check if user has ANY keys at all
  const { data: anyKeys } = await (supabase as any)
    .from('user_encryption_keys')
    .select('id')
    .eq('user_id', user.id)
    .eq('revoked', false)
    .limit(1);

  // Needs migration only if has keys but none have salt
  return anyKeys && anyKeys.length > 0;
}
```

### 3. Delete Legacy Script

```bash
rm scripts/generate-keys-for-user.ts
```

### 4. Handle Migration in SignInForm

**File**: `src/components/auth/SignInForm/SignInForm.tsx`

When `needsMigration()` returns true, auto-initialize new keys:

```typescript
if (needsMigration) {
  await keyManagementService.initializeKeys(password);
}
```

## Testing

1. Sign in as test@example.com / TestPassword123!
2. Verify no "Your account needs to be updated" error
3. Check database: only valid-salt keys should be non-revoked
4. Verify TypeScript compilation with new rotateKeys(password) signature
