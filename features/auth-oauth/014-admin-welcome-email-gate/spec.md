# Feature Specification: Email Verification Gate & Admin Setup

**Feature Branch**: `014-admin-welcome-email-gate`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Two-part feature for email verification gating and admin user setup for welcome message functionality."

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Admin User Setup (Priority: P1)

As a system operator, I need a setup process that creates the admin user with pre-generated encryption keys so that the welcome message system (Feature 012) can function.

**Why this priority**: Core infrastructure - without admin setup, welcome messages cannot be sent to new users.

**Independent Test**: Can be tested by running the setup process and verifying admin user exists with required profile and public key.

**Acceptance Scenarios**:

1. **Given** a fresh system with no admin user, **When** setup process runs, **Then** admin user is created with authentication record, profile, and public key
2. **Given** admin user already exists, **When** setup process runs again, **Then** it completes without errors and without creating duplicates (idempotent)
3. **Given** admin public key exists, **When** Feature 012 welcome service runs, **Then** it can successfully retrieve admin's public key

---

### User Story 2 - Unverified User Cannot Access Messaging (Priority: P2)

As an unverified user attempting to access messaging, I see a clear explanation of why I'm blocked and have an easy way to resend the verification email.

**Why this priority**: Security requirement - prevents unverified accounts from accessing sensitive messaging features.

**Independent Test**: Can be tested by logging in as unverified user and navigating to messages, verifying gate UI appears.

**Acceptance Scenarios**:

1. **Given** a logged-in user with unverified email, **When** they navigate to messaging, **Then** they see "Email Verification Required" message with resend option
2. **Given** an unverified user viewing the gate, **When** they click "Resend Verification", **Then** a new verification email is sent
3. **Given** an unverified user viewing the gate, **When** they click "Resend Verification", **Then** they receive feedback confirming email was sent
4. **Given** a user who just verified their email, **When** they return to messaging, **Then** they gain immediate access

---

### User Story 3 - OAuth User Bypass (Priority: P3)

As an OAuth user (signed in via external provider), I can access messaging immediately because my email is provider-verified.

**Why this priority**: User experience - OAuth users should not face unnecessary friction since providers verify emails.

**Independent Test**: Can be tested by signing in via OAuth provider and navigating to messages, verifying no gate appears.

**Acceptance Scenarios**:

1. **Given** a user signing in via external OAuth provider, **When** they access messaging, **Then** they are not blocked for email verification
2. **Given** an OAuth user with verified email but no encryption keys, **When** they access messaging, **Then** they see the messaging password setup flow (Feature 013)

---

### User Story 4 - Setup Process Configuration (Priority: P4)

As a system operator, I can configure admin user details through environment settings before running the setup process.

**Why this priority**: Operational requirement - allows customization of admin identity per deployment.

**Independent Test**: Can be tested by configuring admin settings and running setup, verifying user is created with configured values.

**Acceptance Scenarios**:

1. **Given** admin email and identifier configured in environment, **When** setup process runs, **Then** admin user is created with those values
2. **Given** setup process completes, **When** checking admin profile, **Then** admin flag is set to true
3. **Given** setup process completes, **When** checking encryption storage, **Then** admin's public key exists

---

### Edge Cases

- What if setup process is not run?
  - Admin public key will be missing; Feature 012 logs warning and skips welcome message

- What if admin public key is missing at runtime?
  - Feature 012 handles gracefully (see 012 edge cases)

- What if user email verification status cannot be determined?
  - Block access with generic error and prompt to contact support

- What if resend verification fails?
  - Display error message with retry option and support contact

- What if setup process fails midway?
  - Partial state should be detected on re-run; setup process must be idempotent

- What if OAuth provider doesn't verify emails?
  - System treats as unverified; user sees verification gate

---

## Requirements _(mandatory)_

### Functional Requirements

**Email Verification Gate**

- **FR-001**: System MUST block messaging access for users with unverified email addresses
- **FR-002**: System MUST display "Email Verification Required" message with clear explanation
- **FR-003**: System MUST provide "Resend Verification Email" button on the gate screen
- **FR-004**: System MUST send verification email when resend is requested
- **FR-005**: System MUST allow OAuth users to bypass email verification (provider-verified)
- **FR-006**: System MUST check email verification status from authentication system
- **FR-007**: System MUST redirect verified users directly to messaging

**Admin User Setup**

- **FR-008**: Setup process MUST read admin configuration from environment settings
- **FR-009**: Setup process MUST create admin authentication record if not exists
- **FR-010**: Setup process MUST create admin profile with admin flag enabled
- **FR-011**: Setup process MUST generate asymmetric encryption keypair for admin
- **FR-012**: Setup process MUST store admin public key for Feature 012 to retrieve
- **FR-013**: Setup process MUST discard admin private key after generation (not needed)
- **FR-014**: Setup process MUST be idempotent (safe to run multiple times)

### Key Entities

- **Admin User**: System user with admin privileges and pre-generated public key (no private key stored)

- **Verification Gate**: Screen/component that checks email verification status before allowing messaging access

- **Email Verification Status**: Whether user's email has been confirmed via verification link or OAuth provider

- **Admin Profile**: User profile record with admin flag indicating system administrator

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

**Email Verification Gate**

- **SC-001**: 100% of unverified users are blocked from messaging with clear explanation
- **SC-002**: Resend verification email function works with user receiving email within 1 minute
- **SC-003**: OAuth users bypass email verification gate (0% false blocks)
- **SC-004**: Verified users gain immediate access to messaging (no delays)

**Admin Setup**

- **SC-005**: Setup process creates admin user with public key on first run (100% success rate)
- **SC-006**: Setup process is idempotent (no errors or duplicates on re-run)
- **SC-007**: Admin public key is retrievable by Feature 012 welcome service

---

## Constraints _(optional)_

- Setup process runs at build/deploy time, not runtime
- No admin credentials required in browser code
- Welcome message encryption delegated to Feature 012 (client-side)
- Admin private key is never stored or transmitted

---

## Dependencies _(optional)_

- Requires Feature 012 (welcome-message-architecture) for public key usage
- Requires Feature 003 (user-authentication) for email verification infrastructure
- Requires Feature 013 (oauth-messaging-password) for OAuth user encryption setup

---

## Assumptions _(optional)_

- OAuth providers (Google, GitHub, etc.) verify email addresses
- Setup process has access to environment configuration
- Authentication system provides email verification status
- Users receive verification emails within standard delivery timeframes
