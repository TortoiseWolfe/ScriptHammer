# Feature Specification: Welcome Message Architecture

**Feature Number**: 012
**Category**: core-features
**Priority**: P2
**Status**: Draft
**Source**: Migrated from ScriptHammer_v_001 specs/003-feature-004-welcome

---

## Clarifications

### Session 2025-11-28

- Q: How should welcome message encryption be handled given PostgreSQL cannot do ECDH? → A: Client-side pre-generation using admin's public key
- Q: How should admin public key one-time setup be handled? → A: Add to seed script to auto-generate on first run
- Q: Should existing users without welcome messages be backfilled? → A: No - delete all users and start fresh (clean slate)
- Q: Should seed script create admin user if missing? → A: Yes - full setup (auth user + profile + keys)

## Problem Statement

The current welcome message implementation has a critical architecture flaw:

1. **Client-side code** calls welcome service
2. The service requires admin password environment variable
3. Non-`NEXT_PUBLIC_` env vars are **not available** in browser/client code
4. The app is hosted on **static hosting** (e.g., GitHub Pages) - no server-side API routes possible
5. Result: Welcome messages never send because admin password is always `undefined`

## User Scenarios & Testing _(mandatory)_

### User Story 1 - New User Receives Welcome Message (Priority: P1)

A new user signs up and initializes their encryption keys. They automatically receive a welcome message from admin explaining E2E encryption.

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

- What happens when admin public key is missing? Service logs error, skips welcome message, does not block user sign-in
- What happens when admin user profile doesn't exist? Seed script creates it; if missing at runtime, conversation creation fails gracefully
- How does system handle encryption failures? Logs error, skips welcome message, allows retry on next sign-in
- What happens if Web Crypto API is unavailable? Service catches error, logs warning, skips welcome
- What happens if conversation created but message insert fails? Orphan conversation is harmless - next attempt will use existing conversation via upsert
- What happens if user signs in on multiple devices during key initialization? Each device has same derived keys (password-based), so welcome message will succeed on one and skip on others (idempotency via flag)
- What is the initial state of `welcome_message_sent`? Default `false` in user_profiles table, set to `true` after first successful welcome message delivery

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST send welcome message client-side using admin's pre-stored public key
- **FR-002**: System MUST NOT require admin password at runtime (public key only)
- **FR-003**: System MUST derive shared secret using user's private key + admin's public key
- **FR-004**: System MUST encrypt welcome message using ECDH shared secret
- **FR-005**: System MUST check `welcome_message_sent` flag before sending (idempotency)
- **FR-006**: System MUST use canonical conversation ordering (participant_1 = min(userId, adminId), participant_2 = max(userId, adminId))
- **FR-007**: System MUST update `welcome_message_sent = true` after successful send
- **FR-008**: System MUST log errors without blocking user sign-in flow (no retries, fail immediately with graceful degradation)
- **FR-009**: Documentation MUST document static hosting constraint
- **FR-010**: Admin public key MUST be pre-generated and stored in `user_encryption_keys` table
- **FR-011**: System MUST use ECDH P-256 curve for all key generation and derivation operations

### Key Entities

- **Admin Public Key**: Pre-generated ECDH P-256 public key stored in `user_encryption_keys` as JWK format with required fields: `{ kty: "EC", crv: "P-256", x: "<base64url>", y: "<base64url>" }`
- **Admin User**: Designated admin user with pre-defined UUID
- **Welcome Message Content**: Static constant defined in welcome service

## Technical Approach

### Architecture: Client-Side Pre-Generation

The welcome message is encrypted client-side using the ECDH shared secret derived from:

- User's private key (available after key initialization)
- Admin's public key (pre-stored in database)

Since ECDH shared secrets are symmetric, the user can encrypt a message "from" admin that they can also decrypt.

### Flow

1. Admin's public key is pre-generated once and stored in `user_encryption_keys` table
2. When user initializes encryption keys:
   a. Check `welcome_message_sent = false`
   b. Fetch admin's public key from database
   c. Derive shared secret: `ECDH(user_private, admin_public)`
   d. Encrypt welcome message content
   e. Create conversation (canonical ordering)
   f. Insert message with `sender_id = admin_user_id`
   g. Update `welcome_message_sent = true`

### One-Time Setup (Automated)

Full admin setup is handled by seed script:

1. Creates admin auth user (pre-defined UUID) if missing
2. Creates admin profile if missing
3. Generates ECDH P-256 keypair
4. Stores public key in `user_encryption_keys` table
5. Private key is discarded (not needed for welcome messages)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: New users receive welcome message within 5 seconds of key initialization
- **SC-002**: Zero client-side errors related to undefined admin password
- **SC-003**: Welcome messages work on static hosting deployment
- **SC-004**: No admin password or private key required at runtime (public key only)
- **SC-005**: Existing users with `welcome_message_sent = true` do not receive duplicates
- **SC-006**: Documentation documents that API routes are not available on static hosting

## Security Considerations

- Admin private key is NOT needed at runtime (only public key used). Private key is discarded after generation because:
  - Welcome messages are encrypted by the user, not admin
  - ECDH(user_private, admin_public) = ECDH(admin_private, user_public) by mathematical symmetry
- Admin public key is safe to expose (public keys are meant to be shared)
- User encrypts welcome message using their own private key + admin public key
- RLS policies prevent unauthorized conversation/message creation
- Impersonation prevention: Users cannot create arbitrary "from admin" messages because they would need to insert into existing conversation with admin. RLS allows message insert only if user is participant.
- No secrets required in environment variables or Vault

## Data Integrity

- **Atomicity**: The welcome flow (check → create conversation → insert message → update flag) is NOT atomic but designed to be idempotent
- **Race condition safety**: Concurrent calls handled by database upsert pattern and idempotency flag check at start
- **Initial state**: `welcome_message_sent` column defaults to `false` in user_profiles table

## Dependencies

- **Feature 014**: Admin user setup via seed script (creates admin auth user, profile, and public key)
- **User's private key availability**: Validated - privateKey is available after key generation completes
- **Encryption service dependency**: Uses existing encryption service for ECDH derivation
- **Seed script execution**: Handled by Feature 014 - must run once per environment BEFORE any user signs up
- **Admin profile guarantee**: Feature 014 seed script creates auth user, profile, AND encryption keys atomically

## Static Hosting Constraint

When implementing features on static hosting:

- NO server-side API routes available in production
- NO access to non-NEXT*PUBLIC* environment variables in browser
- All server-side logic must be in Supabase (database, Edge Functions, or triggers)

When implementing features that need secrets:

- Use Supabase Vault for secure storage
- Use Edge Functions for server-side logic
- Or design client-side solutions that don't require secrets
