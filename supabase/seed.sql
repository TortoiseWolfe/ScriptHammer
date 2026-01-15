-- Seed Data for RLS Testing
-- Feature: 000-rls-implementation
--
-- This file creates test data for manual RLS verification.
-- Execute after running the migration.
--
-- NOTE: Test users should be created via Supabase Auth, not directly.
-- This seed file is for reference and additional test data only.

-- ============================================================================
-- SAMPLE AUDIT LOG ENTRIES (via service role)
-- ============================================================================

-- These entries demonstrate the audit log structure.
-- In production, audit logs are created automatically by triggers and Edge Functions.

-- Example: System startup event (no user_id)
-- INSERT INTO public.audit_logs (event_type, details)
-- VALUES ('user.login', '{"system": "seed", "environment": "development"}');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries to verify RLS is working correctly:

-- 1. Check RLS is enabled on all tables
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'audit_logs');

-- 2. List all RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Check indexes exist for policy performance
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'audit_logs');

-- 4. Check triggers are installed
SELECT
    trigger_schema,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
OR (trigger_schema = 'auth' AND trigger_name LIKE '%user%');

-- ============================================================================
-- MANUAL TESTING STEPS
-- ============================================================================

-- Step 1: Create two test users via Supabase Dashboard or API
--   - User A: test-user-a@example.com
--   - User B: test-user-b@example.com

-- Step 2: Sign in as User A and run:
--   SELECT * FROM profiles;
--   Expected: Only User A's profile

-- Step 3: As User A, try to query User B's profile:
--   SELECT * FROM profiles WHERE id = '<user-b-id>';
--   Expected: Empty result (not an error)

-- Step 4: As User A, try to update User B's profile:
--   UPDATE profiles SET display_name = 'Hacked' WHERE id = '<user-b-id>';
--   Expected: 0 rows affected

-- Step 5: As anonymous (no auth), run:
--   SELECT * FROM profiles;
--   Expected: Empty result

-- Step 6: As service role, run:
--   SELECT * FROM profiles;
--   Expected: All profiles visible

-- Step 7: As User A, try to insert audit log:
--   INSERT INTO audit_logs (event_type, details) VALUES ('user.login', '{}');
--   Expected: Permission denied

-- Step 8: As User A, try to delete audit log:
--   DELETE FROM audit_logs WHERE user_id = '<user-a-id>';
--   Expected: 0 rows affected (no DELETE policy)
