# Data Model: Row Level Security Foundation

**Feature**: 000-rls-implementation
**Date**: 2026-01-15

## Entity Definitions

### users

**Source**: Supabase Auth (auth.users)
**Purpose**: Authentication records managed by Supabase Auth

| Field      | Type        | Constraints             | Description                          |
| ---------- | ----------- | ----------------------- | ------------------------------------ |
| id         | uuid        | PK                      | User identifier (from Supabase Auth) |
| email      | text        | UNIQUE, NOT NULL        | User email address                   |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Account creation timestamp           |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last update timestamp                |

**RLS Policies**:

- SELECT: Owner only (`id = auth.uid()`)
- INSERT/UPDATE/DELETE: Managed by Supabase Auth (no direct access)

**Note**: This is the `auth.users` table managed by Supabase. We don't create this table but reference it for RLS policies on related tables.

---

### profiles

**Purpose**: User-customizable information extending auth.users

| Field        | Type        | Constraints             | Description                |
| ------------ | ----------- | ----------------------- | -------------------------- |
| id           | uuid        | PK, FK(auth.users.id)   | Same as user ID            |
| display_name | text        |                         | User's display name        |
| avatar_url   | text        |                         | URL to avatar image        |
| bio          | text        |                         | User biography/description |
| created_at   | timestamptz | NOT NULL, DEFAULT now() | Profile creation timestamp |
| updated_at   | timestamptz | NOT NULL, DEFAULT now() | Last update timestamp      |

**RLS Policies**:

- SELECT: Owner only (`id = auth.uid()`)
- INSERT: Service role only (created on user signup via trigger)
- UPDATE: Owner only (`id = auth.uid()`)
- DELETE: Denied (soft delete via status flag if needed)

**Indexes**:

- `idx_profiles_id` on `id` (implicit from PK)

---

### sessions

**Source**: Supabase Auth (auth.sessions)
**Purpose**: Active user sessions with tokens and expiration

| Field      | Type        | Constraints                 | Description                    |
| ---------- | ----------- | --------------------------- | ------------------------------ |
| id         | uuid        | PK                          | Session identifier             |
| user_id    | uuid        | FK(auth.users.id), NOT NULL | Owner user                     |
| created_at | timestamptz | NOT NULL                    | Session start time             |
| updated_at | timestamptz | NOT NULL                    | Last activity time             |
| factor_id  | uuid        |                             | MFA factor if applicable       |
| aal        | text        |                             | Authentication assurance level |
| not_after  | timestamptz |                             | Session expiration             |

**RLS Policies**:

- SELECT: Owner only (`user_id = auth.uid()`)
- INSERT/UPDATE/DELETE: Managed by Supabase Auth

**Note**: This is the `auth.sessions` table managed by Supabase. We reference it but don't create policies directly.

---

### audit_logs

**Purpose**: Security event records for compliance and debugging

| Field      | Type        | Constraints                   | Description                                           |
| ---------- | ----------- | ----------------------------- | ----------------------------------------------------- |
| id         | uuid        | PK, DEFAULT gen_random_uuid() | Log entry identifier                                  |
| user_id    | uuid        | FK(auth.users.id)             | User who triggered event (nullable for system events) |
| event_type | text        | NOT NULL                      | Type of event (login, logout, policy_violation, etc.) |
| details    | jsonb       | DEFAULT '{}'                  | Event-specific details                                |
| ip_address | inet        |                               | Client IP address                                     |
| user_agent | text        |                               | Client user agent                                     |
| created_at | timestamptz | NOT NULL, DEFAULT now()       | Event timestamp                                       |

**RLS Policies**:

- SELECT: Owner can view own entries (`user_id = auth.uid()`)
- INSERT: Service role only (via Edge Functions)
- UPDATE: Denied for all roles (immutable)
- DELETE: Denied for all roles (immutable)

**Indexes**:

- `idx_audit_logs_user_id` on `user_id`
- `idx_audit_logs_event_type` on `event_type`
- `idx_audit_logs_created_at` on `created_at`

---

## Relationships

```
auth.users (managed by Supabase)
    │
    ├──< profiles (1:1)
    │       └── id = auth.users.id
    │
    ├──< sessions (1:N, managed by Supabase)
    │       └── user_id → auth.users.id
    │
    └──< audit_logs (1:N)
            └── user_id → auth.users.id
```

## Security Roles

| Role            | Description              | Access Level                              |
| --------------- | ------------------------ | ----------------------------------------- |
| `anon`          | Unauthenticated visitors | Public read-only where explicitly allowed |
| `authenticated` | Logged-in users          | Own data only via RLS policies            |
| `service_role`  | Backend services         | Full access, bypasses RLS                 |

## State Transitions

### User Lifecycle

```
[Anonymous] → signup → [Authenticated] → logout → [Anonymous]
                              ↓
                         delete account
                              ↓
                         [Deleted]
```

### Audit Log Events

```
Event Types:
- user.login
- user.logout
- user.signup
- user.delete
- policy.violation
- session.expired
- profile.updated
```

## Validation Rules

| Entity     | Field        | Rule                      |
| ---------- | ------------ | ------------------------- |
| profiles   | display_name | Max 100 characters        |
| profiles   | bio          | Max 500 characters        |
| profiles   | avatar_url   | Valid URL format          |
| audit_logs | event_type   | Must be from allowed enum |
| audit_logs | details      | Valid JSON object         |
