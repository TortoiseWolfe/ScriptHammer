/**
 * useUserProfile Hook
 * Feature: 034-fix-broken-user
 *
 * Fetches current user's profile from user_profiles table
 */

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const logger = createLogger('hooks:userProfile');

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

interface UseUserProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserProfile(): UseUserProfileReturn {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // The user id whose profile fetch has finished. See the return value below.
  const [settledFor, setSettledFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        // Explicit columns, not `*`: `authenticated` no longer holds SELECT on
        // `is_admin`, and a star needs the privilege on EVERY column, so it
        // fails outright rather than quietly omitting the one it cannot read.
        .select(
          'id, username, display_name, avatar_url, bio, created_at, updated_at'
        )
        .eq('id', user.id)
        .single();

      if (fetchError) {
        // PGRST116 means no rows found - not an error for new users
        if (fetchError.code === 'PGRST116') {
          setProfile(null);
        } else {
          logger.error('Error fetching user profile', { error: fetchError });
          setError('Failed to load profile');
        }
      } else {
        setProfile(data as UserProfile);
      }
    } catch (err) {
      logger.error('Error in useUserProfile', { error: err });
      setError('Failed to load profile');
    } finally {
      setLoading(false);
      setSettledFor(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // `loading` is only set to true inside the effect, which runs AFTER the render
  // where `user` first appears. That render has loading false and no profile,
  // which reads as "this user has no profile row", so callers briefly fell back
  // to the account's own avatar copy and asked storage for a file that may be
  // gone (#1514). Treat a user whose fetch has not finished as still loading.
  const awaitingFirstFetch = Boolean(user?.id) && settledFor !== user?.id;

  return {
    profile,
    loading: loading || awaitingFirstFetch,
    error,
    refetch: fetchProfile,
  };
}
