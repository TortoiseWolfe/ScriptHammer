# Feature Specification: Admin Welcome Message & Email Verification

**Feature Branch**: `002-feature-002-admin`
**Created**: 2025-11-28
**Status**: Clarified
**Input**: User description: "Feature 002: Admin Welcome Message & Email Verification - Three-part feature: (1) Add 4th admin user ScriptHammer (admin@scripthammer.com) to .env with secure password, (2) Enforce email verification for messaging features using new MessagingGate component that blocks /messages until email verified, (3) Send encrypted welcome message from admin to new users on first login explaining E2E encryption in layman terms"

## Clarifications

### Session 2025-11-28

- Q: When should admin's encryption keys be initialized? → A: First-send derivation (Option C) - Keys derived and stored lazily when first welcome message is attempted. Self-healing if corrupted.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - New User Receives Welcome Message (Priority: P1)

A new user signs up, verifies their email, and logs in for the first time. After their encryption keys are initialized, they automatically receive an encrypted welcome message from "ScriptHammer" in their message inbox explaining how the E2E encryption protects their privacy.

**Why this priority**: This is the core value proposition - educating users about security features increases trust and engagement. Without this, users may not understand why they need a separate messaging password.

**Independent Test**: Can be fully tested by creating a new user, verifying email, logging in, and checking that a welcome message appears from ScriptHammer in their conversations.

**Acceptance Scenarios**:

1. **Given** a new user with verified email and no encryption keys, **When** they log in and initialize keys, **Then** they receive an encrypted welcome message from ScriptHammer
2. **Given** a user who has already received the welcome message, **When** they log in again, **Then** they do NOT receive a duplicate welcome message
3. **Given** a new user, **When** they view the welcome message, **Then** it explains E2E encryption in simple, non-technical language

---

### User Story 2 - Unverified User Cannot Access Messaging (Priority: P2)

A user who has not verified their email tries to access the /messages page. They see a clear explanation that email verification is required, with an option to resend the verification email.

**Why this priority**: Security requirement - email verification ensures user identity before allowing access to encrypted messaging features.

**Independent Test**: Can be tested by signing up without verifying email, navigating to /messages, and confirming the blocked state with verification prompt appears.

**Acceptance Scenarios**:

1. **Given** a logged-in user with unverified email, **When** they navigate to /messages, **Then** they see "Email Verification Required" message with resend option
2. **Given** an unverified user viewing the blocked state, **When** they click "Resend Verification", **Then** a new verification email is sent
3. **Given** a user who just verified their email, **When** they return to /messages, **Then** they gain full access to messaging features

---

### User Story 3 - Admin User Setup (Priority: P3)

System administrators can configure the ScriptHammer admin user via environment variables. The admin user has encryption keys initialized and can send automated messages.

**Why this priority**: Foundation requirement - the admin user must exist before welcome messages can be sent, but setup is a one-time configuration task.

**Independent Test**: Can be tested by verifying admin credentials in .env, checking admin profile exists in database, and confirming admin can be authenticated.

**Acceptance Scenarios**:

1. **Given** properly configured .env with admin credentials, **When** the system starts, **Then** the admin user profile exists in the database
2. **Given** the admin user, **When** their encryption keys are initialized, **Then** they can send encrypted messages to any user
3. **Given** the admin user, **When** a new user signs up, **Then** the admin can create a conversation and send the welcome message

---

### User Story 4 - OAuth User Email Verification (Priority: P4)

Users who sign in via OAuth providers (Google, GitHub) have their email automatically verified by the provider and can access messaging immediately after creating their messaging password.

**Why this priority**: UX consideration - OAuth users should not be blocked unnecessarily since their email is already verified by a trusted provider.

**Independent Test**: Can be tested by signing in with Google/GitHub OAuth and verifying immediate access to /messages after password setup.

**Acceptance Scenarios**:

1. **Given** a user signing in via Google OAuth, **When** they access /messages, **Then** they are not blocked for email verification (OAuth provider verified their email)
2. **Given** an OAuth user with verified email but no encryption keys, **When** they access /messages, **Then** they see the messaging password setup flow, not email verification

---

### Edge Cases

- What happens when admin password is not configured in .env? System logs warning, welcome messages are silently skipped
- What happens when admin user doesn't have encryption keys? System derives keys lazily from password on first send attempt (FR-011)
- What happens when database insert fails for welcome message? Error logged, user session continues normally
- What happens when user's public key is not available? Welcome message deferred until keys are initialized
- How does system handle user who deletes the welcome message? Message deletion is permanent, no re-send
- What happens when admin keys are corrupted in database? System re-derives keys from password (self-healing per FR-012)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST include a 4th admin user "ScriptHammer" with email admin@scripthammer.com configurable via environment variables
- **FR-002**: System MUST store admin user ID as NEXT_PUBLIC_ADMIN_USER_ID environment variable
- **FR-003**: System MUST block access to /messages route for users with unverified email addresses
- **FR-004**: System MUST display "Email Verification Required" UI with resend functionality when blocking unverified users
- **FR-005**: System MUST allow OAuth users (Google/GitHub) to bypass email verification (provider-verified)
- **FR-006**: System MUST track whether a user has received the welcome message via `welcome_message_sent` column
- **FR-007**: System MUST send encrypted welcome message on first successful key initialization
- **FR-008**: System MUST derive admin encryption keys from password at runtime (never store private keys)
- **FR-009**: System MUST encrypt welcome message using ECDH P-256 + AES-GCM (same as user messages)
- **FR-010**: Welcome message MUST explain E2E encryption in layman's terms including: message privacy, password-derived keys, cross-device access
- **FR-011**: System MUST use lazy key derivation for admin - derive and store admin public key only when first welcome message is attempted
- **FR-012**: System MUST self-heal admin keys if corrupted - re-derive from password if key verification fails

### Key Entities

- **Admin User (ScriptHammer)**: System user with fixed UUID (00000000-0000-0000-0000-000000000001), sends automated welcome messages, credentials stored in .env
- **MessagingGate**: New component that wraps /messages content, checks email_confirmed_at before allowing access
- **WelcomeService**: New service that derives admin keys, encrypts and sends welcome message to new users
- **user_profiles.welcome_message_sent**: Boolean column tracking whether user has received welcome message

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of new users with verified email receive a welcome message on first login
- **SC-002**: 100% of unverified email users are blocked from accessing /messages with clear explanation
- **SC-003**: Welcome message is readable/decryptable by recipient (proper E2E encryption)
- **SC-004**: Zero duplicate welcome messages sent to any user
- **SC-005**: OAuth users experience no email verification friction (provider-verified accepted)
- **SC-006**: Admin password never appears in logs, database, or client-side code
