-- =============================================================================
-- RLS Policies for User Authentication System
-- Feature: 003-user-authentication
-- Author: Security Lead
-- Created: 2026-01-15
--
-- References:
--   - features/foundation/003-user-authentication/spec.md (FR-016 to FR-030)
--   - features/foundation/000-rls-implementation/spec.md (naming conventions)
-- =============================================================================

-- =============================================================================
-- TABLE: users
-- Purpose: Core authentication records (id, email, timestamps)
-- Security: Owner SELECT only, system-managed lifecycle
-- =============================================================================

-- Enable RLS (FR-001 from 000-rls)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: users_select_own
-- Allows authenticated users to SELECT only their own record (FR-006 from 000-rls)
CREATE POLICY users_select_own
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: users_service_all
-- Allows service_role full access for backend operations (FR-011 from 000-rls)
CREATE POLICY users_service_all
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: users_deny_anon
-- Explicit denial for anonymous users - no user enumeration (FR-021 from 000-rls)
-- Note: With RLS enabled and no matching policy, anon is implicitly denied.
-- This explicit policy documents the security intent.
CREATE POLICY users_deny_anon_select
  ON public.users
  FOR SELECT
  TO anon
  USING (false);


-- =============================================================================
-- TABLE: profiles
-- Purpose: User-customizable information (display_name, avatar_url, bio)
-- Security: Owner SELECT/UPDATE, service INSERT
-- =============================================================================

-- Enable RLS (FR-002 from 000-rls)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: profiles_select_own
-- Allows authenticated users to SELECT only their own profile (FR-007 from 000-rls)
-- Supports FR-024: System MUST allow users to view their profile information
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: profiles_update_own
-- Allows authenticated users to UPDATE only their own profile (FR-008 from 000-rls)
-- Supports FR-025: System MUST allow users to update display name and username
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: profiles_insert_service
-- Only service_role can INSERT profiles (created during registration)
CREATE POLICY profiles_insert_service
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: profiles_delete_own
-- Allows users to delete their own profile (FR-027: account deletion)
-- Note: Actual deletion cascades from auth.users; this supports soft-delete patterns
CREATE POLICY profiles_delete_own
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: profiles_service_all
-- Service role bypass for backend operations (FR-011 from 000-rls)
CREATE POLICY profiles_service_all
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- TABLE: sessions
-- Purpose: Active user sessions with tokens and expiration
-- Security: Owner SELECT/DELETE, system-managed INSERT/UPDATE
-- =============================================================================

-- Enable RLS (FR-003 from 000-rls)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Policy: sessions_select_own
-- Allows users to view their own active sessions (FR-029)
CREATE POLICY sessions_select_own
  ON public.sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: sessions_delete_own
-- Allows users to revoke/terminate their own sessions (FR-030)
CREATE POLICY sessions_delete_own
  ON public.sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: sessions_insert_service
-- Only service_role can create sessions (during authentication)
CREATE POLICY sessions_insert_service
  ON public.sessions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: sessions_update_service
-- Only service_role can update sessions (token refresh, expiration updates)
-- Supports FR-015: automatic token refresh before expiration
CREATE POLICY sessions_update_service
  ON public.sessions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: sessions_service_all
-- Service role bypass for backend operations
CREATE POLICY sessions_service_all
  ON public.sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- TABLE: auth_attempts
-- Purpose: Track authentication attempts for rate limiting (FR-016)
-- Security: Limited visibility - users see own attempts, service manages all
-- =============================================================================

-- Enable RLS
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: auth_attempts_select_own
-- Allows users to see their own authentication attempt history
-- Useful for security awareness (e.g., "unusual login attempt detected")
CREATE POLICY auth_attempts_select_own
  ON public.auth_attempts
  FOR SELECT
  TO authenticated
  USING (
    -- Match by user_id if authenticated
    user_id = auth.uid()
    -- OR match by email for pre-auth attempts (lookup during login)
    OR email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- Policy: auth_attempts_insert_service
-- Only service_role can INSERT auth attempts (during login flow)
-- Supports FR-016: rate limiting tracking
CREATE POLICY auth_attempts_insert_service
  ON public.auth_attempts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: auth_attempts_update_service
-- Only service_role can UPDATE attempts (mark as successful, increment counts)
CREATE POLICY auth_attempts_update_service
  ON public.auth_attempts
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: auth_attempts_delete_service
-- Only service_role can DELETE old attempts (cleanup after lockout expires)
CREATE POLICY auth_attempts_delete_service
  ON public.auth_attempts
  FOR DELETE
  TO service_role
  USING (true);

-- Policy: auth_attempts_service_all
-- Service role full access for rate limiting operations
CREATE POLICY auth_attempts_service_all
  ON public.auth_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: auth_attempts_anon_insert
-- Allow anonymous INSERT for tracking pre-auth attempts (before user is known)
-- This enables rate limiting on login attempts before authentication
CREATE POLICY auth_attempts_anon_insert
  ON public.auth_attempts
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Only allow INSERT for rate limiting fields, not sensitive data
    user_id IS NULL
    AND attempt_type IN ('login', 'password_reset')
  );


-- =============================================================================
-- TABLE: password_reset_requests
-- Purpose: Temporary password reset tokens (FR-010, FR-011)
-- Security: Service-managed only, no direct user access to tokens
-- =============================================================================

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Policy: password_reset_service_only
-- Only service_role can manage password reset requests
-- Users interact via Edge Functions, never direct DB access
CREATE POLICY password_reset_service_only
  ON public.password_reset_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Explicit denial for authenticated users - no direct token access
CREATE POLICY password_reset_deny_authenticated
  ON public.password_reset_requests
  FOR SELECT
  TO authenticated
  USING (false);


-- =============================================================================
-- TABLE: email_verifications
-- Purpose: Email verification tokens (FR-004, FR-005)
-- Security: Service-managed only, no direct user access to tokens
-- =============================================================================

-- Enable RLS
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: email_verifications_service_only
-- Only service_role can manage email verification records
CREATE POLICY email_verifications_service_only
  ON public.email_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Explicit denial for authenticated users
CREATE POLICY email_verifications_deny_authenticated
  ON public.email_verifications
  FOR SELECT
  TO authenticated
  USING (false);


-- =============================================================================
-- HELPER FUNCTION: is_own_record
-- Purpose: Reusable ownership check pattern (FR-022 from 000-rls)
-- Note: User ID derived from session, never accepted as parameter
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_own_record(record_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.uid() = record_user_id
$$;

-- Grant execute to authenticated role only
GRANT EXECUTE ON FUNCTION public.is_own_record(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_own_record(UUID) FROM anon;


-- =============================================================================
-- HELPER FUNCTION: check_rate_limit
-- Purpose: Server-side rate limiting check (FR-016)
-- Returns: TRUE if within limits, FALSE if locked out
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  target_email TEXT,
  attempt_type_param TEXT DEFAULT 'login',
  max_attempts INTEGER DEFAULT 5,
  window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO attempt_count
  FROM public.auth_attempts
  WHERE email = target_email
    AND attempt_type = attempt_type_param
    AND success = false
    AND created_at > NOW() - (window_minutes || ' minutes')::INTERVAL;

  RETURN attempt_count < max_attempts;
END;
$$;

-- Grant execute to service_role only (called from Edge Functions)
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM anon;


-- =============================================================================
-- SECURITY NOTES
-- =============================================================================
--
-- 1. All policies follow the owner isolation pattern from 000-rls-implementation
--    - Users see only their own data (FR-010: empty results, not errors)
--    - Service role handles cross-user operations (FR-011)
--
-- 2. Rate limiting (FR-016) is implemented server-side:
--    - auth_attempts table tracks failed login attempts
--    - check_rate_limit() function enforces 5 attempts per 15 minutes
--    - Called from Edge Functions before authentication attempt
--
-- 3. Session management (FR-029, FR-030):
--    - Users can view all their active sessions
--    - Users can revoke any of their sessions
--    - Only service_role can create/update sessions
--
-- 4. Sensitive tokens (password reset, email verification):
--    - Never exposed to client-side queries
--    - Managed exclusively via service_role
--    - Users interact through Edge Functions only
--
-- 5. Anonymous access:
--    - Explicitly denied on user/profile tables (FR-021: no enumeration)
--    - Limited INSERT on auth_attempts for pre-auth rate limiting
--
-- =============================================================================
