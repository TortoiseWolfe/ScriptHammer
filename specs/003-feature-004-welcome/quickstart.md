# Quickstart: Welcome Message Redesign

**Feature**: 003-feature-004-welcome
**Time to implement**: ~2 hours

## Prerequisites

- Docker environment running
- Supabase project configured
- Existing messaging system working

## Cryptographic Requirements

- **Curve**: ECDH P-256 (FR-011)
- **Key Format**: JWK with `{ kty: "EC", crv: "P-256", x: "<base64url>", y: "<base64url>" }`
- **Browser Support**: Chrome 60+, Firefox 57+, Safari 11+, Edge 79+ (Web Crypto API required)

## Implementation Steps

### Step 1: Update Seed Script (30 min)

**File**: `scripts/seed-test-users.ts`

Add admin user creation with public key generation:

```typescript
// Add to TEST_USERS array or create separate admin setup
const ADMIN_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@scripthammer.com',
  username: 'scripthammer',
  displayName: 'ScriptHammer',
};

async function setupAdminUser() {
  // 1. Create auth user with fixed UUID
  // 2. Create profile
  // 3. Generate ECDH P-256 keypair
  // 4. Store public key in user_encryption_keys
  // 5. Discard private key
}
```

### Step 2: Simplify Welcome Service (45 min)

**File**: `src/services/messaging/welcome-service.ts`

Remove password derivation, use admin public key:

```typescript
// REMOVE: Password-based key derivation
// REMOVE: ADMIN_CONFIG.password
// REMOVE: initializeAdminKeys()
// REMOVE: ensureAdminKeys()

// ADD: Fetch admin public key
async getAdminPublicKey(): Promise<JsonWebKey> {
  const { data } = await supabase
    .from('user_encryption_keys')
    .select('public_key')
    .eq('user_id', ADMIN_USER_ID)
    .eq('revoked', false)
    .single();
  return data.public_key;
}

// MODIFY: sendWelcomeMessage signature
async sendWelcomeMessage(
  userId: string,
  userPrivateKey: CryptoKey,  // NEW: Pass user's private key
  userPublicKey: JsonWebKey
): Promise<SendWelcomeResult> {
  // 1. Check welcome_message_sent
  // 2. Fetch admin public key
  // 3. Import admin public key as CryptoKey
  // 4. Derive shared secret: ECDH(userPrivateKey, adminPublicKey)
  // 5. Encrypt WELCOME_MESSAGE_CONTENT
  // 6. Create conversation, insert message
  // 7. Update welcome_message_sent = true
}
```

### Step 3: Update SignInForm Call (15 min)

**File**: `src/components/auth/SignInForm/SignInForm.tsx`

Pass user's private key to welcome service:

```typescript
// BEFORE:
welcomeService.sendWelcomeMessage(userId, keyPair.publicKeyJwk);

// AFTER:
welcomeService.sendWelcomeMessage(
  userId,
  keyPair.privateKey, // CryptoKey
  keyPair.publicKeyJwk
);
```

### Step 4: Update Tests (30 min)

**File**: `src/services/messaging/welcome-service.test.ts`

- Remove tests for password derivation
- Add tests for admin public key fetching
- Update sendWelcomeMessage tests with new signature
- Add test for missing admin public key error handling

### Step 5: Update CLAUDE.md (10 min)

Add static hosting constraint documentation:

```markdown
## Static Hosting Constraint

This app is deployed to GitHub Pages (static hosting). This means:

- NO server-side API routes (`src/app/api/` won't work in production)
- NO access to non-NEXT*PUBLIC* environment variables in browser
- All server-side logic must be in Supabase (database, Edge Functions, or triggers)

When implementing features that need secrets:

- Use Supabase Vault for secure storage
- Use Edge Functions for server-side logic
- Or design client-side solutions that don't require secrets
```

## Verification

### Local Testing

```bash
# Run seed script to create admin
docker compose exec scripthammer pnpm exec tsx scripts/seed-test-users.ts

# Verify admin has public key
docker compose exec scripthammer pnpm exec tsx -e "
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  supabase.from('user_encryption_keys')
    .select('*')
    .eq('user_id', '00000000-0000-0000-0000-000000000001')
    .then(({ data }) => console.log(data));
"

# Run tests
docker compose exec scripthammer pnpm test welcome-service

# Test full flow manually
# 1. Delete test user if exists
# 2. Sign up new user
# 3. Check conversations for welcome message
```

### Production Deployment

1. Run seed script against production Supabase
2. Verify admin public key exists
3. Deploy static site to GitHub Pages
4. Sign up new user and verify welcome message appears

## Rollback

If issues arise:

1. Welcome messages simply won't send (non-blocking)
2. Users can still use app normally
3. Fix forward by correcting the implementation
