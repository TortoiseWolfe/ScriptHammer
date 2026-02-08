-- RLS Foundation Policies
-- Feature: 000-rls-implementation
-- Date: 2026-01-15
--
-- This file defines all RLS policies for the foundation tables.
-- Execute via Supabase Management API or Dashboard SQL Editor.
-- All statements are idempotent (safe to re-run).

-- ============================================================================
-- PROFILES TABLE (T007, T009)
-- ============================================================================

-- Create profiles table if not exists
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT display_name_length CHECK (char_length(display_name) <= 100),
    CONSTRAINT bio_length CHECK (char_length(bio) <= 500)
);

-- Enable RLS on profiles (T009)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent reset)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- SELECT: Users can only view their own profile (T020 - US1)
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- UPDATE: Users can only update their own profile (T027 - US2)
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- INSERT: Service role only (via trigger on auth.users insert)
-- No policy = denied for authenticated/anon

-- DELETE: Denied for all (no policy)
-- Profiles are cascade-deleted when auth.users is deleted

-- ============================================================================
-- AUDIT_LOGS TABLE (T008, T010)
-- ============================================================================

-- Create audit_logs table if not exists
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'user.login',
        'user.logout',
        'user.signup',
        'user.delete',
        'policy.violation',
        'session.expired',
        'profile.updated'
    ))
);

-- Enable RLS on audit_logs (T010)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent reset)
DROP POLICY IF EXISTS "audit_logs_select_own" ON public.audit_logs;

-- SELECT: Users can only view their own audit entries (T051 - US5)
CREATE POLICY "audit_logs_select_own"
ON public.audit_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: Service role only (no policy = denied for others)
-- UPDATE: Denied for all (no policy = immutable) (T052 - US5)
-- DELETE: Denied for all (no policy = immutable) (T052 - US5)

-- ============================================================================
-- INDEXES FOR POLICY PERFORMANCE (T011)
-- ============================================================================

-- Profile lookup by ID (implicit from PK, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- Audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- TRIGGERS (T012, T013)
-- ============================================================================

-- Auto-create profile on user signup (T012)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, created_at, updated_at)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NOW(), NOW());

    -- Log signup event
    INSERT INTO public.audit_logs (user_id, event_type, details)
    VALUES (NEW.id, 'user.signup', jsonb_build_object('email', NEW.email));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on profile changes (T013)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ============================================================================

-- Verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Verify policies exist:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public';
