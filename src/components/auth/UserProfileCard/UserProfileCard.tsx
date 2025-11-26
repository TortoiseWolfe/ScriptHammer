'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import AvatarDisplay from '@/components/atomic/AvatarDisplay';

export interface UserProfileCardProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * UserProfileCard component
 * Display user profile information from database (user_profiles table)
 *
 * @category molecular
 */
export default function UserProfileCard({
  className = '',
}: UserProfileCardProps) {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();

  if (!user) {
    return null;
  }

  // Use database profile data, fallback to user_metadata for avatars (upload saves there)
  const avatarUrl =
    profile?.avatar_url || (user.user_metadata?.avatar_url as string) || null;
  const displayName = profile?.display_name || user.email || 'User';

  if (loading) {
    return (
      <div className={`card bg-base-200${className ? ` ${className}` : ''}`}>
        <div className="card-body">
          <div className="flex items-center justify-center py-4">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card bg-base-200${className ? ` ${className}` : ''}`}>
      <div className="card-body">
        <div className="flex items-center gap-4">
          <AvatarDisplay
            avatarUrl={avatarUrl}
            displayName={displayName}
            size="lg"
          />
          <div className="flex-1">
            <h3 className="card-title">{displayName}</h3>
            <p className="text-sm opacity-70">{user.email}</p>
            {profile?.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
