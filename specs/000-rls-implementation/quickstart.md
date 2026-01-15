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
  password: 'testpassword123'
});

// Sign up User B (in new client or after signOut)
await supabase.auth.signUp({
  email: 'userb@test.com',
  password: 'testpassword123'
});

// Sign in as User A
await supabase.auth.signInWithPassword({
  email: 'usera@test.com',
  password: 'testpassword123'
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

## Next Steps

After verifying RLS foundation:

1. Run `/speckit.tasks` to generate implementation tasks
2. Write RLS test suite (`tests/rls/`)
3. Proceed to Feature 003 (User Authentication)

## Files Reference

| File | Purpose |
|------|---------|
| `contracts/rls-policies.sql` | All RLS policies (idempotent) |
| `data-model.md` | Entity definitions |
| `research.md` | Design decisions |
