# Research: Feature 002 - Admin Welcome Message & Email Verification

**Date**: 2025-11-28
**Branch**: `002-feature-002-admin`

## Summary

This research document captures the analysis of existing patterns and integration points for implementing Feature 002, which includes admin user setup, email verification enforcement, and welcome message delivery.

## 1. Email Verification Patterns

### Current Implementation

- **Field**: `auth.users.email_confirmed_at` (nullable timestamp)
- **Existing Component**: `EmailVerificationNotice` displays warning banner
- **Pattern**: Not currently blocking any routes - only informational

### EmailVerificationNotice Component

```typescript
// src/components/auth/EmailVerificationNotice/EmailVerificationNotice.tsx
if (!user || user.email_confirmed_at) {
  return null; // Hide if verified or no user
}
```

### Resend Pattern

```typescript
await supabase.auth.resend({ type: 'signup', email: user.email });
```

### OAuth Users

OAuth providers (Google/GitHub) verify email during sign-up. These users have `email_confirmed_at` set automatically.

## 2. Database Schema

### user_profiles Table (Current)

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Required Addition

```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS welcome_message_sent BOOLEAN NOT NULL DEFAULT FALSE;
```

### user_encryption_keys Table

```sql
CREATE TABLE user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  public_key JSONB NOT NULL,
  encryption_salt TEXT,  -- Base64 Argon2 salt
  device_id TEXT,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 3. Key Derivation Pattern

### Algorithm Stack

| Layer                | Algorithm   | Purpose                           |
| -------------------- | ----------- | --------------------------------- |
| Password Hashing     | Argon2id    | Derive 32-byte seed from password |
| Key Exchange         | ECDH P-256  | Generate asymmetric key pair      |
| Symmetric Encryption | AES-GCM-256 | Encrypt message content           |

### Argon2id Configuration

```typescript
const ARGON2_CONFIG = {
  SALT_LENGTH: 16, // bytes
  TIME_COST: 3, // iterations
  MEMORY_COST: 65536, // KB (64MB)
  PARALLELISM: 1,
  HASH_LENGTH: 32, // bytes (256 bits)
};
```

### Key Derivation Flow

1. Generate 16-byte random salt (or use stored salt)
2. Argon2id: password + salt → 32-byte seed
3. P-256: seed → private key scalar (reduced mod order)
4. P-256: private key → public key point
5. Store: public key (JWK) + salt (Base64) in database
6. Memory: private key held in singleton (never persisted)

## 4. Message Encryption Flow

### ECDH + AES-GCM Pattern

```typescript
// 1. ECDH key exchange
const sharedSecret = await crypto.subtle.deriveKey(
  { name: 'ECDH', public: recipientPublicKey },
  senderPrivateKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
);

// 2. AES-GCM encryption
const ciphertext = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: randomIV }, // 96-bit IV
  sharedSecret,
  messageBytes
);
```

### Database Storage

- `encrypted_content`: Base64 ciphertext
- `initialization_vector`: Base64 IV (96 bits)

## 5. Sign-In Integration Point

### Current Flow (SignInForm.tsx)

```typescript
// Lines 128-161
if (!hasKeys) {
  // New user: initialize keys with password
  await keyManagementService.initializeKeys(password);
} else {
  // Existing user: derive keys from password
  await keyManagementService.deriveKeys(password);
}
```

### Recommended Trigger Point

After `initializeKeys()` succeeds (new user only):

```typescript
if (!hasKeys) {
  const keyPair = await keyManagementService.initializeKeys(password);
  // NEW: Send welcome message
  const { welcomeService } = await import(
    '@/services/messaging/welcome-service'
  );
  await welcomeService.sendWelcomeMessage(user.id, keyPair.publicKeyJwk);
}
```

## 6. Admin User Strategy

### Environment Variables

```bash
TEST_USER_ADMIN_EMAIL=admin@scripthammer.com
TEST_USER_ADMIN_PASSWORD=<secure-password>
NEXT_PUBLIC_ADMIN_USER_ID=00000000-0000-0000-0000-000000000001
```

### Admin Profile (Database)

```sql
INSERT INTO user_profiles (id, username, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'scripthammer', 'ScriptHammer')
ON CONFLICT (id) DO NOTHING;
```

### Lazy Key Derivation (FR-011)

Per clarification: Admin keys derived on first welcome message send:

1. Check if admin has public key in database
2. If not: derive from env password, store public key
3. If yes: verify derived key matches (self-healing per FR-012)
4. Cache keys in WelcomeService singleton

## 7. Conversation Requirements

### RLS Considerations

Admin must be able to:

- Create conversations with any user (bypass connection requirement)
- Insert messages into any conversation they're part of

### Canonical Ordering

Conversations enforce `participant_1_id < participant_2_id`:

```typescript
const [p1, p2] = adminId < userId ? [adminId, userId] : [userId, adminId];
```

## 8. Component Patterns

### 5-File Pattern (Required)

```
MessagingGate/
├── index.tsx                       # Barrel export
├── MessagingGate.tsx              # Main component
├── MessagingGate.test.tsx         # Unit tests
├── MessagingGate.stories.tsx      # Storybook
└── MessagingGate.accessibility.test.tsx  # A11y tests
```

### Existing Reference

`src/components/auth/EmailVerificationNotice/` follows same pattern.

## 9. Key Findings

| Finding                         | Implication                           |
| ------------------------------- | ------------------------------------- |
| Email verification not enforced | Need MessagingGate to block /messages |
| OAuth emails auto-verified      | No special handling needed            |
| Admin env vars templated        | Pattern exists for admin setup        |
| Key derivation is client-side   | WelcomeService must run in browser    |
| SignInForm has key init hook    | Perfect integration point             |
| Monolithic migration            | Edit existing file with IF NOT EXISTS |

## 10. Risks & Mitigations

| Risk                    | Mitigation                               |
| ----------------------- | ---------------------------------------- |
| Admin password exposure | Never log, only read from env at runtime |
| Welcome message fails   | Non-blocking, log error, user continues  |
| Admin keys corrupted    | Self-healing re-derivation (FR-012)      |
| RLS blocks admin        | Add specific policy for admin user       |
| Duplicate messages      | Track via welcome_message_sent column    |
