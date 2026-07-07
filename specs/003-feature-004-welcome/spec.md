# Feature Specification: Welcome Message Redesign

**Feature Branch**: `003-feature-004-welcome`
**Created**: 2025-11-28
**Status**: Draft
**Input**: User description: "Feature 004: Welcome Message Redesign - ARCHITECTURE FIX: Current implementation incorrectly calls welcome service from client-side SignInForm where TEST_USER_ADMIN_PASSWORD env var is unavailable (static GitHub Pages hosting). Redesign to use Supabase-only approach."

## Clarifications

### Session 2025-11-28

- Q: How should welcome message encryption be handled given PostgreSQL cannot do ECDH? → A: Client-side pre-generation using admin's public key (Option C)
- Q: How should admin public key one-time setup be handled? → A: Add to seed script `scripts/seed-test-users.ts` to auto-generate on first run (Option B)
- Q: Should existing users without welcome messages be backfilled? → A: No - delete all users and start fresh (clean slate)
- Q: Should seed script create admin user if missing? → A: Yes - full setup (auth user + profile + keys)

## Problem Statement

The current welcome message implementation (Feature 002) has a critical architecture flaw:

1. **Client-side code** in `SignInForm.tsx` calls `welcomeService.sendWelcomeMessage()`
2. The service requires `TEST_USER_ADMIN_PASSWORD` environment variable
3. Non-`NEXT_PUBLIC_` env vars are **not available** in browser/client code
4. The app is hosted on **GitHub Pages** (static hosting) - no server-side API routes possible
5. Result: Welcome messages never send because admin password is always `undefined`

## User Scenarios & Testing _(mandatory)_

### User Story 1 - New User Receives Welcome Message (Priority: P1)

A new user signs up and initializes their encryption keys. They automatically receive a welcome message from ScriptHammer admin explaining E2E encryption.

**Why this priority**: Core feature - users must understand the E2E encryption system to use messaging effectively.

**Independent Test**: Can be fully tested by creating a new user, initializing keys, and verifying welcome message appears in their conversation list.

**Acceptance Scenarios**:

1. **Given** a new user has just initialized encryption keys, **When** the welcome service is called client-side, **Then** a welcome message conversation is created with the admin user
2. **Given** the welcome service is called, **When** the admin's public key exists in database, **Then** shared secret is derived and message is encrypted
3. **Given** a user already received a welcome message (`welcome_message_sent = true`), **When** they re-initialize keys (migration), **Then** no duplicate welcome message is sent

---

### User Story 2 - Idempotent Welcome Messages (Priority: P2)

The system prevents duplicate welcome messages even if the welcome service is called multiple times or user re-initializes keys.

**Why this priority**: Prevents spam/confusion if edge cases cause multiple service invocations.

**Independent Test**: Can be tested by calling welcome service multiple times for same user and verifying only one welcome message exists.

**Acceptance Scenarios**:

1. **Given** a user has `welcome_message_sent = true`, **When** welcome service is called, **Then** no new message is created (early return)
2. **Given** a race condition causes concurrent welcome service calls, **When** both try to create conversation, **Then** only one succeeds (upsert pattern)

---

### User Story 3 - Graceful Admin Key Missing Handling (Priority: P3)

If the admin public key is missing from the database (seed script not run), the system handles it gracefully without blocking user sign-in.

**Why this priority**: Ensures system resilience - missing admin setup shouldn't break user registration flow.

**Independent Test**: Can be tested by deleting admin's public key from database and verifying welcome service fails gracefully without throwing.

**Acceptance Scenarios**:

1. **Given** admin public key is missing from `user_encryption_keys`, **When** welcome service attempts to fetch it, **Then** error is logged and welcome message is skipped (not sent)
2. **Given** admin public key fetch fails, **When** user completes sign-in, **Then** sign-in succeeds normally (welcome is non-blocking)

---

### Edge Cases

- What happens when admin public key is missing? Service logs error, skips welcome message, does not block user sign-in (US3 covers this).
- What happens when admin user profile doesn't exist? Seed script creates it; if missing at runtime, conversation creation fails gracefully with logged error.
- How does system handle encryption failures? Logs error, skips welcome message, allows retry on next sign-in.
- What happens if Web Crypto API is unavailable? Service catches error, logs warning, skips welcome. Browser targets: Chrome 60+, Firefox 57+, Safari 11+, Edge 79+. IE11 and older browsers will not receive welcome messages (graceful degradation).
- What happens if conversation created but message insert fails? Orphan conversation is harmless - next attempt will use existing conversation via upsert. No rollback needed.
- What happens if user signs in on multiple devices during key initialization? Each device has same derived keys (password-based), so welcome message will succeed on one and skip on others (idempotency via `welcome_message_sent` flag).
- What is the initial state of `welcome_message_sent`? Default `false` in user_profiles table, set to `true` after first successful welcome message delivery.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST send welcome message client-side using admin's pre-stored public key
- **FR-002**: System MUST NOT require admin password at runtime (public key only)
- **FR-003**: System MUST derive shared secret using user's private key + admin's public key
- **FR-004**: System MUST encrypt welcome message using ECDH shared secret
- **FR-005**: System MUST check `welcome_message_sent` flag before sending (idempotency)
- **FR-006**: System MUST use canonical conversation ordering (participant_1 = min(userId, adminId), participant_2 = max(userId, adminId) using string comparison)
- **FR-007**: System MUST update `welcome_message_sent = true` after successful send
- **FR-008**: System MUST log errors without blocking user sign-in flow (no retries, fail immediately with graceful degradation, 10 second timeout max)
- **FR-009**: CLAUDE.md MUST be updated to document static hosting constraint (exact content specified in §Documentation Updates section below)
- **FR-010**: Admin public key MUST be pre-generated and stored in `user_encryption_keys` table
- **FR-011**: System MUST use ECDH P-256 curve for all key generation and derivation operations

### Key Entities

- **Admin Public Key**: Pre-generated ECDH P-256 public key stored in `user_encryption_keys` as JWK format with required fields: `{ kty: "EC", crv: "P-256", x: "<base64url>", y: "<base64url>" }`
- **Admin User**: UUID `00000000-0000-0000-0000-000000000001`, username `scripthammer`
- **Welcome Message Content**: Static constant `WELCOME_MESSAGE_CONTENT` defined in `specs/003-feature-004-welcome/contracts/welcome-service.ts` and copied to `src/services/messaging/welcome-service.ts` during implementation

## Technical Approach

### Architecture: Client-Side Pre-Generation

The welcome message is encrypted client-side using the ECDH shared secret derived from:

- User's private key (available after key initialization)
- Admin's public key (pre-stored constant)

Since ECDH shared secrets are symmetric, the user can encrypt a message "from" admin that they can also decrypt.

### Flow

1. Admin's public key is pre-generated once and stored in `user_encryption_keys` table (NOT as a constant - must be fetched from database)
2. When user initializes encryption keys in `SignInForm.tsx`:
   a. Check `welcome_message_sent = false`
   b. Fetch admin's public key from database
   c. Derive shared secret: `ECDH(user_private, admin_public)`
   d. Encrypt `WELCOME_MESSAGE_CONTENT` constant
   e. Create conversation (canonical ordering)
   f. Insert message with `sender_id = admin_user_id`
   g. Update `welcome_message_sent = true`

### Database Objects to Create

1. **Admin public key row**: Insert admin's pre-generated public key into `user_encryption_keys` (one-time setup)

### Files to Modify

| File                                             | Change                                                                                                                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/messaging/welcome-service.ts`      | Remove: `ADMIN_CONFIG.password`, `initializeAdminKeys()`, `ensureAdminKeys()`, `adminKeys` property. Add: `getAdminPublicKey()` method. Modify: `sendWelcomeMessage()` signature to accept `userPrivateKey: CryptoKey` parameter |
| `src/services/messaging/welcome-service.test.ts` | Update tests for new approach                                                                                                                                                                                                    |
| `scripts/seed-test-users.ts`                     | Add admin public key generation                                                                                                                                                                                                  |
| `CLAUDE.md`                                      | Add static hosting constraint documentation                                                                                                                                                                                      |

### Files Changed (Minimal Modifications)

| File                                            | Change                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/components/auth/SignInForm/SignInForm.tsx` | Add `userPrivateKey` parameter to `sendWelcomeMessage()` call (one-line change) |

### One-Time Setup (Automated)

Full admin setup is handled by `scripts/seed-test-users.ts`:

1. Creates admin auth user (ID: `00000000-0000-0000-0000-000000000001`) if missing
2. Creates admin profile (username: `scripthammer`) if missing
3. Generates ECDH P-256 keypair
4. Stores public key in `user_encryption_keys` table
5. Private key is discarded (not needed for welcome messages)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: New users receive welcome message within 5 seconds of key initialization (timer starts after `generateKeyPair()` completes in SignInForm)
- **SC-002**: Zero client-side errors related to undefined `TEST_USER_ADMIN_PASSWORD`
- **SC-003**: Welcome messages work on GitHub Pages static deployment
- **SC-004**: No admin password or private key required at runtime (public key only)
- **SC-005**: Existing users with `welcome_message_sent = true` do not receive duplicates
- **SC-006**: CLAUDE.md documents that API routes are not available on static hosting

## Security Considerations

- Admin private key is NOT needed at runtime (only public key used). Private key is discarded after generation because: (a) welcome messages are encrypted by the user, not admin, (b) ECDH(user_private, admin_public) = ECDH(admin_private, user_public) by mathematical symmetry.
- Admin public key is safe to expose (public keys are meant to be shared). Threat model: An attacker with the public key cannot derive the shared secret without the user's private key.
- User encrypts welcome message using their own private key + admin public key.
- RLS policies prevent unauthorized conversation/message creation: only authenticated users can create conversations, `sender_id` must match authenticated user for regular messages. Welcome message is special case with `sender_id = admin_user_id` but inserted by user - RLS allows this via conversation participant check.
- Impersonation prevention: Users cannot create arbitrary "from admin" messages because they would need to insert into existing conversation with admin. RLS allows message insert only if user is participant. The welcome message works because user creates the conversation AND the message in same transaction with themselves as participant.
- No secrets required in environment variables or Vault.

## Data Integrity

- **Atomicity**: The welcome flow (check → create conversation → insert message → update flag) is NOT atomic but designed to be idempotent. Partial failures are acceptable because: conversation upsert handles duplicates, message insert with same content is allowed, flag update is last step so re-runs are safe.
- **Race condition safety**: Concurrent calls handled by database upsert pattern (`ON CONFLICT DO NOTHING` for conversations) and idempotency flag check at start.
- **Initial state**: `welcome_message_sent` column defaults to `false` in user_profiles table.

## Dependencies

- **User's private key availability**: Validated - `keyPair.privateKey` is available in SignInForm after `generateKeyPair()` completes, before `sendWelcomeMessage()` is called.
- **Encryption service dependency**: Uses existing `encryptionService.deriveSharedSecret()` from `src/lib/messaging/encryption.ts` for ECDH derivation.
- **Seed script execution**: Must run once per environment (local/staging/production) BEFORE any user signs up. Seed script is idempotent (checks for existing admin before creating).
- **Admin profile guarantee**: Seed script creates auth user, profile, AND encryption keys atomically. If any step fails, entire setup fails. Runtime assumes all exist after successful seed.

## Documentation Updates

### CLAUDE.md - Static Hosting Constraint Section

Add the following section to CLAUDE.md after "Docker-First Development" section:

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
