-- =========================================
-- Drop Script: Clean Slate for Database
-- Feature: Combined Payment + Auth Setup
-- Created: 2025-10-05
-- =========================================
-- WARNING: This script will DELETE ALL data
-- Only run this on empty databases or when you want to start fresh
-- =========================================

-- Step 1: Drop all policies (prevents FK constraint errors)
DROP POLICY IF EXISTS "Users view own payments" ON payment_intents;
DROP POLICY IF EXISTS "Users create own payments" ON payment_intents;
DROP POLICY IF EXISTS "Users update own payments" ON payment_intents;
DROP POLICY IF EXISTS "Users view own results" ON payment_results;
DROP POLICY IF EXISTS "Service creates results" ON payment_results;
DROP POLICY IF EXISTS "Users view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users create own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users update own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service creates webhook events" ON webhook_events;
DROP POLICY IF EXISTS "Service updates webhook events" ON webhook_events;
DROP POLICY IF EXISTS "Users view provider config" ON payment_provider_config;
DROP POLICY IF EXISTS "Users view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service creates profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users view own logs" ON auth_audit_logs;
DROP POLICY IF EXISTS "Service creates logs" ON auth_audit_logs;

-- Step 2: Drop triggers (prevents function drop errors)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Step 3: Drop tables (CASCADE drops dependent objects)
-- Order: child tables first, then parent tables
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS payment_results CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS payment_intents CASCADE;
DROP TABLE IF EXISTS payment_provider_config CASCADE;
DROP TABLE IF EXISTS auth_audit_logs CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Step 4: Drop functions
DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_audit_logs() CASCADE;

-- Step 5: Drop extensions (optional - only if you want complete cleanup)
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;

-- =========================================
-- CLEANUP COMPLETE
-- =========================================
-- All payment and authentication tables have been dropped
-- You can now run complete_setup.sql to recreate everything
-- =========================================
