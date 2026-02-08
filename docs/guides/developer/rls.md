# Row-Level Security (RLS) Guide

Comprehensive guide to implementing and testing RLS policies in ScriptHammer.

---

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Policy Patterns](#policy-patterns)
- [Implementation Guide](#implementation-guide)
- [Testing RLS](#testing-rls)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)
- [Security Checklist](#security-checklist)

---

## Overview

### What is Row-Level Security?

Row-Level Security (RLS) is a PostgreSQL feature that restricts which rows a user can access in a table. Instead of managing permissions in application code, RLS enforces access control at the database level.

```
┌─────────────────────────────────────────────────────────────┐
│                     Without RLS                              │
│  App Code → "SELECT * FROM profiles WHERE user_id = ?"      │
│  Risk: Developer forgets WHERE clause → data leak           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      With RLS                                │
│  App Code → "SELECT * FROM profiles"                        │
│  Database → Automatically filters to user's rows only       │
│  Guarantee: Cannot leak data even with buggy code           │
└─────────────────────────────────────────────────────────────┘
```

### Why RLS Matters

| Benefit              | Description                                    |
| -------------------- | ---------------------------------------------- |
| **Defense in depth** | Security at database level, not just app level |
| **Cannot bypass**    | Client-side code cannot circumvent policies    |
| **Simpler app code** | No WHERE clauses needed for authorization      |
| **Audit-friendly**   | Policies are visible and reviewable            |
| **Zero trust**       | Even leaked credentials have limited access    |

### ScriptHammer RLS Requirements

- All tables MUST have RLS enabled
- Zero tolerance for cross-user data access
- Policy overhead < 10ms per query
- All policies MUST have integration tests

---

## Core Concepts

### Supabase Roles

Supabase provides three built-in roles:

| Role            | Description           | JWT Claim                       |
| --------------- | --------------------- | ------------------------------- |
| `anon`          | Unauthenticated users | No JWT or invalid JWT           |
| `authenticated` | Logged-in users       | Valid JWT with `sub` claim      |
| `service_role`  | Backend services      | Service role key (bypasses RLS) |

### Auth Helper Functions

Supabase provides functions to use in RLS policies:

```sql
-- Get the current user's UUID (from JWT sub claim)
auth.uid()

-- Get the current role (anon, authenticated, service_role)
auth.role()

-- Get the full JWT payload
auth.jwt()

-- Get a specific JWT claim
auth.jwt() ->> 'email'
```

### Policy Structure

```sql
CREATE POLICY "policy_name"
  ON table_name
  FOR operation           -- SELECT, INSERT, UPDATE, DELETE, or ALL
  TO role                 -- anon, authenticated, or public
  USING (expression)      -- Filter for SELECT, UPDATE, DELETE
  WITH CHECK (expression) -- Validation for INSERT, UPDATE
```

**Key difference**:

- `USING`: Filters which existing rows are visible/modifiable
- `WITH CHECK`: Validates new/updated row data is allowed

---

## Policy Patterns

ScriptHammer uses four standard RLS patterns:

### Pattern 1: Owner Isolation

Users can only access their own data.

```sql
-- Enable RLS on table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)      -- Can only see own row
  WITH CHECK (auth.uid() = user_id); -- Can only update own row
```

**When to use**: Any table with user-owned data (profiles, preferences, messages)

### Pattern 2: Service Role Bypass

Backend services need full access for system operations.

```sql
-- Service role can do anything (implicitly bypasses RLS)
-- No policy needed - service_role bypasses RLS by default

-- But document expected service role operations:
COMMENT ON TABLE profiles IS
  'Service role usage: User creation, admin operations, data exports';
```

**Important**: Service role automatically bypasses RLS. Document its usage for audit purposes.

### Pattern 3: Immutable Audit

Audit logs can only be created, never modified or deleted.

```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can INSERT (via triggers or edge functions)
-- No policy for authenticated users to insert

-- Users can read their own audit entries
CREATE POLICY "Users can read own audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No UPDATE policy = updates denied
-- No DELETE policy = deletes denied
```

**When to use**: Security logs, transaction history, compliance records

### Pattern 4: Public Read

Some content is publicly readable but write-protected.

```sql
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts
CREATE POLICY "Public can read published posts"
  ON blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Only author can update their posts
CREATE POLICY "Authors can update own posts"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Only author can insert posts (as themselves)
CREATE POLICY "Authors can create posts"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);
```

**When to use**: Blog posts, public profiles, shared resources

---

## Implementation Guide

### Step 1: Enable RLS on Table

```sql
-- Always enable RLS before creating policies
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner (important for security)
ALTER TABLE your_table FORCE ROW LEVEL SECURITY;
```

### Step 2: Choose Pattern

| Data Type               | Pattern         | Example                   |
| ----------------------- | --------------- | ------------------------- |
| User-owned private data | Owner Isolation | profiles, settings        |
| System/audit records    | Immutable Audit | audit_logs, events        |
| Shared public content   | Public Read     | blog_posts, announcements |
| Admin-only data         | Service Bypass  | system_config             |

### Step 3: Create Policies

Follow the CRUD order for clarity:

```sql
-- 1. SELECT (who can read?)
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. INSERT (who can create? what data?)
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE (who can modify? what fields?)
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. DELETE (who can delete? or use soft delete?)
-- Typically: no DELETE policy for soft delete pattern
```

### Step 4: Test Policies

See [Testing RLS](#testing-rls) section below.

### Core Tables Reference

#### users table

```sql
-- Users table is managed by Supabase Auth
-- Custom policies for extended user data only

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- No INSERT/UPDATE/DELETE - managed by auth service
```

#### profiles table

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Read own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Profile created by trigger on user signup (service role)
-- No INSERT policy for authenticated users

-- Update own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No DELETE - soft delete via updated_at or deleted_at flag
```

#### audit_logs table

```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Users can view their own audit entries
CREATE POLICY "audit_logs_select_own"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT only via service role (triggers, edge functions)
-- No INSERT policy for authenticated users

-- No UPDATE policy - audit logs are immutable
-- No DELETE policy - audit logs are permanent
```

#### sessions table

```sql
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users can see their own active sessions
CREATE POLICY "sessions_select_own"
  ON sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Sessions managed by auth service (service role)
-- No INSERT/UPDATE/DELETE for authenticated users
```

---

## Testing RLS

### Test Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    RLS Test Pyramid                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    ┌───────────────┐                        │
│                    │  Penetration  │  Manual security audit │
│                    └───────────────┘                        │
│                                                              │
│               ┌─────────────────────────┐                   │
│               │   Integration Tests     │  Automated E2E    │
│               └─────────────────────────┘                   │
│                                                              │
│        ┌─────────────────────────────────────────┐          │
│        │           Unit Tests (SQL)              │  Per-policy│
│        └─────────────────────────────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Unit Tests (SQL)

Test policies directly in PostgreSQL:

```sql
-- Test setup: Create test users
INSERT INTO auth.users (id, email) VALUES
  ('user-a-uuid', 'user-a@test.com'),
  ('user-b-uuid', 'user-b@test.com');

-- Test as User A
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'user-a-uuid';

-- Test 1: User A can see own profile
SELECT * FROM profiles WHERE user_id = 'user-a-uuid';
-- Expected: 1 row

-- Test 2: User A cannot see User B's profile
SELECT * FROM profiles WHERE user_id = 'user-b-uuid';
-- Expected: 0 rows (not an error, just empty)

-- Test 3: User A cannot update User B's profile
UPDATE profiles SET display_name = 'Hacked!'
WHERE user_id = 'user-b-uuid';
-- Expected: 0 rows affected

-- Reset
RESET ROLE;
```

### Integration Tests (TypeScript)

Test RLS through the Supabase client:

```typescript
// tests/integration/rls/profiles.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Profiles RLS', () => {
  let userAClient: SupabaseClient;
  let userBClient: SupabaseClient;

  beforeAll(async () => {
    // Create authenticated clients for two test users
    userAClient = await createAuthenticatedClient('user-a@test.com');
    userBClient = await createAuthenticatedClient('user-b@test.com');
  });

  it('user can read own profile', async () => {
    const { data, error } = await userAClient
      .from('profiles')
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data.email).toBe('user-a@test.com');
  });

  it('user cannot read other profiles directly', async () => {
    const { data } = await userAClient
      .from('profiles')
      .select('*')
      .eq('user_id', 'user-b-uuid');

    // RLS returns empty result, not error
    expect(data).toHaveLength(0);
  });

  it('user cannot update other profiles', async () => {
    const { data, error } = await userAClient
      .from('profiles')
      .update({ display_name: 'Hacked!' })
      .eq('user_id', 'user-b-uuid');

    // No rows affected
    expect(data).toHaveLength(0);
  });

  it('anon cannot read any profiles', async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data } = await anonClient.from('profiles').select('*');

    expect(data).toHaveLength(0);
  });
});
```

### Test Scenarios Checklist

For each table with RLS, test these scenarios:

| Scenario                  | Expected Result       |
| ------------------------- | --------------------- |
| Owner reads own data      | Returns data          |
| Owner updates own data    | Success               |
| Owner deletes own data    | Success (if allowed)  |
| User reads other's data   | Empty result          |
| User updates other's data | 0 rows affected       |
| User deletes other's data | 0 rows affected       |
| Anon reads protected data | Empty result or error |
| Anon writes to any table  | Error                 |
| Service role reads all    | Returns all data      |
| Service role writes all   | Success               |

---

## Performance Optimization

### Policy Performance Rules

1. **Use indexed columns in policies**

   ```sql
   -- Good: user_id is typically indexed
   USING (auth.uid() = user_id)

   -- Bad: requires full table scan
   USING (email LIKE '%@company.com')
   ```

2. **Avoid subqueries when possible**

   ```sql
   -- Slower: subquery evaluated per row
   USING (
     EXISTS (
       SELECT 1 FROM group_members
       WHERE group_id = messages.group_id
       AND user_id = auth.uid()
     )
   )

   -- Faster: join in application query instead
   -- Or create a security definer function
   ```

3. **Use security definer functions for complex logic**

   ```sql
   CREATE OR REPLACE FUNCTION user_can_access_group(group_uuid UUID)
   RETURNS BOOLEAN
   LANGUAGE sql
   SECURITY DEFINER
   STABLE
   AS $$
     SELECT EXISTS (
       SELECT 1 FROM group_members
       WHERE group_id = group_uuid
       AND user_id = auth.uid()
     );
   $$;

   -- Policy uses function
   USING (user_can_access_group(group_id))
   ```

### Measuring Policy Overhead

```sql
-- Check query plan with RLS
EXPLAIN ANALYZE
SELECT * FROM profiles;

-- Look for:
-- - Index scans (good) vs sequential scans (bad)
-- - Filter cost
-- - Total execution time

-- Target: < 10ms overhead from RLS policies
```

### Common Performance Issues

| Issue             | Symptom                       | Solution                      |
| ----------------- | ----------------------------- | ----------------------------- |
| Missing index     | Sequential scan in EXPLAIN    | Add index on policy columns   |
| Complex subquery  | High filter cost              | Use security definer function |
| Multiple policies | Policies evaluated OR         | Combine into single policy    |
| Function call     | Function re-evaluated per row | Mark function as STABLE       |

---

## Troubleshooting

### Common Issues

#### "permission denied for table"

**Cause**: RLS is enabled but no policy grants access.

**Solution**: Create appropriate policy or check role.

```sql
-- Verify RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'your_table';

-- List existing policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

#### Query returns empty when data exists

**Cause**: RLS policy filters out all rows for current user.

**Solution**: Verify auth context and policy conditions.

```sql
-- Check current auth context
SELECT auth.uid(), auth.role();

-- Test policy condition manually
SELECT * FROM your_table WHERE auth.uid() = user_id;
```

#### Service role operations fail

**Cause**: Using anon key instead of service role key.

**Solution**: Verify you're using the correct key.

```typescript
// Wrong: anon key doesn't bypass RLS
const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Correct: service role key bypasses RLS
const adminClient = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
```

#### Policy not applied to table owner

**Cause**: Table owner bypasses RLS by default.

**Solution**: Use FORCE ROW LEVEL SECURITY.

```sql
ALTER TABLE your_table FORCE ROW LEVEL SECURITY;
```

### Debug Queries

```sql
-- Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'profiles';

-- List all policies on a table
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- Check current user context
SELECT
  current_user,
  session_user,
  auth.uid() as auth_uid,
  auth.role() as auth_role;
```

---

## Security Checklist

### Before Deployment

- [ ] RLS enabled on ALL tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] RLS forced on all tables (`ALTER TABLE ... FORCE ROW LEVEL SECURITY`)
- [ ] No tables with `relrowsecurity = false` in production
- [ ] Service role key NOT exposed in client code
- [ ] Service role key stored in environment variables
- [ ] All policies have integration tests
- [ ] Cross-user access tested and verified blocked

### Policy Review Checklist

For each policy, verify:

- [ ] Policy name describes its purpose
- [ ] Correct operation (SELECT/INSERT/UPDATE/DELETE)
- [ ] Correct role (anon/authenticated)
- [ ] USING clause correctly filters rows
- [ ] WITH CHECK clause validates new data
- [ ] Policy uses indexed columns
- [ ] No unnecessary complexity

### Audit Queries

Run these before each release:

```sql
-- Find tables without RLS
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT tablename FROM pg_policies
);

-- Find tables with RLS disabled
SELECT relname
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
AND relrowsecurity = false;

-- Count policies per table
SELECT tablename, COUNT(*)
FROM pg_policies
GROUP BY tablename
ORDER BY COUNT(*) DESC;
```

---

## Quick Reference

### Policy Templates

```sql
-- Owner isolation (most common)
CREATE POLICY "table_select_own" ON table
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "table_update_own" ON table
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public read
CREATE POLICY "table_select_public" ON table
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

-- Insert as self
CREATE POLICY "table_insert_own" ON table
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### Auth Functions

| Function                 | Returns | Use Case          |
| ------------------------ | ------- | ----------------- |
| `auth.uid()`             | UUID    | Current user's ID |
| `auth.role()`            | text    | Current role name |
| `auth.jwt()`             | json    | Full JWT payload  |
| `auth.jwt() ->> 'email'` | text    | Specific claim    |

### Environment Variables

```bash
# Client-safe (public)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Server-only (secret)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # NEVER expose to client
```

---

## Further Reading

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
