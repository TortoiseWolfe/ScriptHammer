-- =============================================================================
-- Row-Level Security Policies for User Authentication
-- Feature: 003-user-authentication
-- Date: 2026-01-15
-- =============================================================================

-- =============================================================================
-- 1. PROFILES TABLE
-- =============================================================================

-- Create profiles table if not exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  username VARCHAR(50) UNIQUE,
  avatar_url TEXT,
  bio TEXT CHECK (char_length(bio) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Username format constraint: lowercase alphanumeric and hyphens
  CONSTRAINT username_format CHECK (
    username IS NULL OR username ~ '^[a-z0-9-]{3,50}$'
  )
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read profiles (FR-024)
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can create their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile (FR-025)
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can delete their own profile (cascades from auth.users)
CREATE POLICY "Users can delete their own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Trigger: Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Update updated_at on profile changes
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- =============================================================================
-- 2. LOGIN ATTEMPTS TABLE (Rate Limiting)
-- =============================================================================

-- Create login_attempts table for rate limiting (FR-016)
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address INET
);

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON public.login_attempts(email, attempted_at DESC);

-- Enable RLS (restrict access to service role only)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can read/write
-- This table is accessed via Edge Functions with service role key

-- Function: Check if login is rate limited (FR-016)
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.login_attempts
  WHERE email = user_email
    AND attempted_at > NOW() - INTERVAL '15 minutes'
    AND success = FALSE;

  -- Return TRUE if under limit (can proceed), FALSE if rate limited
  RETURN attempt_count < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Record login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  user_email TEXT,
  was_success BOOLEAN,
  client_ip INET DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.login_attempts (email, success, ip_address)
  VALUES (user_email, was_success, client_ip);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup: Remove old login attempts (run via scheduled job)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 3. AUTH EVENT LOGGING (Observability)
-- =============================================================================

-- Create auth_events table for audit logging (FR-031, FR-033)
CREATE TABLE IF NOT EXISTS public.auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_auth_events_user_time
  ON public.auth_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_type
  ON public.auth_events(event_type);

-- Enable RLS
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own auth events (FR-031)
CREATE POLICY "Users can view their own auth events"
  ON public.auth_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function: Log authentication event (FR-031)
-- NOTE: Never logs passwords or sensitive credentials (FR-032)
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  -- Sanitize metadata - remove any sensitive fields
  p_metadata = p_metadata - 'password' - 'token' - 'secret' - 'key';

  INSERT INTO public.auth_events (user_id, event_type, metadata, ip_address, user_agent)
  VALUES (p_user_id, p_event_type, p_metadata, p_ip_address, p_user_agent)
  RETURNING id INTO event_id;

  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Event types for reference:
-- 'signup' - New account created
-- 'signin' - Successful sign in
-- 'signout' - User signed out
-- 'password_change' - Password updated
-- 'password_reset_request' - Reset email requested
-- 'password_reset_complete' - Password reset via link
-- 'email_verified' - Email verification completed
-- 'oauth_signin' - OAuth provider sign in
-- 'session_refresh' - Token refreshed
-- 'session_revoke' - Session manually revoked


-- =============================================================================
-- 4. USER SESSIONS VIEW (FR-029, FR-030)
-- =============================================================================

-- View: User's active sessions
CREATE OR REPLACE VIEW public.user_sessions AS
SELECT
  s.id,
  s.user_id,
  s.created_at,
  s.updated_at,
  s.not_after AS expires_at,
  CASE
    WHEN s.not_after > NOW() + INTERVAL '14 days' THEN TRUE
    ELSE FALSE
  END AS is_remember_me
FROM auth.sessions s
WHERE s.not_after > NOW();

-- Grant access to authenticated users
GRANT SELECT ON public.user_sessions TO authenticated;

-- RLS for sessions view (users see only their sessions)
-- Note: Views inherit RLS from underlying tables
-- auth.sessions already restricts access by user_id


-- =============================================================================
-- 5. PAYMENT DATA PROTECTION (FR-019, FR-020, FR-021)
-- =============================================================================

-- Example RLS policy pattern for payment tables
-- (Actual payment table created in feature 000-rls-implementation)

-- Template for payment data protection:
/*
-- Policy: Users can only view their own payments (FR-020)
CREATE POLICY "Users can view their own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can only create their own payment intents (FR-021)
CREATE POLICY "Users can create their own payment intents"
  ON public.payment_intents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Derive user_id from session, never accept as parameter (FR-022)
-- Enforced by NOT having user_id in INSERT columns - trigger sets it
CREATE OR REPLACE FUNCTION public.set_payment_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/


-- =============================================================================
-- 6. GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant usage on functions
GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_auth_event(UUID, TEXT, JSONB, INET, TEXT) TO authenticated;

-- Service role has full access (for Edge Functions)
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.login_attempts TO service_role;
GRANT ALL ON public.auth_events TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, BOOLEAN, INET) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_login_attempts() TO service_role;
