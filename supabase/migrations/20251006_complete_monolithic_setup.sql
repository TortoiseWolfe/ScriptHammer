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
CREATE TABLE IF NOT EXISTS payment_intents (
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

CREATE INDEX IF NOT EXISTS idx_payment_intents_customer_email ON payment_intents(customer_email);
CREATE INDEX IF NOT EXISTS idx_payment_intents_created_at ON payment_intents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user_id ON payment_intents(template_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_expires_at ON payment_intents(expires_at);

COMMENT ON TABLE payment_intents IS 'Customer payment intentions before provider redirect (24hr expiry)';

-- Payment results
CREATE TABLE IF NOT EXISTS payment_results (
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

CREATE INDEX IF NOT EXISTS idx_payment_results_intent_id ON payment_results(intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_results_transaction_id ON payment_results(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_results_status ON payment_results(status);
CREATE INDEX IF NOT EXISTS idx_payment_results_created_at ON payment_results(created_at DESC);

COMMENT ON TABLE payment_results IS 'Outcome of payment attempts with webhook verification';

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_email ON subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON subscriptions(next_billing_date) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_id ON subscriptions(provider, provider_subscription_id);

COMMENT ON TABLE subscriptions IS 'Recurring payment subscriptions';

-- Payment provider config
CREATE TABLE IF NOT EXISTS payment_provider_config (
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

CREATE INDEX IF NOT EXISTS idx_provider_config_enabled ON payment_provider_config(enabled, priority DESC);

COMMENT ON TABLE payment_provider_config IS 'Payment provider settings and failover';

-- Webhook events (with retry fields from Feature 017)
CREATE TABLE IF NOT EXISTS webhook_events (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event_id ON webhook_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry ON webhook_events(next_retry_at, permanently_failed) WHERE processed = FALSE AND permanently_failed = FALSE;
CREATE INDEX IF NOT EXISTS idx_webhook_events_failed ON webhook_events(permanently_failed, created_at DESC) WHERE permanently_failed = TRUE;

COMMENT ON TABLE webhook_events IS 'Webhook notifications with idempotency and retry';

-- ============================================================================
-- PART 2: AUTHENTICATION TABLES
-- ============================================================================

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE CHECK (length(username) >= 3 AND length(username) <= 30),
  display_name TEXT CHECK (length(display_name) <= 100),
  avatar_url TEXT,
  bio TEXT CHECK (length(bio) <= 500),
  welcome_message_sent BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_welcome_pending ON user_profiles(id) WHERE welcome_message_sent = FALSE;

COMMENT ON TABLE user_profiles IS 'User profile information 1:1 with auth.users';

-- Auth audit logs (90-day retention)
CREATE TABLE IF NOT EXISTS auth_audit_logs (
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

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_ip_address ON auth_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON auth_audit_logs(user_id, event_type, created_at DESC);

COMMENT ON TABLE auth_audit_logs IS 'Security audit trail for all auth events (90-day retention)';

-- ============================================================================
-- PART 3: SECURITY TABLES (Feature 017)
-- ============================================================================

-- Rate limiting (brute force protection)
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
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

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_attempts(identifier, attempt_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_attempts(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_locked ON rate_limit_attempts(locked_until) WHERE locked_until IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_unique ON rate_limit_attempts(identifier, attempt_type);

COMMENT ON TABLE rate_limit_attempts IS 'Server-side rate limiting - prevents brute force';

-- Enable RLS on rate_limit_attempts (system-managed, service role only)
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only access" ON rate_limit_attempts;
CREATE POLICY "Service role only access" ON rate_limit_attempts
  FOR ALL
  USING (false);

COMMENT ON POLICY "Service role only access" ON rate_limit_attempts IS
  'Rate limiting data is system-managed. Only service role can access.';

-- OAuth state tracking (CSRF protection)
CREATE TABLE IF NOT EXISTS oauth_states (
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

CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_oauth_states_session ON oauth_states(session_id);

COMMENT ON TABLE oauth_states IS 'OAuth state tokens - prevents session hijacking';

-- Enable RLS on oauth_states (CSRF protection tokens)
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert state tokens (for OAuth flow initiation)
DROP POLICY IF EXISTS "Anyone can create state tokens" ON oauth_states;
CREATE POLICY "Anyone can create state tokens" ON oauth_states
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read state tokens (for validation during OAuth callback)
DROP POLICY IF EXISTS "Anyone can read state tokens" ON oauth_states;
CREATE POLICY "Anyone can read state tokens" ON oauth_states
  FOR SELECT
  USING (true);

-- Allow anyone to update state tokens (for marking as used)
DROP POLICY IF EXISTS "Anyone can update state tokens" ON oauth_states;
CREATE POLICY "Anyone can update state tokens" ON oauth_states
  FOR UPDATE
  USING (true);

-- Allow anyone to delete expired state tokens (for cleanup)
DROP POLICY IF EXISTS "Anyone can delete expired states" ON oauth_states;
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

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- ============================================================================
-- PART 6: STORAGE BUCKETS (Feature 022: Avatar Upload)
-- ============================================================================

-- Create avatars bucket for user profile pictures
--
-- Local-profile caveat: the supabase/postgres image's storage-schema.sql
-- creates storage.buckets with only (id, name, owner, created_at, updated_at).
-- The public / file_size_limit / allowed_mime_types columns are added by the
-- storage SERVICE's own runtime migrations on first connect -- which can't
-- happen during initdb because storage hasn't started yet. Against Supabase
-- Cloud this INSERT works as-is because storage has already migrated there.
-- Forward-fill the three columns here so the INSERT succeeds; storage's own
-- ADD COLUMN IF NOT EXISTS will no-op when it catches up later.
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS public             boolean DEFAULT false;
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS file_size_limit    bigint;
ALTER TABLE storage.buckets ADD COLUMN IF NOT EXISTS allowed_mime_types text[];

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

-- These three policies used to read:  auth.uid()::text = (storage.foldername(name))[1]
-- That expression creates a pg_depend edge on storage.foldername(text). On Cloud nobody
-- cares because storage-api has already run its storage-schema migration by
-- the time anybody applies app schema. On a fresh local initdb the ordering is
-- inverted: this file runs first, pins the base-image foldername, then
-- storage-api connects and tries DROP FUNCTION foldername(text) to install its
-- canonical version -- and can't, because our three policies depend on it.
-- storage-api crash-loops on "cannot drop function foldername(text) because
-- other objects depend on it" forever.
--
-- split_part(name, '/', 1) is the same thing -- first path segment -- using
-- only pg_catalog built-ins. No pg_depend edge, storage-api free to DROP.
-- Edge cases land identically for policy purposes: bare filename with no '/'
-- produces NULL vs the filename itself, but auth.uid() = NULL and
-- auth.uid() = 'avatar.png' both DENY (uuids can't collide with filenames).

-- Avatar RLS Policy 1: INSERT - Users can upload own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Avatar RLS Policy 2: UPDATE - Users can update own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Avatar RLS Policy 3: DELETE - Users can delete own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = split_part(name, '/', 1)
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
DROP POLICY IF EXISTS "Users can view own payment intents" ON payment_intents;
CREATE POLICY "Users can view own payment intents" ON payment_intents
  FOR SELECT USING (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Users can create own payment intents" ON payment_intents;
CREATE POLICY "Users can create own payment intents" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Payment intents are immutable" ON payment_intents;
CREATE POLICY "Payment intents are immutable" ON payment_intents
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Payment intents cannot be deleted by users" ON payment_intents;
CREATE POLICY "Payment intents cannot be deleted by users" ON payment_intents
  FOR DELETE USING (false);

-- Payment results (Feature 017: Stricter policies)
DROP POLICY IF EXISTS "Users can view own payment results" ON payment_results;
CREATE POLICY "Users can view own payment results" ON payment_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM payment_intents
      WHERE payment_intents.id = payment_results.intent_id
      AND payment_intents.template_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can insert payment results" ON payment_results;
CREATE POLICY "Service role can insert payment results" ON payment_results
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Payment results are immutable" ON payment_results;
CREATE POLICY "Payment results are immutable" ON payment_results
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Payment results cannot be deleted by users" ON payment_results;
CREATE POLICY "Payment results cannot be deleted by users" ON payment_results
  FOR DELETE USING (false);

-- Subscriptions
DROP POLICY IF EXISTS "Users view own subscriptions" ON subscriptions;
CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Users create own subscriptions" ON subscriptions;
CREATE POLICY "Users create own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

DROP POLICY IF EXISTS "Users update own subscriptions" ON subscriptions;
CREATE POLICY "Users update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = template_user_id);

-- Webhook events
DROP POLICY IF EXISTS "Service creates webhook events" ON webhook_events;
CREATE POLICY "Service creates webhook events" ON webhook_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service updates webhook events" ON webhook_events;
CREATE POLICY "Service updates webhook events" ON webhook_events
  FOR UPDATE WITH CHECK (true);

-- Payment provider config
DROP POLICY IF EXISTS "Users view provider config" ON payment_provider_config;
CREATE POLICY "Users view provider config" ON payment_provider_config
  FOR SELECT USING (true);

-- User profiles
-- Note: "Users view own profile" provides full access to own profile
DROP POLICY IF EXISTS "Users view own profile" ON user_profiles;
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Note: "Authenticated users can search profiles" enables Feature 023 friend search
-- Users can view public profile fields (username, display_name, avatar_url) to find friends
DROP POLICY IF EXISTS "Authenticated users can search profiles" ON user_profiles;
CREATE POLICY "Authenticated users can search profiles" ON user_profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service creates profiles" ON user_profiles;
CREATE POLICY "Service creates profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Auth audit logs (Feature 017)
DROP POLICY IF EXISTS "Users can view own audit logs" ON auth_audit_logs;
CREATE POLICY "Users can view own audit logs" ON auth_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert audit logs" ON auth_audit_logs;
CREATE POLICY "Service role can insert audit logs" ON auth_audit_logs
  FOR INSERT WITH CHECK (true);

-- Admin read-only policies (Feature: Admin Dashboard)
-- Uses JWT custom claims from auth.users.raw_app_meta_data (Supabase RBAC best practice)
-- NEVER subquery user_profiles from its own policy — causes infinite recursion
-- Admin status is set via: UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
--
-- Local-profile caveat: the supabase/postgres image ships auth.uid/role/email
-- (init-scripts/00000000000001-auth-schema.sql) but NOT auth.jwt -- GoTrue
-- creates that on its own first boot. CREATE POLICY checks function existence
-- at parse time, not call time, so every policy below would fail during local
-- initdb. Forward-fill a stub with the canonical implementation; GoTrue's
-- CREATE OR REPLACE overwrites it at service boot. Ownership must be
-- supabase_auth_admin or that REPLACE dies on 42501 (must be owner).
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

DROP POLICY IF EXISTS "Admin can view all profiles" ON user_profiles;
CREATE POLICY "Admin can view all profiles" ON user_profiles
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view all audit logs" ON auth_audit_logs;
CREATE POLICY "Admin can view all audit logs" ON auth_audit_logs
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view all payment intents" ON payment_intents;
CREATE POLICY "Admin can view all payment intents" ON payment_intents
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view all payment results" ON payment_results;
CREATE POLICY "Admin can view all payment results" ON payment_results
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view all subscriptions" ON subscriptions;
CREATE POLICY "Admin can view all subscriptions" ON subscriptions
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view all rate limits" ON rate_limit_attempts;
CREATE POLICY "Admin can view all rate limits" ON rate_limit_attempts
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

-- The three admin-read policies for user_connections / conversations / messages
-- belong with this block semantically but live ~400 lines down, right after
-- the messages section finishes. Those tables are created in PART 8; placing
-- the policies here would be a forward reference that crashes on a fresh
-- local initdb (relation does not exist). On Cloud the tables already exist
-- from prior runs so nobody noticed. Grep for "Admin can view all connections".

-- ============================================================================
-- Admin RPC Aggregation Functions (Feature: Admin Dashboard)
-- SECURITY INVOKER: runs as calling user, respects RLS
-- ============================================================================

-- admin_payment_stats(): Payment metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_payment_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_payments', (SELECT count(*) FROM payment_results),
      'successful_payments', (SELECT count(*) FROM payment_results WHERE status = 'succeeded'),
      'failed_payments', (SELECT count(*) FROM payment_results WHERE status = 'failed'),
      'pending_payments', (SELECT count(*) FROM payment_results WHERE status = 'pending'),
      'total_revenue_cents', (SELECT COALESCE(sum(charged_amount), 0) FROM payment_results WHERE status = 'succeeded'),
      'active_subscriptions', (SELECT count(*) FROM subscriptions WHERE status = 'active'),
      'failed_this_week', (SELECT count(*) FROM payment_results WHERE status = 'failed' AND created_at > now() - interval '7 days'),
      -- json_object_agg keys on provider so the wire shape matches
      -- AdminPaymentStats.revenue_by_provider: Record<string, number>.
      -- json_agg(row_to_json(...)) here used to emit an array — every unit
      -- mock used the Record shape so the mismatch only surfaced live.
      'revenue_by_provider', (
        SELECT COALESCE(json_object_agg(provider, total), '{}'::json)
        FROM (
          SELECT provider, sum(charged_amount) AS total
          FROM payment_results
          WHERE status = 'succeeded'
          GROUP BY provider
        ) t
      )
    )
  );
END;
$$;

-- admin_auth_stats(): Auth/security metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_auth_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'logins_today', (SELECT count(*) FROM auth_audit_logs WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE AND created_at > now() - interval '1 day'),
      'failed_this_week', (SELECT count(*) FROM auth_audit_logs WHERE event_type = 'sign_in_failed' AND created_at > now() - interval '7 days'),
      'signups_this_month', (SELECT count(*) FROM auth_audit_logs WHERE event_type = 'sign_up' AND created_at > now() - interval '30 days'),
      'rate_limited_users', (SELECT count(*) FROM rate_limit_attempts WHERE locked_until IS NOT NULL AND locked_until > now()),
      'top_failed_logins', (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
        FROM (
          -- 'attempts' matches AdminAuthStats.top_failed_logins[].attempts
          -- and AuditBurst.attempts — same semantic, one name.
          SELECT user_id, count(*) AS attempts
          FROM auth_audit_logs
          WHERE event_type = 'sign_in_failed'
            AND created_at > now() - interval '7 days'
          GROUP BY user_id
          ORDER BY attempts DESC
          LIMIT 10
        ) t
      )
    )
  );
END;
$$;

-- admin_user_stats(): User metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_user_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_users', (SELECT count(*) FROM user_profiles WHERE is_admin = FALSE),
      'active_this_week', (SELECT count(*) FROM user_profiles WHERE updated_at > now() - interval '7 days' AND is_admin = FALSE),
      'pending_connections', (SELECT count(*) FROM user_connections WHERE status = 'pending'),
      'total_connections', (SELECT count(*) FROM user_connections WHERE status = 'accepted')
    )
  );
END;
$$;

-- admin_messaging_stats(): Messaging metrics for admin dashboard
CREATE OR REPLACE FUNCTION admin_messaging_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_conversations', (SELECT count(*) FROM conversations),
      'group_conversations', (SELECT count(*) FROM conversations WHERE is_group = TRUE),
      'direct_conversations', (SELECT count(*) FROM conversations WHERE is_group = FALSE),
      'messages_this_week', (SELECT count(*) FROM messages WHERE created_at > now() - interval '7 days'),
      'active_connections', (SELECT count(*) FROM user_connections WHERE status = 'accepted'),
      'blocked_connections', (SELECT count(*) FROM user_connections WHERE status = 'blocked'),
      -- json_object_agg keys on status so Object.entries() at
      -- AdminMessagingOverview.tsx gets {accepted: N, pending: M, ...}
      -- not [{status, total}]. Empty case → {} not [].
      'connection_distribution', (
        SELECT COALESCE(json_object_agg(status, total), '{}'::json)
        FROM (
          SELECT status, count(*) AS total
          FROM user_connections
          GROUP BY status
        ) t
      )
    )
  );
END;
$$;

-- admin_list_users(p_search, p_limit, p_offset): User listing for admin dashboard
--
-- SECURITY DEFINER: auth.users.last_sign_in_at is the activity truth source and
-- is NOT reachable through RLS from the client. The JWT guard is the only gate.
--
-- activity is computed in SQL so the admin stats and this listing agree on what
-- "active" means — same 7-day boundary as admin_user_stats.active_this_week.
-- NULL last_sign_in_at (signed up but never returned) folds into dormant.
--
-- Search covers both username and display_name. Leading-wildcard ILIKE won't hit
-- the btree index on username but at admin-dashboard scale this is a non-issue.
--
-- Returns {total, users[]} — total is the search-filtered count ignoring
-- limit/offset, so the UI can render "showing N of M" without a second call.
CREATE OR REPLACE FUNCTION admin_list_users(
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 50,
  p_offset INT  DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pattern TEXT;
  v_total   BIGINT;
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  -- Build once, reuse twice. NULL pattern → no filter (short-circuited below).
  v_pattern := '%' || p_search || '%';

  SELECT COUNT(*) INTO v_total
  FROM user_profiles p
  WHERE p.is_admin = FALSE
    AND (p_search IS NULL
         OR p.username     ILIKE v_pattern
         OR p.display_name ILIKE v_pattern);

  RETURN json_build_object(
    'total', v_total,
    'users', COALESCE((
      SELECT json_agg(row_to_json(u))
      FROM (
        SELECT
          p.id,
          p.username,
          p.display_name,
          p.created_at,
          p.welcome_message_sent,
          au.last_sign_in_at,
          CASE
            WHEN au.last_sign_in_at IS NULL                           THEN 'dormant'
            WHEN au.last_sign_in_at > now() - interval '7 days'       THEN 'active'
            WHEN au.last_sign_in_at > now() - interval '30 days'      THEN 'idle'
            ELSE 'dormant'
          END AS activity
        FROM user_profiles p
        JOIN auth.users au ON au.id = p.id
        WHERE p.is_admin = FALSE
          AND (p_search IS NULL
               OR p.username     ILIKE v_pattern
               OR p.display_name ILIKE v_pattern)
        ORDER BY au.last_sign_in_at DESC NULLS LAST, p.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) u
    ), '[]'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_list_users(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_users(TEXT, INT, INT) TO authenticated;

-- admin_payment_trends(p_start, p_end): Date-ranged payment breakdown for admin dashboard
--
-- SECURITY DEFINER: bypasses RLS by design. The JWT guard on the first line is the
-- ONLY access check — non-admin callers get {} and never reach the aggregation.
-- This is the pattern for admin aggregates that must work even on tables where
-- the admin has no row-level SELECT policy (see: messaging). payment_results
-- happens to have an admin RLS policy too, but this function does not rely on it.
--
-- Refund rate = refunded / succeeded (0 when succeeded = 0, no NaN).
-- daily_series is DENSE: generate_series emits every day in range, LEFT JOIN fills
-- gaps with zeros. Charts can render directly without client-side gap-filling.
CREATE OR REPLACE FUNCTION admin_payment_trends(
  p_start TIMESTAMPTZ DEFAULT (now() - interval '7 days'),
  p_end   TIMESTAMPTZ DEFAULT now()
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_succeeded     BIGINT;
  v_failed        BIGINT;
  v_refunded      BIGINT;
  v_revenue_cents BIGINT;
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  -- Single pass over the range for totals. COUNT/SUM over a condition are
  -- expressed with FILTER so the planner scans payment_results once.
  SELECT
    COUNT(*) FILTER (WHERE status = 'succeeded'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'refunded'),
    COALESCE(SUM(charged_amount) FILTER (WHERE status = 'succeeded'), 0)
  INTO v_succeeded, v_failed, v_refunded, v_revenue_cents
  FROM payment_results
  WHERE created_at >= p_start AND created_at < p_end;

  RETURN json_build_object(
    'range', json_build_object('start', p_start, 'end', p_end),
    'totals', json_build_object(
      'succeeded',     v_succeeded,
      'failed',        v_failed,
      'refunded',      v_refunded,
      'revenue_cents', v_revenue_cents
    ),
    'refund_rate', CASE
      WHEN v_succeeded = 0 THEN 0
      ELSE round(v_refunded::numeric / v_succeeded::numeric, 4)
    END,
    'provider_breakdown', (
      SELECT COALESCE(json_agg(row_to_json(p) ORDER BY p.revenue_cents DESC), '[]'::json)
      FROM (
        SELECT
          provider,
          COUNT(*) FILTER (WHERE status = 'succeeded')                        AS succeeded,
          COUNT(*) FILTER (WHERE status = 'failed')                           AS failed,
          COUNT(*) FILTER (WHERE status = 'refunded')                         AS refunded,
          COALESCE(SUM(charged_amount) FILTER (WHERE status = 'succeeded'), 0) AS revenue_cents
        FROM payment_results
        WHERE created_at >= p_start AND created_at < p_end
        GROUP BY provider
      ) p
    ),
    'daily_series', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json)
      FROM (
        SELECT
          to_char(days.day, 'YYYY-MM-DD')               AS day,
          COALESCE(agg.succeeded, 0)                    AS succeeded,
          COALESCE(agg.failed, 0)                       AS failed,
          COALESCE(agg.revenue_cents, 0)                AS revenue_cents
        FROM generate_series(
          date_trunc('day', p_start),
          date_trunc('day', p_end),
          interval '1 day'
        ) AS days(day)
        LEFT JOIN (
          SELECT
            date_trunc('day', created_at)                                        AS day,
            COUNT(*) FILTER (WHERE status = 'succeeded')                         AS succeeded,
            COUNT(*) FILTER (WHERE status = 'failed')                            AS failed,
            COALESCE(SUM(charged_amount) FILTER (WHERE status = 'succeeded'), 0) AS revenue_cents
          FROM payment_results
          WHERE created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) agg ON agg.day = days.day
      ) d
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_payment_trends(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_payment_trends(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- admin_audit_trends(p_start, p_end, ...): Failed-login burst detection for admin dashboard
--
-- SECURITY DEFINER: JWT guard is the only gate. auth_audit_logs happens to have an
-- admin RLS policy, but this function does not rely on it — same pattern as
-- admin_payment_trends so messaging aggregates can follow without an RLS policy.
--
-- Bursts (gaps-and-islands): a burst is a contiguous run of sign_in_failed rows
-- from one IP where no two consecutive attempts are more than p_burst_gap apart.
-- LAG finds gaps, cumulative SUM assigns a burst_id, GROUP BY (ip, burst_id)
-- collapses each run, HAVING count >= p_burst_min_attempts keeps the meaningful ones.
-- An IP that fails once on Monday and 12 times in a tight cluster on Friday yields
-- ONE burst (Friday), not a misleading 5-day span.
--
-- distinct_users disambiguates: 1 = targeted account, many = credential stuffing.
-- COUNT(DISTINCT user_id) ignores NULL, which is correct — failed logins against
-- unknown emails have user_id=NULL and shouldn't inflate the distinct count.
CREATE OR REPLACE FUNCTION admin_audit_trends(
  p_start              TIMESTAMPTZ DEFAULT (now() - interval '7 days'),
  p_end                TIMESTAMPTZ DEFAULT now(),
  p_burst_min_attempts INT         DEFAULT 5,
  p_burst_gap          INTERVAL    DEFAULT interval '10 minutes'
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed    BIGINT;
  v_succeeded BIGINT;
  v_bursts    JSON;
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  -- Totals: single scan over the range, FILTER for multi-count
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'sign_in_failed'),
    COUNT(*) FILTER (WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE)
  INTO v_failed, v_succeeded
  FROM auth_audit_logs
  WHERE created_at >= p_start AND created_at < p_end;

  -- Burst sessionization. The first row per IP has LAG=NULL → NULL > interval
  -- is NULL → CASE falls through to 0, so burst_id starts at 0 per IP. Correct.
  WITH failed AS (
    SELECT ip_address, user_id, created_at
    FROM auth_audit_logs
    WHERE event_type = 'sign_in_failed'
      AND ip_address IS NOT NULL
      AND created_at >= p_start AND created_at < p_end
  ),
  gapped AS (
    SELECT *,
      CASE
        WHEN created_at - LAG(created_at) OVER (
          PARTITION BY ip_address ORDER BY created_at
        ) > p_burst_gap
        THEN 1 ELSE 0
      END AS gap
    FROM failed
  ),
  bursted AS (
    SELECT *,
      SUM(gap) OVER (PARTITION BY ip_address ORDER BY created_at) AS burst_id
    FROM gapped
  )
  SELECT COALESCE(json_agg(row_to_json(b) ORDER BY b.attempts DESC), '[]'::json)
  INTO v_bursts
  FROM (
    SELECT
      host(ip_address)             AS ip_address,
      MIN(created_at)              AS first_seen,
      MAX(created_at)              AS last_seen,
      COUNT(*)::int                AS attempts,
      COUNT(DISTINCT user_id)::int AS distinct_users
    FROM bursted
    GROUP BY ip_address, burst_id
    HAVING COUNT(*) >= p_burst_min_attempts
  ) b;

  RETURN json_build_object(
    'range', json_build_object('start', p_start, 'end', p_end),
    'totals', json_build_object(
      'sign_in_failed',  v_failed,
      'sign_in_success', v_succeeded,
      'bursts',          COALESCE(json_array_length(v_bursts), 0)
    ),
    'bursts', v_bursts,
    'daily_series', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json)
      FROM (
        SELECT
          to_char(days.day, 'YYYY-MM-DD') AS day,
          COALESCE(agg.failed, 0)         AS failed,
          COALESCE(agg.succeeded, 0)      AS succeeded
        FROM generate_series(
          date_trunc('day', p_start),
          date_trunc('day', p_end),
          interval '1 day'
        ) AS days(day)
        LEFT JOIN (
          SELECT
            date_trunc('day', created_at)                                                           AS day,
            COUNT(*) FILTER (WHERE event_type = 'sign_in_failed')                                   AS failed,
            COUNT(*) FILTER (WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE) AS succeeded
          FROM auth_audit_logs
          WHERE created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) agg ON agg.day = days.day
      ) d
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_audit_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_audit_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT, INTERVAL) TO authenticated;

-- admin_messaging_trends(p_start, p_end, p_top_limit): Messaging volume for admin dashboard
--
-- SECURITY DEFINER: messages RLS is participant-only. Admin is not a
-- participant in most conversations, so counting rows at all requires
-- bypassing RLS. The JWT guard is the only gate.
--
-- THE ENCRYPTION BOUNDARY:
-- messages.encrypted_content and messages.initialization_vector are NEVER
-- named in this function. Column lists are explicit — no SELECT * anywhere.
-- conversation_id is also excluded from output: emitting {user_id,
-- conversation_id, count} would let an admin reconstruct the social graph
-- by correlating rows. {user_id, count} alone is traffic volume, not
-- who-talks-to-whom. Count and trend, not decrypt and display.
--
-- deleted messages are filtered out — a burst of sends-then-deletes is a
-- user decision we shouldn't surface as "volume" in the admin view.
--
-- daily_series is dense (generate_series spine, two LEFT JOINs) so the UI
-- gets a contiguous x-axis even on zero-traffic days.
CREATE OR REPLACE FUNCTION admin_messaging_trends(
  p_start     TIMESTAMPTZ DEFAULT now() - interval '7 days',
  p_end       TIMESTAMPTZ DEFAULT now(),
  p_top_limit INT         DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_messages       BIGINT;
  v_active_senders BIGINT;
  v_convs_created  BIGINT;
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  -- Message totals: one scan, two facts. Only sender_id/created_at/deleted
  -- touched — the ciphertext columns are not in this query at any layer.
  SELECT COUNT(*), COUNT(DISTINCT sender_id)
  INTO v_messages, v_active_senders
  FROM messages
  WHERE deleted = FALSE
    AND created_at >= p_start AND created_at < p_end;

  SELECT COUNT(*) INTO v_convs_created
  FROM conversations
  WHERE created_at >= p_start AND created_at < p_end;

  RETURN json_build_object(
    'range', json_build_object('start', p_start, 'end', p_end),
    'totals', json_build_object(
      'messages',              v_messages,
      'conversations_created', v_convs_created,
      'active_senders',        v_active_senders
    ),
    'daily_series', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json)
      FROM (
        SELECT
          to_char(days.day, 'YYYY-MM-DD')   AS day,
          COALESCE(m.messages, 0)           AS messages,
          COALESCE(c.conversations_created, 0) AS conversations_created
        FROM generate_series(
          date_trunc('day', p_start),
          date_trunc('day', p_end),
          interval '1 day'
        ) AS days(day)
        LEFT JOIN (
          SELECT date_trunc('day', created_at) AS day, COUNT(*) AS messages
          FROM messages
          WHERE deleted = FALSE
            AND created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) m ON m.day = days.day
        LEFT JOIN (
          SELECT date_trunc('day', created_at) AS day, COUNT(*) AS conversations_created
          FROM conversations
          WHERE created_at >= p_start AND created_at < p_end
          GROUP BY date_trunc('day', created_at)
        ) c ON c.day = days.day
      ) d
    ),
    'top_senders', (
      -- user_id + aggregate count only. No conversation_id, no recipient
      -- dimension. The admin sees WHO is noisy, not who they're noisy AT.
      SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
      FROM (
        SELECT
          msg.sender_id  AS user_id,
          p.username     AS username,
          p.display_name AS display_name,
          COUNT(*)::int  AS messages
        FROM messages msg
        JOIN user_profiles p ON p.id = msg.sender_id
        WHERE msg.deleted = FALSE
          AND msg.created_at >= p_start AND msg.created_at < p_end
          AND p.is_admin = FALSE
        GROUP BY msg.sender_id, p.username, p.display_name
        ORDER BY COUNT(*) DESC
        LIMIT p_top_limit
      ) s
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_messaging_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_messaging_trends(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

-- admin_conversation_list(p_limit, p_offset): Per-conversation metadata
--
-- The trends RPC above deliberately omits conversation_id to prevent
-- social-graph reconstruction from {sender, conversation, count} tuples.
-- This function crosses that line on purpose — per-row drill-down is
-- needed to spot spam floods and dead channels — but holds a weaker
-- boundary: conversation_id + counts + timestamps, NO participant IDs,
-- NO group_name. The admin sees "conversation abc has 800 messages", not
-- "Alice and Bob have 800 messages".
--
-- participant_count: the check_group_participants constraint guarantees
-- both participant columns are NOT NULL for is_group=FALSE, so direct
-- chats are hard-coded to 2. Groups count active conversation_members.
--
-- message_count: non-deleted, non-system. 'member_joined' etc. are
-- protocol noise, not user traffic.
--
-- SECURITY DEFINER: conversations RLS is participant-only and admins are
-- not participants. Same JWT gate as the other admin functions. The
-- DEFINER privilege is spent only on the SELECTs below, which name
-- metadata columns explicitly — encrypted_content and
-- initialization_vector appear nowhere.
--
-- Returns {total, conversations[]} so the caller gets "showing N of M"
-- without a second round-trip. Same shape as admin_list_users.
CREATE OR REPLACE FUNCTION admin_conversation_list(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  RETURN json_build_object(
    'total', (SELECT COUNT(*) FROM conversations),
    'conversations', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
      FROM (
        SELECT
          conv.id                                         AS conversation_id,
          conv.is_group                                   AS is_group,
          CASE
            WHEN conv.is_group THEN COALESCE(cm.active_members, 0)::int
            ELSE 2
          END                                             AS participant_count,
          COALESCE(m.message_count, 0)::int               AS message_count,
          COALESCE(conv.last_message_at, conv.created_at) AS last_activity,
          conv.created_at                                 AS created_at
        FROM conversations conv
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) AS message_count
          FROM messages
          WHERE deleted = FALSE AND is_system_message = FALSE
          GROUP BY conversation_id
        ) m ON m.conversation_id = conv.id
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) AS active_members
          FROM conversation_members
          WHERE left_at IS NULL
          GROUP BY conversation_id
        ) cm ON cm.conversation_id = conv.id
        ORDER BY COALESCE(conv.last_message_at, conv.created_at) DESC
        LIMIT p_limit OFFSET p_offset
      ) c
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_conversation_list(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_conversation_list(INT, INT) TO authenticated;

-- admin_overview(p_start, p_end): Composite dashboard payload — one round-trip, all four domains
--
-- Calls the four existing *_stats() functions server-side rather than
-- re-aggregating. Those functions are SECURITY INVOKER, but auth.jwt()
-- reads from request context not function security mode, so their JWT
-- guards still gate correctly when called from inside this DEFINER body.
-- The win: when admin_payment_stats changes, the overview inherits it.
--
-- sparks: four integer arrays, one point per day in [v_start, v_end],
-- oldest → newest, zero-filled. Plain arrays (not [{day, value}] objects)
-- because the sparkline SVG index-maps x — it doesn't need the dates.
-- Default 7 ticks; a 30-day range produces 30-element arrays and the
-- Sparkline just draws a denser polyline. One generate_series spine,
-- four LEFT JOINs.
--
-- DEFINER because the messages spark crosses RLS. user_profiles spark
-- (signups) and payment_results spark would work under INVOKER with the
-- admin's RLS policies, but making the whole function DEFINER keeps the
-- composition uniform. The JWT check is the only gate.
--
-- DROP the zero-arg overload first. PG identifies functions by name+argtypes,
-- so CREATE OR REPLACE admin_overview(p_start, p_end) doesn't touch
-- admin_overview(). With both in pg_proc, PostgREST returns 300 Multiple
-- Choices when called with {} since both overloads satisfy all-defaults.
DROP FUNCTION IF EXISTS admin_overview();

CREATE OR REPLACE FUNCTION admin_overview(
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end   TIMESTAMPTZ;
BEGIN
  IF NOT COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) THEN
    RETURN '{}'::json;
  END IF;

  -- Day-truncate whatever bounds we got so the spine walks whole days.
  -- NULL defaults COALESCE to the original [today-6, today] 7-tick window
  -- — NOT the *_trends pattern of now()-7d..now() which truncates to 8
  -- ticks depending on time-of-day. v_end resolves before v_start reads it.
  v_end   := date_trunc('day', COALESCE(p_end, now()));
  v_start := date_trunc('day', COALESCE(p_start, v_end - interval '6 days'));

  RETURN json_build_object(
    -- Echo the window the SQL actually used (post-COALESCE, post-trunc)
    -- so the UI knows what range it's showing when the caller omitted
    -- bounds. Same key as the *_trends RPCs.
    'range', json_build_object('start', v_start, 'end', v_end),

    'payments',  admin_payment_stats(),
    'auth',      admin_auth_stats(),
    'users',     admin_user_stats(),
    'messaging', admin_messaging_stats(),

    'sparks', (
      -- Half-open range on each subquery: [day, day+1). Next-day traffic
      -- doesn't bleed into today's bucket. ORDER BY days.day is load-bearing
      -- — json_agg without it would emit whatever hash order the joins land
      -- in and the sparkline would render scrambled.
      SELECT json_build_object(
        'payments', json_agg(COALESCE(p.n, 0)  ORDER BY days.day),
        'logins',   json_agg(COALESCE(a.n, 0)  ORDER BY days.day),
        'signups',  json_agg(COALESCE(u.n, 0)  ORDER BY days.day),
        'messages', json_agg(COALESCE(m.n, 0)  ORDER BY days.day)
      )
      FROM generate_series(v_start, v_end, interval '1 day') AS days(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM payment_results
        WHERE status = 'succeeded'
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) p ON p.day = days.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM auth_audit_logs
        WHERE event_type IN ('sign_in', 'sign_in_success') AND success = TRUE
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) a ON a.day = days.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM user_profiles
        WHERE is_admin = FALSE
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) u ON u.day = days.day
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, COUNT(*) AS n
        FROM messages
        WHERE deleted = FALSE
          AND created_at >= v_start AND created_at < v_end + interval '1 day'
        GROUP BY 1
      ) m ON m.day = days.day
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_overview(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_overview(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

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
--
-- Local-profile caveat: this whole block is wrapped in a DO/EXCEPTION guard.
-- On Supabase Cloud it runs exactly as before -- nothing throws, the handler
-- never fires. On a fresh local initdb it soft-skips, because at this point
-- in the boot GoTrue has not yet connected and run its ~40 numbered runtime
-- migrations. Two things are missing that this INSERT needs:
--
--   (1) auth.users.email_confirmed_at and .email_change_token_new -- the base
--       image ships the original 2016-era column names (confirmed_at,
--       email_change_token). GoTrue's migrations rename/add these later.
--   (2) auth.identities -- the whole table. Zero hits for "identities" in the
--       base image's initdb.d/. GoTrue creates it on first connect.
--
-- Unlike the storage.buckets and auth.jwt() forward-fills elsewhere in this
-- file, forward-filling here would BREAK GoTrue: its numbered migrations are
-- tracked in auth.schema_migrations and have no IF NOT EXISTS guards, so a
-- pre-existing email_confirmed_at column or identities table makes GoTrue's
-- own ADD COLUMN / CREATE TABLE crash on 42701/42P07. The DO/EXCEPTION wrap
-- is the only shape that is a no-op in both directions.
--
-- Local seeding is handled post-boot by scripts/seed-test-users.ts via the
-- admin API, after GoTrue has migrated itself. Nothing is lost.

DO $seed_test_user$
BEGIN
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

EXCEPTION
  WHEN undefined_column OR undefined_table THEN
    RAISE NOTICE
      'Skipping test-user seed (GoTrue has not migrated auth schema yet: %). '
      'On the local profile this is expected -- run scripts/seed-test-users.ts '
      'after the stack is healthy.', SQLERRM;
END
$seed_test_user$;

-- ============================================================================
-- PART 9: USER MESSAGING SYSTEM (PRP-023)
-- ============================================================================
-- End-to-end encrypted messaging with friend requests
-- Features: Zero-knowledge E2E encryption, real-time delivery, typing indicators
-- Tables: 6 (user_connections, conversations, messages, user_encryption_keys, conversation_keys, typing_indicators)

-- Table 1: user_connections (Friend requests)
CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_connection CHECK (requester_id != addressee_id),
  CONSTRAINT unique_connection UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_user_connections_requester ON user_connections(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_user_connections_addressee ON user_connections(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_user_connections_status ON user_connections(status);

ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own connections" ON user_connections;
CREATE POLICY "Users can view own connections" ON user_connections
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can create friend requests" ON user_connections;
CREATE POLICY "Users can create friend requests" ON user_connections
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Addressee can update connection status" ON user_connections;
CREATE POLICY "Addressee can update connection status" ON user_connections
  FOR UPDATE USING (auth.uid() = addressee_id) WITH CHECK (auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can delete own sent requests" ON user_connections;
CREATE POLICY "Users can delete own sent requests" ON user_connections
  FOR DELETE USING (auth.uid() = requester_id AND status = 'pending');

COMMENT ON TABLE user_connections IS 'Friend request management with status tracking';

-- Table 2: conversations (1-to-1 chats)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  archived_by_participant_1 BOOLEAN NOT NULL DEFAULT FALSE,
  archived_by_participant_2 BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_conversation CHECK (participant_1_id != participant_2_id),
  CONSTRAINT canonical_ordering CHECK (participant_1_id < participant_2_id),
  CONSTRAINT unique_conversation UNIQUE (participant_1_id, participant_2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(participant_1_id, archived_by_participant_1, participant_2_id, archived_by_participant_2);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

DROP POLICY IF EXISTS "Users can create conversations with connections" ON conversations;
CREATE POLICY "Users can create conversations with connections" ON conversations
  FOR INSERT WITH CHECK (
    (auth.uid() = participant_1_id OR auth.uid() = participant_2_id) AND
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE status = 'accepted' AND (
        (requester_id = participant_1_id AND addressee_id = participant_2_id) OR
        (requester_id = participant_2_id AND addressee_id = participant_1_id)
      )
    )
  );

-- Admin can create conversations with any user (Feature 002 - welcome messages)
DROP POLICY IF EXISTS "Admin can create any conversation" ON conversations;
CREATE POLICY "Admin can create any conversation" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- Users can create conversations with admin for welcome messages (Feature 004)
-- This allows the client-side welcome service to create the conversation
DROP POLICY IF EXISTS "Users can create conversation with admin" ON conversations;
CREATE POLICY "Users can create conversation with admin" ON conversations
  FOR INSERT WITH CHECK (
    (auth.uid() = participant_1_id OR auth.uid() = participant_2_id) AND
    (participant_1_id = '00000000-0000-0000-0000-000000000001'::uuid OR
     participant_2_id = '00000000-0000-0000-0000-000000000001'::uuid)
  );

DROP POLICY IF EXISTS "System can update last_message_at" ON conversations;
CREATE POLICY "System can update last_message_at" ON conversations
  FOR UPDATE TO service_role USING (true);

-- Allow users to archive/unarchive their own conversations
DROP POLICY IF EXISTS "Users can update own conversation archive status" ON conversations;
CREATE POLICY "Users can update own conversation archive status" ON conversations
  FOR UPDATE USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id)
  WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

COMMENT ON TABLE conversations IS '1-to-1 conversations with canonical ordering';

-- Table 3: messages (Encrypted content)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  initialization_vector TEXT NOT NULL,
  sequence_number BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false,
  edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Note: sender_is_participant validation enforced by RLS policy, not CHECK constraint
  -- (PostgreSQL doesn't allow subqueries in CHECK constraints)
  CONSTRAINT unique_sequence UNIQUE (conversation_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(read_at) WHERE read_at IS NULL;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
CREATE POLICY "Users can view messages in own conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can send messages to own conversations" ON messages;
CREATE POLICY "Users can send messages to own conversations" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

-- Users can insert welcome messages from admin (Feature 004)
-- Allows client-side welcome service to insert message with sender_id = admin
-- Only allowed in conversations where user is a participant with admin
DROP POLICY IF EXISTS "Users can insert welcome message from admin" ON messages;
CREATE POLICY "Users can insert welcome message from admin" ON messages
  FOR INSERT WITH CHECK (
    sender_id = '00000000-0000-0000-0000-000000000001'::uuid AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        (conversations.participant_1_id = auth.uid() AND
         conversations.participant_2_id = '00000000-0000-0000-0000-000000000001'::uuid) OR
        (conversations.participant_2_id = auth.uid() AND
         conversations.participant_1_id = '00000000-0000-0000-0000-000000000001'::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "Users can edit own messages" ON messages;
CREATE POLICY "Users can edit own messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() AND created_at > now() - INTERVAL '15 minutes');

-- Allow recipients to mark messages as read (update read_at field)
-- This is separate from edit policy because recipients need to update messages they didn't send
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON messages;
CREATE POLICY "Recipients can mark messages as read" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
    AND sender_id != auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
    AND sender_id != auth.uid()
  );

DROP POLICY IF EXISTS "Users cannot delete messages" ON messages;
CREATE POLICY "Users cannot delete messages" ON messages
  FOR DELETE USING (false);

-- Admin dashboard read-only policies for the three messaging tables. These
-- belong semantically with the other admin policies up in PART 7 (~line 608)
-- but can't live there: user_connections / conversations / messages are
-- forward references until this point. On Cloud nobody noticed because the
-- tables persist across re-runs; on a fresh local initdb this was crash #3.
DROP POLICY IF EXISTS "Admin can view all connections" ON user_connections;
CREATE POLICY "Admin can view all connections" ON user_connections
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view conversation metadata" ON conversations;
CREATE POLICY "Admin can view conversation metadata" ON conversations
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admin can view message metadata" ON messages;
CREATE POLICY "Admin can view message metadata" ON messages
  FOR SELECT USING (
    COALESCE((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false) = true
  );

COMMENT ON TABLE messages IS 'E2E encrypted messages with 15-minute edit window';

-- Table 4: user_encryption_keys (Public ECDH keys + password-derived salt)
-- encryption_salt: Base64-encoded 16-byte Argon2 salt for password-derived keys
-- NULL salt indicates legacy random-generated keys requiring migration (Feature 032)
CREATE TABLE IF NOT EXISTS user_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  public_key JSONB NOT NULL,
  encryption_salt TEXT, -- Base64 Argon2 salt (NULL = legacy keys)
  device_id TEXT,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_user ON user_encryption_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_active ON user_encryption_keys(user_id, revoked, expires_at)
  WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_user_encryption_keys_salt ON user_encryption_keys(user_id)
  WHERE encryption_salt IS NOT NULL;

ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public keys" ON user_encryption_keys;
CREATE POLICY "Anyone can view public keys" ON user_encryption_keys
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own keys" ON user_encryption_keys;
CREATE POLICY "Users can create own keys" ON user_encryption_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can revoke own keys" ON user_encryption_keys;
CREATE POLICY "Users can revoke own keys" ON user_encryption_keys
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users cannot delete keys" ON user_encryption_keys;
CREATE POLICY "Users cannot delete keys" ON user_encryption_keys
  FOR DELETE USING (false);

COMMENT ON TABLE user_encryption_keys IS 'Public ECDH keys - private keys NEVER in database';

-- Table 5: conversation_keys (Encrypted shared secrets)
CREATE TABLE IF NOT EXISTS conversation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_shared_secret TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_conversation_user_version UNIQUE (conversation_id, user_id, key_version)
);

CREATE INDEX IF NOT EXISTS idx_conversation_keys_conversation ON conversation_keys(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_keys_user ON conversation_keys(user_id);

ALTER TABLE conversation_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversation keys" ON conversation_keys;
CREATE POLICY "Users can view own conversation keys" ON conversation_keys
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create conversation keys" ON conversation_keys;
CREATE POLICY "Users can create conversation keys" ON conversation_keys
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users cannot update keys" ON conversation_keys;
CREATE POLICY "Users cannot update keys" ON conversation_keys
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Users cannot delete keys" ON conversation_keys;
CREATE POLICY "Users cannot delete keys" ON conversation_keys
  FOR DELETE USING (false);

COMMENT ON TABLE conversation_keys IS 'Immutable encrypted shared secrets';

-- Table 6: typing_indicators (Real-time typing status)
CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_conversation_user UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_indicators_conversation ON typing_indicators(conversation_id, updated_at DESC);

ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view typing in own conversations" ON typing_indicators;
CREATE POLICY "Users can view typing in own conversations" ON typing_indicators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = typing_indicators.conversation_id AND (
        conversations.participant_1_id = auth.uid() OR
        conversations.participant_2_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own typing status" ON typing_indicators;
CREATE POLICY "Users can insert own typing status" ON typing_indicators
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own typing status" ON typing_indicators;
CREATE POLICY "Users can update own typing status" ON typing_indicators
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System can clean up old indicators" ON typing_indicators;
CREATE POLICY "System can clean up old indicators" ON typing_indicators
  FOR DELETE TO service_role USING (updated_at < now() - INTERVAL '5 seconds');

COMMENT ON TABLE typing_indicators IS 'Real-time typing with auto-expire after 5 seconds';

-- Messaging Triggers
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_inserted ON messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

CREATE OR REPLACE FUNCTION assign_sequence_number()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE next_seq BIGINT;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO next_seq
  FROM messages WHERE conversation_id = NEW.conversation_id;
  NEW.sequence_number := next_seq;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_message_insert ON messages;
CREATE TRIGGER before_message_insert
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION assign_sequence_number();

COMMENT ON FUNCTION update_conversation_timestamp() IS 'Auto-update conversation.last_message_at';
COMMENT ON FUNCTION assign_sequence_number() IS 'Auto-increment message sequence numbers';

-- Grant permissions for messaging tables
GRANT ALL ON user_connections TO authenticated, service_role;
GRANT ALL ON conversations TO authenticated, service_role;
GRANT ALL ON messages TO authenticated, service_role;
GRANT ALL ON user_encryption_keys TO authenticated, service_role;
GRANT ALL ON conversation_keys TO authenticated, service_role;
GRANT ALL ON typing_indicators TO authenticated, service_role;

-- ============================================================================
-- PART 10.5: GROUP CHAT SUPPORT (Feature 010)
-- ============================================================================
-- Symmetric key encryption for group messages
-- Features: Up to 200 members, key versioning, history restriction, key rotation
-- Tables modified: conversations, messages
-- Tables new: conversation_members, group_keys

-- T006: Add group columns to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS group_name TEXT CHECK (length(group_name) <= 100),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS current_key_version INTEGER NOT NULL DEFAULT 1;

-- Make participant columns nullable for groups (they must be NULL for is_group=true)
ALTER TABLE conversations
  ALTER COLUMN participant_1_id DROP NOT NULL,
  ALTER COLUMN participant_2_id DROP NOT NULL;

-- CHK023: Enforce is_group validation via CHECK constraint
-- Drop existing constraint if it exists (for idempotency)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS check_group_participants;
ALTER TABLE conversations ADD CONSTRAINT check_group_participants CHECK (
  (is_group = false AND participant_1_id IS NOT NULL AND participant_2_id IS NOT NULL)
  OR
  (is_group = true AND participant_1_id IS NULL AND participant_2_id IS NULL AND created_by IS NOT NULL)
);

-- T007: Add key_version column to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1;

-- T008: Add system message columns to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS system_message_type TEXT;

-- CHK027: Validate system_message_type enum values
ALTER TABLE messages DROP CONSTRAINT IF EXISTS check_system_message_type;
ALTER TABLE messages ADD CONSTRAINT check_system_message_type CHECK (
  system_message_type IS NULL
  OR system_message_type IN (
    'member_joined',
    'member_left',
    'member_removed',
    'group_created',
    'group_renamed',
    'ownership_transferred'
  )
);

-- T009: Create conversation_members junction table
CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  key_version_joined INTEGER NOT NULL DEFAULT 1,
  key_status TEXT NOT NULL DEFAULT 'active' CHECK (key_status IN ('active', 'pending')),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  muted BOOLEAN NOT NULL DEFAULT FALSE
);

-- CHK025: Unique active membership per user per conversation
-- This constraint allows same user_id + conversation_id only if one has left_at set
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_membership
  ON conversation_members(conversation_id, user_id) WHERE left_at IS NULL;

-- T010: Create group_keys table
CREATE TABLE IF NOT EXISTS group_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  key_version INTEGER NOT NULL DEFAULT 1,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  CONSTRAINT unique_group_key_version UNIQUE (conversation_id, user_id, key_version)
);

-- T011: Add indexes for conversation_members and group_keys tables
-- CHK026: Indexes for fast member list lookup
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
  ON conversation_members(conversation_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON conversation_members(user_id) WHERE left_at IS NULL;

-- Indexes for group_keys
CREATE INDEX IF NOT EXISTS idx_group_keys_conversation
  ON group_keys(conversation_id, key_version DESC);
CREATE INDEX IF NOT EXISTS idx_group_keys_user
  ON group_keys(user_id, conversation_id);

-- T012: Enable RLS on conversation_members and group_keys tables
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_keys ENABLE ROW LEVEL SECURITY;

-- T013: RLS policies for conversation_members

-- FIX: Create SECURITY DEFINER function to check membership without triggering RLS
-- This prevents infinite recursion when RLS policies query conversation_members
CREATE OR REPLACE FUNCTION is_conversation_member(conv_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id
      AND user_id = check_user_id
      AND left_at IS NULL
  );
$$;

-- FIX: Check if user is owner of conversation (for permission checks)
CREATE OR REPLACE FUNCTION is_conversation_owner(conv_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id
      AND user_id = check_user_id
      AND role = 'owner'
      AND left_at IS NULL
  );
$$;

-- SELECT: Members can see other members of their conversations
DROP POLICY IF EXISTS "Members can view conversation members" ON conversation_members;
CREATE POLICY "Members can view conversation members" ON conversation_members
  FOR SELECT USING (
    is_conversation_member(conversation_id)
  );

-- INSERT: Any member can add (connection validation in service layer)
DROP POLICY IF EXISTS "Members can add to their conversations" ON conversation_members;
CREATE POLICY "Members can add to their conversations" ON conversation_members
  FOR INSERT WITH CHECK (
    is_conversation_member(conversation_id)
    OR user_id = auth.uid()  -- Self-join on creation
  );

-- UPDATE: Members can update own preferences, owners can update others
DROP POLICY IF EXISTS "Members can update membership" ON conversation_members;
CREATE POLICY "Members can update membership" ON conversation_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR is_conversation_owner(conversation_id)
  );

-- DELETE: No direct deletes - use soft delete via left_at
DROP POLICY IF EXISTS "No direct member deletes" ON conversation_members;
CREATE POLICY "No direct member deletes" ON conversation_members
  FOR DELETE USING (false);

-- T014: RLS policies for group_keys

-- SELECT: Users can only see their own encrypted keys (and must be active member)
DROP POLICY IF EXISTS "Users can view their own keys" ON group_keys;
CREATE POLICY "Users can view their own keys" ON group_keys
  FOR SELECT USING (
    user_id = auth.uid()
    AND is_conversation_member(conversation_id)
  );

-- INSERT: Active members can distribute keys
DROP POLICY IF EXISTS "Members can distribute keys" ON group_keys;
CREATE POLICY "Members can distribute keys" ON group_keys
  FOR INSERT WITH CHECK (
    is_conversation_member(conversation_id)
  );

-- UPDATE: No updates allowed - keys are immutable
DROP POLICY IF EXISTS "Keys are immutable" ON group_keys;
CREATE POLICY "Keys are immutable" ON group_keys
  FOR UPDATE USING (false);

-- DELETE: No direct deletes - orphaned keys are harmless
DROP POLICY IF EXISTS "No direct key deletes" ON group_keys;
CREATE POLICY "No direct key deletes" ON group_keys
  FOR DELETE USING (false);

-- T014a: Update messages table RLS for group membership

-- Drop and recreate SELECT policy to support both 1-to-1 and groups
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
CREATE POLICY "Users can view messages in own conversations" ON messages
  FOR SELECT USING (
    -- 1-to-1 conversations: check participant columns
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.is_group = false
        AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
    )
    OR
    -- Group conversations: check membership via SECURITY DEFINER function
    is_conversation_member(conversation_id)
  );

-- Drop and recreate INSERT policy to support both 1-to-1 and groups
DROP POLICY IF EXISTS "Users can send messages to own conversations" ON messages;
CREATE POLICY "Users can send messages to own conversations" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- 1-to-1: existing logic
      EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_id
          AND c.is_group = false
          AND (c.participant_1_id = auth.uid() OR c.participant_2_id = auth.uid())
      )
      OR
      -- Group: check active membership via SECURITY DEFINER function
      is_conversation_member(conversation_id)
    )
  );

-- Grant permissions for new tables
GRANT ALL ON conversation_members TO authenticated, service_role;
GRANT ALL ON group_keys TO authenticated, service_role;

-- Enable realtime for group tables
ALTER TABLE conversation_members REPLICA IDENTITY FULL;
ALTER TABLE group_keys REPLICA IDENTITY FULL;

COMMENT ON TABLE conversation_members IS 'Junction table linking users to group conversations with membership metadata';
COMMENT ON TABLE group_keys IS 'Encrypted symmetric group keys per member per version';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Created:
--   ✅ Payment tables: payment_intents, payment_results, subscriptions, webhook_events, payment_provider_config
--   ✅ Auth tables: user_profiles, auth_audit_logs
--   ✅ Security tables: rate_limit_attempts, oauth_states
--   ✅ Messaging tables: user_connections, conversations, messages, user_encryption_keys, conversation_keys, typing_indicators
--   ✅ Group chat tables: conversation_members, group_keys (Feature 010)
--   ✅ Storage buckets: avatars (5MB limit, public read)
--   ✅ Functions: update_updated_at_column, create_user_profile, cleanup_old_audit_logs, check_rate_limit, record_failed_attempt, update_conversation_timestamp, assign_sequence_number
--   ✅ Admin RPC functions: admin_payment_stats, admin_auth_stats, admin_user_stats, admin_messaging_stats, admin_payment_trends, admin_audit_trends, admin_list_users, admin_messaging_trends, admin_overview
--   ✅ Triggers: on_auth_user_created, update_user_profiles_updated_at, on_message_inserted, before_message_insert
--   ✅ RLS policies: All tables + storage.objects protected with auth.uid() (35 + 9 admin policies)
--   ✅ Admin RLS policies: 9 read-only policies for admin dashboard (is_admin check)
--   ✅ Avatar policies: 4 policies (user isolation + public read)
--   ✅ Messaging policies: 17 policies (E2E encryption, user isolation, 15-min edit window)
--   ✅ Group chat policies: 8 policies (membership access, key distribution)
--   ✅ Permissions: Authenticated users + service role (all tables)
--   ✅ Test user: test@example.com (primary, email confirmed)
--   ✅ Admin user: scripthammer (Feature 002 - welcome messages, is_admin = TRUE)
-- ============================================================================

-- Admin profile for system welcome messages (Feature 002)
-- Fixed UUID: 00000000-0000-0000-0000-000000000001
-- NOTE: Admin RLS policies use JWT claims from auth.users.raw_app_meta_data, NOT this column.
-- To grant admin access to a real user, run:
--   UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb WHERE id = '<user-uuid>';
-- The is_admin column on user_profiles is for application-level queries only.
--
-- Local-profile caveat, same story as PART 8: user_profiles.id has an FK to
-- auth.users(id). On Cloud the admin auth.users row already exists, so this
-- INSERT is fine. On a fresh local initdb the admin row is created post-boot
-- by scripts/seed-test-users.ts -- which then fires the on_auth_user_created
-- trigger to make a bare user_profiles row, at which point re-running this
-- file (or just this one statement) hits the ON CONFLICT DO UPDATE branch and
-- fills in username / is_admin. Either way, crashing initdb over it means
-- postinit never runs and the whole stack stays on 28P01. Soft-skip instead.
DO $seed_admin_profile$
BEGIN
  INSERT INTO user_profiles (id, username, display_name, welcome_message_sent, is_admin)
  VALUES ('00000000-0000-0000-0000-000000000001', 'scripthammer', 'ScriptHammer', TRUE, TRUE)
  ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE
      'Skipping admin profile seed (no auth.users row ...001 yet: %). '
      'On the local profile this is expected -- scripts/seed-test-users.ts '
      'creates the admin user, then the on_auth_user_created trigger makes a '
      'bare profile row, then re-running this statement fills in is_admin.',
      SQLERRM;
END
$seed_admin_profile$;

-- ============================================================================
-- Feature 004: Populate OAuth user profiles (one-time migration)
-- Only updates NULL display_name for OAuth users
-- Idempotent: Safe to run multiple times (FR-006)
-- ============================================================================
UPDATE public.user_profiles p
SET
  display_name = COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1),
    'Anonymous User'
  ),
  avatar_url = COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
FROM auth.users u
WHERE p.id = u.id
  AND p.display_name IS NULL
  AND u.raw_app_meta_data->>'provider' IS DISTINCT FROM 'email';

-- ============================================================================
-- PART 10: REALTIME CONFIGURATION
-- Enable realtime subscriptions for messaging tables
-- ============================================================================
--
-- Ported from SpokeToWork fork. Required for:
--   - useUnreadCount hook (subscribes to messages INSERT/UPDATE/DELETE)
--   - real-time conversation list updates
--   - typing indicator presence
--   - group membership changes
--   - friend request status changes
--
-- REPLICA IDENTITY FULL makes UPDATE/DELETE events carry the full row
-- payload (not just the primary key), so Realtime clients can inspect
-- what changed without a follow-up query.
--
-- ALTER PUBLICATION ADD TABLE is idempotent-guarded via pg_publication_tables
-- checks — running this migration twice won't double-add.

-- Create supabase_realtime publication if it doesn't exist.
-- Supabase Cloud normally provisions this, but the guard makes the
-- migration portable to self-hosted Postgres.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- REPLICA IDENTITY FULL is required for Realtime UPDATE/DELETE events
-- to include the full row payload.
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE conversation_members REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE typing_indicators REPLICA IDENTITY FULL;
ALTER TABLE user_connections REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication.
-- Each ADD is guarded by a pg_publication_tables check so this block
-- is safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'typing_indicators'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_connections;
  END IF;
END $$;

-- Commit the transaction - everything succeeded
COMMIT;
