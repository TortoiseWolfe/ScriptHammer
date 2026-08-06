-- =========================================
-- Drop Script: Complete Database Reset
-- Feature: Combined Payment + Auth + Security + Avatar Setup
-- Created: 2025-10-06
-- Updated: 2025-10-08 (Added avatar cleanup)
-- =========================================
-- WARNING: This script will DELETE EVERYTHING
-- Only run this when you want to completely reset the database
-- =========================================

-- =========================================
-- STEP 0: Clean up storage (Feature 022: Avatar Upload)
-- =========================================

-- Drop avatar storage policies (on storage.objects)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- Delete all files from avatars bucket
DELETE FROM storage.objects WHERE bucket_id = 'avatars';

-- Delete avatars bucket
DELETE FROM storage.buckets WHERE id = 'avatars';

-- =========================================
-- STEP 1: Drop all tables (CASCADE handles policies/triggers)
-- =========================================

-- Drop in dependency order (children before parents)

-- Commerce catalog (#557). Children before parents: orders references both
-- products and payment_intents, so it must go first.
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Payment tables (depend on auth.users via foreign keys)
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS payment_results CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS payment_intents CASCADE;
DROP TABLE IF EXISTS payment_provider_config CASCADE;

-- Security tables (Feature 017)
DROP TABLE IF EXISTS rate_limit_attempts CASCADE;
-- oauth_states removed (#183) — kept here as an idempotent no-op so a teardown
-- run against an OLDER database still clears the dropped table.
DROP TABLE IF EXISTS oauth_states CASCADE;

-- Messaging tables (PRP-023) - depend on auth.users via foreign keys
DROP TABLE IF EXISTS typing_indicators CASCADE;
DROP TABLE IF EXISTS conversation_keys CASCADE;
DROP TABLE IF EXISTS user_encryption_keys CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
-- Group chat tables (Feature 010) - drop before conversations
DROP TABLE IF EXISTS group_keys CASCADE;
DROP TABLE IF EXISTS conversation_members CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS user_connections CASCADE;

-- Auth tables (drop last - other tables reference auth.users)
DROP TABLE IF EXISTS auth_audit_logs CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Pre-#49 legacy leftovers (#170) — no-ops on a clean DB, dropped here so a
-- full teardown clears them too if run against an older database.
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop trigger on auth.users if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- =========================================
-- STEP 2: Drop all functions
-- =========================================

DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
-- Both signatures: the original took no arguments, the batched replacement takes
-- (p_batch_size, p_max_batches) with defaults (#585). `DROP FUNCTION name()` with
-- explicit empty parens matches ONLY the zero-arg overload, so dropping just one
-- of these would leave the other behind on a database created at the other
-- revision.
DROP FUNCTION IF EXISTS cleanup_old_audit_logs() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_audit_logs(INT, INT) CASCADE;
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, TEXT, INET) CASCADE;
DROP FUNCTION IF EXISTS record_failed_attempt(TEXT, TEXT, INET) CASCADE;
DROP FUNCTION IF EXISTS update_conversation_timestamp() CASCADE;
DROP FUNCTION IF EXISTS assign_sequence_number() CASCADE;
-- Pre-#49 legacy signup-trigger functions (#170)
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS handle_updated_at() CASCADE;

-- =========================================
-- CLEANUP COMPLETE
-- =========================================
-- Everything has been completely dropped:
--   - All storage buckets and files (avatars)
--   - All storage policies (avatar RLS)
--   - All payment tables (with CASCADE - removes policies/triggers)
--   - All auth tables (with CASCADE - removes policies/triggers)
--   - All security tables (with CASCADE - removes policies/triggers)
--   - All messaging tables (with CASCADE - removes policies/triggers/indexes)
--   - All functions (including messaging triggers)
--
-- Database is now empty and ready for fresh setup.
--
-- Next step:
--   Run: 20251006_complete_monolithic_setup.sql
-- =========================================
