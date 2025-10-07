-- =========================================
-- Drop Script: Complete Database Reset
-- Feature: Combined Payment + Auth + Security Setup
-- Created: 2025-10-06
-- =========================================
-- WARNING: This script will DELETE EVERYTHING
-- Only run this when you want to completely reset the database
-- =========================================

-- =========================================
-- STEP 1: Drop all tables (CASCADE handles policies/triggers)
-- =========================================

-- Drop in dependency order (children before parents)

-- Payment tables (depend on auth.users via foreign keys)
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS payment_results CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS payment_intents CASCADE;
DROP TABLE IF EXISTS payment_provider_config CASCADE;

-- Security tables (Feature 017)
DROP TABLE IF EXISTS rate_limit_attempts CASCADE;
DROP TABLE IF EXISTS oauth_states CASCADE;

-- Auth tables (drop last - other tables reference auth.users)
DROP TABLE IF EXISTS auth_audit_logs CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop trigger on auth.users if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- =========================================
-- STEP 2: Drop all functions
-- =========================================

DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_audit_logs() CASCADE;
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, TEXT, INET) CASCADE;
DROP FUNCTION IF EXISTS record_failed_attempt(TEXT, TEXT, INET) CASCADE;

-- =========================================
-- CLEANUP COMPLETE
-- =========================================
-- Everything has been completely dropped:
--   - All payment tables (with CASCADE - removes policies/triggers)
--   - All auth tables (with CASCADE - removes policies/triggers)
--   - All security tables (with CASCADE - removes policies/triggers)
--   - All functions
--
-- Database is now empty and ready for fresh setup.
--
-- Next step:
--   Run: 20251006_complete_monolithic_setup.sql
-- =========================================
