# Phase 1: Data Model

**Feature**: User Authentication & Authorization (PRP-016)
**Date**: 2025-10-05

## Entity Relationship Diagram

```
auth.users (Supabase built-in)
├── id (UUID, PK)
├── email (TEXT, UNIQUE)
├── encrypted_password (TEXT)
├── email_confirmed_at (TIMESTAMPTZ, nullable)
├── created_at (TIMESTAMPTZ)
├── updated_at (TIMESTAMPTZ)
└── last_sign_in_at (TIMESTAMPTZ, nullable)
    │
    ├──< user_profiles (1:1)
    │   ├── id (UUID, PK, FK → auth.users.id)
    │   ├── username (TEXT, UNIQUE, nullable)
    │   ├── display_name (TEXT, nullable)
    │   ├── avatar_url (TEXT, nullable)
    │   ├── bio (TEXT, nullable)
    │   ├── created_at (TIMESTAMPTZ)
    │   └── updated_at (TIMESTAMPTZ)
    │
    ├──< auth_audit_logs (1:N)
    │   ├── id (UUID, PK)
    │   ├── user_id (UUID, FK → auth.users.id)
    │   ├── event_type (TEXT)
    │   ├── event_data (JSONB, nullable)
    │   ├── ip_address (INET, nullable)
    │   ├── user_agent (TEXT, nullable)
    │   └── created_at (TIMESTAMPTZ)
    │
    └──< payment_intents (1:N, existing from PRP-015)
        ├── template_user_id (UUID, FK → auth.users.id)
        └── [other payment fields...]
```

## Entity Definitions

### 1. auth.users (Supabase Built-in)

**Purpose**: Core user authentication managed by Supabase Auth

**Fields**:

- `id` (UUID): Primary key, auto-generated
- `email` (TEXT): User's email address, unique, required
- `encrypted_password` (TEXT): Bcrypt hashed password, managed by Supabase
- `email_confirmed_at` (TIMESTAMPTZ): Timestamp of email verification, null if unverified
- `created_at` (TIMESTAMPTZ): Account creation timestamp
- `updated_at` (TIMESTAMPTZ): Last update timestamp
- `last_sign_in_at` (TIMESTAMPTZ): Last successful sign-in timestamp

**Validation Rules**:

- Email: Valid RFC 5322 format
- Password: Min 8 chars, uppercase, lowercase, number, special char (enforced by Supabase)
- Email unique constraint

**State Transitions**:

1. `created_at` set → `email_confirmed_at` null (unverified)
2. Email verification → `email_confirmed_at` set (verified)
3. Sign-in → `last_sign_in_at` updated

**Access Control**:

- Managed entirely by Supabase Auth
- Users cannot directly query auth.users (security)
- Access via Supabase Auth API only

### 2. user_profiles (Custom Table)

**Purpose**: User-customizable profile information

**Fields**:

- `id` (UUID): Primary key, foreign key to auth.users(id)
- `username` (TEXT): Unique username, nullable, min 3 chars
- `display_name` (TEXT): Display name for UI, nullable
- `avatar_url` (TEXT): URL to avatar image, nullable
- `bio` (TEXT): User biography, nullable, max 500 chars
- `created_at` (TIMESTAMPTZ): Profile creation timestamp
- `updated_at` (TIMESTAMPTZ): Last update timestamp

**Validation Rules**:

- Username: 3-30 chars, alphanumeric + underscore, unique
- Display name: 1-100 chars
- Avatar URL: Valid HTTP(S) URL
- Bio: Max 500 chars

**Relationships**:

- One-to-one with auth.users (CASCADE DELETE)
- Profile created on first sign-in (trigger or client-side)

**State Transitions**:

1. User signs up → Profile created with null fields
2. User updates profile → `updated_at` timestamp refreshed
3. User deletes account → Profile cascade deleted

**Access Control (RLS)**:

```sql
-- Users can view own profile
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update own profile
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Profile created on sign-up (service role)
CREATE POLICY "Service creates profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);
```

### 3. auth_audit_logs (Custom Table)

**Purpose**: Security audit trail for all authentication events

**Fields**:

- `id` (UUID): Primary key, auto-generated
- `user_id` (UUID): Foreign key to auth.users(id), nullable (for failed attempts)
- `event_type` (TEXT): Event type enum (sign_up, sign_in, sign_out, password_change, etc.)
- `event_data` (JSONB): Additional event metadata (no sensitive data)
- `ip_address` (INET): Client IP address, nullable
- `user_agent` (TEXT): Browser user agent, nullable
- `created_at` (TIMESTAMPTZ): Event timestamp

**Event Types** (enum):

- `sign_up`: New user registration
- `sign_in_success`: Successful sign-in
- `sign_in_failed`: Failed sign-in attempt
- `sign_out`: User sign-out
- `password_change`: Password updated
- `password_reset_request`: Password reset email sent
- `password_reset_complete`: Password reset via email link
- `email_verification_sent`: Verification email sent
- `email_verification_complete`: Email verified
- `token_refresh`: Session token refreshed
- `account_delete`: Account deletion initiated

**Validation Rules**:

- Event type: Must be valid enum value
- Event data: Max 5KB JSON
- IP address: Valid IPv4/IPv6 format
- User agent: Max 500 chars

**Relationships**:

- Many-to-one with auth.users (CASCADE DELETE)
- Nullable user_id for pre-auth events (failed sign-in)

**Access Control (RLS)**:

```sql
-- Users can view own logs
CREATE POLICY "Users view own logs" ON auth_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- System can insert logs (service role)
CREATE POLICY "Service creates logs" ON auth_audit_logs
  FOR INSERT WITH CHECK (true);
```

**Retention Policy**:

- Logs retained for 90 days (compliance requirement)
- Automatic cleanup via cron job or database trigger

### 4. Integration with Existing Tables

#### payment_intents (Existing from PRP-015)

**Modified Field**:

- `template_user_id` (UUID): Now references auth.users(id) instead of hardcoded value

**RLS Policy Update**:

```sql
-- Replace demo policy with real auth
CREATE POLICY "Users view own payments" ON payment_intents
  FOR SELECT USING (auth.uid() = template_user_id);
```

**Migration**:

- Remove hardcoded UUID `00000000-0000-0000-0000-000000000000`
- Update payment service to get user_id from auth session
- Ensure all existing test data uses valid auth.users.id

## Database Indexes

### Performance Optimization

```sql
-- User profiles
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_updated_at ON user_profiles(updated_at DESC);

-- Audit logs
CREATE INDEX idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX idx_auth_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX idx_auth_audit_logs_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX idx_auth_audit_logs_ip_address ON auth_audit_logs(ip_address);

-- Composite index for common queries
CREATE INDEX idx_audit_logs_user_event ON auth_audit_logs(user_id, event_type, created_at DESC);
```

## Triggers & Functions

### Auto-update Timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Auto-create Profile on Sign-up

```sql
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, created_at, updated_at)
    VALUES (NEW.id, NOW(), NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();
```

### Audit Log Cleanup

```sql
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM auth_audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule via pg_cron (if available) or external cron
SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT cleanup_old_audit_logs()');
```

## Data Flow Diagrams

### Sign-up Flow

```
1. User submits email/password
   ↓
2. Client validates (email format, password strength)
   ↓
3. Call Supabase: auth.signUp({ email, password })
   ↓
4. Supabase creates auth.users record (email_confirmed_at = null)
   ↓
5. Trigger creates user_profiles record
   ↓
6. Supabase sends verification email
   ↓
7. Log audit event: sign_up
   ↓
8. Return: { user, session: null } (unverified)
```

### Sign-in Flow (Email/Password)

```
1. User submits email/password
   ↓
2. Client validates (email format, non-empty password)
   ↓
3. Check rate limit (localStorage: <5 attempts in 15min)
   ↓
4. Call Supabase: auth.signInWithPassword({ email, password })
   ↓
5. Supabase validates credentials
   ↓
6. If valid: Return { user, session }
   ↓
7. If Remember Me: Set session cookie (30 days)
   ↓
8. Update auth.users.last_sign_in_at
   ↓
9. Log audit event: sign_in_success
   ↓
10. Redirect to dashboard
```

### OAuth Sign-in Flow

```
1. User clicks "Sign in with GitHub"
   ↓
2. Call Supabase: auth.signInWithOAuth({ provider: 'github' })
   ↓
3. Redirect to GitHub authorization page
   ↓
4. User authorizes app
   ↓
5. GitHub redirects to /auth/callback?code=...
   ↓
6. Client exchanges code for session: auth.exchangeCodeForSession(code)
   ↓
7. Supabase creates/updates auth.users record
   ↓
8. If new user: Trigger creates user_profiles record
   ↓
9. Log audit event: sign_in_success
   ↓
10. Redirect to dashboard
```

### Password Reset Flow

```
1. User clicks "Forgot Password", enters email
   ↓
2. Call Supabase: auth.resetPasswordForEmail(email)
   ↓
3. Supabase sends email with reset link
   ↓
4. Log audit event: password_reset_request
   ↓
5. User clicks link → redirects to /reset-password?token=...
   ↓
6. User enters new password
   ↓
7. Call Supabase: auth.updateUser({ password: newPassword })
   ↓
8. Supabase updates encrypted_password
   ↓
9. Log audit event: password_reset_complete
   ↓
10. Redirect to sign-in
```

### Session Validation (Protected Routes)

```
1. User requests protected page (e.g., /payment-demo)
   ↓
2. Next.js middleware intercepts request
   ↓
3. Get session from cookie: supabase.auth.getSession()
   ↓
4. If no session: Redirect to /sign-in
   ↓
5. If session expired: Attempt token refresh
   ↓
6. If refresh succeeds: Continue to page
   ↓
7. If refresh fails: Clear session, redirect to /sign-in
   ↓
8. Log audit event: token_refresh (if refreshed)
```

## Constraints Summary

### Database Constraints

```sql
-- Primary Keys
ALTER TABLE user_profiles ADD CONSTRAINT pk_user_profiles PRIMARY KEY (id);
ALTER TABLE auth_audit_logs ADD CONSTRAINT pk_auth_audit_logs PRIMARY KEY (id);

-- Foreign Keys
ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_user
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE auth_audit_logs ADD CONSTRAINT fk_auth_audit_logs_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Unique Constraints
ALTER TABLE user_profiles ADD CONSTRAINT uq_user_profiles_username UNIQUE (username);

-- Check Constraints
ALTER TABLE user_profiles ADD CONSTRAINT chk_username_length
  CHECK (length(username) >= 3 AND length(username) <= 30);

ALTER TABLE user_profiles ADD CONSTRAINT chk_bio_length
  CHECK (length(bio) <= 500);

ALTER TABLE auth_audit_logs ADD CONSTRAINT chk_event_type_valid
  CHECK (event_type IN (
    'sign_up', 'sign_in_success', 'sign_in_failed', 'sign_out',
    'password_change', 'password_reset_request', 'password_reset_complete',
    'email_verification_sent', 'email_verification_complete',
    'token_refresh', 'account_delete'
  ));
```

### Application-Level Validation

- Email: RFC 5322 format (regex validation)
- Password: Min 8 chars, complexity rules (zxcvbn library)
- Username: Alphanumeric + underscore only
- Avatar URL: Valid HTTP(S) URL (URL.parse validation)
- Event data: Max 5KB JSON (size check before insert)

## Migration Scripts

### Initial Setup (000_create_auth_tables.sql)

```sql
-- Create user profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE CHECK (length(username) >= 3 AND length(username) <= 30),
  display_name TEXT CHECK (length(display_name) <= 100),
  avatar_url TEXT,
  bio TEXT CHECK (length(bio) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create audit logs table
CREATE TABLE auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sign_up', 'sign_in_success', 'sign_in_failed', 'sign_out',
    'password_change', 'password_reset_request', 'password_reset_complete',
    'email_verification_sent', 'email_verification_complete',
    'token_refresh', 'account_delete'
  )),
  event_data JSONB,
  ip_address INET,
  user_agent TEXT CHECK (length(user_agent) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;

-- [RLS policies and indexes as defined above...]
```

### Integration with Payment System (001_update_payment_rls.sql)

```sql
-- Update payment_intents RLS policy
DROP POLICY IF EXISTS "Demo users view payments" ON payment_intents;

CREATE POLICY "Users view own payments" ON payment_intents
  FOR SELECT USING (auth.uid() = template_user_id);

CREATE POLICY "Users create own payments" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

-- Update payment_results RLS policy
DROP POLICY IF EXISTS "Demo users view results" ON payment_results;

CREATE POLICY "Users view own results" ON payment_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM payment_intents
      WHERE payment_intents.id = payment_results.intent_id
      AND payment_intents.template_user_id = auth.uid()
    )
  );
```

## Next Steps

Data model complete. Ready for contract generation (Phase 1 continued).
