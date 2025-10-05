-- =========================================
-- Migration: Create Authentication Tables
-- Feature: PRP-016 User Authentication
-- Created: 2025-10-05
-- =========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- TABLE: user_profiles
-- =========================================
-- User profile information (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE CHECK (length(username) >= 3 AND length(username) <= 30),
  display_name TEXT CHECK (length(display_name) <= 100),
  avatar_url TEXT,
  bio TEXT CHECK (length(bio) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================
-- TABLE: auth_audit_logs
-- =========================================
-- Security audit trail for authentication events
CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sign_up',
    'sign_in_success',
    'sign_in_failed',
    'sign_out',
    'password_change',
    'password_reset_request',
    'password_reset_complete',
    'email_verification_sent',
    'email_verification_complete',
    'token_refresh',
    'account_delete'
  )),
  event_data JSONB,
  ip_address INET,
  user_agent TEXT CHECK (length(user_agent) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================
-- INDEXES: Performance optimization
-- =========================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles(updated_at DESC);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_ip_address ON auth_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON auth_audit_logs(user_id, event_type, created_at DESC);

-- =========================================
-- FUNCTIONS: Auto-update timestamps
-- =========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- TRIGGERS: Automatic profile creation and timestamp updates
-- =========================================

-- Trigger: Auto-update user_profiles.updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, created_at, updated_at)
    VALUES (NEW.id, NOW(), NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- =========================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: user_profiles
-- Users can view their own profile
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role can insert profiles (for trigger)
CREATE POLICY "Service creates profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- RLS Policies: auth_audit_logs
-- Users can view their own logs
CREATE POLICY "Users view own logs" ON auth_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- System can insert logs (service role)
CREATE POLICY "Service creates logs" ON auth_audit_logs
  FOR INSERT WITH CHECK (true);

-- =========================================
-- FUNCTIONS: Audit log cleanup
-- =========================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM auth_audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================
-- COMMENTS: Table documentation
-- =========================================

COMMENT ON TABLE user_profiles IS 'User profile information linked 1:1 with auth.users';
COMMENT ON TABLE auth_audit_logs IS 'Security audit trail for all authentication events (90-day retention)';
COMMENT ON FUNCTION create_user_profile() IS 'Automatically creates user profile when new user signs up';
COMMENT ON FUNCTION cleanup_old_audit_logs() IS 'Cleanup audit logs older than 90 days (run via cron)';

-- =========================================
-- GRANT PERMISSIONS
-- =========================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT, INSERT ON auth_audit_logs TO authenticated;

-- Grant full access to service role
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON auth_audit_logs TO service_role;

-- =========================================
-- MIGRATION COMPLETE
-- =========================================
