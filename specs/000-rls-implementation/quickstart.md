# Quickstart: Row Level Security Foundation

**Feature**: 000-rls-implementation
**Estimated Setup**: 15 minutes

## Prerequisites

- Supabase project created (any tier)
- Supabase URL and keys available
- Docker environment running

## Step 1: Apply RLS Policies

Execute the migration via Supabase Dashboard:

1. Go to Supabase Dashboard > SQL Editor
2. Copy contents of `contracts/rls-policies.sql`
3. Execute the SQL
4. Verify: Check "Authentication > Policies" tab

**Alternative**: Use Supabase Management API:

```bash
curl -X POST 'https://api.supabase.com/v1/projects/{ref}/database/query' \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "..."}'
```

## Step 2: Configure Environment

Create `.env.local` (not committed):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important**: `SUPABASE_SERVICE_ROLE_KEY` is server-only, never exposed to client.

## Step 3: Verify Setup

Run verification queries in SQL Editor:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('profiles', 'audit_logs');

-- Expected: Both show rowsecurity = true

-- Check policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public';

-- Expected:
-- profiles | profiles_select_own | SELECT
-- profiles | profiles_update_own | UPDATE
-- audit_logs | audit_logs_select_own | SELECT
```

## Step 4: Test User Isolation

Create two test users and verify isolation:

```typescript
// In your test file or REPL
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Sign up User A
await supabase.auth.signUp({
  email: 'usera@test.com',
  password: 'testpassword123',
});

// Sign up User B (in new client or after signOut)
await supabase.auth.signUp({
  email: 'userb@test.com',
  password: 'testpassword123',
});

// Sign in as User A
await supabase.auth.signInWithPassword({
  email: 'usera@test.com',
  password: 'testpassword123',
});

// Query profiles - should only see User A's profile
const { data } = await supabase.from('profiles').select('*');
console.log(data); // Should contain exactly 1 profile (User A's)
```

## Common Issues

### "permission denied for table profiles"

- RLS is enabled but no policy matches
- Check: Is user authenticated? Run `supabase.auth.getUser()`
- Check: Does policy exist? Run verification query above

### "new row violates row-level security policy"

- Trying to INSERT/UPDATE data you don't own
- Check: Is `user_id` or `id` matching `auth.uid()`?

### Audit logs not being created

- Signup trigger might have failed
- Check: Run `SELECT * FROM public.audit_logs;` as service role
- Check: Trigger exists in Database > Triggers

## Step 5: Run Automated Tests

Execute the RLS test suite:

```bash
# Run all RLS tests
npm run test -- tests/rls/

# Run specific test file
npm run test -- tests/rls/user-isolation.test.ts
```

**Test Coverage**:

- `user-isolation.test.ts` - User data isolation (US1, US2)
- `service-role.test.ts` - Service role operations (US3)
- `anonymous-access.test.ts` - Anonymous restrictions (US4)
- `audit-immutability.test.ts` - Audit log protection (US5)

## Service Role Usage Pattern

For backend operations that need to bypass RLS:

```typescript
import { createServiceRoleClient } from '@/lib/supabase/server';

// In an Edge Function or server-side code only
export async function adminOperation() {
  const supabase = createServiceRoleClient();

  // This bypasses all RLS policies
  const { data } = await supabase.from('profiles').select('*');

  // Log the operation for audit trail
  await supabase.from('audit_logs').insert({
    event_type: 'profile.updated',
    details: { operation: 'admin_read' },
  });

  return data;
}
```

**Security Rules**:

- Never import `createServiceRoleClient` in client components
- Always log service role operations
- Use for legitimate backend needs only

## Next Steps

After verifying RLS foundation:

1. Run RLS test suite: `npm run test -- tests/rls/`
2. Review test results - all 5 user stories should pass
3. Proceed to Feature 003 (User Authentication)

## Files Reference

| File                                                    | Purpose                                    |
| ------------------------------------------------------- | ------------------------------------------ |
| `supabase/migrations/00000000000000_rls_foundation.sql` | All RLS policies (idempotent)              |
| `supabase/seed.sql`                                     | Verification queries and manual test steps |
| `contracts/rls-policies.sql`                            | Contract definitions (source of truth)     |
| `data-model.md`                                         | Entity definitions                         |
| `research.md`                                           | Design decisions                           |
| `tests/rls/*.test.ts`                                   | Automated RLS tests                        |
