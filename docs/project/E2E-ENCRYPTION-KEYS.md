# E2E Pre-baked Encryption Keys

## Problem

E2E tests for encrypted messaging need ECDH P-256 key pairs for each test user. Previously, keys were re-derived via Argon2id every CI run:

1. `global-setup.ts` deleted all encryption keys from the DB
2. `auth.setup.ts` navigated to `/messages`, triggered Argon2id derivation (60-180s per user)
3. Old messages became permanently undecryptable (the key that encrypted them was gone)
4. Tests polled up to 90s waiting for keys, then failed on timeouts

This made CI slow (3-9 extra minutes per shard) and fragile (keys not ready = test failure).

## Solution

Generate keys ONCE, store as a GitHub secret, inject every run.

### Architecture

```
scripts/generate-e2e-keys.ts    →  e2e-keys.json (one-time, gitignored)
e2e-keys.json                   →  GitHub secret E2E_ENCRYPTION_KEYS
                                    ↓
global-setup.ts reads secret    →  UPSERTs public_key + salt into user_encryption_keys table
auth.setup.ts reads secret      →  Injects private key into localStorage (stw_keys_{userId})
                                    ↓
Tests start with keys ready     →  No Argon2id, no polling, no timeouts
```

### Key format (per user)

```typescript
{
  email: "e2e-s1-primary@mailinator.com",
  // Stored in Supabase user_encryption_keys table
  db: {
    public_key: { kty: "EC", crv: "P-256", x: "...", y: "..." },
    encryption_salt: "base64-encoded-16-byte-salt"
  },
  // Stored in browser localStorage as stw_keys_{userId}
  localStorage: {
    privateKeyJwk: { kty: "EC", crv: "P-256", x: "...", y: "...", d: "..." },
    publicKeyJwk: { kty: "EC", crv: "P-256", x: "...", y: "..." },
    salt: "base64-encoded-16-byte-salt"
  }
}
```

The GitHub secret contains all shard users (6 shards × 3 roles = 18 users) in one JSON blob, keyed by email.

### Setup

```bash
# Generate keys (one-time)
docker compose exec app npx tsx scripts/generate-e2e-keys.ts > e2e-keys.json

# Store as GitHub secret
gh secret set E2E_ENCRYPTION_KEYS < e2e-keys.json
```

### How it works

**global-setup.ts** reads `E2E_ENCRYPTION_KEYS` env var → for each shard user, UPSERTs the pre-baked public key + salt into `user_encryption_keys`. No deletion, no re-derivation.

**auth.setup.ts** reads the same env var → after logging in each user, injects the pre-baked private key into localStorage via `page.evaluate()`. The app sees `stw_keys_{userId}` and skips the ReAuth modal entirely.

**Fallback**: When `E2E_ENCRYPTION_KEYS` is not set (local dev), both files fall back to the old browser-based Argon2id derivation.

### Why WebCrypto, not @noble/curves

Keys are generated using Node.js `crypto.subtle.generateKey('ECDH', 'P-256')` which produces JWK format identical to browser WebCrypto. The `@noble/curves` library produces keys in a different internal format that Firefox WebCrypto rejects with `KeyMismatchError`.

### Shard users

Each Playwright shard gets unique test users to prevent cross-shard data conflicts:

```
Shard 1: e2e-s1-primary, e2e-s1-secondary, e2e-s1-tertiary
Shard 2: e2e-s2-primary, e2e-s2-secondary, e2e-s2-tertiary
...
Shard 6: e2e-s6-primary, e2e-s6-secondary, e2e-s6-tertiary
```

Password is shared (from `TEST_USER_PRIMARY_PASSWORD` env var). Keys are unique per user.

### Files

| File                               | Role                        |
| ---------------------------------- | --------------------------- |
| `scripts/generate-e2e-keys.ts`     | One-time key generation     |
| `tests/e2e/utils/prebaked-keys.ts` | Reads keys from env var     |
| `tests/e2e/utils/shard-users.ts`   | Per-shard user email helper |
| `tests/e2e/global-setup.ts`        | Upserts DB keys             |
| `tests/e2e/auth.setup.ts`          | Injects localStorage keys   |
| `.github/workflows/e2e.yml`        | Passes secret to test jobs  |

### Regenerating keys

If you need new keys (e.g., adding more shards):

```bash
docker compose exec app npx tsx scripts/generate-e2e-keys.ts > e2e-keys.json
gh secret set E2E_ENCRYPTION_KEYS < e2e-keys.json
```

Old messages encrypted with previous keys will be undecryptable. Run a cleanup or delete test messages first.
