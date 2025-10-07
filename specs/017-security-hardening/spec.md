# Feature Specification: Authentication & Payment Security Hardening

**Feature Branch**: `017-security-hardening`
**Created**: 2025-10-06
**Status**: Draft
**Input**: Code review findings from initial auth/payment implementation (PRP-015, PRP-016)

## Execution Flow (main)

```
1. Parse input from security code review
   → Feature: Security hardening for authentication and payment systems
2. Extract key security risks
   → Critical: Data isolation breach, OAuth CSRF vulnerability, client-side security controls
   → High: Insufficient validation, missing CSRF protection, audit logging gaps
   → Medium: User experience gaps in security features
3. Identify affected users
   → All users: Payment data isolation, account security
   → Attackers: Prevention of unauthorized access and brute force
   → Admins: Security audit and monitoring capabilities
4. Fill User Scenarios & Testing section
   → Security attack scenarios, data isolation tests, audit trails
5. Generate Functional Requirements organized by priority
   → P0 (Critical): Production blockers
   → P1 (High): Security hardening
   → P2 (Medium): UX and reliability
   → P3 (Low): Polish and optimization
6. Run Review Checklist
   → All requirements focus on WHAT (security outcomes) not HOW (implementation)
   → Each requirement is testable with acceptance criteria
7. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines

- ✅ Focus on WHAT security outcomes are needed and WHY they matter
- ❌ Avoid HOW to implement (no Redis, Edge Functions, specific libraries)
- 👥 Written for security stakeholders and business owners, not developers
- 🔒 Emphasizes user protection and business risk mitigation

### Section Requirements

- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

---

## Clarifications

### Session 2025-10-06

- Q: What is the default idle timeout duration for standard user sessions? → A: Configurable with 24 hour default
- Q: Should the idle timeout also apply to "Remember Me" sessions, or should they be exempt? → A: Extended idle timeout (7 days) for "Remember Me" sessions
- Q: How should the system handle disposable/temporary email addresses? → A: Warn user - show warning but allow sign-up
- Q: When webhook processing fails after all retry attempts, how should admins be notified? → A: Both email + database flag
- Q: When should the automated cleanup process run to remove expired payment intents? → A: Configurable with weekly Sunday 3 AM UTC default

---

## User Scenarios & Testing _(mandatory)_

### Primary Security Story

As a user with a ScriptHammer account, I need my payment data and personal information to be completely isolated from other users, protected from unauthorized access, and secured against common web attacks so that my financial information and account cannot be compromised.

### Critical Security Scenarios

#### Scenario 1: Payment Data Isolation

1. **Given** I am user Alice with payment history, **When** user Bob signs in, **Then** Bob cannot see or access any of Alice's payment data
2. **Given** I create a payment intent, **When** the system stores it, **Then** it is permanently associated with MY user ID only
3. **Given** I view my payment history, **When** the system queries the database, **Then** only payments belonging to my account are returned

**Acceptance Criteria:**

- No payment data visible across user accounts
- Database queries enforce user isolation
- Payment intent creation requires authenticated user
- RLS policies prevent cross-user data access

#### Scenario 2: OAuth Account Protection

1. **Given** an attacker initiates an OAuth flow, **When** they try to redirect the authorization to a victim's browser, **Then** the victim's account is NOT compromised
2. **Given** I sign in with GitHub, **When** the OAuth callback completes, **Then** the system verifies the request originated from MY browser session
3. **Given** someone tries to replay an OAuth authorization code, **When** they submit it, **Then** the system rejects it as already used or mismatched

**Acceptance Criteria:**

- OAuth sessions cannot be hijacked mid-flow
- Authorization callbacks validate session ownership
- Replay attacks are prevented

#### Scenario 3: Brute Force Attack Prevention

1. **Given** an attacker tries to guess my password, **When** they make 5 failed login attempts, **Then** further attempts are blocked regardless of which browser or device they use
2. **Given** the attacker clears their browser data, **When** they try again, **Then** they are still blocked
3. **Given** I am a legitimate user locked out by rate limiting, **When** I wait the specified time period, **Then** I can try again

**Acceptance Criteria:**

- Rate limiting cannot be bypassed by clearing browser storage
- Failed attempts tracked server-side by IP or identifier
- Legitimate users receive clear feedback on lockout duration

#### Scenario 4: Malicious Data Injection Prevention

1. **Given** an attacker creates a payment with malicious metadata, **When** they submit it, **Then** dangerous content is rejected before storage
2. **Given** an attacker tries SQL injection in the email field, **When** they submit it, **Then** the system rejects the invalid input without executing queries
3. **Given** someone submits payment metadata with circular references, **When** the system validates it, **Then** it detects and rejects the invalid structure

**Acceptance Criteria:**

- Prototype pollution attempts blocked
- SQL injection attempts rejected
- XSS attempts in user input sanitized
- Circular reference detection in nested data

### Security Audit Scenarios

#### Scenario 5: Security Event Logging

1. **Given** a user signs in successfully, **When** the authentication completes, **Then** the event is logged with timestamp, user ID, and IP address
2. **Given** someone attempts unauthorized access, **When** the attempt fails, **Then** the failure is logged for security review
3. **Given** an admin reviews security logs, **When** they query recent events, **Then** they see a complete audit trail of authentication activities

**Acceptance Criteria:**

- All authentication events logged (success/failure)
- Logs include sufficient forensic data (IP, user agent, timestamp)
- Logs retained for compliance requirements (90 days minimum)

#### Scenario 6: Session Security

1. **Given** I leave my browser open without activity, **When** 24 hours pass (or 7 days for Remember Me), **Then** my session expires and I must sign in again
2. **Given** I am signed in with "Remember Me", **When** I perform sensitive operations (payment, profile changes), **Then** the extended idle timeout (7 days) still applies
3. **Given** my session is active, **When** I explicitly sign out, **Then** my session is completely terminated and cannot be reused

**Acceptance Criteria:**

- Idle sessions timeout after configurable period
- Explicit sign-out fully invalidates session
- Session tokens cannot be stolen and replayed

### User Experience Scenarios

#### Scenario 7: Password Security Feedback

1. **Given** I am creating a new password, **When** I type it, **Then** I see real-time feedback on password strength (weak/medium/strong)
2. **Given** my password is too weak, **When** I try to submit, **Then** I see clear requirements (uppercase, lowercase, number, special character)
3. **Given** I create a strong password, **When** the system validates it, **Then** I receive positive confirmation

**Acceptance Criteria:**

- Visual strength indicator updates in real-time
- Clear requirements displayed to user
- Feedback helps users create secure passwords

#### Scenario 8: Error Recovery

1. **Given** the OAuth provider is temporarily unavailable, **When** I try to sign in with GitHub, **Then** I see a clear error and can retry or use email/password
2. **Given** email delivery fails during sign-up, **When** the system detects it, **Then** I am notified immediately and can request a new verification email
3. **Given** a payment webhook fails processing, **When** the system retries, **Then** I eventually see the payment status update when it succeeds

**Acceptance Criteria:**

- Clear error messages for user-facing failures
- Retry mechanisms for transient failures
- Users not left in uncertain states

### Edge Cases

- What happens when an attacker submits metadata with `__proto__` key to pollute JavaScript prototypes?
  → System detects dangerous keys and rejects the entire request with validation error

- What happens when two users try to create payment intents at the exact same time?
  → Each payment is independently associated with the correct user via database constraints

- What happens when email validation service is down during sign-up?
  → System shows immediate error, stores partial account, allows retry without re-entering data

- What happens when a webhook is received multiple times for the same event (duplicate delivery)?
  → Idempotency key ensures event processed only once, duplicates ignored

- What happens when a user's session expires mid-payment?
  → Payment queued offline, user prompted to sign in, payment processed after re-authentication

---

## Functional Requirements _(mandatory)_

### P0: Critical Security Requirements (Production Blockers)

#### REQ-SEC-001: Payment Data User Isolation

**What**: Every payment intent and transaction must be permanently associated with the specific user who created it, with no possibility of cross-user data access.

**Why**: Without proper user association, payment data can leak between accounts, violating PCI compliance and user privacy. This is a critical data integrity and security violation.

**Acceptance Criteria**:

- Payment intent creation requires authenticated user ID
- Database enforces user ID foreign key constraint
- RLS policies prevent queries from returning other users' data
- Payment history shows only the authenticated user's transactions

**Current Issue**: All payments use placeholder UUID `00000000-0000-0000-0000-000000000000`

---

#### REQ-SEC-002: OAuth Session Ownership Verification

**What**: OAuth authentication flows must verify that the authorization callback belongs to the browser session that initiated the request.

**Why**: Without session verification, attackers can hijack OAuth flows to gain unauthorized access to victim accounts (CSRF attack).

**Acceptance Criteria**:

- OAuth initiation generates unique session identifier
- Session identifier validated on callback before authentication completes
- Mismatched identifiers rejected with error
- Session identifier expires after use (single-use tokens)

**Current Issue**: No state parameter validation in OAuth callback

---

#### REQ-SEC-003: Server-Side Authentication Rate Limiting

**What**: Failed authentication attempts must be tracked and limited server-side, preventing brute force attacks regardless of client behavior.

**Why**: Client-side rate limiting (localStorage) can be trivially bypassed by clearing browser data, using incognito mode, or switching browsers. Server-side enforcement is required for actual security.

**Acceptance Criteria**:

- Failed login attempts tracked by IP address or email on server
- Rate limits enforced before authentication attempt reaches database
- Legitimate users see clear feedback on remaining attempts and lockout duration
- Bypass attempts (cleared storage, different browser) still blocked

**Current Issue**: Rate limiting uses localStorage only (client-side)

---

#### REQ-SEC-004: CSRF Protection for State-Changing Operations

**What**: All operations that modify user data (sign-up, profile updates, payments) must include CSRF token validation to prevent cross-site request forgery.

**Why**: Without CSRF protection, attackers can trick authenticated users into performing unwanted actions via malicious websites.

**Acceptance Criteria**:

- Sign-up, sign-in, and profile update forms include CSRF tokens
- Payment creation validates request authenticity
- Invalid or missing tokens rejected with 403 Forbidden
- Tokens expire after use or timeout period

**Current Issue**: Forms lack CSRF token validation

---

### P1: High Priority Security Hardening

#### REQ-SEC-005: Metadata Injection Prevention

**What**: Payment metadata must be validated to prevent prototype pollution, circular references, and excessive nesting that could compromise system security or stability.

**Why**: Malicious metadata can pollute JavaScript object prototypes, causing application-wide security vulnerabilities or crashes.

**Acceptance Criteria**:

- Metadata validation rejects keys: `__proto__`, `constructor`, `prototype`
- Circular reference detection prevents infinite loops
- Nesting depth limited to 2 levels maximum
- Array sizes limited to prevent resource exhaustion
- String metadata size limited to 1KB

**Current Issue**: Weak validation allows dangerous patterns

---

#### REQ-SEC-006: Comprehensive Email Validation

**What**: Email addresses must be validated for proper format, valid top-level domain, and warned (not blocked) if from disposable email services.

**Why**: Invalid or disposable emails prevent account recovery, enable abuse, and reduce user quality. Warning users allows legitimate testing while discouraging abuse.

**Acceptance Criteria**:

- Email validation requires valid TLD (`.com`, `.org`, etc.)
- Consecutive dots (`..`) rejected
- Disposable email domains trigger warning message (configurable list)
- Warning displayed but sign-up allowed to proceed
- Email normalized to lowercase for consistency
- Local part and domain both required

**Current Issue**: Validation allows emails without TLD

---

#### REQ-SEC-007: Security Event Audit Logging

**What**: All authentication and authorization events must be logged with sufficient detail for security investigations and compliance.

**Why**: Without audit logs, security incidents cannot be investigated, and compliance requirements (GDPR, PCI) are not met.

**Acceptance Criteria**:

- Events logged: sign-up, sign-in success/failure, sign-out, password changes
- Log data includes: user ID, event type, timestamp, IP address, user agent
- Logs retained for minimum 90 days
- Logs queryable for security review
- Failed authentication attempts prominently logged

**Current Issue**: Audit log table exists but not populated

---

#### REQ-SEC-008: Rate Limiter Initialization Fix

**What**: Authentication rate limiting must be initialized with the correct user identifier (email or IP) rather than empty string.

**Why**: Current implementation creates a shared rate limit key for all users, making the feature ineffective.

**Acceptance Criteria**:

- Rate limiter initialized after email input provided
- Each email/IP has independent rate limit tracking
- Rate limits not shared across different users
- Test: Two users can each have 5 failed attempts independently

**Current Issue**: Rate limiter initialized with empty email on component mount

---

### P2: Medium Priority Improvements

#### REQ-UX-001: Password Strength Feedback

**What**: Users creating passwords must see real-time visual feedback on password strength (weak, medium, strong) to guide them toward secure choices.

**Why**: Users often choose weak passwords without understanding requirements. Visual feedback improves security awareness and reduces weak passwords.

**Acceptance Criteria**:

- Strength indicator updates as user types
- Visual bar shows weak (red), medium (yellow), strong (green)
- Clear requirements displayed (length, character types)
- Encouragement for strong passwords without blocking weak ones (education)

---

#### REQ-UX-002: Session Idle Timeout

**What**: User sessions must automatically expire after a configurable period of inactivity (default 24 hours) to prevent unauthorized access to unattended devices. "Remember Me" sessions use an extended idle timeout (7 days).

**Why**: Users often leave devices unlocked. Idle timeout reduces risk of physical access to accounts while balancing usability for general-purpose PWA usage.

**Acceptance Criteria**:

- Inactivity timer resets on mouse movement, keyboard input, clicks
- User warned before timeout (1 minute warning)
- Standard session idle timeout: configurable (default 24 hours)
- "Remember Me" session idle timeout: 7 days
- "Remember Me" extends absolute session duration to 30 days with 7-day idle timeout

---

#### REQ-REL-001: OAuth Error Handling

**What**: OAuth authentication failures must be caught by error boundaries and provide clear recovery options to users.

**Why**: Network failures or provider outages during OAuth currently show blank screens, frustrating users.

**Acceptance Criteria**:

- Error boundary wraps OAuth callback page
- Network/provider errors show friendly message
- "Try Again" button allows retry
- Option to use email/password authentication instead
- Errors logged for debugging

---

#### REQ-REL-002: Webhook Retry Mechanism

**What**: Failed webhook processing attempts must be automatically retried with exponential backoff until success or maximum attempts reached. After all retries fail, admins are notified via email and the failure is flagged in the database.

**Why**: Transient network failures or temporary downtime can cause payment status to never update. Retries ensure eventual consistency, and alerts ensure admins can investigate permanent failures.

**Acceptance Criteria**:

- Failed webhooks retried up to 3 times
- Exponential backoff between retries (1min, 5min, 30min)
- After max attempts, webhook marked as permanently failed in database
- Email alert sent to configured admin email address after final failure
- Database flag set for manual review and queryability
- Admin can manually trigger retry for failed webhooks
- Idempotency prevents duplicate processing on retry

---

#### REQ-OPS-001: Payment Intent Cleanup

**What**: Payment intents that expire after 24 hours must be automatically removed from the database to prevent unbounded growth. Cleanup runs on a configurable schedule (default: weekly on Sunday at 3 AM UTC).

**Why**: Expired intents serve no purpose and consume database resources over time. Weekly cleanup balances resource usage with minimal operational overhead.

**Acceptance Criteria**:

- Cleanup process runs automatically on configurable schedule
- Default schedule: Weekly on Sunday at 3 AM UTC
- Intents older than 24 hours deleted
- Associated metadata also cleaned up
- Cleanup logs number of records removed
- Cleanup failures do not crash system

---

### P3: Low Priority Polish

#### REQ-POLISH-001: Production Logging Discipline

**What**: Debug console.log statements must be removed from production code or wrapped in development environment checks.

**Why**: Console output exposes system internals to users and can aid attackers in reconnaissance.

**Acceptance Criteria**:

- No console.log in production builds
- Development logging wrapped in `NODE_ENV === 'development'` checks
- Structured logging for server-side operations
- No sensitive data (tokens, passwords) in logs

---

#### REQ-A11Y-001: Accessible Error Announcements

**What**: Form validation errors must be announced to screen reader users via ARIA live regions.

**Why**: Screen reader users cannot see visual error messages and may not know why form submission failed.

**Acceptance Criteria**:

- Error alerts include `role="alert"` and `aria-live="assertive"`
- Error messages clearly state the problem and solution
- Errors announced immediately after validation
- Success messages also announced

---

## Key Entities _(mandatory)_

### User Account

**Purpose**: Represents an authenticated user with payment access
**Attributes**: User ID (UUID), email, password hash, email verified status, created timestamp
**Security Properties**: Unique email, secure password hash (bcrypt), email verification required for payments

### Authentication Session

**Purpose**: Tracks active user sessions for authentication and authorization
**Attributes**: Session token, user ID, creation time, expiration time, last activity, remember me flag
**Security Properties**: Cryptographically random token, automatic expiration, idle timeout enforcement

### Payment Intent

**Purpose**: User's intention to make a payment before provider redirect
**Attributes**: Intent ID, **user ID (owner)**, amount, currency, type, customer email, metadata
**Security Properties**: **Must be associated with authenticated user**, RLS policies enforce isolation, expires after 24 hours

### Security Audit Log

**Purpose**: Immutable record of security-relevant events for forensics and compliance
**Attributes**: Event ID, user ID, event type, timestamp, IP address, user agent, event data (JSONB)
**Security Properties**: Append-only, 90-day retention, queryable by admins only

### Rate Limit Tracker

**Purpose**: Server-side counter for failed authentication attempts
**Attributes**: Identifier (email or IP), attempt count, window start timestamp, lockout expiration
**Security Properties**: Server-side enforcement, cannot be bypassed by client manipulation

### OAuth State Token

**Purpose**: One-time token to verify OAuth session ownership
**Attributes**: State value (UUID), user session ID, creation timestamp, used flag
**Security Properties**: Single-use, expires after 5 minutes, validates session continuity

---

## Dependencies _(optional)_

### Upstream Dependencies

- PRP-015 (Payment Integration) - Security hardening builds on existing payment system
- PRP-016 (User Authentication) - Security hardening fixes issues in existing auth system

### Downstream Impact

- All features using authentication (profile, payment, protected routes)
- Payment webhook processing (idempotency)
- Security compliance posture (GDPR, PCI)

---

## Security & Compliance _(optional)_

### Security Standards

- **OWASP Top 10 (2021)**: Addresses A01 (Broken Access Control), A02 (Cryptographic Failures), A03 (Injection), A07 (Authentication Failures)
- **GDPR Compliance**: Audit logging for data access, session timeout for privacy
- **PCI DSS**: Payment data isolation, secure authentication, audit trails

### Threat Model

- **CSRF Attacks**: Mitigated by REQ-SEC-004 (CSRF tokens)
- **OAuth Hijacking**: Mitigated by REQ-SEC-002 (state validation)
- **Brute Force**: Mitigated by REQ-SEC-003 (server-side rate limiting)
- **Data Isolation Breach**: Mitigated by REQ-SEC-001 (user ID enforcement)
- **Prototype Pollution**: Mitigated by REQ-SEC-005 (metadata validation)
- **SQL Injection**: Already mitigated by Supabase parameterized queries (verified ✅)
- **XSS**: Already mitigated by React JSX escaping (verified ✅)

### Risk Assessment

- **Before Hardening**: Critical vulnerabilities (payment data leakage, OAuth CSRF, bypassable rate limiting)
- **After Hardening**: Hardened security posture, production-ready authentication and payment systems
- **Residual Risks**: Social engineering, phishing (out of scope), advanced persistent threats (requires monitoring)

---

## Success Metrics _(optional)_

### Security Metrics

- **Zero cross-user data leakage incidents** (REQ-SEC-001)
- **Zero successful OAuth hijacking attempts** (REQ-SEC-002)
- **Zero successful brute force attacks** (REQ-SEC-003)
- **100% of security events logged** (REQ-SEC-007)

### User Experience Metrics

- **Reduction in weak passwords created** (REQ-UX-001 - password strength indicator)
- **Reduction in support tickets for locked accounts** (clear rate limit feedback)
- **Improved OAuth success rate** (better error handling)

### Operational Metrics

- **100% of expired payment intents cleaned up** (REQ-OPS-001)
- **95%+ webhook processing success rate** (after retries, REQ-REL-002)
- **Zero production console.log leaks** (REQ-POLISH-001)

---

## Review Checklist _(internal)_

- [x] No implementation details (libraries, frameworks, APIs) in requirements
- [x] All requirements explain WHAT and WHY, not HOW
- [x] Each requirement is independently testable
- [x] Security requirements mapped to business value (user trust, compliance)
- [x] Edge cases and attack scenarios covered
- [x] Acceptance criteria are objective and measurable
- [x] Written for security/business stakeholders, not developers
- [x] Critical issues clearly marked as P0 (production blockers)
- [x] User scenarios demonstrate security failures and corrections
