# Research: Row Level Security Foundation

**Feature**: 000-rls-implementation
**Date**: 2026-01-15
**Status**: Complete

## Research Tasks

### 1. Supabase RLS Policy Patterns

**Decision**: Use `auth.uid()` for owner isolation with simple equality checks

**Rationale**:

- `auth.uid()` is the standard Supabase function that extracts the authenticated user's ID from the JWT
- Simple equality checks (`user_id = auth.uid()`) are optimized by PostgreSQL
- Avoids subqueries which can impact performance

**Alternatives Considered**:

- Custom JWT claims: More complex, requires additional setup
- Application-level filtering: Insecure, relies on client code
- Database views: Additional complexity without security benefits

**Pattern Template**:

```sql
-- Owner isolation (SELECT/UPDATE/DELETE)
CREATE POLICY "Users can access own data"
ON table_name FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Owner insert (INSERT)
CREATE POLICY "Users can insert own data"
ON table_name FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
```

---

### 2. Service Role Bypass Pattern

**Decision**: Use `TO authenticated` role specification; service_role bypasses by default

**Rationale**:

- Supabase service_role has `bypassrls` privilege by default
- No explicit policy needed for service role operations
- Policies target `authenticated` and `anon` roles only

**Alternatives Considered**:

- Explicit service role policies: Unnecessary, adds complexity
- Security definer functions: More secure but over-engineered for this use case
- Separate service tables: Defeats purpose of unified data model

**Implementation**:

```sql
-- Service role bypasses all policies automatically
-- No explicit policy needed
-- Use service role client for backend operations:
-- createClient(url, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
```

---

### 3. Audit Log Immutability

**Decision**: Use separate policies per operation with explicit denials

**Rationale**:

- INSERT only via service_role (not authenticated users)
- UPDATE/DELETE denied for all roles (immutable)
- SELECT restricted to own entries for users

**Alternatives Considered**:

- Trigger-based blocking: More complex, harder to test
- Separate audit database: Over-engineered for current scale
- Application-level immutability: Insecure, can be bypassed

**Pattern**:

```sql
-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- No INSERT policy = denied for authenticated/anon
-- Service role bypasses to insert

-- Users can only see their own audit entries
CREATE POLICY "Users can view own audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- No UPDATE/DELETE policies = denied for all
```

---

### 4. Anonymous Access Restrictions

**Decision**: Explicit public tables with narrow SELECT policies

**Rationale**:

- Default deny: no policy = no access
- Only explicitly public data gets anon SELECT policy
- Write operations never allowed for anon

**Alternatives Considered**:

- Public schema separation: Over-engineered
- JWT-less authentication: Defeats purpose
- Allowlist approach: What we're implementing

**Pattern**:

```sql
-- Public content (e.g., blog posts)
CREATE POLICY "Anyone can read public content"
ON public_content FOR SELECT
TO anon, authenticated
USING (is_published = true);

-- Never allow anon writes (no INSERT/UPDATE/DELETE policies for anon)
```

---

### 5. Testing RLS Policies

**Decision**: Use Supabase client with different auth contexts in tests

**Rationale**:

- Create test users via service role
- Execute queries as different users to verify isolation
- Use `supabase.auth.signInWithPassword()` to get user context

**Alternatives Considered**:

- Direct SQL testing: Doesn't test through Supabase client
- Mock-based testing: Doesn't verify actual policy behavior
- Production testing: Dangerous, use staging environment

**Test Structure**:

```typescript
// Test helper to create authenticated client
async function createAuthenticatedClient(email: string, password: string) {
  const client = createClient(url, anonKey);
  await client.auth.signInWithPassword({ email, password });
  return client;
}

// Test: User A cannot see User B's data
test('user isolation', async () => {
  const clientA = await createAuthenticatedClient('a@test.com', 'pass');
  const clientB = await createAuthenticatedClient('b@test.com', 'pass');

  // User A creates data
  await clientA.from('profiles').insert({ user_id: userAId, ... });

  // User B queries - should not see User A's data
  const { data } = await clientB.from('profiles').select();
  expect(data).not.toContainEqual(expect.objectContaining({ user_id: userAId }));
});
```

---

### 6. Performance Considerations

**Decision**: Simple policies with indexed columns only

**Rationale**:

- `user_id` columns must be indexed for policy performance
- Avoid functions in policies (except auth.uid())
- No subqueries or joins in policy definitions

**Alternatives Considered**:

- Complex policies with business logic: Performance impact
- Materialized security views: Over-engineered
- Caching layer: Adds complexity without clear benefit

**Best Practices**:

```sql
-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Policy uses indexed column with simple equality
CREATE POLICY "..." USING (user_id = auth.uid());
```

---

## Summary of Decisions

| Topic              | Decision                                           |
| ------------------ | -------------------------------------------------- |
| Owner isolation    | `user_id = auth.uid()` pattern                     |
| Service role       | Bypasses by default, no explicit policy            |
| Audit immutability | No UPDATE/DELETE policies, INSERT via service only |
| Anonymous access   | Explicit public tables, SELECT only                |
| Testing            | Multi-user client tests with real auth             |
| Performance        | Simple policies, indexed columns                   |

## Dependencies Confirmed

- Supabase project with RLS capability (any tier)
- PostgreSQL 15+ (standard Supabase)
- @supabase/supabase-js v2.x
- @supabase/ssr for Next.js integration
