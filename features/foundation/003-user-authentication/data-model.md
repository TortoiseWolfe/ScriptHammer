# Data Model: User Authentication & Authorization

**Feature**: 003-user-authentication | **Date**: 2026-01-15

## Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│   auth.users        │       │   profiles          │
│   (Supabase)        │       │   (custom)          │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │──1:1──│ id (PK, FK)         │
│ email               │       │ display_name        │
│ encrypted_password  │       │ username            │
│ email_confirmed_at  │       │ avatar_url          │
│ created_at          │       │ bio                 │
│ updated_at          │       │ created_at          │
│ last_sign_in_at     │       │ updated_at          │
└─────────────────────┘       └─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐       ┌─────────────────────┐
│   auth.sessions     │       │   login_attempts    │
│   (Supabase)        │       │   (custom)          │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │       │ id (PK)             │
│ user_id (FK)        │       │ email               │
│ created_at          │       │ attempted_at        │
│ updated_at          │       │ success             │
│ factor_id           │       │ ip_address          │
│ aal                 │       └─────────────────────┘
│ not_after           │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐
│   auth.refresh_tkns │
│   (Supabase)        │
├─────────────────────┤
│ id (PK)             │
│ token               │
│ user_id (FK)        │
│ parent              │
│ session_id (FK)     │
│ created_at          │
│ updated_at          │
│ revoked             │
└─────────────────────┘
```

## Entity Definitions

### 1. User Account (auth.users - Supabase Managed)

**Purpose**: Core user identity managed by Supabase Auth.

| Field              | Type         | Constraints             | Description                  |
| ------------------ | ------------ | ----------------------- | ---------------------------- |
| id                 | UUID         | PK, NOT NULL            | Unique user identifier       |
| email              | VARCHAR(255) | UNIQUE, NOT NULL        | User email address           |
| encrypted_password | TEXT         | NULL (OAuth users)      | bcrypt-hashed password       |
| email_confirmed_at | TIMESTAMPTZ  | NULL                    | When email was verified      |
| created_at         | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW() | Account creation time        |
| updated_at         | TIMESTAMPTZ  | NOT NULL                | Last modification time       |
| last_sign_in_at    | TIMESTAMPTZ  | NULL                    | Last successful sign-in      |
| raw_app_meta_data  | JSONB        | DEFAULT '{}'            | App metadata (providers)     |
| raw_user_meta_data | JSONB        | DEFAULT '{}'            | User metadata (name, avatar) |

**Validation Rules**:

- Email must be valid format (RFC 5322)
- Password minimum 8 chars with complexity requirements

**State Transitions**:

- Created → Unverified (email_confirmed_at = NULL)
- Unverified → Verified (email_confirmed_at = NOW())
- Verified → Deleted (cascade delete)

---

### 2. User Profile (profiles - Custom Table)

**Purpose**: User-editable profile information, separate from auth.

| Field        | Type         | Constraints             | Description            |
| ------------ | ------------ | ----------------------- | ---------------------- |
| id           | UUID         | PK, FK → auth.users     | User ID reference      |
| display_name | VARCHAR(100) | NULL                    | Public display name    |
| username     | VARCHAR(50)  | UNIQUE, NULL            | Unique username handle |
| avatar_url   | TEXT         | NULL                    | Profile image URL      |
| bio          | TEXT         | NULL, MAX 500           | User biography         |
| created_at   | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW() | Profile creation time  |
| updated_at   | TIMESTAMPTZ  | NOT NULL                | Last update time       |

**Validation Rules**:

- Username: lowercase alphanumeric, hyphens, 3-50 chars
- Display name: 1-100 chars
- Bio: max 500 chars

**RLS Policies**:

- SELECT: Authenticated users can read any profile
- INSERT: Users can create their own profile only
- UPDATE: Users can update their own profile only
- DELETE: Cascade delete with auth.users

---

### 3. Authentication Session (auth.sessions - Supabase Managed)

**Purpose**: Track active user sessions for multi-device support.

| Field      | Type        | Constraints     | Description          |
| ---------- | ----------- | --------------- | -------------------- |
| id         | UUID        | PK              | Session identifier   |
| user_id    | UUID        | FK → auth.users | Owner user           |
| created_at | TIMESTAMPTZ | NOT NULL        | Session start time   |
| updated_at | TIMESTAMPTZ | NOT NULL        | Last activity time   |
| factor_id  | UUID        | NULL            | MFA factor if used   |
| aal        | VARCHAR     | NOT NULL        | Auth assurance level |
| not_after  | TIMESTAMPTZ | NULL            | Session expiry time  |

**Session Expiry Logic**:

- Default: 7 days (not_after = created_at + 7 days)
- Remember Me: 30 days (not_after = created_at + 30 days)
- Auto-refresh extends expiry on activity

---

### 4. Login Attempts (login_attempts - Custom Table)

**Purpose**: Track failed login attempts for rate limiting.

| Field        | Type        | Constraints                   | Description          |
| ------------ | ----------- | ----------------------------- | -------------------- |
| id           | UUID        | PK, DEFAULT gen_random_uuid() | Attempt identifier   |
| email        | TEXT        | NOT NULL                      | Attempted email      |
| attempted_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()       | Attempt timestamp    |
| success      | BOOLEAN     | NOT NULL, DEFAULT FALSE       | Was login successful |
| ip_address   | INET        | NULL                          | Client IP address    |

**Indexes**:

- `idx_login_attempts_email_time` ON (email, attempted_at DESC)

**Rate Limit Rule**:

- Max 5 failed attempts per email per 15 minutes
- After 5 failures: 15-minute lockout

---

### 5. Refresh Tokens (auth.refresh_tokens - Supabase Managed)

**Purpose**: Manage token refresh for seamless session continuity.

| Field      | Type         | Constraints        | Description             |
| ---------- | ------------ | ------------------ | ----------------------- |
| id         | BIGINT       | PK                 | Token identifier        |
| token      | VARCHAR(255) | UNIQUE             | Refresh token value     |
| user_id    | UUID         | FK → auth.users    | Token owner             |
| parent     | VARCHAR(255) | NULL               | Parent token (rotation) |
| session_id | UUID         | FK → auth.sessions | Associated session      |
| created_at | TIMESTAMPTZ  | NOT NULL           | Token creation time     |
| updated_at | TIMESTAMPTZ  | NOT NULL           | Last use time           |
| revoked    | BOOLEAN      | DEFAULT FALSE      | Token revocation status |

**Token Rotation**:

- New token issued on each refresh
- Parent token marked as used
- Reuse of parent token revokes entire session (security)

---

## Type Definitions (TypeScript)

```typescript
// src/lib/auth/types.ts

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  lastSignInAt: Date | null;
}

export interface Profile {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  isRememberMe: boolean;
}

export interface LoginAttempt {
  id: string;
  email: string;
  attemptedAt: Date;
  success: boolean;
  ipAddress: string | null;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'unverified'; user: User }
  | { status: 'authenticated'; user: User; session: Session };
```

## Migration Dependencies

1. **auth.users** - Managed by Supabase (no migration needed)
2. **profiles** - Requires migration, triggers on user creation
3. **login_attempts** - Requires migration
4. **auth.sessions** - Managed by Supabase (no migration needed)
5. **auth.refresh_tokens** - Managed by Supabase (no migration needed)

See [contracts/rls-policies.sql](./contracts/rls-policies.sql) for complete migration script.
