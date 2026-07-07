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
        .select('*')
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
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
  };
}
