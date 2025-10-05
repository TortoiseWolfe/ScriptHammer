-- ============================================================================
-- COMPLETE SETUP: Payment System + User Authentication
-- ============================================================================
-- Purpose: Single migration file for ScriptHammer database setup
-- Created: 2025-10-05
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/vswxgxbjodpgwfgsjrhq/sql
--
-- This migration combines:
-- - Part 1: Payment System (PRP-015)
-- - Part 2: User Authentication (PRP-016)
-- - Part 3: Row Level Security (RLS) with auth.uid()
-- - Part 4: Triggers & Functions
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PART 1: PAYMENT SYSTEM TABLES (PRP-015)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: payment_intents
-- ----------------------------------------------------------------------------
-- Customer payment intentions before provider redirect (24hr expiry)
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  amount INTEGER NOT NULL CHECK (amount >= 100 AND amount <= 99999),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency IN ('usd', 'eur', 'gbp', 'cad', 'aud')),
  type TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  interval TEXT CHECK (interval IN ('month', 'year') OR interval IS NULL),
  description TEXT,
  customer_email TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_payment_intents_customer_email ON payment_intents(customer_email);
CREATE INDEX idx_payment_intents_created_at ON payment_intents(created_at DESC);
CREATE INDEX idx_payment_intents_user_id ON payment_intents(template_user_id);
CREATE INDEX idx_payment_intents_expires_at ON payment_intents(expires_at);

COMMENT ON TABLE payment_intents IS 'Customer payment intentions before provider redirect (24hr expiry)';
COMMENT ON COLUMN payment_intents.amount IS 'Amount in cents ($1.00 = 100)';
COMMENT ON COLUMN payment_intents.expires_at IS 'Intent expires after 24 hours if not completed';

-- ----------------------------------------------------------------------------
-- TABLE: payment_results
-- ----------------------------------------------------------------------------
-- Outcome of payment attempts with webhook verification status
CREATE TABLE payment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'cashapp', 'chime')),
  transaction_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  charged_amount INTEGER,
  charged_currency TEXT,
  provider_fee INTEGER,
  webhook_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_method TEXT CHECK (verification_method IN ('webhook', 'redirect') OR verification_method IS NULL),
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_results_intent_id ON payment_results(intent_id);
CREATE INDEX idx_payment_results_transaction_id ON payment_results(transaction_id);
CREATE INDEX idx_payment_results_status ON payment_results(status);
CREATE INDEX idx_payment_results_created_at ON payment_results(created_at DESC);

COMMENT ON TABLE payment_results IS 'Outcome of payment attempts with webhook verification status';
COMMENT ON COLUMN payment_results.webhook_verified IS 'True if confirmed via webhook (most reliable)';
COMMENT ON COLUMN payment_results.verification_method IS 'How payment was confirmed: webhook (reliable) or redirect (less reliable)';

-- ----------------------------------------------------------------------------
-- TABLE: subscriptions
-- ----------------------------------------------------------------------------
-- Recurring payment subscriptions (monthly/yearly)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_subscription_id TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  plan_amount INTEGER NOT NULL CHECK (plan_amount >= 100),
  plan_interval TEXT NOT NULL CHECK (plan_interval IN ('month', 'year')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'grace_period', 'canceled', 'expired')),
  current_period_start TEXT,
  current_period_end TEXT,
  next_billing_date TEXT,
  failed_payment_count INTEGER NOT NULL DEFAULT 0,
  retry_schedule JSONB DEFAULT '{"day_1": false, "day_3": false, "day_7": false}'::jsonb,
  grace_period_expires TEXT,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_customer_email ON subscriptions(customer_email);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date) WHERE status = 'active';
CREATE UNIQUE INDEX idx_subscriptions_provider_id ON subscriptions(provider, provider_subscription_id);

COMMENT ON TABLE subscriptions IS 'Recurring payment subscriptions (monthly/yearly)';
COMMENT ON COLUMN subscriptions.retry_schedule IS 'Tracks retry attempts: day_1, day_3, day_7 after failure';
COMMENT ON COLUMN subscriptions.grace_period_expires IS 'Date when subscription will be canceled if payment still fails';

-- ----------------------------------------------------------------------------
-- TABLE: payment_provider_config
-- ----------------------------------------------------------------------------
-- Payment provider settings and failover configuration
CREATE TABLE payment_provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'cashapp', 'chime')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (config_status IN ('not_configured', 'configured', 'invalid')),
  priority INTEGER NOT NULL DEFAULT 0,
  features JSONB DEFAULT '{"one_time": false, "recurring": false, "requires_consent": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider)
);

CREATE INDEX idx_provider_config_enabled ON payment_provider_config(enabled, priority DESC);

COMMENT ON TABLE payment_provider_config IS 'Payment provider settings and failover configuration';
COMMENT ON COLUMN payment_provider_config.priority IS 'Higher priority providers are tried first for failover';

-- ----------------------------------------------------------------------------
-- TABLE: webhook_events
-- ----------------------------------------------------------------------------
-- Webhook notifications from payment providers with idempotency protection
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  signature TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  processing_error TEXT,
  related_payment_id UUID REFERENCES payment_results(id),
  related_subscription_id UUID REFERENCES subscriptions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_webhook_events_provider_event_id ON webhook_events(provider, provider_event_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at DESC);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);

COMMENT ON TABLE webhook_events IS 'Webhook notifications from payment providers with idempotency protection';
COMMENT ON INDEX idx_webhook_events_provider_event_id IS 'Prevents duplicate webhook processing (idempotency)';

-- ============================================================================
-- PART 2: AUTHENTICATION TABLES (PRP-016)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: user_profiles
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles(updated_at DESC);

COMMENT ON TABLE user_profiles IS 'User profile information linked 1:1 with auth.users';

-- ----------------------------------------------------------------------------
-- TABLE: auth_audit_logs
-- ----------------------------------------------------------------------------
-- Security audit trail for authentication events (90-day retention)
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

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_ip_address ON auth_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON auth_audit_logs(user_id, event_type, created_at DESC);

COMMENT ON TABLE auth_audit_logs IS 'Security audit trail for all authentication events (90-day retention)';

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_provider_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS: payment_intents
-- ----------------------------------------------------------------------------
CREATE POLICY "Users view own payments" ON payment_intents
  FOR SELECT
  USING (auth.uid() = template_user_id);

CREATE POLICY "Users create own payments" ON payment_intents
  FOR INSERT
  WITH CHECK (auth.uid() = template_user_id);

CREATE POLICY "Users update own payments" ON payment_intents
  FOR UPDATE
  USING (auth.uid() = template_user_id);

COMMENT ON POLICY "Users view own payments" ON payment_intents IS 'Users can only view their own payment intents based on auth.uid()';

-- ----------------------------------------------------------------------------
-- RLS: payment_results
-- ----------------------------------------------------------------------------
CREATE POLICY "Users view own results" ON payment_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_intents
      WHERE payment_intents.id = payment_results.intent_id
      AND payment_intents.template_user_id = auth.uid()
    )
  );

CREATE POLICY "Service creates results" ON payment_results
  FOR INSERT
  WITH CHECK (true);

COMMENT ON POLICY "Users view own results" ON payment_results IS 'Users can only view results for their own payment intents';
COMMENT ON POLICY "Service creates results" ON payment_results IS 'Service role creates payment results from webhook handlers';

-- ----------------------------------------------------------------------------
-- RLS: subscriptions
-- ----------------------------------------------------------------------------
CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT
  USING (auth.uid() = template_user_id);

CREATE POLICY "Users create own subscriptions" ON subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = template_user_id);

CREATE POLICY "Users update own subscriptions" ON subscriptions
  FOR UPDATE
  USING (auth.uid() = template_user_id);

COMMENT ON POLICY "Users view own subscriptions" ON subscriptions IS 'Users can only view their own subscriptions';

-- ----------------------------------------------------------------------------
-- RLS: webhook_events
-- ----------------------------------------------------------------------------
CREATE POLICY "Service creates webhook events" ON webhook_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service updates webhook events" ON webhook_events
  FOR UPDATE
  WITH CHECK (true);

COMMENT ON POLICY "Service creates webhook events" ON webhook_events IS 'Service role handles webhook event storage';

-- ----------------------------------------------------------------------------
-- RLS: payment_provider_config
-- ----------------------------------------------------------------------------
CREATE POLICY "Users view provider config" ON payment_provider_config
  FOR SELECT
  USING (true);

-- ----------------------------------------------------------------------------
-- RLS: user_profiles
-- ----------------------------------------------------------------------------
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Service creates profiles" ON user_profiles
  FOR INSERT
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- RLS: auth_audit_logs
-- ----------------------------------------------------------------------------
CREATE POLICY "Users view own logs" ON auth_audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service creates logs" ON auth_audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- PART 4: TRIGGERS & FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FUNCTION: update_updated_at_column
-- ----------------------------------------------------------------------------
-- Automatically update updated_at timestamp on row updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to user_profiles
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- FUNCTION: create_user_profile
-- ----------------------------------------------------------------------------
-- Automatically create user profile when new user signs up
-- SECURITY DEFINER allows trigger to bypass RLS policies
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert profile with explicit schema and ON CONFLICT to prevent duplicate errors
  INSERT INTO public.user_profiles (id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

COMMENT ON FUNCTION create_user_profile() IS 'Automatically creates user profile when new user signs up (bypasses RLS with SECURITY DEFINER)';

-- ----------------------------------------------------------------------------
-- FUNCTION: cleanup_old_audit_logs
-- ----------------------------------------------------------------------------
-- Cleanup audit logs older than 90 days (run via cron)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM auth_audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_audit_logs() IS 'Cleanup audit logs older than 90 days (run via cron)';

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON payment_intents TO authenticated;
GRANT SELECT ON payment_results TO authenticated;
GRANT SELECT, INSERT, UPDATE ON subscriptions TO authenticated;
GRANT SELECT ON payment_provider_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT, INSERT ON auth_audit_logs TO authenticated;

-- Grant full access to service role
GRANT ALL ON payment_intents TO service_role;
GRANT ALL ON payment_results TO service_role;
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON webhook_events TO service_role;
GRANT ALL ON payment_provider_config TO service_role;
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON auth_audit_logs TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Database setup complete with:
-- ✅ Payment system (PRP-015): payment_intents, payment_results, subscriptions, webhook_events
-- ✅ User authentication (PRP-016): user_profiles, auth_audit_logs
-- ✅ Row Level Security (RLS): All policies use auth.uid() for real authentication
-- ✅ Triggers & Functions: Auto-create profiles, update timestamps, cleanup old logs
-- ✅ Permissions: Authenticated users + service role grants
--
-- Next steps:
-- 1. Configure OAuth providers in Supabase Dashboard (GitHub, Google)
-- 2. Set environment variables in .env.local:
--    NEXT_PUBLIC_SUPABASE_URL=https://vswxgxbjodpgwfgsjrhq.supabase.co
--    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
-- 3. Test authentication flow: Sign up → Email verification → Sign in
-- ============================================================================
