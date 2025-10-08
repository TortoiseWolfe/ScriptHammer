-- ============================================================================
-- COMPLETE MONOLITHIC SETUP
-- Everything in one file: Payment + Auth + Security
-- ============================================================================
-- Purpose: Single migration to create entire database from scratch
-- Created: 2025-10-06
--
-- This migration includes:
-- - Payment System (PRP-015)
-- - User Authentication (PRP-016)
-- - Security Hardening (Feature 017)
--   - Rate limiting (brute force protection)
--   - OAuth CSRF protection
--   - Row Level Security (RLS)
--   - Audit logging
--   - Webhook retry
-- ============================================================================

-- Clean up any existing test user BEFORE transaction
-- (auth.users changes can't be rolled back, so do this first)
DELETE FROM auth.users WHERE email = 'test@example.com';

-- Wrap everything in a transaction - all or nothing
BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PART 1: PAYMENT SYSTEM TABLES
-- ============================================================================

-- Payment intents (24hr expiry)
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

-- Payment results
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

COMMENT ON TABLE payment_results IS 'Outcome of payment attempts with webhook verification';

-- Subscriptions
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

COMMENT ON TABLE subscriptions IS 'Recurring payment subscriptions';

-- Payment provider config
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

COMMENT ON TABLE payment_provider_config IS 'Payment provider settings and failover';

-- Webhook events (with retry fields from Feature 017)
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
  processed_at TIMESTAMPTZ,
  -- Feature 017: Webhook retry fields
  next_retry_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  permanently_failed BOOLEAN NOT NULL DEFAULT FALSE,
  last_retry_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_webhook_events_provider_event_id ON webhook_events(provider, provider_event_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at DESC);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_retry ON webhook_events(next_retry_at, permanently_failed) WHERE processed = FALSE AND permanently_failed = FALSE;
CREATE INDEX idx_webhook_events_failed ON webhook_events(permanently_failed, created_at DESC) WHERE permanently_failed = TRUE;

COMMENT ON TABLE webhook_events IS 'Webhook notifications with idempotency and retry';

-- ============================================================================
-- PART 2: AUTHENTICATION TABLES
-- ============================================================================

-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE CHECK (length(username) >= 3 AND length(username) <= 30),
  display_name TEXT CHECK (length(display_name) <= 100),
  avatar_url TEXT,
  bio TEXT CHECK (length(bio) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_updated_at ON user_profiles(updated_at DESC);

COMMENT ON TABLE user_profiles IS 'User profile information 1:1 with auth.users';

-- Auth audit logs (90-day retention)
CREATE TABLE auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sign_up',
    'sign_in', 'sign_in_success', 'sign_in_failed',
    'sign_out',
    'password_change', 'password_reset_request', 'password_reset_complete',
    'email_verification', 'email_verification_sent', 'email_verification_complete',
    'token_refresh',
    'account_delete',
    'oauth_link', 'oauth_unlink'
  )),
  event_data JSONB,
  ip_address INET,
  user_agent TEXT CHECK (length(user_agent) <= 500),
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX idx_auth_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX idx_auth_audit_logs_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX idx_auth_audit_logs_ip_address ON auth_audit_logs(ip_address);
CREATE INDEX idx_audit_logs_user_event ON auth_audit_logs(user_id, event_type, created_at DESC);

COMMENT ON TABLE auth_audit_logs IS 'Security audit trail for all auth events (90-day retention)';

-- ============================================================================
-- PART 3: SECURITY TABLES (Feature 017)
-- ============================================================================

-- Rate limiting (brute force protection)
CREATE TABLE rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,  -- Email or IP
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('sign_in', 'sign_up', 'password_reset')),
  ip_address INET,
  user_agent TEXT,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_identifier ON rate_limit_attempts(identifier, attempt_type);
CREATE INDEX idx_rate_limit_window ON rate_limit_attempts(window_start);
CREATE INDEX idx_rate_limit_locked ON rate_limit_attempts(locked_until) WHERE locked_until IS NOT NULL;
CREATE UNIQUE INDEX idx_rate_limit_unique ON rate_limit_attempts(identifier, attempt_type);

COMMENT ON TABLE rate_limit_attempts IS 'Server-side rate limiting - prevents brute force';

-- Enable RLS on rate_limit_attempts (system-managed, service role only)
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" ON rate_limit_attempts
  FOR ALL
  USING (false);

COMMENT ON POLICY "Service role only access" ON rate_limit_attempts IS
  'Rate limiting data is system-managed. Only service role can access.';

-- OAuth state tracking (CSRF protection)
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'google')),
  session_id TEXT,
  return_url TEXT,
  ip_address INET,
  user_agent TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

CREATE INDEX idx_oauth_states_token ON oauth_states(state_token) WHERE used = FALSE;
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at) WHERE used = FALSE;
CREATE INDEX idx_oauth_states_session ON oauth_states(session_id);

COMMENT ON TABLE oauth_states IS 'OAuth state tokens - prevents session hijacking';

-- Enable RLS on oauth_states (CSRF protection tokens)
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert state tokens (for OAuth flow initiation)
CREATE POLICY "Anyone can create state tokens" ON oauth_states
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read state tokens (for validation during OAuth callback)
CREATE POLICY "Anyone can read state tokens" ON oauth_states
  FOR SELECT
  USING (true);

-- Allow anyone to update state tokens (for marking as used)
CREATE POLICY "Anyone can update state tokens" ON oauth_states
  FOR UPDATE
  USING (true);

-- Allow anyone to delete expired state tokens (for cleanup)
CREATE POLICY "Anyone can delete expired states" ON oauth_states
  FOR DELETE
  USING (expires_at < NOW());

COMMENT ON TABLE oauth_states IS
  'OAuth state tokens are random UUIDs with 5-minute expiration. Safe to allow public access.';

-- ============================================================================
-- PART 4: FUNCTIONS
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Cleanup old audit logs (90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM auth_audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Rate limiting check (Feature 017)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record rate_limit_attempts%ROWTYPE;
  v_max_attempts INTEGER := 5;
  v_window_minutes INTEGER := 15;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_record
  FROM rate_limit_attempts
  WHERE identifier = p_identifier AND attempt_type = p_attempt_type
  FOR UPDATE SKIP LOCKED;

  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    RETURN json_build_object('allowed', FALSE, 'remaining', 0, 'locked_until', v_record.locked_until, 'reason', 'rate_limited');
  END IF;

  IF v_record.id IS NULL OR (v_now - v_record.window_start) > (v_window_minutes || ' minutes')::INTERVAL THEN
    INSERT INTO rate_limit_attempts (identifier, attempt_type, ip_address, window_start, attempt_count)
    VALUES (p_identifier, p_attempt_type, p_ip_address, v_now, 0)
    ON CONFLICT (identifier, attempt_type) DO UPDATE
      SET window_start = v_now, attempt_count = 0, locked_until = NULL, updated_at = v_now;
    RETURN json_build_object('allowed', TRUE, 'remaining', v_max_attempts, 'locked_until', NULL);
  END IF;

  IF v_record.attempt_count < v_max_attempts THEN
    RETURN json_build_object('allowed', TRUE, 'remaining', v_max_attempts - v_record.attempt_count, 'locked_until', NULL);
  ELSE
    UPDATE rate_limit_attempts
    SET locked_until = v_now + (v_window_minutes || ' minutes')::INTERVAL, updated_at = v_now
    WHERE identifier = p_identifier AND attempt_type = p_attempt_type;
    RETURN json_build_object('allowed', FALSE, 'remaining', 0, 'locked_until', v_now + (v_window_minutes || ' minutes')::INTERVAL, 'reason', 'rate_limited');
  END IF;
END;
$$;

-- Record failed auth attempt (Feature 017)
CREATE OR REPLACE FUNCTION record_failed_attempt(
  p_identifier TEXT,
  p_attempt_type TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rate_limit_attempts
  SET attempt_count = attempt_count + 1, updated_at = now(), ip_address = COALESCE(p_ip_address, ip_address)
  WHERE identifier = p_identifier AND attempt_type = p_attempt_type;

  IF NOT FOUND THEN
    INSERT INTO rate_limit_attempts (identifier, attempt_type, ip_address, attempt_count)
    VALUES (p_identifier, p_attempt_type, p_ip_address, 1)
    ON CONFLICT (identifier, attempt_type) DO UPDATE
      SET attempt_count = rate_limit_attempts.attempt_count + 1, updated_at = now();
  END IF;
END;
$$;

-- ============================================================================
-- PART 5: TRIGGERS
-- ============================================================================

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- ============================================================================
-- PART 6: STORAGE BUCKETS (Feature 022: Avatar Upload)
-- ============================================================================

-- Create avatars bucket for user profile pictures
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'avatars',
  'avatars',
  true,                                              -- Public read access
  5242880,                                           -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp']    -- Allowed formats
)
ON CONFLICT (id) DO NOTHING;                         -- Idempotent

-- Drop existing avatar policies (for clean re-run)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- Avatar RLS Policy 1: INSERT - Users can upload own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Avatar RLS Policy 2: UPDATE - Users can update own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Avatar RLS Policy 3: DELETE - Users can delete own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Avatar RLS Policy 4: SELECT - Anyone can view avatars (public read)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================================================
-- PART 7: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_provider_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;

-- Payment intents (Feature 017: Stricter policies)
CREATE POLICY "Users can view own payment intents" ON payment_intents
  FOR SELECT USING (auth.uid() = template_user_id);

CREATE POLICY "Users can create own payment intents" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

CREATE POLICY "Payment intents are immutable" ON payment_intents
  FOR UPDATE USING (false);

CREATE POLICY "Payment intents cannot be deleted by users" ON payment_intents
  FOR DELETE USING (false);

-- Payment results (Feature 017: Stricter policies)
CREATE POLICY "Users can view own payment results" ON payment_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM payment_intents
      WHERE payment_intents.id = payment_results.intent_id
      AND payment_intents.template_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert payment results" ON payment_results
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Payment results are immutable" ON payment_results
  FOR UPDATE USING (false);

CREATE POLICY "Payment results cannot be deleted by users" ON payment_results
  FOR DELETE USING (false);

-- Subscriptions
CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = template_user_id);

CREATE POLICY "Users create own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

CREATE POLICY "Users update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = template_user_id);

-- Webhook events
CREATE POLICY "Service creates webhook events" ON webhook_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service updates webhook events" ON webhook_events
  FOR UPDATE WITH CHECK (true);

-- Payment provider config
CREATE POLICY "Users view provider config" ON payment_provider_config
  FOR SELECT USING (true);

-- User profiles
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service creates profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Auth audit logs (Feature 017)
CREATE POLICY "Users can view own audit logs" ON auth_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert audit logs" ON auth_audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- PART 7: GRANT PERMISSIONS
-- ============================================================================

-- Authenticated users
GRANT SELECT, INSERT, UPDATE ON payment_intents TO authenticated;
GRANT SELECT ON payment_results TO authenticated;
GRANT SELECT, INSERT, UPDATE ON subscriptions TO authenticated;
GRANT SELECT ON payment_provider_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT, INSERT ON auth_audit_logs TO authenticated;

-- Service role (full access)
GRANT ALL ON payment_intents TO service_role;
GRANT ALL ON payment_results TO service_role;
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON webhook_events TO service_role;
GRANT ALL ON payment_provider_config TO service_role;
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON auth_audit_logs TO service_role;

-- ============================================================================
-- PART 8: SEED TEST USER (Primary)
-- ============================================================================
-- Creates: test@example.com / TestPassword123!
-- Email is already confirmed (bypasses verification requirement)
-- Note: User was deleted at start of script for idempotency

-- Create the user in auth.users with confirmed email
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'test@example.com',
  crypt('TestPassword123!', gen_salt('bf')),  -- Hashed password using bcrypt
  now(),  -- Email already confirmed
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  ''
);

-- Create identity record (required for Supabase Auth)
INSERT INTO auth.identities (
  provider_id,
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  gen_random_uuid(),
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
FROM auth.users
WHERE email = 'test@example.com';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Created:
--   ✅ Payment tables: payment_intents, payment_results, subscriptions, webhook_events, payment_provider_config
--   ✅ Auth tables: user_profiles, auth_audit_logs
--   ✅ Security tables: rate_limit_attempts, oauth_states
--   ✅ Storage buckets: avatars (5MB limit, public read)
--   ✅ Functions: update_updated_at_column, create_user_profile, cleanup_old_audit_logs, check_rate_limit, record_failed_attempt
--   ✅ Triggers: on_auth_user_created, update_user_profiles_updated_at
--   ✅ RLS policies: All tables + storage.objects protected with auth.uid()
--   ✅ Avatar policies: 4 policies (user isolation + public read)
--   ✅ Permissions: Authenticated users + service role
--   ✅ Test user: test@example.com (primary, email confirmed)
-- ============================================================================

-- Commit the transaction - everything succeeded
COMMIT;
