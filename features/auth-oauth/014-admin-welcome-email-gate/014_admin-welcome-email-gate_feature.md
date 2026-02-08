# Feature: Email Verification Gate & Admin Setup

**Feature ID**: 014
**Category**: auth-oauth
**Source**: ScriptHammer_v_001/specs/002-feature-002-admin
**Status**: Ready for SpecKit
**Extends**: 012-welcome-message-architecture

## Description

Two-part feature focused on email verification and admin user setup:

1. **Email Verification Gate**: Enforce email verification for messaging via MessagingGate component
2. **Admin User Setup**: Seed script for admin user creation with pre-generated keys

**Note**: Welcome message encryption is handled by Feature 012 using client-side pre-generation. This feature focuses on the gating logic and admin setup, NOT the welcome message encryption flow.

## User Scenarios

### US-1: Admin User Setup (P1)

System seed script creates the admin user with pre-generated encryption keys for welcome message functionality.

**Acceptance Criteria**:

1. Given a fresh database, when seed script runs, then admin user (auth + profile + keys) is created
2. Given admin user exists, when seed script runs again, then it is idempotent (no errors, no duplicates)
3. Given admin public key exists, when Feature 012 welcome service runs, then it can fetch admin's public key

**Note**: Welcome message sending is handled by Feature 012. This feature only handles admin user creation.

### US-2: Unverified User Cannot Access Messaging (P2)

A user with unverified email tries to access /messages. They see a clear explanation with option to resend verification email.

**Acceptance Criteria**:

1. Given a logged-in user with unverified email, when they navigate to /messages, then they see "Email Verification Required" with resend option
2. Given an unverified user, when they click "Resend Verification", then a new verification email is sent
3. Given a user who just verified their email, when they return to /messages, then they gain full access

### US-3: Seed Script Execution (P3)

Database seed script is run once per environment to set up admin user.

**Acceptance Criteria**:

1. Given ADMIN_EMAIL and ADMIN_USER_ID in .env, when seed script runs, then admin auth user is created with that UUID
2. Given seed script completes, when checking user_encryption_keys, then admin's public key exists (JWK format)
3. Given seed script completes, when checking user_profiles, then admin profile exists with is_admin=true

### US-4: OAuth User Email Verification (P4)

OAuth users have their email automatically verified by the provider and can access messaging immediately.

**Acceptance Criteria**:

1. Given a user signing in via Google OAuth, when they access /messages, then they are not blocked for email verification
2. Given an OAuth user with verified email but no encryption keys, when they access /messages, then they see the messaging password setup flow

## Edge Cases

- Seed script not run: Admin public key missing, Feature 012 logs warning and skips welcome message
- Admin public key missing at runtime: Feature 012 handles gracefully (see 012 edge cases)
- User email not verified: MessagingGate blocks access with clear UI
- OAuth user verification status: Check email_confirmed_at from Supabase auth metadata
- User deletes welcome message: Permanent deletion, no re-send (handled by Feature 012)
- Seed script run multiple times: Idempotent - no errors, no duplicates

## Requirements

### Functional

**Email Verification Gate**

- FR-001: Block /messages route for unverified email addresses
- FR-002: Display "Email Verification Required" UI with resend functionality
- FR-003: Allow OAuth users to bypass email verification (provider-verified)
- FR-004: Check email_confirmed_at from Supabase auth.users metadata
- FR-005: Provide "Resend Verification Email" button that calls Supabase resend API

**Admin User Setup (Seed Script)**

- FR-006: Read ADMIN_EMAIL and ADMIN_USER_ID from environment variables
- FR-007: Create admin auth user with pre-defined UUID if not exists
- FR-008: Create admin profile with is_admin=true if not exists
- FR-009: Generate ECDH P-256 keypair for admin
- FR-010: Store admin public key in user_encryption_keys table (JWK format)
- FR-011: Discard admin private key after generation (not needed - see Feature 012)
- FR-012: Seed script MUST be idempotent (safe to run multiple times)

**Deferred to Feature 012**

- ~~FR-OLD-007: Send encrypted welcome message~~ → Handled by Feature 012
- ~~FR-OLD-008: Derive admin keys from password~~ → Removed (static hosting incompatible)
- ~~FR-OLD-009: Encrypt using ECDH~~ → Handled by Feature 012

### Key Entities

- **Admin User**: System user with pre-generated public key (no private key stored)
- **MessagingGate**: Component that checks email_confirmed_at before allowing access
- **Seed Script**: One-time setup script for admin user creation
- **user_profiles.is_admin**: Boolean marking admin user

## Success Criteria

**Email Verification Gate**

- SC-001: 100% of unverified users blocked from /messages with clear explanation
- SC-002: Resend verification email works correctly
- SC-003: OAuth users bypass email verification (no friction)
- SC-004: Verified users gain immediate access to /messages

**Admin Setup**

- SC-005: Seed script creates admin user with public key on first run
- SC-006: Seed script is idempotent (no errors on re-run)
- SC-007: Admin public key is available for Feature 012 welcome service

**Deferred to Feature 012**

- ~~SC-OLD-001: Users receive welcome message~~ → Feature 012
- ~~SC-OLD-003: Welcome message decryptable~~ → Feature 012
- ~~SC-OLD-004: No duplicate welcome messages~~ → Feature 012

## Static Hosting Compliance

This feature is static-hosting compliant:

- MessagingGate uses Supabase client to check email_confirmed_at
- Seed script runs at build/deploy time, not runtime
- No secrets required in browser code
- Welcome message encryption delegated to Feature 012 (client-side)
