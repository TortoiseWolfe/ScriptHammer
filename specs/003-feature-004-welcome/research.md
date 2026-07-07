# Research: Welcome Message Redesign

**Feature**: 003-feature-004-welcome
**Date**: 2025-11-28

## Research Questions

### RQ-001: How to handle ECDH encryption without server-side code?

**Context**: PostgreSQL cannot perform ECDH P-256 key derivation. GitHub Pages is static-only.

**Decision**: Client-side pre-generation using admin's public key

**Rationale**:

- ECDH shared secrets are symmetric: `ECDH(user_private, admin_public) = ECDH(admin_private, user_public)`
- User can encrypt a message "from" admin using their own private key + admin's public key
- User can decrypt the same message because they derived the same shared secret
- No admin private key or password needed at runtime

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Supabase Edge Function | Adds complexity, requires Deno runtime knowledge |
| PostgreSQL trigger + Vault | PostgreSQL lacks ECDH/P-256 support |
| Unencrypted welcome message | Breaks E2E encryption model |

---

### RQ-002: How to generate and store admin public key?

**Context**: Admin must have a public key in `user_encryption_keys` for clients to fetch.

**Decision**: Add to `scripts/seed-test-users.ts` with full admin setup

**Rationale**:

- Seed script already handles test user creation
- Keeps related setup logic together
- Can run idempotently on each deployment
- Creates auth user + profile + encryption keys in one place

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Manual SQL insert | Error-prone, not repeatable |
| Dedicated setup script | Fragments admin setup across multiple files |
| Hardcoded public key constant | Less flexible, can't regenerate if compromised |

---

### RQ-003: How to handle existing users without welcome messages?

**Context**: Users who signed up before fix deployment never received welcome messages.

**Decision**: Delete all users and start fresh (clean slate)

**Rationale**:

- App is in early development, no production users to preserve
- Eliminates migration complexity
- Ensures all users have consistent experience
- Simplifies testing and verification

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Migration script | Adds complexity for early-stage app |
| Backfill on next sign-in | Complicates sign-in flow |
| No backfill | Inconsistent user experience |

---

### RQ-004: Admin user creation strategy?

**Context**: Seed script needs to ensure admin exists before generating keys.

**Decision**: Full admin setup in seed script (auth user + profile + keys)

**Rationale**:

- Single script handles all admin setup
- Idempotent - safe to run multiple times
- Can be used for both local dev and production setup
- Admin ID is deterministic (`00000000-0000-0000-0000-000000000001`)

**Implementation Notes**:

1. Check if admin auth user exists by email
2. Create auth user with fixed UUID if missing
3. Create profile with username `scripthammer` if missing
4. Generate ECDH P-256 keypair using Web Crypto API
5. Store public key in `user_encryption_keys`
6. Discard private key (not needed for welcome messages)

---

## Existing Code Analysis

### Current welcome-service.ts Flow

```typescript
// CURRENT (broken on static hosting):
1. Check TEST_USER_ADMIN_PASSWORD env var (undefined in browser!)
2. Derive admin keys from password
3. Create conversation
4. Encrypt with admin's private key
5. Insert message
```

### New welcome-service.ts Flow

```typescript
// NEW (works on static hosting):
1. Check welcome_message_sent flag
2. Fetch admin's PUBLIC key from user_encryption_keys
3. Derive shared secret: ECDH(user_private, admin_public)
4. Encrypt WELCOME_MESSAGE_CONTENT constant
5. Create conversation (canonical ordering)
6. Insert message with sender_id = admin
7. Update welcome_message_sent = true
```

### Key Insight: ECDH Symmetry

The ECDH shared secret is identical regardless of which party computes it:

- Admin computes: `sharedSecret = ECDH(admin_private, user_public)`
- User computes: `sharedSecret = ECDH(user_private, admin_public)`
- Both get the same value!

This means the user can encrypt a message that appears to be "from" admin, and both parties can decrypt it.

---

## Dependencies Verified

| Dependency            | Version        | Status       |
| --------------------- | -------------- | ------------ |
| Web Crypto API        | Browser native | ✅ Available |
| @supabase/supabase-js | 2.x            | ✅ Installed |
| ECDH P-256            | Browser native | ✅ Supported |
| AES-GCM               | Browser native | ✅ Supported |

---

## Risk Assessment

| Risk                           | Likelihood | Impact | Mitigation                                 |
| ------------------------------ | ---------- | ------ | ------------------------------------------ |
| Admin public key missing       | Low        | High   | Seed script runs before app usage          |
| User skips key initialization  | Low        | Medium | Welcome message only sent after keys exist |
| Race condition on welcome send | Low        | Low    | Idempotency flag prevents duplicates       |
| Admin public key compromised   | Very Low   | Low    | Public keys are safe to expose             |
